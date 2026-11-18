import type { RateUnit } from '../db/schema'

/* ============================================================
   فهرست کارهای سرامیک / بنایی برای قلم نرخ
   - لیست پایه (RATE_PRESETS) همان لیست اولیه است.
   - هیچ عنوانی خودکار به لیست اضافه نمی‌شود.
   - کاربر می‌تواند از «تنظیمات → لیست کارها» عنوان‌ها را
     ویرایش، حذف یا اضافه کند.
   ============================================================ */

export interface RatePreset {
  fa: string
  en: string
  unit: RateUnit
}

export const RATE_PRESETS: RatePreset[] = [
  { fa: 'سرامیک کف', en: 'Floor ceramic', unit: 'm2' },
  { fa: 'سرامیک دیوار', en: 'Wall ceramic', unit: 'm2' },
  { fa: 'سرامیک دیوار راه‌پله', en: 'Stairwell wall ceramic', unit: 'm2' },
  { fa: 'سنگ پله', en: 'Stair stone', unit: 'm' },
  { fa: 'سرامیک زیر سقفی', en: 'Under-ceiling ceramic', unit: 'm2' },
  { fa: 'جوشکاری', en: 'Welding', unit: 'm' },
  { fa: 'قرنیز', en: 'Skirting', unit: 'm' },
  { fa: 'نصب سنگ توالت', en: 'Toilet stone installation', unit: 'item' },
  { fa: 'نصب چهارچوب در', en: 'Door frame installation', unit: 'item' },
  { fa: 'نصب درب ضدسرقت', en: 'Anti-theft door installation', unit: 'item' },
  { fa: 'فارسی‌بر', en: 'Persian cut (Farsi-bor)', unit: 'm' },
  { fa: 'برش‌کاری', en: 'Cutting', unit: 'm' },
  { fa: 'بغل پله', en: 'Stair side', unit: 'm' },
  { fa: 'کف پاگرد', en: 'Landing floor', unit: 'm2' },
  { fa: 'باکس', en: 'Box', unit: 'item' },
  { fa: 'ستون کامل', en: 'Full column', unit: 'm' },
  { fa: 'سایر', en: 'Other', unit: 'item' },
]

const STORAGE_KEY = 'sazora-rate-list-v2'
/** کلید قدیمی که عنوان‌ها به‌صورت خودکار در آن ذخیره می‌شدند */
const LEGACY_KEY = 'sazora-rate-presets-v1'

function normalizeUnit(u: unknown): RateUnit {
  const allowed: RateUnit[] = ['m2', 'm', 'item', 'day', 'hour', 'kg', 'lump']
  return allowed.includes(u as RateUnit) ? (u as RateUnit) : 'item'
}

/** لیست فعلی کارها: ذخیره‌شده یا لیست اولیه */
export function loadRateList(): RatePreset[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return RATE_PRESETS.map((p) => ({ ...p }))
    const arr = JSON.parse(raw) as unknown
    if (!Array.isArray(arr)) return RATE_PRESETS.map((p) => ({ ...p }))
    const out: RatePreset[] = []
    for (const item of arr) {
      if (!item || typeof item !== 'object') continue
      const rec = item as Record<string, unknown>
      const fa = typeof rec.fa === 'string' ? rec.fa.trim() : ''
      if (!fa) continue
      out.push({
        fa,
        en: typeof rec.en === 'string' && rec.en.trim() ? rec.en.trim() : fa,
        unit: normalizeUnit(rec.unit),
      })
    }
    return out
  } catch {
    return RATE_PRESETS.map((p) => ({ ...p }))
  }
}

export function saveRateList(list: RatePreset[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
    // کلید قدیمی پاک می‌شود تا عنوان‌های خودکار قبلی برنگردند
    localStorage.removeItem(LEGACY_KEY)
  } catch {
    /* ignore */
  }
}

/** بازگردانی لیست به حالت اولیه */
export function resetRateList(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
    localStorage.removeItem(LEGACY_KEY)
  } catch {
    /* ignore */
  }
}

/** همه عنوان‌ها — همان لیست اولیه/ویرایش‌شده */
export function allRateTitles(): string[] {
  return loadRateList().map((p) => p.fa)
}

/** نمایش عنوان شرح کار بر اساس زبان */
export function rateTitleLabel(title: string, lang: 'fa' | 'en' = 'fa'): string {
  if (lang === 'fa') return title
  const preset = loadRateList().find((p) => p.fa === title)
  return preset ? preset.en : title
}

/** واحد پیشنهادی برای یک شرح کار */
export function ratePresetUnit(title: string): RateUnit | undefined {
  return loadRateList().find((p) => p.fa === title)?.unit
}
