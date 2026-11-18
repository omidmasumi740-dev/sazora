import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  FA_MONTHS,
  addMonths,
  daysUntil,
  formatJalali,
  isValidJalali,
  monthDays,
  startOfMonth,
  todayJalali,
  weekdayOf,
} from '../lib/jalali'
import { faDigits } from '../lib/format'

/** خانه‌های خالی ابتدای ماه — شنبه = ستون اول */
function leadingBlanks(monthCursor: string): number {
  const first = startOfMonth(monthCursor)
  const wd = weekdayOf(first)
  const map: Record<string, number> = {
    شنبه: 0,
    یکشنبه: 1,
    دوشنبه: 2,
    'سه‌شنبه': 3,
    چهارشنبه: 4,
    پنجشنبه: 5,
    جمعه: 6,
  }
  return map[wd] ?? 0
}

/**
 * انتخاب‌گر تاریخ شمسی — دکمه + پاپ‌آپ تقویم
 * value/due به شکل 'YYYY-MM-DD' شمسی
 * انتخاب روز با یک کلیک انجام و پاپ‌آپ بسته می‌شود.
 */
export function DatePicker({
  value,
  onChange,
  placeholder = 'انتخاب تاریخ…',
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  const [cursor, setCursor] = useState(value || todayJalali())
  const triggerRef = useRef<HTMLButtonElement>(null)

  // تاریخ ذخیره‌شدهٔ قدیمی/خراب نباید تقویم را از کار بیندازد
  const safeCursor = isValidJalali(cursor) ? cursor : todayJalali()
  const safeValue = isValidJalali(value) ? value : ''
  const days = monthDays(safeCursor)
  const lead = leadingBlanks(safeCursor)
  const [jy, jm] = safeCursor.split('-').map(Number)
  const today = todayJalali()

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const pick = (d: string) => {
    onChange(d)
    setCursor(d)
    setOpen(false)
  }

  return (
    <span className="relative inline-block">
      <button
        ref={triggerRef}
        type="button"
        className="field !w-auto flex items-center gap-2 !py-2"
        onClick={() => {
          setCursor(safeValue || todayJalali())
          setOpen((v) => !v)
        }}
      >
        <span>📅</span>
        <span className="tabular-nums text-[13px]">
          {safeValue
            ? `${faDigits(formatJalali(safeValue))} · ${weekdayOf(safeValue)}`
            : placeholder}
        </span>
      </button>

      {open &&
        createPortal(
          <span className="fixed inset-0 z-[400] block" data-sazora-datepicker="">
            <span className="absolute inset-0" onClick={() => setOpen(false)} />
            <span
              className="fixed z-[401] card p-3 w-[300px] b-pop block"
              style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}
              onClick={(e) => e.stopPropagation()}
            >
              <span className="flex items-center justify-between mb-2">
                <button type="button" className="btn btn-ghost !px-2 !py-1 text-[12px]" onClick={() => setCursor(addMonths(safeCursor, -1))}>
                  ›
                </button>
                <b className="text-[13.5px]">
                  {FA_MONTHS[jm! - 1]} {faDigits(jy!)}
                </b>
                <button type="button" className="btn btn-ghost !px-2 !py-1 text-[12px]" onClick={() => setCursor(addMonths(safeCursor, 1))}>
                  ‹
                </button>
              </span>

              <span className="grid grid-cols-7 gap-1 mb-1">
                {['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'].map((d) => (
                  <span key={d} className="text-center text-[10.5px] text-faint font-semibold py-0.5">
                    {d}
                  </span>
                ))}
              </span>

              <span className="grid grid-cols-7 gap-1">
                {Array.from({ length: lead }).map((_, i) => (
                  <span key={`e${i}`} />
                ))}
                {days.map((d) => {
                  const isToday = d === today
                  const isSel = d === safeValue
                  const past = daysUntil(d) < 0
                  return (
                    <button
                      key={d}
                      type="button"
                      // انتخاب با یک کلیک — روی pointerdown تا حتی اگر لایه‌های مودال
                      // بین mousedown و mouseup دوباره رندر شوند، تاریخ ثبت شود.
                      onPointerDown={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        pick(d)
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          pick(d)
                        }
                      }}
                      className={`h-9 rounded-lg text-[12.5px] tabular-nums transition-colors border ${
                        isSel
                          ? 'text-white border-transparent font-bold'
                          : isToday
                            ? 'border-[color:var(--b-accent)] font-bold'
                            : 'border-transparent hover:bg-surface-2'
                      } ${past && !isSel ? 'opacity-50' : ''}`}
                      style={isSel ? { background: 'var(--b-accent)' } : isToday ? { color: 'var(--b-accent)' } : undefined}
                    >
                      {faDigits(Number(d.split('-')[2]))}
                    </button>
                  )
                })}
              </span>

              <span className="flex gap-1.5 mt-2.5">
                <button
                  type="button"
                  className="btn !py-1 !px-2.5 text-[12px] flex-1"
                  onClick={() => {
                    const t = todayJalali()
                    pick(t)
                  }}
                >
                  امروز
                </button>
                <button type="button" className="btn !py-1 !px-2.5 text-[12px] flex-1" onClick={() => setOpen(false)}>
                  بستن
                </button>
              </span>
            </span>
          </span>,
          document.body,
        )}
    </span>
  )
}
