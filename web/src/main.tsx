import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './i18n'
import './styles/index.css'
import './styles/reader.css'
import App from './App'
import { initSettings } from './store/settings'

/* تنظیمات کاربر از localStorage خونده و اعمال می‌شه */
initSettings()

/* در پنجرهٔ مینیمایز یا مخفی (مثلاً WebView2) مرورگر requestAnimationFrame را اجرا نمی‌کند
   و رندر PDF — از جمله ساخت جلد هنگام «افزودن کتاب» — بی‌نهایت معلق می‌ماند.
   در این حالت با تایمر ۱۶ میلی‌ثانیه‌ای جایگزین می‌شود؛ در حالت عادی رفتار مرورگر دست‌نخورده است. */
if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
  const nativeRaf = window.requestAnimationFrame.bind(window)
  const nativeCancel = window.cancelAnimationFrame.bind(window)
  const timers = new Map<number, ReturnType<typeof setTimeout>>()
  let seq = 0
  window.requestAnimationFrame = (cb: FrameRequestCallback): number => {
    if (document.visibilityState === 'visible') return nativeRaf(cb)
    const id = 1_000_000_000 + ++seq
    timers.set(
      id,
      setTimeout(() => {
        timers.delete(id)
        cb(performance.now())
      }, 16),
    )
    return id
  }
  window.cancelAnimationFrame = (id: number): void => {
    const t = timers.get(id)
    if (t) {
      clearTimeout(t)
      timers.delete(id)
      return
    }
    nativeCancel(id)
  }
}

/* نسخه ۰٫۸ به بعد: هیچ داده نمونه‌ای خودکار ساخته نمی‌شه.
   دیتابیس خام می‌مونه و هر تغییری بلافاصله در IndexedDB ذخیره می‌شه (Dexie).
   داده نمونه فقط با دکمه صریح «بازگردانی داده نمونه» در تنظیمات ساخته می‌شه. */

/* از مرورگر می‌خوایم حافظه اپ رو تحت فشار پاک نکنه (persistent storage) */
try {
  navigator.storage?.persist?.().catch(() => {})
} catch {
  /* ignore */
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
;(window as unknown as { __sazoraBooted?: boolean }).__sazoraBooted = true

/* تنظیمات نیتیو موبایل — روی وب نادیده گرفته می‌شن */
void (async () => {
  try {
    const { isNative } = await import('./lib/native')
    if (!isNative()) return
    const statusBar = await import('@capacitor/status-bar')
    const splash = await import('@capacitor/splash-screen')
    const keyboard = await import('@capacitor/keyboard')
    await statusBar.StatusBar.setBackgroundColor({ color: '#374151' }).catch(() => {})
    await statusBar.StatusBar.setStyle({ style: statusBar.Style.Light }).catch(() => {})
    await splash.SplashScreen.hide().catch(() => {})
    keyboard.Keyboard.addListener('keyboardDidShow', () => document.body.classList.add('keyboard-open'))
    keyboard.Keyboard.addListener('keyboardDidHide', () => document.body.classList.remove('keyboard-open'))
  } catch {
    /* ignore */
  }
})()
