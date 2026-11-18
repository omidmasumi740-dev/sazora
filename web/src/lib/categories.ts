import { useEffect, useSyncExternalStore } from 'react'
import { db } from '../db/schema'

/* ============================================================
   دسته‌بندی‌های تراکنش — یک منبع مشترک برای همه فرم‌ها
   ------------------------------------------------------------
   قبلاً هر صفحه لیست خودش را داشت (ورودی دستی، لیست پیش‌فرض
   مالی، لیست ثابت پروژه). حالا همه از این استور می‌خوانند تا
   دسته‌ها کامل و همگام نمایش داده شوند.
   ============================================================ */

export type CatGroup = 'income' | 'expense'

export interface TxCats {
  income: string[]
  expense: string[]
}

export const DEFAULT_INCOME = ['دستمزد', 'فروش', 'سرمایه', 'سایر']
export const DEFAULT_EXPENSE = [
  'مصالح',
  'دستمزد',
  'ماشین‌آلات',
  'حمل‌ونقل',
  'زندگی',
  'قبوض',
  'سلامت',
  'خوردوخوراک',
  'اجاره',
  'سایر',
]

const STORAGE_KEY = 'sazora-tx-cats'

function sanitize(list: unknown): string[] {
  if (!Array.isArray(list)) return []
  const out: string[] = []
  for (const raw of list) {
    if (typeof raw !== 'string') continue
    const n = raw.trim()
    if (!n) continue
    if (!out.includes(n)) out.push(n)
  }
  return out
}

function read(): TxCats {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const p = JSON.parse(raw) as Partial<TxCats>
      return { income: sanitize(p.income), expense: sanitize(p.expense) }
    }
  } catch {
    /* ignore */
  }
  return { income: [...DEFAULT_INCOME], expense: [...DEFAULT_EXPENSE] }
}

let state: TxCats = read()
const listeners = new Set<() => void>()

function emit() {
  for (const l of listeners) l()
}

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    /* ignore */
  }
}

function commit(next: TxCats) {
  const clean = { income: sanitize(next.income), expense: sanitize(next.expense) }
  if (clean.income.join('|') === state.income.join('|') && clean.expense.join('|') === state.expense.join('|')) return
  state = clean
  persist()
  emit()
}

export function subscribeCats(fn: () => void): () => void {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

export function getCats(): TxCats {
  return state
}

export function addCat(group: CatGroup, name: string) {
  const n = name.trim()
  if (!n) return
  if (state[group].includes(n)) return
  commit({ ...state, [group]: [...state[group], n] })
}

export function removeCat(group: CatGroup, name: string) {
  commit({ ...state, [group]: state[group].filter((c) => c !== name) })
}

export function renameCat(group: CatGroup, oldName: string, newName: string) {
  const n = newName.trim()
  if (!n || n === oldName) return
  const list = state[group].map((c) => (c === oldName ? n : c))
  commit({ ...state, [group]: list })
}

/** دسته‌های موجود در داده‌ها را یک‌بار به لیست اضافه می‌کند تا چیزی از قلم نیفتد */
export async function syncCategoriesFromData() {
  try {
    const [txs, entries] = await Promise.all([db.transactions.toArray(), db.financeEntries.toArray()])
    const income = new Set<string>()
    const expense = new Set<string>()

    const push = (type: string, category: string | undefined) => {
      const c = (category ?? '').trim()
      if (!c) return
      if (type === 'income' || type === 'withdraw') income.add(c)
      else expense.add(c)
    }

    for (const x of txs) push(x.type, x.category)
    for (const e of entries) push(e.type, e.category)

    const next: TxCats = {
      income: [...state.income, ...[...income].filter((c) => !state.income.includes(c))],
      expense: [...state.expense, ...[...expense].filter((c) => !state.expense.includes(c))],
    }
    commit(next)
  } catch {
    /* ignore */
  }
}

/** یک‌بار در شروع اپ صدا زده می‌شود */
export function useCategorySync() {
  useEffect(() => {
    void syncCategoriesFromData()
  }, [])
}

/** خواندن لیست + عملیات — مشترک بین همه صفحه‌ها */
export function useTxCats() {
  const cats = useSyncExternalStore(subscribeCats, getCats, getCats)
  return {
    cats,
    addCat: (group: CatGroup, name: string) => addCat(group, name),
    removeCat: (group: CatGroup, name: string) => removeCat(group, name),
    renameCat: (group: CatGroup, oldName: string, newName: string) => renameCat(group, oldName, newName),
  }
}

/** گروه دسته بر اساس نوع تراکنش */
export function groupOfType(type: string): CatGroup {
  return type === 'income' || type === 'withdraw' ? 'income' : 'expense'
}
