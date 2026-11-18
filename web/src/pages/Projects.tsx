import { useRef, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import { db, type Project, type ProjectStatus, type FinanceEntry, type ProjectPhoto } from '../db/schema'
import { groupDigits, tomanShort, faDigits } from '../lib/format'
import { compressImage } from '../lib/photos'
import { deleteProjectCascade } from '../lib/projectDelete'
import { todayJalali } from '../lib/jalali'
import { Chip, EmptyState, Bar, Field, TextInput, NumberInput } from '../ui/components'
import { statusColor } from '../ui/layout'

export function statusTone(status: ProjectStatus) {
  return status === 'done'
    ? 'success'
    : status === 'active'
      ? 'warn'
      : status === 'waiting'
        ? 'info'
        : 'default'
}

export default function ProjectsPage() {
  const { t } = useTranslation()
  const nav = useNavigate()
  const projects = useLiveQuery(() => db.projects.orderBy('createdAt').reverse().toArray(), [], [] as Project[])
  const allFinance = useLiveQuery(() => db.financeEntries.toArray(), [], [] as FinanceEntry[])
  const allPhotos = useLiveQuery(() => db.projectPhotos.toArray(), [], [] as ProjectPhoto[])
  const [filter, setFilter] = useState<'all' | ProjectStatus>('all')

  async function removeProject(id?: number, e?: React.MouseEvent) {
    e?.stopPropagation()
    e?.preventDefault()
    if (!id) return
    if (!window.confirm('این پروژه حذف بشه؟ همه تراکنش‌ها، مراحل، عکس‌ها، نرخ‌ها، حضور و غیاب و پرداختی‌هایش هم پاک می‌شن.')) return
    await deleteProjectCascade(id)
  }

  const list = filter === 'all' ? projects : projects.filter((p) => p.status === filter)

  const active = projects.filter((p) => p.status === 'active' || p.status === 'waiting')
  const done = projects.filter((p) => p.status === 'done')
  const finOf = (pid?: number) => allFinance.filter((f) => f.projectId === pid)
  const profit = projects.reduce((s, p) => {
    const f = finOf(p.id)
    const inc = f.filter((x) => x.type === 'income').reduce((a, x) => a + x.amount, 0)
    const exp = f.filter((x) => x.type === 'expense').reduce((a, x) => a + x.amount, 0)
    // اگه دفتر مالی خالیه از تخمین قبلی استفاده کن
    if (f.length === 0) return s + p.received - estimatedCost(p)
    return s + inc - exp
  }, 0)

  return (
    <div className="b-view max-w-6xl mx-auto">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
        <div>
          <h1 className="text-[21px] font-bold tracking-tight">{t('projects.title')}</h1>
          <p
            className="text-[13px] text-muted mt-0.5"
            dangerouslySetInnerHTML={{
              __html: t('projects.subtitle', {
                active: faDigits(active.length),
                done: faDigits(done.length),
                profit: tomanShort(profit),
              }),
            }}
          />
        </div>
        <div className="flex gap-2">
          <select className="field !w-auto" value={filter} onChange={(e) => setFilter(e.target.value as never)}>
            <option value="all">{t('common.all')}</option>
            <option value="active">{t('projectStatus.active')}</option>
            <option value="waiting">{t('projectStatus.waiting')}</option>
            <option value="paused">{t('projectStatus.paused')}</option>
            <option value="done">{t('projectStatus.done')}</option>
          </select>
          <NewProjectButton />
        </div>
      </div>

      {projects.length === 0 ? (
        <EmptyState icon="🏗️" title={t('projects.empty')} hint={t('projects.emptyHint')} />
      ) : (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {list.map((p) => {
            const f = finOf(p.id)
            const inc = f.filter((x) => x.type === 'income').reduce((a, x) => a + x.amount, 0)
            const exp = f.filter((x) => x.type === 'expense').reduce((a, x) => a + x.amount, 0)
            const hasFin = f.length > 0
            const showReceived = hasFin ? inc : p.received
            const cost = hasFin ? exp : estimatedCost(p)
            const net = showReceived - cost
            const photoCount = allPhotos.filter((x) => x.projectId === p.id).length
            return (
              <div
                key={p.id}
                onClick={() => nav(`/projects/${p.id}`)}
                className="card p-4 text-start hover:-translate-y-0.5 hover:shadow-float transition-all cursor-pointer group relative"
              >
                <button
                  onClick={(e) => removeProject(p.id, e)}
                  title="حذف پروژه"
                  className="absolute top-2 end-2 z-10 w-7 h-7 rounded-lg border border-line bg-surface text-faint hover:text-[color:var(--b-red)] hover:border-[color:var(--b-red)] grid place-items-center text-[13px] opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                >
                  🗑
                </button>
                <div className="flex items-start gap-2.5">
                  <div
                    className="w-9 h-9 rounded-xl grid place-items-center text-[17px] shrink-0"
                    style={{ background: 'var(--b-accent-soft)' }}
                  >
                    🏗️
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[14.5px] font-semibold leading-snug truncate">{p.name}</div>
                    <div className="text-[12px] text-muted truncate">{p.client || '—'}</div>
                  </div>
                  <Chip tone={statusTone(p.status) as never}>{t(`projectStatus.${p.status}`)}</Chip>
                </div>

                <div className="grid grid-cols-2 gap-2 mt-3.5">
                  <div className="bg-surface-2 border border-line rounded-lg px-2.5 py-1.5">
                    <div className="text-[10.5px] text-faint">{t('projects.contract')}</div>
                    <div className="text-[13px] font-semibold tabular-nums">{tomanShort(p.contractAmount)}</div>
                  </div>
                  <div className="bg-surface-2 border border-line rounded-lg px-2.5 py-1.5">
                    <div className="text-[10.5px] text-faint">{t('projects.received')}</div>
                    <div className="text-[13px] font-semibold tabular-nums" style={{ color: 'var(--b-green)' }}>
                      {tomanShort(showReceived)}
                    </div>
                  </div>
                  <div className="bg-surface-2 border border-line rounded-lg px-2.5 py-1.5">
                    <div className="text-[10.5px] text-faint">{t('projects.spent')}</div>
                    <div className="text-[13px] font-semibold tabular-nums" style={{ color: 'var(--b-red)' }}>
                      {tomanShort(cost)}
                    </div>
                  </div>
                  <div className="bg-surface-2 border border-line rounded-lg px-2.5 py-1.5">
                    <div className="text-[10.5px] text-faint">{t('projects.profit')}</div>
                    <div
                      className="text-[13px] font-semibold tabular-nums"
                      style={{ color: net >= 0 ? 'var(--b-green)' : 'var(--b-red)' }}
                    >
                      {tomanShort(net)}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 mt-3.5">
                  <span className="text-[11.5px] text-muted">{t('projects.progress')}</span>
                  <Bar value={p.progress} className="flex-1" />
                  <span className="text-[12px] font-semibold tabular-nums">{faDigits(p.progress)}٪</span>
                </div>

                {p.endDate && (
                  <div className="text-[11px] text-faint mt-2.5 flex items-center gap-1.5">
                    <span>📅</span>
                    <span>
                      {t('projects.startDate')}: {p.startDate} — {t('projects.endDate')}: {p.endDate}
                    </span>
                  </div>
                )}
                {photoCount > 0 && (
                  <div className="text-[11px] text-faint mt-1.5">
                    🖼️ {t('projects.photos', { n: faDigits(photoCount) })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

/** هزینه تخمینی پروژه = دریافتی − سود فرضی ۳۵٪  (تا فاز ۲ که دفتر مالی پروژه میاد) */
function estimatedCost(p: Project): number {
  // تا وقتی مالی پروژه نداریم، هزینه رو از نسبت پیشرفت تخمین می‌زنیم
  return Math.round((p.contractAmount * p.progress) / 100 * 0.72)
}

function NewProjectButton() {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [client, setClient] = useState('')
  const [amount, setAmount] = useState('')
  const [contractFiles, setContractFiles] = useState<File[]>([])
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim() || busy) return
    setBusy(true)
    try {
      const spaces = await db.spaces.toArray()
      const spaceId = spaces[0]?.id ?? 1
      const pid = await db.projects.add({
        spaceId,
        name: name.trim(),
        client: client.trim() || undefined,
        status: 'active',
        contractAmount: Number(amount) || 0,
        received: 0,
        progress: 0,
        createdAt: Date.now(),
      })
      for (const f of contractFiles) {
        if (!f.type.startsWith('image/')) continue
        try {
          const dataUrl = await compressImage(f)
          await db.projectPhotos.add({
            projectId: Number(pid),
            category: 'contract',
            dataUrl,
            caption: 'تصویر قرارداد',
            date: todayJalali(),
            createdAt: Date.now(),
          })
        } catch {
          /* یک عکس خراب، بقیه را خراب نمی‌کند */
        }
      }
      setName('')
      setClient('')
      setAmount('')
      setContractFiles([])
      setOpen(false)
    } finally {
      setBusy(false)
    }
  }

  if (!open)
    return (
      <button className="btn btn-primary" onClick={() => setOpen(true)}>
        + {t('projects.new')}
      </button>
    )

  return (
    <div className="card p-4 w-full sm:w-[400px] b-pop">
      <form onSubmit={submit} className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <b className="text-[14px]">{t('projects.new')}</b>
          <button type="button" className="btn btn-ghost !px-2 !py-1 text-[12px]" onClick={() => setOpen(false)}>
            ✕
          </button>
        </div>
        <Field label="نام پروژه">
          <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="بازسازی ساختمان…" required />
        </Field>
        <Field label={t('projects.client')}>
          <TextInput value={client} onChange={(e) => setClient(e.target.value)} placeholder="آقای رضایی" />
        </Field>
        <Field label={t('projects.contract')} hint="تومان">
          <NumberInput
            value={amount}
            onChange={(n) => setAmount(n === 0 ? '' : String(n))}
            placeholder="4850000000"
          />
        </Field>
        <Field label="📄 تصویر قرارداد (اختیاری)">
          <button
            type="button"
            className="btn w-full"
            onClick={() => fileRef.current?.click()}
          >
            {contractFiles.length > 0 ? `✓ ${faDigits(contractFiles.length)} عکس انتخاب شد` : '＋ افزودن عکس قرارداد'}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              setContractFiles(e.target.files ? Array.from(e.target.files) : [])
              e.target.value = ''
            }}
          />
        </Field>
        <div className="flex gap-2 justify-end">
          <button type="button" className="btn" onClick={() => setOpen(false)}>
            {t('common.cancel')}
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? '…' : t('common.save')}
          </button>
        </div>
      </form>
    </div>
  )
}

export { estimatedCost, groupDigits }
