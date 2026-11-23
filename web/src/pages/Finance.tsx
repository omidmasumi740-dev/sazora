import { Fragment, useEffect, useMemo, useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Transaction, type Asset } from '../db/schema'
import { todayJalali, startOfMonth, endOfMonth, addMonths, FA_MONTHS, formatJalali, weekdayOf, isValidJalali } from '../lib/jalali'
import { faDigits, groupDigits, groupDecimal, roi } from '../lib/format'
import {
  SYMBOLS,
  PRICE_REFRESH_MS,
  getPriceApiKey,
  refreshPrices,
  setManualPrice,
  setPriceApiKey,
  type PriceSymbol,
} from '../lib/prices'
import {
  Chip,
  EmptyState,
  Field,
  TextInput,
  Bar,
  NumberInput,
  ExportMenu,
} from '../ui/components'
import { CategoryPicker } from '../ui/categoryPicker'
import { DatePicker } from '../ui/datepicker'
import { groupOfType, useTxCats } from '../lib/categories'

type TxType = 'income' | 'expense' | 'invest' | 'withdraw'

interface TxCats {
  income: string[]
  expense: string[]
}

function loadBudgets(): Record<string, number> {
  try {
    const raw = localStorage.getItem('sazora-budgets')
    if (raw) {
      const p = JSON.parse(raw) as Record<string, unknown>
      const out: Record<string, number> = {}
      for (const [k, v] of Object.entries(p)) {
        const n = Number(v)
        if (k && Number.isFinite(n) && n > 0) out[k] = Math.round(n)
      }
      return out
    }
  } catch {
    /* ignore */
  }
  return {}
}

function useBudgets() {
  const [budgets, setBudgets] = useState<Record<string, number>>(loadBudgets)
  useEffect(() => {
    try {
      localStorage.setItem('sazora-budgets', JSON.stringify(budgets))
    } catch {
      /* ignore */
    }
  }, [budgets])
  function setBudget(cat: string, amount: number) {
    setBudgets((prev) => {
      if (!amount || amount <= 0) {
        const next = { ...prev }
        delete next[cat]
        return next
      }
      return { ...prev, [cat]: Math.round(amount) }
    })
  }
  function removeBudget(cat: string) {
    setBudgets((prev) => {
      const next = { ...prev }
      delete next[cat]
      return next
    })
  }
  function renameBudget(oldName: string, newName: string) {
    const n = newName.trim()
    if (!n || n === oldName) return
    setBudgets((prev) => {
      if (!(oldName in prev)) return prev
      if (n in prev) return prev
      const next: Record<string, number> = {}
      for (const [k, v] of Object.entries(prev)) {
        next[k === oldName ? n : k] = v
      }
      return next
    })
  }
  return { budgets, setBudget, removeBudget, renameBudget }
}

let mirrorRunning = false

export default function FinancePage() {
  const { t } = useTranslation()
  const txCats = useTxCats()
  const budgets = useBudgets()

  // بک‌فیل یک‌باره: آینه تراکنش‌های پروژه برای ورودی‌های قدیمی دفتر پروژه
  useEffect(() => {
    const KEY = 'sazora-mirror-v1'
    if (localStorage.getItem(KEY) || mirrorRunning) return
    mirrorRunning = true
    void (async () => {
      try {
        const entries = await db.financeEntries.toArray()
        if (entries.length === 0) return
        const txs = await db.transactions.toArray()
        const seen = new Set<string>()
        for (const x of txs) {
          const note = x.note ?? ''
          const at = note.indexOf('[projEntry:')
          if (at < 0) continue
          const end = note.indexOf(']', at + 11)
          if (end > 0) seen.add(note.slice(at + 11, end))
        }
        const rows: Array<Omit<Transaction, 'id'>> = []
        for (const e of entries) {
          if (e.id == null || seen.has(String(e.id))) continue
          rows.push({
            type: e.type === 'income' ? 'income' : 'expense',
            category: e.category,
            amount: e.amount,
            date: e.date,
            note: `${e.description || e.category} (پروژه) [projEntry:${e.id}]`,
            createdAt: Date.now(),
          })
        }
        if (rows.length) {
          await db.transaction('rw', db.transactions, async () => {
            await db.transactions.bulkAdd(rows)
          })
        }
        try {
          localStorage.setItem(KEY, '1')
        } catch {
          /* ignore */
        }
      } catch {
        /* ignore */
      } finally {
        mirrorRunning = false
      }
    })()
  }, [])

  return (
    <div className="b-view max-w-6xl mx-auto space-y-4">
      <div>
        <h1 className="text-[21px] font-bold tracking-tight">{t('finance.title')}</h1>
        <p className="text-[13px] text-muted mt-0.5">{t('finance.subtitle')}</p>
      </div>

      <Tickers />
      <CategoryManager cats={txCats.cats} onAdd={txCats.addCat} onRemove={txCats.removeCat} />
      <Portfolio />
      <Ledger />
      <BudgetBox
        expenseCats={txCats.cats.expense}
        budgets={budgets.budgets}
        onSet={budgets.setBudget}
        onRemove={budgets.removeBudget}
        onRename={budgets.renameBudget}
      />
      <SpendingCharts />
    </div>
  )
}

/* ============================================================
   مدیریت دسته‌های تراکنش (قابل ویرایش)
   ============================================================ */
function CategoryManager({
  cats,
  onAdd,
  onRemove,
}: {
  cats: TxCats
  onAdd: (group: 'income' | 'expense', name: string) => void
  onRemove: (group: 'income' | 'expense', name: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [group, setGroup] = useState<'income' | 'expense'>('expense')

  function submit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    onAdd(group, name.trim())
    setName('')
  }

  const renderList = (g: 'income' | 'expense') => (
    <div>
      <div className="text-[12px] font-semibold text-muted mb-1.5">
        {g === 'income' ? 'دسته‌های دریافتی' : 'دسته‌های پرداختی'}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {cats[g].length === 0 && <span className="text-[12px] text-faint">—</span>}
        {cats[g].map((c) => (
          <span key={c} className="chip">
            {c}
            <button
              type="button"
              className="ms-1 text-faint hover:text-[color:var(--b-red)]"
              title="حذف دسته"
              onClick={() => onRemove(g, c)}
            >
              ×
            </button>
          </span>
        ))}
      </div>
    </div>
  )

  return (
    <div className="card overflow-hidden">
      <button
        type="button"
        className="w-full flex items-center justify-between px-4 py-3"
        onClick={() => setOpen((v) => !v)}
      >
        <b className="text-[14px]">🏷️ مدیریت دسته‌ها</b>
        <span className="text-faint text-[13px]">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-line pt-3">
          {renderList('income')}
          {renderList('expense')}
          <form onSubmit={submit} className="flex flex-col sm:flex-row gap-2">
            <div className="flex-1">
              <TextInput
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="نام دسته جدید…"
              />
            </div>
            <select className="field sm:w-40" value={group} onChange={(e) => setGroup(e.target.value as 'income' | 'expense')}>
              <option value="expense">پرداختی</option>
              <option value="income">دریافتی</option>
            </select>
            <button type="submit" className="btn btn-primary">
              + افزودن دسته
            </button>
          </form>
        </div>
      )}
    </div>
  )
}

/* ============================================================
   بودجه‌بندی ماهانه دسته‌های هزینه
   ============================================================ */
function BudgetBox({
  expenseCats,
  budgets,
  onSet,
  onRemove,
  onRename,
}: {
  expenseCats: string[]
  budgets: Record<string, number>
  onSet: (cat: string, amount: number) => void
  onRemove: (cat: string) => void
  onRename: (oldName: string, newName: string) => void
}) {
  const today = todayJalali()
  const mStart = startOfMonth(today)
  const mEnd = endOfMonth(today)
  const [newName, setNewName] = useState('')
  const [newCap, setNewCap] = useState('')
  const [open, setOpen] = useState(false)
  const [editingName, setEditingName] = useState<string | null>(null)
  const [editNameValue, setEditNameValue] = useState('')
  const monthTx = useLiveQuery(
    () => db.transactions.where('date').between(mStart, mEnd, true, true).toArray(),
    [mStart, mEnd],
    [] as Transaction[],
  )

  const spent = useMemo(() => {
    const m = new Map<string, number>()
    monthTx
      .filter((x) => x.type === 'expense')
      .forEach((x) => m.set(x.category, (m.get(x.category) ?? 0) + x.amount))
    return m
  }, [monthTx])

  const allCats = useMemo(() => {
    const s = new Set<string>([...expenseCats, ...Object.keys(budgets)])
    return [...s]
  }, [expenseCats, budgets])

  function submitNew(e: FormEvent) {
    e.preventDefault()
    const n = newName.trim()
    const cap = Number(newCap)
    if (!n || !cap || cap <= 0) return
    onSet(n, Math.round(cap))
    setNewName('')
    setNewCap('')
  }

  function rename(cat: string) {
    setEditingName(cat)
    setEditNameValue(cat)
  }

  function confirmRename(cat: string) {
    const n = editNameValue.trim()
    if (n && n !== cat) {
      onRename(cat, n)
      // دسته تراکنش‌های همان اسم هم به‌روز شود تا آمار درست بماند
      void (async () => {
        try {
          const txs = await db.transactions.where('category').equals(cat).toArray()
          await Promise.all(txs.map((x) => x.id && db.transactions.update(x.id, { category: n })))
        } catch {
          /* ignore */
        }
      })()
    }
    setEditingName(null)
    setEditNameValue('')
  }

  const totalCap = Object.values(budgets).reduce((s, v) => s + v, 0)
  const totalSpent = Object.keys(budgets).reduce((s, c) => s + (spent.get(c) ?? 0), 0)
  const overallPct = totalCap > 0 ? Math.min(100, (totalSpent / totalCap) * 100) : 0

  return (
    <>
      {/* خلاصهٔ مینیمال — همیشه در صفحه */}
      <div className="card p-3.5">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <b className="text-[13.5px]">💰 بودجه ماه</b>
            <div className="text-[11.5px] text-faint mt-0.5">
              {totalCap > 0 ? (
                <>
                  <span className="tabular-nums" dir="ltr">{groupDigits(totalSpent)}</span> از{' '}
                  <span className="tabular-nums" dir="ltr">{groupDigits(totalCap)}</span> تومان
                </>
              ) : (
                'برای دسته‌ها سقف ماهانه تعیین کنید.'
              )}
            </div>
          </div>
          <button className="btn !py-1.5 !px-3 text-[12px] whitespace-nowrap" onClick={() => setOpen(true)}>
            مدیریت بودجه
          </button>
        </div>
        {totalCap > 0 && (
          <div className="mt-2.5">
            <Bar value={overallPct} />
            <div className="flex justify-between text-[11px] text-faint mt-1">
              <span>{faDigits(Math.round(overallPct))}٪ مصرف</span>
              <span className={totalSpent > totalCap ? 'text-[color:var(--b-red)] font-semibold' : ''}>
                {totalSpent > totalCap ? '⚠️ از سقف رد شد' : 'در محدودهٔ بودجه'}
              </span>
            </div>
          </div>
        )}
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="relative bg-surface border border-line rounded-2xl shadow-float w-full max-w-2xl max-h-[85vh] overflow-auto m-4 p-4 sm:p-5">
            <div className="flex items-center justify-between mb-3">
              <b className="text-[15px]">💰 بودجه‌بندی ماه</b>
              <button className="text-faint hover:text-[color:var(--b-red)] text-[15px]" onClick={() => setOpen(false)}>✕</button>
            </div>
            <div className="text-[11.5px] text-faint mb-3">سقف ماهانه هر دسته هزینه را وارد کنید تا مصرف واقعی را ببینید.</div>
            <form onSubmit={submitNew} className="flex flex-col sm:flex-row gap-2 mb-3">
              <div className="flex-1">
                <TextInput value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="نام دسته جدید…" />
              </div>
              <div className="sm:w-44">
                <NumberInput value={newCap} onChange={(n) => setNewCap(n === 0 ? '' : String(n))} placeholder="سقف (تومان)" />
              </div>
              <button type="submit" className="btn btn-primary">+ افزودن</button>
            </form>
            {allCats.length === 0 && <div className="text-[12px] text-faint">هنوز بودجه‌ای ثبت نشده.</div>}
            <div className="grid sm:grid-cols-2 gap-3">
              {allCats.map((c) => {
                const use = spent.get(c) ?? 0
                const cap = budgets[c] ?? 0
                const pct = cap > 0 ? Math.min(100, (use / cap) * 100) : 0
                const over = cap > 0 && use > cap
                return (
                  <div key={c} className="rounded-lg border border-line p-3">
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      {editingName === c ? (
                        <input
                          className="field !py-1 !text-[12px] flex-1"
                          value={editNameValue}
                          onChange={(e) => setEditNameValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') confirmRename(c)
                            if (e.key === 'Escape') setEditingName(null)
                          }}
                          onBlur={() => confirmRename(c)}
                          autoFocus
                        />
                      ) : (
                        <span className="text-[12.5px] font-semibold">{c}</span>
                      )}
                      <div className="flex items-center gap-1.5">
                        {over && <Chip tone="danger">⚠️ رد شد</Chip>}
                        {editingName !== c && (
                          <button
                            type="button"
                            className="text-faint hover:text-accent text-[12px]"
                            title="تغییر نام دسته"
                            onClick={() => rename(c)}
                          >
                            ✏️
                          </button>
                        )}
                        {cap > 0 && (
                          <button
                            type="button"
                            className="text-faint hover:text-[color:var(--b-red)] text-[13px]"
                            title="حذف بودجه"
                            onClick={() => onRemove(c)}
                          >
                            ×
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-[11px] text-muted whitespace-nowrap">سقف:</span>
                      <NumberInput
                        className="!py-1 !text-[12px]"
                        placeholder="مثلاً ۵٬۰۰۰٬۰۰۰"
                        value={cap > 0 ? cap : ''}
                        onChange={(n) => onSet(c, n)}
                      />
                    </div>
                    <div className="flex justify-between text-[11.5px] mb-1">
                      <span className="text-muted">مصرف این ماه</span>
                      <span className="tabular-nums" dir="ltr">{groupDigits(use)}</span>
                    </div>
                    {cap > 0 && <Bar value={pct} />}
                    {cap > 0 && (
                      <div className="text-[11px] text-faint mt-1 tabular-nums" dir="ltr">
                        {faDigits(Math.round(pct))}٪
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

/* ============================================================
   آمار و نمودار هزینه‌ها — ۶ ماه اخیر + تفکیک سال و ماه جاری
   ============================================================ */
function SpendingCharts() {
  const { t, i18n } = useTranslation()
  const lang = (i18n.language === 'en' ? 'en' : 'fa') as 'fa' | 'en'
  const today = todayJalali()
  /** پاپ‌آپ ریزتراکنش‌های یک دسته یا یک ماه */
  const [drill, setDrill] = useState<{
    title: string
    category?: string
    from: string
    to: string
  } | null>(null)

  const months = useMemo(() => {
    const arr: { start: string; end: string; label: string }[] = []
    for (let i = 5; i >= 0; i--) {
      const ref = addMonths(today, -i)
      const s = startOfMonth(ref)
      const e = endOfMonth(ref)
      const mNum = Number(s.slice(5, 7))
      arr.push({ start: s, end: e, label: FA_MONTHS[mNum - 1] ?? s })
    }
    return arr
  }, [today])

  const year = today.slice(0, 4)
  const yStart = `${year}-01-01`
  const yEnd = `${year}-12-31`
  const mStart = startOfMonth(today)
  const mEnd = endOfMonth(today)
  const rangeFrom = months[0].start < yStart ? months[0].start : yStart
  const rangeTo = months[months.length - 1].end > yEnd ? months[months.length - 1].end : yEnd

  // فقط بازهٔ لازم (۶ ماه اخیر + سال جاری) خوانده می‌شود، نه کل تاریخچه
  const allTx = useLiveQuery(
    () => db.transactions.where('date').between(rangeFrom, rangeTo, true, true).toArray(),
    [rangeFrom, rangeTo],
    [] as Transaction[],
  )

  const monthTotals = useMemo(
    () =>
      months.map((m) => {
        const inRange = (x: Transaction) => x.date >= m.start && x.date <= m.end
        const sumOf = (type: Transaction['type']) =>
          allTx.filter((x) => x.type === type && inRange(x)).reduce((s, x) => s + x.amount, 0)
        return {
          ...m,
          expense: sumOf('expense'),
          income: sumOf('income'),
          invest: sumOf('invest'),
        }
      }),
    [allTx, months],
  )
  const maxM = Math.max(
    1,
    ...monthTotals.flatMap((m) => [m.expense, m.income, m.invest]),
  )

  const series = [
    { key: 'expense' as const, label: t('finance.seriesExpense'), color: 'var(--b-red)' },
    { key: 'income' as const, label: t('finance.seriesIncome'), color: 'var(--b-green)' },
    { key: 'invest' as const, label: t('finance.seriesInvest'), color: 'var(--b-accent)' },
  ]

  const isOut = (t: Transaction['type']) => t === 'expense' || t === 'invest'

  const yearRows = useMemo(() => {
    const m = new Map<string, number>()
    allTx
      .filter((x) => isOut(x.type) && x.date >= yStart && x.date <= yEnd)
      .forEach((x) => m.set(x.category, (m.get(x.category) ?? 0) + x.amount))
    return [...m.entries()].sort((a, b) => b[1] - a[1])
  }, [allTx, yStart, yEnd])
  const yearTotal = yearRows.reduce((s, [, v]) => s + v, 0)

  const curRows = useMemo(() => {
    const m = new Map<string, number>()
    allTx
      .filter((x) => isOut(x.type) && x.date >= mStart && x.date <= mEnd)
      .forEach((x) => m.set(x.category, (m.get(x.category) ?? 0) + x.amount))
    return [...m.entries()].sort((a, b) => b[1] - a[1])
  }, [allTx, mStart, mEnd])
  const curTotal = curRows.reduce((s, [, v]) => s + v, 0)

  const renderRows = (rows: [string, number][], total: number, from: string, to: string) => {
    if (rows.length === 0) return <div className="text-[12px] text-faint">—</div>
    return rows.map(([c, v]) => {
      const pct = total > 0 ? (v / total) * 100 : 0
      return (
        <div
          key={c}
          className="mb-2.5 cursor-pointer rounded-lg px-2 py-1.5 -mx-2 hover:bg-surface-2 transition-colors"
          title={t('finance.showTxList')}
          onClick={() => setDrill({ title: c, category: c, from, to })}
        >
          <div className="flex justify-between text-[12px] mb-1 gap-2">
            <span className="truncate">{c}</span>
            <span className="tabular-nums text-muted whitespace-nowrap" dir="ltr">
              {groupDigits(v)} · {faDigits(Math.round(pct))}٪
            </span>
          </div>
          <Bar value={pct} />
        </div>
      )
    })
  }

  return (
    <div className="card p-4">
      <b className="text-[13.5px] block mb-1">📊 {t('finance.chartsTitle')}</b>
      <div className="text-[11.5px] text-faint mb-3">{t('finance.chartsHint')}</div>

      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <b className="text-[12.5px]">{t('finance.last6')}</b>
        <div className="flex flex-wrap items-center gap-3 text-[11px]">
          {series.map((s) => (
            <span key={s.key} className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm" style={{ background: s.color }} />
              {s.label}
            </span>
          ))}
        </div>
      </div>

      <div className="flex items-end gap-2.5 h-44 mb-4" dir="ltr">
        {monthTotals.map((m) => (
          <div
            key={m.start}
            className="flex-1 flex flex-col items-center justify-end gap-1 h-full min-w-0 cursor-pointer rounded-lg hover:bg-surface-2 transition-colors"
            title={`${m.label} · ${t('finance.showTxList')}`}
            onClick={() => setDrill({ title: m.label, from: m.start, to: m.end })}
          >
            <div className="flex items-end justify-center gap-1 flex-1 w-full">
              {series.map((s) => {
                const v = m[s.key]
                const h = v > 0 ? Math.max(5, (v / maxM) * 100) : 2
                return (
                  <div
                    key={s.key}
                    className="w-2.5 sm:w-3 rounded-t border border-b-0 border-line"
                    style={{
                      height: `${h}%`,
                      background: s.color,
                      opacity: v > 0 ? 0.88 : 0.14,
                    }}
                    title={`${m.label} · ${s.label}: ${groupDigits(v)}`}
                  />
                )
              })}
            </div>
            <span className="text-[10px] text-muted leading-tight" dir={lang === 'fa' ? 'rtl' : 'ltr'}>{m.label}</span>
          </div>
        ))}
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <b className="text-[12.5px] block mb-2">
            {t('finance.breakdownYear', { year: faDigits(year) })}{' '}
            <span className="text-faint font-normal">· {t('common.total')} {groupDigits(yearTotal)}</span>
          </b>
          {renderRows(yearRows, yearTotal, yStart, yEnd)}
        </div>
        <div>
          <b className="text-[12.5px] block mb-2">
            {t('finance.breakdownMonth')}{' '}
            <span className="text-faint font-normal">· {t('common.total')} {groupDigits(curTotal)}</span>
          </b>
          {renderRows(curRows, curTotal, mStart, mEnd)}
        </div>
      </div>

      {/* پاپ‌آپ ریزتراکنش‌های یک دسته/ماه — قابل اسکرول */}
      {drill &&
        createPortal(
          <div className="fixed inset-0 z-[92] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/45" onClick={() => setDrill(null)} />
            <div className="relative card w-full max-w-lg max-h-[82vh] flex flex-col p-4 shadow-float b-pop">
              <div className="flex items-center justify-between gap-2 mb-1">
                <b className="text-[14.5px] truncate">
                  {drill.category ? '🏷️' : '📅'} {drill.title}
                </b>
                <button
                  type="button"
                  className="text-faint hover:text-[color:var(--b-red)] text-[16px] leading-none"
                  onClick={() => setDrill(null)}
                  aria-label={t('common.close')}
                >
                  ✕
                </button>
              </div>
              <div className="text-[11px] text-faint mb-3 tabular-nums" dir="ltr">
                {drill.from} → {drill.to}
              </div>

              {(() => {
                const list = allTx
                  .filter((x) => x.date >= drill.from && x.date <= drill.to)
                  .filter((x) => (drill.category ? x.category === drill.category : true))
                  .slice()
                  .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
                const total = list.reduce((s, x) => s + x.amount, 0)
                if (list.length === 0)
                  return <div className="text-[12.5px] text-faint py-6 text-center">{t('finance.noTx')}</div>
                return (
                  <>
                    <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain space-y-1 pr-1">
                      {list.map((x) => {
                        const meta = TX_META[x.type] ?? TX_META.expense
                        return (
                          <div
                            key={x.id}
                            className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg border border-line bg-surface-2"
                          >
                            <span className="text-[15px]">{meta.icon}</span>
                            <div className="flex-1 min-w-0">
                              <div className="text-[12.5px] font-medium truncate">{x.note || x.category}</div>
                              <div className="text-[10.5px] text-faint tabular-nums" dir="ltr">
                                {x.date} · {x.category}
                              </div>
                            </div>
                            <b className="tabular-nums text-[12.5px] whitespace-nowrap" dir="ltr" style={{ color: meta.color }}>
                              {meta.sign}{groupDigits(x.amount)}
                            </b>
                          </div>
                        )
                      })}
                    </div>
                    <div className="mt-3 pt-2.5 border-t border-line flex items-center justify-between text-[12.5px]">
                      <span className="text-muted">
                        {faDigits(list.length)} {t('finance.items')}
                      </span>
                      <b className="tabular-nums" dir="ltr">
                        {groupDigits(total)} {t('common.unitToman')}
                      </b>
                    </div>
                  </>
                )
              })()}
            </div>
          </div>,
          document.body,
        )}
    </div>
  )
}

/* ============================================================
   قیمت‌های روز — دلار، یورو، طلا (خودکار + دستی)
   ============================================================ */
function Tickers() {
  const { t } = useTranslation()
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [msgTone, setMsgTone] = useState<'ok' | 'err'>('ok')
  const [editing, setEditing] = useState<PriceSymbol | null>(null)
  const [manualVal, setManualVal] = useState('')
  const [keyOpen, setKeyOpen] = useState(false)
  const [apiKey, setApiKey] = useState(() => getPriceApiKey())
  const prices = useLiveQuery(() => db.prices.toArray(), [], [])

  const cache: Record<string, { price: number; changePct?: number; updatedAt: number; manual?: boolean }> = {}
  for (const p of prices) if (p.id) cache[p.id] = { price: p.price, changePct: p.changePct, updatedAt: p.updatedAt, manual: p.manual }

  async function refresh() {
    setBusy(true)
    setMsg('')
    try {
      const res = await refreshPrices()
      if (res.errors.length > 0) {
        setMsgTone('err')
        setMsg(`${t('finance.refreshPartial')} (${res.errors.join('، ')})`)
      } else {
        setMsgTone('ok')
        setMsg(t('finance.refreshOk'))
      }
    } catch {
      setMsgTone('err')
      setMsg(t('finance.refreshFail'))
    } finally {
      setBusy(false)
      setTimeout(() => setMsg(''), 6000)
    }
  }

  // خودکار موقع ورود + هر ۱ ساعت (فقط وقتی اینترنت وصل است) + وقتی اینترنت وصل می‌شود
  useEffect(() => {
    const online = () => typeof navigator === 'undefined' || navigator.onLine
    const auto = async () => {
      if (!online()) return
      try {
        await refresh()
      } catch {
        /* پیام خطا در refresh تنظیم می‌شود */
      }
    }
    if (online()) void auto()
    const timer = setInterval(() => {
      if (online()) void auto()
    }, PRICE_REFRESH_MS)
    const onOnline = () => void auto()
    window.addEventListener('online', onOnline)
    return () => {
      clearInterval(timer)
      window.removeEventListener('online', onOnline)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function saveKey() {
    setPriceApiKey(apiKey)
    setKeyOpen(false)
    setMsgTone('ok')
    setMsg('کلید API ذخیره شد')
    setTimeout(() => setMsg(''), 4000)
  }

  async function saveManual(sym: PriceSymbol) {
    const v = Number(manualVal)
    if (!v || v <= 0) return
    await setManualPrice(sym, v)
    setEditing(null)
    setManualVal('')
  }

  const ago = (ts?: number) => {
    if (!ts) return '—'
    const m = Math.round((Date.now() - ts) / 60000)
    if (m < 1) return 'لحظاتی پیش'
    if (m < 60) return `${faDigits(m)} دقیقه پیش`
    const h = Math.round(m / 60)
    if (h < 24) return `${faDigits(h)} ساعت پیش`
    return `${faDigits(Math.round(h / 24))} روز پیش`
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-2.5">
        <b className="text-[14px]">💱 قیمت روز</b>
        <button className="btn !py-1 !px-3 text-[12px]" onClick={refresh} disabled={busy}>
          {busy ? t('finance.refreshing') : `↻ ${t('finance.refresh')}`}
        </button>
        <button className="btn !py-1 !px-2.5 text-[11.5px]" onClick={() => setKeyOpen((v) => !v)} title="کلید API اختیاری">
          🔑 کلید API
        </button>
        <span className="text-[11px] text-faint">به‌روزرسانی خودکار هر ۱ ساعت</span>
        {msg && (
          <span className="text-[11.5px]" style={{ color: msgTone === 'err' ? 'var(--b-red)' : 'var(--b-muted)' }}>
            {msg}
          </span>
        )}
      </div>
      {keyOpen && (
        <div className="card p-3 mb-2.5 b-pop">
          <div className="text-[11.5px] text-muted mb-1.5">
            کلید CoinGecko (اختیاری) — فقط روی همین دستگاه ذخیره می‌شود و داخل برنامه قرار نمی‌گیرد.
            بدون کلید هم قیمت‌ها از منابع عمومی خوانده می‌شوند.
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <TextInput value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="CG-..." dir="ltr" className="!py-1 flex-1 min-w-[200px]" />
            <button className="btn btn-primary !py-1 !px-3 text-[12px]" onClick={saveKey}>ذخیره</button>
            <button className="btn !py-1 !px-2 text-[12px]" onClick={() => { setApiKey(''); setPriceApiKey(''); setKeyOpen(false) }}>حذف</button>
          </div>
        </div>
      )}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {SYMBOLS.map((s) => {
          const c = cache[s.id]
          const up = (c?.changePct ?? 0) >= 0
          return (
            <div key={s.id} className="card p-3.5">
              <div className="flex items-center justify-between gap-1">
                <span className="text-[12px] text-muted">{s.fa}</span>
                <span
                  className={`text-[10px] px-1.5 rounded-full ${
                    !c ? 'bg-surface-2 text-faint' : c.manual ? 'chip-warn chip' : ''
                  }`}
                  style={c && !c.manual ? { background: 'var(--b-accent-soft)', color: 'var(--b-accent)' } : undefined}
                >
                  {!c ? '—' : c.manual ? t('finance.manual') : `● ${t('finance.live')}`}
                </span>
              </div>
              {editing === s.id ? (
                <div className="flex gap-1.5 mt-2">
                  <NumberInput
                    autoFocus
                    className="!py-1 !text-[13px]"
                    value={manualVal}
                    onChange={(n) => setManualVal(n === 0 ? '' : String(n))}
                    placeholder={String(c?.price ?? '')}
                  />
                  <button className="btn btn-primary !py-1 !px-2.5 text-[12px]" onClick={() => saveManual(s.id)}>
                    ✓
                  </button>
                  <button className="btn !py-1 !px-2 text-[12px]" onClick={() => setEditing(null)}>
                    ✕
                  </button>
                </div>
              ) : (
                <div
                  className="text-[20px] font-bold mt-1 tabular-nums cursor-pointer leading-tight"
                  dir="ltr"
                  title={t('finance.setManual')}
                  onClick={() => { setEditing(s.id); setManualVal(c ? String(c.price) : '') }}
                >
                  {c ? groupDigits(c.price) : '—'}
                </div>
              )}
              <div className="flex items-center justify-between mt-1">
                <span className="text-[10.5px] text-faint">{s.unitFa}</span>
                {c?.changePct !== undefined && (
                  <span className="text-[11.5px] tabular-nums" dir="ltr" style={{ color: up ? 'var(--b-green)' : 'var(--b-red)' }}>
                    {up ? '▲' : '▼'} {faDigits(Math.abs(c.changePct).toFixed(1))}٪
                  </span>
                )}
              </div>
              <div className="text-[10px] text-faint mt-1">{t('finance.updatedAt')}: {ago(c?.updatedAt)}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ============================================================
   سبد سرمایه‌گذاری با ROI + فروش/برداشت
   ============================================================ */
const ASSET_KINDS = ['gold', 'usd', 'eur', 'stock', 'other'] as const
type AssetKind = (typeof ASSET_KINDS)[number]

function currentOf(kind: string, cache: Record<string, { price: number }>, manual?: number): number | null {
  if (kind === 'usd') return cache['USD']?.price ?? null
  if (kind === 'eur') return cache['EUR']?.price ?? null
  if (kind === 'gold') return cache['GOLD_G']?.price ?? null
  return manual ?? null
}

function Portfolio() {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [kind, setKind] = useState<AssetKind>('gold')
  const [title, setTitle] = useState('')
  const [qty, setQty] = useState('')
  const [buyPrice, setBuyPrice] = useState('')
  const [buyDate, setBuyDate] = useState(todayJalali())
  const [current, setCurrent] = useState('')
  const [note, setNote] = useState('')

  const [sellId, setSellId] = useState<number | null>(null)
  const [sellQty, setSellQty] = useState('')
  const [sellPrice, setSellPrice] = useState('')

  const assets = useLiveQuery(() => db.assets.orderBy('createdAt').toArray(), [], [] as Asset[])
  const prices = useLiveQuery(() => db.prices.toArray(), [], [])
  const cache: Record<string, { price: number }> = {}
  for (const p of prices) if (p.id) cache[p.id] = { price: p.price }

  const [expanded, setExpanded] = useState<string | null>(null)

  // تجمیع دارایی‌های هم‌نام: مقدارها جمع، قیمت خرید میانگین وزنی
  const groups = useMemo(() => {
    const m = new Map<
      string,
      { key: string; kind: Asset['kind']; title: string; qty: number; cost: number; manual?: number; lots: Asset[] }
    >()
    for (const a of assets) {
      const key = `${a.kind}|${a.title.trim().toLowerCase()}`
      const g = m.get(key) ?? { key, kind: a.kind, title: a.title.trim(), qty: 0, cost: 0, lots: [] }
      g.qty += a.qty
      g.cost += a.qty * a.buyPrice
      g.lots.push(a)
      if (a.currentPrice) g.manual = a.currentPrice
      m.set(key, g)
    }
    return [...m.values()].map((g) => {
      const avgBuy = g.qty > 0 ? g.cost / g.qty : 0
      const cur = currentOf(g.kind, cache, g.manual) ?? avgBuy
      const value = g.qty * cur
      return { ...g, avgBuy, cur, value, profit: value - g.cost }
    })
  }, [assets, prices])

  const totalValue = groups.reduce((s, r) => s + r.value, 0)
  const totalCost = groups.reduce((s, r) => s + r.cost, 0)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!title.trim() || !Number(qty) || !Number(buyPrice)) return
    await db.assets.add({
      kind,
      title: title.trim(),
      qty: Number(qty),
      buyPrice: Math.round(Number(buyPrice)),
      buyDate: buyDate || todayJalali(),
      currentPrice: current ? Math.round(Number(current)) : undefined,
      note: note.trim() || undefined,
      createdAt: Date.now(),
    })
    setTitle(''); setQty(''); setBuyPrice(''); setCurrent(''); setNote('')
    setOpen(false)
  }

  async function remove(asset?: Asset) {
    if (!asset?.id) return
    const linked = !!asset.txId
    const msg = linked
      ? 'این دارایی حذف بشه؟ تراکنش سرمایه‌گذاری متناظرش هم از مالی پاک می‌شه.'
      : t('projects.deleteConfirm')
    if (!window.confirm(msg)) return
    await db.transaction('rw', [db.assets, db.transactions], async () => {
      await db.assets.delete(asset.id!)
      if (asset.txId) await db.transactions.delete(asset.txId)
    })
  }

  function openSell(a: Asset, cur: number) {
    setSellId(a.id ?? null)
    setSellQty(String(a.qty))
    setSellPrice(String(cur))
  }

  async function submitSell(e: FormEvent, a: Asset) {
    e.preventDefault()
    if (!a.id) return
    const sold = Number(sellQty)
    const price = Number(sellPrice)
    if (!sold || sold <= 0 || !price || price <= 0) return
    const total = Math.round(sold * price)
    if (sold >= a.qty) {
      await db.assets.delete(a.id)
    } else {
      await db.assets.update(a.id, { qty: a.qty - sold })
    }
    await db.transactions.add({
      type: 'withdraw',
      category: a.title,
      amount: total,
      date: todayJalali(),
      note: `فروش ${sold} ${a.title} @ ${price}`,
      createdAt: Date.now(),
    })
    setSellId(null)
    setSellQty('')
    setSellPrice('')
  }

  const kindName = (k: string) =>
    k === 'gold' ? t('finance.kindGold') : k === 'usd' ? t('finance.kindUsd') : k === 'eur' ? t('finance.kindEur') : k === 'stock' ? t('finance.kindStock') : t('finance.kindOther')

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-line">
        <b className="text-[14px]">📈 {t('finance.portfolio')}</b>
        <div className="flex items-center gap-3">
          <span className="text-[12px] text-muted">
            {t('finance.totalValue')}: <b className="tabular-nums" dir="ltr">{groupDigits(totalValue)}</b>
          </span>
          <span
            className="text-[12.5px] font-bold tabular-nums"
            dir="ltr"
            style={{ color: totalValue - totalCost >= 0 ? 'var(--b-green)' : 'var(--b-red)' }}
          >
            {roi(totalCost, totalValue)} · {groupDigits(totalValue - totalCost)}
          </span>
          {!open && (
            <button className="btn btn-primary !py-1.5 text-[12.5px]" onClick={() => setOpen(true)}>
              + {t('finance.addAsset')}
            </button>
          )}
        </div>
      </div>

      {open && (
        <form onSubmit={submit} className="p-4 border-b border-line bg-surface-2 b-pop">
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <Field label={t('finance.assetTitle')}>
              <TextInput value={title} onChange={(e) => setTitle(e.target.value)} placeholder="طلای ۱۸ عیار" required autoFocus />
            </Field>
            <Field label={t('finance.assetKind')}>
              <select className="field" value={kind} onChange={(e) => setKind(e.target.value as AssetKind)}>
                {ASSET_KINDS.map((k) => (
                  <option key={k} value={k}>{kindName(k)}</option>
                ))}
              </select>
            </Field>
            <Field label={t('finance.assetQty')}>
              <NumberInput decimal value={qty} onChange={(n) => setQty(n === 0 ? '' : String(n))} placeholder="20" required />
            </Field>
            <Field label={t('finance.assetBuyPrice')}>
              <NumberInput value={buyPrice} onChange={(n) => setBuyPrice(n === 0 ? '' : String(n))} placeholder="7850000" required />
            </Field>
            <Field label={t('finance.assetBuyDate')}>
              <TextInput value={buyDate} onChange={(e) => setBuyDate(e.target.value)} dir="ltr" />
            </Field>
            {(kind === 'stock' || kind === 'other') && (
              <Field label={t('finance.assetCurrent')}>
                <NumberInput value={current} onChange={(n) => setCurrent(n === 0 ? '' : String(n))} />
              </Field>
            )}
          </div>
          <div className="flex justify-end gap-2 mt-3">
            <button type="button" className="btn" onClick={() => setOpen(false)}>{t('common.cancel')}</button>
            <button type="submit" className="btn btn-primary">{t('common.save')}</button>
          </div>
        </form>
      )}

      {assets.length === 0 ? (
        <EmptyState icon="📈" title={t('finance.noAssets')} />
      ) : (
        <table className="w-full text-[12.5px]">
          <thead>
            <tr className="bg-surface-2 border-b border-line text-[11px] text-faint">
              <th className="text-start font-semibold px-3 py-2.5">دارایی</th>
              <th className="text-center font-semibold px-2 py-2.5">مقدار</th>
              <th className="text-center font-semibold px-2 py-2.5">خرید</th>
              <th className="text-center font-semibold px-2 py-2.5">روز</th>
              <th className="text-center font-semibold px-2 py-2.5">ارزش فعلی</th>
              <th className="text-center font-semibold px-2 py-2.5">ROI</th>
              <th className="w-24"></th>
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => (
              <Fragment key={g.key}>
                <tr className="border-b border-line hover:bg-surface-2">
                  <td className="px-3 py-2.5">
                    <div className="font-medium">{g.title}</div>
                    <div className="text-[11px] text-faint">
                      {kindName(g.kind)} · {faDigits(g.lots.length)} خرید · میانگین خرید:{' '}
                      <b className="tabular-nums" dir="ltr">{groupDigits(g.avgBuy)}</b>
                    </div>
                  </td>
                  <td className="px-2 py-2.5 text-center tabular-nums font-semibold" dir="ltr">{groupDecimal(g.qty)}</td>
                  <td className="px-2 py-2.5 text-center tabular-nums text-muted" dir="ltr">{groupDigits(g.avgBuy)}</td>
                  <td className="px-2 py-2.5 text-center tabular-nums" dir="ltr">{groupDigits(g.cur)}</td>
                  <td className="px-2 py-2.5 text-center tabular-nums font-semibold" dir="ltr">{groupDigits(g.value)}</td>
                  <td className="px-2 py-2.5 text-center">
                    <span className="font-bold tabular-nums" dir="ltr" style={{ color: g.profit >= 0 ? 'var(--b-green)' : 'var(--b-red)' }}>
                      {roi(g.cost, g.value)}
                    </span>
                  </td>
                  <td className="px-2 py-2.5 text-center whitespace-nowrap">
                    <button
                      type="button"
                      className="btn !py-1 !px-2 text-[11.5px]"
                      onClick={() => setExpanded(expanded === g.key ? null : g.key)}
                    >
                      {expanded === g.key ? 'بستن' : 'جزئیات'}
                    </button>
                  </td>
                </tr>
                {expanded === g.key &&
                  g.lots.map((a) => (
                    <Fragment key={`lot-${a.id}`}>
                      <tr className="border-b border-line bg-surface-2/60 text-[11.5px]">
                        <td className="px-3 py-2 ps-7 text-faint">{a.buyDate}</td>
                        <td className="px-2 py-2 text-center tabular-nums" dir="ltr">{groupDecimal(a.qty)}</td>
                        <td className="px-2 py-2 text-center tabular-nums" dir="ltr">{groupDigits(a.buyPrice)}</td>
                        <td className="px-2 py-2 text-center text-faint" colSpan={2}>
                          ارزش این خرید: <b className="tabular-nums" dir="ltr">{groupDigits(a.qty * (currentOf(a.kind, cache, a.currentPrice) ?? a.buyPrice))}</b>
                        </td>
                        <td className="px-2 py-2 text-center">
                          <button type="button" className="btn !py-0.5 !px-2 text-[11px]" onClick={() => openSell(a, currentOf(a.kind, cache, a.currentPrice) ?? a.buyPrice)}>
                            فروش
                          </button>
                        </td>
                        <td className="px-2 py-2 text-center">
                          <button className="text-faint hover:text-[color:var(--b-red)]" onClick={() => remove(a)}>🗑</button>
                        </td>
                      </tr>
                      {sellId === a.id && (
                        <tr className="border-b border-line bg-surface-2">
                          <td colSpan={7} className="px-3 py-3">
                            <form onSubmit={(e) => void submitSell(e, a)} className="flex flex-col sm:flex-row items-stretch sm:items-end gap-2">
                              <div className="flex-1">
                                <Field label="مقدار فروش">
                                  <NumberInput decimal value={sellQty} onChange={(n) => setSellQty(n === 0 ? '' : String(n))} required />
                                </Field>
                              </div>
                              <div className="flex-1">
                                <Field label="قیمت فروش هر واحد">
                                  <NumberInput value={sellPrice} onChange={(n) => setSellPrice(n === 0 ? '' : String(n))} required />
                                </Field>
                              </div>
                              <div className="flex gap-2">
                                <button type="button" className="btn" onClick={() => setSellId(null)}>انصراف</button>
                                <button type="submit" className="btn btn-primary">ثبت فروش</button>
                              </div>
                            </form>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
              </Fragment>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-surface-2 border-t-2 border-line font-bold">
              <td className="px-3 py-2.5" colSpan={4}>{t('finance.totalValue')}</td>
              <td className="px-2 py-2.5 text-center tabular-nums" dir="ltr">{groupDigits(totalValue)}</td>
              <td className="px-2 py-2.5 text-center tabular-nums" dir="ltr" style={{ color: totalValue - totalCost >= 0 ? 'var(--b-green)' : 'var(--b-red)' }}>
                {roi(totalCost, totalValue)}
              </td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      )}
    </div>
  )
}

/* ============================================================
   دفتر شخصی + خلاصه ماه + تاریخچه کامل
   ============================================================ */
const TX_META: Record<TxType, { label: string; icon: string; color: string; sign: string }> = {
  income: { label: 'دریافتی', icon: '💰', color: 'var(--b-green)', sign: '+' },
  expense: { label: 'پرداختی', icon: '🧾', color: 'var(--b-red)', sign: '−' },
  invest: { label: 'سرمایه‌گذاری', icon: '📈', color: 'var(--b-red)', sign: '−' },
  withdraw: { label: 'برداشت', icon: '💸', color: 'var(--b-green)', sign: '+' },
}

function Ledger() {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [type, setType] = useState<TxType>('expense')
  const [category, setCategory] = useState('')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(todayJalali())
  const [note, setNote] = useState('')

  // فیلدهای اضافه سرمایه‌گذاری
  const [invKind, setInvKind] = useState<AssetKind>('gold')
  const [invTitle, setInvTitle] = useState('')
  const [invQty, setInvQty] = useState('')
  const [invPrice, setInvPrice] = useState('')

  // تاریخچه کامل
  const [filter, setFilter] = useState<'all' | TxType>('all')
  const [query, setQuery] = useState('')
  const [limit, setLimit] = useState(20)

  // ویرایش تراکنش
  const [editingTx, setEditingTx] = useState<Transaction | null>(null)
  // پاپ آپ فیلتر تراکنش بر اساس دسته
  const [txFilterPopup, setTxFilterPopup] = useState<{category: string; type: 'income' | 'expense'} | null>(null)
  const [editType, setEditType] = useState<TxType>('expense')
  const [editCategory, setEditCategory] = useState('')
  const [editAmount, setEditAmount] = useState('')
  const [editDate, setEditDate] = useState('')
  const [editNote, setEditNote] = useState('')

  const today = todayJalali()
  const mStart = startOfMonth(today)
  const mEnd = endOfMonth(today)

  const monthTx = useLiveQuery(
    () => db.transactions.where('date').between(mStart, mEnd, true, true).toArray(),
    [mStart, mEnd],
    [] as Transaction[],
  )
  const allTx = useLiveQuery(
    () => db.transactions.orderBy('createdAt').reverse().toArray(),
    [],
    [] as Transaction[],
  )

  const mIn = monthTx.filter((x) => x.type === 'income').reduce((s, x) => s + x.amount, 0)
  const mOut = monthTx.filter((x) => x.type === 'expense').reduce((s, x) => s + x.amount, 0)
  const mInvest = monthTx.filter((x) => x.type === 'invest').reduce((s, x) => s + x.amount, 0)
  const mWithdraw = monthTx.filter((x) => x.type === 'withdraw').reduce((s, x) => s + x.amount, 0)
  const mNet = mIn + mWithdraw - mOut - mInvest

  const byCatOut = useMemo(() => {
    const m = new Map<string, number>()
    monthTx.filter((x) => x.type === 'expense').forEach((x) => m.set(x.category, (m.get(x.category) ?? 0) + x.amount))
    return [...m.entries()].sort((a, b) => b[1] - a[1])
  }, [monthTx])
  const byCatIn = useMemo(() => {
    const m = new Map<string, number>()
    monthTx.filter((x) => x.type === 'income').forEach((x) => m.set(x.category, (m.get(x.category) ?? 0) + x.amount))
    return [...m.entries()].sort((a, b) => b[1] - a[1])
  }, [monthTx])
  const maxCat = Math.max(byCatOut[0]?.[1] ?? 1, byCatIn[0]?.[1] ?? 1, 1)

  const filtered = useMemo(() => {
    const q = query.trim()
    return allTx.filter((x) => {
      if (filter !== 'all' && x.type !== filter) return false
      if (q && !`${x.note ?? ''} ${x.category}`.includes(q)) return false
      return true
    })
  }, [allTx, filter, query])
  // تاریخچه همیشه بر اساس تاریخ (نزولی) مرتب می‌شود، نه ترتیب ثبت
  const sortedFiltered = useMemo(
    () =>
      [...filtered].sort((a, b) =>
        a.date === b.date ? b.createdAt - a.createdAt : a.date < b.date ? 1 : -1,
      ),
    [filtered],
  )
  const visible = sortedFiltered.slice(0, limit)
  // گروه‌بندی خودکار بر اساس تاریخ
  const visibleGroups = useMemo(() => {
    const map = new Map<string, Transaction[]>()
    for (const x of visible) {
      const d = x.date || '—'
      if (!map.has(d)) map.set(d, [])
      map.get(d)!.push(x)
    }
    return [...map.entries()].map(([date, items]) => {
      let inSum = 0
      let outSum = 0
      for (const it of items) {
        if (it.type === 'income' || it.type === 'withdraw') inSum += it.amount
        else outSum += it.amount
      }
      return { date, items, inSum, outSum }
    })
  }, [visible])

  async function submit(e: FormEvent) {
    e.preventDefault()
    const d = date || today
    if (!isValidJalali(d)) {
      window.alert('تاریخ معتبر نیست — از تقویم انتخاب کن.')
      return
    }

    if (type === 'invest') {
      const q = Number(invQty)
      const p = Number(invPrice)
      if (!invTitle.trim() || !q || q <= 0 || !p || p <= 0) return
      const total = Math.round(q * p)
      const cat = category || invTitle.trim()
      const txId = await db.transactions.add({
        type: 'invest',
        category: cat,
        amount: total,
        date: d,
        note: note.trim() || `خرید ${invTitle.trim()}`,
        createdAt: Date.now(),
      })
      await db.assets.add({
        kind: invKind,
        title: invTitle.trim(),
        qty: q,
        buyPrice: Math.round(p),
        buyDate: d,
        note: note.trim() || undefined,
        txId,
        createdAt: Date.now(),
      })
      setInvTitle(''); setInvQty(''); setInvPrice(''); setAmount(''); setNote(''); setCategory('')
      setOpen(false)
      return
    }

    const amt = Number(amount)
    if (!amt || amt <= 0 || !category) return
    await db.transactions.add({
      type,
      category,
      amount: Math.round(amt),
      date: d,
      note: note.trim() || undefined,
      createdAt: Date.now(),
    })
    setAmount(''); setNote(''); setOpen(false)
  }

  async function remove(id?: number) {
    if (!id) return
    const tx = await db.transactions.get(id)
    const linkedAsset = tx?.type === 'invest'
      ? await db.assets.filter((a) => a.txId === id).first()
      : undefined
    const msg = linkedAsset
      ? 'این تراکنش سرمایه‌گذاری حذف بشه؟ دارایی مرتبط هم از فهرست دارایی‌ها پاک می‌شه.'
      : t('projects.deleteConfirm')
    if (!window.confirm(msg)) return
    await db.transaction('rw', [db.transactions, db.assets], async () => {
      if (linkedAsset?.id) await db.assets.delete(linkedAsset.id)
      await db.transactions.delete(id)
    })
  }

  /** شروع ویرایش یک تراکنش */
  function startEdit(tx: Transaction) {
    setEditingTx(tx)
    setEditType(tx.type)
    setEditCategory(tx.category)
    setEditAmount(String(tx.amount))
    setEditDate(tx.date)
    setEditNote(tx.note ?? '')
  }

  /** ذخیره ویرایش تراکنش */
  async function submitEdit(e: FormEvent) {
    e.preventDefault()
    if (!editingTx?.id) return
    if (editingTx.type === 'invest' && editType !== 'invest') {
      window.alert('تراکنش سرمایه‌گذاری به تراکنش عادی تبدیل نمی‌شود؛ برای اصلاح، آن را حذف و دوباره ثبت کن.')
      return
    }
    const amt = Number(editAmount)
    if (!amt || amt <= 0) return
    if (!isValidJalali(editDate || today)) {
      window.alert('تاریخ معتبر نیست — از تقویم انتخاب کن.')
      return
    }
    await db.transactions.update(editingTx.id, {
      type: editType,
      category: editCategory.trim() || 'سایر',
      amount: Math.round(amt),
      date: editDate || today,
      note: editNote.trim() || undefined,
    })
    setEditingTx(null)
  }

  const kindName = (k: string) =>
    k === 'gold' ? 'طلا' : k === 'usd' ? 'دلار' : k === 'eur' ? 'یورو' : k === 'stock' ? 'سهام' : 'سایر'

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <div className="card p-3.5 text-center">
          <div className="text-[11.5px] text-muted">{t('finance.monthIn')}</div>
          <div className="text-[17px] font-bold tabular-nums mt-0.5" dir="ltr" style={{ color: 'var(--b-green)' }}>+{groupDigits(mIn)}</div>
        </div>
        <div className="card p-3.5 text-center">
          <div className="text-[11.5px] text-muted">{t('finance.monthOut')}</div>
          <div className="text-[17px] font-bold tabular-nums mt-0.5" dir="ltr" style={{ color: 'var(--b-red)' }}>−{groupDigits(mOut)}</div>
        </div>
        <div className="card p-3.5 text-center">
          <div className="text-[11.5px] text-muted">سرمایه‌گذاری ماه</div>
          <div className="text-[17px] font-bold tabular-nums mt-0.5" dir="ltr" style={{ color: 'var(--b-red)' }}>−{groupDigits(mInvest)}</div>
        </div>
        <div className="card p-3.5 text-center">
          <div className="text-[11.5px] text-muted">برداشت ماه</div>
          <div className="text-[17px] font-bold tabular-nums mt-0.5" dir="ltr" style={{ color: 'var(--b-green)' }}>+{groupDigits(mWithdraw)}</div>
        </div>
        <div className="card p-3.5 text-center">
          <div className="text-[11.5px] text-muted">{t('finance.monthNet')}</div>
          <div className="text-[17px] font-bold tabular-nums mt-0.5" dir="ltr" style={{ color: mNet >= 0 ? 'var(--b-accent)' : 'var(--b-red)' }}>{groupDigits(mNet)}</div>
        </div>
      </div>

      <div className="grid lg:grid-cols-[1.5fr_1fr] gap-4 items-start">
        <div className="card overflow-hidden" id="finance-ledger-export">
          <div className="flex items-center justify-between px-4 py-3 border-b border-line">
            <b className="text-[13.5px]">📒 تاریخچه تراکنش‌ها</b>
            <div className="flex items-center gap-2">
              <ExportMenu
                elementId="finance-ledger-export"
                filename={`sazora-transactions-${todayJalali()}`}
                data={sortedFiltered.map((x) => ({
                  تاریخ: x.date,
                  نوع: TX_META[x.type]?.label ?? x.type,
                  دسته: x.category,
                  مبلغ: x.amount,
                  توضیح: x.note ?? '',
                }))}
                sheetName="Transactions"
              />
              {!open && (
                <button className="btn btn-primary !py-1.5 text-[12.5px]" onClick={() => { setOpen(true); setCategory('') }}>
                  + {t('finance.addTx')}
                </button>
              )}
            </div>
          </div>

          {open && (
            <form onSubmit={submit} className="p-4 border-b border-line bg-surface-2 b-pop">
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <Field label={t('projects.entryType')}>
                    <div className="flex gap-2 flex-wrap">
                      {(Object.keys(TX_META) as TxType[]).map((k) => (
                        <button
                          key={k}
                          type="button"
                          className={`btn flex-1 ${type === k ? 'btn-primary' : ''}`}
                          onClick={() => { setType(k); setCategory('') }}
                        >
                          {TX_META[k].icon} {TX_META[k].label}
                        </button>
                      ))}
                    </div>
                  </Field>
                </div>
                <div className="sm:col-span-2">
                  <Field label={t('finance.txCategory')} hint="از دسته‌های آماده انتخاب کن یا دسته جدید بساز">
                    <CategoryPicker group={groupOfType(type)} value={category} onChange={setCategory} />
                  </Field>
                </div>
                {type === 'invest' ? (
                  <>
                    <Field label="نوع دارایی">
                      <select className="field" value={invKind} onChange={(e) => setInvKind(e.target.value as AssetKind)}>
                        {ASSET_KINDS.map((k) => (
                          <option key={k} value={k}>{kindName(k)}</option>
                        ))}
                      </select>
                    </Field>
                    <Field label="عنوان دارایی">
                      <TextInput value={invTitle} onChange={(e) => setInvTitle(e.target.value)} placeholder="طلای ۱۸ عیار" required />
                    </Field>
                    <Field label="مقدار">
                      <NumberInput value={invQty} onChange={(n) => setInvQty(n === 0 ? '' : String(n))} placeholder="5" required />
                    </Field>
                    <Field label="قیمت هر واحد">
                      <NumberInput value={invPrice} onChange={(n) => setInvPrice(n === 0 ? '' : String(n))} placeholder="8000000" required />
                    </Field>
                    <Field label={t('finance.txDate')}>
                      <DatePicker value={date} onChange={setDate} />
                    </Field>
                  </>
                ) : (
                  <>
                    <Field label={t('finance.txAmount')}>
                      <NumberInput value={amount} onChange={(n) => setAmount(n === 0 ? '' : String(n))} placeholder="2500000" required />
                    </Field>
                    <Field label={t('finance.txDate')}>
                      <DatePicker value={date} onChange={setDate} />
                    </Field>
                  </>
                )}
                <div className="sm:col-span-2">
                  <Field label={t('finance.txNote')}>
                    <TextInput value={note} onChange={(e) => setNote(e.target.value)} />
                  </Field>
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-3">
                <button type="button" className="btn" onClick={() => setOpen(false)}>{t('common.cancel')}</button>
                <button type="submit" className="btn btn-primary">{t('common.save')}</button>
              </div>
            </form>
          )}

          <div className="px-4 py-3 border-b border-line flex flex-col sm:flex-row gap-2">
            <div className="flex gap-1.5 flex-wrap">
              {(['all', 'income', 'expense', 'invest', 'withdraw'] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  className={`btn !py-1 !px-2.5 text-[12px] ${filter === f ? 'btn-primary' : ''}`}
                  onClick={() => { setFilter(f); setLimit(20) }}
                >
                  {f === 'all' ? 'همه' : `${TX_META[f].icon} ${TX_META[f].label}`}
                </button>
              ))}
            </div>
            <div className="flex-1">
              <TextInput value={query} onChange={(e) => { setQuery(e.target.value); setLimit(20) }} placeholder="جست‌وجو در عنوان و دسته…" />
            </div>
          </div>

          {visible.length === 0 ? (
            <div className="p-8 text-center text-faint text-[13px]">{t('finance.noTx')}</div>
          ) : (
            <div className="max-h-[52vh] min-h-[200px] overflow-y-auto overscroll-contain">
              {visibleGroups.map((g) => (
                <div key={g.date}>
                  <div className="sticky top-0 z-[1] flex items-center justify-between gap-2 px-4 py-1.5 bg-surface-2 border-y border-line text-[11px] text-muted">
                    <span className="flex items-center gap-1.5">
                      📅 <b className="text-ink font-semibold">{g.date === today ? 'امروز' : formatJalali(g.date)}</b>
                      <span className="text-faint">· {weekdayOf(g.date)}</span>
                      <span className="text-faint">· {faDigits(g.items.length)} مورد</span>
                    </span>
                    <span className="flex items-center gap-2 tabular-nums" dir="ltr">
                      {g.inSum > 0 && <b style={{ color: 'var(--b-green)' }}>+{groupDigits(g.inSum)}</b>}
                      {g.outSum > 0 && <b style={{ color: 'var(--b-red)' }}>−{groupDigits(g.outSum)}</b>}
                    </span>
                  </div>
                  {g.items.map((x) => {
                    const meta = TX_META[x.type] ?? TX_META.expense
                    return (
                      <div key={x.id} className="flex items-center gap-3 px-4 py-2.5 border-b border-line last:border-0 hover:bg-surface-2">
                        <span className="text-[16px]">{meta.icon}</span>
                        <div className="flex-1 min-w-0">
                          <div className="text-[13px] font-medium truncate">{x.note || x.category}</div>
                          <div className="text-[11px] text-faint">{x.category} · {meta.label}</div>
                        </div>
                        <b className="tabular-nums text-[13px]" dir="ltr" style={{ color: meta.color }}>
                          {meta.sign}{groupDigits(x.amount)}
                        </b>
                        <div className="flex items-center gap-1">
                          <button
                            className="text-faint hover:text-accent text-[13px]"
                            title="ویرایش تراکنش"
                            onClick={() => startEdit(x)}
                          >
                            ✏️
                          </button>
                          <button className="text-faint hover:text-[color:var(--b-red)] text-[13px]" onClick={() => remove(x.id)}>🗑</button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ))}
              {/* فرم ویرایش تراکنش به صورت مودال در پایین صفحه رندر می‌شود */}
              {filtered.length > visible.length && (
                <div className="p-3 text-center border-t border-line">
                  <button type="button" className="btn !py-1.5 text-[12.5px]" onClick={() => setLimit((v) => v + 20)}>
                    نمایش بیشتر ({faDigits(filtered.length - visible.length)} مورد باقی‌مانده)
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="card p-4">
            <b className="text-[13.5px] block mb-3">{t('finance.breakdownExpense')}</b>
            {byCatOut.length === 0 && <div className="text-[12px] text-faint">—</div>}
            {byCatOut.map(([c, v]) => (
              <div key={c} className="mb-2.5 cursor-pointer hover:bg-surface-2 rounded-lg p-2 transition-colors" onClick={() => setTxFilterPopup({category: c, type: 'expense'})}>
                <div className="flex justify-between text-[12px] mb-1">
                  <span>{c}</span>
                  <span className="tabular-nums text-muted" dir="ltr">{groupDigits(v)}</span>
                </div>
                <Bar value={(v / maxCat) * 100} />
              </div>
            ))}
          </div>
          <div className="card p-4">
            <b className="text-[13.5px] block mb-3">{t('finance.breakdownIncome')}</b>
            {byCatIn.length === 0 && <div className="text-[12px] text-faint">—</div>}
            {byCatIn.map(([c, v]) => (
              <div key={c} className="mb-2.5 cursor-pointer hover:bg-surface-2 rounded-lg p-2 transition-colors" onClick={() => setTxFilterPopup({category: c, type: 'income'})}>
                <div className="flex justify-between text-[12px] mb-1">
                  <span>{c}</span>
                  <span className="tabular-nums text-muted" dir="ltr">{groupDigits(v)}</span>
                </div>
                <Bar value={(v / maxCat) * 100} />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* پاپ آپ لیست تراکنش‌های یک دسته — با Portal تا کل صفحه سفید نشود */}
      {txFilterPopup &&
        createPortal(
          <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/45" onClick={() => setTxFilterPopup(null)} />
            <div className="relative card w-full max-w-md max-h-[80vh] overflow-y-auto p-4 shadow-float b-pop">
              <div className="flex items-center justify-between gap-2 mb-3">
                <b className="text-[15px]">
                  {txFilterPopup.type === 'expense' ? t('finance.expenseList') : t('finance.incomeList')}
                </b>
                <b className="text-[13px] font-bold text-accent truncate">{txFilterPopup.category}</b>
                <button
                  type="button"
                  className="text-faint hover:text-[color:var(--b-red)] text-[16px] leading-none"
                  onClick={() => setTxFilterPopup(null)}
                  aria-label={t('common.close')}
                >
                  ✕
                </button>
              </div>
              {(() => {
                const list = allTx.filter((x) => x.category === txFilterPopup.category && x.type === txFilterPopup.type)
                const total = list.reduce((s, x) => s + x.amount, 0)
                if (list.length === 0) return <div className="text-[12.5px] text-faint py-4 text-center">{t('finance.noTx')}</div>
                return (
                  <>
                    <div className="space-y-1">
                      {list.map((x) => {
                        const meta = TX_META[x.type] ?? TX_META.expense
                        return (
                          <div key={x.id} className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg border border-line bg-surface-2">
                            <span className="text-[15px]">{meta.icon}</span>
                            <div className="flex-1 min-w-0">
                              <div className="text-[12.5px] font-medium truncate">{x.note || x.category}</div>
                              <div className="text-[10.5px] text-faint tabular-nums" dir="ltr">{x.date}</div>
                            </div>
                            <b className="tabular-nums text-[12.5px]" dir="ltr" style={{ color: meta.color }}>
                              {meta.sign}{groupDigits(x.amount)}
                            </b>
                          </div>
                        )
                      })}
                    </div>
                    <div className="mt-3 pt-2.5 border-t border-line flex items-center justify-between text-[12.5px]">
                      <span className="text-muted">{faDigits(list.length)} {t('finance.items')}</span>
                      <b className="tabular-nums" dir="ltr">{groupDigits(total)} {t('common.unitToman')}</b>
                    </div>
                  </>
                )
              })()}
              <div className="mt-3 flex justify-end">
                <button type="button" className="btn !py-1 !px-3 text-[12px]" onClick={() => setTxFilterPopup(null)}>
                  {t('common.close')}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {/* مودال ویرایش تراکنش */}
      {editingTx &&
        createPortal(
          <div className="fixed inset-0 z-[95] flex items-center justify-center p-4" onClick={() => setEditingTx(null)}>
            <div className="absolute inset-0 bg-black/45" />
            <form
              onSubmit={submitEdit}
              onClick={(e) => e.stopPropagation()}
              className="relative card w-full max-w-lg max-h-[88vh] overflow-y-auto p-4 b-pop"
            >
              <div className="flex items-center justify-between mb-3">
                <b className="text-[14.5px]">✏️ {t('finance.editTx')}</b>
                <button
                  type="button"
                  className="btn btn-ghost !px-2 !py-1 text-[12px]"
                  onClick={() => setEditingTx(null)}
                  aria-label={t('common.close')}
                >
                  ✕
                </button>
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                <Field label={t('projects.entryType')}>
                  <select className="field" value={editType} onChange={(e) => setEditType(e.target.value as TxType)}>
                    {(Object.keys(TX_META) as TxType[]).map((k) => (
                      <option key={k} value={k}>{TX_META[k].icon} {TX_META[k].label}</option>
                    ))}
                  </select>
                </Field>
                <div className="sm:col-span-2">
                  <Field label={t('finance.txCategory')}>
                    <CategoryPicker group={groupOfType(editType)} value={editCategory} onChange={setEditCategory} />
                  </Field>
                </div>
                <Field label={t('finance.txAmount')}>
                  <NumberInput
                    value={editAmount}
                    onChange={(n) => setEditAmount(n === 0 ? '' : String(n))}
                    required
                  />
                </Field>
                <Field label={t('finance.txDate')}>
                  <DatePicker value={editDate} onChange={setEditDate} />
                </Field>
                <div className="sm:col-span-2">
                  <Field label={t('finance.txNote')}>
                    <TextInput value={editNote} onChange={(e) => setEditNote(e.target.value)} />
                  </Field>
                </div>
              </div>

              <div className="flex justify-end gap-2 mt-4">
                <button type="button" className="btn" onClick={() => setEditingTx(null)}>
                  {t('common.cancel')}
                </button>
                <button type="submit" className="btn btn-primary">
                  ✓ {t('common.save')}
                </button>
              </div>
            </form>
          </div>,
          document.body,
        )}
    </div>
  )
}
