import html2canvas from 'html2canvas'
import type { RateUnit, Currency } from '../db/schema'
import { faDigits, groupDigits } from './format'

/* ============================================================
   واحدهای محاسبه کارهای بنایی
   ============================================================ */

export const UNITS: { id: RateUnit; fa: string; en: string; short: string }[] = [
  { id: 'm2', fa: 'متر مربع', en: 'Square meter', short: 'م²' },
  { id: 'm', fa: 'متر طول', en: 'Linear meter', short: 'متر' },
  { id: 'item', fa: 'عدد / مورد', en: 'Piece', short: 'عدد' },
  { id: 'day', fa: 'روز', en: 'Day', short: 'روز' },
  { id: 'hour', fa: 'ساعت', en: 'Hour', short: 'ساعت' },
  { id: 'kg', fa: 'کیلوگرم', en: 'Kilogram', short: 'کیلو' },
  { id: 'lump', fa: 'مقطوع (یکجا)', en: 'Lump sum', short: 'مقطوع' },
]

export function unitLabel(unit: RateUnit, lang: 'fa' | 'en' = 'fa'): string {
  const u = UNITS.find((x) => x.id === unit)
  if (!u) return unit
  return lang === 'fa' ? u.fa : u.en
}

export function unitShort(unit: RateUnit): string {
  return UNITS.find((x) => x.id === unit)?.short ?? unit
}

/** نمایش مبلغ با واحد پول: تومان جدا، دلار جدا */
export function money(amount: number, currency: Currency): string {
  if (currency === 'dollar') return `$${groupDigits(amount)}`
  return `${groupDigits(amount)} تومان`
}

/** نمایش کوتاه مبلغ برای جدول */
export function moneyShort(amount: number, currency: Currency): string {
  if (currency === 'dollar') return `$${groupDigits(amount)}`
  return groupDigits(amount)
}

/** نمایش مقدار با رقم فارسی */
export function qty(n: number): string {
  const s = Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100)
  return faDigits(s)
}

/** دانلود PNG از یک المان (برای خروجی عکسی صورت‌وضعیت) — وب: دانلود، موبایل: اشتراک‌گذاری */
export async function downloadElementPNG(el: HTMLElement, filename: string): Promise<void> {
  const canvas = await html2canvas(el, { scale: 2, backgroundColor: '#ffffff' })
  const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
  if (!blob) throw new Error('png-failed')
  const { saveBlobFile } = await import('./native')
  await saveBlobFile(filename, blob)
}
