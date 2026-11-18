import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLiveQuery } from 'dexie-react-hooks'
import { useSettings, ACCENTS, type AccentId, type MenuKey } from '../store/settings'
import { db, exportAll, importAll, wipeAll } from '../db/schema'
import { seed } from '../db/seed'
import { downloadJSON, faDigits } from '../lib/format'
import {
  APP_VERSION,
  checkForUpdates,
  chooseFolder,
  downloadAndInstallUpdate,
  hasDesktopBridge,
  installUpdateFromFile,
  onDesktopMessage,
  saveFileToFolder,
  type UpdateInfo,
} from '../lib/updater'
import {
  AUTOSAVE_EVENT,
  listSnapshots,
  readAutoSaveStatus,
  restoreSnapshot,
  runAutoBackup,
  type AutoSaveStatus,
  type SnapshotInfo,
} from '../lib/autoBackup'
import { compressImage } from '../lib/photos'
import { todayJalali, formatJalali, toJalali } from '../lib/jalali'
import { Panel, Field, TextInput } from '../ui/components'
import { loadRateList, saveRateList, resetRateList, type RatePreset } from '../lib/ratePresets'
import { UNITS } from '../lib/rates'
import type { RateUnit } from '../db/schema'

/* ============================================================
   عکس پروفایل کاربر — localStorage کلید `sazora-profile-photo`
   ============================================================ */
export const PROFILE_PHOTO_KEY = 'sazora-profile-photo'
export const PROFILE_EVENT = 'sazora:profile'

export function getProfilePhoto(): string | null {
  try {
    return localStorage.getItem(PROFILE_PHOTO_KEY)
  } catch {
    return null
  }
}

export function setProfilePhoto(dataUrl: string | null): void {
  try {
    if (dataUrl) localStorage.setItem(PROFILE_PHOTO_KEY, dataUrl)
    else localStorage.removeItem(PROFILE_PHOTO_KEY)
  } catch {
    /* حافظه پر یا غیرفعال — نادیده بگیر */
  }
  window.dispatchEvent(new CustomEvent(PROFILE_EVENT))
}

const BACKUP_EMAIL_KEY = 'sazora-backup-email'
const MENU_KEYS: MenuKey[] = ['today', 'inbox', 'projects', 'workers', 'finance', 'goals', 'learn', 'club', 'board']

/* وضعیت حافظه: ماندگار شده؟ چقدر مصرف شده؟ */
export interface StorageStatus {
  persisted: boolean | null
  usageMB: number | null
  quotaMB: number | null
}

export function useStorageStatus() {
  const [st, setSt] = useState<StorageStatus>({ persisted: null, usageMB: null, quotaMB: null })
  const refresh = useCallback(async () => {
    try {
      const [persisted, est] = await Promise.all([
        navigator.storage?.persisted?.().catch(() => null) ?? Promise.resolve(null),
        navigator.storage?.estimate?.().catch(() => null) ?? Promise.resolve(null),
      ])
      setSt({
        persisted: typeof persisted === 'boolean' ? persisted : null,
        usageMB: est?.usage != null ? Math.round((est.usage / 1048576) * 10) / 10 : null,
        quotaMB: est?.quota != null ? Math.round(est.quota / 1048576) : null,
      })
    } catch {
      /* ignore */
    }
  }, [])
  useEffect(() => {
    void refresh()
  }, [refresh])
  return { ...st, refresh }
}

function readBackupEmail(): string {
  try {
    return localStorage.getItem(BACKUP_EMAIL_KEY) ?? ''
  } catch {
    return ''
  }
}

function readAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result ?? ''))
    r.onerror = () => reject(new Error('read-failed'))
    r.readAsDataURL(file)
  })
}

function formatWhen(at: number): string {
  const d = new Date(at)
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  try {
    return `${faDigits(formatJalali(toJalali(d)))} · ${faDigits(hh)}:${faDigits(mm)}`
  } catch {
    return `${faDigits(hh)}:${faDigits(mm)}`
  }
}

type Tab = 'storage' | 'backup' | 'update' | 'data'

const TABS: { id: Tab; label: string }[] = [
  { id: 'storage', label: 'حافظه' },
  { id: 'backup', label: 'بکاپ و بازیابی' },
  { id: 'update', label: 'به‌روزرسانی' },
  { id: 'data', label: 'مدیریت داده' },
]

export default function SettingsPage() {
  const { t } = useTranslation()
  const s = useSettings()
  const fileRef = useRef<HTMLInputElement>(null)
  const photoRef = useRef<HTMLInputElement>(null)
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const [photo, setPhoto] = useState<string | null>(() => getProfilePhoto())
  const [backupEmail, setBackupEmail] = useState<string>(() => readBackupEmail())
  const [tab, setTab] = useState<Tab>('storage')
  const storage = useStorageStatus()
  const [auto, setAuto] = useState<AutoSaveStatus>(() => readAutoSaveStatus())
  const snapshots = useLiveQuery(() => listSnapshots(), []) ?? []
  const [rateList, setRateList] = useState<RatePreset[]>(() => loadRateList())
  const [newRateTitle, setNewRateTitle] = useState('')
  const [newRateUnit, setNewRateUnit] = useState<RateUnit>('m2')
  const [ratePanelOpen, setRatePanelOpen] = useState(false)
  const [menuPanelOpen, setMenuPanelOpen] = useState(false)
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null)
  const [updateBusy, setUpdateBusy] = useState<'check' | 'install' | null>(null)
  const [updateProgress, setUpdateProgress] = useState<number | null>(null)

  useEffect(() => {
    const refresh = () => setAuto(readAutoSaveStatus())
    window.addEventListener(AUTOSAVE_EVENT, refresh)
    return () => window.removeEventListener(AUTOSAVE_EVENT, refresh)
  }, [])

  useEffect(() => {
    return onDesktopMessage((d) => {
      if (d.action === 'update-download-progress') {
        const p = Number(d.percent)
        if (Number.isFinite(p)) setUpdateProgress(Math.max(0, Math.min(100, Math.round(p))))
      } else if (d.action === 'update-error') {
        setUpdateBusy(null)
        setUpdateProgress(null)
        toast('err', String(d.message ?? 'دانلود به‌روزرسانی ناموفق بود.'))
      } else if (d.action === 'update-ready') {
        setUpdateProgress(100)
        toast('ok', String(d.message ?? 'در حال نصب…'))
      }
    })
  }, [])

  function toast(kind: 'ok' | 'err', text: string) {
    setMsg({ kind, text })
    setTimeout(() => setMsg(null), 3500)
  }

  /* ---------- بکاپ و بازیابی ---------- */
  async function doExport() {
    const data = await exportAll()
    const name = `sazora-backup-${new Date().toISOString().slice(0, 10)}.json`
    if (s.backupDir && hasDesktopBridge()) {
      const res = await saveFileToFolder(name, JSON.stringify(data, null, 2), s.backupDir)
      if (res.ok) {
        toast('ok', `بکاپ در ${res.path ?? s.backupDir} ذخیره شد.`)
        return
      }
    }
    await downloadJSON(data, name)
    toast('ok', t('settings.exportSuccess'))
  }

  async function pickBackupFolder() {
    if (!hasDesktopBridge()) {
      toast('err', 'انتخاب پوشه فقط در نسخهٔ نصبی ویندوز فعال است.')
      return
    }
    const p = await chooseFolder()
    if (!p) return
    s.setBackupDir(p)
    toast('ok', 'پوشه بکاپ ذخیره شد.')
  }

  async function saveNow() {
    const ok = await runAutoBackup(true)
    setAuto(readAutoSaveStatus())
    await storage.refresh()
    toast(ok ? 'ok' : 'err', ok ? 'نسخهٔ پشتیبان ذخیره شد.' : 'ذخیره ناموفق بود یا هنوز داده‌ای وجود ندارد.')
  }

  async function doRestoreSnapshot(sn: SnapshotInfo) {
    if (
      !window.confirm(
        `نسخهٔ ${formatWhen(sn.at)} بازیابی شود؟ رکوردهای هم‌شناسه با همین نسخه جایگزین می‌شوند؛ رکوردهای تازه‌تری که در این نسخه نیستند حذف نمی‌شوند.`,
      )
    )
      return
    try {
      const stats = await restoreSnapshot(sn.id)
      toast('ok', `بازیابی شد — ${faDigits(stats.added)} رکورد جدید و ${faDigits(stats.updated)} به‌روزرسانی.`)
      setTimeout(() => window.location.reload(), 900)
    } catch {
      toast('err', 'بازیابی این نسخه ناموفق بود.')
    }
  }

  async function doInstallUpdate(file: File) {
    const res = await installUpdateFromFile(file)
    toast(res.ok ? 'ok' : 'err', res.message)
  }

  async function doCheckUpdate() {
    if (!hasDesktopBridge()) {
      toast('err', 'بررسی آنلاین فقط در نسخهٔ نصبی ویندوز فعال است.')
      return
    }
    if (updateBusy) return
    setUpdateBusy('check')
    setUpdateInfo(null)
    setUpdateProgress(null)
    const res = await checkForUpdates(APP_VERSION)
    setUpdateBusy(null)
    if (!res.ok) {
      toast('err', res.error ?? t('settings.updateError'))
      return
    }
    setUpdateInfo(res)
    toast('ok', res.updateAvailable ? `${t('settings.updateAvailable')} (${res.latestVersion})` : t('settings.updateNone'))
  }

  async function doDownloadUpdate() {
    if (!updateInfo?.assetUrl) {
      toast('err', 'فایل به‌روزرسانی در این انتشار پیدا نشد.')
      return
    }
    if (
      !window.confirm(
        `نسخهٔ ${updateInfo.latestVersion} دانلود و نصب شود؟ اپ بسته و دوباره باز می‌شود؛ داده‌های شما دست‌نخورده می‌ماند.`,
      )
    )
      return
    setUpdateBusy('install')
    setUpdateProgress(0)
    const res = await downloadAndInstallUpdate(updateInfo.assetUrl, updateInfo.digest)
    if (!res.ok) {
      setUpdateBusy(null)
      setUpdateProgress(null)
      toast('err', res.message)
      return
    }
    toast('ok', res.message)
  }

  async function doImport(file: File) {
    try {
      const json = JSON.parse(await file.text())
      // بازیابی بکاپ همیشه از مسیر «اعمال» انجام می‌شود:
      // داده‌ها پاک نمی‌شن، اعمال می‌شن و حتی رکوردهای قدیمی هم به‌روز می‌شن.
      const stats = await importAll(json)
      toast(
        'ok',
        `${t('settings.importSuccess')} — ${faDigits(stats.added)} رکورد جدید و ${faDigits(stats.updated)} رکورد به‌روزرسانی شد.`,
      )
      setTimeout(() => window.location.reload(), 900)
    } catch {
      toast('err', t('settings.importError'))
    }
  }

  async function doWipe() {
    if (!window.confirm(t('settings.resetConfirm'))) return
    if (!window.confirm('همه داده‌ها برای همیشه پاک بشه؟ این کار برگشت‌پذیر نیست.')) return
    await wipeAll()
    window.location.reload()
  }

  async function doReset() {
    if (!window.confirm(t('settings.resetConfirm'))) return
    await wipeAll()
    await seed()
    setTimeout(() => window.location.reload(), 600)
  }

  async function doMailBackup() {
    const email = backupEmail.trim()
    if (!email) {
      toast('err', 'اول ایمیل بکاپ را وارد کن')
      return
    }
    const [projectCount, txCount] = await Promise.all([db.projects.count(), db.transactions.count()]).catch(
      () => [0, 0] as [number, number],
    )
    const today = todayJalali()
    const subject = encodeURIComponent(`بکاپ سازورا — ${today}`)
    const body = encodeURIComponent(
      `خلاصه وضعیت سازورا\nتعداد پروژه‌ها: ${projectCount}\nتعداد تراکنش‌ها: ${txCount}\nتاریخ: ${today}\n\nفایل بکاپ را از بخش «دانلود بکاپ» بگیر و به همین ایمیل ضمیمه کن.`,
    )
    window.location.href = `mailto:${email}?subject=${subject}&body=${body}`
  }

  async function requestPersist() {
    try {
      const ok = await navigator.storage?.persist?.()
      await storage.refresh()
      toast(ok ? 'ok' : 'err', ok ? 'حافظه ماندگار فعال شد.' : 'مرورگر اجازهٔ حافظه ماندگار نداد.')
    } catch {
      toast('err', 'فعال‌سازی حافظه ماندگار ناموفق بود.')
    }
  }

  /* ---------- پروفایل ---------- */
  async function doPhotoPick(file: File) {
    let dataUrl = ''
    try {
      dataUrl = await compressImage(file)
    } catch {
      try {
        dataUrl = await readAsDataURL(file)
      } catch {
        toast('err', 'خواندن عکس ناموفق بود')
        return
      }
    }
    if (!dataUrl) {
      toast('err', 'خواندن عکس ناموفق بود')
      return
    }
    setProfilePhoto(dataUrl)
    setPhoto(dataUrl)
    toast('ok', 'عکس پروفایل ذخیره شد')
  }

  function doPhotoRemove() {
    setProfilePhoto(null)
    setPhoto(null)
  }

  function doBackupEmailChange(v: string) {
    setBackupEmail(v)
    try {
      localStorage.setItem(BACKUP_EMAIL_KEY, v)
    } catch {
      /* ignore */
    }
  }

  /* ---------- لیست کارها (قلم نرخ) ---------- */
  function persistRateList(next: RatePreset[]) {
    setRateList(next)
    saveRateList(next)
  }
  function addRateItem() {
    const title = newRateTitle.trim()
    if (!title) return
    if (rateList.some((p) => p.fa === title)) {
      toast('err', 'این عنوان از قبل در لیست هست')
      return
    }
    persistRateList([...rateList, { fa: title, en: title, unit: newRateUnit }])
    setNewRateTitle('')
    toast('ok', 'کار جدید به لیست اضافه شد')
  }
  function updateRateItem(index: number, patch: Partial<RatePreset>) {
    const next = rateList.map((p, i) => (i === index ? { ...p, ...patch } : p))
    persistRateList(next)
  }
  function removeRateItem(index: number) {
    persistRateList(rateList.filter((_, i) => i !== index))
  }
  function resetRateItems() {
    if (!window.confirm('لیست کارها به حالت اولیه برگرده؟')) return
    resetRateList()
    setRateList(loadRateList())
    toast('ok', 'لیست اولیه بازگردانی شد')
  }

  /* ---------- منوی اصلی ---------- */
  const menuOrder = [
    ...s.menuOrder.filter((k) => MENU_KEYS.includes(k)),
    ...MENU_KEYS.filter((k) => !s.menuOrder.includes(k)),
  ]
  function resetMenu() {
    s.setMenuOrder(MENU_KEYS)
    for (const k of [...s.hiddenMenus]) s.toggleMenu(k)
  }
  function moveMenu(idx: number, dir: -1 | 1) {
    const next = [...menuOrder]
    const target = idx + dir
    if (target < 0 || target >= next.length) return
    const [item] = next.splice(idx, 1)
    next.splice(target, 0, item)
    s.setMenuOrder(next)
  }

  const hiddenCount = menuOrder.filter((k) => s.hiddenMenus.includes(k)).length

  return (
    <div className="b-view max-w-4xl mx-auto">
      <h1 className="text-[21px] font-bold tracking-tight mb-5">{t('settings.title')}</h1>

      {/* پروفایل من — بالا، نام و عکس با هم */}
      <Panel className="mb-4">
        <div className="flex items-center gap-4 flex-wrap">
          <button
            type="button"
            className="shrink-0 rounded-full overflow-hidden border border-line"
            onClick={() => photoRef.current?.click()}
            title="انتخاب عکس پروفایل"
          >
            {photo ? (
              <img src={photo} alt="پروفایل" className="w-16 h-16 rounded-full object-cover" />
            ) : (
              <span
                className="w-16 h-16 rounded-full grid place-items-center text-white text-xl font-bold"
                style={{ background: 'linear-gradient(135deg, #E07B39, #F2B33D)' }}
              >
                {s.userName.trim().slice(0, 1) || '👤'}
              </span>
            )}
          </button>
          <div className="flex-1 min-w-[200px]">
            <label className="text-[12px] font-medium block mb-1">نام شما</label>
            <TextInput
              value={s.userName}
              onChange={(e) => s.setUserName(e.target.value)}
              placeholder="مثلاً علی رضایی"
            />
            <div className="text-[11px] text-faint mt-1">نام و عکس کنار هم زیر لوگوی برنامه نمایش داده می‌شوند.</div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="btn" onClick={() => photoRef.current?.click()}>
              انتخاب عکس
            </button>
            {photo && (
              <button className="btn btn-danger" onClick={doPhotoRemove}>
                حذف عکس
              </button>
            )}
          </div>
          <input
            ref={photoRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void doPhotoPick(f)
              e.target.value = ''
            }}
          />
        </div>
      </Panel>

      {/* عمومی */}
      <Panel className="mb-4">
        <b className="text-[14px] block mb-4">{t('settings.general')}</b>

        <div className="grid sm:grid-cols-2 gap-4">
          <Field label={t('settings.language')} hint={t('settings.languageHint')}>
            <div className="flex gap-2">
              <button
                className={`btn flex-1 ${s.lang === 'fa' ? 'btn-primary' : ''}`}
                onClick={() => s.setLang('fa')}
              >
                فارسی
              </button>
              <button
                className={`btn flex-1 ${s.lang === 'en' ? 'btn-primary' : ''}`}
                onClick={() => s.setLang('en')}
              >
                English
              </button>
            </div>
          </Field>

          <Field label={t('settings.theme')}>
            <div className="flex gap-2">
              <button
                className={`btn flex-1 ${s.theme === 'light' ? 'btn-primary' : ''}`}
                onClick={() => s.setTheme('light')}
              >
                ☀️ {t('settings.light')}
              </button>
              <button
                className={`btn flex-1 ${s.theme === 'dark' ? 'btn-primary' : ''}`}
                onClick={() => s.setTheme('dark')}
              >
                🌙 {t('settings.dark')}
              </button>
            </div>
          </Field>

          <Field label={t('settings.accent')} hint={t('settings.accentHint')}>
            <div className="flex flex-wrap gap-2">
              {ACCENTS.map((a) => (
                <button
                  key={a.id}
                  onClick={() => s.setAccent(a.id as AccentId)}
                  title={a.label}
                  className={`w-8 h-8 rounded-full border-2 transition-transform hover:scale-110 ${
                    s.accent === a.id ? 'border-ink scale-110' : 'border-transparent'
                  }`}
                  style={{ background: a.value }}
                />
              ))}
            </div>
          </Field>

          <Field label="فونت اصلی برنامه">
            <select
              className="field"
              value={s.fontFamily}
              onChange={(e) => s.setFontFamily(e.target.value as typeof s.fontFamily)}
            >
              <option value="vazirmatn">وزیرمتن (پیش‌فرض)</option>
              <option value="inter">اینتر</option>
              <option value="system">فونت سیستم</option>
            </select>
          </Field>

          <Field label="اندازه فونت">
            <select
              className="field"
              value={s.fontSize}
              onChange={(e) => s.setFontSize(e.target.value as typeof s.fontSize)}
            >
              <option value="sm">کوچک (۱۲px)</option>
              <option value="md">متوسط (۱۴px)</option>
              <option value="lg">بزرگ (۱۶px)</option>
              <option value="xl">خیلی بزرگ (۱۸px)</option>
            </select>
          </Field>
        </div>
      </Panel>

      {/* منوی اصلی و لیست کارها — کنار هم */}
      <div className="grid gap-4 mb-4 items-start lg:grid-cols-2">
        {/* منوی اصلی — قابل جمع‌شدن */}
        <Panel>
          <button
            type="button"
            className="w-full flex items-center justify-between gap-2 text-start"
            onClick={() => setMenuPanelOpen((v) => !v)}
            aria-expanded={menuPanelOpen}
          >
            <span className="min-w-0">
              <b className="text-[14px] block">منوی اصلی</b>
              {!menuPanelOpen && (
                <span className="text-[11.5px] text-muted">
                  {faDigits(menuOrder.length)} بخش
                  {hiddenCount > 0 ? ` — ${faDigits(hiddenCount)} مخفی` : ''} — برای ویرایش باز کنید
                </span>
              )}
            </span>
            <span className="chip !py-0.5 !text-[11px] shrink-0">{menuPanelOpen ? '▲ بستن' : '▼ باز کردن'}</span>
          </button>

          {menuPanelOpen && (
            <>
              <p className="text-[12px] text-muted mt-2 mb-3">
                ترتیب منو را تغییر بده یا هر بخشی را که نمی‌خواهی در منوی اصلی نبینی مخفی کن.
              </p>
              <div className="flex flex-col gap-1.5">
                {menuOrder.map((menuKey, idx) => {
                  const isHidden = s.hiddenMenus.includes(menuKey)
                  const label = t(`nav.${menuKey}`)
                  return (
                    <div
                      key={menuKey}
                      className={`flex items-center gap-2.5 border rounded-xl px-3 py-2 transition-colors ${
                        isHidden ? 'opacity-50 border-line bg-surface-2' : 'border-line bg-surface'
                      }`}
                    >
                      <span className="text-[13px] font-medium flex-1 truncate">{label}</span>
                      <div className="flex items-center gap-1">
                        <button
                          className="btn btn-ghost !py-0.5 !px-2 text-[11px]"
                          onClick={() => moveMenu(idx, -1)}
                          disabled={idx === 0}
                          title="جابه‌جایی به بالا"
                        >
                          ↑
                        </button>
                        <button
                          className="btn btn-ghost !py-0.5 !px-2 text-[11px]"
                          onClick={() => moveMenu(idx, 1)}
                          disabled={idx === menuOrder.length - 1}
                          title="جابه‌جایی به پایین"
                        >
                          ↓
                        </button>
                        <button
                          className={`btn !py-0.5 !px-2 text-[11px] ${isHidden ? 'btn-primary' : 'btn-ghost'}`}
                          onClick={() => s.toggleMenu(menuKey)}
                        >
                          {isHidden ? 'نمایش' : 'مخفی'}
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
              <div className="flex justify-end mt-2">
                <button className="btn !py-1 !px-2.5 text-[11.5px]" onClick={resetMenu}>
                  ↺ بازنشانی منو
                </button>
              </div>
            </>
          )}
        </Panel>

        {/* لیست کارها — قابل جمع‌شدن */}
        <Panel>
          <button
            type="button"
            className="w-full flex items-center justify-between gap-2 text-start"
            onClick={() => setRatePanelOpen((v) => !v)}
            aria-expanded={ratePanelOpen}
          >
            <span className="min-w-0">
              <b className="text-[14px] block">🧱 لیست کارها (قلم نرخ)</b>
              {!ratePanelOpen && (
                <span className="text-[11.5px] text-muted">
                  {faDigits(rateList.length)} عنوان — برای ویرایش باز کنید
                </span>
              )}
            </span>
            <span className="chip !py-0.5 !text-[11px] shrink-0">{ratePanelOpen ? '▲ بستن' : '▼ باز کردن'}</span>
          </button>

          {ratePanelOpen && (
            <>
              <p className="text-[12px] text-muted mt-2 mb-3">
                عنوان‌های آمادهٔ شرح کار. فقط از همین‌جا اضافه، ویرایش یا حذف می‌شوند.
              </p>
              <div className="space-y-1.5 max-h-[320px] overflow-y-auto pe-1">
                {rateList.map((p, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <TextInput
                      value={p.fa}
                      onChange={(e) => updateRateItem(i, { fa: e.target.value })}
                      className="!py-1 !text-[12px] flex-1 min-w-0"
                      aria-label="عنوان کار"
                    />
                    <select
                      className="field !py-1 !text-[11.5px] !w-24"
                      value={p.unit}
                      onChange={(e) => updateRateItem(i, { unit: e.target.value as RateUnit })}
                      aria-label="واحد"
                    >
                      {UNITS.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.fa}
                        </option>
                      ))}
                    </select>
                    <button
                      className="btn btn-ghost !px-2 !py-1 text-[11px]"
                      style={{ color: 'var(--b-red)' }}
                      onClick={() => removeRateItem(i)}
                      title="حذف از لیست"
                    >
                      ✕
                    </button>
                  </div>
                ))}
                {rateList.length === 0 && <div className="text-[12px] text-faint">لیست خالی است.</div>}
              </div>
              <div className="flex flex-wrap items-end gap-1.5 mt-3 pt-3 border-t border-line">
                <div className="flex-1 min-w-[140px]">
                  <TextInput
                    value={newRateTitle}
                    onChange={(e) => setNewRateTitle(e.target.value)}
                    placeholder="عنوان کار جدید"
                    className="!py-1.5 !text-[12.5px]"
                  />
                </div>
                <select
                  className="field !py-1.5 !text-[12px] !w-24"
                  value={newRateUnit}
                  onChange={(e) => setNewRateUnit(e.target.value as RateUnit)}
                  aria-label="واحد کار جدید"
                >
                  {UNITS.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.fa}
                    </option>
                  ))}
                </select>
                <button className="btn btn-primary !py-1.5 !px-3 text-[12.5px]" onClick={addRateItem}>
                  + افزودن
                </button>
              </div>
              <div className="flex justify-end mt-2">
                <button className="btn !py-1 !px-2.5 text-[11.5px]" onClick={resetRateItems}>
                  ↺ بازگردانی لیست اولیه
                </button>
              </div>
            </>
          )}
        </Panel>
      </div>

      {/* داده، بکاپ و به‌روزرسانی — یک پنل با تب‌های فشرده */}
      <Panel className="mb-4">
        <b className="text-[14px] block mb-3">🗄️ داده، بکاپ و به‌روزرسانی</b>

        <div className="flex flex-wrap gap-1 mb-4 bg-surface-2 border border-line rounded-xl p-1">
          {TABS.map((x) => (
            <button
              key={x.id}
              type="button"
              onClick={() => setTab(x.id)}
              className={`flex-1 min-w-[88px] text-[12px] rounded-lg px-2 py-1.5 transition-colors ${
                tab === x.id ? 'bg-surface font-semibold shadow-sm text-ink' : 'text-muted hover:text-ink'
              }`}
            >
              {x.label}
            </button>
          ))}
        </div>

        {tab === 'storage' && (
          <div>
            <div className="grid sm:grid-cols-2 gap-3 mb-3">
              <div className="rounded-xl border border-line bg-surface-2 p-3">
                <div className="text-[11.5px] text-muted mb-1.5">وضعیت حافظه</div>
                <div className="flex flex-wrap gap-1.5 text-[11.5px]">
                  <span className="chip">
                    ماندگار: {storage.persisted == null ? 'نامشخص' : storage.persisted ? '✓ فعال' : 'غیرفعال'}
                  </span>
                  <span className="chip">
                    مصرف: {storage.usageMB == null ? '—' : `${faDigits(storage.usageMB)} مگابایت`}
                    {storage.quotaMB != null ? ` از ${faDigits(storage.quotaMB)} مگابایت` : ''}
                  </span>
                </div>
                {storage.persisted === false && (
                  <button className="btn !py-1 !px-2.5 mt-2 text-[11.5px]" onClick={() => void requestPersist()}>
                    فعال‌سازی حافظه ماندگار
                  </button>
                )}
              </div>

              <div className="rounded-xl border border-line bg-surface-2 p-3">
                <div className="text-[11.5px] text-muted mb-1.5">ذخیرهٔ خودکار هر ۱ ساعت</div>
                <div className="text-[12px]">
                  {auto.at
                    ? `${formatWhen(auto.at)} — ${auto.mode === 'file' ? 'در پوشهٔ بکاپ + داخل برنامه' : 'داخل برنامه'}`
                    : 'هنوز ذخیره نشده'}
                </div>
                <button className="btn btn-primary !py-1 !px-2.5 mt-2 text-[11.5px]" onClick={() => void saveNow()}>
                  ذخیرهٔ فوری
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap text-[12px]">
              <span className="text-muted shrink-0">پوشهٔ بکاپ:</span>
              <span dir="ltr" className="text-faint break-all flex-1 min-w-[160px]">
                {s.backupDir || 'پوشهٔ دانلود پیش‌فرض / حافظهٔ برنامه'}
              </span>
              <button className="btn !py-1 !px-2.5 text-[11.5px]" onClick={() => void pickBackupFolder()}>
                انتخاب پوشه
              </button>
              {s.backupDir && (
                <button className="btn !py-1 !px-2.5 text-[11.5px]" onClick={() => s.setBackupDir('')}>
                  پاک کردن
                </button>
              )}
            </div>
            {auto.path && (
              <div className="text-[11px] text-faint mt-1 break-all" dir="ltr">
                {auto.path}
              </div>
            )}

            <p className="text-[11.5px] text-faint mt-3 leading-relaxed">
              هر تغییری (تسک، کارکرد، تراکنش…) بلافاصله در حافظهٔ همین مرورگر ذخیره می‌شود. علاوه بر آن،
              تا وقتی اپ باز است، هر ساعت یک نسخهٔ پشتیبان داخل برنامه ساخته می‌شود (۵ نسخهٔ آخر برای
              بازیابی). اگر پوشهٔ بکاپ انتخاب شده باشد، فایل{' '}
              <b dir="ltr">sazora-auto-latest.json</b> هم در همان پوشه به‌روز می‌شود.
            </p>
          </div>
        )}

        {tab === 'backup' && (
          <div>
            <div className="flex flex-wrap gap-2">
              <button className="btn btn-primary" onClick={() => void doExport()}>
                ⬇ دانلود بکاپ (JSON)
              </button>
              <button className="btn" onClick={() => fileRef.current?.click()}>
                🔀 بازیابی از فایل
              </button>
            </div>

            <div className="grid sm:grid-cols-[1fr_auto] gap-2 items-end mt-3">
              <Field label="ایمیل بکاپ (اختیاری)">
                <TextInput
                  value={backupEmail}
                  onChange={(e) => doBackupEmailChange(e.target.value)}
                  placeholder="you@mail.com"
                  dir="ltr"
                />
              </Field>
              <button className="btn" onClick={() => void doMailBackup()}>
                ارسال به ایمیل
              </button>
            </div>
            <div className="text-[11px] text-faint mt-1">
              مرورگر اجازهٔ ارسال خودکار ایمیل نمی‌دهد؛ فایل بکاپ را دانلود و به ایمیل ضمیمه کن.
            </div>

            <details className="mt-3 text-[12px] text-muted">
              <summary className="cursor-pointer">ترفند: ذخیرهٔ خودکار بکاپ‌ها در OneDrive / Google Drive</summary>
              <ol className="text-[11.5px] flex flex-col gap-1 list-decimal list-inside mt-2 leading-relaxed">
                <li>OneDrive یا Google Drive را روی ویندوز نصب و وارد حساب شو.</li>
                <li>
                  در مرورگر: <b dir="ltr">Settings ← Downloads ← Change</b> و پوشهٔ ابری را انتخاب کن.
                </li>
                <li>گزینهٔ پرسیدن محل ذخیره را خاموش کن تا بکاپ بدون سؤال ذخیره شود.</li>
              </ol>
            </details>

            <div className="mt-4 pt-4 border-t border-line">
              <div className="flex items-center justify-between gap-2 mb-2">
                <b className="text-[13px]">نسخه‌های ذخیرهٔ خودکار</b>
                <span className="text-[11px] text-faint">{faDigits(snapshots.length)} از ۵</span>
              </div>
              {snapshots.length === 0 ? (
                <div className="text-[12px] text-faint">هنوز نسخه‌ای ذخیره نشده است.</div>
              ) : (
                <div className="flex flex-col">
                  {snapshots.map((sn) => (
                    <div
                      key={sn.id}
                      className="flex items-center gap-2 py-1.5 border-b border-line last:border-0"
                    >
                      <span className="text-[12px] flex-1">{formatWhen(sn.at)}</span>
                      <span className="text-[11px] text-faint">
                        {faDigits(Math.max(1, Math.round(sn.json.length / 1024)))} KB
                      </span>
                      <button
                        className="btn btn-ghost !py-0.5 !px-2 text-[11px]"
                        onClick={() => void doRestoreSnapshot(sn)}
                      >
                        بازیابی
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="text-[11px] text-faint mt-2">
                بازیابی، رکوردهای هم‌شناسه را به همین نسخه برمی‌گرداند؛ رکوردهای تازه‌تری که در نسخه
                نیستند باقی می‌مانند.
              </div>
            </div>

            <input
              ref={fileRef}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) void doImport(f)
                e.target.value = ''
              }}
            />
          </div>
        )}

        {tab === 'update' && (
          <div>
            <p className="text-[12px] text-muted mb-3">
              نسخهٔ نصب‌شده: <b className="text-ink" dir="ltr">{APP_VERSION}</b> — بررسی آنلاین از
              GitHub Releases یا نصب دستی از فایل ZIP. داده‌های شما دست‌نخورده می‌ماند.
            </p>
            <label className="flex items-center gap-2 mb-3 cursor-pointer select-none">
              <input
                type="checkbox"
                className="accent-current"
                checked={s.autoUpdate}
                onChange={(e) => s.setAutoUpdate(e.target.checked)}
              />
              <span className="text-[12.5px]">
                {t('settings.autoUpdate')}
                <span className="block text-[11px] text-faint">{t('settings.autoUpdateHint')}</span>
              </span>
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                className="btn btn-primary"
                disabled={updateBusy !== null}
                onClick={() => void doCheckUpdate()}
              >
                ↻ {updateBusy === 'check' ? 'در حال بررسی…' : t('settings.updateCheck')}
              </button>
              <label className="btn cursor-pointer">
                📁 {t('settings.updateInstallOffline')}
                <input
                  type="file"
                  accept=".zip"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) void doInstallUpdate(f)
                    e.target.value = ''
                  }}
                />
              </label>
            </div>

            {updateInfo && !updateInfo.updateAvailable && (
              <div className="mt-3 text-[12px] text-muted">✓ {t('settings.updateNone')}</div>
            )}

            {updateInfo?.updateAvailable && (
              <div className="mt-3 rounded-xl border border-line p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-[13px] font-semibold">
                    {t('settings.updateAvailable')} — نسخهٔ{' '}
                    <b dir="ltr" className="text-ink">{updateInfo.latestVersion}</b>
                  </div>
                  {updateInfo.releaseUrl && (
                    <a
                      className="text-[11.5px] text-ink underline"
                      href={updateInfo.releaseUrl}
                      target="_blank"
                      rel="noreferrer"
                      dir="ltr"
                    >
                      Release notes
                    </a>
                  )}
                </div>
                {updateInfo.notes && (
                  <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap text-[11.5px] text-muted leading-relaxed" dir="auto">
                    {updateInfo.notes}
                  </pre>
                )}
                <button
                  className="btn btn-primary mt-3"
                  disabled={updateBusy !== null}
                  onClick={() => void doDownloadUpdate()}
                >
                  ⬇ {updateBusy === 'install' ? 'در حال دانلود…' : t('settings.updateDownload')}
                </button>
                {updateBusy === 'install' && updateProgress != null && (
                  <div className="mt-2 text-[11.5px] text-muted">
                    دانلود: {faDigits(updateProgress)}٪ — پس از پایان، اپ خودش بسته و دوباره باز می‌شود.
                  </div>
                )}
              </div>
            )}

            <div className="text-[11.5px] text-faint mt-2">
              {hasDesktopBridge()
                ? 'پس از انتخاب فایل یا پایان دانلود، اپ خودش بسته، به‌روزرسانی و دوباره باز می‌شود.'
                : 'در نسخهٔ وب امکان جایگزینی خودکار وجود ندارد؛ فایل‌های نسخهٔ جدید را جایگزین کنید.'}
            </div>
          </div>
        )}

        {tab === 'data' && (
          <div>
            <p className="text-[12px] text-muted mb-3">
              برای بکاپ‌گیری و بازیابی به تب «بکاپ و بازیابی» برو. این تب برای پاک‌سازی و شروع تازه است.
            </p>
            <div className="flex flex-wrap items-center justify-between gap-3 py-2">
              <div>
                <div className="text-[13px] font-semibold" style={{ color: 'var(--b-red)' }}>
                  پاک‌سازی کامل (شروع خالی)
                </div>
                <div className="text-[11.5px] text-faint">همهٔ داده‌ها برای همیشه پاک می‌شوند.</div>
              </div>
              <button className="btn btn-danger" onClick={() => void doWipe()}>
                پاک‌سازی کامل
              </button>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 py-2 border-t border-line">
              <div>
                <div className="text-[13px] font-semibold">بازگردانی دادهٔ نمونه</div>
                <div className="text-[11.5px] text-faint">{t('settings.resetConfirm')}</div>
              </div>
              <button className="btn" onClick={() => void doReset()}>
                بازگردانی نمونه
              </button>
            </div>
          </div>
        )}
      </Panel>

      {/* درباره */}
      <Panel>
        <div className="flex items-center gap-3 mb-3">
          <img src="./logo.svg" alt="SAZORA" className="w-11 h-11" />
          <div>
            <b className="text-[16px] tracking-wide" dir="ltr">SAZORA</b>
            <div className="text-[11.5px] text-muted">
              {s.lang === 'fa' ? 'با شفافیت بساز، با اطمینان مدیریت کن.' : 'Build with clarity. Manage with confidence.'}
            </div>
          </div>
        </div>
        <p className="text-[12.5px] text-muted leading-relaxed mb-3">
          {s.lang === 'fa'
            ? 'سازورا دستیار آفلاین مدیریت کار، پروژه‌های ساختمانی، مالی و اهداف است — اطلاعاتت فقط روی دستگاه خودت می‌ماند. اگر برایت مفید بود، با حمایتت به بهتر شدنش کمک کن.'
            : 'SAZORA is an offline assistant for tasks, construction projects, finance and goals — your data stays on your own device. If you find it useful, please support its development with a donation.'}
        </p>
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-[12.5px]">
          <span className="text-muted">
            {t('settings.version')}: <b className="text-ink" dir="ltr">{APP_VERSION}</b>
          </span>
          <span className="text-muted">
            {s.lang === 'fa' ? 'سازنده: ' : 'Author: '}
            <b className="text-ink">{s.lang === 'fa' ? 'امید معصومی' : 'Omid Masomi'}</b>
          </span>
          <span className="text-muted">
            {s.lang === 'fa' ? 'گیت‌هاب: ' : 'GitHub: '}
            <a
              className="text-ink underline"
              href="https://github.com/omidmasumi740-dev"
              target="_blank"
              rel="noreferrer"
              dir="ltr"
            >
              github.com/omidmasumi740-dev
            </a>
          </span>
          <span className="text-muted">
            {t('settings.storage')}: <b className="text-ink">IndexedDB — {t('settings.storageHint')}</b>
          </span>
          <span className="text-muted">
            تکنولوژی: <b className="text-ink">React + Vite + Tailwind + Dexie</b>
          </span>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <a
            className="btn btn-primary"
            href="https://omidmasumi740-dev.github.io/donate-page/"
            target="_blank"
            rel="noreferrer"
          >
            ☕ {s.lang === 'fa' ? 'حمایت مالی (Donate)' : 'Donate'}
          </a>
          <a className="btn" href="https://github.com/omidmasumi740-dev" target="_blank" rel="noreferrer">
            ⬇ {s.lang === 'fa' ? 'اپدیت‌ها و نسخه‌های جدید در گیت‌هاب' : 'Updates & new versions on GitHub'}
          </a>
        </div>
      </Panel>

      {msg && (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 px-4 py-2.5 rounded-lg text-[13px] shadow-float z-50 b-pop"
          style={{
            background: msg.kind === 'ok' ? 'var(--b-green)' : 'var(--b-red)',
            color: '#fff',
          }}
        >
          {msg.text}
        </div>
      )}
    </div>
  )
}
