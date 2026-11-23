import { useEffect } from 'react'
import { db, exportAll, importAll, type AutoBackup } from '../db/schema'
import { useSettings } from '../store/settings'
import { hasDesktopBridge, saveFileToFolder } from './updater'

/* ============================================================
   ذخیرهٔ خودکار ساعتی — تا وقتی اپ باز است
   - همیشه آخرین ۵ نسخه داخل خود برنامه (IndexedDB) نگه داشته می‌شود.
   - نسخهٔ نصبی ویندوز با پوشهٔ انتخاب‌شده: فایل
     `sazora-auto-latest.json` هم در همان پوشه به‌روز می‌شود.
   ============================================================ */

const INTERVAL_MS = 60 * 60 * 1000
const TICK_MS = 5 * 60 * 1000
const MAX_SNAPSHOTS = 5
const AT_KEY = 'sazora-autosave-at'
const MODE_KEY = 'sazora-autosave-mode'
const PATH_KEY = 'sazora-autosave-path'
export const AUTOSAVE_EVENT = 'sazora:autosave'

export interface AutoSaveStatus {
  at: number | null
  mode: 'file' | 'snapshot' | null
  path: string | null
}

export function readAutoSaveStatus(): AutoSaveStatus {
  try {
    const at = Number(localStorage.getItem(AT_KEY) || 0)
    const mode = localStorage.getItem(MODE_KEY)
    return {
      at: at > 0 ? at : null,
      mode: mode === 'file' || mode === 'snapshot' ? mode : null,
      path: localStorage.getItem(PATH_KEY),
    }
  } catch {
    return { at: null, mode: null, path: null }
  }
}

let running = false

/** آیا داده‌ای برای بکاپ وجود دارد؟ (اپ خالی را بکاپ نمی‌کنیم) */
function hasData(payload: { data: Record<string, unknown[]> }): boolean {
  return Object.values(payload.data).some((rows) => Array.isArray(rows) && rows.length > 0)
}

/** فشرده‌سازی gzip برای نسخهٔ داخلی — در مرورگرهای بدون پشتیبانی، null برمی‌گرداند */
async function gzipJson(json: string): Promise<Blob | null> {
  try {
    if (typeof CompressionStream === 'undefined') return null
    const stream = new Blob([json]).stream().pipeThrough(new CompressionStream('gzip'))
    return await new Response(stream).blob()
  } catch {
    return null
  }
}

/** خواندن متن کامل یک نسخه — هم فرمت فشردهٔ جدید و هم نسخه‌های قدیمی JSON */
export async function snapshotText(row: AutoBackup): Promise<string> {
  if (typeof row.json === 'string') return row.json
  if (!row.blob) throw new Error('snapshot-empty')
  if (typeof DecompressionStream === 'undefined') throw new Error('snapshot-unsupported')
  const stream = row.blob.stream().pipeThrough(new DecompressionStream('gzip'))
  return await new Response(stream).text()
}

/** یک نسخهٔ محلی اضافه می‌کند — برای بکاپ خودکار و نسخهٔ ایمنی قبل از بازیابی */
export async function addLocalSnapshot(at: number, json: string): Promise<number> {
  const blob = await gzipJson(json)
  if (blob) {
    await db.autoBackups.add({ at, blob, format: 'gzip-json', bytes: blob.size })
    return blob.size
  }
  await db.autoBackups.add({ at, json })
  return json.length
}

async function saveSnapshot(json: string): Promise<boolean> {
  const at = Date.now()
  try {
    await addLocalSnapshot(at, json)
  } catch {
    // فضای IndexedDB کم است — نسخه‌های قبلی را آزاد کن و یک‌بار دیگر تلاش کن
    try {
      const old = await db.autoBackups.toArray()
      for (const row of old) if (row.id != null) await db.autoBackups.delete(row.id)
      await addLocalSnapshot(at, json)
    } catch (err) {
      console.error('auto-backup snapshot failed:', err)
      return false
    }
  }
  const all = await db.autoBackups.orderBy('at').toArray()
  const extra = all.slice(0, Math.max(0, all.length - MAX_SNAPSHOTS))
  const ids = extra.map((r) => r.id).filter((id): id is number => typeof id === 'number')
  if (ids.length) await db.autoBackups.bulkDelete(ids)
  return true
}

/** یک‌بار ذخیرهٔ خودکار را انجام بده. force=true برای دکمهٔ «ذخیرهٔ فوری» */
export async function runAutoBackup(force = false): Promise<boolean> {
  if (running) return false
  running = true
  try {
    const status = readAutoSaveStatus()
    if (!force && status.at != null && Date.now() - status.at < INTERVAL_MS) return false

    const payload = await exportAll()
    if (!hasData(payload)) return false
    const json = JSON.stringify(payload)
    const folder = useSettings.getState().backupDir
    let mode: 'file' | 'snapshot' = 'snapshot'
    let path: string | null = null

    // همیشه یک نسخه داخل برنامه (۵ نسخهٔ آخر) نگه می‌داریم تا تاریخچهٔ بازیابی وجود داشته باشد
    const snapOk = await saveSnapshot(json)
    if (hasDesktopBridge() && folder) {
      const res = await saveFileToFolder('sazora-auto-latest.json', json, folder)
      if (res.ok) {
        mode = 'file'
        path = res.path ?? `${folder}\\sazora-auto-latest.json`
      }
    }
    if (!snapOk && mode !== 'file') return false

    const at = Date.now()
    try {
      localStorage.setItem(AT_KEY, String(at))
      localStorage.setItem(MODE_KEY, mode)
      if (path) localStorage.setItem(PATH_KEY, path)
      else localStorage.removeItem(PATH_KEY)
    } catch {
      /* ignore */
    }
    window.dispatchEvent(new CustomEvent(AUTOSAVE_EVENT))
    return true
  } catch (err) {
    console.error('auto-backup failed:', err)
    return false
  } finally {
    running = false
  }
}

/** ذخیرهٔ خودکار هر ساعت — تا وقتی اپ باز است (حتی در پس‌زمینه) */
export function useAutoBackup(): void {
  useEffect(() => {
    const tick = () => {
      void runAutoBackup()
    }
    // اگر از آخرین ذخیره بیش از یک ساعت گذشته، چند ثانیه بعد از باز شدن اپ ذخیره کن
    const first = setTimeout(tick, 5000)
    const timer = setInterval(tick, TICK_MS)
    const onVisible = () => {
      if (document.visibilityState === 'visible') void runAutoBackup()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearTimeout(first)
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])
}

export interface SnapshotInfo {
  id: number
  at: number
  bytes: number
}

/** فهرست نسخه‌های پشتیبان داخل برنامه (جدیدترین اول) — فقط متادیتا، بدون بارگذاری محتوا */
export async function listSnapshots(): Promise<SnapshotInfo[]> {
  const rows = await db.autoBackups.orderBy('at').reverse().toArray()
  return rows
    .filter((r): r is AutoBackup & { id: number } => typeof r.id === 'number')
    .map((r) => ({ id: r.id, at: r.at, bytes: r.bytes ?? r.json?.length ?? 0 }))
}

/** بازیابی یک نسخه — ادغام با داده‌های فعلی (هیچ داده‌ای پاک نمی‌شود) */
export async function restoreSnapshot(id: number) {
  const row = await db.autoBackups.get(id)
  if (!row) throw new Error('snapshot-missing')
  return importAll(JSON.parse(await snapshotText(row)))
}
