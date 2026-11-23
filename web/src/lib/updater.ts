/* ============================================================
   پل به‌روزرسانی و پوشه‌ها — فقط در نسخهٔ نصبی ویندوز (WebView2)
   در نسخهٔ وب، پیام راهنما برمی‌گرداند.
   ============================================================ */

interface WebViewHost {
  postMessage: (msg: string) => void
  addEventListener: (type: 'message', cb: (e: { data: unknown }) => void) => void
  removeEventListener: (type: 'message', cb: (e: { data: unknown }) => void) => void
}

function host(): WebViewHost | null {
  try {
    const w = window as unknown as { chrome?: { webview?: WebViewHost } }
    return w.chrome?.webview ?? null
  } catch {
    return null
  }
}

export function hasDesktopBridge(): boolean {
  return !!host()
}

/** اشتراک در پیام‌های میزبان (پیشرفت دانلود، خطا و آماده‌شدن به‌روزرسانی) */
export function onDesktopMessage(cb: (data: Record<string, unknown>) => void): () => void {
  const h = host()
  if (!h) return () => {}
  const handler = (e: { data: unknown }) => {
    try {
      const data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data
      if (data && typeof data === 'object') cb(data as Record<string, unknown>)
    } catch {
      /* پیام غیر JSON — نادیده بگیر */
    }
  }
  h.addEventListener('message', handler)
  return () => h.removeEventListener('message', handler)
}

export const APP_VERSION = '1.9.22'
export const GITHUB_REPO = 'omidmasumi740-dev/sazora'

export interface UpdateInfo {
  ok: boolean
  currentVersion: string
  latestVersion: string
  updateAvailable: boolean
  releaseUrl: string
  assetName: string
  assetUrl: string
  assetSize: number
  digest: string
  notes: string
  error?: string
}

function asText(v: unknown): string {
  return typeof v === 'string' ? v : ''
}

function asCount(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0
}

function readUpdateInfo(d: Record<string, unknown>): UpdateInfo {
  return {
    ok: Boolean(d.ok),
    currentVersion: asText(d.currentVersion),
    latestVersion: asText(d.latestVersion),
    updateAvailable: Boolean(d.updateAvailable),
    releaseUrl: asText(d.releaseUrl),
    assetName: asText(d.assetName),
    assetUrl: asText(d.assetUrl),
    assetSize: asCount(d.assetSize),
    digest: asText(d.digest),
    notes: asText(d.notes),
    error: d.error ? String(d.error) : undefined,
  }
}

/** بررسی آخرین انتشار GitHub از طریق میزبان دسکتاپ (بدون درگیرشدن با CORS) */
export async function checkForUpdates(currentVersion = APP_VERSION): Promise<UpdateInfo> {
  const h = host()
  if (!h) {
    return {
      ok: false,
      currentVersion,
      latestVersion: '',
      updateAvailable: false,
      releaseUrl: '',
      assetName: '',
      assetUrl: '',
      assetSize: 0,
      digest: '',
      notes: '',
      error: 'بررسی آنلاین فقط در نسخهٔ نصبی ویندوز فعال است.',
    }
  }
  const p = waitForHost<UpdateInfo>(
    (d) => (d.action === 'update-check-result' ? readUpdateInfo(d) : undefined),
    30000,
  )
  h.postMessage(JSON.stringify({ action: 'check-update', currentVersion }))
  const r = await p
  if (!r) {
    return {
      ok: false,
      currentVersion,
      latestVersion: '',
      updateAvailable: false,
      releaseUrl: '',
      assetName: '',
      assetUrl: '',
      assetSize: 0,
      digest: '',
      notes: '',
      error: 'پاسخی از برنامه دریافت نشد؛ اتصال اینترنت را بررسی کنید.',
    }
  }
  return r
}

/** دانلود و نصب به‌روزرسانی از نشانی GitHub Releases */
export async function downloadAndInstallUpdate(assetUrl: string, digest = ''): Promise<{ ok: boolean; message: string }> {
  const h = host()
  if (!h) return { ok: false, message: 'نصب خودکار فقط در نسخهٔ نصبی ویندوز فعال است.' }
  if (!assetUrl) return { ok: false, message: 'نشانی فایل به‌روزرسانی خالی است.' }
  const p = waitForHost<Record<string, unknown>>(
    (d) => (d.action === 'update-download-started' || d.action === 'update-error' ? d : undefined),
    15000,
  )
  h.postMessage(JSON.stringify({ action: 'download-update', url: assetUrl, digest }))
  const r = await p
  if (!r) return { ok: false, message: 'شروع دانلود تأیید نشد؛ دوباره تلاش کنید.' }
  if (r.action === 'update-error') return { ok: false, message: asText(r.message) || 'دانلود به‌روزرسانی ناموفق بود.' }
  return { ok: true, message: 'دانلود آغاز شد؛ پس از پایان، اپ بسته و به‌روزرسانی می‌شود.' }
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => {
      const s = String(r.result ?? '')
      const i = s.indexOf('base64,')
      resolve(i >= 0 ? s.slice(i + 7) : s)
    }
    r.onerror = () => reject(new Error('read-failed'))
    r.readAsDataURL(file)
  })
}

/** دریافت پاسخ از میزبان دسکتاپ */
function waitForHost<T>(match: (data: Record<string, unknown>) => T | undefined, timeout = 60000): Promise<T | null> {
  return new Promise((resolve) => {
    const h = host()
    if (!h) return resolve(null)
    let done = false
    let timer: ReturnType<typeof setTimeout>
    const finish = (v: T | null) => {
      if (done) return
      done = true
      clearTimeout(timer)
      h.removeEventListener('message', handler)
      resolve(v)
    }
    const handler = (e: { data: unknown }) => {
      let data: Record<string, unknown>
      try {
        data = typeof e.data === 'string' ? JSON.parse(e.data) : (e.data as Record<string, unknown>)
      } catch {
        return
      }
      const v = match(data)
      if (v !== undefined) finish(v)
    }
    timer = setTimeout(() => finish(null), timeout)
    h.addEventListener('message', handler)
  })
}

/** انتخاب پوشه با دیالوگ ویندوز */
export async function chooseFolder(): Promise<string | null> {
  const h = host()
  if (!h) return null
  const p = waitForHost<string>((d) => (d.action === 'folder-selected' ? String(d.path ?? '') : undefined))
  h.postMessage(JSON.stringify({ action: 'choose-folder' }))
  return p
}

/** نصب آپدیت از فایل ZIP — اپ خودش بسته و جایگزین می‌شود */
export async function installUpdateFromFile(file: File): Promise<{ ok: boolean; message: string }> {
  const h = host()
  if (!h) {
    return {
      ok: false,
      message: 'نصب خودکار فقط در نسخهٔ نصبی ویندوز فعال است. در نسخهٔ وب، فایل ZIP جدید را جایگزین کنید.',
    }
  }
  if (!file.name.toLowerCase().endsWith('.zip')) {
    return { ok: false, message: 'فایل آپدیت باید ZIP باشد.' }
  }
  const zip = await fileToBase64(file)
  h.postMessage(JSON.stringify({ action: 'install-update', zip, name: file.name }))
  return { ok: true, message: 'در حال نصب… اپ بسته و دوباره باز می‌شود.' }
}

/** UTF-8 → base64 (سازگار با متن فارسی و فایل‌های بزرگ) */
function utf8ToBase64(text: string): string {
  const bytes = new TextEncoder().encode(text)
  let bin = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(bin)
}

/** ذخیرهٔ فایل در پوشهٔ مشخص (بکاپ/آپدیت) */
export async function saveFileToFolder(
  filename: string,
  content: string,
  folder: string,
): Promise<{ ok: boolean; path?: string }> {
  const h = host()
  if (!h || !folder) return { ok: false }
  const res = waitForHost<{ ok: boolean; path?: string }>((d) =>
    d.action === 'file-saved' ? { ok: Boolean(d.ok), path: d.path ? String(d.path) : undefined } : undefined,
  )
  h.postMessage(
    JSON.stringify({
      action: 'save-file',
      folder,
      filename,
      base64: utf8ToBase64(content),
    }),
  )
  return (await res) ?? { ok: false }
}
