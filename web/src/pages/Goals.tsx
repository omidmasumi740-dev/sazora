import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Goal, type GoalItem } from '../db/schema'
import { todayJalali, formatJalali, isValidJalali } from '../lib/jalali'
import { faDigits, groupDigits, tomanShort } from '../lib/format'
import { Chip, EmptyState, Bar, Field, TextInput, Panel, NumberInput, ExportMenu } from '../ui/components'

const EMOJIS = ['✈️', '🚗', '🏠', '💰', '🎓', '💍', '🏖️', '💻', '🎯', '⭐']

/** تشخیص هدف تعدادی — سازگار با رکوردهای قدیمی بدون kind */
export function isCountGoal(g: Goal): boolean {
  if (g.kind === 'count') return true
  if (g.kind === 'money') return false
  return g.targetAmount === 0 && (g.targetNumber ?? 0) > 0
}

/** درصد پیشرفت هدف تعدادی */
export function countPct(g: Goal): number {
  const t = g.targetNumber ?? 0
  if (t <= 0) return 0
  return Math.max(0, Math.min(100, Math.round(((g.currentNumber ?? 0) / t) * 100)))
}

export default function GoalsPage() {
  const { t } = useTranslation()
  const [formOpen, setFormOpen] = useState(false)

  const goals = useLiveQuery(() => db.goals.orderBy('order').toArray(), [], [] as Goal[])
  const items = useLiveQuery(() => db.goalItems.toArray(), [], [] as GoalItem[])

  const moneyGoals = goals.filter((g) => !isCountGoal(g))
  const countGoals = goals.filter((g) => isCountGoal(g))

  const stats = moneyGoals.map((g) => ({ g, ...predict(g) }))
  const totalSaved = moneyGoals.reduce((s, g) => s + g.savedAmount, 0)
  const totalTarget = moneyGoals.reduce((s, g) => s + g.targetAmount, 0)
  const onTrack = stats.filter((s) => s.verdict === 'track' || s.verdict === 'done').length
  const monthlyTotal = moneyGoals.reduce((s, g) => s + g.monthlyCommit, 0)
  const countAvg = countGoals.length
    ? Math.round(countGoals.reduce((s, g) => s + countPct(g), 0) / countGoals.length)
    : 0

  // دادهٔ خروجی اهداف برای Excel/JSON
  const goalsExportData = goals.map((g) => ({
    عنوان: g.title,
    نوع: isCountGoal(g) ? 'تعدادی' : 'پولی',
    'مبلغ هدف': g.targetAmount,
    'ذخیره‌شده': g.savedAmount,
    'تعهد ماهانه': g.monthlyCommit,
    موعد: g.deadline,
    'سقف تعدادی': g.targetNumber ?? '',
    'پیشرفت تعدادی': g.currentNumber ?? '',
    وضعیت: isCountGoal(g) ? `${countPct(g)}%` : `${Math.round((g.savedAmount / (g.targetAmount || 1)) * 100)}%`,
    یادداشت: g.note ?? '',
  }))

  return (
    <div className="b-view max-w-6xl mx-auto">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
        <div>
          <h1 className="text-[21px] font-bold tracking-tight">{t('goals.title')}</h1>
          <p className="text-[13px] text-muted mt-0.5">{t('goals.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          {goals.length > 0 && (
            <ExportMenu
              elementId="goals-export"
              filename={`goals-${todayJalali()}`}
              sheetName="Goals"
              data={goalsExportData}
            />
          )}
          {!formOpen && (
            <button className="btn btn-primary" onClick={() => setFormOpen(true)}>
              + {t('goals.new')}
            </button>
          )}
        </div>
      </div>

      {formOpen && <GoalForm onDone={() => setFormOpen(false)} />}

      <div id="goals-export">
      {goals.length === 0 && !formOpen ? (
        <EmptyState icon="🎯" title={t('goals.noGoals')} hint={t('goals.noGoalsHint')} />
      ) : (
        <div className="grid lg:grid-cols-2 gap-4">
          {stats.map(({ g, ...p }) => (
            <GoalCard key={g.id} goal={g} items={items.filter((i) => i.goalId === g.id)} pred={p} />
          ))}
          {countGoals.map((g) => (
            <GoalCard
              key={g.id}
              goal={g}
              items={items.filter((i) => i.goalId === g.id)}
              pred={{ pct: countPct(g), monthsLeft: 0, remaining: 0, needed: 0, verdict: 'idle', deltaMonths: 0 }}
            />
          ))}
        </div>
      )}
      </div>

      {goals.length > 0 && (
        <Panel className="mt-4">
          <b className="text-[14px] block mb-3">📊 {t('goals.forecast')}</b>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <MiniStat label={t('goals.totalSaved')} value={tomanShort(totalSaved)} sub={`${faDigits(Math.round((totalSaved / (totalTarget || 1)) * 100))}٪ ${t('goals.of')} ${tomanShort(totalTarget)}`} />
            <MiniStat label={t('goals.onTrackCount')} value={`${faDigits(onTrack)} / ${faDigits(moneyGoals.length)}`} />
            <MiniStat label={t('goals.monthlyCommitTotal')} value={tomanShort(monthlyTotal)} sub="تومان در ماه" />
            <MiniStat
              label="مانده تا همه اهداف"
              value={tomanShort(totalTarget - totalSaved)}
            />
            {countGoals.length > 0 && (
              <MiniStat
                label="اهداف تعدادی"
                value={`${faDigits(countGoals.length)} هدف`}
                sub={`میانگین پیشرفت ${faDigits(countAvg)}٪`}
              />
            )}
          </div>
        </Panel>
      )}
    </div>
  )
}

/* ---------- ریاضی پیش‌بینی ---------- */
export interface Prediction {
  pct: number
  monthsLeft: number
  remaining: number
  needed: number
  verdict: 'done' | 'track' | 'behind' | 'overdue' | 'idle'
  deltaMonths: number
}

export function predict(g: Goal): Prediction {
  const remaining = g.targetAmount - g.savedAmount
  const pct = g.targetAmount > 0 ? Math.max(0, Math.min(100, (g.savedAmount / g.targetAmount) * 100)) : 0
  const [ty, tm] = todayJalali().split('-').map(Number)
  const [dy, dm] = g.deadline.split('-').map(Number)
  const monthsLeft = (dy! - ty!) * 12 + (dm! - tm!)

  if (remaining <= 0) return { pct: 100, monthsLeft, remaining: 0, needed: 0, verdict: 'done', deltaMonths: 0 }
  if (monthsLeft < 0) return { pct, monthsLeft, remaining, needed: remaining, verdict: 'overdue', deltaMonths: 0 }
  const m = Math.max(monthsLeft, 1)
  const needed = Math.round(remaining / m)
  if (!g.monthlyCommit || g.monthlyCommit <= 0)
    return { pct, monthsLeft, remaining, needed, verdict: 'idle', deltaMonths: 0 }
  const monthsNeeded = remaining / g.monthlyCommit
  if (monthsNeeded <= m)
    return { pct, monthsLeft, remaining, needed, verdict: 'track', deltaMonths: m - monthsNeeded }
  return { pct, monthsLeft, remaining, needed, verdict: 'behind', deltaMonths: monthsNeeded - m }
}

/* ---------- کارت هدف (پولی / تعدادی) ---------- */
function GoalCard({ goal, items, pred }: { goal: Goal; items: GoalItem[]; pred: Prediction }) {
  const [editing, setEditing] = useState(false)

  if (editing) return <GoalForm initial={goal} onDone={() => setEditing(false)} />
  if (isCountGoal(goal)) return <CountBody goal={goal} items={items} onEdit={() => setEditing(true)} />
  return <MoneyBody goal={goal} items={items} pred={pred} onEdit={() => setEditing(true)} />
}

async function removeGoal(goal: Goal, confirmMsg: string) {
  if (!goal.id) return
  if (!window.confirm(confirmMsg)) return
  await db.goalItems.where('goalId').equals(goal.id).delete()
  await db.goals.delete(goal.id)
}

/* ---------- بدنه کارت پولی (رفتار قبلی) ---------- */
function MoneyBody({ goal, items, pred, onEdit }: { goal: Goal; items: GoalItem[]; pred: Prediction; onEdit: () => void }) {
  const { t } = useTranslation()

  const verdictUI = () => {
    switch (pred.verdict) {
      case 'done':
        return <span style={{ color: 'var(--b-green)', fontWeight: 700 }}>{t('goals.doneGoal')}</span>
      case 'overdue':
        return <span style={{ color: 'var(--b-red)', fontWeight: 700 }}>{t('goals.overdue')}</span>
      case 'idle':
        return <span className="text-muted">{t('goals.needPerMonth', { n: groupDigits(pred.needed) })}</span>
      case 'track':
        return (
          <b style={{ color: 'var(--b-green)' }}>
            {pred.deltaMonths >= 1 ? t('goals.aheadBy', { n: faDigits(Math.floor(pred.deltaMonths)) }) : t('goals.onTrack')}
          </b>
        )
      case 'behind':
        return (
          <b style={{ color: 'var(--b-orange)' }}>
            {t('goals.behind', { n: faDigits(Math.ceil(pred.deltaMonths)) })} ·{' '}
            {t('goals.shortBy', { n: groupDigits(pred.needed - goal.monthlyCommit) })}
          </b>
        )
      default:
        return null
    }
  }

  return (
    <div className="card overflow-hidden">
      <div className="p-4 pb-3">
        <GoalHead goal={goal} pct={pred.pct} monthsLeft={pred.monthsLeft} />
        <div className="flex justify-between items-baseline mt-3 mb-1.5">
          <b className="text-[19px] tabular-nums" dir="ltr" style={{ color: 'var(--b-accent)' }}>
            {groupDigits(goal.savedAmount)}
          </b>
          <span className="text-[12px] text-muted" dir="ltr">
            {t('goals.of')} {groupDigits(goal.targetAmount)} تومان
          </span>
        </div>
        <Bar value={pred.pct} />
        <div className="text-[12px] text-muted mt-2">ماهی <b className="tabular-nums" dir="ltr">{groupDigits(goal.monthlyCommit)}</b> کنار می‌ذاری → {verdictUI()}</div>
      </div>

      <GoalItems goal={goal} items={items} />
      <GoalFooter goal={goal} items={items} onEdit={onEdit} />
    </div>
  )
}

/* ---------- بدنه کارت تعدادی ---------- */
function CountBody({ goal, items, onEdit }: { goal: Goal; items: GoalItem[]; onEdit: () => void }) {
  const { t } = useTranslation()
  const [numDraft, setNumDraft] = useState('')

  const target = goal.targetNumber ?? 0
  const current = goal.currentNumber ?? 0
  const unit = goal.unit || 'واحد'
  const pct = countPct(goal)
  const done = target > 0 && current >= target

  async function setProgress(n: number) {
    if (!goal.id) return
    await db.goals.update(goal.id, { currentNumber: Math.max(0, Math.round(n)) })
  }

  function submitNum(e: FormEvent) {
    e.preventDefault()
    const n = Math.round(Number(numDraft))
    if (!Number.isFinite(n)) return
    void setProgress(n)
    setNumDraft('')
  }

  return (
    <div className="card overflow-hidden">
      <div className="p-4 pb-3">
        <GoalHead goal={goal} pct={pct} monthsLeft={0} hideMonths />
        <div className="flex justify-between items-baseline mt-3 mb-1.5">
          <b className="text-[16px] tabular-nums">
            {faDigits(current)} از {faDigits(target)} {unit}
          </b>
          <span className="text-[12px] text-muted">{faDigits(Math.round(pct))}٪</span>
        </div>
        <Bar value={pct} />
        <div className="text-[12px] text-muted mt-2">
          {done ? (
            <b style={{ color: 'var(--b-green)' }}>🎉 به هدف رسیدی!</b>
          ) : (
            <span>
              مانده تا هدف: <b>{faDigits(Math.max(0, target - current))} {unit}</b>
            </span>
          )}
        </div>

        {/* ثبت پیشرفت */}
        <div className="flex items-center gap-2 mt-3">
          <button className="btn !py-1.5 text-[12.5px] flex-1" onClick={() => setProgress(current + 1)}>
            +۱
          </button>
          <button
            className="btn !py-1.5 text-[12.5px] flex-1"
            onClick={() => setProgress(current - 1)}
            disabled={current <= 0}
          >
            −۱
          </button>
          <form onSubmit={submitNum} className="flex gap-1.5 flex-[2]">
            <input
              className="field !py-1.5 !text-[12.5px] flex-1 min-w-0"
              type="number"
              dir="ltr"
              placeholder="عدد"
              value={numDraft}
              onChange={(e) => setNumDraft(e.target.value)}
            />
            <button type="submit" className="btn !py-1.5 text-[12.5px] shrink-0">
              ثبت
            </button>
          </form>
        </div>
      </div>

      <GoalItems goal={goal} items={items} />
      <GoalFooter goal={goal} items={items} onEdit={onEdit} />
    </div>
  )
}

/* ---------- سربرگ مشترک کارت ---------- */
function GoalHead({ goal, pct, monthsLeft, hideMonths }: { goal: Goal; pct: number; monthsLeft: number; hideMonths?: boolean }) {
  const { t } = useTranslation()
  return (
    <div className="flex items-start gap-3">
      <div className="w-10 h-10 rounded-xl grid place-items-center text-[19px] shrink-0 bg-surface-2 border border-line">
        {goal.icon || '🎯'}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[14.5px] font-semibold">{goal.title}</div>
        <div className="text-[11.5px] text-muted mt-0.5">
          🎯 {formatJalali(goal.deadline)}
          {!hideMonths && (
            <>
              {' · '}
              {monthsLeft < 0 ? (
                <b style={{ color: 'var(--b-red)' }}>{t('goals.overdue')}</b>
              ) : (
                t('goals.monthsLeft', { n: faDigits(monthsLeft) })
              )}
            </>
          )}
        </div>
      </div>
      <Chip tone={pct >= 100 ? 'success' : 'accent'}>{faDigits(Math.round(pct))}٪</Chip>
    </div>
  )
}

/* ---------- چک‌لیست کارهای هدف (مشترک) ---------- */
function GoalItems({ goal, items }: { goal: Goal; items: GoalItem[] }) {
  const { t } = useTranslation()
  const [itemDraft, setItemDraft] = useState('')
  const [itemDue, setItemDue] = useState('')

  const sorted = [...items].sort((a, b) => a.order - b.order)

  async function toggleItem(item: GoalItem) {
    if (item.id) await db.goalItems.update(item.id, { done: !item.done })
  }

  async function addItem(e: FormEvent) {
    e.preventDefault()
    if (!itemDraft.trim() || !goal.id) return
    if (itemDue && !isValidJalali(itemDue)) {
      window.alert('تاریخ باید مثل 1405-06-01 و معتبر باشد.')
      return
    }
    const maxOrder = items.reduce((m, i) => Math.max(m, i.order), 0)
    await db.goalItems.add({
      goalId: goal.id,
      title: itemDraft.trim(),
      done: false,
      dueDate: itemDue || undefined,
      order: maxOrder + 1,
      createdAt: Date.now(),
    })
    setItemDraft('')
    setItemDue('')
  }

  async function removeItem(id?: number) {
    if (!id) return
    await db.goalItems.delete(id)
  }

  return (
    <div className="px-4 pb-3 space-y-1.5">
      {sorted.map((it) => (
        <div key={it.id} className="flex items-center gap-2.5 text-[12.8px]">
          <button
            onClick={() => toggleItem(it)}
            className={`w-4 h-4 rounded-[5px] border-[1.5px] grid place-items-center text-[9px] shrink-0 ${
              it.done ? 'text-white border-transparent' : 'bg-surface border-line'
            }`}
            style={it.done ? { background: 'var(--b-accent)' } : undefined}
          >
            {it.done ? '✓' : ''}
          </button>
          <span className={`flex-1 ${it.done ? 'line-through text-faint' : 'text-muted'}`}>{it.title}</span>
          {it.dueDate && <span className="text-[10.5px] text-faint tabular-nums" dir="ltr">{it.dueDate}</span>}
          <button className="text-faint hover:text-[color:var(--b-red)] text-[12px]" onClick={() => removeItem(it.id)}>
            🗑
          </button>
        </div>
      ))}
      <form onSubmit={addItem} className="flex gap-1.5 pt-1">
        <input
          className="field !py-1.5 !text-[12.5px] flex-1"
          placeholder={t('goals.itemHint')}
          value={itemDraft}
          onChange={(e) => setItemDraft(e.target.value)}
        />
        <input
          className="field !py-1.5 !text-[12px] !w-24"
          dir="ltr"
          placeholder="1404-…"
          value={itemDue}
          onChange={(e) => setItemDue(e.target.value)}
        />
        <button type="submit" className="btn !py-1.5 text-[12.5px] shrink-0">
          {t('goals.addItem')}
        </button>
      </form>
    </div>
  )
}

/* ---------- فوتر مشترک کارت ---------- */
function GoalFooter({ goal, items, onEdit }: { goal: Goal; items: GoalItem[]; onEdit: () => void }) {
  const { t } = useTranslation()
  const doneItems = items.filter((i) => i.done)
  return (
    <div className="flex items-center justify-between px-4 py-2 bg-surface-2 border-t border-line text-[11.5px] text-muted">
      <span>📋 {t('goals.tasksDone', { d: faDigits(doneItems.length), t: faDigits(items.length) })}</span>
      <span className="flex gap-1">
        <button className="btn btn-ghost !py-0.5 !px-2 text-[11.5px]" onClick={onEdit}>
          ✏️
        </button>
        <button className="btn btn-ghost !py-0.5 !px-2 text-[11.5px]" onClick={() => removeGoal(goal, t('projects.deleteConfirm'))}>
          🗑
        </button>
      </span>
    </div>
  )
}

/* ---------- فرم هدف (پولی / تعدادی) ---------- */
function GoalForm({ initial, onDone }: { initial?: Goal; onDone: () => void }) {
  const { t } = useTranslation()
  const initialKind: 'money' | 'count' =
    initial?.kind ?? (initial && initial.targetAmount === 0 && (initial.targetNumber ?? 0) > 0 ? 'count' : 'money')
  const [kind, setKind] = useState<'money' | 'count'>(initialKind)
  const [title, setTitle] = useState(initial?.title ?? '')
  const [icon, setIcon] = useState(initial?.icon ?? '🎯')
  // پولی
  const [target, setTarget] = useState(initial ? String(initial.targetAmount) : '')
  const [saved, setSaved] = useState(initial ? String(initial.savedAmount) : '0')
  const [monthly, setMonthly] = useState(initial ? String(initial.monthlyCommit) : '')
  // تعدادی
  const [unit, setUnit] = useState(initial?.unit ?? '')
  const [targetNumber, setTargetNumber] = useState(
    initial?.targetNumber ? String(initial.targetNumber) : '',
  )
  const [currentNumber, setCurrentNumber] = useState(
    initial?.currentNumber ? String(initial.currentNumber) : '0',
  )
  // مشترک
  const [deadline, setDeadline] = useState(initial?.deadline ?? '')
  const [note, setNote] = useState(initial?.note ?? '')

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    if (deadline && !isValidJalali(deadline)) {
      window.alert('موعد باید به شکل 1405-06-01 و معتبر باشد.')
      return
    }
    if (kind === 'count') {
      if (!Number(targetNumber)) return
      const payload = {
        title: title.trim(),
        icon,
        kind: 'count' as const,
        unit: unit.trim() || undefined,
        targetNumber: Math.round(Number(targetNumber)),
        currentNumber: Math.max(0, Math.round(Number(currentNumber)) || 0),
        targetAmount: 0,
        savedAmount: 0,
        monthlyCommit: 0,
        deadline: deadline || todayJalali(),
        note: note.trim() || undefined,
      }
      if (initial?.id) {
        await db.goals.put({ ...initial, ...payload, id: initial.id })
      } else {
        const maxOrder = (await db.goals.toArray()).reduce((m, g) => Math.max(m, g.order), 0)
        await db.goals.add({ ...payload, order: maxOrder + 1, createdAt: Date.now() })
      }
    } else {
      if (!Number(target)) return
      const payload = {
        title: title.trim(),
        icon,
        kind: 'money' as const,
        unit: undefined,
        targetNumber: 0,
        currentNumber: 0,
        targetAmount: Math.round(Number(target)),
        savedAmount: Math.round(Number(saved)) || 0,
        monthlyCommit: Math.round(Number(monthly)) || 0,
        deadline: deadline || todayJalali(),
        note: note.trim() || undefined,
      }
      if (initial?.id) {
        await db.goals.put({ ...initial, ...payload, id: initial.id })
      } else {
        const maxOrder = (await db.goals.toArray()).reduce((m, g) => Math.max(m, g.order), 0)
        await db.goals.add({ ...payload, order: maxOrder + 1, createdAt: Date.now() })
      }
    }
    onDone()
  }

  return (
    <form onSubmit={submit} className="card p-4 mb-4 b-pop">
      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="نوع هدف">
          <div className="flex gap-1.5">
            <button
              type="button"
              className={`btn !py-1.5 text-[12.5px] flex-1 ${kind === 'money' ? 'btn-primary' : ''}`}
              onClick={() => setKind('money')}
            >
              💰 پولی
            </button>
            <button
              type="button"
              className={`btn !py-1.5 text-[12.5px] flex-1 ${kind === 'count' ? 'btn-primary' : ''}`}
              onClick={() => setKind('count')}
            >
              🔢 تعدادی
            </button>
          </div>
        </Field>
        <Field label={t('goals.goalTitle')} hint={t('goals.goalTitleHint')}>
          <TextInput value={title} onChange={(e) => setTitle(e.target.value)} required autoFocus />
        </Field>
        <Field label={t('goals.icon')}>
          <div className="flex flex-wrap gap-1.5">
            {EMOJIS.map((e) => (
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
        {kind === 'count' ? (
          <>
            <Field label="واحد شمارش" hint="مثلا کتاب، جلسه، کیلومتر">
              <TextInput value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="کتاب" />
            </Field>
            <Field label="سقف تعداد">
              <NumberInput value={targetNumber} onChange={(n) => setTargetNumber(n === 0 ? '' : String(n))} required />
            </Field>
            <Field label="پیشرفت فعلی">
              <NumberInput value={currentNumber} onChange={(n) => setCurrentNumber(n === 0 ? '' : String(n))} />
            </Field>
          </>
        ) : (
          <>
            <Field label={t('goals.target')}>
              <NumberInput value={target} onChange={(n) => setTarget(n === 0 ? '' : String(n))} required />
            </Field>
            <Field label={t('goals.saved')}>
              <NumberInput value={saved} onChange={(n) => setSaved(n === 0 ? '' : String(n))} />
            </Field>
            <Field label={t('goals.monthly')}>
              <NumberInput value={monthly} onChange={(n) => setMonthly(n === 0 ? '' : String(n))} />
            </Field>
          </>
        )}
        <Field label={t('goals.deadline')} hint="شمسی: 1405-06-01">
          <TextInput value={deadline} onChange={(e) => setDeadline(e.target.value)} dir="ltr" placeholder="1405-06-01" />
        </Field>
        {kind === 'count' && (
          <Field label="یادداشت">
            <TextInput value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
        )}
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

function MiniStat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-surface-2 border border-line rounded-xl p-3">
      <div className="text-[11.5px] text-muted">{label}</div>
      <div className="text-[16px] font-bold tabular-nums mt-1">{value}</div>
      {sub && <div className="text-[10.5px] text-faint mt-0.5">{sub}</div>}
    </div>
  )
}
