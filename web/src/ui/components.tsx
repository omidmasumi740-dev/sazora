import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type InputHTMLAttributes,
} from 'react'
import { formatNumberInput, parseDecimal, parseNumber } from '../lib/format'
import { exportElement } from '../lib/export'

/* ============================================================
   کامپوننت‌های پایه دیزاین‌سیستم «بُنا»
   ============================================================ */

export function Panel({
  children,
  className = '',
  pad = true,
}: {
  children: ReactNode
  className?: string
  pad?: boolean
}) {
  return <div className={`card ${pad ? 'p-4 sm:p-5' : ''} ${className}`}>{children}</div>
}

export function SectionHead({
  title,
  action,
  sub,
}: {
  title: string
  action?: ReactNode
  sub?: string
}) {
  return (
    <div className="flex items-center gap-3 mb-3">
      <div className="min-w-0">
        <h2 className="text-[14.5px] font-semibold leading-tight">{title}</h2>
        {sub && <div className="text-xs text-muted mt-0.5">{sub}</div>}
      </div>
      <div className="flex-1 h-px bg-line" />
      {action}
    </div>
  )
}

export function Chip({
  children,
  tone = 'default',
  className = '',
}: {
  children: ReactNode
  tone?: 'default' | 'accent' | 'danger' | 'warn' | 'info' | 'success'
  className?: string
}) {
  const map = {
    default: '',
    accent: 'chip-accent',
    danger: 'chip-danger',
    warn: 'chip-warn',
    info: 'chip-info',
    success: 'chip-success',
  }
  return <span className={`chip ${map[tone]} ${className}`}>{children}</span>
}

export function Bar({ value, className = '' }: { value: number; className?: string }) {
  const v = Math.max(0, Math.min(100, value))
  return (
    <div className={`bar ${className}`}>
      <i style={{ width: `${v}%` }} />
    </div>
  )
}

export function EmptyState({
  icon,
  title,
  hint,
  action,
}: {
  icon: string
  title: string
  hint?: string
  action?: ReactNode
}) {
  return (
    <div className="card p-10 text-center">
      <div className="text-4xl mb-3">{icon}</div>
      <div className="font-semibold">{title}</div>
      {hint && <div className="text-sm text-muted mt-1">{hint}</div>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  )
}

/** ورودی متن ساده با لیبل */
export function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: ReactNode
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-muted block mb-1.5">{label}</span>
      {children}
      {hint && <span className="text-[11px] text-faint block mt-1">{hint}</span>}
    </label>
  )
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`field ${props.className ?? ''}`} />
}

/** کلید میانبر */
export function Kbd({ children }: { children: ReactNode }) {
  return (
    <span
      className="text-[10.5px] font-mono bg-surface-2 border border-line rounded px-1.5 py-px text-muted"
      dir="ltr"
    >
      {children}
    </span>
  )
}

/** دکمه شناور افزودن (FAB) */
export function Fab({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="btn btn-primary fixed bottom-6 end-6 z-30 shadow-float h-12 px-5 rounded-full text-sm"
      style={{ boxShadow: 'var(--b-shadow-lg)' }}
    >
      {children}
    </button>
  )
}

export type ExportFormat = 'pdf' | 'jpg' | 'excel' | 'word' | 'json'

/**
 * منوی خروجی — انتخاب فرمت (PDF / Word / JPG / Excel / JSON)
 */
export function ExportMenu({
  elementId,
  filename = 'sazora-export',
  data,
  sheetName,
  className = '',
  includeVisio = false,
  onVisio,
}: {
  elementId?: string
  filename?: string
  data?: Record<string, unknown>[]
  sheetName?: string
  className?: string
  includeVisio?: boolean
  onVisio?: () => void
}) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState<ExportFormat | null>(null)

  async function run(fmt: ExportFormat) {
    if (!elementId && fmt !== 'excel' && fmt !== 'json') return
    setBusy(fmt)
    try {
      await exportElement({
        elementId: elementId || '',
        format: fmt,
        filename: `${filename}.${fmt === 'excel' ? 'xlsx' : fmt === 'word' ? 'doc' : fmt === 'json' ? 'json' : fmt}`,
        data,
        sheetName,
      })
    } catch (err) {
      console.error('export failed:', err)
      window.alert('خروجی گرفتن ناموفق بود. دوباره تلاش کن.')
    } finally {
      setBusy(null)
      setOpen(false)
    }
  }

  const items: { fmt: ExportFormat; label: string; icon: string; disabled?: boolean }[] = [
    { fmt: 'pdf', label: 'PDF', icon: '📕', disabled: !elementId },
    { fmt: 'jpg', label: 'تصویر (JPG)', icon: '🖼️', disabled: !elementId },
    { fmt: 'excel', label: 'اکسل (Excel)', icon: '📊', disabled: !data },
    { fmt: 'word', label: 'ورد (Word)', icon: '📄', disabled: !elementId },
    { fmt: 'json', label: 'JSON', icon: '🗂️', disabled: !data },
  ]

  return (
    <div className={`relative ${className}`}>
      <button
        type="button"
        className="btn btn-ghost !py-1 !px-2.5 text-[12px] flex items-center gap-1.5"
        onClick={() => setOpen((v) => !v)}
      >
        📤 خروجی {open ? '▲' : '▼'}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full mt-1 z-50 min-w-[170px] rounded-xl border border-line bg-surface shadow-float p-1.5 b-pop">
            {items.map((it) => (
              <button
                key={it.fmt}
                type="button"
                disabled={!!busy || it.disabled}
                className="w-full text-start px-3 py-2 rounded-lg text-[12.5px] hover:bg-surface-2 disabled:opacity-40 flex items-center gap-2"
                onClick={() => void run(it.fmt)}
              >
                <span>{it.icon}</span>
                <span className="flex-1">{it.label}</span>
                {busy === it.fmt && <span className="text-[10px] text-faint">…</span>}
              </button>
            ))}
            {includeVisio && onVisio && (
              <button
                type="button"
                className="w-full text-start px-3 py-2 rounded-lg text-[12.5px] hover:bg-surface-2 flex items-center gap-2 border-t border-line mt-1 pt-2"
                onClick={() => { onVisio(); setOpen(false) }}
              >
                <span>📐</span>
                <span>MS Visio (VDX)</span>
              </button>
            )}
          </div>
        </>
      )}
    </div>
  )
}

/** سازگاری با کد قدیمی */
export const ExportButton = ExportMenu

/**
 * ورودی عددی با جداکننده هزارگان خودکار.
 * مقدار ذخیره‌شده (value) عدد خام است؛ نمایش با کاما جدا می‌شود.
 * onChange عدد خام را برمی‌گرداند.
 */
export function NumberInput({
  value,
  onChange,
  className = '',
  decimal = false,
  ...rest
}: {
  value: number | string
  onChange: (n: number) => void
  className?: string
  /** اجازهٔ ورود اعشار (مثلاً ۲٫۵ گرم طلا) */
  decimal?: boolean
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'>) {
  const raw = value === '' || value === null || value === undefined ? '' : String(value)
  const [text, setText] = useState(() => formatNumberInput(raw))
  const focused = useRef(false)
  const caret = useRef<number | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // وقتی مقدار از بیرون عوض شود و کاربر در حال تایپ نباشد، نمایش هم‌گام می‌شود
  useEffect(() => {
    if (!focused.current) setText(formatNumberInput(raw))
  }, [raw])

  // نگه‌داشتن مکان نشانگر بعد از افزودن جداکننده
  useLayoutEffect(() => {
    if (caret.current != null && inputRef.current) {
      const pos = Math.min(caret.current, text.length)
      inputRef.current.setSelectionRange(pos, pos)
      caret.current = null
    }
  }, [text])

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const el = e.target
    const before = el.value.slice(0, el.selectionStart ?? el.value.length)
    // تعداد «رقم + نقطه اعشار» قبل از Edit → Mapping reliable باشد
    const digitsBefore = (before.match(/[\d.]/g) || []).length

    let cleaned = el.value
    if (decimal) {
      cleaned = cleaned.replace(/[^\d.]/g, '')
      const parts = cleaned.split('.')
      cleaned = parts.shift()! + (parts.length ? '.' + parts.join('') : '')
    } else {
      cleaned = cleaned.replace(/[^\d]/g, '')
    }

    const formatted = formatNumberInput(cleaned)
    // مکان نشانگر: بعد از همان تعداد (°ر + نقطه) که قبل از ویرایش بود
    if (digitsBefore > 0) {
      let seen = 0
      let pos = formatted.length
      for (let i = 0; i < formatted.length; i++) {
        if (/\d|\./.test(formatted[i]!)) {
          seen++
          if (seen === digitsBefore) {
            pos = i + 1
            break
          }
        }
      }
      caret.current = pos
    } else {
      caret.current = 0
    }

    setText(formatted)
    onChange(decimal ? parseDecimal(cleaned) : parseNumber(cleaned))
  }

  return (
    <input
      {...rest}
      ref={inputRef}
      type="text"
      inputMode={decimal ? 'decimal' : 'numeric'}
      dir="ltr"
      className={`field tabular-nums ${className}`}
      value={text}
      onFocus={(e) => {
        focused.current = true
        rest.onFocus?.(e)
      }}
      onBlur={(e) => {
        focused.current = false
        setText(formatNumberInput(raw))
        rest.onBlur?.(e)
      }}
      onChange={handleChange}
    />
  )
}
