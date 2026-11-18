import { useState, type KeyboardEvent } from 'react'
import { addCat, useTxCats, type CatGroup } from '../lib/categories'

/* ============================================================
   انتخاب دسته تراکنش — چیپ‌های کامل + افزودن دسته جدید
   همه دسته‌های ذخیره‌شده و همه دسته‌های استفاده‌شده در داده‌ها
   اینجا نمایش داده می‌شوند (نه فقط چند مورد پیش‌فرض).
   ============================================================ */

export function CategoryPicker({
  group,
  value,
  onChange,
  allowNew = true,
  className = '',
}: {
  group: CatGroup
  value: string
  onChange: (name: string) => void
  allowNew?: boolean
  className?: string
}) {
  const { cats } = useTxCats()
  const list = group === 'income' ? cats.income : cats.expense
  const [newOpen, setNewOpen] = useState(false)
  const [draft, setDraft] = useState('')

  function commitNew() {
    const n = draft.trim()
    if (!n) {
      setNewOpen(false)
      return
    }
    addCat(group, n)
    onChange(n)
    setDraft('')
    setNewOpen(false)
  }

  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      commitNew()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setNewOpen(false)
      setDraft('')
    }
  }

  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${className}`}>
      {list.map((c) => {
        const active = c === value
        return (
          <button
            key={c}
            type="button"
            onClick={() => onChange(c)}
            className={`chip transition-colors ${active ? 'chip-accent' : ''}`}
            style={
              active
                ? undefined
                : { background: 'var(--b-surface-2)', color: 'var(--b-muted)', border: '1px solid var(--b-line)' }
            }
            title={c}
          >
            {c}
          </button>
        )
      })}

      {value && !list.includes(value) && (
        <span className="chip chip-accent" title={value}>
          {value}
        </span>
      )}

      {allowNew &&
        (newOpen ? (
          <span className="inline-flex items-center gap-1">
            <input
              autoFocus
              className="field !py-1 !px-2 !text-[12px] !w-[130px]"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={onKey}
              placeholder="دسته جدید…"
            />
            <button type="button" className="btn !py-1 !px-2 text-[12px]" onClick={commitNew} title="افزودن">
              ✓
            </button>
            <button
              type="button"
              className="btn !py-1 !px-2 text-[12px]"
              onClick={() => {
                setNewOpen(false)
                setDraft('')
              }}
              title="انصراف"
            >
              ✕
            </button>
          </span>
        ) : (
          <button type="button" className="btn !py-1 !px-2 text-[12px]" onClick={() => setNewOpen(true)}>
            + دسته جدید
          </button>
        ))}
    </div>
  )
}
