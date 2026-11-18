import { useEffect, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Task, type Priority, type TaskStatus } from '../db/schema'
import { useSettings } from '../store/settings'
import { todayJalali, daysUntil, toJalali, formatJalali, addDays, monthDays, startOfMonth, addMonths, weekdayOf, FA_MONTHS } from '../lib/jalali'
import { quoteOfDay, randomQuote, type Quote } from '../lib/quotes'
import { faDigits } from '../lib/format'
import { EmptyState, Bar } from '../ui/components'

const PRIO_TONE = ['chip-danger', 'chip-warn', 'chip-info', ''] as const
/** برچسب فارسی اولویت‌ها — جواب سوال P1/P2 */
export const PRIO_FA = ['فوری', 'مهم', 'معمولی', 'کم'] as const

export function prioLabel(p: Priority): string {
  return `${PRIO_FA[p]} P${p}`
}

export default function TodayPage() {
  const { t } = useTranslation()
  const [draft, setDraft] = useState('')
  const [prio, setPrio] = useState<Priority>(2)
  const [expanded, setExpanded] = useState<number | null>(null)
  const [addingSub, setAddingSub] = useState<number | null>(null)
  const [subDraft, setSubDraft] = useState('')

  const today = todayJalali()

  const tasks = useLiveQuery(async () => {
    const all = await db.tasks.orderBy('order').toArray()
    return all
  }, [], [] as Task[])

  /** کارهای روز: سررسید امروز یا عقب‌افتاده یا بدون تاریخ (در جریان) */
  const roots = tasks.filter((x) => !x.parentId)
  const open = roots.filter((x) => x.status !== 'done')
  const todayList: Task[] = []
  const restList: Task[] = []
  for (const task of open) {
    if (!task.dueDate) restList.push(task)
    else if (task.dueDate <= today) todayList.push(task)
    else restList.push(task)
  }
  const byPrio = (a: Task, b: Task) => a.priority - b.priority || a.order - b.order
  todayList.sort(byPrio)
  restList.sort(byPrio)
  const doneToday = roots.filter(
    (x) => x.status === 'done' && x.completedAt && sameDay(new Date(x.completedAt), today),
  )
  const todayTasks = todayList
  const restTasks = [...restList, ...doneToday]

  const allVisible = [...todayTasks, ...restTasks]
  const doneCount = allVisible.filter((x) => x.status === 'done').length
  const totalCount = allVisible.length
  const pct = totalCount ? Math.round((doneCount / totalCount) * 100) : 0

  const hour = new Date().getHours()
  const greetingKey = hour < 12 ? 'today.greeting' : hour < 17 ? 'today.greetingAfternoon' : 'today.greetingEvening'
  const userName = useSettings((s) => s.userName).trim()
  const greeting = userName ? `${t(greetingKey)} ${userName}` : t(greetingKey)

  async function addTask(e: FormEvent) {
    e.preventDefault()
    const title = draft.trim()
    if (!title) return
    await db.tasks.add({
      title,
      notes: '',
      projectId: null,
      parentId: null,
      status: 'todo',
      priority: prio,
      dueDate: today,
      tags: [],
      order: Date.now(),
      createdAt: Date.now(),
      completedAt: null,
    })
    setDraft('')
  }

  async function addSubtask(parentId: number, e: FormEvent) {
    e.preventDefault()
    const title = subDraft.trim()
    if (!title) return
    await db.tasks.add({
      title,
      notes: '',
      projectId: null,
      parentId,
      status: 'todo',
      priority: 2,
      dueDate: null,
      tags: [],
      order: Date.now(),
      createdAt: Date.now(),
      completedAt: null,
    })
    setSubDraft('')
    setAddingSub(null)
  }

  async function toggle(task: Task) {
    if (!task.id) return
    const done = task.status === 'done'
    await db.tasks.update(task.id, {
      status: done ? 'todo' : 'done',
      completedAt: done ? null : Date.now(),
    })
    if (!done) {
      const subs = await db.tasks.where('parentId').equals(task.id).toArray()
      await Promise.all(
        subs.map((s) => s.id && db.tasks.update(s.id, { status: 'done', completedAt: Date.now() })),
      )
    }
  }

  async function cycleStatus(task: Task) {
    if (!task.id) return
    const order: TaskStatus[] = ['todo', 'doing', 'waiting', 'done']
    const next = order[(order.indexOf(task.status) + 1) % order.length]!
    await db.tasks.update(task.id, {
      status: next,
      completedAt: next === 'done' ? Date.now() : null,
    })
  }

  async function remove(id?: number) {
    if (!id) return
    if (!window.confirm('این تسک حذف بشه؟')) return
    const subs = await db.tasks.where('parentId').equals(id).toArray()
    await db.tasks.bulkDelete([...subs.map((s) => s.id!), id])
  }

  return (
    <div className="b-view max-w-4xl mx-auto">
      <DigitalClock />
      <div className="mb-5">
        <h1 className="text-[22px] font-bold tracking-tight">{greeting}</h1>
        {!userName && (
          <p className="text-[11.5px] text-faint mt-0.5">
            💡 اسمت را در تنظیمات ← «نام شما» وارد کن تا اینجا نمایش داده شود.
          </p>
        )}
        <DailyQuote today={today} />
        <p className="text-[13px] text-muted mt-1">
          {totalCount === 0
            ? t('today.subtitleDone')
            : t('today.subtitle', { n: faDigits(todayTasks.length) })}
        </p>
        <div className="flex items-center gap-4 mt-4">
          <Bar value={pct} className="flex-1" />
          <div className="text-xs text-muted whitespace-nowrap tabular-nums">
            {t('today.progress', {
              done: faDigits(doneCount),
              total: faDigits(totalCount),
              pct: faDigits(pct),
            })}
          </div>
        </div>
      </div>

      <form
        onSubmit={addTask}
        className="flex items-center gap-2.5 border border-dashed border-line rounded-xl px-3.5 py-2.5 mb-5 bg-surface hover:border-accent transition-colors"
      >
        <span
          className="w-5 h-5 rounded-md grid place-items-center text-sm font-semibold shrink-0"
          style={{ background: 'var(--b-accent-soft)', color: 'var(--b-accent)' }}
        >
          +
        </span>
        <input
          className="flex-1 bg-transparent outline-none text-[13.5px] placeholder:text-faint"
          placeholder={t('today.quickAdd')}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
        <select
          className="field !w-auto !py-1 !px-2 !text-[11.5px]"
          value={prio}
          onChange={(e) => setPrio(Number(e.target.value) as Priority)}
          title="اولویت تسک جدید"
        >
          <option value={0}>فوری P0</option>
          <option value={1}>مهم P1</option>
          <option value={2}>معمولی P2</option>
          <option value={3}>کم P3</option>
        </select>
        <span className="text-[11px] text-faint hidden sm:block">Enter</span>
      </form>

      {todayTasks.length > 0 && (
        <TaskGroup
          title={t('today.important')}
          color="var(--b-red)"
          tasks={todayTasks}
          expanded={expanded}
          setExpanded={setExpanded}
          onToggle={toggle}
          onCycleStatus={cycleStatus}
          onRemove={remove}
          addingSub={addingSub}
          setAddingSub={setAddingSub}
          subDraft={subDraft}
          setSubDraft={setSubDraft}
          onAddSub={addSubtask}
          today={today}
        />
      )}

      {restTasks.length > 0 && (
        <TaskGroup
          title={t('today.restOfDay')}
          color="var(--b-blue)"
          tasks={restTasks}
          expanded={expanded}
          setExpanded={setExpanded}
          onToggle={toggle}
          onCycleStatus={cycleStatus}
          onRemove={remove}
          addingSub={addingSub}
          setAddingSub={setAddingSub}
          subDraft={subDraft}
          setSubDraft={setSubDraft}
          onAddSub={addSubtask}
          today={today}
        />
      )}

      {allVisible.length === 0 && (
        <EmptyState
          icon="🌤️"
          title={t('today.noTasks')}
          hint={t('today.noTasksHint')}
        />
      )}

      <div className="mt-6 card p-3.5 flex flex-wrap gap-x-4 gap-y-2 text-[12px] text-muted items-center">
        <span className="chip chip-danger">فوری P0</span>
        <span className="chip chip-warn">مهم P1</span>
        <span className="chip chip-info">معمولی P2</span>
        <span className="chip">کم P3</span>
        <span className="w-full text-[11px] text-faint">
          P0 یعنی همین امروز باید انجام بشه · P1 مهم این هفته · P2 کار معمولی · P3 اگه وقت شد
        </span>
        <span className="ms-auto">◐ {t('status.doing')}</span>
        <span>○ {t('status.todo')}</span>
        <span>⏸ {t('status.waiting')}</span>
        <span>✓ {t('status.done')}</span>
      </div>

      <UpcomingCalendar tasks={tasks} today={today} />
    </div>
  )
}

/* ---------- تقویم بزرگ تسک‌های آینده (هفتگی/ماهانه) ---------- */
const CAL_PRIO_COLOR = ['var(--b-red)', 'var(--b-orange)', 'var(--b-accent)', 'var(--b-muted)'] as const

function UpcomingCalendar({ tasks, today }: { tasks: Task[]; today: string }) {
  const [mode, setMode] = useState<'week' | 'month'>('month')
  const [cursor, setCursor] = useState(today)

  const future = tasks.filter((t) => !t.parentId && t.status !== 'done' && t.dueDate && t.dueDate > today)
  const byDate = new Map<string, Task[]>()
  for (const t of future) {
    const k = t.dueDate!
    if (!byDate.has(k)) byDate.set(k, [])
    byDate.get(k)!.push(t)
  }
  for (const list of byDate.values()) list.sort((a, b) => a.priority - b.priority)

  const chip = (t: Task) => (
    <span
      key={t.id}
      className="flex items-center gap-1 text-[11px] leading-tight bg-surface-2 border border-line rounded-md px-1.5 py-1 truncate"
      title={t.title}
    >
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: CAL_PRIO_COLOR[t.priority] }} />
      <span className="truncate">{t.title}</span>
    </span>
  )

  const [cy, cm] = cursor.split('-').map(Number)

  return (
    <div className="card overflow-hidden mt-6">
      <div className="flex items-center justify-between flex-wrap gap-2 px-4 py-3 border-b border-line">
        <b className="text-[14px]">📅 تسک‌های آینده<span className="text-[11.5px] text-faint font-normal"> · {faDigits(future.length)} مورد</span></b>
        <div className="flex items-center gap-1.5">
          {mode === 'month' && (
            <>
              <button className="btn btn-ghost !px-2 !py-1 text-[12px]" onClick={() => setCursor(addMonths(cursor, -1))}>›</button>
              <span className="text-[12.5px] font-semibold min-w-[110px] text-center">{FA_MONTHS[cm! - 1]} {faDigits(cy!)}</span>
              <button className="btn btn-ghost !px-2 !py-1 text-[12px]" onClick={() => setCursor(addMonths(cursor, 1))}>‹</button>
            </>
          )}
          <button className={`btn !py-1 !px-3 text-[12px] ${mode === 'week' ? 'btn-primary' : ''}`} onClick={() => setMode('week')}>هفته</button>
          <button className={`btn !py-1 !px-3 text-[12px] ${mode === 'month' ? 'btn-primary' : ''}`} onClick={() => setMode('month')}>ماه</button>
        </div>
      </div>

      {mode === 'week' ? (
        <div className="grid sm:grid-cols-7 grid-cols-1 divide-y sm:divide-y-0 sm:divide-x divide-[color:var(--b-line)] divide-x-reverse">
          {Array.from({ length: 7 }, (_, i) => addDays(today, i + 1)).map((d) => {
            const list = byDate.get(d) ?? []
            return (
              <div key={d} className="p-2 min-h-[110px] bg-surface">
                <div className="text-[11.5px] font-semibold mb-1.5 text-center">
                  <div>{weekdayOf(d)}</div>
                  <div className="text-faint font-normal tabular-nums">{faDigits(formatJalali(d, false))}</div>
                </div>
                <div className="flex flex-col gap-1">
                  {list.map(chip)}
                  {list.length === 0 && <span className="text-[10.5px] text-faint text-center">—</span>}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div>
          <div className="grid grid-cols-7 border-b border-line bg-surface-2">
            {['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'].map((d) => (
              <div key={d} className="py-1.5 text-center text-[11.5px] text-muted font-semibold">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {Array.from({ length: monthLeadingBlanks(cursor) }).map((_, i) => (
              <div key={`e${i}`} className="min-h-[86px] border-b border-e border-line bg-surface-2/40" />
            ))}
            {monthDays(cursor).map((d) => {
              const list = byDate.get(d) ?? []
              const isToday = d === today
              const past = d < today
              return (
                <div key={d} className={`min-h-[86px] border-b border-e border-line p-1 ${past ? 'opacity-45' : ''} ${isToday ? 'bg-[color:var(--b-accent-soft)]' : ''}`}>
                  <div className="text-[11px] text-muted tabular-nums mb-1" style={isToday ? { color: 'var(--b-accent)', fontWeight: 700 } : undefined}>
                    {faDigits(Number(d.split('-')[2]))}
                  </div>
                  <div className="flex flex-col gap-1">
                    {list.slice(0, 3).map(chip)}
                    {list.length > 3 && <span className="text-[10px] text-faint">+{faDigits(list.length - 3)} مورد دیگر</span>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function monthLeadingBlanks(monthCursor: string): number {
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

/* ---------- جمله انگیزشی روز ---------- */
function DailyQuote({ today }: { today: string }) {
  const [extra, setExtra] = useState<Quote | null>(null)
  const q = extra ?? quoteOfDay(today)
  return (
    <div className="mt-3 rounded-xl border border-line bg-surface px-3.5 py-2.5 flex items-start gap-2.5">
      <span className="text-[16px] leading-none mt-0.5">✨</span>
      <div className="flex-1 min-w-0">
        <div className="text-[13px] leading-relaxed">{q.text}</div>
        <div className="text-[11px] text-faint mt-0.5">— {q.author} · جمله امروز</div>
      </div>
      <button
        type="button"
        className="btn btn-ghost !py-1 !px-2 text-[11px] shrink-0"
        title="یک جمله دیگه"
        onClick={() => setExtra(randomQuote(q))}
      >
        🔀
      </button>
    </div>
  )
}

function DigitalClock() {  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(id)
  }, [])
  const hh = String(now.getHours()).padStart(2, '0')
  const mm = String(now.getMinutes()).padStart(2, '0')
  const ss = String(now.getSeconds()).padStart(2, '0')
  return (
    <div className="card p-4 mb-4 flex items-center gap-4">
      <div
        className="text-[42px] leading-none font-bold tabular-nums tracking-tight"
        dir="ltr"
        style={{ color: 'var(--b-accent)' }}
      >
        {faDigits(`${hh}:${mm}`)}
        <span className="text-[20px] text-muted">:{faDigits(ss)}</span>
      </div>
      <div className="min-w-0">
        <div className="text-[14px] font-semibold">{formatJalali(toJalali(now))}</div>
        <div className="text-[12px] text-muted">صفحه امروز · شروع روزت بخیر</div>
      </div>
    </div>
  )
}

function TaskGroup(props: {
  title: string
  color: string
  tasks: Task[]
  expanded: number | null
  setExpanded: (v: number | null) => void
  onToggle: (t: Task) => void
  onCycleStatus: (t: Task) => void
  onRemove: (id?: number) => void
  addingSub: number | null
  setAddingSub: (v: number | null) => void
  subDraft: string
  setSubDraft: (v: string) => void
  onAddSub: (parentId: number, e: FormEvent) => void
  today: string
}) {
  const { t } = useTranslation()
  const { tasks } = props

  const subs = useLiveQuery(
    async () => {
      const ids = tasks.map((x) => x.id!).filter(Boolean)
      if (!ids.length) return [] as Task[]
      const all = await db.tasks.where('parentId').anyOf(ids).toArray()
      return all
    },
    [tasks.map((x) => x.id).join(',')],
    [] as Task[],
  )

  const projects = useLiveQuery(() => db.projects.toArray(), [], [])

  return (
    <div className="card overflow-hidden mb-4">
      <div className="flex items-center gap-2.5 px-4 py-2.5 border-b border-line">
        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: props.color }} />
        <span className="text-[13px] font-semibold">{props.title}</span>
        <span className="text-[11px] text-faint">· {faDigits(tasks.length)} مورد</span>
      </div>

      {tasks.map((task) => {
        const isDone = task.status === 'done'
        const open = props.expanded === task.id
        const mySubs = (subs ?? []).filter((s) => s.parentId === task.id)
        const project = projects.find((p) => p.id === task.projectId)
        const overdue =
          task.dueDate && !isDone && daysUntil(task.dueDate) < 0 && task.dueDate <= props.today

        return (
          <div key={task.id} className={`border-b border-line last:border-0 hover:bg-surface-2 transition-colors ${isDone ? 'opacity-70' : ''}`}>
            <div className="flex items-start gap-3 px-4 py-3">
              <button
                onClick={() => props.onToggle(task)}
                aria-label="toggle"
                className={`mt-0.5 w-[18px] h-[18px] rounded-md border-[1.5px] grid place-items-center text-[10px] shrink-0 transition-colors ${
                  isDone ? 'text-white' : 'bg-surface border-line hover:border-accent'
                }`}
                style={isDone ? { background: 'var(--b-accent)', borderColor: 'var(--b-accent)' } : undefined}
              >
                {isDone ? '✓' : ''}
              </button>

              <div className="flex-1 min-w-0">
                <div
                  className={`text-[13.5px] font-medium cursor-pointer leading-snug ${isDone ? 'line-through text-faint' : ''}`}
                  onClick={() => props.setExpanded(open ? null : (task.id ?? null))}
                >
                  {task.title}
                </div>

                <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                  <span className={`chip ${PRIO_TONE[task.priority]}`} title="تغییر اولویت فقط از ورودی/کانبان">{prioLabel(task.priority)}</span>

                  <button onClick={() => props.onCycleStatus(task)} className="cursor-pointer" title={t('task.status')}>
                    <span className="chip">
                      {task.status === 'doing' ? '◐' : task.status === 'waiting' ? '⏸' : task.status === 'done' ? '✓' : '○'}{' '}
                      {t(`status.${task.status}`)}
                    </span>
                  </button>

                  {task.dueDate && (
                    <span className={`chip ${overdue ? 'chip-danger' : task.dueDate === props.today ? 'chip-accent' : ''}`}>
                      {task.dueDate === props.today ? t('today.dueToday') : fmtDue(task.dueDate, props.today)}
                    </span>
                  )}

                  {project && <span className="chip chip-info">{project.name.slice(0, 22)}</span>}

                  {task.tags.map((tag) => (
                    <span key={tag} className="chip">#{tag}</span>
                  ))}

                  {mySubs.length > 0 && (
                    <span className="chip text-[10.5px]">
                      {t('task.subtasks')} {faDigits(mySubs.filter((s) => s.status === 'done').length)}/
                      {faDigits(mySubs.length)}
                    </span>
                  )}
                </div>

                {open && (
                  <div className="mt-2.5 ps-4 border-s-2 border-line flex flex-col gap-1.5">
                    {mySubs.map((sub) => (
                      <div key={sub.id} className="flex items-center gap-2 text-[12.5px] text-muted">
                        <button
                          onClick={() => sub.id && props.onToggle(sub)}
                          className={`w-[15px] h-[15px] rounded-[5px] border-[1.5px] grid place-items-center text-[9px] shrink-0 ${
                            sub.status === 'done' ? 'text-white border-transparent' : 'bg-surface border-line'
                          }`}
                          style={sub.status === 'done' ? { background: 'var(--b-accent)' } : undefined}
                        >
                          {sub.status === 'done' ? '✓' : ''}
                        </button>
                        <span className={sub.status === 'done' ? 'line-through text-faint' : ''}>{sub.title}</span>
                      </div>
                    ))}

                    {props.addingSub === task.id ? (
                      <form onSubmit={(e) => task.id && props.onAddSub(task.id, e)} className="mt-1">
                        <input
                          autoFocus
                          className="field !py-1.5 !text-[12.5px]"
                          placeholder={t('task.addSubtask')}
                          value={props.subDraft}
                          onChange={(e) => props.setSubDraft(e.target.value)}
                          onBlur={() => props.setAddingSub(null)}
                        />
                      </form>
                    ) : (
                      <button
                        className="text-[12px] text-faint hover:text-accent transition-colors text-start"
                        onClick={() => {
                          props.setAddingSub(task.id ?? null)
                          props.setSubDraft('')
                        }}
                      >
                        + {t('task.addSubtask')}
                      </button>
                    )}
                  </div>
                )}
              </div>

              <div className="flex gap-1">
                <button
                  className="w-6 h-6 rounded-md border border-line bg-surface text-faint hover:text-[color:var(--b-red)] grid place-items-center text-[11px]"
                  onClick={() => props.onRemove(task.id)}
                  title={t('task.delete')}
                >
                  🗑
                </button>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function fmtDue(due: string, today: string): string {
  const d = daysUntil(due)
  if (d === 0) return 'امروز'
  if (d === 1) return 'فردا'
  if (d === -1) return 'دیروز'
  if (d < 0) return faDigits(Math.abs(d)) + ' روز پیش'
  if (d <= 7) return faDigits(d) + ' روز دیگر'
  const [, m, day] = due.split('-')
  return faDigits(Number(day)) + '/' + faDigits(Number(m))
}

function sameDay(d: Date, jalali: string): boolean {
  return toJalali(d) === jalali
}
