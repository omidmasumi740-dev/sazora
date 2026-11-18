import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Worker, type Attendance, type Payment, type DayLog, type Stage } from '../db/schema'
import {
  FA_MONTHS,
  addDays,
  addMonths,
  daysUntil,
  endOfMonth,
  formatJalali,
  formatJalaliShort,
  isValidJalali,
  monthDays,
  startOfMonth,
  todayJalali,
  weekdayOf,
  weekDays,
} from '../lib/jalali'
import { faDigits, groupDigits, downloadJSON, hours as fmtHours } from '../lib/format'
import { compressImage } from '../lib/photos'
import { Chip, EmptyState, Field, TextInput, NumberInput, ExportMenu } from '../ui/components'
import { DatePicker } from '../ui/datepicker'
import { CategoryPicker } from '../ui/categoryPicker'



type Tab = 'daily' | 'weekly' | 'monthly' | '6month' | '1year'

export default function WorkersPage() {
  const { t } = useTranslation()
  const [tab, setTab] = useState<Tab>('daily')

  const tabLabel: Record<Tab, string> = {
    daily: t('workers.daily'),
    weekly: t('workers.weekly'),
    monthly: t('workers.monthly'),
    '6month': '۶ ماهه',
    '1year': '۱ ساله',
  }

  return (
    <div className="b-view max-w-6xl mx-auto">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
        <div>
          <h1 className="text-[21px] font-bold tracking-tight">{t('workers.title')}</h1>
          <p className="text-[13px] text-muted mt-0.5">{t('workers.subtitle')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <WorkersCsvButton />
          <AddWorkerButton />
        </div>
      </div>

      {/* مدیریت نیروها (ویرایش/حذف آبشاری) */}
      <WorkerManager />

      {/* تب‌ها */}
      <div className="flex gap-1 border-b border-line mb-5 overflow-x-auto">
        {(['daily', 'weekly', 'monthly', '6month', '1year'] as Tab[]).map((k) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`px-4 py-2 text-[13px] border-b-2 -mb-px transition-colors whitespace-nowrap ${
              tab === k
                ? 'border-[color:var(--b-accent)] text-[color:var(--b-accent)] font-semibold'
                : 'border-transparent text-muted hover:text-ink'
            }`}
          >
            {tabLabel[k]}
          </button>
        ))}
      </div>

      {tab === 'daily' && <DailyView />}
      {tab === 'weekly' && <SummaryView mode="week" />}
      {tab === 'monthly' && <SummaryView mode="month" />}
      {tab === '6month' && <SummaryView mode="6month" />}
      {tab === '1year' && <SummaryView mode="1year" />}
    </div>
  )
}

/* ============================================================
   آواتار دایره‌ای کارگر + هلپر دانلود CSV
   ============================================================ */
function Avatar({ name, photo, size = 32 }: { name: string; photo?: string; size?: number }) {
  const dim = { width: size, height: size } as const
  if (photo) {
    return (
      <img
        src={photo}
        alt={name}
        width={size}
        height={size}
        className="rounded-full object-cover shrink-0 border border-line bg-surface-2"
        style={dim}
      />
    )
  }
  const ch = name.trim().charAt(0) || '؟'
  return (
    <span
      className="rounded-full grid place-items-center shrink-0 border border-line bg-surface-2 font-bold text-muted"
      style={{ ...dim, fontSize: Math.max(11, Math.round(size * 0.42)) }}
      aria-hidden
    >
      {ch}
    </span>
  )
}

function csvCell(v: string | number | null | undefined): string {
  const s = v == null ? '' : String(v)
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

async function downloadCsv(filename: string, headers: string[], rows: (string | number)[][]) {
  const lines = [headers.map(csvCell).join(','), ...rows.map((r) => r.map(csvCell).join(','))]
  // کاراکتر اول رشته زیر BOM ‏(U+FEFF) است برای نمایش درست فارسی در اکسل
  const csv = '﻿' + lines.join('\r\n')
  const { saveBlobFile } = await import('../lib/native')
  await saveBlobFile(filename, new Blob([csv], { type: 'text/csv;charset=utf-8' }))
}

/** دکمه خروجی CSV کل نیروها (بالای صفحه) */
function WorkersCsvButton() {
  const workers = useLiveQuery(() => db.workers.toArray(), [], [] as Worker[])
  const attendances = useLiveQuery(() => db.attendances.toArray(), [], [] as Attendance[])
  const payments = useLiveQuery(() => db.payments.toArray(), [], [] as Payment[])

  async function exportAll() {
    const headers = ['نام', 'شغل', 'تلفن', 'دستمزد روزانه', 'تعداد روز کارکرد (کل)', 'جمع ساعت', 'جمع مزد', 'جمع دریافتی', 'مانده']
    const rows = [...(workers ?? [])]
      .sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0))
      .map((w) => {
        const atts = (attendances ?? []).filter((a) => a.workerId === w.id)
        const totalHours = atts.reduce((s, a) => s + a.hours, 0)
        const daysWorked = atts.length
        const earned = Math.round((totalHours / 8) * w.dailyWage)
        const paid = (payments ?? []).filter((p) => p.workerId === w.id).reduce((s, p) => s + p.amount, 0)
        const balance = earned - paid
        return [w.name, w.role, w.phone ?? '', w.dailyWage, daysWorked, totalHours, earned, paid, balance] as (string | number)[]
      })
    await downloadCsv(`workers-${todayJalali()}.csv`, headers, rows)
  }

  return (
    <button className="btn" onClick={exportAll} title="خروجی CSV همه نیروها">
      ⬇ خروجی CSV
    </button>
  )
}

/* ============================================================
   نمای روزانه — تقویم شمسی + تیک حضور + ساعت + گزارش کار روز
   ============================================================ */
function DailyView() {
  const { t } = useTranslation()
  const [cursor, setCursor] = useState(todayJalali())
  const [selected, setSelected] = useState(todayJalali())
  const [dayProject, setDayProject] = useState<number>(0)
  const [dayStage, setDayStage] = useState<number>(0)

  const dayStages = useLiveQuery(
    () => (dayProject ? db.stages.where('projectId').equals(dayProject).toArray() : Promise.resolve([] as Stage[])),
    [dayProject],
    [] as Stage[],
  )

  const month = monthDays(cursor)
  const first = startOfMonth(cursor)
  const lead = leadingBlanks(cursor)

  const attendances = useLiveQuery(
    () => db.attendances.where('date').between(first, endOfMonth(cursor), true, true).toArray(),
    [cursor],
    [] as Attendance[],
  )
  const workers = useLiveQuery(() => db.workers.toArray(), [], [] as Worker[])
  const projects = useLiveQuery(
    () => db.projects.orderBy('createdAt').toArray(),
    [],
    [] as { id?: number; name: string; status: string }[],
  )

  /** نقشه روز → مجموعه workerId */
  const dayMap = useMemo(() => {
    const m = new Map<string, Set<number>>()
    for (const a of attendances) {
      if (!m.has(a.date)) m.set(a.date, new Set())
      m.get(a.date)!.add(a.workerId)
    }
    return m
  }, [attendances])

  const selectedAttendance = attendances.filter((a) => a.date === selected)
  const dayCost = selectedAttendance.reduce((sum, a) => {
    const w = workers.find((x) => x.id === a.workerId)
    return sum + dailyPay(w, a.hours)
  }, 0)

  const activeWorkers = workers.filter((w) => w.active)
  const activeProjects = projects.filter((p) => p.status !== 'done')

  // پروژه پیش‌فرض روز: پروژه‌ای که بیشتر نفرات آن روز مال اونن
  useEffect(() => {
    if (selectedAttendance.length === 0) return
    const counts = new Map<number, number>()
    for (const a of selectedAttendance) {
      const w = workers.find((x) => x.id === a.workerId)
      const pid = w?.projectId ?? 0
      counts.set(pid, (counts.get(pid) ?? 0) + 1)
    }
    const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]
    if (top) setDayProject(top[0])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected])

  async function toggleWorker(workerId: number) {
    const existing = selectedAttendance.find((a) => a.workerId === workerId)
    if (existing) {
      const w = workers.find((x) => x.id === workerId)
      const label = w?.name ?? ''
      if (!window.confirm(`حضور ${label} در تاریخ ${formatJalali(selected)} حذف بشه؟`)) return
      if (existing.id) await db.attendances.delete(existing.id)
    } else {
      const w = workers.find((x) => x.id === workerId)
      await db.attendances.add({
        workerId,
        date: selected,
        hours: 8,
        projectId: w?.projectId ?? null,
        createdAt: Date.now(),
      })
    }
  }

  async function setHours(attendanceId: number, value: number) {
    if (!Number.isFinite(value) || value < 0) return
    await db.attendances.update(attendanceId, { hours: Math.min(24, value) })
  }

  async function markAll() {
    const missing = activeWorkers.filter((w) => !selectedAttendance.some((a) => a.workerId === w.id))
    await db.attendances.bulkAdd(
      missing.map((w) => ({
        workerId: w.id!,
        date: selected,
        hours: 8,
        projectId: w.projectId ?? null,
        createdAt: Date.now(),
      })),
    )
  }

  async function clearDay() {
    const ids = selectedAttendance.map((a) => a.id!).filter(Boolean)
    if (!ids.length) return
    if (!window.confirm(`کل حضور ${faDigits(ids.length)} نفر در تاریخ ${formatJalali(selected)} پاک می‌شه. مطمئنی؟`)) return
    await db.attendances.bulkDelete(ids)
  }

  async function exportDaily() {
    const headers = ['نام', 'ساعت', 'مزد آن روز', 'پروژه']
    const rows = selectedAttendance.map((a) => {
      const w = workers.find((x) => x.id === a.workerId)
      const pay = dailyPay(w, a.hours)
      const pid = a.projectId ?? w?.projectId ?? null
      const pname = pid == null ? '' : (projects.find((p) => p.id === pid)?.name ?? '')
      return [w?.name ?? '', a.hours, pay, pname] as (string | number)[]
    })
    await downloadCsv(`daily-${selected}.csv`, headers, rows)
  }

  return (
    <div className="grid lg:grid-cols-[1fr_360px] gap-4 items-start">
      {/* تقویم */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-line">
          <button
            className="btn btn-ghost !py-1 !px-2.5 text-[12px]"
            onClick={() => setCursor(addDays(startOfMonth(cursor), -1))}
          >
            ‹ {t('workers.prevWeek')}
          </button>
          <div className="text-[14px] font-semibold">{formatJalali(startOfMonth(cursor))}</div>
          <button
            className="btn btn-ghost !py-1 !px-2.5 text-[12px]"
            onClick={() => setCursor(addDays(endOfMonth(cursor), 1))}
          >
            {t('workers.nextWeek')} ›
          </button>
        </div>

        <div className="grid grid-cols-7 border-b border-line bg-surface-2">
          {['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'].map((d) => (
            <div key={d} className="py-1.5 text-center text-[11.5px] text-muted font-semibold">
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {Array.from({ length: lead }).map((_, i) => (
            <div key={`e${i}`} className="min-h-[74px] border-b border-e border-line bg-surface-2/40" />
          ))}
          {month.map((date) => {
            const present = dayMap.get(date)?.size ?? 0
            const isToday = date === todayJalali()
            const isSel = date === selected
            const isFuture = daysUntil(date) > 0
            return (
              <button
                key={date}
                onClick={() => setSelected(date)}
                className={`min-h-[74px] border-b border-e border-line p-1.5 text-start transition-colors relative ${
                  isSel ? 'bg-[color:var(--b-accent-soft)]' : 'hover:bg-surface-2'
                } ${isFuture ? 'opacity-45' : ''}`}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`text-[12px] ${isToday ? 'font-bold' : 'text-muted'}`}
                    style={isToday ? { color: 'var(--b-accent)' } : undefined}
                  >
                    {faDigits(date.split('-')[2]!.replace(/^0/, ''))}
                  </span>
                  {isToday && (
                    <span
                      className="text-[9px] px-1 rounded-full text-white"
                      style={{ background: 'var(--b-accent)' }}
                    >
                      {t('workers.today')}
                    </span>
                  )}
                </div>
                {present > 0 && (
                  <div className="mt-1.5">
                    <div className="flex flex-wrap gap-1">
                      {Array.from({ length: Math.min(present, 4) }).map((_, i) => (
                        <span
                          key={i}
                          className="w-1.5 h-1.5 rounded-full"
                          style={{ background: 'var(--b-accent)' }}
                        />
                      ))}
                      {present > 4 && (
                        <span className="text-[9.5px] text-muted">+{faDigits(present - 4)}</span>
                      )}
                    </div>
                    <div className="text-[9.5px] text-faint mt-0.5">{faDigits(present)} نفر</div>
                  </div>
                )}
              </button>
            )
          })}
        </div>

        {/* گزارش‌های کار روز — چند گزارش تیتر‌وار */}
        <DayLogList key={selected} date={selected} />
      </div>

      {/* پنل روز انتخاب‌شده */}
      <div className="card overflow-hidden lg:sticky lg:top-0">
        <div className="px-4 py-3 border-b border-line">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="text-[14px] font-semibold">{formatJalali(selected)}</div>
              <div className="text-[11.5px] text-muted">{weekdayOf(selected)}</div>
            </div>
            <div className="text-end shrink-0">
              <div className="text-[11px] text-muted">{t('workers.dayTotal')}</div>
              <div
                className="text-[15px] font-bold tabular-nums"
                style={{ color: 'var(--b-accent)' }}
              >
                {groupDigits(dayCost)}
              </div>
              <div className="text-[10px] text-faint">تومان</div>
            </div>
          </div>

          <label className="block mt-2.5">
            <span className="text-[11px] text-muted block mb-1">{t('workers.dayProject')}</span>
            <select
              className="field !py-1.5 !text-[12.5px]"
              value={dayProject}
              onChange={(e) => { setDayProject(Number(e.target.value)); setDayStage(0) }}
            >
              <option value={0}>{t('workers.noProject')}</option>
              {activeProjects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>

          {dayProject > 0 && (
            <label className="block mt-2">
              <span className="text-[11px] text-muted block mb-1">مرحله اجرا</span>
              <select className="field !py-1.5 !text-[12.5px]" value={dayStage} onChange={(e) => setDayStage(Number(e.target.value))}>
                <option value={0}>همه مراحل / بدون مرحله</option>
                {dayStages.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title} · {faDigits(s.progress)}٪
                  </option>
                ))}
              </select>
            </label>
          )}

          <div className="flex gap-1.5 mt-2.5">
            <button className="btn !py-1 !px-2.5 text-[11.5px] flex-1" onClick={markAll}>
              {t('workers.markAll')}
            </button>
            <button
              className="btn btn-danger !py-1 !px-2.5 text-[11.5px] flex-1"
              onClick={clearDay}
            >
              {t('workers.clearDay')}
            </button>
          </div>
          <button className="btn !py-1 !px-2.5 text-[11.5px] w-full mt-1.5" onClick={exportDaily}>
            ⬇ خروجی روزانه CSV
          </button>
        </div>

        <div className="max-h-[420px] overflow-y-auto">
          {activeWorkers.length === 0 ? (
            <div className="p-5">
              <EmptyState
                icon="👷"
                title={t('workers.noWorkers')}
                hint={t('workers.noWorkersHint')}
              />
            </div>
          ) : (
            [...activeWorkers]
              .sort((a, b) => Number(b.isSelf ?? false) - Number(a.isSelf ?? false))
              .map((w) => {
                const att = selectedAttendance.find((a) => a.workerId === w.id)
                const present = !!att
                const project = projects.find((p) => p.id === w.projectId)
                return (
                  <div
                    key={w.id}
                    className={`flex items-center gap-3 px-4 py-2.5 border-b border-line last:border-0 transition-colors ${
                      present ? 'bg-[color:var(--b-accent-soft)]' : ''
                    }`}
                  >
                    <button
                      onClick={() => toggleWorker(w.id!)}
                      className={`w-[18px] h-[18px] rounded-md border-[1.5px] grid place-items-center text-[10px] shrink-0 ${
                        present ? 'text-white border-transparent' : 'bg-surface border-line'
                      }`}
                      style={present ? { background: 'var(--b-accent)' } : undefined}
                      title={present ? t('workers.absent') : t('workers.present')}
                    >
                      {present ? '✓' : ''}
                    </button>

                    <Avatar name={w.name} photo={w.photo} size={30} />

                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-medium truncate flex items-center gap-1.5">
                        {w.name}
                        {w.isSelf && <Chip tone="accent" className="!text-[10px] !py-0">⭐ {t('workers.self')}</Chip>}
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="chip !py-0 !text-[10.5px]">{w.role}</span>
                        {project && (
                          <span className="text-[10.5px] text-faint truncate">{project.name}</span>
                        )}
                      </div>
                    </div>

                    {present && att ? (
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          min={0}
                          max={24}
                          step={0.5}
                          defaultValue={att.hours}
                          onBlur={(e) => setHours(att.id!, Number(e.target.value))}
                          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                          className="w-14 text-center text-[12.5px] font-semibold bg-surface border border-line rounded-md py-1 tabular-nums outline-none focus:border-[color:var(--b-accent)]"
                          dir="ltr"
                        />
                        <span className="text-[11px] text-muted">ساعت</span>
                      </div>
                    ) : (
                      <div className="text-[11.5px] text-faint">
                        {groupDigits(w.dailyWage)} <span className="text-[10px]">تومان/روز</span>
                      </div>
                    )}
                  </div>
                )
              })
          )}
        </div>

        <div className="px-4 py-2.5 border-t border-line bg-surface-2 text-[11.5px] text-muted">
          {selectedAttendance.length > 0
            ? t('workers.dayWorkers', { n: faDigits(selectedAttendance.length) }) +
              ' · ' +
              fmtHours(selectedAttendance.reduce((s, a) => s + a.hours, 0)) +
              ' ساعت'
            : t('workers.emptyDay')}
        </div>
      </div>
    </div>
  )
}

/* ============================================================
   گزارش‌های متنی کار روز — چند گزارش تیتر‌وار در روز
   تیتر هر گزارش = خط اول متن (bold)، بقیه توضیح
   ============================================================ */
function DayLogList({ date }: { date: string }) {
  const { t } = useTranslation()
  const [projectId, setProjectId] = useState<number>(0)
  const [stageId, setStageId] = useState<number>(0)
  const [text, setText] = useState('')
  const [savedTick, setSavedTick] = useState(false)

  const logs = useLiveQuery(
    () => db.dayLogs.toArray().then((all) => all.filter((l) => l.date === date)),
    [date],
    [] as DayLog[],
  )
  const projects = useLiveQuery(() => db.projects.orderBy('createdAt').toArray(), [], [] as { id?: number; name: string }[])
  const stages = useLiveQuery(
    () => (projectId ? db.stages.where('projectId').equals(projectId).toArray() : Promise.resolve([] as Stage[])),
    [projectId],
    [] as Stage[],
  )

  const sorted = useMemo(
    () => [...logs].sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0)),
    [logs],
  )
  const allStages = useLiveQuery(() => db.stages.toArray(), [], [] as Stage[])
  const stageName = (sid?: number) => (sid ? allStages.find((s) => s.id === sid)?.title ?? '' : '')

  async function add(e: FormEvent) {
    e.preventDefault()
    const v = text.trim()
    if (!v) return
    await db.dayLogs.add({ date, projectId, stageId: stageId || undefined, text: v, createdAt: Date.now() })
    setText('')
    setSavedTick(true)
    setTimeout(() => setSavedTick(false), 2500)
  }

  async function remove(id?: number) {
    if (!id) return
    if (!window.confirm('این گزارش حذف بشه؟')) return
    await db.dayLogs.delete(id)
  }

  function projectName(pid: number): string {
    if (!pid) return 'بدون پروژه'
    return projects.find((p) => p.id === pid)?.name ?? 'پروژه حذف‌شده'
  }

  return (
    <div className="border-t border-line px-4 py-3.5 bg-surface">
      <div className="flex items-center justify-between mb-2">
        <b className="text-[13px]">📝 {t('workers.workLog')}</b>
        {savedTick && <span className="text-[11.5px]" style={{ color: 'var(--b-green)' }}>{t('workers.logSaved')}</span>}
      </div>

      <form onSubmit={add} className="flex flex-col gap-2">
        <select className="field !py-1.5 !text-[12.5px]" value={projectId} onChange={(e) => { setProjectId(Number(e.target.value)); setStageId(0) }}>
          <option value={0}>بدون پروژه</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        {projectId > 0 && (
          <select className="field !py-1.5 !text-[12.5px]" value={stageId} onChange={(e) => setStageId(Number(e.target.value))}>
            <option value={0}>مرحله اجرا (اختیاری)</option>
            {stages.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title} · {faDigits(s.progress)}٪
              </option>
            ))}
          </select>
        )}
        <textarea
          className="field !min-h-[76px] resize-y"
          rows={3}
          placeholder={t('workers.workLogHint')}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <div className="flex justify-end">
          <button type="submit" className="btn btn-primary !py-1.5 !px-4 text-[12.5px]">
            ثبت گزارش
          </button>
        </div>
      </form>

      {sorted.length > 0 && (
        <div className="space-y-2 mt-3">
          {sorted.map((l) => {
            const lines = l.text.split('\n')
            const title = lines[0] ?? ''
            const rest = lines.slice(1).join('\n').trim()
            return (
              <div key={l.id} className="bg-surface-2 border border-line rounded-lg px-3 py-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="text-[11px] text-faint">
                    {formatJalali(l.date)} · {projectName(l.projectId)}
                    {stageName(l.stageId) ? ` · ${stageName(l.stageId)}` : ''}
                  </div>
                  <button
                    onClick={() => remove(l.id)}
                    title="حذف گزارش"
                    className="text-[10px] text-faint hover:text-red leading-none shrink-0 px-1"
                  >
                    ×
                  </button>
                </div>
                <div className="text-[13px] font-bold leading-relaxed mt-0.5">{title}</div>
                {rest && (
                  <div className="text-[12.5px] leading-relaxed whitespace-pre-wrap text-muted">{rest}</div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

/* ============================================================
   نمای خلاصه دوره — هفتگی (با خانه‌های روز) و ماهانه (فشرده)
   شامل: کارکرد، مزد، ثبت پرداختی، لیست پرداخت‌ها، مانده
   ============================================================ */
function SummaryView({ mode }: { mode: 'week' | 'month' | '6month' | '1year' }) {
  const { t } = useTranslation()
  const [anchor, setAnchor] = useState(todayJalali())

  // محدوده دوره: هفته / ماه / ۶ ماه / ۱ سال
  const days = useMemo(() => {
    if (mode === 'week') return weekDays(anchor)
    if (mode === 'month') return monthDays(anchor)
    const months = mode === '6month' ? 6 : 12
    const startRef = addMonths(anchor, -(months - 1))
    const s = startOfMonth(startRef)
    const e = endOfMonth(anchor)
    // ساخت آرایه روزها برای ستون‌های هفتگی (در دوره‌های بلند نمایش می‌شود)
    const arr: string[] = []
    let d = s
    while (d <= e) {
      arr.push(d)
      d = addDays(d, 1)
    }
    return arr
  }, [mode, anchor])
  const start = days[0]!
  const end = days[days.length - 1]!

  const workers = useLiveQuery(() => db.workers.toArray(), [], [] as Worker[])
  const attendances = useLiveQuery(
    () => db.attendances.where('date').between(start, end, true, true).toArray(),
    [start, end],
    [] as Attendance[],
  )
  const payments = useLiveQuery(
    () => db.payments.where('date').between(start, end, true, true).toArray(),
    [start, end],
    [] as Payment[],
  )
  const logs = useLiveQuery(
    () =>
      db.dayLogs
        .toArray()
        .then((all) => all.filter((l) => l.date >= start && l.date <= end)),
    [start, end],
    [] as DayLog[],
  )

  /* کارکرد و پرداختی از ابتدا تا پایان دوره — برای «مانده حساب» واقعی */
  const attAll = useLiveQuery(
    () => db.attendances.where('date').belowOrEqual(end).toArray(),
    [end],
    [] as Attendance[],
  )
  const payAll = useLiveQuery(
    () => db.payments.where('date').belowOrEqual(end).toArray(),
    [end],
    [] as Payment[],
  )

  const activeWorkers = workers.filter((w) => w.active)

  const rows = useMemo(() => {
    return activeWorkers.map((w) => {
      const atts = attendances.filter((a) => a.workerId === w.id)
      const totalHours = atts.reduce((s, a) => s + a.hours, 0)
      const daysWorked = atts.length
      const earned = Math.round((totalHours / 8) * w.dailyWage)
      const paid = payments.filter((p) => p.workerId === w.id).reduce((s, p) => s + p.amount, 0)
      const balance = earned - paid
      // مانده حساب از ابتدا تا پایان دوره + کارکرد قبلی (دستی)
      const attAllW = attAll.filter((a) => a.workerId === w.id)
      const hoursAll = attAllW.reduce((s, a) => s + a.hours, 0)
      const legacyDays = w.legacyDays ?? 0
      const legacyPaid = w.legacyPaid ?? 0
      const legacyEarned = Math.round(legacyDays * w.dailyWage)
      const earnedAll = Math.round((hoursAll / 8) * w.dailyWage) + legacyEarned
      const paidAll = payAll.filter((p) => p.workerId === w.id).reduce((s, p) => s + p.amount, 0) + legacyPaid
      const balanceAll = earnedAll - paidAll
      /* ارقام «کل» — از ابتدا تا پایان دوره + کارکرد/دریافتی قبلی */
      const daysAll = attAllW.length + legacyDays
      const hoursAllTotal = hoursAll + legacyDays * 8
      const byDay = days.map((d) => atts.find((a) => a.date === d) ?? null)
      return { w, byDay, totalHours, daysWorked, earned, paid, balance, balanceAll, daysAll, hoursAllTotal, earnedAll, paidAll }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workers, attendances, payments, attAll, payAll, start, end])

  const totals = rows.reduce(
    (acc, r) => ({
      earned: acc.earned + r.earned,
      paid: acc.paid + r.paid,
      balance: acc.balance + r.balance,
      balanceAll: acc.balanceAll + r.balanceAll,
      hours: acc.hours + r.totalHours,
      days: acc.days + r.daysWorked,
    }),
    { earned: 0, paid: 0, balance: 0, balanceAll: 0, hours: 0, days: 0 },
  )

  /* جمع کل جدول — از ابتدا تا پایان دوره + کارکرد/دریافتی قبلی */
  const tableTotals = rows.reduce(
    (acc, r) => ({
      earned: acc.earned + r.earnedAll,
      paid: acc.paid + r.paidAll,
      balanceAll: acc.balanceAll + r.balanceAll,
      hours: acc.hours + r.hoursAllTotal,
      days: acc.days + r.daysAll,
    }),
    { earned: 0, paid: 0, balanceAll: 0, hours: 0, days: 0 },
  )

  const [jy, jm] = start.split('-').map(Number)
  const [selectedWorkerId, setSelectedWorkerId] = useState<number | null>(null)
  const periodLabel =
    mode === 'week'
      ? t('workers.weekOf', { d: formatJalali(end) })
      : mode === 'month'
        ? t('workers.monthOf', { m: FA_MONTHS[jm! - 1], y: faDigits(jy!) })
        : mode === '6month'
          ? `دوره ۶ ماهه — ${formatJalaliShort(start)} تا ${formatJalaliShort(end)}`
          : `دوره ۱ ساله — ${formatJalaliShort(start)} تا ${formatJalaliShort(end)}`
  const periodRange =
    mode === 'week' ? `${formatJalaliShort(start)} — ${formatJalaliShort(end)}` : `${faDigits(days.length)} روز`

  const isLong = mode === '6month' || mode === '1year'
  const stepMonths = mode === '6month' ? 6 : 12

  function step(dir: -1 | 1) {
    if (mode === 'week') setAnchor(addDays(dir === 1 ? end : start, dir === 1 ? 7 : -7))
    else if (isLong) setAnchor(addMonths(anchor, dir * stepMonths))
    else setAnchor(addMonths(anchor, dir))
  }

  if (activeWorkers.length === 0) {
    return <EmptyState icon="👷" title={t('workers.noWorkers')} hint={t('workers.noWorkersHint')} />
  }

  return (
    <div className="space-y-4" id="workers-summary-export">
      {/* خلاصه دوره */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat
          label={mode === 'week' ? t('workers.totalEarned') : t('workers.totalEarnedMonth')}
          value={groupDigits(totals.earned)}
          unit="تومان"
          tone="accent"
        />
        <Stat label={t('workers.totalPaid')} value={groupDigits(totals.paid)} unit="تومان" tone="danger" />
        <Stat
          label="مانده حساب (کل)"
          value={groupDigits(totals.balanceAll)}
          unit="از ابتدا تا پایان دوره"
          tone={totals.balanceAll > 0 ? 'warn' : 'success'}
        />
        <Stat
          label={mode === 'week' ? t('workers.weekSummary') : t('workers.monthlyTitle')}
          value={`${faDigits(totals.days)} ${t('workers.day')}`}
          unit={`${fmtHours(totals.hours)} ساعت کارکرد`}
        />
      </div>

      {/* انتخاب دوره */}
      <div className="card flex items-center justify-between px-4 py-2.5 gap-2">
        <button className="btn !py-1 !px-3 text-[12.5px]" onClick={() => step(-1)}>
          › {mode === 'week' ? t('workers.prevWeek') : t('workers.prevMonth')}
        </button>
        <div className="text-center">
          <div className="text-[13.5px] font-semibold">{periodLabel}</div>
          <div className="text-[11px] text-faint">{periodRange}</div>
        </div>
        <div className="flex gap-1.5">
          <button className="btn !py-1 !px-3 text-[12.5px]" onClick={() => setAnchor(todayJalali())}>
            {mode === 'week'
              ? t('workers.thisWeek')
              : isLong
                ? 'دوره جاری'
                : t('workers.thisMonth')}
          </button>
          <button className="btn !py-1 !px-3 text-[12.5px]" onClick={() => step(1)}>
            {mode === 'week' ? t('workers.nextWeek') : t('workers.nextMonth')} ‹
          </button>
        </div>
      </div>

      {/* ثبت پرداختی */}
      <PaymentForm workers={activeWorkers} defaultDate={todayJalali()} />

      <div className="flex justify-end">
        <ExportMenu
          elementId="workers-summary-export"
          filename={`workers-${mode}-${todayJalali()}`}
          sheetName="Workers"
          data={rows.map(({ w, balanceAll, daysAll, hoursAllTotal, earnedAll, paidAll }) => ({
            نام: w.name,
            شغل: w.role,
            'حقوق روزانه': w.dailyWage,
            'روزهای کارکرد (کل)': daysAll,
            'ساعت کارکرد (کل)': hoursAllTotal,
            'مزد کارکرد (کل)': earnedAll,
            'پرداختی (کل)': paidAll,
            'مانده حساب (کل)': balanceAll,
          }))}
        />
      </div>

      {/* جدول */}
      <div className="card overflow-x-auto">
        <table className={`w-full text-[12.5px] ${mode === 'week' ? 'min-w-[960px]' : 'min-w-[720px]'}`}>
          <thead>
            <tr className="bg-surface-2 border-b border-line text-[11px] text-faint">
              <th className="text-start font-semibold px-3 py-2.5">{t('workers.tableWorker')}</th>
              <th className="text-start font-semibold px-2 py-2.5">{t('workers.tableRole')}</th>
              <th className="text-center font-semibold px-2 py-2.5">{t('workers.tableWage')}</th>
              {mode === 'week' &&
                days.map((d) => (
                  <th key={d} className="text-center font-semibold px-1 py-2.5 w-11">
                    <div>{weekdayOf(d).slice(0, 3)}</div>
                    <div className="text-[9.5px] text-faint font-normal">
                      {faDigits(d.split('-')[2]!.replace(/^0/, ''))}
                    </div>
                  </th>
                ))}
              <th className="text-center font-semibold px-2 py-2.5">{t('workers.daysCount')}</th>
              <th className="text-center font-semibold px-2 py-2.5">{t('workers.tableHours')}</th>
              <th className="text-center font-semibold px-2 py-2.5">{t('workers.tableWorked')}</th>
              <th className="text-center font-semibold px-2 py-2.5">{t('workers.tablePaid')}</th>
              <th className="text-center font-semibold px-3 py-2.5">مانده حساب (کل)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ w, byDay, balanceAll, daysAll, hoursAllTotal, earnedAll, paidAll }) => (
              <tr
                key={w.id}
                className="border-b border-line last:border-0 hover:bg-surface-2 transition-colors"
              >
                <td className="px-3 py-2.5 font-medium">
                  <span className="flex items-center gap-1.5">
                    <Avatar name={w.name} photo={w.photo} size={28} />
                    <button
                      className="underline underline-offset-2 hover:text-[color:var(--b-accent)]"
                      onClick={() => setSelectedWorkerId(w.id!)}
                      title="مشاهده جزئیات"
                    >
                      {w.name}
                    </button>
                    {w.isSelf && <Chip tone="accent" className="!text-[10px] !py-0">⭐ {t('workers.self')}</Chip>}
                  </span>
                </td>
                <td className="px-2 py-2.5 text-muted text-[11.5px]">{w.role}</td>
                <td className="px-2 py-2.5 text-center tabular-nums whitespace-nowrap text-muted">
                  {groupDigits(w.dailyWage)}
                </td>
                {mode === 'week' &&
                  byDay.map((a, i) => (
                    <td key={i} className="px-1 py-2.5 text-center">
                      {a ? (
                        <span
                          className="inline-block min-w-[34px] px-1 rounded-md text-[10.5px] font-semibold text-white tabular-nums"
                          style={{ background: 'var(--b-accent)' }}
                          title={`${fmtHours(a.hours)} ساعت`}
                        >
                          {fmtHours(a.hours)}
                        </span>
                      ) : (
                        <span className="inline-block w-6 h-6 rounded-md bg-surface-2 border border-line" />
                      )}
                    </td>
                  ))}
                <td className="px-2 py-2.5 text-center tabular-nums whitespace-nowrap font-semibold">
                  {faDigits(String(Number(daysAll.toFixed(2)))).replace('.', '٫')}
                </td>
                <td className="px-2 py-2.5 text-center tabular-nums whitespace-nowrap">{fmtHours(hoursAllTotal)}</td>
                <td className="px-2 py-2.5 text-center tabular-nums whitespace-nowrap font-semibold">
                  {groupDigits(earnedAll)}
                </td>
                <td
                  className="px-2 py-2.5 text-center tabular-nums whitespace-nowrap"
                  style={{ color: 'var(--b-red)' }}
                >
                  {paidAll ? groupDigits(paidAll) : '—'}
                </td>
                <td className="px-3 py-2.5 text-center">
                  <BalanceChip balance={balanceAll} />
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-surface-2 border-t-2 border-line font-bold">
              <td className="px-3 py-2.5" colSpan={3}>
                {t('workers.totalRow')}
              </td>
              <td className="px-2 py-2.5 text-center tabular-nums whitespace-nowrap" colSpan={mode === 'week' ? 8 : 1}>
                {faDigits(String(Number(tableTotals.days.toFixed(2)))).replace('.', '٫')} روز · {fmtHours(tableTotals.hours)} ساعت
              </td>
              <td className="px-2 py-2.5 text-center tabular-nums whitespace-nowrap">{groupDigits(tableTotals.earned)}</td>
              <td
                className="px-2 py-2.5 text-center tabular-nums whitespace-nowrap"
                style={{ color: 'var(--b-red)' }}
              >
                {groupDigits(tableTotals.paid)}
              </td>
              <td className="px-3 py-2.5 text-center">
                <BalanceChip balance={tableTotals.balanceAll} />
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* پرداخت‌های دوره */}
      <PaymentsList payments={payments} workers={workers} />

      {/* گزارش‌های متنی دوره */}
      {logs.length > 0 && (
        <div className="card p-4">
          <b className="text-[13.5px] block mb-3">📝 {t('workers.workLog')} — {periodLabel}</b>
          <div className="space-y-2.5">
            {[...logs]
              .sort((a, b) => (a.date < b.date ? 1 : -1))
              .map((l) => (
                <div key={l.id} className="bg-surface-2 border border-line rounded-lg px-3 py-2">
                  <div className="text-[11px] text-faint mb-0.5">
                    {formatJalali(l.date)} · {weekdayOf(l.date)}
                  </div>
                  <div className="text-[12.5px] leading-relaxed">{l.text}</div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* راهنما */}
      <div className="card p-3.5 flex flex-wrap gap-x-5 gap-y-2 text-[11.5px] text-muted">
        <span>
          <b className="text-ink">مزد کارکرد</b> = (ساعت ÷ ۸) × حقوق روزانه
        </span>
        <span className="chip chip-warn">طلبکار = باید بپردازم</span>
        <span className="chip chip-success">تسویه‌شده</span>
        <span className="chip chip-info">بدهکار = بیشتر از حد پرداخت کردم</span>
      </div>

      {selectedWorkerId != null && (
        <WorkerDetailModal workerId={selectedWorkerId} onClose={() => setSelectedWorkerId(null)} />
      )}
    </div>
  )
}

/* ============================================================
   ثبت پرداختی به کارگر
   ============================================================ */
function PaymentForm({ workers, defaultDate }: { workers: Worker[]; defaultDate: string }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [workerId, setWorkerId] = useState<number | ''>('')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(defaultDate)
  const [note, setNote] = useState('')
  const [category, setCategory] = useState('دستمزد')
  const [done, setDone] = useState(false)

  useEffect(() => setDate(defaultDate), [defaultDate])

  /** هر بار فرم پرداختی باز می‌شود، تاریخ روی «امروز» تنظیم می‌شود */
  function openForm() {
    setDate(todayJalali())
    setOpen(true)
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    const amt = Number(amount)
    if (!workerId || !amt || amt <= 0) return
    const w = workers.find((x) => x.id === workerId)
    const payDate = date || todayJalali()
    if (!isValidJalali(payDate)) {
      window.alert('تاریخ پرداخت معتبر نیست. لطفاً از تقویم انتخاب کن.')
      return
    }
    const trimmedNote = note.trim()
    const workerName = w?.name ?? ''
    const paymentId = await db.payments.add({
      workerId: Number(workerId),
      amount: Math.round(amt),
      date: payDate,
      projectId: w?.projectId ?? null,
      note: trimmedNote || undefined,
      createdAt: Date.now(),
    })
    await db.transactions.add({
      type: 'expense',
      category: category.trim() || 'دستمزد',
      amount: Math.round(amt),
      date: payDate,
      note: `پرداخت به ${workerName}${trimmedNote ? ` — ${trimmedNote}` : ''} [pay:${paymentId}]`,
      createdAt: Date.now(),
    })
    setAmount('')
    setNote('')
    setOpen(false)
    setDate(todayJalali())
    setDone(true)
    setTimeout(() => setDone(false), 2500)
  }

  return (
    <div>
      {!open ? (
        <div className="flex items-center gap-2">
          <button className="btn" onClick={openForm}>
            💵 {t('workers.addPayment')}
          </button>
          {done && (
            <span className="text-[12px]" style={{ color: 'var(--b-green)' }}>
              {t('workers.paySaved')}
            </span>
          )}
        </div>
      ) : (
        <form onSubmit={submit} className="card p-4 b-pop">
          <div className="flex items-center justify-between mb-3">
            <b className="text-[13.5px]">💵 {t('workers.addPayment')}</b>
            <button
              type="button"
              className="btn btn-ghost !px-2 !py-1 text-[12px]"
              onClick={() => setOpen(false)}
            >
              ✕
            </button>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <Field label={t('workers.tableWorker')}>
              <select
                className="field"
                value={workerId}
                onChange={(e) => setWorkerId(e.target.value === '' ? '' : Number(e.target.value))}
                required
              >
                <option value="">—</option>
                {workers.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name} {w.isSelf ? '⭐' : ''} · {w.role}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t('workers.amount')} hint="تومان">
              <NumberInput
                value={amount}
                onChange={(n) => setAmount(n === 0 ? '' : String(n))}
                placeholder="2000000"
                required
              />
            </Field>
            <Field label={t('workers.payDate')}>
              <DatePicker value={date} onChange={setDate} />
            </Field>
            <Field label={t('workers.payNote')}>
              <TextInput value={note} onChange={(e) => setNote(e.target.value)} placeholder="بابت هفته دوم مهر" />
            </Field>
            <div className="sm:col-span-2 lg:col-span-4">
              <Field label="دسته‌بندی (در مالی ثبت می‌شود)" hint="از دسته‌های آماده انتخاب کن یا دسته جدید بساز">
                <CategoryPicker group="expense" value={category} onChange={setCategory} />
              </Field>
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-3">
            <button type="button" className="btn" onClick={() => setOpen(false)}>
              {t('common.cancel')}
            </button>
            <button type="submit" className="btn btn-primary">
              {t('common.save')}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}

/* ============================================================
   لیست پرداخت‌های دوره
   ============================================================ */
function PaymentsList({ payments, workers }: { payments: Payment[]; workers: Worker[] }) {
  const { t } = useTranslation()
  if (payments.length === 0) return null

  const sorted = [...payments].sort((a, b) => (a.date < b.date ? 1 : -1))
  const total = payments.reduce((s, p) => s + p.amount, 0)

  async function remove(id?: number) {
    if (!id) return
    if (!window.confirm(t('projects.deleteConfirm'))) return
    await db.payments.delete(id)
    const tag = `[pay:${id}]`
    await db.transactions.filter((tx) => (tx.note ?? '').includes(tag)).delete()
  }

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-line">
        <b className="text-[13.5px]">💵 {t('workers.paymentsTitle')}</b>
        <span className="text-[12.5px] tabular-nums" style={{ color: 'var(--b-red)' }}>
          {groupDigits(total)} تومان
        </span>
      </div>
      {sorted.map((p) => {
        const w = workers.find((x) => x.id === p.workerId)
        return (
          <div
            key={p.id}
            className="flex items-center gap-3 px-4 py-2.5 border-b border-line last:border-0 hover:bg-surface-2"
          >
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-medium truncate">
                {w?.name ?? '—'} {w?.isSelf ? '⭐' : ''}
              </div>
              <div className="text-[11px] text-faint">
                {p.date} {p.note ? `· ${p.note}` : ''}
              </div>
            </div>
            <b className="tabular-nums text-[13px]" dir="ltr" style={{ color: 'var(--b-red)' }}>
              −{groupDigits(p.amount)}
            </b>
            <button
              className="text-faint hover:text-[color:var(--b-red)] text-[13px]"
              onClick={() => remove(p.id)}
              title={t('common.delete')}
            >
              🗑
            </button>
          </div>
        )
      })}
    </div>
  )
}

/* ============================================================
   افزودن نیرو (با گزینه «خودم»)
   ============================================================ */
function AddWorkerButton() {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [role, setRole] = useState('')
  const [wage, setWage] = useState('')
  const [phone, setPhone] = useState('')
  const [isSelf, setIsSelf] = useState(false)
  const [photo, setPhoto] = useState<string | undefined>(undefined)
  const projects = useLiveQuery(() => db.projects.toArray(), [], [])
  const [projectId, setProjectId] = useState<number | ''>('')

  async function onPhoto(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    try {
      setPhoto(await compressImage(f, 256, 0.8))
    } catch {
      /* ignore */
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim() || !role.trim()) return
    if (isSelf) {
      const olds = await db.workers.filter((w) => w.isSelf === true).toArray()
      await Promise.all(olds.map((w) => w.id && db.workers.update(w.id, { isSelf: false })))
    }
    await db.workers.add({
      name: name.trim(),
      role: role.trim(),
      dailyWage: Number(wage) || 0,
      phone: phone.trim() || undefined,
      projectId: projectId === '' ? null : Number(projectId),
      active: true,
      isSelf,
      photo: photo || undefined,
      createdAt: Date.now(),
    })
    setName('')
    setRole('')
    setWage('')
    setPhone('')
    setProjectId('')
    setIsSelf(false)
    setPhoto(undefined)
    setOpen(false)
  }

  if (!open) {
    return (
      <button className="btn btn-primary" onClick={() => setOpen(true)}>
        + {t('workers.addWorker')}
      </button>
    )
  }

  return (
    <div className="card p-4 w-full sm:w-[420px] b-pop">
      <form onSubmit={submit} className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <b className="text-[14px]">{t('workers.addWorker')}</b>
          <button
            type="button"
            className="btn btn-ghost !px-2 !py-1 text-[12px]"
            onClick={() => setOpen(false)}
          >
            ✕
          </button>
        </div>

        <Field label={t('workers.workerName')}>
          <TextInput
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="عباس محمدی"
            required
          />
        </Field>

        <div className="flex items-center gap-3">
          <Avatar name={name || '؟'} photo={photo} size={52} />
          <div className="flex flex-col items-start gap-1.5">
            <label className="btn !py-1 !px-3 text-[12px] cursor-pointer">
              انتخاب عکس
              <input type="file" accept="image/*" className="hidden" onChange={onPhoto} />
            </label>
            {photo && (
              <button
                type="button"
                className="text-[11.5px] text-faint hover:text-[color:var(--b-red)]"
                onClick={() => setPhoto(undefined)}
              >
                حذف عکس
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label={t('workers.role')} hint={t('workers.roleHint')}>
            <TextInput
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="بنا"
              required
            />
          </Field>
          <Field label={t('workers.dailyWage')} hint={t('workers.dailyWageHint')}>
            <NumberInput
              value={wage}
              onChange={(n) => setWage(n === 0 ? '' : String(n))}
              placeholder="800000"
              dir="ltr"
              required
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label={t('common.optional')}>
            <TextInput
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="0912…"
              dir="ltr"
            />
          </Field>
          <Field label={t('task.project')}>
            <select
              className="field"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value === '' ? '' : Number(e.target.value))}
            >
              <option value="">—</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <label className="flex items-center gap-2.5 bg-surface-2 border border-line rounded-lg px-3 py-2.5 cursor-pointer text-[13px]">
          <input
            type="checkbox"
            checked={isSelf}
            onChange={(e) => setIsSelf(e.target.checked)}
            className="w-4 h-4 accent-[var(--b-accent)]"
          />
          ⭐ {t('workers.markSelf')}
        </label>

        <div className="flex gap-2 justify-end">
          <button type="button" className="btn" onClick={() => setOpen(false)}>
            {t('workers.cancel')}
          </button>
          <button type="submit" className="btn btn-primary">
            {t('workers.saveWorker')}
          </button>
        </div>
      </form>
    </div>
  )
}

/* ============================================================
   مدیریت نیروها — لیست همه نیروها با ویرایش inline و حذف آبشاری
   ============================================================ */
function WorkerManager() {
  const { t } = useTranslation()
  const workers = useLiveQuery(() => db.workers.toArray(), [], [] as Worker[])
  const projects = useLiveQuery(() => db.projects.orderBy('createdAt').toArray(), [], [] as { id?: number; name: string }[])
  const [open, setOpen] = useState(false)
  const [showInactive, setShowInactive] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [fName, setFName] = useState('')
  const [fRole, setFRole] = useState('')
  const [fWage, setFWage] = useState('')
  const [fPhone, setFPhone] = useState('')
  const [fProject, setFProject] = useState<number | ''>('')
  const [fActive, setFActive] = useState(true)
  const [fPhoto, setFPhoto] = useState<string | undefined>(undefined)

  if (!workers || workers.length === 0) return null

  const activeWorkers = workers.filter((w) => w.active)
  const inactiveWorkers = workers.filter((w) => !w.active)
  // فقط نیروهای فعال نمایش داده می‌شوند؛ غیرفعال‌ها پشت یک دکمه هستند
  const visible = showInactive ? [...activeWorkers, ...inactiveWorkers] : activeWorkers

  function startEdit(w: Worker) {
    setEditingId(w.id!)
    setFName(w.name)
    setFRole(w.role)
    setFWage(String(w.dailyWage))
    setFPhone(w.phone ?? '')
    setFProject(w.projectId ?? '')
    setFActive(w.active)
    setFPhoto(w.photo)
  }

  async function onFPhoto(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    try {
      setFPhoto(await compressImage(f, 256, 0.8))
    } catch {
      /* ignore */
    }
  }

  async function saveEdit(e: FormEvent) {
    e.preventDefault()
    if (editingId == null || !fName.trim() || !fRole.trim()) return
    await db.workers.update(editingId, {
      name: fName.trim(),
      role: fRole.trim(),
      dailyWage: Number(fWage) || 0,
      phone: fPhone.trim() || undefined,
      projectId: fProject === '' ? null : Number(fProject),
      active: fActive,
      photo: fPhoto || undefined,
    })
    setEditingId(null)
  }

  async function toggleWorkerActive(id: number, active: boolean) {
    await db.workers.update(id, { active })
    if (!active) setEditingId(null)
  }

  async function removeWorker(w: Worker) {
    if (!w.id) return
    if (!window.confirm(t('workers.deleteWorkerConfirm'))) return
    const wid = w.id
    const pays = await db.payments.where('workerId').equals(wid).toArray()
    await db.payments.where('workerId').equals(wid).delete()
    await db.attendances.where('workerId').equals(wid).delete()
    for (const p of pays) {
      if (p.id == null) continue
      const tag = `[pay:${p.id}]`
      await db.transactions.filter((tx) => (tx.note ?? '').includes(tag)).delete()
    }
    await db.workers.delete(wid)
    if (editingId === wid) setEditingId(null)
  }

  return (
    <div className="card overflow-hidden mb-4">
      <button
        type="button"
        className="w-full flex items-center justify-between gap-2 px-4 py-3 text-start"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="flex items-center gap-2 flex-wrap">
          <b className="text-[13.5px]">👷 {t('workers.manage')}</b>
          <Chip tone="success" className="!text-[10.5px] !py-0">
            {faDigits(activeWorkers.length)} {t('workers.active')}
          </Chip>
          {inactiveWorkers.length > 0 && (
            <Chip className="!text-[10.5px] !py-0">
              {faDigits(inactiveWorkers.length)} {t('workers.inactive')}
            </Chip>
          )}
        </span>
        <span className="text-faint text-[12px]">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="border-t border-line">
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 bg-surface-2 border-b border-line">
            <span className="text-[11.5px] text-muted">{t('workers.manageHint')}</span>
            {inactiveWorkers.length > 0 && (
              <button
                type="button"
                className="btn btn-ghost !py-1 !px-2.5 text-[11.5px]"
                onClick={() => setShowInactive((v) => !v)}
              >
                {showInactive
                  ? t('workers.hideInactive')
                  : t('workers.showInactive', { n: faDigits(inactiveWorkers.length) })}
              </button>
            )}
          </div>

          {visible.length === 0 && (
            <div className="px-4 py-5 text-[12.5px] text-faint text-center">{t('workers.noActive')}</div>
          )}

          {visible.map((w) => (
            <div key={w.id} className="px-4 py-2.5 border-b border-line last:border-0">
              <div className="flex items-center gap-3">
                <Avatar name={w.name} photo={w.photo} size={34} />
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-medium truncate">
                    {w.name}
                    {!w.active && (
                      <span className="chip !text-[10px] !py-0 ms-1">{t('workers.inactive')}</span>
                    )}
                  </div>
                  <div className="text-[11px] text-faint">
                    {w.role} · {groupDigits(w.dailyWage)} {t('common.unitToman')}/{t('workers.day')} {w.phone ? `· ${w.phone}` : ''}
                  </div>
                </div>
                <button
                  className="text-[13px] px-1.5 py-0.5 hover:opacity-70"
                  onClick={() => (editingId === w.id ? setEditingId(null) : startEdit(w))}
                  title={t('task.edit')}
                >
                  ✏️
                </button>
                <button
                  className="text-[13px] px-1.5 py-0.5 hover:opacity-70"
                  onClick={() => removeWorker(w)}
                  title={t('workers.deleteWorker')}
                >
                  🗑
                </button>
                <button
                  className={`text-[13px] px-1.5 py-0.5 hover:opacity-70 ${w.active ? 'text-accent' : 'text-faint'}`}
                  onClick={() => toggleWorkerActive(w.id!, !w.active)}
                  title={w.active ? t('workers.disable') : t('workers.enable')}
                >
                  {w.active ? '⏸' : '▶'}
                </button>
              </div>
              {editingId === w.id && (
                <form onSubmit={saveEdit} className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2.5 mt-2.5 bg-surface-2 border border-line rounded-lg p-3">
                  <div className="flex items-center gap-3 sm:col-span-2 lg:col-span-3">
                    <Avatar name={fName || w.name} photo={fPhoto} size={48} />
                    <div className="flex flex-col items-start gap-1.5">
                      <label className="btn !py-1 !px-3 text-[12px] cursor-pointer">
                        {fPhoto ? t('workers.changePhoto') : t('workers.pickPhoto')}
                        <input type="file" accept="image/*" className="hidden" onChange={onFPhoto} />
                      </label>
                      {fPhoto && (
                        <button
                          type="button"
                          className="text-[11.5px] text-faint hover:text-[color:var(--b-red)]"
                          onClick={() => setFPhoto(undefined)}
                        >
                          {t('workers.removePhoto')}
                        </button>
                      )}
                    </div>
                  </div>
                  <Field label={t('workers.workerName')}>
                    <TextInput value={fName} onChange={(e) => setFName(e.target.value)} required />
                  </Field>
                  <Field label={t('workers.role')}>
                    <TextInput value={fRole} onChange={(e) => setFRole(e.target.value)} required />
                  </Field>
                  <Field label={`${t('workers.dailyWage')} (${t('common.unitToman')})`}>
                    <NumberInput value={fWage} onChange={(n) => setFWage(n === 0 ? '' : String(n))} />
                  </Field>
                  <Field label={t('workers.phone')}>
                    <TextInput value={fPhone} onChange={(e) => setFPhone(e.target.value)} dir="ltr" />
                  </Field>
                  <Field label={t('task.project')}>
                    <select className="field" value={fProject} onChange={(e) => setFProject(e.target.value === '' ? '' : Number(e.target.value))}>
                      <option value="">—</option>
                      {projects.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <label className="flex items-center gap-2 text-[12.5px] self-end pb-2">
                    <input type="checkbox" checked={fActive} onChange={(e) => setFActive(e.target.checked)} className="w-4 h-4 accent-[var(--b-accent)]" />
                    {t('workers.active')}
                  </label>
                  <div className="flex gap-2 justify-end sm:col-span-2 lg:col-span-3">
                    <button type="button" className="btn !py-1 !px-3 text-[12px]" onClick={() => setEditingId(null)}>
                      {t('common.cancel')}
                    </button>
                    <button type="submit" className="btn btn-primary !py-1 !px-3 text-[12px]">
                      {t('common.save')}
                    </button>
                  </div>
                </form>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ============================================================
   جزئیات کارگر — مودال با مشخصات، جمع‌ها، کارکردها و دریافتی‌ها
   ============================================================ */
/* ============================================================
   خروجی گرفتن از یک کارگر — داخل مودال جزئیات
   نوع خروجی (CSV/JSON) + انتخاب محتواها
   ============================================================ */
function WorkerExportBox({
  worker,
  attendances,
  payments,
  projectName,
  earned,
  paid,
  balance,
  totalDays,
}: {
  worker: Worker | undefined
  attendances: Attendance[]
  payments: Payment[]
  projectName: (pid?: number | null) => string
  earned: number
  paid: number
  balance: number
  totalDays?: number
}) {
  const [open, setOpen] = useState(false)
  const [format, setFormat] = useState<'csv' | 'json'>('csv')
  const [incProfile, setIncProfile] = useState(true)
  const [incSummary, setIncSummary] = useState(true)
  const [incAtt, setIncAtt] = useState(true)
  const [incPay, setIncPay] = useState(true)

  if (!worker) return null

  const sortedAtt = [...attendances].sort((a, b) => (a.date < b.date ? 1 : -1))
  const sortedPay = [...payments].sort((a, b) => (a.date < b.date ? 1 : -1))
  const totalHours = attendances.reduce((s, a) => s + a.hours, 0)

  function cell(v: string | number): string {
    const s = String(v).replace(/"/g, '""')
    return `"${s}"`
  }

  async function doExport() {
    if (!worker) return
    const stamp = todayJalali()
    const base = `worker-${worker.name.replace(/\s+/g, '_')}-${stamp}`
    if (format === 'json') {
      await downloadJSON(
        {
          worker: incProfile ? { name: worker.name, role: worker.role, phone: worker.phone ?? '', dailyWage: worker.dailyWage } : undefined,
          summary: incSummary ? { days: totalDays ?? attendances.length, totalHours, earned, paid, balance } : undefined,
          attendances: incAtt ? sortedAtt.map((a) => ({ date: a.date, hours: a.hours, project: projectName(a.projectId) })) : undefined,
          payments: incPay ? sortedPay.map((p) => ({ date: p.date, amount: p.amount, note: p.note ?? '' })) : undefined,
          exportedAt: new Date().toISOString(),
        },
        `${base}.json`,
      )
      return
    }
    const lines: string[] = ['\uFEFF']
    if (incProfile) {
      lines.push('مشخصات');
      lines.push(['نام', 'شغل', 'تلفن', 'حقوق روزانه (تومان)'].map(cell).join(','));
      lines.push([worker.name, worker.role, worker.phone ?? '', worker.dailyWage].map(cell).join(','));
      lines.push('');
    }
    if (incSummary) {
      lines.push('جمع‌بندی');
      lines.push(['روزها', 'ساعت', 'مزد (تومان)', 'دریافتی (تومان)', 'مانده (تومان)'].map(cell).join(','));
      lines.push([totalDays ?? attendances.length, totalHours, earned, paid, balance].map(cell).join(','));
      lines.push('');
    }
    if (incAtt) {
      lines.push('کارکرد روزانه');
      lines.push(['تاریخ', 'ساعت', 'مزد روز (تومان)', 'پروژه'].map(cell).join(','));
      for (const a of sortedAtt) {
        lines.push([a.date, a.hours, Math.round((a.hours / 8) * worker.dailyWage), projectName(a.projectId)].map(cell).join(','));
      }
      lines.push('');
    }
    if (incPay) {
      lines.push('دریافتی‌ها');
      lines.push(['تاریخ', 'مبلغ (تومان)', 'توضیح'].map(cell).join(','));
      for (const p of sortedPay) {
        lines.push([p.date, p.amount, p.note ?? ''].map(cell).join(','));
      }
    }
    const { saveTextFile } = await import('../lib/native')
    await saveTextFile(`${base}.csv`, lines.join('\n'), 'text/csv;charset=utf-8')
  }

  if (!open) {
    return (
      <button className="btn w-full mb-4 !text-[12.5px]" onClick={() => setOpen(true)}>
        ⬇ خروجی گرفتن از این کارگر…
      </button>
    )
  }

  const checks: [boolean, (v: boolean) => void, string][] = [
    [incProfile, setIncProfile, 'مشخصات'],
    [incSummary, setIncSummary, 'جمع‌بندی (روز/ساعت/مزد/مانده)'],
    [incAtt, setIncAtt, `کارکرد روزانه (${faDigits(sortedAtt.length)})`],
    [incPay, setIncPay, `دریافتی‌ها با تاریخ (${faDigits(sortedPay.length)})`],
  ]

  return (
    <div className="border border-line rounded-xl p-3 mb-4 bg-surface">
      <div className="flex items-center justify-between mb-2.5">
        <b className="text-[13px]">⬇ خروجی گرفتن</b>
        <button className="btn btn-ghost !px-2 !py-0.5 text-[11.5px]" onClick={() => setOpen(false)}>✕</button>
      </div>
      <div className="flex gap-1.5 mb-2.5">
        <button type="button" className={`btn !py-1 !px-3 text-[12px] flex-1 ${format === 'csv' ? 'btn-primary' : ''}`} onClick={() => setFormat('csv')}>CSV (اکسل)</button>
        <button type="button" className={`btn !py-1 !px-3 text-[12px] flex-1 ${format === 'json' ? 'btn-primary' : ''}`} onClick={() => setFormat('json')}>JSON</button>
      </div>
      <div className="flex flex-col gap-1.5 mb-3">
        {checks.map(([v, set, label], i) => (
          <label key={i} className="flex items-center gap-2 text-[12.5px] cursor-pointer">
            <input type="checkbox" checked={v} onChange={(e) => set(e.target.checked)} className="w-4 h-4 accent-[var(--b-accent)]" />
            {label}
          </label>
        ))}
      </div>
      <button className="btn btn-primary w-full !text-[12.5px]" onClick={doExport} disabled={!incProfile && !incSummary && !incAtt && !incPay}>
        دانلود خروجی
      </button>
    </div>
  )
}

function WorkerDetailModal({ workerId, onClose }: { workerId: number; onClose: () => void }) {
  const worker = useLiveQuery(() => db.workers.get(workerId), [workerId])
  const attendances = useLiveQuery(
    () => db.attendances.where('workerId').equals(workerId).toArray(),
    [workerId],
    [] as Attendance[],
  )
  const payments = useLiveQuery(
    () => db.payments.where('workerId').equals(workerId).toArray(),
    [workerId],
    [] as Payment[],
  )
  const projects = useLiveQuery(() => db.projects.toArray(), [], [] as { id?: number; name: string }[])

  const totalHours = attendances.reduce((s, a) => s + a.hours, 0)
  const days = attendances.length
  const earned = worker ? Math.round((totalHours / 8) * worker.dailyWage) : 0
  const paid = payments.reduce((s, p) => s + p.amount, 0)
  /* کارکرد قبلی (دستی) — برای نیروهایی که سابقه‌شان در برنامه ثبت نشده */
  const legacyDays = worker?.legacyDays ?? 0
  const legacyPaid = worker?.legacyPaid ?? 0
  const legacyEarned = worker ? Math.round(legacyDays * worker.dailyWage) : 0
  const earnedAll = earned + legacyEarned
  const paidAll = paid + legacyPaid
  const balance = earnedAll - paidAll
  const totalDays = days + legacyDays

  function fmtDays(n: number): string {
    return faDigits(String(Number(n.toFixed(2)))).replace('.', '٫')
  }

  function saveLegacy(patch: { legacyDays?: number; legacyPaid?: number }) {
    if (worker?.id) void db.workers.update(worker.id, patch)
  }

  function projectName(pid?: number | null): string {
    if (pid == null) return '—'
    return projects.find((p) => p.id === pid)?.name ?? '—'
  }

  async function removeAttendance(id?: number) {
    if (!id) return
    if (!window.confirm('این رکورد کارکرد حذف بشه؟')) return
    await db.attendances.delete(id)
  }

  async function removePayment(id?: number) {
    if (!id) return
    if (!window.confirm('این پرداختی حذف بشه؟')) return
    await db.payments.delete(id)
    const tag = `[pay:${id}]`
    await db.transactions.filter((tx) => (tx.note ?? '').includes(tag)).delete()
  }

  /** تصفیه حساب: پرداخت کامل مانده و بستن حساب کارگر */
  async function settle() {
    if (!worker?.id || balance <= 0) return
    if (!window.confirm(`تصفیه حساب ${worker.name}: مبلغ ${groupDigits(balance)} تومان پرداخت شود؟`)) return
    const payId = await db.payments.add({
      workerId: worker.id,
      amount: balance,
      date: todayJalali(),
      projectId: worker.projectId ?? null,
      note: 'تصفیه حساب',
      createdAt: Date.now(),
    })
    await db.transactions.add({
      type: 'expense',
      category: 'دستمزد',
      amount: balance,
      date: todayJalali(),
      note: `تصفیه حساب ${worker.name} [pay:${payId}]`,
      createdAt: Date.now(),
    })
    /* مودال را می‌بندیم تا کاربر بروزرسانی جدول (روزها/دریافتی/مانده/تسویه) را ببیند */
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/45 p-4" onClick={onClose}>
      <div className="card w-full max-w-md max-h-[85vh] overflow-y-auto p-3.5 b-pop" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-2.5">
          <span className="flex items-center gap-2 min-w-0">
            <Avatar name={worker?.name ?? '؟'} photo={worker?.photo} size={38} />
            <b className="text-[13.5px] truncate">👷 {worker?.name ?? '…'}</b>
          </span>
          <button className="btn btn-ghost !px-2 !py-1 text-[12px]" onClick={onClose}>
            ✕
          </button>
        </div>

        {worker && (
          <div className="text-[11.5px] text-muted mb-2.5 truncate">
            {worker.role} · {groupDigits(worker.dailyWage)} تومان/روز {worker.phone ? `· ${worker.phone}` : ''}
          </div>
        )}

        <div className="grid grid-cols-3 gap-1.5 mb-3 text-center">
          <div className="bg-surface-2 border border-line rounded-lg px-1 py-1.5">
            <div className="text-[10px] text-muted">روزها (کل)</div>
            <div className="font-bold tabular-nums text-[12px]">{fmtDays(totalDays)}</div>
          </div>
          <div className="bg-surface-2 border border-line rounded-lg px-1 py-1.5">
            <div className="text-[10px] text-muted">ساعت</div>
            <div className="font-bold tabular-nums text-[12px]">{fmtHours(totalHours)}</div>
          </div>
          <div className="bg-surface-2 border border-line rounded-lg px-1 py-1.5">
            <div className="text-[10px] text-muted">مزد (کل)</div>
            <div className="font-bold tabular-nums text-[11.5px]">{groupDigits(earnedAll)}</div>
          </div>
          <div className="bg-surface-2 border border-line rounded-lg px-1 py-1.5">
            <div className="text-[10px] text-muted">پرداختی (کل)</div>
            <div className="font-bold tabular-nums text-[11.5px]" style={{ color: 'var(--b-red)' }}>{groupDigits(paidAll)}</div>
          </div>
          <div className="bg-surface-2 border border-line rounded-lg px-1 py-1.5 col-span-2">
            <div className="text-[10px] text-muted">مانده حساب (کل)</div>
            <div className="font-bold tabular-nums text-[11.5px]"><BalanceChip balance={balance} /></div>
          </div>
        </div>

        {/* کارکرد قبلی — برای نیروهای قدیمی */}
        <div className="border border-line rounded-lg p-2 mb-3">
          <div className="flex items-center justify-between mb-1.5">
            <b className="text-[11.5px]">🗂 کارکرد قبلی (قبل از برنامه)</b>
            <span className="text-[9.5px] text-faint">برای نیروهای قدیمی</span>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <label className="block">
              <span className="text-[10px] text-muted block mb-0.5">روزهای کارکرد قبلی</span>
              <NumberInput
                decimal
                className="field !py-1 !text-[12px]"
                placeholder="0"
                value={worker?.legacyDays ? String(worker.legacyDays) : ''}
                onChange={(n) => saveLegacy({ legacyDays: n })}
              />
            </label>
            <label className="block">
              <span className="text-[10px] text-muted block mb-0.5">دریافتی قبلی (تومان)</span>
              <NumberInput
                className="field !py-1 !text-[12px]"
                placeholder="0"
                value={worker?.legacyPaid ? String(worker.legacyPaid) : ''}
                onChange={(n) => saveLegacy({ legacyPaid: n })}
              />
            </label>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-x-2 text-[10.5px] mt-1.5">
            <span className="text-muted">طلب قبلی: <b className="tabular-nums">{groupDigits(legacyEarned)}</b> تومان</span>
            <span className="text-muted">
              مانده قبلی:{' '}
              <b
                className="tabular-nums"
                style={{ color: legacyEarned - legacyPaid > 0 ? 'var(--b-orange)' : 'var(--b-green)' }}
              >
                {groupDigits(legacyEarned - legacyPaid)}
              </b>{' '}
              تومان
            </span>
          </div>
          <div className="text-[9.5px] text-faint mt-1">
            روزمزد × روزهای قبلی = طلب قبلی؛ بعد از پرداخت، دکمهٔ «تصفیه حساب کلی» مانده را صفر می‌کند.
          </div>
        </div>

        {balance > 0 ? (
          <button className="btn btn-primary w-full mb-3 !text-[12px] !py-1.5" onClick={settle}>
            💰 تصفیه حساب کلی ({groupDigits(balance)} تومان)
          </button>
        ) : (
          <button className="btn w-full mb-3 !text-[12px] !py-1.5" disabled title="مانده‌ای برای پرداخت نیست">
            ✅ حساب تسویه است
          </button>
        )}
        {balance < 0 && (
          <div className="text-[11.5px] text-faint mb-3">این کارگر {groupDigits(Math.abs(balance))} تومان بدهکار است.</div>
        )}

        <WorkerExportBox
          worker={worker}
          attendances={attendances}
          payments={payments}
          projectName={projectName}
          earned={earnedAll}
          paid={paidAll}
          balance={balance}
          totalDays={totalDays}
        />

        <b className="text-[13px] block mb-2">کارکردها ({faDigits(days)})</b>        <div className="space-y-1 mb-4 max-h-[220px] overflow-y-auto">
          {[...attendances]
            .sort((a, b) => (a.date < b.date ? 1 : -1))
            .map((a) => (
              <div key={a.id} className="flex items-center gap-2 text-[12px] bg-surface-2 border border-line rounded-md px-2.5 py-1.5">
                <span className="tabular-nums">{formatJalali(a.date)}</span>
                <span className="tabular-nums text-muted">{fmtHours(a.hours)} ساعت</span>
                <span className="text-faint truncate flex-1">{projectName(a.projectId)}</span>
                <button onClick={() => removeAttendance(a.id)} title="حذف" className="text-[10px] text-faint hover:text-red px-1 leading-none">×</button>
              </div>
            ))}
          {attendances.length === 0 && <div className="text-[12px] text-faint">کارکردی ثبت نشده.</div>}
        </div>

        <b className="text-[13px] block mb-2">دریافتی‌ها ({faDigits(payments.length)})</b>
        <div className="space-y-1 max-h-[200px] overflow-y-auto">
          {[...payments]
            .sort((a, b) => (a.date < b.date ? 1 : -1))
            .map((p) => (
              <div key={p.id} className="flex items-center gap-2 text-[12px] bg-surface-2 border border-line rounded-md px-2.5 py-1.5">
                <span className="tabular-nums">{formatJalali(p.date)}</span>
                <b className="tabular-nums" style={{ color: 'var(--b-red)' }}>{groupDigits(p.amount)}</b>
                <span className="text-faint truncate flex-1">{p.note ?? ''}</span>
                <button onClick={() => removePayment(p.id)} title="حذف" className="text-[10px] text-faint hover:text-red px-1 leading-none">×</button>
              </div>
            ))}
          {payments.length === 0 && <div className="text-[12px] text-faint">پرداختی ثبت نشده.</div>}
        </div>
      </div>
    </div>
  )
}

/* ============================================================
   قطعات کمکی
   ============================================================ */
function Stat({
  label,
  value,
  unit,
  tone,
}: {
  label: string
  value: string
  unit?: string
  tone?: 'accent' | 'danger' | 'warn' | 'success'
}) {
  const colors = {
    accent: 'var(--b-accent)',
    danger: 'var(--b-red)',
    warn: 'var(--b-orange)',
    success: 'var(--b-green)',
  }
  return (
    <div className="card p-3.5 min-w-0">
      <div className="text-[11.5px] text-muted truncate">{label}</div>
      <div
        className="text-[17px] font-bold mt-0.5 tabular-nums leading-tight truncate"
        style={{ color: tone ? colors[tone] : undefined }}
        dir="ltr"
        title={value}
      >
        {value}
      </div>
      {unit && <div className="text-[10.5px] text-faint truncate">{unit}</div>}
    </div>
  )
}

function BalanceChip({ balance }: { balance: number }) {
  const { t } = useTranslation()
  if (balance === 0) return <Chip tone="success">{t('workers.settled')}</Chip>
  if (balance > 0)
    return (
      <Chip tone="warn" className="truncate">
        <span className="truncate">{t('workers.creditor')} {groupDigits(balance)}</span>
      </Chip>
    )
  return (
    <Chip tone="info" className="truncate">
      <span className="truncate">{t('workers.debtor')} {groupDigits(Math.abs(balance))}</span>
    </Chip>
  )
}

/** مزد یک روز = (ساعت ÷ ۸) × حقوق روزانه */
function dailyPay(w: Worker | undefined, workedHours: number): number {
  if (!w) return 0
  return Math.round((workedHours / 8) * w.dailyWage)
}

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
