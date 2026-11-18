import { useEffect, useState } from 'react'
import { useSettings } from '../store/settings'
import {
  APP_VERSION,
  checkForUpdates,
  downloadAndInstallUpdate,
  hasDesktopBridge,
  onDesktopMessage,
  type UpdateInfo,
} from '../lib/updater'

/** بررسی خودکار نسخهٔ جدید هنگام باز شدن اپ و نمایش نوار به‌روزرسانی */
export function UpdateBanner() {
  const lang = useSettings((s) => s.lang)
  const autoUpdate = useSettings((s) => s.autoUpdate)
  const [info, setInfo] = useState<UpdateInfo | null>(null)
  const [dismissed, setDismissed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState<number | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!autoUpdate || !hasDesktopBridge()) return
    const off = onDesktopMessage((d) => {
      if (d.action === 'update-download-progress') {
        const p = Number(d.percent)
        if (Number.isFinite(p)) setProgress(Math.max(0, Math.min(100, Math.round(p))))
      } else if (d.action === 'update-error') {
        setBusy(false)
        setProgress(null)
        setError(String(d.message ?? 'دانلود به‌روزرسانی ناموفق بود.'))
      }
    })
    let cancelled = false
    const timer = setTimeout(() => {
      void checkForUpdates(APP_VERSION).then((r) => {
        if (!cancelled && r.ok && r.updateAvailable) setInfo(r)
      })
    }, 4000)
    return () => {
      cancelled = true
      clearTimeout(timer)
      off()
    }
  }, [autoUpdate])

  if (!info || dismissed) return null

  async function install() {
    if (!info?.assetUrl) return
    const ok = window.confirm(
      lang === 'fa'
        ? `نسخهٔ ${info.latestVersion} دانلود و نصب شود؟ اپ بسته و دوباره باز می‌شود؛ داده‌های شما دست‌نخورده می‌ماند.`
        : `Download and install version ${info.latestVersion}? The app will close and reopen; your data stays intact.`,
    )
    if (!ok) return
    setBusy(true)
    setError('')
    setProgress(0)
    const res = await downloadAndInstallUpdate(info.assetUrl, info.digest)
    if (!res.ok) {
      setBusy(false)
      setProgress(null)
      setError(res.message)
    }
  }

  return (
    <div
      dir={lang === 'fa' ? 'rtl' : 'ltr'}
      className="fixed bottom-4 inset-x-4 sm:inset-x-auto sm:end-4 sm:w-[360px] z-50 rounded-xl border border-line bg-surface shadow-float p-3 b-pop"
    >
      <div className="flex items-start gap-2">
        <span className="text-[18px]">⬆️</span>
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-semibold">
            {lang === 'fa' ? 'نسخهٔ جدید آماده است' : 'A new version is available'}
            {info.latestVersion && (
              <b className="text-accent" dir="ltr">
                {' '}
                v{info.latestVersion}
              </b>
            )}
          </div>
          <div className="text-[11.5px] text-muted mt-0.5">
            {busy
              ? lang === 'fa'
                ? `در حال دانلود${progress != null ? ` — ${progress}٪` : '…'}`
                : `Downloading${progress != null ? ` — ${progress}%` : '…'}`
              : error ||
                (lang === 'fa'
                  ? 'به‌روزرسانی خودکار فعال است؛ برای نصب یک کلیک کافی است.'
                  : 'Auto-update is on; one click is enough to install.')}
          </div>
          {busy && (
            <div className="mt-2 h-1.5 rounded-full bg-surface-2 overflow-hidden">
              <div
                className="h-full bg-accent transition-all"
                style={{ width: `${progress ?? 0}%` }}
              />
            </div>
          )}
          <div className="mt-2 flex items-center gap-2">
            <button className="btn btn-primary !py-1 !px-3 text-[12px]" disabled={busy} onClick={() => void install()}>
              {busy ? (lang === 'fa' ? 'در حال نصب…' : 'Installing…') : lang === 'fa' ? 'دانلود و نصب' : 'Download & install'}
            </button>
            {info.releaseUrl && (
              <a
                className="text-[11.5px] text-muted underline"
                href={info.releaseUrl}
                target="_blank"
                rel="noreferrer"
              >
                {lang === 'fa' ? 'تغییرات' : 'Notes'}
              </a>
            )}
            <button
              className="text-[11.5px] text-faint ms-auto"
              disabled={busy}
              onClick={() => setDismissed(true)}
            >
              {lang === 'fa' ? 'بعداً' : 'Later'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
