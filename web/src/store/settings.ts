import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Lang } from '../i18n'
import { setLang } from '../i18n'

export type Theme = 'light' | 'dark'
export type DateSystem = 'jalali' | 'gregorian'

/** رنگ‌های تاکیدی قابل انتخاب توسط کاربر — نارنجی، رنگ اصلی SAZORA است */
export const ACCENTS = [
  { id: 'orange', label: 'نارنجی SAZORA', value: '#E07B39', soft: '#FBEFE4' },
  { id: 'yellow', label: 'زرد کهربایی', value: '#F2B33D', soft: '#FDF6E7' },
  { id: 'emerald', label: 'زمردی', value: '#059669', soft: '#ecfdf5' },
  { id: 'indigo', label: 'آبی‌بنفش', value: '#4f46e5', soft: '#eef2ff' },
  { id: 'red', label: 'قرمز', value: '#dc2626', soft: '#fef2f2' },
  { id: 'slate', label: 'خنثی', value: '#374151', soft: '#f3f4f6' },
  { id: 'sky', label: 'آسمانی', value: '#0284c7', soft: '#f0f9ff' },
  { id: 'gold', label: 'طلایی', value: '#C9A96E', soft: '#F5EDE0' },
  { id: 'rose', label: 'رز', value: '#e11d48', soft: '#fff1f2' },
] as const

export type AccentId = (typeof ACCENTS)[number]['id']

/** فونت‌های قابل انتخاب */
export const FONT_FAMILIES = [
  { id: 'vazirmatn', label: 'وزیرمتن (پیش‌فرض)', value: "'Vazirmatn', 'Inter', system-ui, sans-serif" },
  { id: 'segoe', label: 'سگو UI', value: "'Segoe UI', 'Vazirmatn', system-ui, sans-serif" },
  { id: 'inter', label: 'اینتر', value: "'Inter', 'Vazirmatn', system-ui, sans-serif" },
  { id: 'system', label: 'سیستمی', value: "system-ui, -apple-system, sans-serif" },
] as const

export type FontFamilyId = (typeof FONT_FAMILIES)[number]['id']

/** اندازه‌های فونت قابل انتخاب */
export const FONT_SIZES = [
  { id: 'sm', label: 'کوچک', value: 12 },
  { id: 'md', label: 'متوسط (پیش‌فرض)', value: 14 },
  { id: 'lg', label: 'بزرگ', value: 16 },
  { id: 'xl', label: 'خیلی بزرگ', value: 18 },
] as const

export type FontSizeId = (typeof FONT_SIZES)[number]['id']

export type MenuKey = 'today' | 'inbox' | 'projects' | 'workers' | 'finance' | 'goals' | 'learn' | 'club' | 'board'

interface Settings {
  lang: Lang
  theme: Theme
  accent: AccentId
  dateSystem: DateSystem
  userName: string
  menuOrder: MenuKey[]
  hiddenMenus: MenuKey[]
  fontFamily: FontFamilyId
  fontSize: FontSizeId
  autoUpdate: boolean
  /** پوشهٔ مخصوص ذخیرهٔ بکاپ (خالی = پوشهٔ دانلود پیش‌فرض) */
  backupDir: string
  /** پوشهٔ مخصوص ذخیرهٔ فایل‌های آپدیت */
  updateDir: string
  setLang: (l: Lang) => void
  toggleTheme: () => void
  setTheme: (t: Theme) => void
  setAccent: (a: AccentId) => void
  setDateSystem: (d: DateSystem) => void
  setUserName: (n: string) => void
  setMenuOrder: (order: MenuKey[]) => void
  toggleMenu: (key: MenuKey) => void
  setFontFamily: (f: FontFamilyId) => void
  setFontSize: (s: FontSizeId) => void
  setAutoUpdate: (v: boolean) => void
  setBackupDir: (p: string) => void
  setUpdateDir: (p: string) => void
}

export const useSettings = create<Settings>()(
  persist(
    (set, get) => ({
      lang: 'fa',
      theme: 'light',
      accent: 'orange',
      dateSystem: 'jalali',
      userName: '',
      menuOrder: ['today', 'inbox', 'projects', 'workers', 'finance', 'goals', 'learn', 'club', 'board'],
      hiddenMenus: [],
      fontFamily: 'vazirmatn',
      fontSize: 'md',
      autoUpdate: false,
      backupDir: '',
      updateDir: '',

      setLang: (lang) => {
        set({ lang })
        setLang_(lang)
      },
      toggleTheme: () => {
        const next: Theme = get().theme === 'light' ? 'dark' : 'light'
        set({ theme: next })
        applyTheme(next)
      },
      setTheme: (theme) => {
        set({ theme })
        applyTheme(theme)
      },
      setAccent: (accent) => {
        set({ accent })
        applyAccent(accent)
      },
      setDateSystem: (dateSystem) => set({ dateSystem }),
      setUserName: (userName) => set({ userName }),
      setMenuOrder: (menuOrder) => set({ menuOrder }),
      toggleMenu: (key) => {
        const hidden = get().hiddenMenus.includes(key)
        set({ hiddenMenus: hidden ? get().hiddenMenus.filter((k) => k !== key) : [...get().hiddenMenus, key] })
      },
      setFontFamily: (fontFamily) => {
        set({ fontFamily })
        applyFontFamily(fontFamily)
      },
      setFontSize: (fontSize) => {
        set({ fontSize })
        applyFontSize(fontSize)
      },
      setAutoUpdate: (autoUpdate) => set({ autoUpdate }),
      setBackupDir: (backupDir) => set({ backupDir }),
      setUpdateDir: (updateDir) => set({ updateDir }),
    }),
    {
      name: 'sazora-settings',
      version: 2,
      migrate: (persisted, version) => {
        const state = persisted as Partial<Settings>
        // نسخهٔ قدیمی تم طلاییِ پیش‌فرض را داشت؛ یک‌بار به هویت نارنجی SAZORA منتقل شود
        if (version < 2 && (!state.accent || state.accent === 'gold')) state.accent = 'orange'
        return state as Settings
      },
    },
  ),
)

/** نام‌گذاری مجدد برای جلوگیری از تداخل با متد استور */
function setLang_(lang: Lang) {
  setLang(lang)
}

/** اعمال تم روی <html data-theme> */
export function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme
  // رنگ نرمِ تاکید به تم بستگی دارد؛ با تغییر تم دوباره محاسبه می‌شود
  applyAccent(useSettings.getState().accent)
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', theme === 'dark' ? '#0E1014' : accentColor())
}

/** اعمال رنگ تاکیدی روی متغیرهای CSS سراسری */
export function applyAccent(id: AccentId) {
  const a = ACCENTS.find((x) => x.id === id) ?? ACCENTS[0]
  const root = document.documentElement
  root.style.setProperty('--b-accent', a.value)
  root.style.setProperty('--b-accent-soft', softFor(a.value))
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta && document.documentElement.dataset.theme !== 'dark') meta.setAttribute('content', a.value)
}

function softFor(hex: string): string {
  if (document.documentElement.dataset.theme === 'dark') {
    return `color-mix(in srgb, ${hex} 14%, #161A20)`
  }
  return `color-mix(in srgb, ${hex} 9%, white)`
}

function accentColor(): string {
  const a = ACCENTS.find((x) => x.id === useSettings.getState().accent) ?? ACCENTS[0]
  return a.value
}

/** اعمال فونت روی body */
export function applyFontFamily(id: FontFamilyId) {
  const f = FONT_FAMILIES.find((x) => x.id === id) ?? FONT_FAMILIES[0]!
  document.body.style.fontFamily = f.value
  document.documentElement.style.setProperty('--font-sans', f.value)
}

/** اعمال اندازه فونت روی html */
export function applyFontSize(id: FontSizeId) {
  const s = FONT_SIZES.find((x) => x.id === id) ?? FONT_SIZES[1]!
  document.documentElement.style.fontSize = `${s.value}px`
}

/** راه‌اندازی اولیه — از localStorage خونده شده، اعمال روی DOM */
export function initSettings() {
  const s = useSettings.getState()
  applyTheme(s.theme)
  applyAccent(s.accent)
  setLang_(s.lang)
  applyFontFamily(s.fontFamily)
  applyFontSize(s.fontSize)
  document.title = 'SAZORA'
}
