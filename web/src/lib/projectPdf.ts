import { jsPDF } from 'jspdf'
import html2canvas from 'html2canvas'
import * as XLSX from 'xlsx'
import type {
  Project,
  FinanceEntry,
  Stage,
  Worker,
  Attendance,
  Payment,
  ProjectPhoto,
  RateItem,
  Measurement,
} from '../db/schema'
import { groupDigits, tomanShort, faDigits, groupDecimal, downloadJSON } from './format'
import { requireLogin } from './auth'

/* ============================================================
   خروجی گزارش پروژه — PDF / JPG / Word / Excel / JSON / Visio
   PDF: صفحه‌بندی هوشمند + یک صفحهٔ کامل برای عکس‌های هر قسمت
   ============================================================ */

export interface ProjectReportData {
  project: Project
  finance: FinanceEntry[]
  stages: Stage[]
  workers: Worker[]
  attendances: Attendance[]
  payments: Payment[]
  photos?: ProjectPhoto[]
  rates?: RateItem[]
  measurements?: Measurement[]
  appName: string
}

export interface ExportOptions {
  finance: boolean
  stages: boolean
  rates: boolean
  ratesQuantitiesOnly: boolean
  workers: boolean
  photos: boolean
  contract: boolean
}

export const ALL_SECTIONS: ExportOptions = {
  finance: true,
  stages: true,
  rates: true,
  ratesQuantitiesOnly: false,
  workers: true,
  photos: true,
  contract: true,
}

export type ProjectExportFormat = 'pdf' | 'jpg' | 'word' | 'excel' | 'json' | 'visio'

const A4 = { w: 210, h: 297, margin: 8 }

const UNIT_LABEL = (u: string) =>
  u === 'm2' ? 'م²' : u === 'm' ? 'متر' : u === 'item' ? 'عدد' : u === 'day' ? 'روز' : u === 'hour' ? 'ساعت' : u === 'kg' ? 'کیلو' : u === 'lump' ? 'مقطوع' : u

/* ---------- ساخت HTML گزارش اصلی ---------- */

function buildReportElement(data: ProjectReportData, opt: ExportOptions): HTMLElement {
  const { project, finance, stages, workers, attendances, payments, photos = [], rates = [], measurements = [], appName } = data

  const income = finance.filter((f) => f.type === 'income').reduce((s, f) => s + f.amount, 0)
  const expense = finance.filter((f) => f.type === 'expense').reduce((s, f) => s + f.amount, 0)
  const net = income - expense
  const totalHours = attendances.reduce((s, a) => s + a.hours, 0)
  const wages = workers.reduce((sum, w) => {
    const h = attendances.filter((a) => a.workerId === w.id).reduce((s, a) => s + a.hours, 0)
    return sum + Math.round((h / 8) * w.dailyWage)
  }, 0)
  const doneStages = stages.filter((s) => s.status === 'done').length

  const el = document.createElement('div')
  el.dir = 'rtl'
  el.style.cssText = [
    'position:fixed;top:0;left:-10000px;width:820px;background:#fff;color:#18181b',
    'font-family:Vazirmatn,Tahoma,Arial,sans-serif;font-size:13px;line-height:1.9;padding:36px',
  ].join(';')

  const rows = finance
    .slice()
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .map(
      (f) =>
        `<tr><td style="border:1px solid #ddd;padding:6px 8px">${f.date}</td>` +
        `<td style="border:1px solid #ddd;padding:6px 8px">${escapeHtml(f.description || f.category)}</td>` +
        `<td style="border:1px solid #ddd;padding:6px 8px">${escapeHtml(f.category)}</td>` +
        `<td style="border:1px solid #ddd;padding:6px 8px">${f.type === 'income' ? 'دریافتی' : 'پرداختی'}</td>` +
        `<td style="border:1px solid #ddd;padding:6px 8px;text-align:left;direction:ltr">${groupDigits(f.amount)}</td></tr>`,
    )
    .join('')

  const stageRows = stages
    .map(
      (s) =>
        `<tr><td style="border:1px solid #ddd;padding:6px 8px">${escapeHtml(s.title)}</td>` +
        `<td style="border:1px solid #ddd;padding:6px 8px">${stageLabel(s.status)}</td>` +
        `<td style="border:1px solid #ddd;padding:6px 8px">${faDigits(s.progress)}٪</td>` +
        `<td style="border:1px solid #ddd;padding:6px 8px">${s.startDate || '—'} تا ${s.endDate || '—'}</td></tr>`,
    )
    .join('')

  const workerRows = workers
    .map((w) => {
      const h = attendances.filter((a) => a.workerId === w.id).reduce((s, a) => s + a.hours, 0)
      const earned = Math.round((h / 8) * w.dailyWage)
      const paid = payments.filter((p) => p.workerId === w.id).reduce((s, p) => s + p.amount, 0)
      const bal = earned - paid
      const balTxt = bal === 0 ? 'تسویه' : bal > 0 ? `طلبکار ${groupDigits(bal)}` : `بدهکار ${groupDigits(Math.abs(bal))}`
      return (
        `<tr><td style="border:1px solid #ddd;padding:6px 8px">${escapeHtml(w.name)}</td>` +
        `<td style="border:1px solid #ddd;padding:6px 8px">${escapeHtml(w.role)}</td>` +
        `<td style="border:1px solid #ddd;padding:6px 8px">${faDigits(h)} ساعت</td>` +
        `<td style="border:1px solid #ddd;padding:6px 8px;direction:ltr">${groupDigits(earned)}</td>` +
        `<td style="border:1px solid #ddd;padding:6px 8px;direction:ltr">${groupDigits(paid)}</td>` +
        `<td style="border:1px solid #ddd;padding:6px 8px">${balTxt}</td></tr>`
      )
    })
    .join('')

  const rateSection = (() => {
    if (!rates.length) return ''
    const sorted = [...rates].sort((a, b) => a.order - b.order)
    const qOf = (rid?: number) => measurements.filter((m) => m.rateId === rid).reduce((s, m) => s + m.qty, 0)
    const zonesOf = (rid?: number) =>
      [...new Set(measurements.filter((m) => m.rateId === rid).map((m) => (m.zone || '').trim()).filter(Boolean))]
    const tToman = sorted.filter((r) => r.currency === 'toman').reduce((s, r) => s + qOf(r.id) * r.price, 0)
    const tDollar = sorted.filter((r) => r.currency === 'dollar').reduce((s, r) => s + qOf(r.id) * r.price, 0)

    if (opt.ratesQuantitiesOnly) {
      const rowsHtml = sorted
        .map((r, i) => {
          const q = qOf(r.id)
          const z = zonesOf(r.id)
          return (
            `<tr><td style="border:1px solid #ddd;padding:6px 8px">${faDigits(i + 1)}</td>` +
            `<td style="border:1px solid #ddd;padding:6px 8px">${escapeHtml(r.title)}</td>` +
            `<td style="border:1px solid #ddd;padding:6px 8px">${UNIT_LABEL(r.unit)}</td>` +
            `<td style="border:1px solid #ddd;padding:6px 8px">${z.length ? escapeHtml(z.join('، ')) : '—'}</td>` +
            `<td style="border:1px solid #ddd;padding:6px 8px;font-weight:700">${groupDecimal(q)}</td></tr>`
          )
        })
        .join('')
      return (
        `<div style="font-weight:700;margin:12px 0 6px">📐 صورت‌متراژ (فقط مقادیر اجرا)</div>` +
        `<table style="width:100%;border-collapse:collapse;font-size:12px;direction:rtl">` +
        `<tr style="background:#f4f4f5"><td style="border:1px solid #ddd;padding:6px 8px">ردیف</td><td style="border:1px solid #ddd;padding:6px 8px">شرح</td><td style="border:1px solid #ddd;padding:6px 8px">واحد</td><td style="border:1px solid #ddd;padding:6px 8px">قسمت</td><td style="border:1px solid #ddd;padding:6px 8px">مقدار</td></tr>` +
        rowsHtml +
        `</table>`
      )
    }

    const rowsHtml = sorted
      .map((r, i) => {
        const q = qOf(r.id)
        const amt = q * r.price
        const amtTxt = r.currency === 'dollar' ? `$${groupDigits(amt)}` : groupDigits(amt)
        const priceTxt = r.currency === 'dollar' ? `$${groupDigits(r.price)}` : groupDigits(r.price)
        return (
          `<tr><td style="border:1px solid #ddd;padding:6px 8px">${faDigits(i + 1)}</td>` +
          `<td style="border:1px solid #ddd;padding:6px 8px">${escapeHtml(r.title)}</td>` +
          `<td style="border:1px solid #ddd;padding:6px 8px">${UNIT_LABEL(r.unit)}</td>` +
          `<td style="border:1px solid #ddd;padding:6px 8px;direction:ltr">${priceTxt}</td>` +
          `<td style="border:1px solid #ddd;padding:6px 8px">${groupDecimal(q)}</td>` +
          `<td style="border:1px solid #ddd;padding:6px 8px;direction:ltr">${amtTxt}</td></tr>`
        )
      })
      .join('')
    return (
      `<div style="font-weight:700;margin:12px 0 6px">📐 صورت‌وضعیت (متراژ × نرخ)</div>` +
      `<table style="width:100%;border-collapse:collapse;font-size:12px;direction:rtl">` +
      `<tr style="background:#f4f4f5"><td style="border:1px solid #ddd;padding:6px 8px">ردیف</td><td style="border:1px solid #ddd;padding:6px 8px">شرح</td><td style="border:1px solid #ddd;padding:6px 8px">واحد</td><td style="border:1px solid #ddd;padding:6px 8px">نرخ</td><td style="border:1px solid #ddd;padding:6px 8px">مقدار</td><td style="border:1px solid #ddd;padding:6px 8px">مبلغ</td></tr>` +
      rowsHtml +
      `<tr style="background:#f4f4f5;font-weight:700"><td colspan=5 style="border:1px solid #ddd;padding:6px 8px">جمع (تومان)</td><td style="border:1px solid #ddd;padding:6px 8px;direction:ltr">${groupDigits(tToman)}</td></tr>` +
      (tDollar > 0
        ? `<tr style="background:#f4f4f5;font-weight:700"><td colspan=5 style="border:1px solid #ddd;padding:6px 8px">جمع (دلار)</td><td style="border:1px solid #ddd;padding:6px 8px;direction:ltr">$${groupDigits(tDollar)}</td></tr>`
        : '') +
      `</table>`
    )
  })()

  const contractSection = (() => {
    const list = photos.filter((p) => p.category === 'contract').slice(0, 2)
    if (!list.length) return ''
    const imgs = list
      .map(
        (p) =>
          `<div style="width:48%;text-align:center"><img src="${p.dataUrl}" style="width:100%;max-height:340px;object-fit:contain;border:1px solid #ddd;border-radius:6px" /><div style="font-size:10px;color:#666">${p.date}</div></div>`,
      )
      .join('')
    return `<div style="font-weight:700;margin:12px 0 6px">📄 تصویر قرارداد</div><div style="display:flex;gap:8px;flex-wrap:wrap">${imgs}</div>`
  })()

  const photoZones = [...new Set(photos.filter((p) => p.category !== 'contract').map((p) => (p.zone || '').trim()))]
  const photoNote =
    opt.photos && photoZones.length
      ? `<div style="margin:14px 0;padding:10px 12px;border:1px dashed #bbb;border-radius:8px;font-size:12px;color:#555">🖼️ نمونه‌کار (قبل / حین / بعد) در ${faDigits(photoZones.length)} صفحهٔ بعد، هر قسمت در یک صفحهٔ کامل.</div>`
      : ''

  const sec = (on: boolean, html: string) => (on ? html : '')

  el.innerHTML = `
    <div style="text-align:center;border-bottom:2px solid #059669;padding-bottom:12px;margin-bottom:16px">
      <div style="font-size:20px;font-weight:700">${escapeHtml(project.name)}</div>
      <div style="font-size:12px;color:#666">گزارش پروژه ساختمانی · ${escapeHtml(appName)} · ${project.startDate || ''} تا ${project.endDate || ''}</div>
      <div style="font-size:12px;color:#666">کارفرما: ${escapeHtml(project.client || '—')}${project.address ? ' · ' + escapeHtml(project.address) : ''}</div>
    </div>
    <div style="display:flex;gap:10px;margin-bottom:14px">
      ${kpi('مبلغ قرارداد', tomanShort(project.contractAmount))}
      ${kpi('دریافتی', tomanShort(income))}
      ${kpi('هزینه', tomanShort(expense))}
      ${kpi('سود خالص', tomanShort(net))}
      ${kpi('پیشرفت', faDigits(project.progress) + '٪')}
    </div>
    ${sec(opt.stages, `
    <div style="font-weight:700;margin:12px 0 6px">مراحل اجرا (${faDigits(doneStages)} از ${faDigits(stages.length)} تمام‌شده)</div>
    <table style="width:100%;border-collapse:collapse;font-size:12px;direction:rtl">
      <tr style="background:#f4f4f5"><td style="border:1px solid #ddd;padding:6px 8px">مرحله</td><td style="border:1px solid #ddd;padding:6px 8px">وضعیت</td><td style="border:1px solid #ddd;padding:6px 8px">پیشرفت</td><td style="border:1px solid #ddd;padding:6px 8px">بازه</td></tr>
      ${stageRows || '<tr><td colspan=4>مرحله‌ای ثبت نشده</td></tr>'}
    </table>`)}
    ${sec(opt.finance, `
    <div style="font-weight:700;margin:12px 0 6px">دفتر مالی (تومان)</div>
    <table style="width:100%;border-collapse:collapse;font-size:12px;direction:rtl">
      <tr style="background:#f4f4f5"><td style="border:1px solid #ddd;padding:6px 8px">تاریخ</td><td style="border:1px solid #ddd;padding:6px 8px">شرح</td><td style="border:1px solid #ddd;padding:6px 8px">دسته</td><td style="border:1px solid #ddd;padding:6px 8px">نوع</td><td style="border:1px solid #ddd;padding:6px 8px">مبلغ</td></tr>
      ${rows || '<tr><td colspan=5>تراکنشی ثبت نشده</td></tr>'}
    </table>`)}
    ${sec(opt.rates, rateSection)}
    ${sec(opt.workers, `
    <div style="font-weight:700;margin:12px 0 6px">نیروها (کل ساعت: ${faDigits(totalHours)} · مزد محاسبه‌شده: ${groupDigits(wages)})</div>
    <table style="width:100%;border-collapse:collapse;font-size:12px;direction:rtl">
      <tr style="background:#f4f4f5"><td style="border:1px solid #ddd;padding:6px 8px">نام</td><td style="border:1px solid #ddd;padding:6px 8px">شغل</td><td style="border:1px solid #ddd;padding:6px 8px">ساعت</td><td style="border:1px solid #ddd;padding:6px 8px">مزد</td><td style="border:1px solid #ddd;padding:6px 8px">پرداختی</td><td style="border:1px solid #ddd;padding:6px 8px">مانده</td></tr>
      ${workerRows || '<tr><td colspan=6>نیرویی ثبت نشده</td></tr>'}
    </table>`)}
    ${photoNote}
    ${sec(opt.contract, contractSection)}
    <div style="margin-top:14px;font-size:11px;color:#888;text-align:center">تولیدشده با ${escapeHtml(appName)} · آفلاین و خصوصی</div>
  `
  return el
}

/* ---------- صفحهٔ عکس هر قسمت ساختمان ---------- */

function buildZonePage(data: ProjectReportData, zone: string): HTMLElement {
  const { project, photos = [], measurements = [], rates = [], appName } = data
  const z = zone.trim()
  const list = photos.filter((p) => p.category !== 'contract' && (p.zone || '').trim() === z)
  const area = list.reduce((m, p) => Math.max(m, p.area ?? 0), 0)

  // متراژ ثبت‌شده در نرخ‌نامه برای همین قسمت
  const mQty = new Map<string, number>()
  for (const m of measurements.filter((x) => (x.zone || '').trim() === z)) {
    const rate = rates.find((r) => r.id === m.rateId)
    const u = rate?.unit ?? ''
    mQty.set(u, (mQty.get(u) ?? 0) + m.qty)
  }
  const qtyText = [...mQty.entries()].map(([u, q]) => `${groupDecimal(q)} ${UNIT_LABEL(u)}`).join(' + ')

  const cats: { k: ProjectPhoto['category']; label: string }[] = [
    { k: 'before', label: 'قبل از شروع' },
    { k: 'during', label: 'حین اجرا' },
    { k: 'after', label: 'بعد و اتمام کار' },
  ]

  const el = document.createElement('div')
  el.dir = 'rtl'
  el.style.cssText = [
    'position:fixed;top:0;left:-10000px;width:820px;min-height:1120px;background:#fff;color:#18181b',
    'font-family:Vazirmatn,Tahoma,Arial,sans-serif;font-size:13px;padding:28px',
    'display:flex;flex-direction:column;box-sizing:border-box',
  ].join(';')

  const blocks = cats
    .map((c) => {
      const items = list.filter((p) => p.category === c.k).slice(0, 6)
      if (!items.length) return ''
      const imgs = items
        .map(
          (p) =>
            `<div style="flex:1 1 30%;min-width:30%;max-width:32%;text-align:center">` +
            `<img src="${p.dataUrl}" style="width:100%;height:230px;object-fit:contain;background:#f8f8f8;border:1px solid #ddd;border-radius:8px" />` +
            `<div style="font-size:10px;color:#666;margin-top:3px">${p.date}${p.caption ? ' · ' + escapeHtml(p.caption) : ''}</div>` +
            `</div>`,
        )
        .join('')
      return (
        `<div style="margin-bottom:10px">` +
        `<div style="font-weight:700;font-size:13px;margin:6px 0 5px;border-inline-start:4px solid #059669;padding-inline-start:8px">${c.label}</div>` +
        `<div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-start">${imgs}</div>` +
        `</div>`
      )
    })
    .join('')

  el.innerHTML = `
    <div style="text-align:center;border-bottom:2px solid #059669;padding-bottom:10px;margin-bottom:10px">
      <div style="font-size:18px;font-weight:700">${escapeHtml(project.name)}</div>
      <div style="font-size:11px;color:#777">${escapeHtml(appName)} · نمونه‌کار اجرا</div>
    </div>
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
      <div style="font-size:17px;font-weight:800">📍 ${escapeHtml(z || 'بدون عنوان')}</div>
      ${area > 0 ? `<div style="font-size:12px;background:#ecfdf5;color:#047857;border:1px solid #a7f3d0;border-radius:999px;padding:2px 10px">متراژ: ${groupDecimal(area)} م²</div>` : ''}
      ${qtyText ? `<div style="font-size:12px;background:#eff6ff;color:#1d4ed8;border:1px solid #bfdbfe;border-radius:999px;padding:2px 10px">اجرا: ${qtyText}</div>` : ''}
    </div>
    ${blocks || '<div style="color:#999">عکسی برای این قسمت ثبت نشده.</div>'}
    <div style="margin-top:auto;font-size:10px;color:#aaa;text-align:center">${escapeHtml(project.name)} · ${escapeHtml(appName)}</div>
  `
  return el
}

/* ---------- رندر با صفحه‌بندی هوشمند (بدون بریدن عکس) ---------- */

async function capture(el: HTMLElement): Promise<HTMLCanvasElement> {
  return html2canvas(el, {
    scale: 2,
    useCORS: true,
    backgroundColor: '#ffffff',
    windowWidth: el.scrollWidth,
    height: el.scrollHeight,
  })
}

function imageRects(el: HTMLElement, canvas: HTMLCanvasElement): { top: number; bottom: number }[] {
  const er = el.getBoundingClientRect()
  const sy = canvas.height / Math.max(1, el.scrollHeight)
  return [...el.querySelectorAll('img')].map((img) => {
    const r = img.getBoundingClientRect()
    return { top: (r.top - er.top) * sy, bottom: (r.bottom - er.top) * sy }
  })
}

async function addSmartPages(pdf: jsPDF, el: HTMLElement, firstPageAlreadyExists = false) {
  const canvas = await capture(el)
  const contentW = A4.w - A4.margin * 2
  const contentH = A4.h - A4.margin * 2
  const pxPerMm = canvas.width / contentW
  const pagePx = contentH * pxPerMm
  const rects = imageRects(el, canvas)

  let y = 0
  let first = !firstPageAlreadyExists
  let guard = 0
  while (y < canvas.height - 2 && guard++ < 40) {
    if (!first) pdf.addPage()
    first = false

    let end = Math.min(canvas.height, y + pagePx)
    if (end < canvas.height) {
      // اگر برش از وسط یک عکس می‌گذرد، برش را جابه‌جا کن
      const hit = rects.find((r) => r.top < end && r.bottom > end)
      if (hit) {
        const above = hit.top - 4
        end = above > y + pagePx * 0.18 ? above : Math.min(canvas.height, hit.bottom + 4)
      }
      if (end <= y + 20) end = Math.min(canvas.height, y + pagePx)
    }

    const sliceH = Math.max(1, Math.min(end, canvas.height) - y)
    const tmp = document.createElement('canvas')
    tmp.width = canvas.width
    tmp.height = Math.ceil(sliceH)
    const ctx = tmp.getContext('2d')
    if (ctx) ctx.drawImage(canvas, 0, y, canvas.width, sliceH, 0, 0, canvas.width, sliceH)
    const img = tmp.toDataURL('image/jpeg', 0.92)
    pdf.addImage(img, 'JPEG', A4.margin, A4.margin, contentW, sliceH / pxPerMm)
    y += sliceH
  }
}

async function addZonePage(pdf: jsPDF, el: HTMLElement) {
  pdf.addPage()
  const canvas = await capture(el)
  const contentW = A4.w - A4.margin * 2
  const contentH = A4.h - A4.margin * 2
  const imgH = (canvas.height * contentW) / canvas.width
  const scale = Math.min(1, contentH / imgH)
  const w = contentW * scale
  const h = imgH * scale
  pdf.addImage(
    canvas.toDataURL('image/jpeg', 0.92),
    'JPEG',
    A4.margin + (contentW - w) / 2,
    A4.margin,
    w,
    h,
  )
}

async function savePdf(pdf: jsPDF, filename: string) {
  const { isNative, isDesktop, saveBlobFile } = await import('./native')
  if (isNative() || isDesktop()) {
    const uri = pdf.output('datauristring') as string
    const base64 = uri.slice(uri.indexOf('base64,') + 7)
    const bin = atob(base64)
    const bytes = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
    await saveBlobFile(filename, new Blob([bytes], { type: 'application/pdf' }))
  } else {
    pdf.save(filename)
  }
}

/* ---------- خروجی‌های داده‌ای ---------- */

function toSheets(data: ProjectReportData) {
  const { project, finance, stages, workers, attendances, payments, rates = [], measurements = [], photos = [] } = data
  const workerRows = workers.map((w) => {
    const h = attendances.filter((a) => a.workerId === w.id).reduce((s, a) => s + a.hours, 0)
    const earned = Math.round((h / 8) * w.dailyWage)
    const paid = payments.filter((p) => p.workerId === w.id).reduce((s, p) => s + p.amount, 0)
    return { نام: w.name, شغل: w.role, 'ساعت کارکرد': h, 'مزد (تومان)': earned, 'پرداختی (تومان)': paid, 'مانده (تومان)': earned - paid }
  })
  const qOf = (rid?: number) => measurements.filter((m) => m.rateId === rid).reduce((s, m) => s + m.qty, 0)
  const rateRows = rates.map((r) => ({
    شرح: r.title,
    واحد: UNIT_LABEL(r.unit),
    نرخ: r.price,
    'واحد پول': r.currency === 'dollar' ? 'دلار' : 'تومان',
    مقدار: qOf(r.id),
    مبلغ: qOf(r.id) * r.price,
  }))
  return {
    خلاصه: [
      { عنوان: 'پروژه', مقدار: project.name },
      { عنوان: 'کارفرما', مقدار: project.client ?? '' },
      { عنوان: 'مبلغ قرارداد', مقدار: project.contractAmount },
      { عنوان: 'پیشرفت', مقدار: project.progress + '٪' },
      { عنوان: 'شروع', مقدار: project.startDate ?? '' },
      { عنوان: 'پایان', مقدار: project.endDate ?? '' },
    ],
    مالی: finance.map((f) => ({ تاریخ: f.date, نوع: f.type === 'income' ? 'دریافتی' : 'پرداختی', دسته: f.category, مبلغ: f.amount, شرح: f.description ?? '' })),
    مراحل: stages.map((s) => ({ مرحله: s.title, وضعیت: stageLabel(s.status), پیشرفت: s.progress, شروع: s.startDate ?? '', پایان: s.endDate ?? '' })),
    نیروها: workerRows,
    نرخ‌نامه: rateRows,
    عکس‌ها: photos.map((p) => ({ دسته: p.category, قسمت: p.zone ?? '', متراژ: p.area ?? '', تاریخ: p.date, توضیح: p.caption ?? '' })),
  }
}

function exportExcel(data: ProjectReportData, filename: string) {
  const sheets = toSheets(data)
  const wb = XLSX.utils.book_new()
  for (const [name, rows] of Object.entries(sheets)) {
    const ws = XLSX.utils.json_to_sheet(rows as Record<string, unknown>[])
    XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 30))
  }
  XLSX.writeFile(wb, filename)
}

function exportWord(el: HTMLElement, filename: string) {
  const html = el.innerHTML
  const blob = new Blob(
    [
      `<html dir="rtl"><head><meta charset="utf-8"><title>${filename}</title><style>
        body{font-family:'Vazirmatn',Tahoma,Arial,sans-serif;direction:rtl;font-size:13px;line-height:1.9}
        table{border-collapse:collapse;width:100%}
        td,th{border:1px solid #ddd;padding:6px 8px;text-align:right}
        img{max-width:100%}
      </style></head><body>${html}</body></html>`,
    ],
    { type: 'application/msword' },
  )
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}

/** خروجی Visio (VDX) — ساختار پروژه/مراحل/متراژ برای ویرایش نهایی */
function exportVisio(data: ProjectReportData, filename: string) {
  const { project, stages, rates = [], measurements = [], photos = [] } = data
  const shapes: string[] = []
  let id = 1
  let row = 0
  const addBox = (text: string, x: number, y: number, w: number, h: number, fill: string) => {
    shapes.push(
      `<Shape ID="${id++}" Type="Shape" LineStyle="0" FillStyle="0" TextStyle="0">` +
        `<XForm><PinX>${x}</PinX><PinY>${y}</PinY><Width>${w}</Width><Height>${h}</Height><LocPinX>${w / 2}</LocPinX><LocPinY>${h / 2}</LocPinY><Angle>0</Angle><FlipX>0</FlipX><FlipY>0</FlipY><ResizeMode>0</ResizeMode></XForm>` +
        `<Fill><FillForegnd>${fill}</FillForegnd><FillPattern>1</FillPattern></Fill>` +
        `<Text>${escapeXml(text)}</Text>` +
        `</Shape>`,
    )
  }

  addBox(`پروژه: ${project.name} — کارفرما: ${project.client ?? '—'}`, 4.5, 10.6, 8, 0.6, '#D1FAE5')
  const qOf = (rid?: number) => measurements.filter((m) => m.rateId === rid).reduce((s, m) => s + m.qty, 0)
  const areaOf = (z: string) => photos.filter((p) => (p.zone || '').trim() === z).reduce((m, p) => Math.max(m, p.area ?? 0), 0)

  for (const s of stages) {
    row += 1
    addBox(`${s.title} — ${stageLabel(s.status)} — ${s.progress}٪ — ${s.startDate ?? '—'} تا ${s.endDate ?? '—'}`, 4.5, 9.8 - row * 0.8, 8, 0.55, '#F3F4F6')
  }
  row += 1
  for (const r of rates) {
    row += 1
    const zones = [...new Set(measurements.filter((m) => m.rateId === r.id).map((m) => (m.zone || '').trim()).filter(Boolean))]
    const areaTxt = zones.map((z) => `${z}${areaOf(z) ? ` (${areaOf(z)} م²)` : ''}`).join('، ')
    addBox(`${r.title} — ${groupDecimal(qOf(r.id))} ${UNIT_LABEL(r.unit)}${areaTxt ? ` — ${areaTxt}` : ''}`, 4.5, 9.8 - row * 0.8, 8, 0.55, '#EFF6FF')
  }

  const vdx =
    `<?xml version="1.0" encoding="utf-8"?>` +
    `<VisioDocument xmlns="http://schemas.microsoft.com/visio/2003/core" xml:space="preserve">` +
    `<DocumentProperties><Title>${escapeXml(project.name)}</Title><Creator>SAZORA</Creator></DocumentProperties>` +
    `<Pages><Page ID="0" Name="Project" ViewScale="1" ViewCenterX="4.5" ViewCenterY="5.5">` +
    `<PageSheet><PageWidth>9</PageWidth><PageHeight>11</PageHeight><PageScale>1</PageScale><DrawingScale>1</DrawingScale></PageSheet>` +
    `<Shapes>${shapes.join('')}</Shapes>` +
    `</Page></Pages></VisioDocument>`

  const blob = new Blob([vdx], { type: 'application/vnd.visio' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}

/* ---------- API عمومی ---------- */

export async function downloadProjectReport(
  data: ProjectReportData,
  opt: ExportOptions = ALL_SECTIONS,
  format: ProjectExportFormat = 'pdf',
): Promise<void> {
  if (!requireLogin()) return
  const { project, photos = [] } = data
  const base = `project-${project.id ?? 'x'}-${project.name.replace(/\s+/g, '_')}`

  if (format === 'excel') {
    exportExcel(data, `${base}.xlsx`)
    return
  }
  if (format === 'json') {
    await downloadJSON(
      {
        app: 'sazora',
        kind: 'project-report',
        exportedAt: new Date().toISOString(),
        project,
        finance: data.finance,
        stages: data.stages,
        workers: data.workers,
        attendances: data.attendances,
        payments: data.payments,
        rates: data.rates ?? [],
        measurements: data.measurements ?? [],
        photos: (data.photos ?? []).map((p) => ({ ...p, dataUrl: undefined })),
      },
      `${base}.json`,
    )
    return
  }
  if (format === 'visio') {
    exportVisio(data, `${base}.vdx`)
    return
  }

  const el = buildReportElement(data, opt)
  document.body.appendChild(el)
  try {
    if (format === 'word') {
      exportWord(el, `${base}.doc`)
      return
    }
    if (format === 'jpg') {
      const canvas = await capture(el)
      const link = document.createElement('a')
      link.download = `${base}.jpg`
      link.href = canvas.toDataURL('image/jpeg', 0.95)
      link.click()
      return
    }

    // PDF
    const pdf = new jsPDF('p', 'mm', 'a4')
    await addSmartPages(pdf, el)

    // هر قسمت ساختمان → یک صفحهٔ کامل و مستقل
    if (opt.photos) {
      const zones = [...new Set(photos.filter((p) => p.category !== 'contract').map((p) => (p.zone || '').trim()))]
      for (const z of zones) {
        const zel = buildZonePage(data, z)
        document.body.appendChild(zel)
        try {
          await addZonePage(pdf, zel)
        } finally {
          zel.remove()
        }
      }
    }

    await savePdf(pdf, `${base}.pdf`)
  } finally {
    el.remove()
  }
}

/** سازگاری با کد قبلی */
export async function downloadProjectPDF(data: ProjectReportData, opt: ExportOptions = ALL_SECTIONS): Promise<void> {
  await downloadProjectReport(data, opt, 'pdf')
}

function kpi(label: string, value: string): string {
  return `<div style="flex:1;border:1px solid #e4e4e7;border-radius:10px;padding:8px;text-align:center"><div style="font-size:11px;color:#888">${label}</div><div style="font-size:15px;font-weight:700">${value}</div></div>`
}

function stageLabel(s: Stage['status']): string {
  return s === 'done' ? 'تمام‌شده' : s === 'active' ? 'در حال اجرا' : 'شروع‌نشده'
}

function escapeHtml(s: string): string {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

function escapeXml(s: string): string {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
