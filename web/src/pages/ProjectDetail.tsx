import { useMemo, useRef, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useLiveQuery } from 'dexie-react-hooks'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  db,
  type Task,
  type Worker,
  type Attendance,
  type Payment,
  type FinanceEntry,
  type Stage,
  type ProjectPhoto,
  type RateItem,
  type Measurement,
} from '../db/schema'
import { groupDigits, tomanShort, faDigits, hours as fmtHours } from '../lib/format'
import { formatJalaliShort, todayJalali, isValidJalali } from '../lib/jalali'
import { compressImage, dataUrlKB, humanSize } from '../lib/photos'
import { deleteProjectCascade } from '../lib/projectDelete'
import { downloadProjectReport, ALL_SECTIONS, type ExportOptions, type ProjectExportFormat } from '../lib/projectPdf'
import { Chip, EmptyState, Bar, Panel, Field, TextInput, NumberInput } from '../ui/components'
import { DatePicker } from '../ui/datepicker'
import { statusTone } from './Projects'
import RatesTab from './project/RatesTab'
import { CategoryPicker } from '../ui/categoryPicker'
import { groupOfType } from '../lib/categories'

type Tab = 'overview' | 'finance' | 'rates' | 'stages' | 'photos' | 'workers' | 'tasks'

export default function ProjectDetail() {
  const { t } = useTranslation()
  const { id } = useParams()
  const nav = useNavigate()
  const projectId = Number(id)
  const [tab, setTab] = useState<Tab>('overview')
  const [editing, setEditing] = useState(false)
  const [pdfBusy, setPdfBusy] = useState(false)
  const [pdfMsg, setPdfMsg] = useState('')
  const [exportOpen, setExportOpen] = useState(false)

  const project = useLiveQuery(() => db.projects.get(projectId), [projectId])
  const workers = useLiveQuery(() => db.workers.toArray(), [], [] as Worker[])
  const attendances = useLiveQuery(() => db.attendances.toArray(), [], [] as Attendance[])
  const payments = useLiveQuery(() => db.payments.toArray(), [], [] as Payment[])
  const photos = useLiveQuery(
    () => db.projectPhotos.where('projectId').equals(projectId).toArray(),
    [projectId],
    [] as ProjectPhoto[],
  )
  const rates = useLiveQuery(
    () => db.rateItems.where('projectId').equals(projectId).toArray(),
    [projectId],
    [] as RateItem[],
  )
  const measurements = useLiveQuery(
    () => db.measurements.where('projectId').equals(projectId).toArray(),
    [projectId],
    [] as Measurement[],
  )
  const finance = useLiveQuery(
    () => db.financeEntries.where('projectId').equals(projectId).toArray(),
    [projectId],
    [] as FinanceEntry[],
  )
  const stages = useLiveQuery(
    () => db.stages.where('projectId').equals(projectId).toArray(),
    [projectId],
    [] as Stage[],
  )
  const tasks = useLiveQuery(
    () => db.tasks.where('projectId').equals(projectId).toArray(),
    [projectId],
    [] as Task[],
  )

  const fin = useMemo(() => {
    const income = finance.filter((f) => f.type === 'income').reduce((s, f) => s + f.amount, 0)
    const expense = finance.filter((f) => f.type === 'expense').reduce((s, f) => s + f.amount, 0)
    return { income, expense, net: income - expense }
  }, [finance])

  /* جمع صورت‌وضعیت (نرخ × متراژ) — مبنای «طلب کل» وقتی مبلغ قرارداد ثبت نشده باشد */
  const statementTotal = useMemo(() => {
    let sum = 0
    for (const r of rates) {
      if (r.currency !== 'toman') continue
      const q = measurements.filter((m) => m.rateId === r.id).reduce((s, m) => s + m.qty, 0)
      sum += q * r.price
    }
    return Math.round(sum)
  }, [rates, measurements])

  async function removeProject() {
    if (!window.confirm('این پروژه برای همیشه حذف بشه؟ همه اطلاعاتش (مالی، حضور و غیاب، پرداختی‌ها و گزارش‌ها) پاک می‌شه.')) return
    await deleteProjectCascade(projectId)
    nav('/projects')
  }

  if (!project) {
    return (
      <div className="b-view">
        <EmptyState
          icon="🔍"
          title="پروژه پیدا نشد"
          action={
            <Link to="/projects" className="btn">
              {t('projects.back')}
            </Link>
          }
        />
      </div>
    )
  }

  const projectWorkers = workers.filter((w) => w.projectId === projectId)
  const workerIds = new Set(projectWorkers.map((w) => w.id))
  const myAtt = attendances.filter((a) => workerIds.has(a.workerId))
  const myPay = payments.filter((p) => workerIds.has(p.workerId))
  const totalHours = myAtt.reduce((s, a) => s + a.hours, 0)

  const myTasks = tasks.filter((x) => !x.parentId)
  const doneTasks = myTasks.filter((x) => x.status === 'done')

  // درآمد نمایشی: اگه دفتر مالی خالیه، از فیلد دریافتی پروژه استفاده کن
  const showIncome = fin.income > 0 ? fin.income : project.received
  const showExpense = fin.expense
  const showNet = showIncome - showExpense

  /* طلب کل: مبلغ قرارداد؛ اگر ثبت نشده باشد جمع صورت‌وضعیت */
  const receivable = project.contractAmount > 0 ? project.contractAmount : statementTotal
  const remaining = receivable - showIncome

  async function doPdf(opt: ExportOptions, format: ProjectExportFormat) {
    if (!project) return
    const proj = project
    setPdfBusy(true)
    setPdfMsg(t('projects.pdfBuilding'))
    try {
      const appName = 'SAZORA'
      await downloadProjectReport(
        {
          project: proj,
          finance,
          stages: [...stages].sort((a, b) => a.order - b.order),
          workers: projectWorkers,
          attendances: myAtt,
          payments: myPay,
          photos,
          rates,
          measurements,
          appName,
        },
        opt,
        format,
      )
      setPdfMsg(t('projects.pdfDone'))
    } catch (e) {
      console.error(e)
      setPdfMsg('خطا در ساخت PDF')
    } finally {
      setPdfBusy(false)
      setTimeout(() => setPdfMsg(''), 3500)
    }
  }

  const tabs: { k: Tab; badge?: number }[] = [
    { k: 'overview' },
    { k: 'finance', badge: finance.length },
    { k: 'rates', badge: rates.length },
    { k: 'stages', badge: stages.length },
    { k: 'photos', badge: photos.length },
    { k: 'workers', badge: projectWorkers.length },
    { k: 'tasks', badge: myTasks.length },
  ]

  return (
    <div className="b-view max-w-6xl mx-auto">
      <button
        className="text-[12.5px] text-muted hover:text-accent mb-3 flex items-center gap-1.5"
        onClick={() => nav('/projects')}
      >
        → {t('projects.back')}
      </button>

      {/* هدر */}
      <div className="flex flex-wrap items-start gap-3 mb-5">
        <div className="flex-1 min-w-[260px]">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-[21px] font-bold tracking-tight">{project.name}</h1>
            <Chip tone={statusTone(project.status) as never}>{t(`projectStatus.${project.status}`)}</Chip>
          </div>
          <p className="text-[13px] text-muted mt-1">
            {t('projects.client')}: <b className="text-ink">{project.client || '—'}</b>
            {project.address && <span> · {project.address}</span>}
            {project.startDate && (
              <span>
                {' '}
                · {project.startDate} تا {project.endDate || '—'}
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <button className="btn" onClick={() => setEditing((v) => !v)}>
            ✏️ {t('projects.editProject')}
          </button>
          <button className="btn btn-danger" onClick={removeProject}>
            🗑 {t('common.delete')}
          </button>
          <button className="btn btn-primary" onClick={() => setExportOpen(true)} disabled={pdfBusy}>
            ⬇ {pdfBusy ? t('projects.pdfBuilding') : t('projects.exportFull')}
          </button>
        </div>
      </div>
      {pdfMsg && <div className="text-[12px] text-muted mb-3">{pdfMsg}</div>}

      {exportOpen && (
        <ExportDialog
          onClose={() => setExportOpen(false)}
          onRun={async (opt, format) => {
            setExportOpen(false)
            await doPdf(opt, format)
          }}
        />
      )}

      {editing && <EditProject projectId={project.id!} onDone={() => setEditing(false)} />}

      {/* KPI — در نمای کلی، داشبورد خودش شاخص‌ها را نشان می‌دهد */}
      {tab !== 'overview' && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-5">
          <Kpi label={t('projects.contract')} value={tomanShort(project.contractAmount)} sub={`${groupDigits(project.contractAmount)} تومان`} />
          <Kpi label={t('projects.received')} value={tomanShort(showIncome)} sub={t('projects.totalIncome')} tone="success" />
          <Kpi label={t('projects.spent')} value={tomanShort(showExpense)} sub={t('projects.totalExpense')} tone="danger" />
          <Kpi label={t('projects.profit')} value={tomanShort(showNet)} sub={t('projects.netProfit')} tone={showNet >= 0 ? 'success' : 'danger'} />
          <Kpi label={t('projects.progress')} value={`${faDigits(project.progress)}٪`} sub="پیشرفت فیزیکی" tone="info" />
        </div>
      )}

      {/* تب‌ها */}
      <div className="flex gap-1 border-b border-line mb-5 overflow-x-auto">
        {tabs.map(({ k, badge }) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`px-4 py-2 text-[13px] border-b-2 -mb-px whitespace-nowrap transition-colors ${
              tab === k
                ? 'border-[color:var(--b-accent)] text-[color:var(--b-accent)] font-semibold'
                : 'border-transparent text-muted hover:text-ink'
            }`}
          >
            {t(`projects.${k}Tab`)}
            {!!badge && (
              <span className="ms-1.5 text-[10.5px] bg-surface-2 border border-line rounded-full px-1.5">
                {faDigits(badge)}
              </span>
            )}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <OverviewTab
          projectId={project.id!}
          progress={project.progress}
          contractAmount={project.contractAmount}
          received={showIncome}
          expense={showExpense}
          net={showNet}
          receivable={receivable}
          statementTotal={statementTotal}
          tasks={myTasks}
          stages={stages}
          workers={projectWorkers}
          attendances={myAtt}
          payments={myPay}
          photos={photos}
          finance={finance}
          rates={rates}
          measurements={measurements}
          onNavigate={(next) => setTab(next)}
        />
      )}
      {tab === 'finance' && (
        <FinanceTab
          projectId={project.id!}
          finance={finance}
          receivable={receivable}
          statementTotal={statementTotal}
          projectName={project.name}
        />
      )}
      {tab === 'rates' && (
        <RatesTab
          projectId={project.id!}
          rates={rates}
          measurements={measurements}
          incomeToman={showIncome}
          zones={[
            ...new Set(
              [
                ...photos.map((p) => (p.zone || '').trim()),
                ...measurements.map((m) => (m.zone || '').trim()),
              ].filter(Boolean),
            ),
          ].sort()}
        />
      )}
      {tab === 'stages' && <StagesTab projectId={project.id!} stages={[...stages].sort((a, b) => a.order - b.order)} />}
      {tab === 'photos' && <PhotosTab projectId={project.id!} photos={photos} />}
      {tab === 'workers' && (
        <WorkersTab projectId={project.id!} workers={projectWorkers} attendances={myAtt} payments={myPay} />
      )}
      {tab === 'tasks' && <TasksTab tasks={tasks} />}
    </div>
  )
}

/* ================= نمای کلی ================= */

/** کارت شاخص داشبورد — با کلیک به بخش مربوطه می‌رود */
function DashKpi({
  icon,
  label,
  value,
  sub,
  tone,
  onClick,
}: {
  icon: string
  label: string
  value: string
  sub?: string
  tone?: 'success' | 'danger' | 'info' | 'warn' | 'accent'
  onClick?: () => void
}) {
  const colors: Record<string, string> = {
    success: 'var(--b-green)',
    danger: 'var(--b-red)',
    info: 'var(--b-blue)',
    warn: 'var(--b-orange)',
    accent: 'var(--b-accent)',
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className="card p-3.5 text-start w-full transition-colors hover:border-[color:var(--b-accent)]"
      title={onClick ? 'مشاهده جزئیات' : undefined}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11.5px] text-muted">{label}</span>
        <span className="text-[13px] opacity-60">{icon}</span>
      </div>
      <div
        className="text-[17px] font-bold mt-1 leading-tight tabular-nums truncate"
        style={{ color: tone ? colors[tone] : undefined }}
      >
        {value}
      </div>
      {sub && <div className="text-[10.5px] text-faint mt-0.5 truncate">{sub}</div>}
    </button>
  )
}

type DashActivity = {
  key: string
  at: number
  kind: 'income' | 'expense' | 'measure' | 'pay'
  title: string
  amount: number
  date: string
  tab: Tab
  qty?: number
}

function OverviewTab(props: {
  projectId: number
  progress: number
  contractAmount: number
  received: number
  expense: number
  net: number
  receivable: number
  statementTotal: number
  tasks: Task[]
  stages: Stage[]
  workers: Worker[]
  attendances: Attendance[]
  payments: Payment[]
  photos: ProjectPhoto[]
  finance: FinanceEntry[]
  rates: RateItem[]
  measurements: Measurement[]
  onNavigate: (tab: Tab) => void
}) {
  const { t } = useTranslation()
  const [val, setVal] = useState(props.progress)
  const today = todayJalali()

  async function saveProgress(v: number) {
    setVal(v)
    await db.projects.update(props.projectId, { progress: v })
  }

  /* همهٔ آمار از دادهٔ واقعی پروژه — بدون دادهٔ نمونه */
  const d = useMemo(() => {
    const tasks = props.tasks
    const doneTasks = tasks.filter((x) => x.status === 'done').length
    const openTasks = tasks.filter((x) => x.status !== 'done')
    const overdue = openTasks
      .filter((x) => !!x.dueDate && x.dueDate < today)
      .sort((a, b) => (a.dueDate! < b.dueDate! ? -1 : 1))
    const upcoming = openTasks
      .filter((x) => !!x.dueDate && x.dueDate >= today)
      .sort((a, b) => (a.dueDate! < b.dueDate! ? -1 : 1))

    const stages = [...props.stages].sort((a, b) => a.order - b.order)
    const doneStages = stages.filter((s) => s.status === 'done').length
    const activeStages = stages.filter((s) => s.status === 'active')

    const hoursByWorker = new Map<number, number>()
    for (const a of props.attendances) {
      hoursByWorker.set(a.workerId, (hoursByWorker.get(a.workerId) ?? 0) + a.hours)
    }
    const paidByWorker = new Map<number, number>()
    for (const p of props.payments) {
      paidByWorker.set(p.workerId, (paidByWorker.get(p.workerId) ?? 0) + p.amount)
    }
    const workerRows = props.workers
      .map((w) => {
        const h = hoursByWorker.get(w.id!) ?? 0
        const earned = Math.round((h / 8) * w.dailyWage)
        const paid = paidByWorker.get(w.id!) ?? 0
        return { w, hours: h, earned, paid, balance: earned - paid }
      })
      .sort((a, b) => b.balance - a.balance)

    const totalHours = props.attendances.reduce((s, a) => s + a.hours, 0)
    const totalPaid = props.payments.reduce((s, p) => s + p.amount, 0)
    const unsettled = workerRows.filter((r) => r.balance > 0)
    const totalBalance = unsettled.reduce((s, r) => s + r.balance, 0)

    const rateById = new Map(props.rates.map((r) => [r.id!, r]))
    const qtyByRate = new Map<number, number>()
    let statementToman = 0
    for (const m of props.measurements) {
      qtyByRate.set(m.rateId, (qtyByRate.get(m.rateId) ?? 0) + m.qty)
      const r = rateById.get(m.rateId)
      if (r && r.currency === 'toman') statementToman += m.qty * r.price
    }
    const measuredRates = props.rates.filter((r) => (qtyByRate.get(r.id!) ?? 0) > 0)

    const activity: DashActivity[] = [
      ...props.finance.map((f) => ({
        key: `f${f.id}`,
        at: f.createdAt,
        kind: f.type,
        title: f.description || f.category || (f.type === 'income' ? 'دریافتی' : 'هزینه'),
        amount: f.amount,
        date: f.date,
        tab: 'finance' as Tab,
      })),
      ...props.measurements.map((m) => ({
        key: `m${m.id}`,
        at: m.createdAt,
        kind: 'measure' as const,
        title: rateById.get(m.rateId)?.title ?? 'ثبت متراژ',
        amount: 0,
        qty: m.qty,
        date: m.date,
        tab: 'rates' as Tab,
      })),
      ...props.payments.map((p) => {
        const w = props.workers.find((x) => x.id === p.workerId)
        return {
          key: `p${p.id}`,
          at: p.createdAt,
          kind: 'pay' as const,
          title: `پرداخت به ${w?.name ?? 'نیرو'}`,
          amount: p.amount,
          date: p.date,
          tab: 'workers' as Tab,
        }
      }),
    ]
      .sort((a, b) => b.at - a.at)
      .slice(0, 7)

    const recentPhotos = [...props.photos].sort((a, b) => b.createdAt - a.createdAt).slice(0, 6)

    return {
      doneTasks,
      openTasks: openTasks.length,
      overdue,
      upcoming,
      stages,
      doneStages,
      activeStages,
      workerRows,
      totalHours,
      totalPaid,
      unsettled,
      totalBalance,
      measuredRates,
      qtyByRate,
      statementToman,
      activity,
      recentPhotos,
    }
  }, [
    props.tasks,
    props.stages,
    props.workers,
    props.attendances,
    props.payments,
    props.rates,
    props.measurements,
    props.finance,
    props.photos,
    today,
  ])

  const hasReceivable = props.receivable > 0
  const remain = hasReceivable ? props.receivable - props.received : 0
  const receivedPct = hasReceivable ? Math.round((props.received / props.receivable) * 100) : 0
  const taskPct = d.openTasks + d.doneTasks > 0 ? Math.round((d.doneTasks / (d.openTasks + d.doneTasks)) * 100) : 0

  const alerts: { text: string; tab: Tab; tone: 'danger' | 'warn' | 'info' }[] = []
  if (d.overdue.length > 0)
    alerts.push({
      text: `${faDigits(d.overdue.length)} کار عقب‌افتاده از تاریخ مقرر`,
      tab: 'tasks',
      tone: 'danger',
    })
  if (d.unsettled.length > 0)
    alerts.push({
      text: `${faDigits(d.unsettled.length)} نیرو با مانده حساب ${groupDigits(d.totalBalance)} تومان`,
      tab: 'workers',
      tone: 'warn',
    })
  if (props.net < 0)
    alerts.push({
      text: `هزینه‌ها ${groupDigits(Math.abs(props.net))} تومان بیشتر از دریافتی است`,
      tab: 'finance',
      tone: 'danger',
    })
  if (d.activeStages.length > 0)
    alerts.push({
      text: `${faDigits(d.activeStages.length)} مرحله در حال اجراست`,
      tab: 'stages',
      tone: 'info',
    })

  return (
    <div className="b-view space-y-3">
      {/* شاخص‌های مالی */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        <DashKpi
          icon="📄"
          label="طلب کل"
          value={hasReceivable ? `${tomanShort(props.receivable)} تومان` : 'ثبت نشده'}
          sub={
            props.contractAmount > 0
              ? `مبلغ قرارداد · ${groupDigits(props.contractAmount)}`
              : props.statementTotal > 0
                ? `جمع صورت‌وضعیت · ${groupDigits(props.statementTotal)}`
                : 'مبلغ قرارداد یا صورت‌وضعیت ثبت نشده'
          }
          tone="accent"
          onClick={() => props.onNavigate('finance')}
        />
        <DashKpi
          icon="💰"
          label="دریافتی"
          value={`${tomanShort(props.received)} تومان`}
          sub={hasReceivable ? `${faDigits(receivedPct)}٪ از طلب کل` : 'مبلغ قرارداد ثبت نشده'}
          tone="success"
          onClick={() => props.onNavigate('finance')}
        />
        <DashKpi
          icon="🧾"
          label="هزینه‌ها"
          value={`${tomanShort(props.expense)} تومان`}
          sub={`سود ناخالص: ${tomanShort(props.net)} تومان`}
          tone="danger"
          onClick={() => props.onNavigate('finance')}
        />
        <DashKpi
          icon="⏳"
          label="مانده طلب"
          value={hasReceivable ? `${tomanShort(remain)} تومان` : '—'}
          sub={
            hasReceivable
              ? remain > 0
                ? 'دریافت‌نشده از کارفرما'
                : 'تسویه‌شده'
              : 'برای محاسبه، مبلغ قرارداد را ثبت کنید'
          }
          tone={hasReceivable ? (remain > 0 ? 'warn' : 'success') : undefined}
          onClick={() => props.onNavigate('finance')}
        />
      </div>

      {/* هشدارها */}
      {alerts.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {alerts.map((a, i) => (
            <button
              key={i}
              onClick={() => props.onNavigate(a.tab)}
              className="chip transition-colors hover:brightness-110"
              style={{
                background:
                  a.tone === 'danger'
                    ? 'color-mix(in srgb, var(--b-red) 12%, transparent)'
                    : a.tone === 'warn'
                      ? 'color-mix(in srgb, var(--b-orange) 12%, transparent)'
                      : 'color-mix(in srgb, var(--b-blue) 12%, transparent)',
                color:
                  a.tone === 'danger'
                    ? 'var(--b-red)'
                    : a.tone === 'warn'
                      ? 'var(--b-orange)'
                      : 'var(--b-blue)',
                borderColor: 'transparent',
              }}
            >
              {a.tone === 'danger' ? '⚠️' : a.tone === 'warn' ? '🔔' : 'ℹ️'} {a.text}
            </button>
          ))}
        </div>
      )}

      {/* پیشرفت + مراحل اجرا */}
      <div className="grid lg:grid-cols-3 gap-2.5">
        <Panel className="lg:col-span-2">
          <div className="flex items-center justify-between mb-2">
            <b className="text-[13.5px]">📊 پیشرفت پروژه</b>
            <button
              className="text-[11.5px] text-muted hover:text-[color:var(--b-accent)]"
              onClick={() => props.onNavigate('stages')}
            >
              مراحل اجرا →
            </button>
          </div>
          <Bar value={val} className="!h-2.5" />
          <div className="flex items-center gap-3 mt-2.5">
            <input
              type="range"
              min={0}
              max={100}
              value={val}
              onChange={(e) => saveProgress(Number(e.target.value))}
              className="flex-1 accent-[var(--b-accent)]"
            />
            <b className="tabular-nums text-[13.5px] w-10 text-end">{faDigits(val)}٪</b>
          </div>
          <div className="mt-2.5 grid grid-cols-4 gap-2 text-center">
            <div className="bg-surface-2 border border-line rounded-lg py-1.5">
              <div className="text-[14px] font-bold tabular-nums" style={{ color: 'var(--b-accent)' }}>
                {faDigits(val)}٪
              </div>
              <div className="text-[10px] text-faint">فیزیکی</div>
            </div>
            <div className="bg-surface-2 border border-line rounded-lg py-1.5">
              <div className="text-[14px] font-bold tabular-nums">{faDigits(taskPct)}٪</div>
              <div className="text-[10px] text-faint">کارها</div>
            </div>
            <div className="bg-surface-2 border border-line rounded-lg py-1.5">
              <div className="text-[14px] font-bold tabular-nums">{faDigits(props.workers.length)}</div>
              <div className="text-[10px] text-faint">نیرو</div>
            </div>
            <div className="bg-surface-2 border border-line rounded-lg py-1.5">
              <div className="text-[14px] font-bold tabular-nums">{fmtHours(d.totalHours)}</div>
              <div className="text-[10px] text-faint">ساعت کارکرد</div>
            </div>
          </div>

          {d.stages.length > 0 ? (
            <div className="mt-3 pt-2.5 border-t border-line space-y-1.5">
              <div className="flex items-center justify-between text-[11px] text-muted mb-0.5">
                <span>مراحل اجرا</span>
                <span className="tabular-nums">
                  {faDigits(d.doneStages)} از {faDigits(d.stages.length)} تمام‌شده
                </span>
              </div>
              {d.stages.slice(0, 4).map((s) => (
                <button
                  key={s.id}
                  className="w-full text-start group"
                  onClick={() => props.onNavigate('stages')}
                >
                  <div className="flex items-center justify-between gap-2 text-[11.5px]">
                    <span className="truncate group-hover:text-[color:var(--b-accent)]">{s.title}</span>
                    <span className="tabular-nums text-faint shrink-0">{faDigits(s.progress)}٪</span>
                  </div>
                  <div className="h-1 rounded-full bg-surface-2 mt-0.5 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-[width] duration-500"
                      style={{
                        width: `${Math.max(0, Math.min(100, s.progress))}%`,
                        background:
                          s.status === 'done'
                            ? 'var(--b-green)'
                            : s.status === 'active'
                              ? 'var(--b-accent)'
                              : 'var(--b-faint)',
                      }}
                    />
                  </div>
                </button>
              ))}
              {d.stages.length > 4 && (
                <button
                  className="text-[11px] text-muted hover:text-[color:var(--b-accent)]"
                  onClick={() => props.onNavigate('stages')}
                >
                  {faDigits(d.stages.length - 4)} مرحله دیگر…
                </button>
              )}
            </div>
          ) : (
            <div className="mt-3 pt-2.5 border-t border-line text-[11.5px] text-faint">
              هنوز مرحله‌ای ثبت نشده —{' '}
              <button className="underline" onClick={() => props.onNavigate('stages')}>
                افزودن مرحله
              </button>
            </div>
          )}
        </Panel>

        {/* کارگران */}
        <Panel>
          <div className="flex items-center justify-between mb-2">
            <b className="text-[13.5px]">👷 نیروها</b>
            <button
              className="text-[11.5px] text-muted hover:text-[color:var(--b-accent)]"
              onClick={() => props.onNavigate('workers')}
            >
              مدیریت →
            </button>
          </div>
          {d.workerRows.length === 0 ? (
            <div className="text-[11.5px] text-faint py-3 text-center">
              هنوز نیرویی به این پروژه وصل نشده
            </div>
          ) : (
            <div className="space-y-1.5">
              {d.workerRows.slice(0, 5).map((r) => (
                <button
                  key={r.w.id}
                  onClick={() => props.onNavigate('workers')}
                  className="w-full flex items-center gap-2 text-start hover:bg-surface-2 rounded-md px-1 py-1 transition-colors"
                >
                  <span className="w-6 h-6 rounded-full grid place-items-center text-[10px] font-bold bg-surface-2 border border-line text-muted shrink-0">
                    {r.w.name.trim().charAt(0)}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-[11.5px] truncate">{r.w.name}</span>
                    <span className="block text-[10px] text-faint truncate">
                      {fmtHours(r.hours)} ساعت · {r.w.role}
                    </span>
                  </span>
                  <span
                    className="text-[11px] font-semibold tabular-nums shrink-0"
                    style={{
                      color:
                        r.balance > 0 ? 'var(--b-orange)' : r.balance < 0 ? 'var(--b-blue)' : 'var(--b-green)',
                    }}
                  >
                    {r.balance === 0 ? 'تسویه' : groupDigits(Math.abs(r.balance))}
                  </span>
                </button>
              ))}
              {d.workerRows.length > 5 && (
                <div className="text-[10.5px] text-faint text-center pt-0.5">
                  و {faDigits(d.workerRows.length - 5)} نیروی دیگر
                </div>
              )}
            </div>
          )}
          <div className="mt-2.5 pt-2 border-t border-dashed border-line flex items-center justify-between text-[11.5px]">
            <span className="text-muted">مانده حساب کل</span>
            <b
              className="tabular-nums"
              style={{ color: d.totalBalance > 0 ? 'var(--b-orange)' : 'var(--b-green)' }}
            >
              {groupDigits(d.totalBalance)} تومان
            </b>
          </div>
        </Panel>
      </div>

      {/* کارها + فعالیت‌ها */}
      <div className="grid lg:grid-cols-2 gap-2.5">
        <Panel>
          <div className="flex items-center justify-between mb-2">
            <b className="text-[13.5px]">✅ کارها</b>
            <button
              className="text-[11.5px] text-muted hover:text-[color:var(--b-accent)]"
              onClick={() => props.onNavigate('tasks')}
            >
              همه کارها →
            </button>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center mb-2.5">
            <div className="bg-surface-2 border border-line rounded-lg py-1.5">
              <div className="text-[14px] font-bold tabular-nums">{faDigits(d.openTasks)}</div>
              <div className="text-[10px] text-faint">باز</div>
            </div>
            <div className="bg-surface-2 border border-line rounded-lg py-1.5">
              <div className="text-[14px] font-bold tabular-nums" style={{ color: 'var(--b-green)' }}>
                {faDigits(d.doneTasks)}
              </div>
              <div className="text-[10px] text-faint">انجام‌شده</div>
            </div>
            <div className="bg-surface-2 border border-line rounded-lg py-1.5">
              <div
                className="text-[14px] font-bold tabular-nums"
                style={{ color: d.overdue.length ? 'var(--b-red)' : undefined }}
              >
                {faDigits(d.overdue.length)}
              </div>
              <div className="text-[10px] text-faint">عقب‌افتاده</div>
            </div>
          </div>
          {d.overdue.length === 0 && d.upcoming.length === 0 ? (
            <div className="text-[11.5px] text-faint py-3 text-center">
              {d.openTasks === 0 ? 'کاری در جریان نیست' : 'کاری با تاریخ سررسید ثبت نشده'}
            </div>
          ) : (
            <div className="space-y-1">
              {[...d.overdue.slice(0, 3), ...d.upcoming.slice(0, 3)].map((task) => {
                const late = !!task.dueDate && task.dueDate < today
                return (
                  <button
                    key={task.id}
                    onClick={() => props.onNavigate('tasks')}
                    className="w-full flex items-center gap-2 text-start hover:bg-surface-2 rounded-md px-1 py-1 transition-colors"
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full shrink-0"
                      style={{ background: late ? 'var(--b-red)' : 'var(--b-accent)' }}
                    />
                    <span className="flex-1 min-w-0 text-[11.5px] truncate">{task.title}</span>
                    <span
                      className="text-[10.5px] tabular-nums shrink-0"
                      style={{ color: late ? 'var(--b-red)' : 'var(--b-faint)' }}
                    >
                      {formatJalaliShort(task.dueDate!)}
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </Panel>

        <Panel>
          <div className="flex items-center justify-between mb-2">
            <b className="text-[13.5px]">🕒 آخرین فعالیت‌ها</b>
            <button
              className="text-[11.5px] text-muted hover:text-[color:var(--b-accent)]"
              onClick={() => props.onNavigate('finance')}
            >
              دفتر مالی →
            </button>
          </div>
          {d.activity.length === 0 ? (
            <div className="text-[11.5px] text-faint py-3 text-center">هنوز فعالیتی ثبت نشده</div>
          ) : (
            <div className="space-y-1">
              {d.activity.map((a) => {
                const icon =
                  a.kind === 'income' ? '📥' : a.kind === 'expense' ? '📤' : a.kind === 'pay' ? '💵' : '📐'
                const color =
                  a.kind === 'income'
                    ? 'var(--b-green)'
                    : a.kind === 'expense' || a.kind === 'pay'
                      ? 'var(--b-red)'
                      : 'var(--b-blue)'
                return (
                  <button
                    key={a.key}
                    onClick={() => props.onNavigate(a.tab)}
                    className="w-full flex items-center gap-2 text-start hover:bg-surface-2 rounded-md px-1 py-1 transition-colors"
                  >
                    <span className="text-[12px] shrink-0">{icon}</span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-[11.5px] truncate">{a.title}</span>
                      <span className="block text-[10px] text-faint tabular-nums">{a.date}</span>
                    </span>
                    <span className="text-[11px] font-semibold tabular-nums shrink-0" style={{ color }}>
                      {a.kind === 'measure' ? `${faDigits(a.qty ?? 0)}` : groupDigits(a.amount)}
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </Panel>
      </div>

      {/* متراژ / صورت‌وضعیت + تصاویر */}
      <div className="grid lg:grid-cols-2 gap-2.5">
        <Panel>
          <div className="flex items-center justify-between mb-2">
            <b className="text-[13.5px]">📐 متراژ و صورت‌وضعیت</b>
            <button
              className="text-[11.5px] text-muted hover:text-[color:var(--b-accent)]"
              onClick={() => props.onNavigate('rates')}
            >
              مشاهده →
            </button>
          </div>
          {d.measuredRates.length === 0 ? (
            <div className="text-[11.5px] text-faint py-3 text-center">
              هنوز متراژی ثبت نشده —{' '}
              <button className="underline" onClick={() => props.onNavigate('rates')}>
                ثبت متراژ
              </button>
            </div>
          ) : (
            <>
              <div className="space-y-1">
                {d.measuredRates.slice(0, 4).map((r) => {
                  const q = d.qtyByRate.get(r.id!) ?? 0
                  const amount = r.currency === 'toman' ? Math.round(q * r.price) : 0
                  return (
                    <button
                      key={r.id}
                      onClick={() => props.onNavigate('rates')}
                      className="w-full flex items-center gap-2 text-start hover:bg-surface-2 rounded-md px-1 py-1 transition-colors"
                    >
                      <span className="flex-1 min-w-0 text-[11.5px] truncate">{r.title}</span>
                      <span className="text-[10.5px] text-faint tabular-nums shrink-0">
                        {faDigits(q)}
                      </span>
                      <span className="text-[11px] font-semibold tabular-nums shrink-0">
                        {r.currency === 'toman' ? groupDigits(amount) : '—'}
                      </span>
                    </button>
                  )
                })}
              </div>
              <div className="mt-2.5 pt-2 border-t border-dashed border-line flex items-center justify-between text-[11.5px]">
                <span className="text-muted">جمع صورت‌وضعیت</span>
                <b className="tabular-nums">{groupDigits(d.statementToman)} تومان</b>
              </div>
            </>
          )}
        </Panel>

        <Panel>
          <div className="flex items-center justify-between mb-2">
            <b className="text-[13.5px]">🖼️ تصاویر اخیر</b>
            <button
              className="text-[11.5px] text-muted hover:text-[color:var(--b-accent)]"
              onClick={() => props.onNavigate('photos')}
            >
              گالری →
            </button>
          </div>
          {d.recentPhotos.length === 0 ? (
            <div className="text-[11.5px] text-faint py-3 text-center">
              هنوز عکسی آپلود نشده —{' '}
              <button className="underline" onClick={() => props.onNavigate('photos')}>
                افزودن عکس
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-1.5">
              {d.recentPhotos.map((p) => (
                <button
                  key={p.id}
                  onClick={() => props.onNavigate('photos')}
                  className="relative aspect-[4/3] rounded-lg overflow-hidden border border-line group"
                  title={p.caption || p.zone || ''}
                >
                  <img
                    src={p.dataUrl}
                    alt={p.caption || 'عکس پروژه'}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    loading="lazy"
                  />
                  <span className="absolute bottom-1 start-1 text-[9px] px-1 py-px rounded bg-black/55 text-white">
                    {p.category === 'before'
                      ? 'قبل'
                      : p.category === 'during'
                        ? 'حین'
                        : p.category === 'after'
                          ? 'بعد'
                          : 'قرارداد'}
                  </span>
                </button>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </div>
  )
}

/* ================= دفتر مالی ================= */
function FinanceTab({
  projectId,
  finance,
  receivable,
  statementTotal,
  projectName,
}: {
  projectId: number
  finance: FinanceEntry[]
  /** جمع کل طلب از کارفرما (قرارداد یا صورت‌وضعیت) */
  receivable: number
  statementTotal: number
  projectName?: string
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [type, setType] = useState<'income' | 'expense'>('expense')
  const [category, setCategory] = useState('')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(todayJalali())
  const [desc, setDesc] = useState('')

  const income = finance.filter((f) => f.type === 'income').reduce((s, f) => s + f.amount, 0)
  const expense = finance.filter((f) => f.type === 'expense').reduce((s, f) => s + f.amount, 0)

  const sorted = [...finance].sort((a, b) => (a.date < b.date ? 1 : -1))

  const byCat = (() => {
    const m = new Map<string, number>()
    finance.filter((f) => f.type === 'expense').forEach((f) => m.set(f.category, (m.get(f.category) ?? 0) + f.amount))
    return [...m.entries()].sort((a, b) => b[1] - a[1])
  })()
  const maxCat = byCat[0]?.[1] ?? 1

  async function submit(e: FormEvent) {
    e.preventDefault()
    const amt = Number(amount)
    if (!amt || amt <= 0 || !category) return
    const entryDate = date || todayJalali()
    if (!isValidJalali(entryDate)) {
      window.alert('تاریخ معتبر نیست — از تقویم انتخاب کن.')
      return
    }
    const entryId = await db.financeEntries.add({
      projectId,
      type,
      category,
      amount: Math.round(amt),
      date: entryDate,
      description: desc.trim() || undefined,
      createdAt: Date.now(),
    })
    const pname = projectName || '(پروژه)'
    await db.transactions.add({
      type: type === 'income' ? 'income' : 'expense',
      category,
      amount: Math.round(amt),
      date: entryDate,
      note: `${desc.trim() || category} (پروژه: ${pname}) [projEntry:${entryId}]`,
      createdAt: Date.now(),
    })
    setAmount('')
    setDesc('')
    setOpen(false)
  }

  async function remove(id?: number) {
    if (!id) return
    if (!window.confirm(t('projects.deleteConfirm'))) return
    await db.financeEntries.delete(id)
    const tag = `[projEntry:${id}]`
    const all = await db.transactions.toArray()
    const mirrors = all.filter((x) => (x.note ?? '').includes(tag))
    if (mirrors.length > 0) {
      await db.transactions.bulkDelete(mirrors.map((m) => m.id!))
    }
  }

  return (
    <div className="b-view space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MiniKpi label={t('projects.totalIncome')} value={groupDigits(income)} tone="success" />
        <MiniKpi label={t('projects.totalExpense')} value={groupDigits(expense)} tone="danger" />
        <MiniKpi label={t('projects.netProfit')} value={groupDigits(income - expense)} tone={income - expense >= 0 ? 'success' : 'danger'} />
        <MiniKpi
          label={t('projects.remaining')}
          value={groupDigits(receivable - income)}
          tone={receivable - income > 0 ? 'info' : 'success'}
          hint={`${t('projects.remainingHint')} · طلب کل: ${groupDigits(receivable)}`}
        />
      </div>

      {receivable === 0 && statementTotal === 0 && (
        <div className="text-[11.5px] text-faint -mt-2">
          برای محاسبهٔ مانده حساب، مبلغ قرارداد یا نرخ و متراژ کارها را ثبت کن.
        </div>
      )}

      {!open ? (
        <button className="btn btn-primary" onClick={() => { setOpen(true); setCategory(''); setAmount('') }}>
          + {t('projects.addEntry')}
        </button>
      ) : (
        <form onSubmit={submit} className="card p-4 b-pop">
          <div className="flex items-center justify-between mb-3">
            <b className="text-[14px]">{t('projects.addEntry')}</b>
            <button type="button" className="btn btn-ghost !px-2 !py-1 text-[12px]" onClick={() => setOpen(false)}>✕</button>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label={t('projects.entryType')}>
              <div className="flex gap-2">
                <button type="button" className={`btn flex-1 ${type === 'income' ? 'btn-primary' : ''}`} onClick={() => { setType('income'); setCategory('') }}>
                  {t('projects.income')}
                </button>
                <button type="button" className={`btn flex-1 ${type === 'expense' ? 'btn-primary' : ''}`} onClick={() => { setType('expense'); setCategory('') }}>
                  {t('projects.expense')}
                </button>
              </div>
            </Field>
            <div className="sm:col-span-2">
              <Field label={t('projects.entryCategory')}>
                <CategoryPicker group={groupOfType(type)} value={category} onChange={setCategory} />
              </Field>
            </div>
            <Field label={t('projects.entryAmount')} hint="تومان">
              <NumberInput value={amount} onChange={(n) => setAmount(n === 0 ? '' : String(n))} placeholder="58000000" required />
            </Field>
            <Field label={t('projects.entryDate')}>
              <DatePicker value={date} onChange={setDate} />
            </Field>
            <div className="sm:col-span-2">
              <Field label={t('projects.entryDesc')}>
                <TextInput value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="خرید ۲۰۰ کیسه گچ" />
              </Field>
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-3">
            <button type="button" className="btn" onClick={() => setOpen(false)}>{t('common.cancel')}</button>
            <button type="submit" className="btn btn-primary">{t('common.save')}</button>
          </div>
        </form>
      )}

      <div className="grid lg:grid-cols-[1.6fr_1fr] gap-4 items-start">
        <div className="card overflow-hidden">
          <table className="w-full text-[12.5px]">
            <thead>
              <tr className="bg-surface-2 border-b border-line text-[11px] text-faint">
                <th className="text-start font-semibold px-3 py-2.5">تاریخ</th>
                <th className="text-start font-semibold px-2 py-2.5">شرح / دسته</th>
                <th className="text-center font-semibold px-2 py-2.5">نوع</th>
                <th className="text-end font-semibold px-3 py-2.5">مبلغ</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((f) => (
                <tr key={f.id} className="border-b border-line last:border-0 hover:bg-surface-2">
                  <td className="px-3 py-2.5 text-muted text-[11.5px] whitespace-nowrap" dir="ltr">{f.date}</td>
                  <td className="px-2 py-2.5">
                    <div className="font-medium">{f.description || f.category}</div>
                    <div className="text-[11px] text-faint">{f.category}</div>
                  </td>
                  <td className="px-2 py-2.5 text-center">
                    <Chip tone={f.type === 'income' ? 'success' : 'danger'}>
                      {f.type === 'income' ? t('projects.income') : t('projects.expense')}
                    </Chip>
                  </td>
                  <td className="px-3 py-2.5 text-end tabular-nums font-semibold" dir="ltr" style={{ color: f.type === 'income' ? 'var(--b-green)' : 'var(--b-red)' }}>
                    {f.type === 'income' ? '+' : '−'}{groupDigits(f.amount)}
                  </td>
                  <td className="px-2 py-2.5 text-center">
                    <button className="text-faint hover:text-[color:var(--b-red)]" onClick={() => remove(f.id)} title={t('common.delete')}>🗑</button>
                  </td>
                </tr>
              ))}
              {sorted.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-faint">{t('projects.noEntries')}</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <Panel>
          <b className="text-[13.5px] block mb-3">ترکیب هزینه‌ها</b>
          {byCat.length === 0 && <div className="text-[12px] text-faint">هزینه‌ای ثبت نشده</div>}
          {byCat.map(([c, v]) => (
            <div key={c} className="mb-2.5">
              <div className="flex justify-between text-[12px] mb-1">
                <span>{c}</span>
                <span className="tabular-nums text-muted">{groupDigits(v)}</span>
              </div>
              <Bar value={(v / maxCat) * 100} />
            </div>
          ))}
        </Panel>
      </div>
    </div>
  )
}

/* ================= مراحل اجرا ================= */
function StagesTab({ projectId, stages }: { projectId: number; stages: Stage[] }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')

  async function add(e: FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    const maxOrder = stages.reduce((m, s) => Math.max(m, s.order), 0)
    await db.stages.add({
      projectId,
      title: title.trim(),
      progress: 0,
      status: 'pending',
      order: maxOrder + 1,
    })
    setTitle('')
    setOpen(false)
  }

  async function setStatus(s: Stage, next: Stage['status']) {
    if (!s.id) return
    await db.stages.update(s.id, {
      status: next,
      progress: next === 'done' ? 100 : next === 'pending' ? 0 : s.progress === 100 ? 50 : s.progress,
    })
  }

  async function setProgress(s: Stage, v: number) {
    if (!s.id) return
    await db.stages.update(s.id, {
      progress: v,
      status: v >= 100 ? 'done' : v > 0 ? 'active' : 'pending',
    })
  }

  async function setStageDate(s: Stage, field: 'startDate' | 'endDate', v: string) {
    if (!s.id) return
    await db.stages.update(s.id, field === 'startDate' ? { startDate: v || undefined } : { endDate: v || undefined })
  }

  async function remove(id?: number) {
    if (!id) return
    if (!window.confirm(t('projects.deleteConfirm'))) return
    await db.stages.delete(id)
  }

  return (
    <div className="b-view">
      {!open ? (
        <button className="btn btn-primary mb-4" onClick={() => setOpen(true)}>+ {t('projects.addStage')}</button>
      ) : (
        <form onSubmit={add} className="card p-4 mb-4 b-pop flex gap-2">
          <input autoFocus className="field flex-1" placeholder={t('projects.stageTitle')} value={title} onChange={(e) => setTitle(e.target.value)} />
          <button type="submit" className="btn btn-primary">{t('common.save')}</button>
          <button type="button" className="btn" onClick={() => setOpen(false)}>{t('common.cancel')}</button>
        </form>
      )}

      {stages.length === 0 ? (
        <EmptyState icon="📈" title={t('projects.noStages')} hint="مراحل اجرا مثل فونداسیون، اسکلت، نازک‌کاری…" />
      ) : (
        <div className="card p-4 sm:p-5">
          {stages.map((s, i) => (
            <div key={s.id} className="flex gap-3 relative pb-5 last:pb-0">
              {i < stages.length - 1 && (
                <span className="absolute top-[22px] bottom-0 w-[2px] bg-line" style={{ insetInlineStart: 9 }} />
              )}
              <span
                className={`w-5 h-5 rounded-full border-2 grid place-items-center text-[10px] shrink-0 z-[1] ${
                  s.status === 'done' ? 'text-white border-transparent' : 'bg-surface border-line'
                }`}
                style={s.status === 'done' ? { background: 'var(--b-accent)', borderColor: 'var(--b-accent)' } : s.status === 'active' ? { borderColor: 'var(--b-accent)' } : undefined}
              >
                {s.status === 'done' ? '✓' : ''}
              </span>
              <div className={`flex-1 border border-line rounded-xl p-3 ${s.status === 'active' ? 'bg-[color:var(--b-accent-soft)]' : 'bg-surface-2'}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <b className="text-[13.5px] flex-1">{s.title}</b>
                  <div className="flex gap-1">
                    {(['pending', 'active', 'done'] as Stage['status'][]).map((st) => (
                      <button
                        key={st}
                        onClick={() => setStatus(s, st)}
                        className={`text-[10.5px] px-2 py-0.5 rounded-full border transition-colors ${
                          s.status === st ? 'text-white border-transparent' : 'border-line text-faint hover:text-ink'
                        }`}
                        style={s.status === st ? { background: 'var(--b-accent)' } : undefined}
                      >
                        {st === 'pending' ? 'شروع‌نشده' : st === 'active' ? 'در حال اجرا' : 'تمام‌شده'}
                      </button>
                    ))}
                    <button className="text-faint hover:text-[color:var(--b-red)] text-[12px] px-1" onClick={() => remove(s.id)}>🗑</button>
                  </div>
                </div>
                {(s.startDate || s.endDate) && (
                  <div className="text-[11px] text-muted mt-1" dir="ltr">{s.startDate || '—'} → {s.endDate || '—'}</div>
                )}
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  <span className="text-[11px] text-muted">شروع:</span>
                  <DatePicker value={s.startDate ?? ''} onChange={(v) => setStageDate(s, 'startDate', v)} placeholder="تاریخ شروع" />
                  <span className="text-[11px] text-muted">پایان:</span>
                  <DatePicker value={s.endDate ?? ''} onChange={(v) => setStageDate(s, 'endDate', v)} placeholder="تاریخ پایان" />
                </div>
                <div className="flex items-center gap-2.5 mt-2">
                  <input type="range" min={0} max={100} value={s.progress} onChange={(e) => setProgress(s, Number(e.target.value))} className="flex-1 accent-[var(--b-accent)]" />
                  <b className="text-[12px] tabular-nums">{faDigits(s.progress)}٪</b>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ================= گالری عکس ================= */
function PhotosTab({ projectId, photos }: { projectId: number; photos: ProjectPhoto[] }) {
  const { t } = useTranslation()
  const [busy, setBusy] = useState(false)
  const [catFilter, setCatFilter] = useState<'all' | ProjectPhoto['category']>('all')
  const [zoneFilter, setZoneFilter] = useState<string>('all')
  const [viewerId, setViewerId] = useState<number | null>(null)
  /** عکس‌های انتخاب‌شده که هنوز دسته/متراژ/توضیحاتشان تأیید نشده */
  const [pending, setPending] = useState<string[]>([])
  const fileRef = useRef<HTMLInputElement>(null)

  const totalKB = photos.reduce((s, p) => s + dataUrlKB(p.dataUrl), 0)
  const zones = useMemo(
    () => [...new Set(photos.map((p) => (p.zone || '').trim()).filter(Boolean))].sort(),
    [photos],
  )
  const groups: { k: ProjectPhoto['category']; label: string }[] = [
    { k: 'before', label: t('projects.catBefore') },
    { k: 'during', label: t('projects.catDuring') },
    { k: 'after', label: t('projects.catAfter') },
    { k: 'contract', label: t('projects.catContract') },
  ]
  const catLabel = (c: ProjectPhoto['category']) => groups.find((g) => g.k === c)?.label ?? c

  /** مرحله ۱: فقط عکس انتخاب می‌شود */
  async function onFiles(files: FileList | null) {
    if (!files?.length) return
    setBusy(true)
    try {
      const list: string[] = []
      for (const f of Array.from(files)) {
        if (!f.type.startsWith('image/')) continue
        list.push(await compressImage(f))
      }
      if (list.length) setPending(list)
    } finally {
      setBusy(false)
    }
  }

  /** مرحله ۲: بعد از تأیید دسته/توضیحات/متراژ، عکس‌ها وارد لیست می‌شوند */
  async function commitPending(v: {
    category: ProjectPhoto['category']
    zone: string
    area?: number
    caption: string
    date: string
  }) {
    for (const dataUrl of pending) {
      await db.projectPhotos.add({
        projectId,
        category: v.category,
        zone: v.zone.trim() || undefined,
        area: v.area,
        caption: v.caption.trim() || undefined,
        dataUrl,
        date: v.date || todayJalali(),
        createdAt: Date.now(),
      })
    }
    setPending([])
  }

  async function remove(id?: number) {
    if (!id) return
    if (!window.confirm(t('projects.deleteConfirm'))) return
    await db.projectPhotos.delete(id)
    if (viewerId === id) setViewerId(null)
  }

  // اعمال فیلترها
  const filtered = photos.filter(
    (p) =>
      (catFilter === 'all' || p.category === catFilter) &&
      (zoneFilter === 'all' || (p.zone || '').trim() === zoneFilter),
  )
  // گروه‌بندی بر اساس قسمت ساختمان
  const byZone = useMemo(() => {
    const m = new Map<string, ProjectPhoto[]>()
    for (const p of filtered) {
      const z = (p.zone || '').trim()
      if (!m.has(z)) m.set(z, [])
      m.get(z)!.push(p)
    }
    // قسمت‌های دارای عکس اول، «بدون عنوان» آخر
    return [...m.entries()].sort((a, b) => (a[0] === '' ? 1 : 0) - (b[0] === '' ? 1 : 0))
  }, [filtered])

  const viewer = viewerId ? photos.find((p) => p.id === viewerId) ?? null : null

  // متراژ ثبت‌شده برای هر قسمت (بیشترین مقدار بین عکس‌های همان قسمت)
  const zoneArea = (z: string) => {
    const list = photos.filter((p) => (p.zone || '').trim() === z && p.area)
    return list.length ? Math.max(...list.map((p) => p.area ?? 0)) : 0
  }

  return (
    <div className="b-view">
      <div className="card p-3.5 mb-4">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex-1 min-w-[180px]">
            <b className="text-[13px] block">افزودن عکس جدید</b>
            <span className="text-[11px] text-faint">
              اول عکس را انتخاب کن، بعد دسته و توضیحات و متراژ را وارد و تأیید کن.
            </span>
          </div>
          <button className="btn btn-primary" onClick={() => fileRef.current?.click()} disabled={busy}>
            📷 {busy ? '…' : t('projects.addPhoto')}
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
        <div className="text-[11px] text-faint mt-2">
          💾 {humanSize(totalKB)} · {t('projects.zoneHint')}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <select className="field !w-auto !py-1 !text-[12px]" value={zoneFilter} onChange={(e) => setZoneFilter(e.target.value)}>
          <option value="all">{t('projects.allZones')} ({faDigits(photos.length)})</option>
          {zones.map((z) => (
            <option key={z} value={z}>{z}</option>
          ))}
          <option value="">{t('projects.noZone')}</option>
        </select>
        <div className="flex gap-1 flex-wrap">
          {(['all', 'before', 'during', 'after', 'contract'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setCatFilter(f)}
              className={`text-[11.5px] px-2.5 py-1 rounded-full border transition-colors ${
                catFilter === f ? 'text-white border-transparent' : 'border-line text-muted'
              }`}
              style={catFilter === f ? { background: 'var(--b-accent)' } : undefined}
            >
              {f === 'all' ? t('common.all') : catLabel(f)}
            </button>
          ))}
        </div>
      </div>

      {photos.length === 0 ? (
        <EmptyState icon="🖼️" title={t('projects.noPhotos')} hint="عکس قبل، حین و بعد اجرا رو اینجا نگه دار" />
      ) : byZone.length === 0 ? (
        <EmptyState icon="🔍" title={t('common.empty')} />
      ) : (
        <div className="space-y-5">
          {byZone.map(([z, list]) => (
            <div key={z || '__none'}>
              <div className="text-[13.5px] font-semibold mb-2 flex items-center gap-2">
                <span style={{ color: 'var(--b-accent)' }}>📍</span>
                {z || t('projects.noZone')}
                <span className="text-[11px] text-faint font-normal">· {faDigits(list.length)} عکس</span>
                {zoneArea(z) > 0 && (
                  <span className="chip chip-success !text-[10.5px] !py-0">
                    {faDigits(zoneArea(z))} م²
                  </span>
                )}
              </div>
              <div className="space-y-3">
                {groups.map((g) => {
                  const gl = list.filter((p) => p.category === g.k)
                  if (!gl.length) return null
                  return (
                    <div key={g.k}>
                      <div className="text-[12px] text-muted mb-1.5">
                        {g.label} <span className="text-[10.5px] text-faint">· {faDigits(gl.length)}</span>
                      </div>
                      <PhotoGrid list={gl} onView={(p) => setViewerId(p.id!)} onRemove={remove} showZone={false} />
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {viewer && (
        <PhotoViewer
          photo={viewer}
          zones={zones}
          catLabel={catLabel}
          onClose={() => setViewerId(null)}
          onRemove={remove}
        />
      )}

      {pending.length > 0 && (
        <PhotoAddDialog
          previews={pending}
          groups={groups}
          zones={zones}
          onCancel={() => setPending([])}
          onConfirm={commitPending}
        />
      )}
    </div>
  )
}

/* دیالوگ مرحلهٔ دوم افزودن عکس: دسته + توضیحات + متراژ + تأیید */
function PhotoAddDialog({
  previews,
  groups,
  zones,
  onCancel,
  onConfirm,
}: {
  previews: string[]
  groups: { k: ProjectPhoto['category']; label: string }[]
  zones: string[]
  onCancel: () => void
  onConfirm: (v: {
    category: ProjectPhoto['category']
    zone: string
    area?: number
    caption: string
    date: string
  }) => Promise<void>
}) {
  const { t } = useTranslation()
  const [category, setCategory] = useState<ProjectPhoto['category']>('during')
  const [zone, setZone] = useState('')
  const [area, setArea] = useState('')
  const [caption, setCaption] = useState('')
  const [date, setDate] = useState(todayJalali())
  const [saving, setSaving] = useState(false)

  async function confirm() {
    setSaving(true)
    try {
      await onConfirm({
        category,
        zone,
        area: area.trim() ? Number(area) : undefined,
        caption,
        date,
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/55 grid place-items-center p-4" onClick={onCancel}>
      <div className="card w-full max-w-lg p-4 b-pop max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <b className="text-[14px]">🖼️ افزودن عکس ({faDigits(previews.length)})</b>
          <button className="btn btn-ghost !px-2 !py-1 text-[12px]" onClick={onCancel}>✕</button>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-2 mb-3">
          {previews.map((src, i) => (
            <img key={i} src={src} alt="" className="h-24 w-24 object-cover rounded-lg border border-line shrink-0" />
          ))}
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <label className="block">
            <span className="text-[11px] text-muted block mb-1">دسته</span>
            <select className="field" value={category} onChange={(e) => setCategory(e.target.value as never)}>
              {groups.map((g) => (
                <option key={g.k} value={g.k}>{g.label}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-[11px] text-muted block mb-1">{t('projects.zoneLabel')}</span>
            <input
              className="field"
              list="zone-suggestions-add"
              value={zone}
              onChange={(e) => setZone(e.target.value)}
              placeholder="سرویس بهداشتی، راهرو، کف سالن…"
            />
            <datalist id="zone-suggestions-add">
              {zones.map((z) => (
                <option key={z} value={z} />
              ))}
            </datalist>
          </label>
          <label className="block">
            <span className="text-[11px] text-muted block mb-1">متراژ (م²)</span>
            <NumberInput
              decimal
              value={area}
              onChange={(n) => setArea(n === 0 ? '' : String(n))}
              placeholder="۱۲٫۵"
            />
          </label>
          <label className="block">
            <span className="text-[11px] text-muted block mb-1">تاریخ</span>
            <input className="field" dir="ltr" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label className="block sm:col-span-2">
            <span className="text-[11px] text-muted block mb-1">توضیحات</span>
            <input
              className="field"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="مثلاً سرامیک کف سالن بعد از اتمام"
            />
          </label>
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <button className="btn" onClick={onCancel} disabled={saving}>{t('common.cancel')}</button>
          <button className="btn btn-primary" onClick={confirm} disabled={saving}>
            {saving ? '…' : `✓ تأیید و افزودن (${faDigits(previews.length)})`}
          </button>
        </div>
      </div>
    </div>
  )
}

/* دیالوگ نمایش عکس با امکان ویرایش دسته و عنوان قسمت */
function PhotoViewer({
  photo,
  zones,
  catLabel,
  onClose,
  onRemove,
}: {
  photo: ProjectPhoto
  zones: string[]
  catLabel: (c: ProjectPhoto['category']) => string
  onClose: () => void
  onRemove: (id?: number) => void
}) {
  const { t } = useTranslation()
  const [zone, setZone] = useState(photo.zone ?? '')
  const [area, setArea] = useState(photo.area ? String(photo.area) : '')
  const [cat, setCat] = useState(photo.category)
  const [saved, setSaved] = useState(false)

  async function save() {
    if (!photo.id) return
    await db.projectPhotos.update(photo.id, {
      zone: zone.trim() || undefined,
      area: area.trim() ? Number(area) : undefined,
      category: cat,
    })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/80 grid place-items-center p-4" onClick={onClose}>
      <div className="max-w-3xl w-full bg-surface rounded-xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <img src={photo.dataUrl} alt="" className="w-full max-h-[60vh] object-contain bg-black" />
        <div className="p-3.5 space-y-2.5">
          <div className="text-[12px] text-muted">
            {photo.date} · {humanSize(dataUrlKB(photo.dataUrl))}
          </div>
          <div className="grid sm:grid-cols-3 gap-2.5">
            <label className="block">
              <span className="text-[11px] text-muted block mb-1">دسته</span>
              <select className="field !py-1.5" value={cat} onChange={(e) => setCat(e.target.value as ProjectPhoto['category'])}>
                {(['before', 'during', 'after', 'contract'] as const).map((c) => (
                  <option key={c} value={c}>{catLabel(c)}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-[11px] text-muted block mb-1">{t('projects.zoneLabel')}</span>
              <input
                className="field !py-1.5"
                list="zone-suggestions-viewer"
                value={zone}
                onChange={(e) => setZone(e.target.value)}
              />
              <datalist id="zone-suggestions-viewer">
                {zones.map((z) => (
                  <option key={z} value={z} />
                ))}
              </datalist>
            </label>
            <label className="block">
              <span className="text-[11px] text-muted block mb-1">متراژ قسمت (م²)</span>
              <NumberInput decimal value={area} onChange={(n) => setArea(n === 0 ? '' : String(n))} placeholder="۱۲٫۵" />
            </label>
          </div>
          <div className="flex items-center gap-2">
            {saved && <span className="text-[12px]" style={{ color: 'var(--b-green)' }}>{t('workers.logSaved')}</span>}
            <span className="flex-1" />
            <button className="btn btn-danger !py-1" onClick={() => onRemove(photo.id)}>🗑 {t('common.delete')}</button>
            <button className="btn btn-primary !py-1" onClick={save}>{t('common.save')}</button>
            <button className="btn !py-1" onClick={onClose}>{t('common.close')}</button>
          </div>
        </div>
      </div>
    </div>
  )
}

function PhotoGrid({ list, onView, onRemove, showZone = true }: { list: ProjectPhoto[]; onView: (p: ProjectPhoto) => void; onRemove: (id?: number) => void; showZone?: boolean }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
      {list.map((p) => (
        <div key={p.id} className="card overflow-hidden group cursor-pointer" onClick={() => onView(p)}>
          <div className="relative">
            <img src={p.dataUrl} alt="" className="w-full h-32 object-cover" loading="lazy" />
            <button
              className="absolute top-1.5 end-1.5 w-7 h-7 rounded-lg bg-black/55 text-white text-[12px] opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={(e) => { e.stopPropagation(); onRemove(p.id) }}
            >
              🗑
            </button>
          </div>
          <div className="px-2.5 py-1.5 text-[11px] text-muted">
            <div className="flex justify-between" dir="ltr">
              <span>{p.date}</span>
              <span>{humanSize(dataUrlKB(p.dataUrl))}</span>
            </div>
            {showZone && p.zone && <div className="truncate mt-0.5" dir="rtl">📍 {p.zone}</div>}
          </div>
        </div>
      ))}
    </div>
  )
}

/* ================= کارگران پروژه ================= */
function WorkersTab({ workers, attendances, payments }: { projectId: number; workers: Worker[]; attendances: Attendance[]; payments: Payment[] }) {
  const { t } = useTranslation()
  if (!workers.length) {
    return (
      <EmptyState
        icon="👷"
        title={t('workers.noWorkers')}
        hint={t('workers.noWorkersHint')}
        action={<Link to="/workers" className="btn btn-primary">{t('workers.addWorker')} →</Link>}
      />
    )
  }
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 b-view">
      {workers.map((w) => {
        const h = attendances.filter((a) => a.workerId === w.id).reduce((s, a) => s + a.hours, 0)
        const earned = Math.round((h / 8) * w.dailyWage)
        const paid = payments.filter((p) => p.workerId === w.id).reduce((s, p) => s + p.amount, 0)
        const bal = earned - paid
        return (
          <div key={w.id} className="card p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-[14px] font-semibold">{w.name}</div>
                <div className="text-[12px] text-muted">{w.role}</div>
              </div>
              <Chip>{groupDigits(w.dailyWage)} تومان/روز</Chip>
            </div>
            <div className="grid grid-cols-3 gap-2 mt-3 text-center">
              <div className="bg-surface-2 border border-line rounded-lg py-1.5">
                <div className="text-[14px] font-bold tabular-nums">{fmtHours(h)}</div>
                <div className="text-[10px] text-faint">ساعت</div>
              </div>
              <div className="bg-surface-2 border border-line rounded-lg py-1.5">
                <div className="text-[14px] font-bold tabular-nums" style={{ color: 'var(--b-red)' }}>{tomanShort(earned)}</div>
                <div className="text-[10px] text-faint">مزد</div>
              </div>
              <div className="bg-surface-2 border border-line rounded-lg py-1.5">
                <div className="text-[14px] font-bold tabular-nums" style={{ color: 'var(--b-green)' }}>{tomanShort(paid)}</div>
                <div className="text-[10px] text-faint">پرداختی</div>
              </div>
            </div>
            <div className="mt-2.5 flex justify-center">
              {Math.abs(bal) < 1 ? (
                <Chip tone="success">{t('workers.settled')}</Chip>
              ) : bal > 0 ? (
                <Chip tone="warn">{t('workers.creditor')} {groupDigits(bal)}</Chip>
              ) : (
                <Chip tone="info">{t('workers.debtor')} {groupDigits(Math.abs(bal))}</Chip>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

/* ================= کارهای پروژه ================= */
function TasksTab({ tasks }: { tasks: Task[] }) {
  const { t } = useTranslation()
  const roots = tasks.filter((x) => !x.parentId)
  if (!roots.length) {
    return <EmptyState icon="📋" title="کاری برای این پروژه ثبت نشده" hint="از صفحه امروز تسک بساز و به پروژه وصل کن" />
  }
  return (
    <div className="card divide-y divide-[color:var(--b-border)] b-view">
      {roots.map((task) => {
        const subs = tasks.filter((x) => x.parentId === task.id)
        const done = task.status === 'done'
        return (
          <div key={task.id} className="px-4 py-3">
            <div className="flex items-center gap-3">
              <span className={`w-[18px] h-[18px] rounded-md border-[1.5px] grid place-items-center text-[10px] ${done ? 'text-white border-transparent' : 'bg-surface border-line'}`} style={done ? { background: 'var(--b-accent)' } : undefined}>
                {done ? '✓' : ''}
              </span>
              <span className={`flex-1 text-[13.5px] ${done ? 'line-through text-faint' : 'font-medium'}`}>{task.title}</span>
              <Chip tone={task.priority === 0 ? 'danger' : task.priority === 1 ? 'warn' : 'default'}>P{task.priority}</Chip>
              <Chip>{t(`status.${task.status}`)}</Chip>
              {task.dueDate && <span className="text-[11.5px] text-faint">{task.dueDate}</span>}
            </div>
            {subs.length > 0 && (
              <div className="ms-[30px] mt-2 flex flex-wrap gap-1.5">
                {subs.map((s) => (
                  <span key={s.id} className={`chip ${s.status === 'done' ? 'chip-success' : ''}`}>
                    {s.status === 'done' ? '✓ ' : ''}{s.title}
                  </span>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

/* ================= ویرایش پروژه ================= */
function EditProject({ projectId, onDone }: { projectId: number; onDone: () => void }) {
  const { t } = useTranslation()
  const project = useLiveQuery(() => db.projects.get(projectId), [projectId])
  const [name, setName] = useState<string | null>(null)
  const [client, setClient] = useState<string | null>(null)
  const [address, setAddress] = useState<string | null>(null)
  const [contract, setContract] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)

  if (!project) return null
  const proj = project
  const v = {
    name: name ?? proj.name,
    client: client ?? proj.client ?? '',
    address: address ?? proj.address ?? '',
    contract: contract ?? String(proj.contractAmount),
    status: status ?? proj.status,
  }

  async function save(e: FormEvent) {
    e.preventDefault()
    await db.projects.update(projectId, {
      name: v.name.trim() || proj.name,
      client: v.client.trim() || undefined,
      address: v.address.trim() || undefined,
      contractAmount: Number(v.contract) || 0,
      status: v.status as never,
    })
    onDone()
  }

  return (
    <form onSubmit={save} className="card p-4 mb-4 b-pop">
      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="نام پروژه"><TextInput value={v.name} onChange={(e) => setName(e.target.value)} /></Field>
        <Field label={t('projects.client')}><TextInput value={v.client} onChange={(e) => setClient(e.target.value)} /></Field>
        <Field label={t('projects.address')}><TextInput value={v.address} onChange={(e) => setAddress(e.target.value)} /></Field>
        <Field label={t('projects.contract')} hint="تومان">
          <NumberInput value={v.contract} onChange={(n) => setContract(n === 0 ? '' : String(n))} />
        </Field>
        <Field label={t('projects.status')}>
          <select className="field" value={v.status} onChange={(e) => setStatus(e.target.value)}>
            <option value="active">{t('projectStatus.active')}</option>
            <option value="waiting">{t('projectStatus.waiting')}</option>
            <option value="paused">{t('projectStatus.paused')}</option>
            <option value="done">{t('projectStatus.done')}</option>
          </select>
        </Field>
      </div>
      <div className="flex justify-end gap-2 mt-3">
        <button type="button" className="btn" onClick={onDone}>{t('common.cancel')}</button>
        <button type="submit" className="btn btn-primary">{t('common.save')}</button>
      </div>
    </form>
  )
}

/* ================= دیالوگ خروجی قابل تنظیم ================= */
function ExportDialog({ onClose, onRun }: { onClose: () => void; onRun: (o: ExportOptions, f: ProjectExportFormat) => void }) {
  const { t } = useTranslation()
  const [opt, setOpt] = useState<ExportOptions>({ ...ALL_SECTIONS })
  const [format, setFormat] = useState<ProjectExportFormat>('pdf')

  const formats: { k: ProjectExportFormat; label: string; icon: string }[] = [
    { k: 'pdf', label: 'PDF', icon: '📕' },
    { k: 'jpg', label: 'تصویر JPG', icon: '🖼️' },
    { k: 'word', label: 'Word', icon: '📄' },
    { k: 'excel', label: 'Excel', icon: '📊' },
    { k: 'json', label: 'JSON', icon: '🗂️' },
    { k: 'visio', label: 'MS Visio', icon: '📐' },
  ]

  const items: { k: keyof ExportOptions; label: string; hint: string }[] = [
    { k: 'finance', label: t('projects.secFinance'), hint: 'دریافتی و پرداختی‌ها' },
    { k: 'stages', label: t('projects.secStages'), hint: 'تایم‌لاین پیشرفت' },
    { k: 'rates', label: t('projects.secRates'), hint: 'نرخ × متراژ = صورت‌وضعیت' },
    { k: 'workers', label: t('projects.secWorkers'), hint: 'کارکرد، مزد و مانده نیروها' },
    { k: 'photos', label: t('projects.secPhotos'), hint: 'قبل / حین / بعد به تفکیک قسمت' },
    { k: 'contract', label: t('projects.secContract'), hint: 'تصویر قرارداد کاری' },
  ]

  const allOn = items.every((i) => opt[i.k])

  return (
    <div className="fixed inset-0 z-50 bg-black/45 grid place-items-center p-4" onClick={onClose}>
      <div className="card w-full max-w-md p-5 b-pop" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-1">
          <b className="text-[15px]">⬇ {t('projects.exportFull')}</b>
          <button className="btn btn-ghost !px-2 !py-1" onClick={onClose}>✕</button>
        </div>
        <p className="text-[12px] text-muted mb-3">{t('projects.customizeExport')}</p>

        <div className="mb-4">
          <div className="text-[11.5px] text-muted mb-1.5">قالب خروجی</div>
          <div className="grid grid-cols-3 gap-1.5">
            {formats.map((f) => (
              <button
                key={f.k}
                type="button"
                onClick={() => setFormat(f.k)}
                className={`btn !py-1.5 !px-2 text-[12px] ${format === f.k ? 'btn-primary' : ''}`}
              >
                {f.icon} {f.label}
              </button>
            ))}
          </div>
          {format === 'visio' && (
            <div className="text-[11px] text-faint mt-1.5">
              فایل VDX برای ویرایش نهایی در Microsoft Visio ساخته می‌شود.
            </div>
          )}
        </div>

        <div className="space-y-2">
          {items.map((i) => (
            <div key={i.k}>
              <label
                className={`flex items-center gap-3 border rounded-xl px-3 py-2.5 cursor-pointer transition-colors ${
                  opt[i.k] ? 'border-[color:var(--b-accent)] bg-[color:var(--b-accent-soft)]' : 'border-line'
                }`}
              >
                <input
                  type="checkbox"
                  checked={opt[i.k]}
                  onChange={() => setOpt((o) => ({ ...o, [i.k]: !o[i.k] }))}
                  className="w-4 h-4 accent-[var(--b-accent)]"
                />
                <span className="flex-1">
                  <span className="block text-[13px] font-medium">{i.label}</span>
                  <span className="block text-[11px] text-faint">{i.hint}</span>
                </span>
              </label>
              {i.k === 'rates' && opt.rates && (
                <label className="flex items-center gap-2.5 mt-1.5 me-1 text-[12.5px] text-muted cursor-pointer">
                  <input
                    type="checkbox"
                    checked={opt.ratesQuantitiesOnly}
                    onChange={() => setOpt((o) => ({ ...o, ratesQuantitiesOnly: !o.ratesQuantitiesOnly }))}
                    className="w-4 h-4 accent-[var(--b-accent)]"
                  />
                  📐 {t('projects.ratesQuantitiesOnly')}
                </label>
              )}
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2 mt-4">
          <button className="btn !py-1.5 text-[12.5px]" onClick={() => setOpt(allOn ? { ...ALL_SECTIONS, finance: false, stages: false, rates: false, workers: false, photos: false, contract: false } : { ...ALL_SECTIONS })}>
            {allOn ? t('common.selectNone') : t('common.selectAll')}
          </button>
          <span className="flex-1" />
          <button className="btn" onClick={onClose}>{t('common.cancel')}</button>
          <button className="btn btn-primary" onClick={() => onRun(opt, format)}>
            {t('projects.exportNow')}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ================= قطعات ================= */
function Kpi({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'success' | 'danger' | 'info' }) {
  const colors = { success: 'var(--b-green)', danger: 'var(--b-red)', info: 'var(--b-blue)' }
  return (
    <div className="card p-3.5">
      <div className="text-[11.5px] text-muted">{label}</div>
      <div className="text-[19px] font-bold mt-0.5 leading-tight" style={{ color: tone ? colors[tone] : undefined }}>{value}</div>
      {sub && <div className="text-[10.5px] text-faint mt-0.5">{sub}</div>}
    </div>
  )
}

function MiniKpi({ label, value, tone, hint }: { label: string; value: string; tone?: 'success' | 'danger' | 'info'; hint?: string }) {
  const colors = { success: 'var(--b-green)', danger: 'var(--b-red)', info: 'var(--b-blue)' }
  return (
    <div className="card p-3.5 text-center">
      <div className="text-[11.5px] text-muted">{label}</div>
      <div className="text-[17px] font-bold tabular-nums mt-0.5" dir="ltr" style={{ color: tone ? colors[tone] : undefined }}>{value}</div>
      <div className="text-[10px] text-faint">{hint ?? 'تومان'}</div>
    </div>
  )
}

function Row({ label, value, tone }: { label: string; value: string; tone?: 'success' | 'danger' }) {
  const colors = { success: 'var(--b-green)', danger: 'var(--b-red)' }
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-[12.5px] text-muted">{label}</span>
      <span className="text-[13px] font-semibold tabular-nums" style={{ color: tone ? colors[tone] : undefined }}>{value}</span>
    </div>
  )
}

