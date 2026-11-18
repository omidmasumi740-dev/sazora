import { Capacitor } from '@capacitor/core'
import { Directory, Filesystem } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'
import { save } from '@tauri-apps/plugin-dialog'
import { writeFile } from '@tauri-apps/plugin-fs'
import { openPath } from '@tauri-apps/plugin-opener'

/* ============================================================
   پل دسکتاپ (Tauri) — روی وب هیچ کاری نمی‌کند
   دانلود فایل در وب = لینک دانلود؛ در اپ دسکتاپ = ذخیره در مسیر انتخابی
   کاربر + باز کردن فایل با برنامه پیش‌فرض. همه قابلیت‌ها حفظ می‌شوند.
   ============================================================ */

/** آیا داخل اپ موبایل (Capacitor) اجرا می‌شویم؟ */
export function isNative(): boolean {
  try {
    return Capacitor.isNativePlatform()
  } catch {
    return false
  }
}

/** آیا داخل اپ دسکتاپ (Tauri) اجرا می‌شویم؟ */
export function isDesktop(): boolean {
  try {
    return typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)
  } catch {
    return false
  }
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => {
      const s = String(r.result ?? '')
      const i = s.indexOf('base64,')
      resolve(i >= 0 ? s.slice(i + 7) : s)
    }
    r.onerror = () => reject(new Error('encode-failed'))
    r.readAsDataURL(blob)
  })
}

/**
 * ذخیره/اشتراک فایل:
 * - وب: دانلود معمولی مرورگر
 * - موبایل (Capacitor): نوشتن در حافظه موقت + پنجره اشتراک‌گذاری
 * - دسکتاپ (Tauri): انتخاب مسیر ذخیره + نوشتن فایل + باز کردنش با برنامه پیش‌فرض
 */
export async function saveBlobFile(filename: string, blob: Blob): Promise<void> {
  if (isNative()) {
    const base64 = await blobToBase64(blob)
    const path = `exports/${Date.now()}-${filename}`
    const res = await Filesystem.writeFile({
      path,
      data: base64,
      directory: Directory.Cache,
      recursive: true,
    })
    await Share.share({ title: filename, url: res.uri })
    return
  }
  if (isDesktop()) {
    // انتخاب مسیر ذخیره توسط کاربر
    const target = await save({
      defaultPath: filename,
      filters: [{ name: 'Files', extensions: [filename.split('.').pop() ?? '*'] }],
    })
    if (!target) return // کاربر لغو کرد
    const base64 = await blobToBase64(blob)
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
    await writeFile(target, bytes)
    try {
      await openPath(target)
    } catch {
      /* باز کردن فایل اختیاری است */
    }
    return
  }
  const url = URL.createObjectURL(blob)
  try {
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 4000)
  }
}

/** میان‌بر متن (CSV/JSON/TXT) */
export async function saveTextFile(filename: string, text: string, mime: string): Promise<void> {
  await saveBlobFile(filename, new Blob([text], { type: mime }))
}
