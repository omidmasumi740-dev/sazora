import { useMemo, useRef, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { db, type RateItem, type Measurement, type RateUnit } from '../../db/schema'
import { todayJalali } from '../../lib/jalali'
import { faDigits, groupDigits } from '../../lib/format'
import { UNITS, money, moneyShort, qty, unitLabel, downloadElementPNG } from '../../lib/rates'
import {
  allRateTitles,
  ratePresetUnit,
  rateTitleLabel,
} from '../../lib/ratePresets'
import { Chip, EmptyState, Field, TextInput, NumberInput } from '../../ui/components'

export default function RatesTab({
  projectId,
  rates,
  measurements,
  incomeToman,
  zones,
}: {
  projectId: number
  rates: RateItem[]
  measurements: Measurement[]
  incomeToman: number
  zones: string[]
}) {
  const { t, i18n } = useTranslation()
  const lang = (i18n.language === 'en' ? 'en' : 'fa') as 'fa' | 'en'
  const [rateOpen, setRateOpen] = useState(false)
  const [pngBusy, setPngBusy] = useState(false)
  /* لیست کارهای آماده ثابت است و با هر ثبت تغییر نمی‌کند */
  const titles = useMemo(() => allRateTitles(), [])
  const stmtRef = useRef<HTMLDivElement>(null)

  const sorted = [...rates].sort((a, b) => a.order - b.order)
  const qtyOf = (rateId?: number) =>
    measurements.filter((m) => m.rateId === rateId).reduce((s, m) => s + m.qty, 0)

  const tomanTotal = sorted
    .filter((r) => r.currency === 'toman')
    .reduce((s, r) => s + qtyOf(r.id) * r.price, 0)
  // سازگاری با داده‌های قدیمی دلاری — گزینه دلار برای ثبت جدید حذف شده است
  const dollarTotal = sorted
    .filter((r) => r.currency === 'dollar')
    .reduce((s, r) => s + qtyOf(r.id) * r.price, 0)

  async function downloadPNG() {
    if (!stmtRef.current) return
    setPngBusy(true)
    try {
      await downloadElementPNG(stmtRef.current, `soraat-vaziat-${projectId}.png`)
    } finally {
      setPngBusy(false)
    }
  }

  return (
    <div className="b-view space-y-2.5">
      <div className="flex flex-wrap gap-2">
        {!rateOpen ? (
          <button className="btn btn-primary !py-1.5 !px-3 text-[12.5px]" onClick={() => setRateOpen(true)}>
            + {t('projects.addRate')}
          </button>
        ) : (
          <RateForm
            projectId={projectId}
            nextOrder={sorted.reduce((m, r) => Math.max(m, r.order), 0) + 1}
            titles={titles}
            onDone={() => setRateOpen(false)}
          />
        )}
        {sorted.length > 0 && (
          <button className="btn !py-1.5 !px-3 text-[12.5px]" onClick={downloadPNG} disabled={pngBusy}>
            🖼️ {pngBusy ? '…' : t('projects.exportPng')}
          </button>
        )}
      </div>

      {sorted.length === 0 ? (
        <EmptyState icon="📐" title={t('projects.noRates')} hint={t('projects.noRatesHint')} />
      ) : (
        <div className="grid lg:grid-cols-2 gap-2.5">
          {sorted.map((r, i) => (
            <RateCard
              key={r.id}
              rate={r}
              index={i}
              measurements={measurements.filter((m) => m.rateId === r.id)}
              lang={lang}
              zones={zones}
              titles={titles}
            />
          ))}
        </div>
      )}

      {sorted.length > 0 && (
        <div ref={stmtRef} className="card overflow-hidden bg-white">
          <div className="px-4 py-3 border-b border-line bg-surface-2">
            <b className="text-[14px]">📋 {t('projects.statement')}</b>
          </div>
          <table className="w-full text-[12.5px]">
            <thead>
              <tr className="bg-surface-2 border-b border-line text-[11px] text-faint">
                <th className="text-center font-semibold px-2 py-2.5 w-10">{t('projects.colNo')}</th>
                <th className="text-start font-semibold px-2 py-2.5">{t('projects.colWork')}</th>
                <th className="text-center font-semibold px-2 py-2.5">{t('projects.colUnit')}</th>
                <th className="text-center font-semibold px-2 py-2.5">{t('projects.colRate')}</th>
                <th className="text-center font-semibold px-2 py-2.5">{t('projects.colQty')}</th>
                <th className="text-end font-semibold px-3 py-2.5">{t('projects.colAmount')}</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((r, i) => {
                const q = qtyOf(r.id)
                const zonesOf = [...new Set(measurements.filter((m) => m.rateId === r.id).map((m) => (m.zone || '').trim()).filter(Boolean))]
                return (
                  <tr key={r.id} className="border-b border-line last:border-0">
                    <td className="px-2 py-2.5 text-center text-muted">{faDigits(i + 1)}</td>
                    <td className="px-2 py-2.5 font-medium">
                      {rateTitleLabel(r.title, lang)}
                      {zonesOf.length > 0 && (
                        <div className="text-[10.5px] text-faint font-normal">📍 {zonesOf.join(lang === 'fa' ? '، ' : ', ')}</div>
                      )}
                    </td>
                    <td className="px-2 py-2.5 text-center text-muted">{unitLabel(r.unit, lang)}</td>
                    <td className="px-2 py-2.5 text-center tabular-nums" dir="ltr">
                      {moneyShort(r.price, r.currency)}
                    </td>
                    <td className="px-2 py-2.5 text-center tabular-nums font-semibold">
                      {qty(q)} {unitLabel(r.unit, lang)}
                    </td>
                    <td className="px-3 py-2.5 text-end tabular-nums font-semibold" dir="ltr">
                      {moneyShort(q * r.price, r.currency)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="bg-surface-2 border-t-2 border-line font-bold">
                <td className="px-3 py-2.5" colSpan={5}>
                  {t('projects.grandToman')}
                </td>
                <td className="px-3 py-2.5 text-end tabular-nums" dir="ltr">
                  {groupDigits(tomanTotal)}
                </td>
              </tr>
              {dollarTotal > 0 && (
                <tr className="bg-surface-2 border-t border-line font-bold">
                  <td className="px-3 py-2.5" colSpan={5}>
                    {t('projects.grandDollar')}
                  </td>
                  <td className="px-3 py-2.5 text-end tabular-nums" dir="ltr">
                    ${groupDigits(dollarTotal)}
                  </td>
                </tr>
              )}
              <tr className="border-t border-line">
                <td className="px-3 py-2.5" colSpan={5}>
                  {t('projects.totalIncome')}
                </td>
                <td className="px-3 py-2.5 text-end tabular-nums" dir="ltr" style={{ color: 'var(--b-green)' }}>
                  {groupDigits(incomeToman)}
                </td>
              </tr>
              <tr className="border-t border-line font-bold">
                <td className="px-3 py-2.5" colSpan={5}>
                  {t('projects.remaining')}
                </td>
                <td
                  className="px-3 py-2.5 text-end tabular-nums"
                  dir="ltr"
                  style={{ color: tomanTotal - incomeToman > 0 ? 'var(--b-orange)' : 'var(--b-green)' }}
                >
                  {groupDigits(tomanTotal - incomeToman)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}

/* ================= فرم قلم نرخ ================= */
/** جدا کردن «کار انتخابی» از «شرح کار» در عنوان ذخیره‌شده — مثلاً «سرامیک دیوار راه پله» */
function splitRateTitle(title: string, titles: string[]): { base: string; desc: string } {
  const full = title.trim()
  if (!full) return { base: '', desc: '' }
  const match = [...titles]
    .sort((a, b) => b.length - a.length)
    .find((x) => full === x || full.startsWith(x + ' '))
  if (match) return { base: match, desc: full.slice(match.length).trim() }
  return { base: '__new__', desc: full }
}

function RateForm({
  projectId,
  nextOrder,
  onDone,
  initial,
  titles,
}: {
  projectId: number
  nextOrder: number
  onDone: () => void
  initial?: RateItem
  titles: string[]
  onNewTitle?: (title: string) => void
}) {
  const { t, i18n } = useTranslation()
  const lang = (i18n.language === 'en' ? 'en' : 'fa') as 'fa' | 'en'
  const initialSplit = splitRateTitle(initial?.title ?? '', titles)
  const [base, setBase] = useState(initialSplit.base)
  const [desc, setDesc] = useState(initialSplit.desc)
  const [unit, setUnit] = useState<RateUnit>(initial?.unit ?? 'm2')
  const [price, setPrice] = useState(initial ? String(initial.price) : '')

  function pickPreset(value: string) {
    setBase(value)
    if (value && value !== '__new__') {
      const u = ratePresetUnit(value)
      if (u) setUnit(u)
    }
  }

  /** عنوان نهایی = «کار انتخابی» + «شرح کار» — مثلاً «سرامیک دیوار راه پله» */
  function buildTitle(): string {
    return [base && base !== '__new__' ? base : '', desc.trim()].filter(Boolean).join(' ')
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    const cleanTitle = buildTitle()
    if (!cleanTitle || !Number(price)) return
    /* لیست کارهای آماده تغییر نمی‌کند؛ کار جدید فقط به لیست همین پروژه اضافه می‌شود */
    if (initial?.id) {
      await db.rateItems.update(initial.id, {
        title: cleanTitle,
        unit,
        price: Math.round(Number(price)),
        currency: 'toman',
      })
    } else {
      await db.rateItems.add({
        projectId,
        title: cleanTitle,
        unit,
        price: Math.round(Number(price)),
        currency: 'toman',
        order: nextOrder,
        createdAt: Date.now(),
      })
    }
    onDone()
  }

  return (
    <form onSubmit={submit} className="card p-4 b-pop w-full">
      <div className="grid sm:grid-cols-2 gap-3">
        <Field label={t('projects.ratePreset')} hint={t('projects.ratePresetHint')}>
          <select className="field" value={base} onChange={(e) => pickPreset(e.target.value)}>
            <option value="">— {t('projects.ratePresetPlaceholder')} —</option>
            {titles.map((tt) => (
              <option key={tt} value={tt}>
                {rateTitleLabel(tt, lang)}
              </option>
            ))}
            <option value="__new__">➕ شرح دلخواه (بدون کار پایه)…</option>
          </select>
        </Field>
        <Field label={t('projects.rateTitle')} hint={t('projects.rateTitleHint')}>
          <TextInput
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            placeholder={lang === 'fa' ? 'راه پله، اتاق ۱، پارکینگ…' : 'Staircase, room 1, parking…'}
          />
        </Field>
        <Field label={t('projects.rateUnit')}>
          <select className="field" value={unit} onChange={(e) => setUnit(e.target.value as RateUnit)}>
            {UNITS.map((u) => (
              <option key={u.id} value={u.id}>
                {lang === 'fa' ? u.fa : u.en}
              </option>
            ))}
          </select>
        </Field>
        <Field label={`${t('projects.ratePrice')} (${t('common.unitToman')})`}>
          <NumberInput
            value={price}
            onChange={(n) => setPrice(n === 0 ? '' : String(n))}
            placeholder="650000"
            required
          />
        </Field>
      </div>
      <div className="text-[11.5px] text-faint mt-2">
        💰 {t('projects.rateCurrencyToman')}
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

/* ================= کارت قلم نرخ + متراژها ================= */
function RateCard({
  rate,
  index,
  measurements,
  lang,
  zones,
  titles,
}: {
  rate: RateItem
  index: number
  measurements: Measurement[]
  lang: 'fa' | 'en'
  zones: string[]
  titles: string[]
}) {
  const { t } = useTranslation()
  const [editing, setEditing] = useState(false)
  const [mOpen, setMOpen] = useState(false)
  const [qtyVal, setQtyVal] = useState('')
  const [date, setDate] = useState(todayJalali())
  const [zoneVal, setZoneVal] = useState('')
  const [note, setNote] = useState('')

  const totalQty = measurements.reduce((s, m) => s + m.qty, 0)
  const total = totalQty * rate.price
  const sortedM = [...measurements].sort((a, b) => (a.date < b.date ? 1 : -1))

  async function addMeasure(e: FormEvent) {
    e.preventDefault()
    const q = Number(qtyVal)
    if (!q || q <= 0 || !rate.id) return
    await db.measurements.add({
      rateId: rate.id,
      projectId: rate.projectId,
      qty: Math.round(q * 100) / 100,
      date: date || todayJalali(),
      zone: zoneVal.trim() || undefined,
      note: note.trim() || undefined,
      createdAt: Date.now(),
    })
    setQtyVal('')
    setZoneVal('')
    setNote('')
    setMOpen(false)
  }

  async function removeMeasure(id?: number) {
    if (!id) return
    if (!window.confirm(t('projects.deleteConfirm'))) return
    await db.measurements.delete(id)
  }

  async function removeRate() {
    if (!rate.id) return
    if (!window.confirm(t('projects.deleteConfirm'))) return
    await db.measurements.where('rateId').equals(rate.id).delete()
    await db.rateItems.delete(rate.id)
  }

  if (editing) {
    return (
      <RateForm
        projectId={rate.projectId}
        nextOrder={rate.order}
        initial={rate}
        titles={titles}
        onDone={() => setEditing(false)}
      />
    )
  }

  return (
    <div className="card p-3">
      <div className="flex items-start gap-2">
        <span className="w-5 h-5 rounded-md grid place-items-center text-[10px] font-bold shrink-0 bg-surface-2 border border-line text-muted">
          {faDigits(index + 1)}
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-semibold leading-snug">{rateTitleLabel(rate.title, lang)}</div>
          <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
            <Chip>{unitLabel(rate.unit, lang)}</Chip>
            <Chip tone="accent" className="tabular-nums" >
              <span dir="ltr">{money(rate.price, rate.currency)}</span>
            </Chip>
          </div>
        </div>
        <div className="flex gap-1 shrink-0">
          <button className="btn btn-ghost !px-2 !py-1 text-[12px]" onClick={() => setEditing(true)} title={t('task.edit')}>
            ✏️
          </button>
          <button className="btn btn-ghost !px-2 !py-1 text-[12px]" onClick={removeRate} title={t('common.delete')}>
            🗑
          </button>
        </div>
      </div>

      {/* متراژهای ثبت‌شده */}
      {sortedM.length > 0 && (
        <div className="mt-2 border-t border-line pt-1.5 space-y-1">
          {sortedM.map((m) => (
            <div key={m.id} className="flex items-center gap-1.5 text-[11.5px]">
              <span className="text-faint tabular-nums" dir="ltr">
                {m.date}
              </span>
              <b className="tabular-nums">
                {qty(m.qty)} {unitLabel(rate.unit, lang)}
              </b>
              {m.zone && <span className="chip !py-0 !text-[10px]">📍 {m.zone}</span>}
              {m.note && <span className="text-muted truncate flex-1">· {m.note}</span>}
              <span className="tabular-nums text-muted ms-auto" dir="ltr">
                {moneyShort(m.qty * rate.price, rate.currency)}
              </span>
              <button className="text-faint hover:text-[color:var(--b-red)]" onClick={() => removeMeasure(m.id)}>
                🗑
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between mt-2 pt-2 border-t border-dashed border-line">
        <span className="text-[12px] text-muted">
          {t('projects.itemTotal')}: <b className="tabular-nums" dir="ltr">{money(total, rate.currency)}</b>
          <span className="text-faint"> ({qty(totalQty)})</span>
        </span>
        {!mOpen ? (
          <button className="btn !py-1 !px-3 text-[12px]" onClick={() => setMOpen(true)}>
            + {t('projects.addMeasure')}
          </button>
        ) : (
          <form onSubmit={addMeasure} className="flex flex-wrap items-end gap-1.5">
            <NumberInput
              autoFocus
              decimal
              className="field !w-24 !py-1 !text-[12px]"
              step="0.01"
              min="0"
              placeholder={t('projects.measureQty')}
              value={qtyVal}
              onChange={(n) => setQtyVal(n === 0 ? '' : String(n))}
              dir="ltr"
              required
            />
            <input
              className="field !w-24 !py-1 !text-[12px]"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              dir="ltr"
            />
            <input
              className="field !w-28 !py-1 !text-[12px]"
              list={`zone-dl-${rate.id}`}
              placeholder={t('projects.zoneLabel')}
              value={zoneVal}
              onChange={(e) => setZoneVal(e.target.value)}
            />
            <datalist id={`zone-dl-${rate.id}`}>
              {zones.map((z) => (
                <option key={z} value={z} />
              ))}
            </datalist>
            <input
              className="field !w-28 !py-1 !text-[12px]"
              placeholder={t('projects.measureNote')}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            <button type="submit" className="btn btn-primary !py-1 !px-3 text-[12px]">
              {t('common.save')}
            </button>
            <button type="button" className="btn !py-1 !px-2 text-[12px]" onClick={() => setMOpen(false)}>
              ✕
            </button>
          </form>
        )}
      </div>
      {measurements.length === 0 && !mOpen && (
        <div className="text-[11px] text-faint mt-1.5">{t('projects.noMeasures')}</div>
      )}
    </div>
  )
}
