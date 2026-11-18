import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Task, type TaskStatus, type Priority } from '../db/schema'
import { todayJalali, formatJalaliShort } from '../lib/jalali'
import { faDigits } from '../lib/format'
import { Chip, EmptyState, Field, TextInput, Panel, ExportMenu } from '../ui/components'

const COLUMNS: { status: TaskStatus; icon: string; labelKey: string }[] = [
  { status: 'todo', icon: '📋', labelKey: 'board.todo' },
  { status: 'doing', icon: '🔨', labelKey: 'board.doing' },
  { status: 'waiting', icon: '⏸️', labelKey: 'board.waiting' },
  { status: 'done', icon: '✅', labelKey: 'board.done' },
]

const PRIO: Record<Priority, { label: string; color: string }> = {
  0: { label: 'فوری', color: 'var(--b-red)' },
  1: { label: 'مهم', color: 'var(--b-orange)' },
  2: { label: 'متوسط', color: 'var(--b-accent)' },
  3: { label: 'کم', color: 'var(--b-muted)' },
}

export default function BoardPage() {
  const { t } = useTranslation()
  const [formOpen, setFormOpen] = useState(false)

  const tasks = useLiveQuery(() => db.tasks.orderBy('order').toArray(), [], [] as Task[])
  const projects = useLiveQuery(() => db.projects.toArray(), [], [])

  const hasAny = tasks.length > 0

  const boardExportData = tasks.map((tk) => ({
    عنوان: tk.title,
    وضعیت: tk.status === 'todo' ? 'انجام‌نشده' : tk.status === 'doing' ? 'در حال انجام' : tk.status === 'waiting' ? 'در انتظار' : 'انجام‌شده',
    اولویت: tk.priority,
    سررسید: tk.dueDate ?? '',
    برچسب‌ها: (tk.tags ?? []).join('، '),
    یادداشت: tk.notes ?? '',
  }))

  return (
    <div className="b-view max-w-7xl mx-auto">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
        <div>
          <h1 className="text-[21px] font-bold tracking-tight">{t('board.title')}</h1>
          <p className="text-[13px] text-muted mt-0.5">{t('board.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          {hasAny && (
            <ExportMenu
              elementId="board-export"
              filename={`board-${todayJalali()}`}
              sheetName="Tasks"
              data={boardExportData}
            />
          )}
          {!formOpen && (
            <button className="btn btn-primary" onClick={() => setFormOpen(true)}>
              + {t('board.newCard')}
            </button>
          )}
        </div>
      </div>

      {formOpen && <TaskForm projects={projects} onDone={() => setFormOpen(false)} />}

      <div id="board-export">

      {!hasAny && !formOpen ? (
        <EmptyState icon="🗂️" title={t('board.noCards')} hint={t('board.noCardsHint')} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-start">
          {COLUMNS.map((col) => (
            <BoardColumn
              key={col.status}
              status={col.status}
              icon={col.icon}
              label={t(col.labelKey)}
              tasks={tasks.filter((x) => x.status === col.status)}
              projects={projects}
            />
          ))}
        </div>
      )}
      </div>
    </div>
  )
}

/* ==================== column ==================== */

function BoardColumn({
  status,
  icon,
  label,
  tasks,
  projects,
}: {
  status: TaskStatus
  icon: string
  label: string
  tasks: Task[]
  projects: { id?: number; name: string }[]
}) {
  const { t } = useTranslation()
  const [dragOver, setDragOver] = useState(false)
  const [editing, setEditing] = useState<Task | null>(null)

  async function moveTask(task: Task, dir: -1 | 1) {
    if (!task.id) return
    const idx = COLUMNS.findIndex((c) => c.status === task.status)
    const next = COLUMNS[idx + dir]
    if (!next) return
    await db.tasks.update(task.id, { status: next.status })
  }

  async function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const id = Number(e.dataTransfer.getData('text/task-id'))
    if (!id) return
    await db.tasks.update(id, { status })
  }

  const projName = (pid?: number | null) => projects.find((p) => p.id === pid)?.name

  if (editing) {
    return (
      <div className="card p-3">
        <TaskForm initial={editing} projects={projects} onDone={() => setEditing(null)} />
      </div>
    )
  }

  return (
    <div
      className={`card overflow-hidden ${dragOver ? 'ring-2 ring-[color:var(--b-accent)]' : ''}`}
      onDragOver={(e) => {
        e.preventDefault()
        setDragOver(true)
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
    >
      <div className="flex items-center justify-between px-3 py-2.5 bg-surface-2 border-b border-line">
        <span className="text-[13px] font-semibold flex items-center gap-1.5">
          {icon} {label}
        </span>
        <Chip tone="default">{faDigits(tasks.length)}</Chip>
      </div>
      <div className="p-2.5 space-y-2 min-h-[120px]">
        {tasks.length === 0 && (
          <div className="text-[11.5px] text-faint text-center py-4">{t('board.emptyCol')}</div>
        )}
        {tasks.map((task) => (
          <div
            key={task.id}
            draggable
            onDragStart={(e) => e.dataTransfer.setData('text/task-id', String(task.id))}
            className="bg-surface-2 border border-line rounded-xl p-2.5 cursor-grab active:cursor-grabbing hover:border-[color:var(--b-accent)] transition-colors"
          >
            <div className="flex items-start gap-1.5">
              <span
                className="text-[9.5px] font-bold px-1.5 py-0.5 rounded shrink-0 mt-0.5"
                style={{ background: `${PRIO[task.priority].color}22`, color: PRIO[task.priority].color }}
              >
                {PRIO[task.priority].label}
              </span>
              <span className="text-[12.5px] flex-1 leading-snug">{task.title}</span>
            </div>

            {projName(task.projectId) && (
              <div className="text-[10.5px] text-faint mt-1.5">🏗️ {projName(task.projectId)}</div>
            )}
            {task.dueDate && (
              <div className="text-[10.5px] mt-1 tabular-nums text-muted" dir="ltr">
                📅 {task.dueDate}
              </div>
            )}

            <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-line">
              <div className="flex gap-1">
                <button
                  className="btn btn-ghost !py-0.5 !px-1.5 text-[11px]"
                  onClick={() => moveTask(task, -1)}
                  disabled={status === 'todo'}
                >
                  →
                </button>
                <button
                  className="btn btn-ghost !py-0.5 !px-1.5 text-[11px]"
                  onClick={() => moveTask(task, 1)}
                  disabled={status === 'done'}
                >
                  ←
                </button>
              </div>
              <div className="flex gap-1">
                <button className="btn btn-ghost !py-0.5 !px-1.5 text-[11px]" onClick={() => setEditing(task)}>
                  ✏️
                </button>
                <button
                  className="btn btn-ghost !py-0.5 !px-1.5 text-[11px]"
                  onClick={async () => {
                    if (!task.id) return
                    if (!window.confirm(t('projects.deleteConfirm'))) return
                    await db.tasks.where('parentId').equals(task.id).delete()
                    await db.tasks.delete(task.id)
                  }}
                >
                  🗑
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ==================== task form ==================== */

function TaskForm({
  initial,
  projects,
  onDone,
}: {
  initial?: Task
  projects: { id?: number; name: string }[]
  onDone: () => void
}) {
  const { t } = useTranslation()
  const [title, setTitle] = useState(initial?.title ?? '')
  const [notes, setNotes] = useState(initial?.notes ?? '')
  const [projectId, setProjectId] = useState<string>(
    initial?.projectId ? String(initial.projectId) : ''
  )
  const [priority, setPriority] = useState<Priority>(initial?.priority ?? 2)
  const [status, setStatus] = useState<TaskStatus>(initial?.status ?? 'todo')
  const [dueDate, setDueDate] = useState(initial?.dueDate ?? '')

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    const data = {
      title: title.trim(),
      notes: notes.trim() || undefined,
      projectId: projectId ? Number(projectId) : null,
      priority,
      status,
      dueDate: dueDate || null,
    }
    if (initial?.id) {
      await db.tasks.update(initial.id, data)
    } else {
      const maxOrder = (await db.tasks.toArray()).reduce((m, x) => Math.max(m, x.order), 0)
      await db.tasks.add({ ...data, parentId: null, tags: [], order: maxOrder + 1, createdAt: Date.now() })
    }
    onDone()
  }

  return (
    <form onSubmit={submit} className="card p-4 mb-4 b-pop">
      <div className="grid sm:grid-cols-2 gap-3">
        <Field label={t('board.cardTitle')}>
          <TextInput value={title} onChange={(e) => setTitle(e.target.value)} required autoFocus />
        </Field>
        <Field label={t('board.project')}>
          <select className="field" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
            <option value="">{t('board.noProject')}</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t('board.priority')}>
          <div className="flex gap-1.5">
            {([0, 1, 2, 3] as Priority[]).map((p) => (
              <button
                key={p}
                type="button"
                className={`btn !py-1.5 !px-2 text-[12px] ${priority === p ? 'btn-primary' : ''}`}
                onClick={() => setPriority(p)}
              >
                {PRIO[p].label}
              </button>
            ))}
          </div>
        </Field>
        <Field label={t('board.status')}>
          <div className="flex gap-1.5">
            {COLUMNS.map((c) => (
              <button
                key={c.status}
                type="button"
                className={`btn !py-1.5 !px-2 text-[12px] ${status === c.status ? 'btn-primary' : ''}`}
                onClick={() => setStatus(c.status)}
              >
                {c.icon}
              </button>
            ))}
          </div>
        </Field>
        <Field label={t('board.due')} hint="شمسی: 1404-08-15">
          <TextInput value={dueDate} onChange={(e) => setDueDate(e.target.value)} dir="ltr" placeholder="1404-08-15" />
        </Field>
        <Field label={t('board.notes')}>
          <TextInput value={notes} onChange={(e) => setNotes(e.target.value)} />
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
