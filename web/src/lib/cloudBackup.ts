/* ============================================================
   CloudBackupService — پشتیبان‌گیری/بازیابی ابری روی Supabase Storage
   - داده‌ها قبل از آپلود با AES-256-GCM رمزنگاری می‌شوند
     (کلید تصادفی را خود برنامه می‌سازد و با DPAPI روی دستگاه نگه می‌دارد؛ رمزی از کاربر پرسیده نمی‌شود)
   - فایل ZIP: metadata.json (روشن) + payload.bin (رمزنگاری‌شده)
   - مسیر: {user_id}/{YYYY-MM-DD_HH-mm-ss}.zip
   - سقف مجموع ۲۰ مگابایت: هیچ نسخه‌ای خودکار حذف نمی‌شود؛ در صورت پر شدن، آپلود متوقف می‌شود
   - بازیابی، داده‌های محلی را کامل جایگزین می‌کند (ادغام ندارد)
   - قبل از جایگزینی، یک نسخهٔ ایمنی محلی ساخته می‌شود
   - توکن‌ها هرگز لاگ نمی‌شوند؛ کلید فقط publishable است
   ============================================================ */
import JSZip from 'jszip'
import { db, exportAll } from '../db/schema'
import { addLocalSnapshot } from './autoBackup'
import { useSettings } from '../store/settings'
import { AuthError, getAccessToken, getCurrentUser, isLoggedIn } from './auth'
import {
  APP_SCHEMA_SUPPORTED,
  BACKUP_BUCKET,
  MAX_BACKUP_BYTES,
} from './config'
import {
  b64ToBytes,
  bytesToB64,
  decryptText,
  deriveKeyRaw,
  encryptText,
  randomB64,
} from './crypto'
import { deviceName, loadSecret, saveSecret } from './secureStore'
import { applyBackupProfile } from './profile'
import { ApiError, supabase, type StorageObject } from './supabase'
import { APP_VERSION, hasDesktopBridge, saveFileToFolder } from './updater'

export type CloudErrorCode =
  | 'login_required'
  | 'session_expired'
  | 'offline'
  | 'timeout'
  | 'too_large'
  | 'storage_full'
  | 'rate_limit'
  | 'invalid_file'
  | 'schema_newer'
  | 'need_passphrase'
  | 'wrong_passphrase'
  | 'restore_failed'
  | 'no_backup'
  | 'bad_key'
  | 'unknown'

export class CloudError extends Error {
  code: CloudErrorCode
  /** برای need_passphrase: salt نسخهٔ موردنظر */
  salt?: string
  constructor(code: CloudErrorCode, message?: string, salt?: string) {
    super(message || code)
    this.code = code
    this.salt = salt
  }
}

export interface BackupEncryption {
  alg: 'AES-GCM'
  /** 'none' برای کلید خودکار؛ 'PBKDF2-SHA256' فقط در بکاپ‌های قدیمی رمزدار */
  kdf: 'PBKDF2-SHA256' | 'none'
  iterations?: number
  salt: string
  iv: string
}

export interface BackupMetadata {
  app: 'sazora'
  app_version: string
  schema_version: number
  created_at: string
  device: string
  encryption?: BackupEncryption
}

export interface CloudBackupItem extends StorageObject {
  /** برچسب تاریخ از نام فایل، برای نمایش دوستانه */
  stamp: string
}

const LAST_BACKUP_KEY = 'sazora-cloud-last'
const PRE_RESTORE_KEY = 'sazora-pre-restore'
export const CLOUD_CHANGED = 'sazora:cloud-changed'

/** جدول‌های داده‌ای که در بکاپ می‌آیند (autoBackups نه — تاریخچهٔ خودِ بکاپ است) */
const DATA_TABLES = [
  'spaces',
  'projects',
  'tasks',
  'workers',
  'attendances',
  'payments',
  'financeEntries',
  'stages',
  'projectPhotos',
  'dayLogs',
  'rateItems',
  'measurements',
  'transactions',
  'budgets',
  'assets',
  'prices',
  'goals',
  'goalItems',
  'habits',
  'habitLogs',
  'workoutDays',
  'bodyMetrics',
  'progressPhotos',
  'workoutPlans',
  'books',
  'bookSessions',
] as const

type UntypedTable = {
  clear: () => Promise<void>
  bulkAdd: (rows: unknown[]) => Promise<unknown>
}

function table(name: (typeof DATA_TABLES)[number]): UntypedTable {
  return db.table(name) as unknown as UntypedTable
}

function mapError(err: unknown): CloudError {
  if (err instanceof CloudError) return err
  if (err instanceof AuthError) {
    if (err.code === 'session_expired') return new CloudError('session_expired')
    if (err.code === 'offline') return new CloudError('offline')
    if (err.code === 'timeout') return new CloudError('timeout')
    return new CloudError('unknown', err.message)
  }
  if (err instanceof ApiError) {
    if (err.code === 'offline' || err.status === 0) return new CloudError('offline')
    if (err.code === 'unauthorized' || err.status === 401) return new CloudError('session_expired')
    if (err.code === 'too_large' || err.status === 413) return new CloudError('too_large')
    if (err.code === 'rate_limit') return new CloudError('rate_limit')
    if (err.code === 'restore_failed') return new CloudError('restore_failed')
    return new CloudError('unknown', err.message)
  }
  if (err instanceof DOMException && err.name === 'AbortError') return new CloudError('timeout')
  return new CloudError('unknown', err instanceof Error ? err.message : undefined)
}

function stampNow(d = new Date()): string {
  return d.toISOString().slice(0, 19).replace('T', '_').replace(/:/g, '-')
}

function notify(): void {
  try {
    window.dispatchEvent(new CustomEvent(CLOUD_CHANGED))
  } catch {
    /* ignore */
  }
}

/** نسخهٔ schema درون فایل بکاپ — بزرگ‌تر از نسخهٔ فعلی پذیرفته نمی‌شود */
export function readSupportedSchema(): number {
  return APP_SCHEMA_SUPPORTED
}

/* ---------------- رمزنگاری ---------------- */

interface KeyRecord {
  salt: string
  key: string
}

function keySecretName(userId: string): string {
  return `cloud-backup-key-${userId}`
}

async function loadKeyRecord(userId: string): Promise<KeyRecord | null> {
  const raw = await loadSecret(keySecretName(userId))
  if (!raw) return null
  try {
    const rec = JSON.parse(raw) as KeyRecord
    if (typeof rec.salt === 'string' && typeof rec.key === 'string') return rec
  } catch {
    /* ignore */
  }
  return null
}

async function saveKeyRecord(userId: string, rec: KeyRecord): Promise<void> {
  await saveSecret(keySecretName(userId), JSON.stringify(rec))
}

/** کلید رمزنگاری خودکار این کاربر روی این دستگاه؛ بار اول ساخته می‌شود */
async function ensureKeyRecord(userId: string): Promise<KeyRecord> {
  const existing = await loadKeyRecord(userId)
  if (existing) return existing
  const rec: KeyRecord = { salt: randomB64(16), key: randomB64(32) }
  await saveKeyRecord(userId, rec)
  return rec
}

/** آیا کلید رمزنگاری خودکار برای این کاربر روی این دستگاه آماده است؟ */
export async function hasBackupKey(): Promise<boolean> {
  const user = getCurrentUser()
  if (!user) return false
  return (await loadKeyRecord(user.id)) != null
}

/* ---------------- جایگزینی کامل داده‌ها ---------------- */

async function replaceAllData(data: Record<string, unknown[]>): Promise<void> {
  // فقط جدول‌هایی که در فایل آمده‌اند جایگزین می‌شوند تا بکاپ ناقص (مثلاً نسخهٔ موبایل)
  // دادهٔ بخش‌های دیگر روی همین دستگاه را پاک نکند. بکاپ کامل همهٔ جدول‌ها را دارد.
  const present = DATA_TABLES.filter((name) => Array.isArray(data[name]))
  await db.transaction('rw', db.tables, async () => {
    for (const name of present) await table(name).clear()
    for (const name of present) {
      const rows = data[name]
      if (Array.isArray(rows) && rows.length) await table(name).bulkAdd(rows)
    }
  })
}

/** نگه‌داشتن یک نسخهٔ ایمنی محلی قبل از بازیابی (داخل برنامه + فایل، اگر پوشه تنظیم شده) */
async function savePreRestore(payloadJson: string): Promise<string | null> {
  const at = Date.now()
  try {
    await addLocalSnapshot(at, payloadJson)
  } catch {
    /* فضای IndexedDB کم است — فایل (اگر ممکن باشد) کافی است */
  }
  try {
    localStorage.setItem(PRE_RESTORE_KEY, String(at))
  } catch {
    /* ignore */
  }
  const folder = useSettings.getState().backupDir
  if (hasDesktopBridge() && folder) {
    const res = await saveFileToFolder(`pre_restore_backup-${stampNow()}.json`, payloadJson, folder)
    if (res.ok) return res.path ?? null
  }
  return null
}

/** آخرین زمان بکاپ ابری (از localStorage؛ فقط عدد زمان، نه توکن) */
export function lastCloudBackupAt(): number | null {
  try {
    const n = Number(localStorage.getItem(LAST_BACKUP_KEY) || 0)
    return n > 0 ? n : null
  } catch {
    return null
  }
}

function markBackupNow(): void {
  try {
    localStorage.setItem(LAST_BACKUP_KEY, String(Date.now()))
  } catch {
    /* ignore */
  }
  notify()
}

function sizeOf(row: StorageObject): number {
  const n = Number(row.size)
  return Number.isFinite(n) && n > 0 ? n : 0
}

/* ---------------- سرویس ---------------- */

export class CloudBackupService {
  private ensureLogin(): void {
    if (!isLoggedIn()) throw new CloudError('login_required')
  }

  private async authToken(): Promise<string> {
    this.ensureLogin()
    try {
      return await getAccessToken()
    } catch (err) {
      throw mapError(err)
    }
  }

  private userFolder(): string {
    const user = getCurrentUser()
    if (!user) throw new CloudError('login_required')
    return user.id
  }

  /** ساخت ZIP رمزنگاری‌شده از داده‌های فعلی + metadata — بدون تغییر در داده‌ها */
  async create_backup(): Promise<{ blob: Blob; metadata: BackupMetadata }> {
    this.ensureLogin()
    const userId = this.userFolder()
    const keyRec = await ensureKeyRecord(userId)

    const payload = await exportAll()
    const encrypted = await encryptText(JSON.stringify(payload), keyRec.key)
    const metadata: BackupMetadata = {
      app: 'sazora',
      app_version: APP_VERSION,
      schema_version: APP_SCHEMA_SUPPORTED,
      created_at: new Date().toISOString(),
      device: await deviceName(),
      encryption: {
        alg: 'AES-GCM',
        kdf: 'none',
        salt: keyRec.salt,
        iv: encrypted.iv,
      },
    }
    const zip = new JSZip()
    zip.file('metadata.json', JSON.stringify(metadata, null, 2))
    zip.file('payload.bin', b64ToBytes(encrypted.ciphertext))
    const blob = await zip.generateAsync({
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 9 },
    })
    if (blob.size > MAX_BACKUP_BYTES) throw new CloudError('too_large')
    return { blob, metadata }
  }

  /**
   * آپلود فایل رمزنگاری‌شده در پوشهٔ کاربر.
   * هیچ نسخه‌ای خودکار حذف نمی‌شود؛ اگر مجموع از سقف ۲۰ مگابایت بگذرد،
   * آپلود با خطای storage_full متوقف می‌شود تا کاربر خودش نسخهٔ قدیمی را حذف کند.
   */
  async upload_backup(blob: Blob): Promise<CloudBackupItem> {
    if (blob.size > MAX_BACKUP_BYTES) throw new CloudError('too_large')
    const token = await this.authToken()
    const folder = this.userFolder()
    const existing = await this.list_backups()
    const total = existing.reduce((sum, row) => sum + sizeOf(row), 0)
    if (total + blob.size > MAX_BACKUP_BYTES) throw new CloudError('storage_full')
    const name = `${stampNow()}.zip`
    const path = `${folder}/${name}`
    try {
      await supabase.upload(BACKUP_BUCKET, path, blob, token)
    } catch (err) {
      throw mapError(err)
    }
    markBackupNow()
    return {
      name,
      path,
      createdAt: new Date().toISOString(),
      size: blob.size,
      stamp: name.replace(/\.zip$/, ''),
    }
  }

  /** بکاپ کامل: ساخت + آپلود (برای دکمهٔ «پشتیبان‌گیری همین حالا») */
  async backup_now(): Promise<CloudBackupItem> {
    const { blob } = await this.create_backup()
    return this.upload_backup(blob)
  }

  async list_backups(): Promise<CloudBackupItem[]> {
    const token = await this.authToken()
    const folder = this.userFolder()
    try {
      const rows = await supabase.list(BACKUP_BUCKET, folder, token)
      return rows
        .filter((r) => r.name && /\.zip$/i.test(r.name))
        .map((r) => ({
          ...r,
          path: `${folder}/${r.name}`,
          stamp: r.name.replace(/\.zip$/i, ''),
        }))
        .sort((a, b) => (a.name < b.name ? 1 : -1))
    } catch (err) {
      throw mapError(err)
    }
  }

  async download_backup(path: string): Promise<Blob> {
    const token = await this.authToken()
    try {
      return await supabase.download(BACKUP_BUCKET, path, token)
    } catch (err) {
      throw mapError(err)
    }
  }

  async delete_backup(path: string): Promise<void> {
    const token = await this.authToken()
    try {
      await supabase.remove(BACKUP_BUCKET, [path], token)
    } catch (err) {
      throw mapError(err)
    }
    notify()
  }

  /**
   * بازیابی کامل:
   * دانلود → اعتبارسنجی metadata → رمزگشایی → نسخهٔ ایمنی محلی → جایگزینی کامل
   * اگر کلید روی این دستگاه نباشد، CloudError('need_passphrase') با salt برمی‌گردد.
   */
  async restore_backup(path: string, passphrase?: string): Promise<{ safetyPath: string | null }> {
    const blob = await this.download_backup(path)
    let metadata: BackupMetadata
    let encryptedBin: Uint8Array | null = null
    let legacyJson: string | null = null
    try {
      const zip = await JSZip.loadAsync(blob)
      const metaFile = zip.file('metadata.json')
      if (!metaFile) throw new CloudError('invalid_file')
      metadata = JSON.parse(await metaFile.async('string')) as BackupMetadata
      const payloadFile = zip.file('payload.bin')
      const dataFile = zip.file('data.json')
      if (payloadFile) encryptedBin = await payloadFile.async('uint8array')
      else if (dataFile) legacyJson = await dataFile.async('string')
      else throw new CloudError('invalid_file')
    } catch (err) {
      if (err instanceof CloudError) throw err
      throw new CloudError('invalid_file')
    }
    if (!metadata || metadata.app !== 'sazora' || typeof metadata.schema_version !== 'number') {
      throw new CloudError('invalid_file')
    }
    if (metadata.schema_version > APP_SCHEMA_SUPPORTED) throw new CloudError('schema_newer')

    let incomingText: string
    if (encryptedBin) {
      const enc = metadata.encryption
      if (!enc || enc.alg !== 'AES-GCM' || !enc.salt || !enc.iv) throw new CloudError('invalid_file')
      const userId = this.userFolder()
      const rec = await loadKeyRecord(userId)
      let rawKey: string
      let remember = false
      if (rec && rec.salt === enc.salt) {
        rawKey = rec.key
      } else if (passphrase) {
        rawKey = await deriveKeyRaw(passphrase, enc.salt)
        remember = true
      } else {
        throw new CloudError('need_passphrase', undefined, enc.salt)
      }
      try {
        incomingText = await decryptText({ iv: enc.iv, ciphertext: bytesToB64(encryptedBin) }, rawKey)
      } catch {
        throw new CloudError('wrong_passphrase', undefined, enc.salt)
      }
      if (remember) await saveKeyRecord(userId, { salt: enc.salt, key: rawKey })
    } else {
      incomingText = legacyJson as string
    }

    let incoming: unknown
    try {
      incoming = JSON.parse(incomingText)
    } catch {
      throw new CloudError('invalid_file')
    }
    const payload = incoming as { app?: string; data?: Record<string, unknown[]> }
    if (!payload || payload.app !== 'sazora' || !payload.data) throw new CloudError('invalid_file')

    const before = await exportAll()
    const safetyPath = await savePreRestore(JSON.stringify(before))
    try {
      await replaceAllData(payload.data)
      applyBackupProfile((payload as { profile?: unknown }).profile)
    } catch {
      try {
        await replaceAllData(before.data as unknown as Record<string, unknown[]>)
      } catch {
        /* تلاش دوم برای بازگردانی */
      }
      throw new CloudError('restore_failed')
    }
    notify()
    return { safetyPath }
  }

  /** به‌روزرسانی داده از ابر: آخرین بکاپ حساب روی این دستگاه اعمال می‌شود */
  async pull_latest(passphrase?: string): Promise<{ from: CloudBackupItem; safetyPath: string | null }> {
    const list = await this.list_backups()
    if (!list.length) throw new CloudError('no_backup')
    const latest = list[0]
    const res = await this.restore_backup(latest.path, passphrase)
    return { from: latest, safetyPath: res.safetyPath }
  }
}

export const cloudBackup = new CloudBackupService()

/* ---------------- کد بازیابی برای همگام‌سازی چند دستگاه ---------------- */

const RECOVERY_PREFIX = 'SZR-KEY1'

/** کد بازیابی این حساب روی این دستگاه — برای وارد کردن در دستگاه دوم (ویندوز/موبایل) */
export async function exportRecoveryCode(): Promise<string> {
  const user = getCurrentUser()
  if (!user) throw new CloudError('login_required')
  const rec = await ensureKeyRecord(user.id)
  return `${RECOVERY_PREFIX}.${rec.salt}.${rec.key}`
}

/** وارد کردن کد بازیابی در دستگاه جدید؛ از آن پس بکاپ‌های حساب قابل رمزگشایی است */
export async function importRecoveryCode(code: string): Promise<void> {
  const user = getCurrentUser()
  if (!user) throw new CloudError('login_required')
  const parts = code.trim().split('.')
  if (parts.length !== 3 || parts[0] !== RECOVERY_PREFIX || !parts[1] || !parts[2]) {
    throw new CloudError('bad_key')
  }
  try {
    b64ToBytes(parts[1])
    b64ToBytes(parts[2])
  } catch {
    throw new CloudError('bad_key')
  }
  await saveKeyRecord(user.id, { salt: parts[1], key: parts[2] })
}

let dailyRunning = false

/** بکاپ خودکار روزانه — فقط اگر کاربر وارد شده و گزینه روشن باشد */
export async function maybeDailyCloudBackup(): Promise<boolean> {
  if (dailyRunning) return false
  if (!useSettings.getState().autoCloudBackup) return false
  if (!isLoggedIn()) return false
  const last = lastCloudBackupAt()
  if (last != null && Date.now() - last < 24 * 60 * 60 * 1000) return false
  dailyRunning = true
  try {
    await cloudBackup.backup_now()
    return true
  } catch {
    return false
  } finally {
    dailyRunning = false
  }
}
