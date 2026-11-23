/* ============================================================
   سیستم خروجی سراسری — PDF / Word / JPG / Excel / JSON
   ============================================================ */
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'
import { saveAs } from 'file-saver'
import * as XLSX from 'xlsx'
import { requireLogin } from './auth'

/** دریافت المان DOM برای پردازش */
function getElement(id: string): HTMLElement | null {
  return document.getElementById(id)
}

/** تبدیل عدد با جداکننده هزارگان برای نمایش در خروجی */
export function formatNumberWithSeparator(n: number | string): string {
  const num = typeof n === 'string' ? parseFloat(n.replace(/[^\d.-]/g, '')) : n
  if (isNaN(num)) return n as string
  return num.toLocaleString('fa-IR')
}

const A4 = { w: 210, h: 297, margin: 8 }

async function capture(element: HTMLElement): Promise<HTMLCanvasElement> {
  return html2canvas(element, {
    scale: 2,
    useCORS: true,
    backgroundColor: '#ffffff',
    windowWidth: element.scrollWidth,
    height: element.scrollHeight,
  })
}

/** مستطیل عمودی عکس‌ها برای جلوگیری از برش وسط عکس */
function imageRects(el: HTMLElement, canvas: HTMLCanvasElement): { top: number; bottom: number }[] {
  const er = el.getBoundingClientRect()
  const sy = canvas.height / Math.max(1, el.scrollHeight)
  return [...el.querySelectorAll('img')].map((img) => {
    const r = img.getBoundingClientRect()
    return { top: (r.top - er.top) * sy, bottom: (r.bottom - er.top) * sy }
  })
}

/**
 * خروجی PDF — صفحه‌بندی هوشمند (هیچ عکسی از وسط بریده نمی‌شود)
 */
export async function exportPDF(elementId: string, filename: string): Promise<void> {
  if (!requireLogin()) return
  const element = getElement(elementId)
  if (!element) return
  const canvas = await capture(element)
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

  const contentW = A4.w - A4.margin * 2
  const contentH = A4.h - A4.margin * 2
  const pxPerMm = canvas.width / contentW
  const pagePx = contentH * pxPerMm
  const rects = imageRects(element, canvas)

  let y = 0
  let first = true
  let guard = 0
  while (y < canvas.height - 2 && guard++ < 300) {
    if (!first) pdf.addPage()
    first = false

    let end = Math.min(canvas.height, y + pagePx)
    if (end < canvas.height) {
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
    pdf.addImage(tmp.toDataURL('image/jpeg', 0.92), 'JPEG', A4.margin, A4.margin, contentW, sliceH / pxPerMm)
    y += sliceH
  }

  pdf.save(filename)
}

/**
 * خروجی JPG — عکس کامل و بزرگ از المان
 */
export async function exportJPG(elementId: string, filename: string): Promise<void> {
  if (!requireLogin()) return
  const element = getElement(elementId)
  if (!element) return
  const canvas = await capture(element)
  const link = document.createElement('a')
  link.download = filename
  link.href = canvas.toDataURL('image/jpeg', 0.95)
  link.click()
}

/**
 * خروجی Excel — از داده‌های JS
 */
export function exportExcel(
  data: Record<string, unknown>[],
  filename: string,
  sheetName = 'Sheet1',
): void {
  if (!requireLogin()) return
  const ws = XLSX.utils.json_to_sheet(data)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 30))
  XLSX.writeFile(wb, filename)
}

/**
 * خروجی Word — HTML wrapped در doc
 */
export function exportWord(elementId: string, filename: string): void {
  if (!requireLogin()) return
  const element = getElement(elementId)
  if (!element) return
  const html = element.innerHTML
  const safeTitle = filename.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const blob = new Blob(
    [
      `<html dir="rtl">
        <head>
          <meta charset="utf-8">
          <title>${safeTitle}</title>
          <style>
            body { font-family: 'Vazirmatn', Tahoma, Arial, sans-serif; direction: rtl; }
            table { border-collapse: collapse; width: 100%; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: right; }
            th { background-color: #f2f2f2; }
            img { max-width: 100%; }
          </style>
        </head>
        <body>${html}</body>
      </html>`,
    ],
    { type: 'application/msword' },
  )
  saveAs(blob, filename)
}

/** خروجی JSON */
export function exportJSON(data: unknown, filename: string): void {
  if (!requireLogin()) return
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  saveAs(blob, filename)
}

/**
 * خروجی یکپارچه — انتخاب فرمت
 */
export async function exportElement({
  elementId,
  format,
  filename,
  data,
  sheetName,
}: {
  elementId: string
  format: 'pdf' | 'jpg' | 'excel' | 'word' | 'json'
  filename: string
  data?: Record<string, unknown>[]
  sheetName?: string
}): Promise<void> {
  if (!requireLogin()) return
  switch (format) {
    case 'pdf':
      await exportPDF(elementId, filename)
      break
    case 'jpg':
      await exportJPG(elementId, filename)
      break
    case 'excel':
      if (data) exportExcel(data, filename, sheetName)
      break
    case 'word':
      exportWord(elementId, filename)
      break
    case 'json':
      exportJSON(data ?? {}, filename)
      break
  }
}
