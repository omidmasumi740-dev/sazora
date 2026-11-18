import { useRef, useState, type FormEvent } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type WorkoutDay, type BodyMetric, type ProgressPhoto, type WorkoutPlan } from '../db/schema'
import { todayJalali, addMonths, formatJalali, formatJalaliShort, monthDays, startOfMonth, endOfMonth, weekdayOf, isValidJalali, FA_MONTHS, FA_WEEKDAYS } from '../lib/jalali'
import { faDigits, groupDigits } from '../lib/format'
import { compressImage, dataUrlKB, humanSize } from '../lib/photos'
import { Chip, EmptyState, Field, TextInput, Bar, NumberInput, ExportMenu } from '../ui/components'
import { DatePicker } from '../ui/datepicker'

/** ایندکس روز هفته: شنبه=۰ … جمعه=۶ */
function weekdayIndex(jalali: string): number {
  const map: Record<string, number> = {
    شنبه: 0,
    یکشنبه: 1,
    دوشنبه: 2,
    'سه‌شنبه': 3,
    چهارشنبه: 4,
    پنجشنبه: 5,
    جمعه: 6,
  }
  return map[weekdayOf(jalali)] ?? 0
}

/** قالب‌های آماده برنامه تمرینی */
const PLAN_PRESETS: { name: string; schedule: string[]; weekdays: number[] }[] = [
  { name: '۳ روزه کلاسیک', schedule: ['سینه + جلو بازو', 'پا + شکم', 'پشت + پشت بازو'], weekdays: [0, 2, 4] },
  { name: '۳ روزه فول‌بادی', schedule: ['کل بدن A', 'کل بدن B', 'کل بدن A'], weekdays: [0, 2, 4] },
  { name: '۴ روزه', schedule: ['سینه', 'پا', 'پشت', 'شانه + بازو'], weekdays: [0, 1, 3, 4] },
  { name: '۵ روزه', schedule: ['سینه', 'پشت', 'پا', 'شانه', 'بازو + شکم'], weekdays: [0, 1, 2, 4, 5] },
]

export default function ClubPage() {
  const [tab, setTab] = useState<'calendar' | 'metrics' | 'photos'>('calendar')
  const workouts = useLiveQuery(() => db.workoutDays.orderBy('date').reverse().toArray(), [], [] as WorkoutDay[])
  const metrics = useLiveQuery(() => db.bodyMetrics.orderBy('date').reverse().toArray(), [], [] as BodyMetric[])

  const clubExportData = workouts.map((w) => ({
    تاریخ: w.date,
    تمرین: w.title,
    'مدت (دقیقه)': w.duration,
    یادداشت: w.note ?? '',
    وزن: metrics.find((m) => m.date === w.date)?.weight ?? '',
  }))

  return (
    <div className="b-view max-w-5xl mx-auto">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
        <div>
          <h1 className="text-[21px] font-bold tracking-tight">🏋️ باشگاه</h1>
          <p className="text-[13px] text-muted mt-0.5">تمرین، پیشرفت بدن و عکس‌های قبل و بعد</p>
        </div>
        {workouts.length > 0 && (
          <ExportMenu
            elementId="club-export"
            filename={`club-${todayJalali()}`}
            sheetName="Workouts"
            data={clubExportData}
          />
        )}
      </div>

      <div id="club-export">
      <div className="flex gap-1 border-b border-line mb-5">
        {([
          ['calendar', 'تقویم تمرین'],
          ['metrics', 'وزن و قد'],
          ['photos', 'عکس پیشرفت'],
        ] as const).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`px-4 py-2 text-[13px] border-b-2 -mb-px transition-colors ${
              tab === k
                ? 'border-[color:var(--b-accent)] text-[color:var(--b-accent)] font-semibold'
                : 'border-transparent text-muted hover:text-ink'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'calendar' && <WorkoutCalendar />}
      {tab === 'metrics' && <MetricsPanel />}
      {tab === 'photos' && <PhotosPanel />}
      </div>
    </div>
  )
}

/* ============================================================
   برنامه تمرینی هفتگی + تمرین امروز
   ============================================================ */
function WorkoutPlanSection({ plan }: { plan?: WorkoutPlan }) {
  const [open, setOpen] = useState(false)
  const [presetIdx, setPresetIdx] = useState(0)
  const [schedule, setSchedule] = useState<string[]>([...PLAN_PRESETS[0]!.schedule])
  const [weekdays, setWeekdays] = useState<number[]>([...PLAN_PRESETS[0]!.weekdays])

  function loadPreset(i: number) {
    setPresetIdx(i)
    setSchedule([...PLAN_PRESETS[i]!.schedule])
    setWeekdays([...PLAN_PRESETS[i]!.weekdays])
  }

  function startEdit() {
    if (plan) {
      setSchedule([...plan.schedule])
      setWeekdays([...plan.weekdays])
      setPresetIdx(-1)
    }
    setOpen(true)
  }

  async function save() {
    const titles = schedule.map((s) => s.trim()).filter(Boolean)
    if (titles.length === 0 || weekdays.length === 0) return
    const days = weekdays.slice(0, titles.length)
    while (days.length < titles.length) days.push((days[days.length - 1]! + 2) % 7)
    await db.workoutPlans.clear()
    await db.workoutPlans.add({
      daysPerWeek: titles.length,
      schedule: titles,
      weekdays: days,
      startDate: todayJalali(),
      createdAt: Date.now(),
    })
    setOpen(false)
  }

  async function remove() {
    if (!window.confirm('برنامه تمرینی حذف بشه؟ (سوابق تمرین باقی می‌مونه)')) return
    await db.workoutPlans.clear()
  }

  function toggleWeekday(wd: number, rowIdx: number) {
    setWeekdays((prev) => {
      const next = [...prev]
      next[rowIdx] = wd
      return next
    })
  }

  if (!open) {
    if (!plan) {
      return (
        <button className="btn btn-primary w-full" onClick={() => setOpen(true)}>
          ＋ ساخت برنامه تمرینی هفتگی
        </button>
      )
    }
    return (
      <div className="card p-4">
        <div className="flex items-center justify-between mb-2.5">
          <b className="text-[14px]">📋 برنامه {faDigits(plan.daysPerWeek)} روزه</b>
          <div className="flex gap-1.5">
            <button className="btn btn-ghost !py-1 !px-2.5 text-[12px]" onClick={startEdit}>ویرایش</button>
            <button className="btn btn-ghost !py-1 !px-2.5 text-[12px]" onClick={remove}>حذف</button>
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          {plan.schedule.map((title, i) => (
            <div key={i} className="flex items-center gap-2.5 bg-surface-2 border border-line rounded-lg px-3 py-2">
              <span className="chip chip-accent">{FA_WEEKDAYS[plan.weekdays[i] ?? 0]}</span>
              <span className="text-[13px] font-medium">{title}</span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="card p-4 b-pop">
      <div className="flex items-center justify-between mb-3">
        <b className="text-[14px]">📋 برنامه تمرینی هفتگی</b>
        <button type="button" className="btn btn-ghost !px-2 !py-1 text-[12px]" onClick={() => setOpen(false)}>✕</button>
      </div>
      <div className="text-[12px] text-muted mb-2">قالب آماده:</div>
      <div className="flex flex-wrap gap-1.5 mb-3">
        {PLAN_PRESETS.map((p, i) => (
          <button
            key={p.name}
            type="button"
            className={`btn !py-1.5 text-[12px] ${presetIdx === i ? 'btn-primary' : ''}`}
            onClick={() => loadPreset(i)}
          >
            {p.name}
          </button>
        ))}
      </div>
      <div className="flex flex-col gap-2 mb-3">
        {schedule.map((title, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              className="field flex-1"
              value={title}
              onChange={(e) => {
                const next = [...schedule]
                next[i] = e.target.value
                setSchedule(next)
              }}
              placeholder={`تمرین روز ${faDigits(i + 1)}`}
            />
            <select
              className="field !w-28"
              value={weekdays[i] ?? 0}
              onChange={(e) => toggleWeekday(Number(e.target.value), i)}
            >
              {FA_WEEKDAYS.map((d, w) => (
                <option key={w} value={w}>{d}</option>
              ))}
            </select>
            <button
              type="button"
              className="btn btn-ghost !py-1 !px-2 text-[12px]"
              onClick={() => {
                setSchedule(schedule.filter((_, j) => j !== i))
                setWeekdays(weekdays.filter((_, j) => j !== i))
              }}
              title="حذف این روز"
            >
              ×
            </button>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          className="btn flex-1"
          onClick={() => {
            setSchedule([...schedule, ''])
            setWeekdays([...weekdays, (Math.max(...weekdays, -1) + 2) % 7])
          }}
        >
          ＋ افزودن روز
        </button>
        <button type="button" className="btn btn-primary flex-1" onClick={save}>
          ذخیره برنامه
        </button>
      </div>
    </div>
  )
}

/** کارت تمرین امروز — فقط تأیید کن */
function TodaySession({ plan, today, hasLog }: { plan?: WorkoutPlan; today: string; hasLog: boolean }) {
  const [duration, setDuration] = useState('60')
  if (!plan) return null
  const idx = plan.weekdays.indexOf(weekdayIndex(today))
  if (idx < 0) return null
  const title = plan.schedule[idx] ?? 'تمرین'
  if (hasLog) {
    return (
      <div className="card p-3.5 flex items-center gap-2.5" style={{ borderColor: 'var(--b-accent)' }}>
        <span className="text-[18px]">✅</span>
        <div className="text-[13px]">
          تمرین امروز ({title}) ثبت شد — آفرین!
        </div>
      </div>
    )
  }
  return (
    <div className="card p-4" style={{ borderColor: 'var(--b-accent)' }}>
      <div className="flex flex-wrap items-center gap-2.5">
        <span className="text-[20px]">💪</span>
        <div className="flex-1 min-w-[140px]">
          <div className="text-[11.5px] text-muted">تمرین امروز ({FA_WEEKDAYS[weekdayIndex(today)]})</div>
          <b className="text-[14.5px]">{title}</b>
        </div>
        <NumberInput
          className="field !w-20 !py-1.5"
          value={duration}
          onChange={(n) => setDuration(String(n))}
          title="مدت (دقیقه)"
        />
        <span className="text-[11px] text-muted">دقیقه</span>
        <button
          className="btn btn-primary"
          onClick={() =>
            db.workoutDays.add({
              date: today,
              title,
              duration: Number(duration) || 60,
              note: 'از برنامه هفتگی',
              createdAt: Date.now(),
            })
          }
        >
          ✓ رفتم و انجام شد
        </button>
      </div>
    </div>
  )
}

/* ============================================================
   تقویم تمرین — تیک روزهایی که رفتی باشگاه
   ============================================================ */
function WorkoutCalendar() {
  const [cursor, setCursor] = useState(todayJalali())
  const [formOpen, setFormOpen] = useState(false)
  const [date, setDate] = useState(todayJalali())
  const [title, setTitle] = useState('')
  const [duration, setDuration] = useState('60')
  const [note, setNote] = useState('')

  const workouts = useLiveQuery(
    () => db.workoutDays.where('date').between(startOfMonth(cursor), endOfMonth(cursor)).toArray(),
    [cursor],
    [] as WorkoutDay[],
  )
  const plans = useLiveQuery(() => db.workoutPlans.toArray(), [], [] as WorkoutPlan[])
  const plan = plans && plans.length > 0 ? [...plans].sort((a, b) => (b.id ?? 0) - (a.id ?? 0))[0] : undefined
  const today = todayJalali()
  const days = monthDays(cursor)
  const [jy, jm] = cursor.split('-').map(Number)

  const workoutDates = new Set((workouts ?? []).map((w) => w.date))
  const totalThisMonth = workouts?.length ?? 0
  const minutesThisMonth = (workouts ?? []).reduce((s, w) => s + (w.duration || 0), 0)

  /** عنوان پیش‌فرض یک روز از روی برنامه هفتگی (اگر آن روز، روز تمرین باشد) */
  function plannedTitle(d: string): string {
    if (!plan) return 'تمرین'
    const i = plan.weekdays.indexOf(weekdayIndex(d))
    return i >= 0 ? (plan.schedule[i] ?? 'تمرین') : 'تمرین'
  }

  async function toggleDay(d: string) {
    const existing = (workouts ?? []).find((w) => w.date === d)
    if (existing?.id) {
      await db.workoutDays.delete(existing.id)
    } else {
      await db.workoutDays.add({
        date: d,
        title: plannedTitle(d),
        duration: 60,
        note: plan && plan.weekdays.includes(weekdayIndex(d)) ? 'از برنامه هفتگی' : undefined,
        createdAt: Date.now(),
      })
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!isValidJalali(date)) {
      window.alert('تاریخ معتبر نیست — از تقویم انتخاب کن.')
      return
    }
    const existing = (workouts ?? []).find((w) => w.date === date)
    const dur = Number(duration) || 60
    if (existing?.id) {
      await db.workoutDays.update(existing.id, { title: title.trim() || 'تمرین', duration: dur, note: note.trim() || undefined })
    } else {
      await db.workoutDays.add({ date, title: title.trim() || 'تمرین', duration: dur, note: note.trim() || undefined, createdAt: Date.now() })
    }
    setTitle(''); setNote(''); setDuration('60'); setFormOpen(false)
  }

  return (
    <div className="space-y-4">
      <WorkoutPlanSection plan={plan} />
      <TodaySession plan={plan} today={today} hasLog={workoutDates.has(today)} />
      {/* آمار ماه */}
      <div className="grid grid-cols-3 gap-3">
        <div className="card p-3.5 text-center">
          <div className="text-[11.5px] text-muted">روزهای تمرین این ماه</div>
          <div className="text-[19px] font-bold mt-0.5" style={{ color: 'var(--b-accent)' }}>{faDigits(totalThisMonth)}</div>
        </div>
        <div className="card p-3.5 text-center">
          <div className="text-[11.5px] text-muted">مجموع دقیقه</div>
          <div className="text-[19px] font-bold mt-0.5">{faDigits(minutesThisMonth)}</div>
        </div>
        <div className="card p-3.5 text-center">
          <div className="text-[11.5px] text-muted">میانگین هر جلسه</div>
          <div className="text-[19px] font-bold mt-0.5">{faDigits(totalThisMonth ? Math.round(minutesThisMonth / totalThisMonth) : 0)} دقیقه</div>
        </div>
      </div>

      {/* تقویم */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-line">
          <button className="btn btn-ghost !py-1 !px-2.5 text-[12px]" onClick={() => setCursor(addMonths(cursor, -1))}>
            ‹ ماه قبل
          </button>
          <div className="text-[14px] font-semibold">{FA_MONTHS[jm! - 1]} {faDigits(jy!)}</div>
          <button className="btn btn-ghost !py-1 !px-2.5 text-[12px]" onClick={() => setCursor(addMonths(cursor, 1))}>
            ماه بعد ›
          </button>
        </div>
        <div className="grid grid-cols-7 border-b border-line bg-surface-2">
          {['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'].map((d) => (
            <div key={d} className="py-1.5 text-center text-[11.5px] text-muted font-semibold">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {Array.from({ length: leadingBlanks(cursor) }).map((_, i) => (
            <div key={`e${i}`} className="min-h-[72px] border-b border-e border-line bg-surface-2/40" />
          ))}
          {days.map((d) => {
            const isToday = d === today
            const isFuture = d > today
            const hasWorkout = workoutDates.has(d)
            const wk = (workouts ?? []).find((w) => w.date === d)
            const planned = plannedTitle(d)
            const isPlanDay = plan != null && plan.weekdays.includes(weekdayIndex(d))
            return (
              <button
                key={d}
                onClick={() => !isFuture && toggleDay(d)}
                disabled={isFuture}
                className={`min-h-[72px] border-b border-e border-line p-1.5 text-start transition-colors relative ${
                  hasWorkout ? 'bg-[color:var(--b-accent-soft)]' : isToday ? 'bg-surface-2' : 'hover:bg-surface-2'
                } ${isFuture ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
              >
                <span
                  className={`text-[12px] ${isToday ? 'font-bold' : 'text-muted'}`}
                  style={isToday ? { color: 'var(--b-accent)' } : undefined}
                >
                  {faDigits(Number(d.split('-')[2]))}
                </span>
                {hasWorkout ? (
                  <div className="mt-1">
                    <div className="w-2 h-2 rounded-full mx-auto" style={{ background: 'var(--b-accent)' }} />
                    {wk && wk.title !== 'تمرین' && (
                      <div className="text-[9.5px] text-center text-muted truncate mt-0.5">{wk.title}</div>
                    )}
                  </div>
                ) : (
                  isPlanDay && !isFuture && (
                    <div className="text-[9.5px] text-center truncate mt-1" style={{ color: 'var(--b-accent)' }}>
                      {planned}
                    </div>
                  )
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* لیست تمرین‌های ماه */}
      {(workouts ?? []).length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-4 py-2.5 border-b border-line">
            <b className="text-[13.5px]">تمرین‌های {FA_MONTHS[jm! - 1]}</b>
          </div>
          {[...workouts!]
            .sort((a, b) => (a.date < b.date ? 1 : -1))
            .map((w) => (
              <div key={w.id} className="flex items-center gap-3 px-4 py-2.5 border-b border-line last:border-0">
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ background: 'var(--b-accent)' }}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-medium truncate">{w.title}</div>
                  {w.note && <div className="text-[11px] text-faint truncate">{w.note}</div>}
                </div>
                <span className="text-[11.5px] text-muted tabular-nums">{formatJalaliShort(w.date)}</span>
                <Chip tone="accent">{faDigits(w.duration)} دقیقه</Chip>
                <button
                  className="text-faint hover:text-[color:var(--b-red)] text-[12px]"
                  onClick={() => w.id && db.workoutDays.delete(w.id)}
                >
                  🗑
                </button>
              </div>
            ))}
        </div>
      )}

      {/* فرم ثبت تمرین */}
      {!formOpen ? (
        <button className="btn btn-primary w-full" onClick={() => { setDate(today); setFormOpen(true) }}>
          ＋ ثبت تمرین جدید
        </button>
      ) : (
        <form onSubmit={submit} className="card p-4 b-pop">
          <div className="flex items-center justify-between mb-3">
            <b className="text-[14px]">ثبت تمرین</b>
            <button type="button" className="btn btn-ghost !px-2 !py-1 text-[12px]" onClick={() => setFormOpen(false)}>✕</button>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="تاریخ">
              <DatePicker value={date} onChange={setDate} />
            </Field>
            <Field label="عنوان تمرین">
              <TextInput value={title} onChange={(e) => setTitle(e.target.value)} placeholder="مثلاً سینه، پا، شنا…" />
            </Field>
            <Field label="مدت (دقیقه)">
              <TextInput type="number" inputMode="numeric" dir="ltr" value={duration} onChange={(e) => setDuration(e.target.value)} />
            </Field>
            <Field label="توضیح (اختیاری)">
              <TextInput value={note} onChange={(e) => setNote(e.target.value)} placeholder="جزئیات تمرین…" />
            </Field>
          </div>
          <div className="flex justify-end gap-2 mt-3">
            <button type="button" className="btn" onClick={() => setFormOpen(false)}>لغو</button>
            <button type="submit" className="btn btn-primary">ثبت</button>
          </div>
        </form>
      )}
    </div>
  )
}

/* ============================================================
   وزن و قد — ثبت و نمودار پیشرفت
   ============================================================ */
function MetricsPanel() {
  const [date, setDate] = useState(todayJalali())
  const [weight, setWeight] = useState('')
  const [height, setHeight] = useState('')
  const [waist, setWaist] = useState('')
  const [arm, setArm] = useState('')
  const [thigh, setThigh] = useState('')
  const [bodyFat, setBodyFat] = useState('')
  const [note, setNote] = useState('')

  const metrics = useLiveQuery(() => db.bodyMetrics.orderBy('date').reverse().toArray(), [], [] as BodyMetric[])
  const recent = metrics?.slice(0, 30) ?? []

  const latest = metrics?.[0]
  const prev = metrics?.[1]
  const weightDelta = latest?.weight && prev?.weight ? latest.weight - prev.weight : null
  const waistDelta = latest?.waist && prev?.waist ? latest.waist - prev.waist : null

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!isValidJalali(date)) {
      window.alert('تاریخ معتبر نیست — از تقویم انتخاب کن.')
      return
    }
    const existing = metrics?.find((m) => m.date === date)
    const data: Omit<BodyMetric, 'id'> = {
      date,
      weight: weight ? Number(weight) : undefined,
      height: height ? Number(height) : undefined,
      waist: waist ? Number(waist) : undefined,
      arm: arm ? Number(arm) : undefined,
      thigh: thigh ? Number(thigh) : undefined,
      bodyFat: bodyFat ? Number(bodyFat) : undefined,
      note: note.trim() || undefined,
      createdAt: Date.now(),
    }
    if (existing?.id) await db.bodyMetrics.update(existing.id, data)
    else await db.bodyMetrics.add(data)
    setWeight(''); setHeight(''); setWaist(''); setArm(''); setThigh(''); setBodyFat(''); setNote('')
  }

  return (
    <div className="space-y-4">
      {/* آخرین اندازه‌گیری */}
      {latest && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <MetricCard label="وزن" value={latest.weight} unit="کیلو" delta={weightDelta} />
          <MetricCard label="قد" value={latest.height} unit="سانتی‌متر" />
          <MetricCard label="دور شکم" value={latest.waist} unit="سانتی‌متر" delta={waistDelta} />
          <MetricCard label="درصد چربی" value={latest.bodyFat} unit="٪" />
        </div>
      )}

      {/* فرم ثبت */}
      <form onSubmit={submit} className="card p-4">
        <b className="text-[14px] block mb-3">📏 ثبت اندازه‌گیری جدید</b>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <Field label="تاریخ">
            <DatePicker value={date} onChange={setDate} />
          </Field>
          <Field label="وزن (کیلو)">
            <NumberInput decimal value={weight} onChange={(n) => setWeight(String(n))} placeholder="75.5" />
          </Field>
          <Field label="قد (سانتی‌متر)">
            <NumberInput value={height} onChange={(n) => setHeight(String(n))} placeholder="175" />
          </Field>
          <Field label="دور شکم (سانتی‌متر)">
            <NumberInput decimal value={waist} onChange={(n) => setWaist(String(n))} placeholder="85" />
          </Field>
          <Field label="دور بازو (سانتی‌متر)">
            <NumberInput decimal value={arm} onChange={(n) => setArm(String(n))} placeholder="32" />
          </Field>
          <Field label="دور ران (سانتی‌متر)">
            <NumberInput decimal value={thigh} onChange={(n) => setThigh(String(n))} placeholder="55" />
          </Field>
          <Field label="درصد چربی (اختیاری)">
            <NumberInput decimal value={bodyFat} onChange={(n) => setBodyFat(String(n))} placeholder="18" />
          </Field>
          <Field label="یادداشت">
            <TextInput value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
        </div>
        <div className="flex justify-end mt-3">
          <button type="submit" className="btn btn-primary">ثبت اندازه‌گیری</button>
        </div>
      </form>

      {/* تاریخچه */}
      {recent.length > 0 ? (
        <div className="card overflow-hidden">
          <div className="px-4 py-2.5 border-b border-line">
            <b className="text-[13.5px]">تاریخچه اندازه‌گیری</b>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="bg-surface-2 border-b border-line text-[11px] text-faint">
                  <th className="text-start font-semibold px-3 py-2.5">تاریخ</th>
                  <th className="text-center font-semibold px-2 py-2.5">وزن</th>
                  <th className="text-center font-semibold px-2 py-2.5">قد</th>
                  <th className="text-center font-semibold px-2 py-2.5">شکم</th>
                  <th className="text-center font-semibold px-2 py-2.5">بازو</th>
                  <th className="text-center font-semibold px-2 py-2.5">ران</th>
                  <th className="text-center font-semibold px-2 py-2.5">چربی</th>
                  <th className="w-10"></th>
                </tr>
              </thead>
              <tbody>
                {recent.map((m) => (
                  <tr key={m.id} className="border-b border-line last:border-0 hover:bg-surface-2">
                    <td className="px-3 py-2 text-muted tabular-nums">{formatJalaliShort(m.date)}</td>
                    <td className="px-2 py-2 text-center tabular-nums">{m.weight ? faDigits(m.weight) : '—'}</td>
                    <td className="px-2 py-2 text-center tabular-nums">{m.height ? faDigits(m.height) : '—'}</td>
                    <td className="px-2 py-2 text-center tabular-nums">{m.waist ? faDigits(m.waist) : '—'}</td>
                    <td className="px-2 py-2 text-center tabular-nums">{m.arm ? faDigits(m.arm) : '—'}</td>
                    <td className="px-2 py-2 text-center tabular-nums">{m.thigh ? faDigits(m.thigh) : '—'}</td>
                    <td className="px-2 py-2 text-center tabular-nums">{m.bodyFat ? faDigits(m.bodyFat) : '—'}</td>
                    <td className="px-2 py-2 text-center">
                      <button className="text-faint hover:text-[color:var(--b-red)]" onClick={() => m.id && db.bodyMetrics.delete(m.id)}>🗑</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <EmptyState icon="📏" title="هنوز اندازه‌گیری‌ای ثبت نشده" hint="از فرم بالا اولین وزن و قدت رو ثبت کن" />
      )}
    </div>
  )
}

function MetricCard({ label, value, unit, delta }: { label: string; value?: number; unit: string; delta?: number | null }) {
  return (
    <div className="card p-3.5 text-center">
      <div className="text-[11.5px] text-muted">{label}</div>
      <div className="text-[19px] font-bold mt-0.5 tabular-nums" dir="ltr">
        {value != null ? faDigits(value) : '—'}
        <span className="text-[11px] text-faint font-normal"> {unit}</span>
      </div>
      {delta != null && Math.abs(delta) > 0.01 && (
        <div className="text-[10.5px] mt-0.5" style={{ color: delta < 0 ? 'var(--b-green)' : 'var(--b-red)' }}>
          {delta < 0 ? '▼' : '▲'} {faDigits(Math.abs(delta))} {unit} نسبت به قبلی
        </div>
      )}
    </div>
  )
}

/* ============================================================
   عکس پیشرفت — قبل/حین/بعد با دسته‌بندی زاویه
   ============================================================ */
function PhotosPanel() {
  const [pose, setPose] = useState<'front' | 'side' | 'back'>('front')
  const [date, setDate] = useState(todayJalali())
  const [caption, setCaption] = useState('')
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const photos = useLiveQuery(() => db.progressPhotos.orderBy('date').reverse().toArray(), [], [] as ProgressPhoto[])
  const filtered = (photos ?? []).filter((p) => p.pose === pose)

  const poseLabel = (p: string) => (p === 'front' ? 'جلو' : p === 'side' ? 'کنار' : 'پشت')

  async function onFiles(files: FileList | null) {
    if (!files?.length) return
    if (!isValidJalali(date)) {
      window.alert('تاریخ معتبر نیست — از تقویم انتخاب کن.')
      return
    }
    setBusy(true)
    try {
      for (const f of Array.from(files)) {
        if (!f.type.startsWith('image/')) continue
        const dataUrl = await compressImage(f, 1000, 0.7)
        await db.progressPhotos.add({ date, pose, dataUrl, caption: caption.trim() || undefined, createdAt: Date.now() })
      }
      setCaption('')
    } finally {
      setBusy(false)
    }
  }

  async function remove(id?: number) {
    if (!id) return
    if (!window.confirm('این عکس حذف بشه؟')) return
    await db.progressPhotos.delete(id)
  }

  return (
    <div className="space-y-4">
      <div className="card p-3.5">
        <div className="flex flex-wrap items-end gap-2.5">
          <div>
            <span className="text-[11px] text-muted block mb-1">زاویه عکس</span>
            <div className="flex gap-1.5">
              {(['front', 'side', 'back'] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  className={`btn !py-1.5 text-[12px] ${pose === p ? 'btn-primary' : ''}`}
                  onClick={() => setPose(p)}
                >
                  {poseLabel(p)}
                </button>
              ))}
            </div>
          </div>
          <div>
            <span className="text-[11px] text-muted block mb-1">تاریخ عکس</span>
            <DatePicker value={date} onChange={setDate} />
          </div>
          <Field label="توضیح (اختیاری)">
            <TextInput value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="مثلاً ۳ ماه بعد…" className="flex-1 min-w-[180px]" />
          </Field>
          <button className="btn btn-primary" onClick={() => fileRef.current?.click()} disabled={busy}>
            📷 {busy ? 'در حال ثبت…' : 'افزودن عکس'}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => { onFiles(e.target.files); e.target.value = '' }}
          />
        </div>
        <p className="text-[11px] text-faint mt-2">
          💡 هر چند وقت یک بار عکس بذار و پیشرفتت رو ببین — عکس‌ها به‌صورت محلی روی دستگاه ذخیره می‌شن.
        </p>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon="📸" title={`عکس ${poseLabel(pose)} ثبت نشده`} hint="از دکمه بالا اولین عکست رو اضافه کن" />
      ) : (
        <div className="space-y-5">
          {filtered.map((p) => (
            <div key={p.id} className="card overflow-hidden">
              <div className="flex items-center gap-3 px-4 py-3 border-b border-line bg-surface-2">
                <b className="text-[13.5px]">{formatJalali(p.date)}</b>
                {p.caption && <span className="text-[12px] text-muted">{p.caption}</span>}
                <span className="ms-auto text-[10.5px] text-faint">{humanSize(dataUrlKB(p.dataUrl))}</span>
                <button className="text-faint hover:text-[color:var(--b-red)] text-[13px]" onClick={() => remove(p.id)}>🗑</button>
              </div>
              <img src={p.dataUrl} alt={p.caption || poseLabel(pose)} className="w-full max-h-[480px] object-contain bg-surface-2" />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ---------- کمکی ---------- */
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
