import { PDFiumLibrary, type PDFiumDocument, type PDFiumPageRender } from '@hyzyla/pdfium'
import pdfiumWasmUrl from '@hyzyla/pdfium/pdfium.wasm?url'

/* ============================================================
   موتور رندر PDF — PDFium (WebAssembly)
   چرا؟ pdf.js برای فونت‌های فارسی جاسازی‌شده‌ای که جدول cmap ندارند
   گلیف‌ها را اشتباه نگاشت می‌کند و متن به‌هم‌ریخته نمایش داده می‌شود.
   PDFium همان موتور PDF مرورگر است و متن فارسی را دقیق رندر می‌کند.
   ============================================================ */

const WASM_URL = pdfiumWasmUrl

let libraryPromise: Promise<PDFiumLibrary> | null = null

/** یک نمونهٔ مشترک از کتابخانه (بارگذاری wasm فقط یک‌بار) */
export function getPdfium(): Promise<PDFiumLibrary> {
  if (!libraryPromise) {
    libraryPromise = PDFiumLibrary.init({ wasmUrl: WASM_URL }).catch((e: unknown) => {
      libraryPromise = null
      throw e
    })
  }
  return libraryPromise
}

/** باز کردن سند PDF از بایت‌ها */
export async function openPdfDocument(bytes: Uint8Array): Promise<PDFiumDocument> {
  const lib = await getPdfium()
  return lib.loadDocument(bytes)
}

/** رندر یک صفحه (۰-پایه) به بیت‌مپ RGBA با عرض مشخص */
export async function renderPdfPageToBitmap(
  doc: PDFiumDocument,
  pageIndex: number,
  width: number,
): Promise<PDFiumPageRender> {
  const page = doc.getPage(pageIndex)
  try {
    return await page.render({ width: Math.max(1, Math.round(width)), colorSpace: 'RGBA' })
  } finally {
    page.close()
  }
}

/** نوشتن بیت‌مپ RGBA روی کنوس */
export function drawBitmapOnCanvas(canvas: HTMLCanvasElement, img: PDFiumPageRender): boolean {
  const ctx = canvas.getContext('2d')
  if (!ctx) return false
  canvas.width = img.width
  canvas.height = img.height
  const data = ctx.createImageData(img.width, img.height)
  data.data.set(img.data)
  ctx.putImageData(data, 0, 0)
  return true
}
