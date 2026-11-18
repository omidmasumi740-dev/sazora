/* ============================================================
   قالب‌بندی عدد و مبلغ — تومان / دلار
   ============================================================ */

/** تبدیل ارقام لاتین به فارسی */
export function faDigits(input: string | number): string {
  return String(input).replace(/[0-9]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)])
}

/** جداکننده هزارگان فارسی: ۴٬۸۵۰٬۰۰۰ */
export function groupDigits(n: number): string {
  const neg = n < 0
  const s = Math.round(Math.abs(n))
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '٬')
  return (neg ? '−' : '') + s
}

/** جداکننده هزارگان لاتین (برای حین تایپ): 4,850,000 */
export function groupDigitsEn(n: number): string {
  const neg = n < 0
  const s = Math.round(Math.abs(n))
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return (neg ? '-' : '') + s
}

/**
 * تبدیل رشته ورودی به عدد خام (حذف جداکننده‌ها و غیرارقام).
 * برای استفاده در onChange ورودی‌ها.
 */
export function parseNumber(raw: string): number {
  const cleaned = String(raw).replace(/[^\d]/g, '')
  if (!cleaned) return 0
  return Number(cleaned)
}

/**
 * تبدیل رشته ورودی به عدد اعشاری (برای مقدار دارایی، متراژ، ساعت…).
 * فقط یک نقطه اعشار نگه می‌دارد.
 */
export function parseDecimal(raw: string): number {
  const cleaned = String(raw).replace(/[^\d.]/g, '')
  if (!cleaned) return 0
  const [intPart, ...rest] = cleaned.split('.')
  const s = intPart + (rest.length ? '.' + rest.join('') : '')
  const n = Number(s)
  return Number.isFinite(n) ? n : 0
}

/** نمایش عدد اعشاری با جداکننده هزارگان — حداکثر ۴ رقم اعشار */
export function groupDecimal(n: number): string {
  if (!Number.isFinite(n)) return '—'
  const neg = n < 0
  const abs = Math.abs(n)
  const fixed = Number.isInteger(abs) ? String(abs) : abs.toFixed(4).replace(/0+$/, '').replace(/\.$/, '')
  const [i, d] = fixed.split('.')
  const grouped = i.replace(/\B(?=(\d{3})+(?!\d))/g, '٬')
  return (neg ? '−' : '') + grouped + (d ? '٫' + d : '')
}

/**
 * فرمت رشته عددی برای نمایش در input — هر ۳ رقم یک کاما.
 * اعشار را حفظ می‌کند (مثلاً 1,500.5).
 */
export function formatNumberInput(raw: string): string {
  const s = String(raw).trim()
  if (!s) return ''
  const neg = s.startsWith('-')
  const unsigned = neg ? s.slice(1) : s
  const [intPart, ...rest] = unsigned.split('.')
  // صفرهای ابتدای عدد حذف می‌شوند تا «007» به «۷» تبدیل شود
  const digits = intPart.replace(/[^\d]/g, '').replace(/^0+(?=\d)/, '')
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  const dec = rest.length ? '.' + rest.join('.').replace(/[^\d]/g, '') : ''
  return (neg ? '-' : '') + (grouped || (dec ? '0' : '')) + dec
}

/** مبلغ کامل با واحد تومان */
export function toman(n: number): string {
  return `${groupDigits(n)} تومان`
}

/** نمایش فشرده: ۴٬۸۵۰ م / ۱٫۲ میلیارد */
export function tomanShort(n: number): string {
  const abs = Math.abs(n)
  const sign = n < 0 ? '−' : ''
  if (abs >= 1_000_000_000) {
    const v = abs / 1_000_000_000
    return `${sign}${trimZero(v.toFixed(1))} میلیارد`
  }
  if (abs >= 1_000_000) {
    const v = abs / 1_000_000
    return `${sign}${trimZero(v.toFixed(1))} میلیون`
  }
  if (abs >= 1_000) {
    return `${sign}${groupDecimal(abs / 1000)} هزار`
  }
  return sign + groupDigits(abs)
}

function trimZero(s: string): string {
  return s.replace(/\.0$/, '')
}

/** درصد با یک رقم اعشار */
export function percent(n: number, digits = 0): string {
  return `${faDigits(n.toFixed(digits))}٪`
}

/** ساعت کارکرد: ۸ یا ۹٫۵ */
export function hours(n: number): string {
  const s = Number.isInteger(n) ? String(n) : n.toFixed(1).replace(/\.0$/, '')
  return faDigits(s)
}

/** مدت زمان از دقیقه: ۲:۱۵ */
export function duration(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return faDigits(`${h}:${String(m).padStart(2, '0')}`)
}

/** متن امضا/پسوند فارسی برای عدد (چند/چند) */
export function count(n: number): string {
  return faDigits(n)
}

/** نرخ بازگشت سرمایه: +۳۲٫۷٪ */
export function roi(cost: number, value: number): string {
  if (cost <= 0) return '—'
  const pct = ((value - cost) / cost) * 100
  const sign = pct >= 0 ? '+' : '−'
  return `${sign}${faDigits(Math.abs(pct).toFixed(1))}٪`
}

export function roiClass(cost: number, value: number): 'pos' | 'neg' {
  return value >= cost ? 'pos' : 'neg'
}

/** ذخیره/دانلود فایل JSON — وب: دانلود، اپ موبایل: اشتراک‌گذاری */
export async function downloadJSON(data: unknown, filename: string): Promise<void> {
  const { saveBlobFile } = await import('./native')
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  await saveBlobFile(filename, blob)
}

/** شناسه یکتای کوتاه */
export function uid(): string {
  return Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4)
}
