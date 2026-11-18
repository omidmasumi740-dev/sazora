import { db } from '../db/schema'

/* ============================================================
   قیمت روز بازار — خودکار + کش + ثبت دستی
   نمادها: USD (تتر/دلار آزاد به تومان), EUR, GOLD_G (طلای ۱۸ عیار، گرم به تومان), GOLD_Q (ربع — دستی)
   منابع دلار (به ترتیب تلاش، همه CORS باز و بدون کلید):
   1) Wallex — عمق بازار USDTTMN (بهترین خریدار ≈ قیمت بازار)
   2) Nobitex — stats usdt-rls (ریال → تومان)
   3) open.er-api.com — نرخ IRR ریالی (→ تومان)
   4) exchangerate-api.com — نرخ IRR (→ تومان)
   طلا: api.gold-api.com (انس دلاری → گرم ۱۸ عیار تومانی با دلار همان لحظه)
   همه ناموفق باشن → خطا و نمایش کش/دستی
   ============================================================ */

export type PriceSymbol = 'USD' | 'EUR' | 'GOLD_G' | 'BTC' | 'GOLD_Q'

/** نمادهای نمایش‌داده‌شده در کارت قیمت روز (سکه ربع با بیت‌کوین جایگزین شد) */
export const SYMBOLS: { id: PriceSymbol; fa: string; en: string; unitFa: string }[] = [
  { id: 'USD', fa: 'دلار (تتر)', en: 'US Dollar (Tether)', unitFa: 'تومان' },
  { id: 'EUR', fa: 'یورو', en: 'Euro', unitFa: 'تومان' },
  { id: 'GOLD_G', fa: 'طلای ۱۸ عیار (گرم)', en: 'Gold 18k (gram)', unitFa: 'تومان / گرم' },
  { id: 'BTC', fa: 'بیت‌کوین', en: 'Bitcoin', unitFa: 'تومان' },
]

/** فاصله به‌روزرسانی خودکار قیمت‌ها: هر ۱ ساعت */
export const PRICE_REFRESH_MS = 60 * 60 * 1000

/* کلید API اختیاری CoinGecko — در خود برنامه ذخیره نمی‌شود و فقط
   به‌صورت محلی در همین دستگاه (localStorage) نگه‌داری می‌شود. */
const API_KEY_STORE = 'sazora-coingecko-key'

export function getPriceApiKey(): string {
  try {
    return (localStorage.getItem(API_KEY_STORE) ?? '').trim()
  } catch {
    return ''
  }
}

export function setPriceApiKey(key: string): void {
  try {
    if (key.trim()) localStorage.setItem(API_KEY_STORE, key.trim())
    else localStorage.removeItem(API_KEY_STORE)
  } catch {
    /* ignore */
  }
}

export function symbolLabel(s: PriceSymbol, lang: 'fa' | 'en' = 'fa'): string {
  const x = SYMBOLS.find((v) => v.id === s)
  return x ? (lang === 'fa' ? x.fa : x.en) : s
}

async function fetchJSON(url: string, timeoutMs = 9000): Promise<unknown> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(url, { signal: ctrl.signal })
    if (!res.ok) throw new Error(`http-${res.status}`)
    return await res.json()
  } finally {
    clearTimeout(t)
  }
}

/** دلار آزاد به تومان از روی قیمت تتر */
async function fetchUsdToman(): Promise<number | null> {
  // ۱) Wallex — عمق بازار تتر/تومان
  try {
    const j = (await fetchJSON('https://api.wallex.ir/v1/depth?symbol=USDTTMN')) as {
      result?: { bid?: [string | number, string | number][]; ask?: [string | number, string | number][] }
      // شکل جایگزین answers
      success?: boolean
    }
    const bid = j?.result?.bid?.[0]?.[0]
    const ask = j?.result?.ask?.[0]?.[0]
    const px = Number(bid ?? ask)
    if (px > 10000) return Math.round(px)
  } catch {
    /* بعدی */
  }
  // ۲) Nobitex — آمار بازار usdt-rls (ریال)
  try {
    const j = (await fetchJSON('https://apiv2.nobitex.ir/market/stats?srcCurrency=usdt&dstCurrency=rls')) as {
      stats?: Record<string, { latest?: string }>
    }
    const latest = Number(j?.stats?.['usdt-rls']?.latest)
    if (latest > 100000) return Math.round(latest / 10)
  } catch {
    /* بعدی */
  }
  // ۳) و ۴) نرخ برابری رسمی IRR
  for (const url of [
    'https://open.er-api.com/v6/latest/USD',
    'https://api.exchangerate-api.com/v4/latest/USD',
  ]) {
    try {
      const j = (await fetchJSON(url)) as { rates?: Record<string, number> }
      const irr = j?.rates?.IRR
      if (irr && irr > 1000) return Math.round(irr / 10)
    } catch {
      /* منبع بعدی */
    }
  }
  return null
}

/** قیمت بیت‌کوین به تومان — کوین‌گکو (دلاری × دلار آزاد) و در صورت خطا نوبیتکس */
async function fetchBtcToman(usdToman: number | null): Promise<number | null> {
  const key = getPriceApiKey()
  if (usdToman) {
    try {
      const url = key
        ? `https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&x_cg_demo_api_key=${encodeURIComponent(key)}`
        : 'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd'
      const j = (await fetchJSON(url)) as { bitcoin?: { usd?: number } }
      const usd = Number(j?.bitcoin?.usd)
      if (usd > 0) return Math.round(usd * usdToman)
    } catch {
      /* منبع بعدی */
    }
  }
  // نوبیتکس — بازار btc/rls (ریال → تومان)
  try {
    const j = (await fetchJSON('https://apiv2.nobitex.ir/market/stats?srcCurrency=btc&dstCurrency=rls')) as {
      stats?: Record<string, { latest?: string }>
    }
    const latest = Number(j?.stats?.['btc-rls']?.latest)
    if (latest > 100000) return Math.round(latest / 10)
  } catch {
    /* ناموفق */
  }
  return null
}

/** دریافت قیمت‌ها از اینترنت و ذخیره در کش (با درصد تغییر نسبت به کش قبلی) */
export async function refreshPrices(): Promise<{ updated: PriceSymbol[]; at: number; errors: string[] }> {
  const out: { symbol: PriceSymbol; price: number }[] = []
  const prev: Record<string, number> = {}
  try {
    for (const p of await db.prices.toArray()) if (p.id) prev[p.id] = p.price
  } catch {
    /* کش خالی */
  }

  const usdToman = await fetchUsdToman()
  if (usdToman) {
    out.push({ symbol: 'USD', price: usdToman })
    // یورو از تقاطع EUR/USD
    try {
      const j = (await fetchJSON('https://open.er-api.com/v6/latest/USD')) as {
        rates?: Record<string, number>
      }
      const eurRate = j?.rates?.EUR ?? 0
      if (eurRate > 0) {
        const eurToman = Math.round(usdToman / eurRate)
        if (eurToman > 1000) out.push({ symbol: 'EUR', price: eurToman })
      }
    } catch {
      /* یورو دستی می‌مونه */
    }
  }

  // طلا — انس دلاری → گرم ۱۸ عیار تومانی
  if (usdToman) {
    try {
      const g = (await fetchJSON('https://api.gold-api.com/price/XAU')) as {
        price?: number
        name?: string
      }
      const ozUsd = Number(g?.price)
      if (ozUsd > 0) {
        const gram18 = Math.round(((ozUsd * usdToman) / 31.1035) * 0.75)
        out.push({ symbol: 'GOLD_G', price: gram18 })
      }
    } catch {
      // طلا دستی می‌مونه
    }
  }

  // بیت‌کوین
  const btc = await fetchBtcToman(usdToman)
  if (btc) out.push({ symbol: 'BTC', price: btc })

  if (!out.length) throw new Error('all-sources-failed')

  const expected: PriceSymbol[] = ['USD', 'EUR', 'GOLD_G', 'BTC']
  const errors = expected.filter((s) => !out.some((o) => o.symbol === s))

  const at = Date.now()
  await db.prices.bulkPut(
    out.map((o) => {
      const old = prev[o.symbol]
      const changePct = old && old > 0 ? Math.round(((o.price - old) / old) * 1000) / 10 : undefined
      return { id: o.symbol, price: o.price, changePct, updatedAt: at, manual: false }
    }),
  )
  return { updated: out.map((o) => o.symbol), at, errors }
}

/** ثبت دستی قیمت یک نماد */
export async function setManualPrice(symbol: PriceSymbol, price: number): Promise<void> {
  if (!price || price <= 0) return
  const old = await db.prices.get(symbol).catch(() => undefined)
  const changePct =
    old && old.price > 0 ? Math.round(((price - old.price) / old.price) * 1000) / 10 : undefined
  await db.prices.put({ id: symbol, price, changePct, updatedAt: Date.now(), manual: true })
}

/** خواندن کش قیمت‌ها */
export async function readPriceCache(): Promise<Record<string, { price: number; changePct?: number; updatedAt: number; manual?: boolean }>> {
  const all = await db.prices.toArray()
  const m: Record<string, { price: number; changePct?: number; updatedAt: number; manual?: boolean }> = {}
  for (const p of all) {
    if (p.id) m[p.id] = { price: p.price, changePct: p.changePct, updatedAt: p.updatedAt, manual: p.manual }
  }
  return m
}

/** قیمت فعلی یک دارایی بر اساس نوعش */
export function assetCurrentPrice(
  kind: string,
  cache: Record<string, { price: number }>,
  manualFallback?: number,
): number | null {
  if (kind === 'usd') return cache['USD']?.price ?? null
  if (kind === 'eur') return cache['EUR']?.price ?? null
  if (kind === 'gold') return cache['GOLD_G']?.price ?? null
  return manualFallback ?? null
}
