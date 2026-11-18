import { useState, type FormEvent, type ReactNode } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Priority, type Transaction } from '../db/schema'
import { todayJalali, addDays, formatJalali, weekdayOf, isValidJalali } from '../lib/jalali'
import { faDigits, groupDigits } from '../lib/format'
import { DatePicker } from '../ui/datepicker'
import { ExportMenu } from '../ui/components'
import { CategoryPicker } from '../ui/categoryPicker'
import { groupOfType } from '../lib/categories'

const PRIO_FA = ['فوری', 'مهم', 'معمولی', 'کم'] as const
const PRIO_TONE = ['chip-danger', 'chip-warn', 'chip-info', ''] as const

const STICKERS = ['⭐', '🔥', '📌', '✅', '💡', '📞', '💰', '🚧'] as const

const TX_TYPES: { id: Transaction['type']; label: string }[] = [
  { id: 'income', label: 'دریافتی' },
  { id: 'expense', label: 'پرداختی' },
  { id: 'invest', label: 'سرمایه‌گذاری' },
  { id: 'withdraw', label: 'برداشت از سرمایه' },
]

export default function InboxPage() {
  const today = todayJalali()
  const projects = useLiveQuery(() => db.projects.toArray(), [], [])
  const workers = useLiveQuery(() => db.workers.toArray(), [], [])
  const tasks = useLiveQuery(() => db.tasks.toArray(), [], [])

  const open = (tasks ?? []).filter((t) => t.status !== 'done' && t.dueDate && t.dueDate > today)
  const weekEnd = addDays(today, 7)
  const monthEnd = addDays(today, 30)
  const weekTasks = open.filter((t) => t.dueDate! <= weekEnd).sort((a, b) => (a.dueDate! < b.dueDate! ? -1 : 1))
  const monthTasks = open
    .filter((t) => t.dueDate! > weekEnd && t.dueDate! <= monthEnd)
    .sort((a, b) => (a.dueDate! < b.dueDate! ? -1 : 1))

  async function removeTask(id?: number) {
    if (!id) return
    if (!window.confirm('این تسک حذف بشه؟')) return
    const subs = await db.tasks.where('parentId').equals(id).toArray()
    await db.tasks.bulkDelete([...subs.map((s) => s.id!), id])
  }

  const projectName = (id?: number | null) => projects.find((p) => p.id === id)?.name

  const inboxExportData = (tasks ?? []).map((tk) => ({
    عنوان: tk.title,
    وضعیت: tk.status === 'todo' ? 'انجام‌نشده' : tk.status === 'doing' ? 'در حال انجام' : tk.status === 'waiting' ? 'در انتظار' : 'انجام‌شده',
    اولویت: tk.priority,
    سررسید: tk.dueDate ?? '',
    پروژه: projectName(tk.projectId) ?? '',
    برچسب‌ها: (tk.tags ?? []).join('، '),
  }))

  return (
    <div className="b-view max-w-3xl mx-auto">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
        <div>
          <h1 className="text-[21px] font-bold tracking-tight">ورودی</h1>
          <p className="text-[13px] text-muted mt-0.5">هاب ثبت سریع — هر چیزی را همین‌جا وارد کن</p>
        </div>
        {(tasks ?? []).length > 0 && (
          <ExportMenu
            elementId="inbox-export"
            filename={`inbox-${today}`}
            sheetName="Tasks"
            data={inboxExportData}
          />
        )}
      </div>

      <div id="inbox-export">

      <div className="flex flex-col gap-3 mb-6">
        <Section title="＋ تسک جدید" defaultOpen>
          <TaskForm projectNames={projects.map((p) => ({ id: p.id!, name: p.name }))} today={today} />
        </Section>
        <Section title="＋ تراکنش">
          <TxForm today={today} />
        </Section>
        <Section title="＋ کارکرد">
          <AttForm workers={(workers ?? []).map((w) => ({ id: w.id!, name: w.name }))} today={today} />
        </Section>
        <Section title="＋ گزارش کار">
          <LogForm projects={[{ id: 0, name: 'بدون پروژه' }, ...projects.map((p) => ({ id: p.id!, name: p.name }))]} today={today} />
        </Section>
      </div>

      <h2 className="text-[16px] font-bold mb-2">هفته آینده</h2>
      {weekTasks.length === 0 ? (
        <p className="text-[12.5px] text-faint mb-5">تسکی برای ۷ روز آینده ثبت نشده</p>
      ) : (
        <div className="flex flex-col gap-3 mb-6">
          {[1, 2, 3, 4, 5, 6, 7].map((i) => {
            const d = addDays(today, i)
            const rows = weekTasks.filter((t) => t.dueDate === d)
            if (rows.length === 0) return null
            return (
              <div key={d} className="card overflow-hidden">
                <div className="px-4 py-2 border-b border-line text-[12.5px] font-semibold">
                  {faDigits(formatJalali(d))} · {weekdayOf(d)} · {faDigits(rows.length)} مورد
                </div>
                {rows.map((t) => (
                  <FutureRow key={t.id} title={t.title} due={t.dueDate!} priority={t.priority} project={projectName(t.projectId)} onRemove={() => removeTask(t.id)} />
                ))}
              </div>
            )
          })}
        </div>
      )}

      <h2 className="text-[16px] font-bold mb-2">
        ماه آینده <span className="text-[12px] text-faint font-normal">· {faDigits(monthTasks.length)} مورد</span>
      </h2>
      {monthTasks.length === 0 ? (
        <p className="text-[12.5px] text-faint">موردی برای ادامه ماه ثبت نشده</p>
      ) : (
        <div className="card overflow-hidden mb-6">
          {monthTasks.map((t) => (
            <FutureRow key={t.id} title={t.title} due={t.dueDate!} priority={t.priority} project={projectName(t.projectId)} onRemove={() => removeTask(t.id)} />
          ))}
        </div>
      )}

      <RecentTasks tasks={tasks ?? []} projectName={projectName} onRemove={removeTask} />
      </div>
    </div>
  )
}

/** خلاصه همه تسک‌هایی که از ورودی ساخته شده‌اند — همین‌جا می‌مانند */
function RecentTasks({
  tasks,
  projectName,
  onRemove,
}: {
  tasks: { id?: number; title: string; status: string; dueDate?: string | null; priority: Priority; projectId?: number | null; createdAt: number }[]
  projectName: (id?: number | null) => string | undefined
  onRemove: (id?: number) => void
}) {
  const recent = [...tasks]
    .filter((t) => !(t as { parentId?: number | null }).parentId)
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 15)
  if (recent.length === 0) return null
  return (
    <>
      <h2 className="text-[16px] font-bold mb-2">
        تسک‌های ثبت‌شده اخیر <span className="text-[12px] text-faint font-normal">· {faDigits(recent.length)} مورد آخر</span>
      </h2>
      <div className="card overflow-hidden">
        {recent.map((t) => (
          <div key={t.id} className="flex items-center gap-2.5 px-4 py-2.5 border-b border-line last:border-0 hover:bg-surface-2 transition-colors">
            <span className="flex-1 min-w-0 text-[13px] font-medium truncate">{t.title}</span>
            <span className={`chip ${PRIO_TONE[t.priority]}`}>{PRIO_FA[t.priority]}</span>
            {projectName(t.projectId) && <span className="chip chip-info hidden sm:inline-flex">{projectName(t.projectId)!.slice(0, 22)}</span>}
            <span className="chip">{t.dueDate ? `${faDigits(formatJalali(t.dueDate, false))}` : 'بدون تاریخ'}</span>
            <span className="chip">{t.status === 'done' ? '✓ انجام‌شده' : t.status === 'doing' ? '◐ در حال انجام' : t.status === 'waiting' ? '⏸ در انتظار' : '○ جدید'}</span>
            <button type="button" className="w-6 h-6 rounded-md border border-line bg-surface text-faint hover:text-[color:var(--b-red)] grid place-items-center text-[11px] shrink-0" onClick={() => onRemove(t.id)} title="حذف">🗑</button>
          </div>
        ))}
      </div>
    </>
  )
}

function Section({ title, defaultOpen, children }: { title: string; defaultOpen?: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(!!defaultOpen)
  return (
    <div className="card overflow-hidden">
      <button type="button" className="w-full text-start px-4 py-3 text-[14px] font-semibold flex items-center justify-between" onClick={() => setOpen(!open)}>
        <span>{title}</span>
        <span className="text-faint text-[12px]">{open ? '▾' : '▸'}</span>
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </div>
  )
}

function Msg({ text, error }: { text: string; error?: boolean }) {
  if (!text) return null
  return <p className={`text-[12.5px] mt-2 ${error ? 'text-[color:var(--b-red)]' : 'text-[color:var(--b-green)]'}`}>{text}</p>
}

function TaskForm({ projectNames, today }: { projectNames: { id: number; name: string }[]; today: string }) {
  const [title, setTitle] = useState('')
  const [due, setDue] = useState(today)
  const [prio, setPrio] = useState<Priority>(2)
  const [sticker, setSticker] = useState<string>('')
  const [projectId, setProjectId] = useState('')
  const [msg, setMsg] = useState('')

  async function submit(e: FormEvent) {
    e.preventDefault()
    const t = title.trim()
    if (!t) return
    const full = sticker ? `${sticker} ${t}` : t
    await db.tasks.add({
      title: full,
      notes: '',
      projectId: projectId ? Number(projectId) : null,
      parentId: null,
      status: 'todo',
      priority: prio,
      dueDate: due.trim() || null,
      tags: [],
      order: Date.now(),
      createdAt: Date.now(),
      completedAt: null,
    })
    setTitle('')
    setSticker('')
    setMsg('تسک ثبت شد ✓')
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2.5">
      <input className="field" placeholder="عنوان تسک" value={title} onChange={(e) => setTitle(e.target.value)} />
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[12px] text-muted">سررسید:</span>
        <DatePicker value={due} onChange={setDue} />
      </div>
      <div className="flex flex-wrap gap-1.5">
        <button type="button" className="btn !py-1 !px-2.5 text-[12px]" onClick={() => setDue(today)}>امروز</button>
        <button type="button" className="btn !py-1 !px-2.5 text-[12px]" onClick={() => setDue(addDays(today, 1))}>فردا</button>
        <button type="button" className="btn !py-1 !px-2.5 text-[12px]" onClick={() => setDue(addDays(today, 7))}>+۷ روز</button>
      </div>
      <div className="flex gap-2">
        <select className="field flex-1" value={prio} onChange={(e) => setPrio(Number(e.target.value) as Priority)} title="اولویت">
          <option value={0}>فوری</option>
          <option value={1}>مهم</option>
          <option value={2}>معمولی</option>
          <option value={3}>کم</option>
        </select>
        <select className="field flex-1" value={projectId} onChange={(e) => setProjectId(e.target.value)} title="پروژه">
          <option value="">بدون پروژه</option>
          {projectNames.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[12px] text-muted">استیکر:</span>
        <button type="button" className={`btn !py-1 !px-2 text-[13px] ${sticker === '' ? 'btn-primary' : ''}`} onClick={() => setSticker('')}>بدون</button>
        {STICKERS.map((s) => (
          <button key={s} type="button" className={`btn !py-1 !px-2 text-[15px] ${sticker === s ? 'btn-primary' : ''}`} onClick={() => setSticker(s)}>{s}</button>
        ))}
      </div>
      <button type="submit" className="btn btn-primary">ثبت تسک</button>
      <Msg text={msg} />
    </form>
  )
}

function TxForm({ today }: { today: string }) {
  const [type, setType] = useState<Transaction['type']>('expense')
  const [category, setCategory] = useState('')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(today)
  const [note, setNote] = useState('')
  const [msg, setMsg] = useState('')
  const num = Number(amount.replace(/[^0-9]/g, '')) || 0

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!category.trim() || num <= 0) {
      setMsg('دسته و مبلغ معتبر وارد کن')
      return
    }
    const d = date.trim() || today
    if (!isValidJalali(d)) {
      setMsg('تاریخ معتبر نیست — از تقویم انتخاب کن')
      return
    }
    await db.transactions.add({
      type,
      category: category.trim(),
      amount: num,
      date: d,
      note: note.trim() || undefined,
      createdAt: Date.now(),
    })
    setCategory('')
    setAmount('')
    setNote('')
    setMsg('تراکنش ثبت شد ✓')
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2.5">
      <div className="flex flex-wrap gap-1.5">
        {TX_TYPES.map((t) => (
          <button key={t.id} type="button" className={`btn !py-1 !px-2.5 text-[12px] ${type === t.id ? 'btn-primary' : ''}`} onClick={() => { setType(t.id); setCategory('') }}>{t.label}</button>
        ))}
      </div>
      <div>
        <div className="text-[11.5px] text-muted mb-1.5">دسته</div>
        <CategoryPicker group={groupOfType(type)} value={category} onChange={setCategory} />
      </div>
      <div className="flex gap-2">
        <input className="field flex-1" placeholder="مبلغ (تومان)" value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="numeric" dir="ltr" />
      </div>
      {num > 0 && <p className="text-[12px] text-muted">{faDigits(groupDigits(num))} تومان</p>}
      <div className="flex gap-2">
        <div className="flex-1">
          <DatePicker value={date} onChange={setDate} />
        </div>
        <input className="field flex-1" placeholder="توضیح (اختیاری)" value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
      <p className="text-[11.5px] text-faint">راهنما: برای سرمایه‌گذاری فقط تراکنش ثبت می‌شود — ساخت دارایی در صفحه مالی انجام می‌شود.</p>
      <button type="submit" className="btn btn-primary">ثبت تراکنش</button>
      <Msg text={msg} />
    </form>
  )
}

function AttForm({ workers, today }: { workers: { id: number; name: string }[]; today: string }) {
  const [workerId, setWorkerId] = useState('')
  const [date, setDate] = useState(today)
  const [hours, setHours] = useState('۸')
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!workerId) {
      setErr(true)
      setMsg('کارگر را انتخاب کن')
      return
    }
    const h = Number(String(hours).replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))).replace(/[^0-9.]/g, '')) || 0
    if (h <= 0) {
      setErr(true)
      setMsg('ساعت کارکرد معتبر وارد کن')
      return
    }
    const d = date.trim() || today
    if (!isValidJalali(d)) {
      setErr(true)
      setMsg('تاریخ معتبر نیست — از تقویم انتخاب کن')
      return
    }
    const wid = Number(workerId)
    const dup = await db.attendances.where('[workerId+date]').equals([wid, d]).first()
    if (dup) {
      setErr(true)
      setMsg('قبلاً ثبت شده')
      return
    }
    await db.attendances.add({ workerId: wid, date: d, hours: Math.min(24, h), createdAt: Date.now() })
    setErr(false)
    setMsg('کارکرد ثبت شد ✓')
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2.5">
      <select className="field" value={workerId} onChange={(e) => setWorkerId(e.target.value)}>
        <option value="">انتخاب کارگر…</option>
        {workers.map((w) => (
          <option key={w.id} value={w.id}>{w.name}</option>
        ))}
      </select>
      <div className="flex gap-2">
        <div className="flex-1">
          <DatePicker value={date} onChange={setDate} />
        </div>
        <input className="field flex-1" placeholder="ساعت کارکرد (مثلاً ۸)" value={hours} onChange={(e) => setHours(e.target.value)} inputMode="decimal" />
      </div>
      <button type="submit" className="btn btn-primary">ثبت کارکرد</button>
      <Msg text={msg} error={err} />
    </form>
  )
}

function LogForm({ projects, today }: { projects: { id: number; name: string }[]; today: string }) {
  const [projectId, setProjectId] = useState(0)
  const [text, setText] = useState('')
  const [msg, setMsg] = useState('')

  async function submit(e: FormEvent) {
    e.preventDefault()
    const t = text.trim()
    if (!t) return
    await db.dayLogs.add({ date: today, projectId, text: t, createdAt: Date.now() })
    setText('')
    setMsg('گزارش ثبت شد ✓')
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2.5">
      <select className="field" value={projectId} onChange={(e) => setProjectId(Number(e.target.value))}>
        {projects.map((p) => (
          <option key={p.id} value={p.id}>{p.name}</option>
        ))}
      </select>
      <textarea className="field !min-h-[80px] resize-y" placeholder="امروز چه کاری انجام شد؟" value={text} onChange={(e) => setText(e.target.value)} />
      <button type="submit" className="btn btn-primary">ثبت گزارش</button>
      <Msg text={msg} />
    </form>
  )
}

function FutureRow({ title, due, priority, project, onRemove }: { title: string; due: string; priority: Priority; project?: string; onRemove: () => void }) {
  return (
    <div className="flex items-center gap-2.5 px-4 py-2.5 border-b border-line last:border-0 hover:bg-surface-2 transition-colors">
      <span className="flex-1 min-w-0 text-[13px] font-medium truncate">{title}</span>
      <span className={`chip ${PRIO_TONE[priority]}`}>{PRIO_FA[priority]}</span>
      {project && <span className="chip chip-info hidden sm:inline-flex">{project.slice(0, 22)}</span>}
      <span className="chip">{faDigits(formatJalali(due, false))} · {weekdayOf(due)}</span>
      <button type="button" className="w-6 h-6 rounded-md border border-line bg-surface text-faint hover:text-[color:var(--b-red)] grid place-items-center text-[11px] shrink-0" onClick={onRemove} title="حذف">🗑</button>
    </div>
  )
}
