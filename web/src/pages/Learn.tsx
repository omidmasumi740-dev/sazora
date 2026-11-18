import { Component, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Habit, type HabitLog } from '../db/schema'
import { todayJalali, addDays, addMonths, startOfMonth, endOfMonth, last7Days, formatJalaliShort, FA_MONTHS } from '../lib/jalali'
import { faDigits } from '../lib/format'
import { Chip, EmptyState, Bar, Field, TextInput, Panel, NumberInput, ExportMenu } from '../ui/components'
import ReadingPage from './Reading'

const COLORS = ['#2563eb', '#059669', '#d97706', '#dc2626', '#7c3aed', '#0891b2']

/** مرز خطا — اگر بخشی از صفحه خطا داد، کل صفحه سفید نمی‌شود */
class SafeSection extends Component<{ children: ReactNode; name: string }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch(err: unknown) {
    console.error(`learn/${this.props.name} failed:`, err)
  }
  render() {
    if (this.state.failed)
      return <div className="card p-4 text-[12.5px] text-muted">⚠️ بخش «{this.props.name}» خطا داد — بقیه صفحه سالم است.</div>
    return this.props.children
  }
}

export default function LearnPage() {
  const { t } = useTranslation()
  const [formOpen, setFormOpen] = useState(false)
  const [tab, setTab] = useState<'focus' | 'reading'>('reading')

  const habits = useLiveQuery(() => db.habits.orderBy('createdAt').toArray(), [], [] as Habit[])
  const logs = useLiveQuery(() => db.habitLogs.toArray(), [], [] as HabitLog[])

  const totalToday = habits.filter((h) => isDoneToday(h, logs)).length

  const learnExportData = habits.map((h) => {
    const hLogs = logs.filter((l) => l.habitId === h.id)
    const total = hLogs.reduce((s, l) => s + l.amount, 0)
    return {
      عادت: h.title,
      'هدف روزانه': h.dailyGoal,
      واحد: h.unit === 'min' ? 'دقیقه' : 'تعداد',
      'کل ثبت‌شده': total,
      'تعداد روزها': hLogs.length,
    }
  })

  return (
    <div className="b-view max-w-6xl mx-auto">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
        <div>
          <h1 className="text-[21px] font-bold tracking-tight">{t('learn.title')}</h1>
          <p className="text-[13px] text-muted mt-0.5">
            {tab === 'reading'
              ? t('reading.subtitle')
              : totalToday > 0
                ? `امروز ${faDigits(totalToday)} از ${faDigits(habits.length)} تا انجام شد ✅`
                : t('learn.subtitle')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {tab === 'focus' && habits.length > 0 && (
            <ExportMenu
              elementId="learn-export"
              filename={`learn-${todayJalali()}`}
              sheetName="Habits"
              data={learnExportData}
            />
          )}
          {tab === 'focus' && !formOpen && (
            <button className="btn btn-primary" onClick={() => setFormOpen(true)}>
              + {t('learn.newHabit')}
            </button>
          )}
        </div>
      </div>

      {/* تب‌ها: تمرکز و عادت‌ها / کتاب‌خوانی — بزرگ و مشخص */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-5 max-w-2xl">
        <button
          className={`flex items-center justify-center gap-2.5 rounded-2xl px-6 py-4 text-[16px] font-extrabold transition-all border-2 ${
            tab === 'focus'
              ? 'btn-primary border-transparent shadow-lg scale-[1.01]'
              : 'bg-surface-2 border-line text-muted hover:text-ink hover:border-[color:var(--b-accent)]'
          }`}
          onClick={() => setTab('focus')}
        >
          <span className="text-[22px] leading-none">⏱️</span>
          {t('learn.tabFocus')}
        </button>
        <button
          className={`flex items-center justify-center gap-2.5 rounded-2xl px-6 py-4 text-[16px] font-extrabold transition-all border-2 ${
            tab === 'reading'
              ? 'btn-primary border-transparent shadow-lg scale-[1.01]'
              : 'bg-surface-2 border-line text-muted hover:text-ink hover:border-[color:var(--b-accent)]'
          }`}
          onClick={() => setTab('reading')}
        >
          <span className="text-[22px] leading-none">📚</span>
          {t('reading.title')}
        </button>
      </div>

      {tab === 'reading' ? (
        <SafeSection name="کتاب‌خوانی">
          <ReadingPage />
        </SafeSection>
      ) : (
        <>
          {formOpen && <HabitForm onDone={() => setFormOpen(false)} />}
          <div id="learn-export">
            <SafeSection name="تایمر تمرکز">
              <FocusTimer />
            </SafeSection>

            {habits.length === 0 && !formOpen ? (
              <EmptyState icon="📚" title={t('learn.noHabits')} hint={t('learn.noHabitsHint')} />
            ) : (
              <div className="grid lg:grid-cols-2 gap-4">
                {habits.map((h) => (
                  <SafeSection key={h.id} name="عادت">
                    <HabitCard habit={h} logs={logs.filter((l) => l.habitId === h.id)} />
                  </SafeSection>
                ))}
              </div>
            )}

            {habits.length > 0 && (
              <div className="mt-4">
                <SafeSection name="گزارش پیشرفت">
                  <PeriodReport habits={habits} logs={logs} />
                </SafeSection>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

/* ==================== helpers ==================== */

function isDoneToday(habit: Habit, logs: HabitLog[]): boolean {
  const t = todayJalali()
  const sum = logs.filter((l) => l.date === t).reduce((s, l) => s + l.amount, 0)
  return sum >= habit.dailyGoal
}

function streakOf(habit: Habit, logs: HabitLog[]): number {
  // consecutive days (ending today or yesterday) where daily goal met
  let streak = 0
  const t = todayJalali()
  // check today first
  for (let i = 0; i < 400; i++) {
    const d = addDays(t, -i)
    const sum = logs.filter((l) => l.date === d).reduce((s, l) => s + l.amount, 0)
    if (sum >= habit.dailyGoal) streak++
    else if (i === 0) continue // today not done yet, keep looking back
    else break
  }
  return streak
}

function sumOn(habit: Habit, logs: HabitLog[], date: string): number {
  return logs.filter((l) => l.date === date).reduce((s, l) => s + l.amount, 0)
}

/* ==================== habit card ==================== */

function HabitCard({ habit, logs }: { habit: Habit; logs: HabitLog[] }) {
  const { t } = useTranslation()
  const [editing, setEditing] = useState(false)
  const week = last7Days()
  const today = todayJalali()
  const todaySum = sumOn(habit, logs, today)
  const doneToday = todaySum >= habit.dailyGoal
  const streak = streakOf(habit, logs)
  const weekSum = week.reduce((s, d) => s + sumOn(habit, logs, d), 0)
  const weekPct = habit.dailyGoal > 0 ? Math.min(100, Math.round((weekSum / (habit.dailyGoal * 7)) * 100)) : 0

  async function addToday(amount: number) {
    if (!habit.id) return
    const existing = await db.habitLogs.where('[habitId+date]').equals([habit.id, today]).first()
    if (existing?.id) {
      const nv = Math.max(0, existing.amount + amount)
      if (nv === 0) await db.habitLogs.delete(existing.id)
      else await db.habitLogs.update(existing.id, { amount: nv })
    } else if (amount > 0) {
      await db.habitLogs.add({ habitId: habit.id, date: today, amount, createdAt: Date.now() })
    }
  }

  async function removeHabit() {
    if (!habit.id) return
    if (!window.confirm(t('projects.deleteConfirm'))) return
    await db.habitLogs.where('habitId').equals(habit.id).delete()
    await db.habits.delete(habit.id)
  }

  if (editing) return <HabitForm initial={habit} onDone={() => setEditing(false)} />

  return (
    <div className="card p-4">
      <div className="flex items-start gap-3">
        <div
          className="w-10 h-10 rounded-xl grid place-items-center text-[19px] shrink-0 border"
          style={{ background: `${habit.color}18`, borderColor: `${habit.color}44` }}
        >
          {habit.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <b className="text-[14.5px]">{habit.title}</b>
            {doneToday && <Chip tone="success">✓</Chip>}
          </div>
          <div className="text-[11.5px] text-muted mt-0.5">
            🔥 {t('learn.streak')}: <b>{faDigits(streak)}</b> روز ·{' '}
            {t('learn.weekly')}: {faDigits(weekSum)}/{faDigits(habit.dailyGoal * 7)}
            {habit.unit === 'min' ? ' دقیقه' : ''}
          </div>
        </div>
        <div className="flex gap-1">
          <button className="btn btn-ghost !py-0.5 !px-2 text-[11.5px]" onClick={() => setEditing(true)}>
            ✏️
          </button>
          <button className="btn btn-ghost !py-0.5 !px-2 text-[11.5px]" onClick={removeHabit}>
            🗑
          </button>
        </div>
      </div>

      <Bar value={weekPct} className="mt-3" />

      {/* هفت روز اخیر */}
      <div className="flex items-center justify-between mt-3 gap-1">
        {week.map((d) => {
          const s = sumOn(habit, logs, d)
          const ok = s >= habit.dailyGoal
          return (
            <div key={d} className="flex flex-col items-center gap-1 flex-1">
              <div
                className="w-full h-9 rounded-lg border flex items-center justify-center text-[10px] tabular-nums"
                style={{
                  background: ok ? habit.color : s > 0 ? `${habit.color}33` : 'var(--b-surface-2)',
                  color: ok ? '#fff' : 'var(--b-muted)',
                  borderColor: d === today ? 'var(--b-accent)' : 'var(--b-line)',
                }}
              >
                {s > 0 ? faDigits(s) : ''}
              </div>
              <span className="text-[9.5px] text-faint">{formatJalaliShort(d).split(' ')[0]}</span>
            </div>
          )
        })}
      </div>

      {/* دکمه‌های سریع امروز */}
      <div className="flex items-center gap-2 mt-3">
        <button className="btn !py-1.5 text-[12.5px] flex-1" onClick={() => addToday(habit.unit === 'min' ? 15 : 1)}>
          +{habit.unit === 'min' ? '۱۵' : '۱'}
        </button>
        <button className="btn !py-1.5 text-[12.5px] flex-1" onClick={() => addToday(habit.unit === 'min' ? 30 : 1)}>
          +{habit.unit === 'min' ? '۳۰' : '۱'}
        </button>
        <button className="btn !py-1.5 text-[12.5px] flex-1" onClick={() => addToday(habit.dailyGoal)}>
          {t('learn.doneToday')}
        </button>
        <button
          className="btn !py-1.5 text-[12.5px] flex-1"
          onClick={() => addToday(-habit.dailyGoal)}
          disabled={!doneToday}
        >
          −
        </button>
      </div>
    </div>
  )
}

/* ==================== focus timer (pomodoro) ==================== */

/** بیپ کوتاه پایان تایمر */
function beep() {
  try {
    const rate = 8000
    const dur = 0.45
    const freq = 880
    const n = Math.floor(rate * dur)
    const buf = new ArrayBuffer(44 + n)
    const v = new DataView(buf)
    const writeStr = (off: number, s: string) => {
      for (let i = 0; i < s.length; i++) v.setUint8(off + i, s.charCodeAt(i))
    }
    writeStr(0, 'RIFF')
    v.setUint32(4, 36 + n, true)
    writeStr(8, 'WAVE')
    writeStr(12, 'fmt ')
    v.setUint32(16, 16, true)
    v.setUint16(20, 1, true)
    v.setUint16(22, 1, true)
    v.setUint32(24, rate, true)
    v.setUint32(28, rate, true)
    v.setUint16(32, 1, true)
    v.setUint16(34, 8, true)
    writeStr(36, 'data')
    v.setUint32(40, n, true)
    for (let i = 0; i < n; i++) {
      const s = Math.sin((2 * Math.PI * freq * i) / rate) * 100 + 128
      v.setUint8(44 + i, Math.max(0, Math.min(255, Math.round(s))))
    }
    const blob = new Blob([buf], { type: 'audio/wav' })
    const url = URL.createObjectURL(blob)
    const audio = new Audio(url)
    void audio.play().catch(() => {})
    window.setTimeout(() => URL.revokeObjectURL(url), 3000)
  } catch {
    /* ignore */
  }
}

async function logFocus(minutes: number, note?: string) {
  const m = Math.max(1, Math.round(minutes))
  let h = await db.habits.where('title').equals('تمرکز').first()
  if (!h?.id) {
    const id = await db.habits.add({
      title: 'تمرکز',
      icon: '⏱️',
      unit: 'min',
      dailyGoal: 60,
      color: '#7c3aed',
      createdAt: Date.now(),
    })
    h = { title: 'تمرکز', icon: '⏱️', unit: 'min', dailyGoal: 60, color: '#7c3aed', createdAt: Date.now(), id }
  }
  await db.habitLogs.add({
    habitId: h.id!,
    date: todayJalali(),
    amount: m,
    note: note || undefined,
    createdAt: Date.now(),
  })
}

/** تصاویر آرامش‌بخش پس‌زمینه حالت تمرکز (پوشه public/focus) */
const FOCUS_BACKGROUNDS = [
  'focus/focus-1.jpg',
  'focus/focus-2.jpg',
  'focus/focus-3.jpg',
  'focus/focus-4.jpg',
  'focus/focus-5.jpg',
]

export function FocusTimer() {
  const { t } = useTranslation()
  const totalRounds = 4
  const [mode, setMode] = useState<'focus' | 'break'>('focus')
  const [focusMin, setFocusMin] = useState(25)
  const [customMin, setCustomMin] = useState('')
  const [breakMin, setBreakMin] = useState(5)
  const [left, setLeft] = useState(25 * 60)
  const [running, setRunning] = useState(false)
  const [round, setRound] = useState(1)
  const [autoBreak, setAutoBreak] = useState(false)
  const [label, setLabel] = useState('')
  const [activity, setActivity] = useState('')
  const [place, setPlace] = useState('')
  const [focusMode, setFocusMode] = useState(true)
  const [bgIndex, setBgIndex] = useState(() => {
    const saved = Number(localStorage.getItem('sazora-focus-bg'))
    return Number.isFinite(saved) && saved >= 0 && saved < FOCUS_BACKGROUNDS.length
      ? saved
      : Math.floor(Math.random() * FOCUS_BACKGROUNDS.length)
  })
  const interval = useRef<number | null>(null)

  const habits = useLiveQuery(() => db.habits.toArray(), [], [] as Habit[])

  /** یادداشت جلسه: فعالیت + مکان + برچسب */
  function sessionNote(): string | undefined {
    const parts = [activity.trim(), place.trim(), label.trim()].filter(Boolean)
    return parts.length ? parts.join(' — ') : undefined
  }

  // در حالت تمرکز، اسکرول پس‌زمینه قفل می‌شود
  useEffect(() => {
    if (focusMode && running) {
      const prev = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      return () => {
        document.body.style.overflow = prev
      }
    }
  }, [focusMode, running])

  // ذخیره پس‌زمینه انتخابی
  useEffect(() => {
    localStorage.setItem('sazora-focus-bg', String(bgIndex))
  }, [bgIndex])

  // خروج از حالت تمرکز با کلید Esc
  useEffect(() => {
    if (!focusMode || !running) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') stopOnly()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusMode, running])

  const focusStats = useLiveQuery(
    async () => {
      const h = await db.habits.where('title').equals('تمرکز').first()
      if (!h?.id) return { sessions: 0, minutes: 0 }
      const all = await db.habitLogs.where('habitId').equals(h.id).toArray()
      const td = todayJalali()
      const todays = all.filter((l) => l.date === td)
      return { sessions: todays.length, minutes: todays.reduce((s, l) => s + l.amount, 0) }
    },
    [],
    { sessions: 0, minutes: 0 },
  )

  async function finishAuto() {
    setRunning(false)
    beep()
    if (mode === 'focus') {
      await logFocus(focusMin, sessionNote())
      if (round < totalRounds) {
        const nr = round + 1
        setRound(nr)
        setMode('break')
        setLeft(breakMin * 60)
        if (autoBreak) setRunning(true)
      } else {
        setRound(1)
        setMode('focus')
        setLeft(focusMin * 60)
      }
    } else {
      setMode('focus')
      setLeft(focusMin * 60)
    }
  }

  useEffect(() => {
    if (!running) return
    interval.current = window.setInterval(() => {
      setLeft((prev) => (prev > 0 ? prev - 1 : 0))
    }, 1000)
    return () => {
      if (interval.current) {
        clearInterval(interval.current)
        interval.current = null
      }
    }
  }, [running])

  useEffect(() => {
    if (running && left === 0) void finishAuto()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [left, running])

  function switchMode(m: 'focus' | 'break') {
    setMode(m)
    setRunning(false)
    setLeft((m === 'focus' ? focusMin : breakMin) * 60)
  }

  function applyCustom() {
    const m = Math.round(Number(customMin))
    if (!m || m <= 0 || m > 300) return
    setFocusMin(m)
    if (mode === 'focus') {
      setLeft(m * 60)
      setRunning(false)
    }
    setCustomMin('')
  }

  /** پایان دستی + ثبت تمرکز انجام‌شده */
  async function finishAndLog() {
    setRunning(false)
    beep()
    if (mode === 'focus') {
      const elapsed = Math.max(1, Math.round(focusMin - left / 60))
      await logFocus(elapsed, sessionNote())
    }
    setMode('focus')
    setLeft(focusMin * 60)
  }

  function stopOnly() {
    setRunning(false)
    setLeft((mode === 'focus' ? focusMin : breakMin) * 60)
  }

  const mm = String(Math.floor(left / 60)).padStart(2, '0')
  const ss = String(left % 60).padStart(2, '0')
  const pctDone = mode === 'focus' && focusMin > 0 ? Math.min(100, Math.round(((focusMin * 60 - left) / (focusMin * 60)) * 100)) : 0

  return (
    <>
      <Panel className="mb-4">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
          <b className="text-[14px]">⏱️ {t('learn.focusTimer')}</b>
          <div className="flex items-center gap-1.5">
            <Chip tone={mode === 'focus' ? 'accent' : 'success'}>
              {mode === 'focus' ? t('learn.focus') : t('learn.break')}
            </Chip>
            {mode === 'focus' && (
              <Chip>
                {t('learn.round')} {faDigits(round)} / {faDigits(totalRounds)}
              </Chip>
            )}
          </div>
        </div>

        {/* انتخاب حالت */}
        <div className="flex gap-1.5 mb-3">
          <button
            className={`btn !py-1.5 text-[12.5px] flex-1 ${mode === 'focus' ? 'btn-primary' : ''}`}
            onClick={() => switchMode('focus')}
          >
            🎯 {t('learn.focus')}
          </button>
          <button
            className={`btn !py-1.5 text-[12.5px] flex-1 ${mode === 'break' ? 'btn-primary' : ''}`}
            onClick={() => switchMode('break')}
          >
            ☕ {t('learn.break')}
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div
            className="text-[40px] font-bold tabular-nums w-[130px] text-center rounded-xl border border-line py-2"
            dir="ltr"
            style={{ color: running ? 'var(--b-accent)' : 'var(--b-ink)' }}
          >
            {mm}:{ss}
          </div>
          <div className="flex flex-col gap-1.5 flex-1 min-w-[200px]">
            {mode === 'focus' ? (
              <div className="flex gap-1.5 flex-wrap">
                {[15, 25, 45, 60].map((m) => (
                  <button
                    key={m}
                    className={`btn !py-1 !px-2 text-[12px] ${focusMin === m ? 'btn-primary' : ''}`}
                    onClick={() => {
                      setFocusMin(m)
                      setLeft(m * 60)
                      setRunning(false)
                    }}
                  >
                    {faDigits(m)}
                  </button>
                ))}
                <span className="flex gap-1.5 items-center">
                  <NumberInput
                    className="field !py-1 !text-[12px] !w-16"
                    value={customMin}
                    onChange={(n) => setCustomMin(String(n))}
                    placeholder={t('learn.minutes')}
                  />
                  <button className="btn !py-1 !px-2 text-[12px]" onClick={applyCustom}>
                    {t('learn.apply')}
                  </button>
                </span>
              </div>
            ) : (
              <div className="flex gap-1.5">
                {[5, 10, 15].map((m) => (
                  <button
                    key={m}
                    className={`btn !py-1 !px-2 text-[12px] ${breakMin === m ? 'btn-primary' : ''}`}
                    onClick={() => {
                      setBreakMin(m)
                      setLeft(m * 60)
                      setRunning(false)
                    }}
                  >
                    {faDigits(m)} {t('learn.minutes')}
                  </button>
                ))}
              </div>
            )}

            {/* فعالیت و مکان جلسه */}
            <div className="grid sm:grid-cols-2 gap-1.5">
              <input
                className="field !py-1.5 !text-[12.5px]"
                placeholder={t('learn.activity')}
                value={activity}
                onChange={(e) => setActivity(e.target.value)}
                list="focus-activity-options"
              />
              <datalist id="focus-activity-options">
                {habits.map((h) => (
                  <option key={h.id} value={h.title} />
                ))}
              </datalist>
              <input
                className="field !py-1.5 !text-[12.5px]"
                placeholder={t('learn.place')}
                value={place}
                onChange={(e) => setPlace(e.target.value)}
              />
            </div>

            <input
              className="field !py-1.5 !text-[12.5px]"
              placeholder={t('learn.timerLabel')}
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />

            <div className="flex flex-wrap items-center gap-3 text-[12px] text-muted">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input type="checkbox" checked={autoBreak} onChange={(e) => setAutoBreak(e.target.checked)} />
                {t('learn.autoBreak')}
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={focusMode}
                  onChange={(e) => setFocusMode(e.target.checked)}
                />
                {t('learn.focusMode')}
              </label>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <div className="flex gap-1.5">
              {!running ? (
                <button className="btn btn-primary !py-2 text-[13px]" onClick={() => setRunning(true)}>
                  ▶️ {t('learn.start')}
                </button>
              ) : (
                <button className="btn !py-2 text-[13px]" onClick={() => setRunning(false)}>
                  ⏸️ {t('learn.pause')}
                </button>
              )}
              <button className="btn !py-2 text-[13px]" onClick={stopOnly}>
                ⏹️ {t('learn.stop')}
              </button>
            </div>
            <button className="btn !py-1.5 text-[12.5px]" onClick={finishAndLog}>
              ✅ {t('learn.finishLog')}
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 mt-3 text-[12px] text-muted flex-wrap">
          <Chip>{t('learn.todaySessions')}: {faDigits(focusStats.sessions)}</Chip>
          <Chip>{t('learn.todayMinutes')}: {faDigits(focusStats.minutes)} {t('learn.minutes')}</Chip>
        </div>
        <p className="text-[11px] text-faint mt-2">{t('learn.timerHint')}</p>
      </Panel>

      {/* پوشش حالت تمرکز — پس‌زمینه آرامش‌بخش متحرک + تایمر بزرگ */}
      {focusMode &&
        running &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] overflow-hidden"
            style={{ background: '#05070d', color: '#f8fafc' }}
          >
            {/* لایه تصویر با حرکت بسیار آرام (Ken Burns) */}
            <div
              className="sazora-focus-bg"
              style={{ backgroundImage: `url(${import.meta.env.BASE_URL}${FOCUS_BACKGROUNDS[bgIndex]})` }}
            />
            {/* لایه تاریک برای خوانایی محتوا */}
            <div
              className="absolute inset-0"
              style={{
                background:
                  'radial-gradient(circle at 50% 45%, rgba(5,7,13,0.30) 0%, rgba(5,7,13,0.70) 62%, rgba(5,7,13,0.92) 100%)',
              }}
            />

            <div className="relative z-10 h-full flex flex-col items-center justify-center gap-6 px-6 text-center">
            <div className="text-[12.5px] tracking-widest uppercase opacity-60">
              {mode === 'focus' ? t('learn.focusNow') : t('learn.breakNow')}
            </div>

            <div
              className="text-[92px] sm:text-[120px] font-bold tabular-nums leading-none"
              dir="ltr"
              style={{ color: mode === 'focus' ? '#93c5fd' : '#86efac' }}
            >
              {mm}:{ss}
            </div>

            {mode === 'focus' && (
              <div className="w-full max-w-md">
                <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${pctDone}%`, background: '#93c5fd' }}
                  />
                </div>
                <div className="mt-2 text-[12px] opacity-60">{faDigits(pctDone)}٪</div>
              </div>
            )}

            {(activity || place || label) && (
              <div className="text-[14px] opacity-80 max-w-lg">
                {[activity, place, label].filter(Boolean).join(' — ')}
              </div>
            )}

            <div className="flex flex-wrap items-center justify-center gap-2.5">
              <button
                className="btn !py-2.5 !px-6 text-[14px]"
                onClick={() => setRunning(false)}
                style={{ background: 'rgba(255,255,255,0.1)', color: '#fff', borderColor: 'rgba(255,255,255,0.2)' }}
              >
                ⏸️ {t('learn.pause')}
              </button>
              <button
                className="btn btn-primary !py-2.5 !px-6 text-[14px]"
                onClick={finishAndLog}
              >
                ✅ {t('learn.finishLog')}
              </button>
              <button
                className="btn !py-2.5 !px-5 text-[14px]"
                onClick={stopOnly}
                style={{ background: 'transparent', color: 'rgba(255,255,255,0.75)', borderColor: 'rgba(255,255,255,0.2)' }}
              >
                {t('learn.exitFocus')}
              </button>
            </div>

            <div className="text-[11.5px] opacity-40">{t('learn.focusHint')}</div>
            </div>

            {/* تغییر تصویر پس‌زمینه */}
            <button
              type="button"
              className="absolute bottom-4 left-4 z-10 text-[11.5px] px-3 py-1.5 rounded-full backdrop-blur-sm"
              style={{
                background: 'rgba(255,255,255,0.10)',
                color: 'rgba(255,255,255,0.82)',
                border: '1px solid rgba(255,255,255,0.18)',
              }}
              onClick={() => setBgIndex((i) => (i + 1) % FOCUS_BACKGROUNDS.length)}
              title={t('learn.focusBg')}
            >
              🖼️ {t('learn.focusBg')}
            </button>
          </div>,
          document.body,
        )}
    </>
  )
}

/* ==================== period report (week/month/year) ==================== */

/** گام مناسب برای خطوط راهنمای محور عمودی */
function niceStep(max: number): number {
  const raw = Math.max(1, max) / 4
  const mag = Math.pow(10, Math.floor(Math.log10(Math.max(1, raw))))
  const n = raw / mag
  const f = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10
  return f * mag
}

function PeriodReport({ habits, logs }: { habits: Habit[]; logs: HabitLog[] }) {
  const { t } = useTranslation()
  const [tab, setTab] = useState<'week' | 'month' | 'year'>('week')
  const today = todayJalali()

  const sumSince = (habitId: number | undefined, start: string, end?: string) =>
    logs
      .filter((l) => l.habitId === habitId && l.date >= start && (end === undefined || l.date <= end))
      .reduce((s, l) => s + l.amount, 0)

  const tabs: Array<{ id: 'week' | 'month' | 'year'; label: string }> = [
    { id: 'week', label: t('learn.tabWeek') },
    { id: 'month', label: t('learn.tabMonth') },
    { id: 'year', label: t('learn.tabYear') },
  ]

  const days = tab === 'week' ? 7 : tab === 'month' ? 30 : 365
  const start = addDays(today, -(days - 1))
  const rows = habits.map((h) => {
    const sum = tab === 'week' ? last7Days().reduce((s, d) => s + sumOn(h, logs, d), 0) : sumSince(h.id, start)
    const goal = h.dailyGoal * days
    const pct = goal > 0 ? Math.min(100, Math.round((sum / goal) * 100)) : 0
    return { h, sum, goal, pct }
  })
  const avg = Math.round(rows.reduce((s, r) => s + r.pct, 0) / (rows.length || 1))

  /* ---- داده نمودار خطی: محور افقی روز/ماه، محور عمودی مجموع مقدار ---- */
  const points =
    tab === 'year'
      ? Array.from({ length: 12 }, (_, i) => {
          const st = startOfMonth(addMonths(startOfMonth(today), -(11 - i)))
          const end = endOfMonth(st)
          const total = logs.filter((l) => l.date >= st && l.date <= end).reduce((x, l) => x + l.amount, 0)
          const mNum = Number(st.slice(5, 7))
          return { start: st, end, label: FA_MONTHS[mNum - 1] ?? st.slice(5, 7), total }
        })
      : Array.from({ length: days }, (_, i) => {
          const d = addDays(today, -(days - 1 - i))
          const total = logs.filter((l) => l.date === d).reduce((x, l) => x + l.amount, 0)
          return { start: d, end: d, label: String(Number(d.slice(8, 10))), total }
        })

  const lines = habits
    .filter((h) => h.id != null)
    .map((h) => ({
      id: h.id!,
      title: h.title,
      color: h.color || COLORS[0]!,
      values: points.map((p) => sumSince(h.id, p.start, p.end)),
    }))

  const W = 660
  const H = 236
  const padL = 42
  const padR = 14
  const padT = 16
  const padB = 30
  const innerW = W - padL - padR
  const innerH = H - padT - padB
  const maxVal = Math.max(1, ...lines.flatMap((l) => l.values), ...points.map((p) => p.total))
  const step = niceStep(maxVal)
  const yMax = Math.max(step, Math.ceil(maxVal / step) * step)
  const px = (i: number) => (points.length <= 1 ? padL : padL + (i / (points.length - 1)) * innerW)
  const py = (v: number) => padT + innerH - (Math.min(v, yMax) / yMax) * innerH
  const ticks = Array.from({ length: 5 }, (_, i) => (yMax / 4) * i)
  const labelEvery = tab === 'week' ? 1 : tab === 'month' ? 5 : 1

  return (
    <Panel>
      <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
        <b className="text-[14px]">📊 {t('learn.reportTitle')}</b>
        <div className="flex gap-1.5">
          {tabs.map((tb) => (
            <button
              key={tb.id}
              className={`btn !py-1 !px-2.5 text-[12px] ${tab === tb.id ? 'btn-primary' : ''}`}
              onClick={() => setTab(tb.id)}
            >
              {tb.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
        <span className="text-[12px] text-muted">
          {tab === 'week' ? t('learn.weeklyReport') : t('learn.reportSum', { n: faDigits(days) })}
        </span>
        <Chip tone="accent">{t('learn.average')}: {faDigits(avg)}٪</Chip>
      </div>

      <div className="space-y-2.5">
        {rows.map((r) => (
          <div key={r.h.id} className="flex items-center gap-3">
            <span className="text-[16px]">{r.h.icon}</span>
            <span className="text-[12.5px] w-28 shrink-0 truncate">{r.h.title}</span>
            <div className="flex-1">
              <Bar value={r.pct} />
            </div>
            <span className="text-[11.5px] tabular-nums text-muted w-20 text-left" dir="ltr">
              {faDigits(r.sum)}/{faDigits(r.goal)}
            </span>
          </div>
        ))}
      </div>

      {/* نمودار خطی روز و زمان */}
      <div className="mt-4 rounded-xl border border-line bg-surface-2 p-2.5">
        <div className="flex items-center justify-between mb-1 gap-2 flex-wrap">
          <span className="text-[12px] font-medium">{t('learn.chartTitle')}</span>
          <span className="text-[10.5px] text-faint">{t('learn.chartHint')}</span>
        </div>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full h-auto"
          role="img"
          aria-label={t('learn.chartTitle')}
        >
          {/* خطوط راهنمای افقی */}
          {ticks.map((v) => (
            <g key={`t-${v}`}>
              <line
                x1={padL}
                x2={W - padR}
                y1={py(v)}
                y2={py(v)}
                stroke="var(--b-line)"
                strokeWidth={1}
                strokeDasharray={v === 0 ? '0' : '3 4'}
              />
              <text x={padL - 6} y={py(v) + 3} textAnchor="end" fontSize={9} fill="var(--b-faint)">
                {faDigits(Math.round(v))}
              </text>
            </g>
          ))}

          {/* برچسب‌های محور افقی */}
          {points.map((p, i) =>
            i % labelEvery === 0 || i === points.length - 1 ? (
              <text
                key={`x-${p.start}`}
                x={px(i)}
                y={H - 9}
                textAnchor="middle"
                fontSize={9}
                fill="var(--b-faint)"
              >
                {p.label}
              </text>
            ) : null,
          )}

          {/* خط جمع کل */}
          <polyline
            points={points.map((p, i) => `${px(i)},${py(p.total)}`).join(' ')}
            fill="none"
            stroke="var(--b-accent)"
            strokeWidth={2.6}
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {/* خط هر عادت */}
          {lines.map((l) => (
            <polyline
              key={`l-${l.id}`}
              points={l.values.map((v, i) => `${px(i)},${py(v)}`).join(' ')}
              fill="none"
              stroke={l.color}
              strokeWidth={1.6}
              strokeOpacity={0.85}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ))}

          {/* نقطه‌ها با راهنمای شناور */}
          {points.map((p, i) => (
            <circle key={`c-${p.start}`} cx={px(i)} cy={py(p.total)} r={2.6} fill="var(--b-accent)">
              <title>{`${p.label}: ${p.total}`}</title>
            </circle>
          ))}
        </svg>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 mt-1.5 text-[10.5px]">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-[2.5px] rounded-full" style={{ background: 'var(--b-accent)' }} />
            {t('learn.chartTotal')}
          </span>
          {lines.map((l) => (
            <span key={`lg-${l.id}`} className="flex items-center gap-1.5">
              <span className="w-3 h-[2.5px] rounded-full" style={{ background: l.color }} />
              {l.title}
            </span>
          ))}
        </div>
      </div>
    </Panel>
  )
}

/* ==================== habit form ==================== */

function HabitForm({ initial, onDone }: { initial?: Habit; onDone: () => void }) {
  const { t } = useTranslation()
  const [title, setTitle] = useState(initial?.title ?? '')
  const [icon, setIcon] = useState(initial?.icon ?? '📚')
  const [unit, setUnit] = useState<'min' | 'count'>(initial?.unit ?? 'min')
  const [goal, setGoal] = useState(initial ? String(initial.dailyGoal) : '30')
  const [color, setColor] = useState(initial?.color ?? COLORS[0]!)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    const g = Math.round(Number(goal)) || 30
    if (initial?.id) {
      await db.habits.update(initial.id, {
        title: title.trim(),
        icon,
        unit,
        dailyGoal: g,
        color,
      })
    } else {
      await db.habits.add({ title: title.trim(), icon, unit, dailyGoal: g, color, createdAt: Date.now() })
    }
    onDone()
  }

  return (
    <form onSubmit={submit} className="card p-4 mb-4 b-pop">
      <div className="grid sm:grid-cols-2 gap-3">
        <Field label={t('learn.habitTitle')}>
          <TextInput value={title} onChange={(e) => setTitle(e.target.value)} required autoFocus />
        </Field>
        <Field label={t('learn.icon')}>
          <div className="flex flex-wrap gap-1.5">
            {['📚', '📖', '🇬🇧', '🧠', '⏱️', '✍️', '🎧', '💻', '🎯', '⭐'].map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => setIcon(e)}
                className={`w-8 h-8 rounded-lg border text-[16px] transition-transform hover:scale-110 ${
                  icon === e ? 'border-[color:var(--b-accent)] bg-[color:var(--b-accent-soft)]' : 'border-line'
                }`}
              >
                {e}
              </button>
            ))}
          </div>
        </Field>
        <Field label={t('learn.unit')}>
          <div className="flex gap-1.5">
            <button
              type="button"
              className={`btn !py-1.5 text-[12.5px] ${unit === 'min' ? 'btn-primary' : ''}`}
              onClick={() => setUnit('min')}
            >
              {t('learn.minutes')}
            </button>
            <button
              type="button"
              className={`btn !py-1.5 text-[12.5px] ${unit === 'count' ? 'btn-primary' : ''}`}
              onClick={() => setUnit('count')}
            >
              {t('learn.count')}
            </button>
          </div>
        </Field>
        <Field label={t('learn.dailyGoal')}>
          <NumberInput value={goal} onChange={(n) => setGoal(String(n))} />
        </Field>
        <Field label={t('learn.color')}>
          <div className="flex gap-1.5">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={`w-7 h-7 rounded-full border-2 transition-transform hover:scale-110 ${
                  color === c ? 'border-[color:var(--b-ink)]' : 'border-transparent'
                }`}
                style={{ background: c }}
              />
            ))}
          </div>
        </Field>
      </div>
      <div className="flex justify-end gap-2 mt-3">
        <button type="button" className="btn" onClick={onDone}>
          {t('common.cancel')}
        </button>
        <button type="submit" className="btn btn-primary">
          {t('common.save')}
        </button>
      </div>
    </form>
  )
}
