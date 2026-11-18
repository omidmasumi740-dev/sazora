import * as jalaali from 'jalaali-js'

/* ============================================================
   ابزار تاریخ شمسی
   قرارداد: تاریخ‌ها به شکل رشته 'YYYY-MM-DD' شمسی ذخیره می‌شن
   ============================================================ */

export const FA_MONTHS = [
  'فروردین',
  'اردیبهشت',
  'خرداد',
  'تیر',
  'مرداد',
  'شهریور',
  'مهر',
  'آبان',
  'آذر',
  'دی',
  'بهمن',
  'اسفند',
]

export const FA_MONTHS_SHORT = [
  'فروردین',
  'اردیبهشت',
  'خرداد',
  'تیر',
  'مرداد',
  'شهریور',
  'مهر',
  'آبان',
  'آذر',
  'دی',
  'بهمن',
  'اسفند',
]

export const FA_WEEKDAYS = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه']
export const FA_WEEKDAYS_SHORT = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج']

/** تبدیل میلادی → شمسی */
export function toJalali(date: Date): string {
  const { jy, jm, jd } = jalaali.toJalaali(date)
  return `${jy}-${String(jm).padStart(2, '0')}-${String(jd).padStart(2, '0')}`
}

/** تبدیل شمسی → میلادی (برای محاسبات و گرفتن تایم‌استمپ) */
export function toGregorian(jalali: string): Date {
  const [jy, jm, jd] = jalali.split('-').map(Number)
  const { gy, gm, gd } = jalaali.toGregorian(jy, jm, jd)
  return new Date(gy, gm - 1, gd)
}

/** امروز به شمسی */
export function todayJalali(): string {
  return toJalali(new Date())
}

/** نمایش '۱۷ مهر ۱۴۰۴' */
export function formatJalali(jalali: string, withYear = true): string {
  const [jy, jm, jd] = jalali.split('-').map(Number)
  const month = FA_MONTHS_SHORT[jm - 1]
  return withYear ? `${jd} ${month} ${jy}` : `${jd} ${month}`
}

/** نمایش کوتاه '۱۴۰۴/۰۷/۱۷' */
export function formatJalaliShort(jalali: string): string {
  const [jy, jm, jd] = jalali.split('-').map(Number)
  return `${jy}/${String(jm).padStart(2, '0')}/${String(jd).padStart(2, '0')}`
}

/** نام روز هفته (شنبه تا جمعه) */
export function weekdayOf(jalali: string): string {
  const d = toGregorian(jalali)
  // شنبه = 6 (getDay: یکشنبه=0 … جمعه=6)
  const idx = (d.getDay() + 1) % 7
  return FA_WEEKDAYS[idx]
}

/** افزودن روز به تاریخ شمسی */
export function addDays(jalali: string, days: number): string {
  const d = toGregorian(jalali)
  d.setDate(d.getDate() + days)
  return toJalali(d)
}

/** افزودن ماه (باقی‌مانده همان روز) */
export function addMonths(jalali: string, months: number): string {
  let [jy, jm] = jalali.split('-').map(Number)
  const jd = Number(jalali.split('-')[2])
  jm += months
  while (jm > 12) {
    jm -= 12
    jy += 1
  }
  while (jm < 1) {
    jm += 12
    jy -= 1
  }
  const maxDay = jalaali.jalaaliMonthLength(jy, jm)
  return `${jy}-${String(jm).padStart(2, '0')}-${String(Math.min(jd, maxDay)).padStart(2, '0')}`
}

/** روز اول ماه */
export function startOfMonth(jalali: string): string {
  const [jy, jm] = jalali.split('-')
  return `${jy}-${jm}-01`
}

/** آخرین روز ماه */
export function endOfMonth(jalali: string): string {
  const [jy, jm] = jalali.split('-').map(Number)
  const len = jalaali.jalaaliMonthLength(jy, jm)
  return `${jy}-${String(jm).padStart(2, '0')}-${String(len).padStart(2, '0')}`
}

/** روز اول هفته (شنبه) که تاریخ داخلشه */
export function startOfWeek(jalali: string): string {
  const d = toGregorian(jalali)
  const day = d.getDay() // 0=یکشنبه … 6=شنبه
  // شنبه خودش اول هفته است؛ بقیه روزها به شنبهٔ قبل برمی‌گردند
  const backToSaturday = day === 6 ? 0 : day + 1
  d.setDate(d.getDate() - backToSaturday)
  return toJalali(d)
}

/** آیا دو تاریخ یکسان‌اند */
export function isSameDay(a: string, b: string): boolean {
  return a === b
}

/** مقایسه رشته‌های شمسی (ISO-like) — مرتب‌سازی الفبایی درست کار می‌کنه */
export function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

/** بازه روزهای یک ماه شمسی (برای تقویم) */
export function monthDays(jalali: string): string[] {
  const start = startOfMonth(jalali)
  const end = endOfMonth(jalali)
  const out: string[] = []
  let cur = start
  while (compare(cur, end) <= 0) {
    out.push(cur)
    cur = addDays(cur, 1)
  }
  return out
}

/** روزهای یک هفته از شنبه */
export function weekDays(jalali: string): string[] {
  const sat = startOfWeek(jalali)
  return Array.from({ length: 7 }, (_, i) => addDays(sat, i))
}

/** ۷ روز اخیر (برای نمودار) */
export function last7Days(end = todayJalali()): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(end, i - 6))
}

/** فقط بخش ساعت از ISO — برای نمایش زمان حال */
export function nowTime(): string {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/** بررسی معتبر بودن تاریخ شمسی */
export function isValidJalali(jalali: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(jalali)
  if (!m) return false
  const [, jy, jm, jd] = m.map(Number)
  return jalaali.isValidJalaaliDate(jy, jm, jd)
}

/** چند روز تا تاریخ هدف (مثبت = آینده) */
export function daysUntil(jalali: string): number {
  const a = toGregorian(todayJalali()).getTime()
  const b = toGregorian(jalali).getTime()
  return Math.round((b - a) / 86400000)
}
