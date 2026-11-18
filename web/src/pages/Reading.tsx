import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { useLiveQuery } from 'dexie-react-hooks'
import JSZip from 'jszip'
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs'
import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'
import type { PDFiumDocument } from '@hyzyla/pdfium'
import { drawBitmapOnCanvas, openPdfDocument, renderPdfPageToBitmap } from '../lib/pdfium'
import { renderAsync as renderDocx } from 'docx-preview'
import { init as initPptx } from 'pptx-preview'
import { db, type Book, type BookFormat, type BookSession, type BookStatus, type StickyNote } from '../db/schema'
import { todayJalali } from '../lib/jalali'
import { faDigits } from '../lib/format'
import { Chip, EmptyState, Field, TextInput, Panel } from '../ui/components'

/* ============================================================
   کتاب‌خوانی — قفسه کتاب آفلاین + حالت مطالعه تمام‌صفحه
   پشتیبانی: PDF (نمایش واقعی صفحه) · DOCX · PPTX · TXT
   ============================================================ */

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

const STANDARD_FONTS = `${import.meta.env.BASE_URL}pdfjs/standard_fonts/`
const PDF_WASM = `${import.meta.env.BASE_URL}pdfjs/wasm/`

const COVER_COLORS = ['#0d9488', '#2563eb', '#16a34a', '#f97316', '#9333ea', '#db2777', '#0891b2', '#b45309']
const NOTE_COLORS = ['#fde68a', '#fbcfe8', '#bfdbfe', '#bbf7d0', '#fed7aa']

/** تصاویر آرامش‌بخش پس‌زمینه (همان تصاویر تمرکز) */
const FOCUS_BACKGROUNDS = [
  'focus/focus-1.jpg',
  'focus/focus-2.jpg',
  'focus/focus-3.jpg',
  'focus/focus-4.jpg',
  'focus/focus-5.jpg',
]

/** هر «صفحه» متنی حدوداً چند نویسه */
const PAGE_CHARS = 1500

const FORMAT_LABEL: Record<BookFormat, string> = { pdf: 'PDF', docx: 'DOCX', pptx: 'PPTX', txt: 'TXT' }

/* ---------------- کمکی‌ها ---------------- */

function beep() {
  try {
    const rate = 8000
    const dur = 0.45
    const freq = 880
    const n = Math.floor(rate * dur)
    const buf = new ArrayBuffer(44 + n)
    const v = new DataView(buf)
    const writeStr = (off: number, s: string) => {
      for (let i = 0; i < s.length; i++) v.setUint8(off + i, s.charCodeAt(i))
    }
    writeStr(0, 'RIFF')
    v.setUint32(4, 36 + n, true)
    writeStr(8, 'WAVE')
    writeStr(12, 'fmt ')
    v.setUint32(16, 16, true)
    v.setUint16(20, 1, true)
    v.setUint16(22, 1, true)
    v.setUint32(24, rate, true)
    v.setUint32(28, rate, true)
    v.setUint16(32, 1, true)
    v.setUint16(34, 8, true)
    writeStr(36, 'data')
    v.setUint32(40, n, true)
    for (let i = 0; i < n; i++) {
      const s = Math.sin((2 * Math.PI * freq * i) / rate) * 100 + 128
      v.setUint8(44 + i, Math.max(0, Math.min(255, Math.round(s))))
    }
    const url = URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }))
    const audio = new Audio(url)
    void audio.play().catch(() => {})
    window.setTimeout(() => URL.revokeObjectURL(url), 3000)
  } catch {
    /* ignore */
  }
}

function paginate(text: string): string[] {
  const clean = String(text ?? '').replace(/\r\n/g, '\n').trim()
  if (!clean) return []
  const blocks = clean
    .split(/\n+/)
    .map((s) => s.trim())
    .filter(Boolean)
  const pages: string[] = []
  let buf: string[] = []
  let len = 0
  for (const b of blocks) {
    if (len > 0 && len + b.length > PAGE_CHARS) {
      pages.push(buf.join('\n\n'))
      buf = [b]
      len = b.length
    } else {
      buf.push(b)
      len += b.length
    }
  }
  if (buf.length) pages.push(buf.join('\n\n'))
  return pages
}

function statusTone(s: BookStatus): 'accent' | 'success' | 'warn' {
  return s === 'reading' ? 'accent' : s === 'finished' ? 'success' : 'warn'
}

function statusLabel(s: BookStatus, t: (k: string) => string): string {
  return s === 'reading' ? t('reading.statusReading') : s === 'finished' ? t('reading.statusFinished') : t('reading.statusPaused')
}

function shade(hex: string, amount: number): string {
  const m = /^#?([\da-f]{6})$/i.exec(hex.trim())
  if (!m) return hex
  const n = parseInt(m[1]!, 16)
  const clamp = (v: number) => Math.max(0, Math.min(255, v))
  const r = clamp(((n >> 16) & 255) + amount)
  const g = clamp(((n >> 8) & 255) + amount)
  const b = clamp((n & 255) + amount)
  return `rgb(${r},${g},${b})`
}

function formatSize(bytes?: number): string {
  if (!bytes || bytes <= 0) return ''
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${Math.max(1, Math.round(bytes / 1024))} KB`
}

function decodeXml(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCharCode(Number(d)))
    .replace(/&amp;/g, '&')
}

function stripTags(xml: string): string {
  return decodeXml(xml.replace(/<[^>]+>/g, ''))
}

/** استخراج متن از فایل Word (docx) */
async function docxToText(file: File): Promise<string> {
  const zip = await JSZip.loadAsync(await file.arrayBuffer())
  const entry = zip.file('word/document.xml')
  if (!entry) throw new Error('no-document-xml')
  const xml = await entry.async('string')
  return stripTags(
    xml
      .replace(/<\/w:p>/g, '\n')
      .replace(/<w:br\s*\/>/g, '\n')
      .replace(/<w:tab\s*\/>/g, '\t'),
  )
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** استخراج متن اسلایدهای PowerPoint (pptx) — هر اسلاید یک صفحه */
async function pptxToSlides(file: File): Promise<string[]> {
  const zip = await JSZip.loadAsync(await file.arrayBuffer())
  const names = Object.keys(zip.files)
    .filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
    .sort((a, b) => Number(/(\d+)/.exec(a)?.[1] ?? 0) - Number(/(\d+)/.exec(b)?.[1] ?? 0))
  const out: string[] = []
  for (const n of names) {
    const f = zip.file(n)
    if (!f) continue
    const xml = await f.async('string')
    const texts = Array.from(xml.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)).map((m) => decodeXml(m[1] ?? '').trim())
    out.push(texts.filter(Boolean).join('\n'))
  }
  return out
}

/**
 * برخی فایل‌های PowerPoint به بخش‌هایی ارجاع می‌دهند که در بسته وجود ندارند
 * (مثلاً master/layout حذف‌شده). pptx-preview در این حالت کل بارگذاری را رها
 * می‌کند و صفحه خالی می‌ماند؛ پس ارجاع‌های ناموجود را از فهرست محتوا حذف می‌کنیم.
 */
async function normalizePptx(fileBlob: Blob): Promise<ArrayBuffer> {
  const buf = await fileBlob.arrayBuffer()
  try {
    const zip = await JSZip.loadAsync(buf)
    const entry = zip.file('[Content_Types].xml')
    if (!entry) return buf
    const xml = await entry.async('string')
    let changed = false
    const fixed = xml.replace(/<Override\b[^>]*PartName="([^"]+)"[^>]*\/>/g, (tag: string, part: string) => {
      const path = part.replace(/^\//, '')
      if (zip.file(path)) return tag
      changed = true
      return ''
    })
    if (!changed) return buf
    zip.file('[Content_Types].xml', fixed)
    return await zip.generateAsync({ type: 'arraybuffer', compression: 'STORE' })
  } catch {
    return buf
  }
}

function detectFormat(fileName: string): BookFormat | null {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? ''
  if (ext === 'pdf') return 'pdf'
  if (ext === 'docx') return 'docx'
  if (ext === 'pptx') return 'pptx'
  if (ext === 'txt') return 'txt'
  return null
}

/** رندر صفحه اول PDF به‌عنوان جلد (با PDFium تا فونت فارسی درست باشد) */
async function pdfCover(doc: PDFiumDocument): Promise<string | undefined> {
  try {
    const img = await renderPdfPageToBitmap(doc, 0, 240)
    const canvas = document.createElement('canvas')
    if (!drawBitmapOnCanvas(canvas, img)) return undefined
    return canvas.toDataURL('image/jpeg', 0.72)
  } catch {
    return undefined
  }
}

/** عنوان/نویسنده از متادیتای PDF (اختیاری و بی‌خطر) */
async function pdfMetadata(data: Uint8Array): Promise<{ title: string; author: string }> {
  const task = pdfjs.getDocument({ data, standardFontDataUrl: STANDARD_FONTS, wasmUrl: PDF_WASM })
  try {
    const doc = await Promise.race([
      task.promise,
      new Promise<never>((_, rej) => setTimeout(() => rej(new Error('pdf-meta-timeout')), 8000)),
    ])
    const meta = await doc.getMetadata()
    const info = (meta?.info ?? {}) as Record<string, unknown>
    return {
      title: typeof info.Title === 'string' ? info.Title.trim() : '',
      author: typeof info.Author === 'string' ? info.Author.trim() : '',
    }
  } catch {
    return { title: '', author: '' }
  } finally {
    void task.destroy()
  }
}

/* ---------------- جلد خودکار برای Word / PowerPoint ---------------- */

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v))
}

/** نرمال‌کردن مسیر نسبی داخل zip (مثل ../media/x.png) */
function resolveZipPath(baseDir: string, target: string): string {
  if (target.startsWith('/')) return target.slice(1)
  const parts = baseDir.split('/').filter(Boolean)
  for (const seg of target.split('/')) {
    if (seg === '..') parts.pop()
    else if (seg !== '.' && seg !== '') parts.push(seg)
  }
  return parts.join('/')
}

const IMAGE_MIME: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  bmp: 'image/bmp',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  tif: 'image/tiff',
  tiff: 'image/tiff',
  emf: 'image/emf',
  wmf: 'image/wmf',
}

/** کوچک‌کردن تصویر جلد تا حجم ذخیره‌سازی کم بماند */
async function shrinkCover(blob: Blob, maxW = 320): Promise<string | undefined> {
  try {
    const url = URL.createObjectURL(blob)
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = () => reject(new Error('image-decode-failed'))
      el.src = url
    })
    const scale = Math.min(1, maxW / (img.naturalWidth || maxW))
    const w = Math.max(1, Math.round((img.naturalWidth || maxW) * scale))
    const h = Math.max(1, Math.round((img.naturalHeight || maxW) * scale))
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return undefined
    ctx.drawImage(img, 0, 0, w, h)
    URL.revokeObjectURL(url)
    return canvas.toDataURL('image/jpeg', 0.78)
  } catch {
    return undefined
  }
}

/**
 * اولین تصویری که در صفحه اول سند استفاده شده را پیدا می‌کند.
 * docx: word/document.xml + word/_rels/document.xml.rels
 * pptx: ppt/slides/slide1.xml + ppt/slides/_rels/slide1.xml.rels
 */
async function zipFirstImage(zip: JSZip, kind: 'docx' | 'pptx'): Promise<Blob | undefined> {
  try {
    const isDocx = kind === 'docx'
    const xmlPath = isDocx ? 'word/document.xml' : 'ppt/slides/slide1.xml'
    const relsPath = isDocx ? 'word/_rels/document.xml.rels' : 'ppt/slides/_rels/slide1.xml.rels'
    const baseDir = isDocx ? 'word' : 'ppt/slides'

    const xml = await zip.file(xmlPath)?.async('string')
    const rels = await zip.file(relsPath)?.async('string')
    const candidates: string[] = []

    if (xml && rels) {
      // همه ارجاع‌های تصویر در صفحه اول، به ترتیب ظاهر شدن
      const ids = Array.from(xml.matchAll(/r:(?:embed|id)="([^"]+)"/g)).map((m) => m[1]!)
      for (const id of ids) {
        const rel = new RegExp(`<Relationship[^>]*Id="${id}"[^>]*>`, 'i').exec(rels)?.[0]
        if (!rel || !/image/i.test(rel)) continue
        const target = /Target="([^"]+)"/i.exec(rel)?.[1]
        if (!target) continue
        const path = resolveZipPath(baseDir, target)
        if (zip.file(path)) candidates.push(path)
      }
    }

    // اگر پیدا نشد: بزرگ‌ترین تصویر پوشه media
    if (candidates.length === 0) {
      const folder = isDocx ? 'word/media/' : 'ppt/media/'
      const files = Object.keys(zip.files).filter((n) => n.startsWith(folder) && !n.endsWith('/'))
      const sizes = await Promise.all(
        files.map(async (n) => ({ n, size: (zip.file(n) ? await zip.file(n)!.async('uint8array') : new Uint8Array()).length })),
      )
      sizes.sort((a, b) => b.size - a.size)
      if (sizes[0]) candidates.push(sizes[0].n)
    }

    for (const path of candidates) {
      const entry = zip.file(path)
      if (!entry) continue
      const ext = path.split('.').pop()?.toLowerCase() ?? ''
      const mime = IMAGE_MIME[ext]
      if (!mime || mime === 'image/emf' || mime === 'image/wmf' || mime === 'image/svg+xml') continue
      const buf = await entry.async('uint8array')
      const copy = new Uint8Array(buf.byteLength)
      copy.set(buf)
      return new Blob([copy.buffer], { type: mime })
    }
  } catch {
    /* ignore */
  }
  return undefined
}

/** جلد خودکار از فایل Word/PowerPoint */
async function officeCover(file: File, kind: 'docx' | 'pptx'): Promise<string | undefined> {
  try {
    const zip = await JSZip.loadAsync(await file.arrayBuffer())
    const blob = await zipFirstImage(zip, kind)
    if (!blob) return undefined
    return await shrinkCover(blob)
  } catch {
    return undefined
  }
}


/* ==================== صفحه اصلی کتاب‌خوانی ==================== */

export default function ReadingPage() {
  const { t } = useTranslation()
  const books = useLiveQuery(() => db.books.orderBy('createdAt').reverse().toArray(), [], [] as Book[])
  const sessions = useLiveQuery(() => db.bookSessions.toArray(), [], [] as BookSession[])

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Book | undefined>(undefined)
  const [activeId, setActiveId] = useState<number | null>(null)
  const [filter, setFilter] = useState<'all' | 'starred' | BookStatus>('all')
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState<string>('')
  const [error, setError] = useState('')
  const importRef = useRef<HTMLInputElement | null>(null)

  const today = todayJalali()
  const readingCount = books.filter((b) => b.status === 'reading').length
  const finishedCount = books.filter((b) => b.status === 'finished').length
  const todaySessions = sessions.filter((s) => s.date === today)
  const pagesToday = todaySessions.reduce((s, x) => s + x.pages, 0)
  const minutesToday = todaySessions.reduce((s, x) => s + x.minutes, 0)

  const needle = q.trim().toLowerCase()
  const shown = books
    .filter((b) => {
      const okStatus = filter === 'all' ? true : filter === 'starred' ? !!b.starred : b.status === filter
      const okText =
        !needle || b.title.toLowerCase().includes(needle) || (b.author ?? '').toLowerCase().includes(needle)
      return okStatus && okText
    })
    // ستاره‌دارها همیشه بالای قفسه
    .sort((a, b) => Number(!!b.starred) - Number(!!a.starred) || (b.updatedAt ?? 0) - (a.updatedAt ?? 0))

  const activeBook = activeId != null ? books.find((b) => b.id === activeId) : undefined

  /** افزودن یک یا چند فایل کتاب */
  async function importFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    setError('')
    const list = Array.from(files)
    for (let i = 0; i < list.length; i++) {
      const file = list[i]!
      setBusy(`${i + 1}/${list.length} · ${file.name}`)
      try {
        await importOne(file)
      } catch (e) {
        console.error('import failed', e)
        const reason = e instanceof Error ? e.message : String(e)
        setError(
          reason === 'only-pdf'
            ? t('reading.pdfOnly')
            : `${t('reading.importError', { name: file.name })} — ${reason}`,
        )
      }
    }
    setBusy('')
    if (importRef.current) importRef.current.value = ''
  }

  async function importOne(file: File) {
    const format = detectFormat(file.name)
    if (!format) throw new Error('unsupported-format')
    /* ورودی کتابخانه فقط PDF است؛ فرمت‌های دیگر اگر قبلاً در کتابخانه باشند همچنان باز می‌شوند */
    if (format !== 'pdf') throw new Error('only-pdf')
    const now = Date.now()
    const baseTitle = file.name.replace(/\.[^.]+$/, '')
    const color = COVER_COLORS[Math.floor(Math.random() * COVER_COLORS.length)] ?? COVER_COLORS[0]!
    const common = {
      title: baseTitle,
      author: '',
      format,
      fileName: file.name,
      fileSize: file.size,
      color,
      starred: false,
      currentPage: 1,
      status: 'reading' as BookStatus,
      notes: [] as StickyNote[],
      createdAt: now,
      updatedAt: now,
    }

    if (format === 'pdf') {
      const buf = await file.arrayBuffer()
      const data = new Uint8Array(buf)
      /* رندر و شمارش صفحه‌ها با PDFium؛ متادیتا (اختیاری) با pdf.js */
      let doc: PDFiumDocument
      try {
        doc = await Promise.race([
          openPdfDocument(data),
          new Promise<never>((_, rej) => setTimeout(() => rej(new Error('pdf-timeout-20s')), 20000)),
        ])
      } catch (e) {
        throw new Error(`pdf-parse-failed: ${e instanceof Error ? e.message : String(e)}`)
      }
      let pages = 1
      let cover: string | undefined
      try {
        pages = Math.max(1, doc.getPageCount())
        cover = await pdfCover(doc)
      } finally {
        doc.destroy()
      }
      const { title: metaTitle, author: metaAuthor } = await pdfMetadata(data)
      await db.books.add({
        ...common,
        title: metaTitle || baseTitle,
        author: metaAuthor,
        fileBlob: file,
        cover,
        totalPages: pages,
      })
      return
    }

    if (format === 'docx') {
      const [text, cover] = await Promise.all([docxToText(file), officeCover(file, 'docx')])
      await db.books.add({
        ...common,
        fileBlob: file,
        content: text,
        cover,
        totalPages: Math.max(1, paginate(text).length),
      })
      return
    }

    if (format === 'pptx') {
      const [slides, cover] = await Promise.all([pptxToSlides(file), officeCover(file, 'pptx')])
      await db.books.add({
        ...common,
        fileBlob: file,
        content: slides.join('\n\n'),
        cover,
        totalPages: Math.max(1, slides.length),
      })
      return
    }

    const text = await file.text()
    await db.books.add({ ...common, fileBlob: file, content: text, totalPages: Math.max(1, paginate(text).length) })
  }

  async function toggleStar(b: Book) {
    if (b.id == null) return
    await db.books.update(b.id, { starred: !b.starred, updatedAt: Date.now() })
  }

  async function removeBook(b: Book) {
    if (b.id == null) return
    if (!window.confirm(t('reading.deleteConfirm'))) return
    await db.bookSessions.where('bookId').equals(b.id).delete()
    await db.books.delete(b.id)
  }

  return (
    <div>
      {/* آمار */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <StatCard label={t('reading.statsReading')} value={faDigits(readingCount)} hint={t('reading.statsReadingHint')} tone="var(--b-accent)" />
        <StatCard label={t('reading.statsFinished')} value={faDigits(finishedCount)} hint={t('reading.statsFinishedHint')} tone="#16a34a" />
        <StatCard label={t('reading.pagesToday')} value={faDigits(pagesToday)} hint={t('reading.pagesTodayHint')} tone="#f97316" />
        <StatCard label={t('reading.minutesToday')} value={faDigits(minutesToday)} hint={t('reading.minutesTodayHint')} tone="#0891b2" />
      </div>

      <Panel>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <b className="text-[14px]">📚 {t('reading.books')}</b>
          <div className="flex flex-wrap items-center gap-1.5">
            <input
              ref={importRef}
              type="file"
              accept=".pdf,application/pdf"
              multiple
              className="hidden"
              onChange={(e) => void importFiles(e.target.files)}
            />
            <button
              className="btn btn-primary !py-1.5 text-[12.5px]"
              onClick={() => importRef.current?.click()}
              disabled={!!busy}
            >
              {busy ? `⏳ ${busy}` : `+ ${t('reading.importBook')}`}
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 mb-3">
          {(
            [
              ['all', t('reading.filterAll')],
              ['starred', `★ ${t('reading.filterStarred')}`],
              ['reading', t('reading.statusReading')],
              ['finished', t('reading.statusFinished')],
              ['paused', t('reading.statusPaused')],
            ] as Array<['all' | 'starred' | BookStatus, string]>
          ).map(([id, label]) => (
            <button
              key={id}
              className={`btn !py-1 !px-2.5 text-[12px] ${filter === id ? 'btn-primary' : ''}`}
              onClick={() => setFilter(id)}
            >
              {label}
            </button>
          ))}
          <input
            className="field !py-1.5 !text-[12.5px] !w-[190px] ms-auto"
            placeholder={t('reading.searchPlaceholder')}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>

        {error && <div className="text-[12px] mb-2" style={{ color: 'var(--b-red)' }}>{error}</div>}

        {books.length === 0 ? (
          <EmptyState
            icon="📚"
            title={t('reading.empty')}
            hint={t('reading.emptyHint')}
            action={
              <button className="btn btn-primary" onClick={() => importRef.current?.click()}>
                + {t('reading.importBook')}
              </button>
            }
          />
        ) : shown.length === 0 ? (
          <div className="text-[12.5px] text-faint text-center py-8">{t('reading.noMatch')}</div>
        ) : (
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {shown.map((b) => (
              <BookCard
                key={b.id}
                book={b}
                onRead={() => setActiveId(b.id ?? null)}
                onEdit={() => {
                  setEditing(b)
                  setFormOpen(true)
                }}
                onDelete={() => void removeBook(b)}
                onStar={() => void toggleStar(b)}
              />
            ))}
          </div>
        )}

        <p className="text-[11px] text-faint mt-3">{t('reading.shelfHint')}</p>
      </Panel>

      {formOpen && (
        <BookForm
          initial={editing}
          onDone={() => {
            setFormOpen(false)
            setEditing(undefined)
          }}
        />
      )}

      {activeBook && activeBook.id != null && (
        <Reader book={activeBook} onClose={() => setActiveId(null)} />
      )}
    </div>
  )
}

function StatCard({ label, value, hint, tone }: { label: string; value: string; hint: string; tone: string }) {
  return (
    <div className="card p-3">
      <div className="text-[11px] text-muted">{label}</div>
      <div className="text-[22px] font-bold leading-tight mt-0.5">{value}</div>
      <div className="text-[10.5px] mt-0.5" style={{ color: tone }}>
        {hint}
      </div>
    </div>
  )
}

/* ==================== کارت کتاب ==================== */

function BookCard({
  book,
  onRead,
  onEdit,
  onDelete,
  onStar,
}: {
  book: Book
  onRead: () => void
  onEdit: () => void
  onDelete: () => void
  onStar: () => void
}) {
  const { t } = useTranslation()
  const isDoc = book.format === 'docx'
  const pct = isDoc
    ? book.status === 'finished'
      ? 100
      : 0
    : book.totalPages > 0
      ? Math.min(100, Math.round((book.currentPage / book.totalPages) * 100))
      : 0

  return (
    <div className="card p-3 flex flex-col gap-2.5">
      <div className="flex items-start gap-2.5">
        <button
          onClick={onRead}
          className="w-[62px] h-[86px] rounded-lg shrink-0 overflow-hidden relative grid place-items-center text-white text-[26px] font-bold"
          style={{ background: `linear-gradient(140deg, ${book.color}, ${shade(book.color, -32)})` }}
          title={t('reading.startReading')}
        >
          {book.cover ? (
            <img src={book.cover} alt={book.title} className="absolute inset-0 w-full h-full object-cover" />
          ) : (
            <>
              <span className="relative z-10">{(book.title || '?').trim().slice(0, 1)}</span>
              <span className="absolute inset-y-1.5 end-1.5 w-[3px] rounded-full bg-white/35" />
            </>
          )}
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-1">
            <b className="text-[13.5px] leading-snug line-clamp-2 flex-1">{book.title}</b>
            <button
              className="!py-0 !px-1 text-[15px] leading-none"
              style={{ color: book.starred ? '#f59e0b' : 'var(--b-faint)' }}
              onClick={onStar}
              title={book.starred ? t('reading.unstar') : t('reading.star')}
            >
              {book.starred ? '★' : '☆'}
            </button>
          </div>
          <div className="text-[11.5px] text-muted mt-0.5 truncate">{book.author || t('reading.unknownAuthor')}</div>
          <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
            <Chip tone={statusTone(book.status)}>{statusLabel(book.status, t)}</Chip>
            <Chip>{FORMAT_LABEL[book.format] ?? 'FILE'}</Chip>
            {!!book.notes?.length && <Chip>📝 {faDigits(book.notes.length)}</Chip>}
          </div>
        </div>
      </div>

      <div>
        <div className="h-1.5 rounded-full bg-surface-2 overflow-hidden">
          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: book.color }} />
        </div>
        <div className="flex items-center justify-between mt-1 text-[10.5px] text-faint">
          <span>
            {isDoc
              ? t('reading.wordDoc')
              : t('reading.pageOfShort', { p: faDigits(book.currentPage), t: faDigits(book.totalPages) })}
          </span>
          <span className="tabular-nums">{faDigits(pct)}٪</span>
        </div>
      </div>

      <div className="flex gap-1.5">
        <button className="btn btn-primary !py-1.5 text-[12.5px] flex-1" onClick={onRead}>
          {book.currentPage > 1 ? `▶️ ${t('reading.continueReading')}` : `▶️ ${t('reading.startReading')}`}
        </button>
        <button className="btn !py-1.5 !px-2 text-[12px]" onClick={onEdit} title={t('reading.editBook')}>
          ✏️
        </button>
        <button className="btn !py-1.5 !px-2 text-[12px]" onClick={onDelete} title={t('common.delete')}>
          🗑
        </button>
      </div>
    </div>
  )
}

/* ==================== فرم اطلاعات کتاب ==================== */

function BookForm({ initial, onDone }: { initial?: Book; onDone: () => void }) {
  const { t } = useTranslation()
  const [title, setTitle] = useState(initial?.title ?? '')
  const [author, setAuthor] = useState(initial?.author ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [status, setStatus] = useState<BookStatus>(initial?.status ?? 'reading')
  const [color, setColor] = useState(initial?.color ?? COVER_COLORS[0]!)
  const [cover, setCover] = useState(initial?.cover ?? '')
  const [starred, setStarred] = useState(!!initial?.starred)
  const [error, setError] = useState('')
  const coverRef = useRef<HTMLInputElement | null>(null)

  async function pickCover(file: File | undefined) {
    if (!file) return
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const fr = new FileReader()
        fr.onload = () => resolve(String(fr.result ?? ''))
        fr.onerror = () => reject(new Error('read-failed'))
        fr.readAsDataURL(file)
      })
      setCover(dataUrl)
    } catch {
      setError(t('reading.importError', { name: file.name }))
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    const name = title.trim()
    if (!name) {
      setError(t('reading.titleRequired'))
      return
    }
    const data = {
      title: name,
      author: author.trim(),
      description: description.trim() || undefined,
      status,
      color,
      cover: cover || undefined,
      starred,
      updatedAt: Date.now(),
    }
    if (initial?.id) await db.books.update(initial.id, data)
    else
      await db.books.add({
        ...data,
        format: 'txt',
        totalPages: 1,
        currentPage: 1,
        notes: [],
        createdAt: Date.now(),
      })
    onDone()
  }

  return createPortal(
    <div className="fixed inset-0 z-[95] overflow-y-auto" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/45" onClick={onDone} />
      <div className="relative mx-auto my-6 w-[min(620px,94vw)] b-pop">
        <form onSubmit={submit} className="card p-4 sm:p-5">
          <div className="flex items-center justify-between mb-3">
            <b className="text-[14.5px]">{initial ? `✏️ ${t('reading.editBook')}` : `📕 ${t('reading.newBook')}`}</b>
            <button type="button" className="btn btn-ghost !py-0.5 !px-2" onClick={onDone}>
              ✕
            </button>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <Field label={t('reading.bookTitle')}>
              <TextInput value={title} onChange={(e) => setTitle(e.target.value)} autoFocus required />
            </Field>
            <Field label={t('reading.author')}>
              <TextInput value={author} onChange={(e) => setAuthor(e.target.value)} />
            </Field>
            <Field label={t('reading.status')}>
              <div className="flex flex-wrap gap-1.5">
                {(['reading', 'finished', 'paused'] as BookStatus[]).map((s) => (
                  <button
                    key={s}
                    type="button"
                    className={`btn !py-1 !px-2.5 text-[12px] ${status === s ? 'btn-primary' : ''}`}
                    onClick={() => setStatus(s)}
                  >
                    {statusLabel(s, t)}
                  </button>
                ))}
              </div>
            </Field>
            <Field label={t('reading.cover')} hint={t('reading.coverHint')}>
              <div className="flex items-center gap-2 flex-wrap">
                <input
                  ref={coverRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => void pickCover(e.target.files?.[0])}
                />
                <button type="button" className="btn !py-1.5 !px-2.5 text-[12px]" onClick={() => coverRef.current?.click()}>
                  🖼️ {t('reading.uploadCover')}
                </button>
                {cover && (
                  <button type="button" className="btn !py-1.5 !px-2.5 text-[12px]" onClick={() => setCover('')}>
                    {t('reading.removeCover')}
                  </button>
                )}
                {cover && <img src={cover} alt="cover" className="w-9 h-12 rounded object-cover border border-line" />}
              </div>
            </Field>
            <Field label={t('reading.coverColor')}>
              <div className="flex flex-wrap gap-1.5">
                {COVER_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className={`w-7 h-7 rounded-full border-2 transition-transform hover:scale-110 ${
                      color === c ? 'border-[color:var(--b-ink)]' : 'border-transparent'
                    }`}
                    style={{ background: c }}
                  />
                ))}
              </div>
            </Field>
            <Field label={t('reading.star')}>
              <button
                type="button"
                className={`btn !py-1.5 text-[12.5px] ${starred ? 'btn-primary' : ''}`}
                onClick={() => setStarred((s) => !s)}
              >
                {starred ? `★ ${t('reading.starred')}` : `☆ ${t('reading.star')}`}
              </button>
            </Field>
          </div>

          <div className="mt-3">
            <Field label={t('reading.description')} hint={t('reading.descriptionHint')}>
              <textarea
                className="field !text-[12.5px] leading-6 min-h-[92px]"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t('reading.descriptionPlaceholder')}
              />
            </Field>
          </div>

          {initial && (
            <div className="mt-2 text-[11px] text-faint">
              {t('reading.fileInfo', {
                name: initial.fileName ?? '—',
                size: formatSize(initial.fileSize) || '—',
                pages: faDigits(initial.totalPages),
              })}
            </div>
          )}

          {error && (
            <div className="text-[12px] mt-2" style={{ color: 'var(--b-red)' }}>
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2 mt-4">
            <button type="button" className="btn" onClick={onDone}>
              {t('common.cancel')}
            </button>
            <button type="submit" className="btn btn-primary">
              {t('common.save')}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  )
}

/* ==================== حالت مطالعه ==================== */

function Reader({ book, onClose }: { book: Book; onClose: () => void }) {
  const { t } = useTranslation()

  /** فایل اصلی کتاب یک‌بار خوانده می‌شود تا با هر تغییر صفحه دوباره بارگذاری نشود */
  const [fileBlob, setFileBlob] = useState<Blob | null>(null)
  const [pdfData, setPdfData] = useState<Uint8Array | null>(null)
  const [pdfDoc, setPdfDoc] = useState<PDFiumDocument | null>(null)
  const [pdfError, setPdfError] = useState('')
  const [missingFile, setMissingFile] = useState(false)

  /** رندر واقعی Word / PowerPoint — چیدمان اصلی فایل حفظ می‌شود */
  const [docxError, setDocxError] = useState(false)
  const [pptxError, setPptxError] = useState(false)
  const [pptxReady, setPptxReady] = useState(false)
  const [pptxCount, setPptxCount] = useState(0)
  /* المنت host فقط وقتی صفحهٔ مطالعه باز می‌شود mount می‌شود؛ با state این mount را به افکت‌ها اطلاع می‌دهیم */
  const [docxHostEl, setDocxHostEl] = useState<HTMLDivElement | null>(null)
  const [pptxHostEl, setPptxHostEl] = useState<HTMLDivElement | null>(null)
  const pptxRef = useRef<ReturnType<typeof initPptx> | null>(null)

  const isDocx = book.format === 'docx'
  const textPages = useMemo(
    () => (book.format === 'txt' ? paginate(book.content ?? '') : []),
    [book.format, book.content],
  )
  const totalPages =
    book.format === 'pdf'
      ? Math.max(1, book.totalPages)
      : book.format === 'pptx'
        ? Math.max(1, pptxCount || book.totalPages)
        : isDocx
          ? 1
          : Math.max(1, textPages.length)

  const [page, setPage] = useState(0) // 0 = صفحه معرفی
  const [zoom, setZoom] = useState(1)
  const [notes, setNotes] = useState<StickyNote[]>(book.notes ?? [])
  const [editingNote, setEditingNote] = useState<string | null>(null)
  const [placing, setPlacing] = useState(false)
  const [scrollPct, setScrollPct] = useState(0)
  const [turned, setTurned] = useState(0)
  const notesRef = useRef<StickyNote[]>(book.notes ?? [])

  const [focusMin, setFocusMin] = useState(25)
  const [left, setLeft] = useState(25 * 60)
  const [running, setRunning] = useState(true)
  const [saved, setSaved] = useState(false)
  const [bgIndex, setBgIndex] = useState(() => {
    const v = Number(localStorage.getItem('sazora-focus-bg'))
    return Number.isFinite(v) && v >= 0 && v < FOCUS_BACKGROUNDS.length ? v : Math.floor(Math.random() * FOCUS_BACKGROUNDS.length)
  })

  const interval = useRef<number | null>(null)
  const finishedRef = useRef(false)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const todayStats = useTodayStats(book.id)

  /* بارگذاری فایل اصلی (PDF/DOCX/PPTX) از IndexedDB */
  useEffect(() => {
    if (book.format === 'txt' || book.id == null) return
    let alive = true
    ;(async () => {
      try {
        const row = await db.books.get(book.id!)
        if (!row?.fileBlob) {
          if (alive) {
            setMissingFile(true)
            setDocxError(true)
            setPptxError(true)
          }
          return
        }
        if (alive) setFileBlob(row.fileBlob)
      } catch {
        if (alive) setPdfError(t('reading.pdfError'))
      }
    })()
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [book.id, book.format])

  /* آماده‌سازی داده PDF */
  useEffect(() => {
    if (book.format !== 'pdf' || !fileBlob) return
    let alive = true
    ;(async () => {
      try {
        const buf = new Uint8Array(await fileBlob.arrayBuffer())
        if (alive) setPdfData(buf)
      } catch {
        if (alive) setPdfError(t('reading.pdfError'))
      }
    })()
    return () => {
      alive = false
    }
  }, [book.format, fileBlob])

  /* رندر Word با docx-preview — بدون تغییر چیدمان */
  useEffect(() => {
    if (book.format !== 'docx' || !fileBlob || !docxHostEl) return
    const host = docxHostEl
    let alive = true
    let timer: ReturnType<typeof setTimeout> | null = null
    host.innerHTML = ''
    const finish = (err: boolean) => {
      if (timer) clearTimeout(timer)
      if (alive) setDocxError(err)
    }
    ;(async () => {
      try {
        const timeout = new Promise<never>((_, rej) => {
          timer = setTimeout(() => rej(new Error('docx-timeout-25s')), 25000)
        })
        await Promise.race([
          renderDocx(fileBlob, host, undefined, {
            className: 'sazora-docx',
            inWrapper: true,
            breakPages: true,
            ignoreWidth: false,
            ignoreHeight: false,
            ignoreFonts: false,
            renderHeaders: true,
            renderFooters: true,
            renderFootnotes: true,
            useBase64URL: true,
          }),
          timeout,
        ])
        /* رندر بدون محتوای قابل‌مشاهده = شکست نیمه‌کاره » پیام جایگزین نشان داده شود */
        const empty = host.childElementCount === 0 || (host.textContent ?? '').trim() === ''
        finish(empty)
      } catch (e) {
        console.error('docx render failed', e)
        finish(true)
      }
    })()
    return () => {
      alive = false
      if (timer) clearTimeout(timer)
      host.innerHTML = ''
    }
  }, [book.format, fileBlob, docxHostEl])

  /* رندر PowerPoint با pptx-preview — اسلاید به اسلاید */
  useEffect(() => {
    if (book.format !== 'pptx' || !fileBlob || !pptxHostEl) return
    const host = pptxHostEl
    let alive = true
    let timer: ReturnType<typeof setTimeout> | null = null
    host.innerHTML = ''
    const width = Math.max(320, Math.min(1100, host.clientWidth || 900))
    const previewer = initPptx(host, { width, height: Math.round((width * 9) / 16), mode: 'slide' })
    ;(async () => {
      try {
        const timeout = new Promise<never>((_, rej) => {
          timer = setTimeout(() => rej(new Error('pptx-timeout-25s')), 25000)
        })
        const data = await normalizePptx(fileBlob)
        await Promise.race([previewer.preview(data), timeout])
        pptxRef.current = previewer
        setPptxCount(previewer.slideCount || book.totalPages || 1)
        setPptxReady(true)
        setPptxError(false)
      } catch (e) {
        console.error('pptx render failed', e)
        if (alive) setPptxError(true)
      } finally {
        if (timer) clearTimeout(timer)
      }
    })()
    return () => {
      alive = false
      pptxRef.current = null
      try {
        previewer.destroy()
      } catch {
        /* ignore */
      }
      host.innerHTML = ''
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [book.format, fileBlob, pptxHostEl])

  /* با تغییر صفحه، اسلاید PowerPoint عوض می‌شود */
  useEffect(() => {
    if (book.format !== 'pptx' || !pptxRef.current || page < 1) return
    try {
      pptxRef.current.renderSingleSlide(page - 1)
    } catch {
      /* ignore */
    }
  }, [page, book.format, pptxReady])

  /* ساخت سند PDF */
  useEffect(() => {
    if (!pdfData) return
    let alive = true
    let opened: PDFiumDocument | null = null
    ;(async () => {
      try {
        const doc = await openPdfDocument(pdfData)
        if (!alive) {
          doc.destroy()
          return
        }
        opened = doc
        setPdfDoc(doc)
      } catch (e) {
        console.error('pdf open failed', e)
        if (alive) setPdfError(t('reading.pdfError'))
      }
    })()
    return () => {
      alive = false
      try {
        opened?.destroy()
      } catch {
        /* ignore */
      }
      setPdfDoc(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pdfData])

  /* قفل اسکرول پس‌زمینه */
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  useEffect(() => {
    localStorage.setItem('sazora-focus-bg', String(bgIndex))
  }, [bgIndex])

  /* تایمر */
  useEffect(() => {
    if (!running) return
    interval.current = window.setInterval(() => {
      setLeft((prev) => (prev > 0 ? prev - 1 : 0))
    }, 1000)
    return () => {
      if (interval.current) {
        clearInterval(interval.current)
        interval.current = null
      }
    }
  }, [running])

  useEffect(() => {
    if (running && left === 0) {
      setRunning(false)
      beep()
      void finishSession(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [left, running])

  /* با هر تغییر صفحه، به بالای صفحه برمی‌گردیم */
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0, behavior: 'auto' })
    setEditingNote(null)
  }, [page])

  /* کلیدها */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (target && (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT')) return
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowLeft') void goPage(page + 1)
      else if (e.key === 'ArrowRight') void goPage(page - 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, totalPages])

  async function goPage(next: number) {
    const clamped = Math.max(0, Math.min(totalPages, next))
    if (clamped === page) return
    if (clamped > page) setTurned((n) => n + (clamped - page))
    setPage(clamped)
    if (book.id == null || clamped === 0) return
    await db.books.update(book.id, {
      currentPage: clamped,
      totalPages,
      status: clamped >= totalPages ? 'finished' : 'reading',
      updatedAt: Date.now(),
    })
  }

  async function saveNotes(next: StickyNote[]) {
    notesRef.current = next
    setNotes(next)
    if (book.id == null) return
    await db.books.update(book.id, { notes: next, updatedAt: Date.now() })
  }

  /** افزودن نوت در نقطه دلخواه صفحه (درصد) */
  function addNoteAt(xPct: number, yPct: number) {
    if (page === 0) return
    const note: StickyNote = {
      id: Math.random().toString(36).slice(2, 9),
      page,
      x: clamp(xPct, 0, 90),
      y: clamp(yPct, 0, 90),
      text: '',
      color: NOTE_COLORS[0]!,
      createdAt: Date.now(),
    }
    void saveNotes([...notesRef.current, note])
    setEditingNote(note.id)
  }

  function addNote() {
    if (page === 0) return
    // حالت جای‌گذاری: کاربر هرجای صفحه کلیک کند نوت همان‌جا ساخته می‌شود
    setPlacing(true)
  }

  function updateNote(id: string, patch: Partial<StickyNote>) {
    const next = notesRef.current.map((n) => (n.id === id ? { ...n, ...patch } : n))
    notesRef.current = next
    setNotes(next)
  }

  function persistNote(id: string, patch?: Partial<StickyNote>) {
    const next = patch
      ? notesRef.current.map((n) => (n.id === id ? { ...n, ...patch } : n))
      : notesRef.current
    void saveNotes(next)
  }

  function deleteNote(id: string) {
    setEditingNote(null)
    void saveNotes(notesRef.current.filter((n) => n.id !== id))
  }

  /** کلیک روی صفحه در حالت جای‌گذاری نوت */
  function onPageClick(e: ReactMouseEvent<HTMLDivElement>) {
    if (!placing) return
    const rect = e.currentTarget.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100
    addNoteAt(x - 4, y - 3)
    setPlacing(false)
  }

  async function finishSession(auto = false) {
    if (finishedRef.current) return
    finishedRef.current = true
    const elapsed = Math.max(1, Math.round((focusMin * 60 - left) / 60))
    const pagesRead = Math.max(0, turned)
    if (book.id != null) {
      await db.bookSessions.add({
        bookId: book.id,
        date: todayJalali(),
        minutes: elapsed,
        pages: pagesRead,
        note: auto ? t('reading.autoFinished') : undefined,
        createdAt: Date.now(),
      })
      await db.books.update(book.id, {
        currentPage: Math.max(1, page),
        totalPages,
        status: page >= totalPages && page > 0 ? 'finished' : 'reading',
        updatedAt: Date.now(),
      })
    }
    setSaved(true)
    window.setTimeout(() => {
      finishedRef.current = false
      setSaved(false)
      onClose()
    }, 700)
  }

  const mm = String(Math.floor(left / 60)).padStart(2, '0')
  const ss = String(left % 60).padStart(2, '0')
  const pctDone = focusMin > 0 ? Math.min(100, Math.round(((focusMin * 60 - left) / (focusMin * 60)) * 100)) : 0
  const progress =
    page === 0
      ? 0
      : isDocx
        ? scrollPct
        : Math.min(100, Math.round((page / totalPages) * 100))
  const pageNotes = notes.filter((n) => (isDocx ? n.page === 1 : n.page === page))

  return createPortal(
    <div className="fixed inset-0 z-[100] overflow-hidden" style={{ background: '#05070d', color: '#f8fafc' }}>
      <div
        className="sazora-focus-bg"
        style={{ backgroundImage: `url(${import.meta.env.BASE_URL}${FOCUS_BACKGROUNDS[bgIndex]})` }}
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(circle at 50% 45%, rgba(5,7,13,0.35) 0%, rgba(5,7,13,0.74) 62%, rgba(5,7,13,0.94) 100%)',
        }}
      />

      <div className="relative z-10 h-full w-full flex flex-col sm:flex-row gap-3 p-3">
        {/* ---------- پنل شیشه‌ای تایمر (راست، ۲۰٪) ---------- */}
        <aside className="w-full sm:w-[20%] sm:min-w-[256px] sm:max-w-[350px] shrink-0 flex">
          <div
            className="w-full rounded-3xl flex flex-col items-center gap-2 px-3 py-4 overflow-y-auto"
            style={{
              background: 'linear-gradient(160deg, rgba(255,255,255,0.16), rgba(255,255,255,0.05) 45%, rgba(255,255,255,0.09))',
              border: '1px solid rgba(255,255,255,0.24)',
              boxShadow: '0 22px 60px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.35)',
              backdropFilter: 'blur(18px) saturate(160%)',
              WebkitBackdropFilter: 'blur(18px) saturate(160%)',
            }}
          >
            <div className="text-[10.5px] tracking-[0.18em] uppercase" style={{ color: 'rgba(255,255,255,0.6)' }}>
              {t('reading.sessionMode')}
            </div>

            <div
              className="w-[52px] h-[70px] rounded-lg overflow-hidden grid place-items-center text-[22px] font-bold shrink-0"
              style={{ background: `linear-gradient(140deg, ${book.color}, ${shade(book.color, -32)})` }}
            >
              {book.cover ? (
                <img src={book.cover} alt="" className="w-full h-full object-cover" />
              ) : (
                (book.title || '?').trim().slice(0, 1)
              )}
            </div>

            <div className="text-[13px] font-bold text-center leading-snug line-clamp-2 px-1">{book.title}</div>
            <div className="text-[10.5px] text-center" style={{ color: 'rgba(255,255,255,0.6)' }}>
              {book.author || t('reading.unknownAuthor')}
            </div>

            <div className="w-full h-px my-0.5" style={{ background: 'rgba(255,255,255,0.18)' }} />

            <div className="text-[42px] font-bold tabular-nums leading-none" dir="ltr" style={{ color: '#f1f5f9' }}>
              {mm}:{ss}
            </div>

            <div className="text-[11px]" style={{ color: 'rgba(255,255,255,0.62)' }}>
              {page === 0
                ? t('reading.introTitle')
                : isDocx
                  ? t('reading.scrollMode')
                  : t('reading.pageOf', { p: faDigits(page), t: faDigits(totalPages) })}
            </div>

            <div className="w-full max-w-[230px]">
              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.18)' }}>
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${page === 0 ? pctDone : progress}%`, background: 'rgba(255,255,255,0.85)' }}
                />
              </div>
              <div className="mt-1 text-[10px] text-center" style={{ color: 'rgba(255,255,255,0.55)' }}>
                {faDigits(page === 0 ? pctDone : progress)}٪
              </div>
            </div>

            <div className="flex gap-1 mt-0.5">
              {[15, 25, 45, 60].map((m) => (
                <button
                  key={m}
                  className="text-[10.5px] px-2 py-0.5 rounded-full"
                  style={{
                    background: focusMin === m ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.10)',
                    color: '#fff',
                    border: '1px solid rgba(255,255,255,0.22)',
                  }}
                  onClick={() => {
                    setFocusMin(m)
                    setLeft(m * 60)
                    setRunning(false)
                  }}
                >
                  {faDigits(m)}
                </button>
              ))}
            </div>

            <button
              className="btn btn-primary w-full !py-2 text-[12.5px] mt-1.5"
              onClick={() => void finishSession(false)}
              disabled={saved}
            >
              {saved ? `✅ ${t('reading.sessionSaved')}` : `✅ ${t('reading.finishSession')}`}
            </button>

            <button
              className="btn w-full !py-2 text-[12.5px]"
              style={{ background: 'rgba(255,255,255,0.14)', color: '#fff', borderColor: 'rgba(255,255,255,0.26)' }}
              onClick={() => setRunning((r) => !r)}
            >
              {running ? `⏸️ ${t('reading.pause')}` : `▶️ ${t('reading.resume')}`}
            </button>

            <button className="text-[11px] mt-0.5" style={{ color: 'rgba(255,255,255,0.68)' }} onClick={onClose}>
              {t('reading.exitReading')}
            </button>

            <div className="text-[10px] text-center mt-0.5" style={{ color: 'rgba(255,255,255,0.5)' }}>
              {t('reading.todayStat', { m: faDigits(todayStats.minutes), p: faDigits(todayStats.pages) })}
            </div>

            <div className="mt-auto w-full flex flex-col items-center gap-1 pt-2">
              <button
                type="button"
                className="text-[10.5px] px-3 py-1.5 rounded-full"
                style={{
                  background: 'rgba(255,255,255,0.12)',
                  color: 'rgba(255,255,255,0.86)',
                  border: '1px solid rgba(255,255,255,0.22)',
                }}
                onClick={() => setBgIndex((i) => (i + 1) % FOCUS_BACKGROUNDS.length)}
              >
                🖼️ {t('learn.focusBg')}
              </button>
              <div className="text-[9.5px] text-center" style={{ color: 'rgba(255,255,255,0.38)' }}>
                {t('reading.hint')}
              </div>
            </div>
          </div>
        </aside>

        {/* ---------- صفحه کتاب (چپ) ---------- */}
        <main
          className="flex-1 min-w-0 h-full rounded-2xl flex flex-col overflow-hidden"
          style={{ background: '#fdfbf6', color: '#0f172a', boxShadow: '0 18px 50px rgba(0,0,0,0.45)' }}
        >
          {/* نوار بالا */}
          <div className="flex flex-wrap items-center gap-2 px-3 sm:px-5 pt-3 pb-2">
            <button
              className="btn !py-1 !px-2.5 text-[11.5px]"
              style={{ background: '#f1f5f9', color: '#475569', borderColor: '#e2e8f0' }}
              onClick={onClose}
            >
              → {t('reading.backToShelf')}
            </button>

            <div className="text-[13px] font-bold truncate flex-1 text-center min-w-[70px]">{book.title}</div>

            <div className="flex items-center gap-1">
              {book.format !== 'txt' ? (
                <>
                  <button
                    className="w-[30px] h-[28px] rounded-lg text-[12px] font-bold"
                    style={{ background: '#f1f5f9', color: '#475569' }}
                    onClick={() => setZoom((z) => Math.max(0.6, +(z - 0.15).toFixed(2)))}
                    title={t('reading.zoomOut')}
                  >
                    −
                  </button>
                  <button
                    className="w-[30px] h-[28px] rounded-lg text-[12px] font-bold"
                    style={{ background: '#f1f5f9', color: '#475569' }}
                    onClick={() => setZoom((z) => Math.min(2.6, +(z + 0.15).toFixed(2)))}
                    title={t('reading.zoomIn')}
                  >
                    +
                  </button>
                </>
              ) : null}
              <span className="text-[11px] px-2 py-[5px] rounded-lg" style={{ background: '#f1f5f9', color: '#475569' }}>
                {page === 0
                  ? t('reading.introTitle')
                  : isDocx
                    ? t('reading.scrollMode')
                    : `${faDigits(page)} / ${faDigits(totalPages)}`}
              </span>
              <button
                className={`text-[11px] px-2 py-[5px] rounded-lg ${placing ? 'animate-pulse' : ''}`}
                style={{
                  background: placing ? '#fde68a' : '#fef3c7',
                  color: '#92400e',
                  border: '1px solid #fde68a',
                }}
                onClick={addNote}
                disabled={page === 0}
                title={t('reading.addNote')}
              >
                📝 {placing ? t('reading.clickToPlace') : t('reading.addNote')}
                {pageNotes.length > 0 ? ` (${faDigits(pageNotes.length)})` : ''}
              </button>
            </div>
          </div>

          <div className="mx-3 sm:mx-5 h-px" style={{ background: '#e8e3d6' }} />

          {/* ناحیه محتوا */}
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto overflow-x-auto px-3 sm:px-6 py-4"
            style={{ scrollbarGutter: 'stable' }}
            onScroll={(e) => {
              if (!isDocx) return
              const el = e.currentTarget
              const max = el.scrollHeight - el.clientHeight
              setScrollPct(max > 0 ? Math.min(100, Math.round((el.scrollTop / max) * 100)) : 0)
            }}
          >
            {page === 0 ? (
              <IntroPage book={book} onStart={() => void goPage(1)} onContinue={() => void goPage(Math.max(1, book.currentPage))} />
            ) : (
              <div className="relative mx-auto" style={{ maxWidth: isDocx ? 900 : 980 }}>
                <div
                  className={`relative ${placing ? 'cursor-crosshair' : ''} ${book.format === 'pdf' ? 'mx-auto' : ''}`}
                  style={book.format === 'pdf' ? { width: 'fit-content', maxWidth: '100%' } : undefined}
                  data-note-layer
                  onClick={onPageClick}
                >
                  {book.format === 'pdf' ? (
                    pdfDoc ? (
                      <PdfPage doc={pdfDoc} page={page} zoom={zoom} />
                    ) : (
                      <div className="py-16 text-center text-[13px]" style={{ color: '#64748b' }}>
                        {pdfError || (missingFile ? t('reading.noFile') : '…')}
                      </div>
                    )
                  ) : book.format === 'docx' ? (
                    <>
                      <div
                        ref={setDocxHostEl}
                        className="sazora-docx-host rounded-xl overflow-hidden"
                        style={{ background: '#fff', border: '1px solid #f0ece0', zoom }}
                      />
                      {docxError && (
                        <div
                          className="mt-2 whitespace-pre-wrap leading-[2.1] text-justify rounded-xl"
                          style={{ fontSize: 16, color: '#334155', background: '#fffdf8', padding: '24px 26px', border: '1px solid #f0ece0' }}
                        >
                          {missingFile
                            ? t('reading.noFile')
                            : (
                                <>
                                  {t('reading.renderFallback')}
                                  {'\n\n'}
                                  {book.content || t('reading.noContent')}
                                </>
                              )}
                        </div>
                      )}
                    </>
                  ) : book.format === 'pptx' ? (
                    <>
                      <div ref={setPptxHostEl} className="sazora-pptx-host rounded-xl overflow-hidden" style={{ zoom }} />
                      {!pptxReady && !pptxError && (
                        <div className="py-16 text-center text-[13px]" style={{ color: '#64748b' }}>
                          ⏳
                        </div>
                      )}
                      {pptxError && (
                        <div
                          className="whitespace-pre-wrap leading-[2.1] text-justify rounded-xl"
                          style={{ fontSize: 16, color: '#334155', background: '#fffdf8', padding: '24px 26px', border: '1px solid #f0ece0' }}
                        >
                          {missingFile
                            ? t('reading.noFile')
                            : (
                                <>
                                  {t('reading.renderFallback')}
                                  {'\n\n'}
                                  {textPages[0] ?? book.content ?? t('reading.noContent')}
                                </>
                              )}
                        </div>
                      )}
                    </>
                  ) : (
                    <div
                      className="whitespace-pre-wrap leading-[2.1] text-justify rounded-xl"
                      style={{ fontSize: 17, color: '#334155', background: '#fffdf8', padding: '26px 28px', border: '1px solid #f0ece0' }}
                    >
                      {textPages[Math.min(page - 1, textPages.length - 1)] ?? t('reading.noContent')}
                    </div>
                  )}

                  {/* نوت‌های چسبان همان صفحه */}
                  {pageNotes.map((n) => (
                    <StickyNoteCard
                      key={n.id}
                      note={n}
                      editing={editingNote === n.id}
                      onEdit={() => setEditingNote(n.id)}
                      onChange={(patch) => updateNote(n.id, patch)}
                      onPersist={(patch) => persistNote(n.id, patch)}
                      onDelete={() => deleteNote(n.id)}
                    />
                  ))}
                </div>

                {placing && (
                  <div className="text-center text-[11.5px] mt-2" style={{ color: '#b45309' }}>
                    {t('reading.clickToPlaceHint')}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* پاصفحه */}
          <div className="flex items-center justify-between px-3 sm:px-5 py-2.5" style={{ borderTop: '1px solid #f0ece0' }}>
            {isDocx ? (
              <>
                <button
                  className="btn !py-1 !px-3 text-[11.5px]"
                  style={{ background: '#f1f5f9', color: '#475569', borderColor: '#e2e8f0' }}
                  onClick={() => scrollRef.current?.scrollBy({ top: -Math.round((scrollRef.current?.clientHeight ?? 600) * 0.85), behavior: 'smooth' })}
                >
                  {t('reading.prevPage')}
                </button>
                <span className="text-[11.5px]" style={{ color: '#94a3b8' }}>
                  {faDigits(scrollPct)}٪
                </span>
                <button
                  className="btn !py-1 !px-3 text-[11.5px]"
                  style={{ background: '#f1f5f9', color: '#475569', borderColor: '#e2e8f0' }}
                  onClick={() => scrollRef.current?.scrollBy({ top: Math.round((scrollRef.current?.clientHeight ?? 600) * 0.85), behavior: 'smooth' })}
                >
                  {t('reading.nextPage')}
                </button>
              </>
            ) : (
              <>
                <button
                  className="btn !py-1 !px-3 text-[11.5px]"
                  style={{ background: '#f1f5f9', color: '#475569', borderColor: '#e2e8f0' }}
                  onClick={() => void goPage(page - 1)}
                  disabled={page <= 0}
                >
                  {t('reading.prevPage')}
                </button>
                <span className="text-[11.5px]" style={{ color: '#94a3b8' }}>
                  {page === 0 ? t('reading.introTitle') : faDigits(page)}
                </span>
                <button
                  className="btn !py-1 !px-3 text-[11.5px]"
                  style={{ background: '#f1f5f9', color: '#475569', borderColor: '#e2e8f0' }}
                  onClick={() => void goPage(page + 1)}
                  disabled={page >= totalPages}
                >
                  {t('reading.nextPage')}
                </button>
              </>
            )}
          </div>
        </main>
      </div>
    </div>,
    document.body,
  )
}

/* ---------- صفحه معرفی کتاب ---------- */

function IntroPage({ book, onStart, onContinue }: { book: Book; onStart: () => void; onContinue: () => void }) {
  const { t } = useTranslation()
  return (
    <div className="mx-auto max-w-[720px] py-6">
      <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
        <div
          className="w-[132px] h-[184px] rounded-xl overflow-hidden shrink-0 grid place-items-center text-white text-[46px] font-bold"
          style={{
            background: `linear-gradient(140deg, ${book.color}, ${shade(book.color, -32)})`,
            boxShadow: '0 16px 34px rgba(15,23,42,0.22)',
          }}
        >
          {book.cover ? (
            <img src={book.cover} alt={book.title} className="w-full h-full object-cover" />
          ) : (
            (book.title || '?').trim().slice(0, 1)
          )}
        </div>

        <div className="flex-1 min-w-0 text-center sm:text-start">
          <div className="text-[11px] tracking-widest" style={{ color: '#94a3b8' }}>
            {t('reading.introTitle')}
          </div>
          <h2 className="text-[22px] font-bold mt-1 leading-snug" style={{ color: '#0f172a' }}>
            {book.title}
          </h2>
          <div className="text-[13px] mt-1" style={{ color: '#64748b' }}>
            {book.author || t('reading.unknownAuthor')}
          </div>
          <div className="flex flex-wrap items-center gap-1.5 mt-2 justify-center sm:justify-start">
            <Chip tone={statusTone(book.status)}>{statusLabel(book.status, t)}</Chip>
            <Chip>{FORMAT_LABEL[book.format] ?? 'FILE'}</Chip>
            {book.format === 'docx' ? (
              <Chip>{t('reading.wordDoc')}</Chip>
            ) : (
              <Chip>
                {faDigits(book.totalPages)} {t('reading.pagesUnit')}
              </Chip>
            )}
            {!!book.notes?.length && <Chip>📝 {faDigits(book.notes.length)}</Chip>}
          </div>
        </div>
      </div>

      <div className="mt-5 rounded-xl p-4" style={{ background: '#fffdf8', border: '1px solid #f0ece0' }}>
        <div className="text-[12px] font-bold mb-1" style={{ color: '#475569' }}>
          {t('reading.description')}
        </div>
        <p className="text-[13.5px] leading-7 whitespace-pre-wrap" style={{ color: '#334155' }}>
          {book.description?.trim() || t('reading.noDescription')}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2 mt-4 justify-center">
        <button className="btn btn-primary !py-2 !px-4 text-[13px]" onClick={onStart}>
          {t('reading.startFromBeginning')}
        </button>
        {book.currentPage > 1 && (
          <button className="btn !py-2 !px-4 text-[13px]" onClick={onContinue}>
            {t('reading.continueFrom', { p: faDigits(book.currentPage) })}
          </button>
        )}
      </div>
    </div>
  )
}

/* ---------- رندر صفحه PDF ---------- */

function PdfPage({ doc, page, zoom }: { doc: PDFiumDocument; page: number; zoom: number }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)
  const [tick, setTick] = useState(0)

  /* با تغییر اندازهٔ پنجره، صفحه دوباره در اندازهٔ جدید رندر می‌شود */
  useEffect(() => {
    const canvas = canvasRef.current
    const holder = (canvas?.closest('[data-note-layer]')?.parentElement ?? null) as HTMLElement | null
    if (!holder || typeof ResizeObserver === 'undefined') return
    let last = holder.clientWidth
    const ro = new ResizeObserver(() => {
      const w = holder.clientWidth
      if (Math.abs(w - last) > 4) {
        last = w
        setTick((t) => t + 1)
      }
    })
    ro.observe(holder)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    let cancelled = false
    setReady(false)
    setFailed(false)

    ;(async () => {
      /* عرض ظرف پایدار: والدِ لایهٔ نوت (نه والد fit-content که به اندازهٔ خود کنوس وابسته است) */
      const layer = canvas.closest('[data-note-layer]') as HTMLElement | null
      const holder = (layer?.parentElement ?? canvas.parentElement) as HTMLElement | null
      const wrapW = holder?.clientWidth || 800
      const avail = Math.max(280, wrapW - 2)
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      const img = await renderPdfPageToBitmap(doc, page - 1, avail * zoom * dpr)
      if (cancelled) return
      if (!drawBitmapOnCanvas(canvas, img)) throw new Error('no-2d-context')
      const cssW = Math.max(1, Math.round(img.width / dpr))
      const cssH = Math.max(1, Math.round(img.height / dpr))
      canvas.style.width = `${cssW}px`
      canvas.style.height = `${cssH}px`
      setReady(true)
    })().catch((e: unknown) => {
      if (cancelled) return
      const err = e as { name?: string; message?: string }
      console.error('pdf page render failed', err?.name, err?.message)
      setFailed(true)
    })

    return () => {
      cancelled = true
    }
  }, [doc, page, zoom, tick])

  return (
    <div className="relative mx-auto" style={{ width: 'fit-content' }}>
      {!ready && !failed && (
        <div className="absolute inset-0 grid place-items-center text-[12px]" style={{ color: '#94a3b8' }}>
          ⏳
        </div>
      )}
      {failed && (
        <div className="py-16 text-center text-[13px]" style={{ color: '#64748b' }}>
          این صفحه قابل نمایش نیست.
        </div>
      )}
      <canvas
        ref={canvasRef}
        className="block rounded-lg"
        style={{ boxShadow: '0 10px 30px rgba(15,23,42,0.18)', background: '#fff', maxWidth: '100%' }}
      />
    </div>
  )
}

/* ---------- نوت چسبان ---------- */

function StickyNoteCard({
  note,
  editing,
  onEdit,
  onChange,
  onPersist,
  onDelete,
}: {
  note: StickyNote
  editing: boolean
  onEdit: () => void
  onChange: (patch: Partial<StickyNote>) => void
  onPersist: (patch?: Partial<StickyNote>) => void
  onDelete: () => void
}) {
  const { t } = useTranslation()
  const cardRef = useRef<HTMLDivElement | null>(null)

  function startDrag(e: ReactPointerEvent<HTMLDivElement>) {
    e.preventDefault()
    e.stopPropagation()
    const card = cardRef.current
    const layer = card?.closest('[data-note-layer]') as HTMLElement | null
    if (!card || !layer) return

    const layerRect = layer.getBoundingClientRect()
    const cardRect = card.getBoundingClientRect()
    const maxX = Math.max(0, 100 - (cardRect.width / layerRect.width) * 100)
    const maxY = Math.max(0, 100 - (cardRect.height / layerRect.height) * 100)

    const sx = e.clientX
    const sy = e.clientY
    const ox = note.x
    const oy = note.y
    let last = { x: ox, y: oy }

    const move = (ev: PointerEvent) => {
      ev.preventDefault()
      const nx = clamp(ox + ((ev.clientX - sx) / layerRect.width) * 100, 0, maxX)
      const ny = clamp(oy + ((ev.clientY - sy) / layerRect.height) * 100, 0, maxY)
      last = { x: nx, y: ny }
      onChange(last)
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      onPersist(last)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
  }

  return (
    <div
      ref={cardRef}
      className="absolute w-[190px] rounded-lg text-[11.5px]"
      style={{
        top: `${note.y}%`,
        left: `${note.x}%`,
        background: note.color,
        color: '#3f2d1d',
        boxShadow: '0 10px 22px rgba(15,23,42,0.22)',
        transform: 'rotate(-1.2deg)',
        border: '1px solid rgba(0,0,0,0.08)',
        zIndex: 5,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div
        className="flex items-center justify-between px-2 py-1.5 cursor-grab active:cursor-grabbing select-none rounded-t-lg"
        style={{ background: 'rgba(0,0,0,0.06)', touchAction: 'none' }}
        onPointerDown={startDrag}
        onDoubleClick={onEdit}
        title={t('reading.noteDragHint')}
      >
        <span className="text-[10px] opacity-70">📌</span>
        <div className="flex items-center gap-1">
          <button
            className="text-[10px] opacity-70 hover:opacity-100"
            onClick={(e) => {
              e.stopPropagation()
              const i = NOTE_COLORS.indexOf(note.color)
              onChange({ color: NOTE_COLORS[(i + 1) % NOTE_COLORS.length]! })
              onPersist({ color: NOTE_COLORS[(i + 1) % NOTE_COLORS.length]! })
            }}
            title="color"
          >
            ●
          </button>
          <button
            className="text-[10px] opacity-70 hover:opacity-100"
            onClick={(e) => {
              e.stopPropagation()
              onDelete()
            }}
            title={t('reading.deleteNote')}
          >
            ✕
          </button>
        </div>
      </div>
      <textarea
        className="w-full bg-transparent resize-none outline-none px-2 py-1.5 leading-5"
        rows={4}
        value={note.text}
        placeholder={t('reading.notePlaceholder')}
        onFocus={onEdit}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => onChange({ text: e.target.value })}
        onBlur={() => onPersist()}
        style={{ color: '#3f2d1d' }}
      />
      {editing && <div className="px-2 pb-1 text-[9px] opacity-50">{t('reading.noteHint')}</div>}
    </div>
  )
}

/* ---------- آمار امروز همان کتاب ---------- */

function useTodayStats(bookId: number | undefined) {
  return useLiveQuery(
    async () => {
      if (bookId == null) return { minutes: 0, pages: 0 }
      const rows = await db.bookSessions.where('bookId').equals(bookId).toArray()
      const td = todayJalali()
      const today = rows.filter((r) => r.date === td)
      return { minutes: today.reduce((s, r) => s + r.minutes, 0), pages: today.reduce((s, r) => s + r.pages, 0) }
    },
    [bookId],
    { minutes: 0, pages: 0 },
  )
}