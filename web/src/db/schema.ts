import Dexie, { type EntityTable, type Table } from 'dexie'

/* ============================================================
   مدل‌های داده — اپ «بُنا»
   همه مبالغ به «تومان» ذخیره می‌شن (عدد صحیح).
   تاریخ‌ها به شکل رشته شمسی 'YYYY-MM-DD' ذخیره می‌شن،
   مثال: ۱۷ مهر ۱۴۰۴  →  '1404-07-17'
   ============================================================ */

/** فضای کاری: بالاترین سطح سازمان‌دهی (کاری، شخصی، یادگیری…) */
export interface Space {
  id?: number
  name: string
  color: string
  order: number
}

export type ProjectStatus = 'active' | 'waiting' | 'paused' | 'done'

/** پروژه — شامل پروژه‌های ساختمانی با قرارداد و مالی */
export interface Project {
  id?: number
  spaceId: number
  name: string
  client?: string
  address?: string
  status: ProjectStatus
  /** مبلغ کل قرارداد (تومان) */
  contractAmount: number
  /** دریافتی از کارفرما تاکنون (تومان) */
  received: number
  /** درصد پیشرفت فیزیکی ۰..۱۰۰ */
  progress: number
  startDate?: string // شمسی
  endDate?: string // شمسی
  createdAt: number
}

export type TaskStatus = 'todo' | 'doing' | 'waiting' | 'done'
export type Priority = 0 | 1 | 2 | 3 // P0..P3

/** تسک — درختی (parentId برای زیرتسک) */
export interface Task {
  id?: number
  title: string
  notes?: string
  projectId?: number | null
  parentId?: number | null
  status: TaskStatus
  priority: Priority
  dueDate?: string | null // شمسی
  tags: string[]
  order: number
  completedAt?: number | null
  createdAt: number
}

/** کارگر/نیروی پروژه — حقوق روزانه موقع ثبت درج می‌شه */
export interface Worker {
  id?: number
  name: string
  /** شغل: بنا، کارگر، سرکارگر، جوشکار… */
  role: string
  /** حقوق روزانه (تومان) — مبنای محاسبه هفتگی */
  dailyWage: number
  phone?: string
  projectId?: number | null
  active: boolean
  /** عکس پروفایل (dataURL فشرده) */
  photo?: string
  /** true یعنی این رکورد خودِ کاربره (بنّای اصلی) */
  isSelf?: boolean
  /** تعداد روزهای کارکرد قبلی (قبل از ثبت در برنامه) — برای نیروهای قدیمی */
  legacyDays?: number
  /** مجموع دریافتی قبلی (تومان) — برای نیروهای قدیمی */
  legacyPaid?: number
  createdAt: number
}

/** کارکرد روزانه یک نفر — تیک روز در تقویم شمسی */
export interface Attendance {
  id?: number
  workerId: number
  /** تاریخ شمسی 'YYYY-MM-DD' */
  date: string
  /** ساعت کارکرد در آن روز (مثلاً ۸ یا ۹٫۵) */
  hours: number
  projectId?: number | null
  createdAt: number
}

/** پرداختی من به کارگر */
export interface Payment {
  id?: number
  workerId: number
  amount: number // تومان
  /** تاریخ شمسی */
  date: string
  projectId?: number | null
  note?: string
  createdAt: number
}

/** رکورد مالی پروژه — دریافتی یا هزینه */
export interface FinanceEntry {
  id?: number
  projectId: number
  /** دریافتی از کارفرما یا هزینه پروژه */
  type: 'income' | 'expense'
  /** دسته: پیش‌پرداخت، دستمزد، مصالح، ماشین‌آلات… */
  category: string
  amount: number // تومان
  /** تاریخ شمسی */
  date: string
  description?: string
  createdAt: number
}

/** مرحله اجرا در تایم‌لاین پروژه (فونداسیون، اسکلت…) */
export interface Stage {
  id?: number
  projectId: number
  title: string
  description?: string
  /** درصد پیشرفت همین مرحله ۰..۱۰۰ */
  progress: number
  status: 'pending' | 'active' | 'done'
  startDate?: string // شمسی
  endDate?: string // شمسی
  /** هزینه پیش‌بینی‌شده این مرحله (تومان) */
  estimatedCost?: number
  order: number
}

/** قلم نرخ‌نامه پروژه — نرخ واحد هر کار (سرامیک، گچ…) */
export type RateUnit = 'm2' | 'm' | 'item' | 'day' | 'hour' | 'kg' | 'lump'
export type Currency = 'toman' | 'dollar'

export interface RateItem {
  id?: number
  projectId: number
  title: string
  unit: RateUnit
  /** نرخ واحد */
  price: number
  currency: Currency
  order: number
  createdAt: number
}

/** ثبت متراژ انجام‌شده برای یک قلم نرخ‌نامه */
export interface Measurement {
  id?: number
  rateId: number
  projectId: number
  /** مقدار انجام‌شده به واحد قلم */
  qty: number
  /** تاریخ شمسی */
  date: string
  /** عنوان قسمت ساختمان — برای اتصال به عکس‌های همان قسمت */
  zone?: string
  note?: string
  createdAt: number
}

/** هدف بزرگ — مهاجرت، ماشین، پس‌انداز… یا عادت (کتاب، ورزش) */
export interface Goal {
  id?: number
  title: string
  /** ایموجی نمایشی */
  icon: string
  /** نوع هدف: پولی یا تعدادی (کتاب/ورزش/…) */
  kind?: 'money' | 'count'
  /** واحد شمارش برای kind=count مثلا: کتاب، جلسه، کیلومتر */
  unit?: string
  /** سقف تعدادی برای kind=count */
  targetNumber?: number
  /** پیشرفت تعدادی فعلی */
  currentNumber?: number
  /** مبلغ هدف (تومان) */
  targetAmount: number
  /** مبلغ ذخیره‌شده تاکنون (تومان) — دستی */
  savedAmount: number
  /** مبلغی که ماهانه کنار گذاشته می‌شه (تومان) */
  monthlyCommit: number
  /** موعد شمسی 'YYYY-MM-DD' */
  deadline: string
  note?: string
  order: number
  createdAt: number
}

/** کار لازم برای رسیدن به هدف */
export interface GoalItem {
  id?: number
  goalId: number
  title: string
  done: boolean
  /** موعد شمسی */
  dueDate?: string
  order: number
  createdAt: number
}

/** عادت یادگیری/تمرکز — زبان، کتاب، پومودورو… */
export interface Habit {
  id?: number
  title: string
  icon: string
  /** واحد اندازه‌گیری: دقیقه یا تعداد (صفحه/جلسه) */
  unit: 'min' | 'count'
  /** هدف روزانه (دقیقه یا تعداد) */
  dailyGoal: number
  color: string
  createdAt: number
}

/** ثبت انجام عادت در یک روز */
export interface HabitLog {
  id?: number
  habitId: number
  /** تاریخ شمسی 'YYYY-MM-DD' */
  date: string
  /** مقدار انجام‌شده (دقیقه یا تعداد) */
  amount: number
  note?: string
  createdAt: number
}

/** وضعیت کتاب در قفسه کتاب‌خوانی */
export type BookStatus = 'reading' | 'finished' | 'paused'

/** قالب فایل کتاب */
export type BookFormat = 'pdf' | 'docx' | 'pptx' | 'txt'

/** یادداشت چسبان (استیکی) روی صفحه کتاب — فقط داخل اپ */
export interface StickyNote {
  id: string
  /** شماره صفحه؛ 0 = صفحه معرفی */
  page: number
  /** موقعیت افقی به درصد (0..100) */
  x: number
  /** موقعیت عمودی به درصد (0..100) */
  y: number
  text: string
  color: string
  createdAt: number
}

/** کتاب آفلاین کاربر — فایل اصلی داخل برنامه ذخیره می‌شه (بدون اینترنت) */
export interface Book {
  id?: number
  title: string
  author: string
  format: BookFormat
  /** نام و حجم فایل مبدأ */
  fileName?: string
  fileSize?: number
  /** فایل اصلی کتاب (PDF/DOCX/PPTX/TXT) — آفلاین در IndexedDB */
  fileBlob?: Blob
  /** جلد: تصویر dataURL (صفحه اول PDF یا انتخاب کاربر) */
  cover?: string
  /** رنگ جلد (برای کتاب‌های بدون تصویر) */
  color: string
  /** توضیحات / پاورقی — صفحه معرفی کتاب */
  description?: string
  /** ستاره‌دار = بالای قفسه */
  starred?: boolean
  /** تعداد کل صفحات (PDF: تعداد صفحه، بقیه: صفحه‌بندی متن) */
  totalPages: number
  /** آخرین صفحه‌ای که کاربر در آن بوده */
  currentPage: number
  status: BookStatus
  /** یادداشت‌های چسبان */
  notes: StickyNote[]
  /** متن استخراج‌شده از docx/pptx/txt */
  content?: string
  createdAt: number
  updatedAt: number
}

/** یک جلسه مطالعه روی یک کتاب */
export interface BookSession {
  id?: number
  bookId: number
  /** تاریخ شمسی 'YYYY-MM-DD' */
  date: string
  /** مدت مطالعه (دقیقه) */
  minutes: number
  /** تعداد صفحات خوانده‌شده در این جلسه */
  pages: number
  note?: string
  createdAt: number
}

/** تراکنش شخصی — دریافتی/پرداختی/سرمایه‌گذاری/برداشت از سرمایه */
export interface Transaction {
  id?: number
  type: 'income' | 'expense' | 'invest' | 'withdraw'
  category: string
  amount: number // تومان
  /** تاریخ شمسی */
  date: string
  note?: string
  createdAt: number
}

/** دارایی سرمایه‌گذاری — طلا، دلار، سهام… */
export interface Asset {
  id?: number
  /** مثلا: طلای ۱۸ عیار، دلار، سهام */
  kind: 'gold' | 'usd' | 'eur' | 'stock' | 'other'
  title: string
  /** مقدار (گرم، دلار، تعداد سهم…) */
  qty: number
  /** قیمت خرید هر واحد (تومان) */
  buyPrice: number
  /** تاریخ خرید شمسی */
  buyDate: string
  /** ارزش دستی هر واحد — برای سهام و سایر (وقتی قیمت زنده نیست) */
  currentPrice?: number
  note?: string
  /** شناسه تراکنش سرمایه‌گذاری متناظر (برای حذف هم‌زمان) */
  txId?: number
  createdAt: number
}

/** کش قیمت روز بازار */
export interface PriceCache {
  id?: string // نماد: USD, EUR, GOLD_G, GOLD_Q
  price: number
  changePct?: number
  updatedAt: number
  manual?: boolean
}

/** عکس‌های پروژه — قبل/حین/اتمام/قرارداد */
export interface ProjectPhoto {
  id?: number
  projectId: number
  category: 'before' | 'during' | 'after' | 'contract'
  /** عنوان قسمت ساختمان: سرویس بهداشتی، راهرو… */
  zone?: string
  /** متراژ آن قسمت از ساختمان (مترمربع) */
  area?: number
  /** داده تصویر به‌صورت پایه۶۴ (فشرده‌شده) */
  dataUrl: string
  caption?: string
  date: string // شمسی
  createdAt: number
}

/** گزارش متنی کار یک روز — «امروز چه کاری انجام شد» */
export interface DayLog {
  id?: number
  /** تاریخ شمسی 'YYYY-MM-DD' */
  date: string
  /** شناسه پروژه؛ 0 یعنی بدون پروژه */
  projectId: number
  /** مرحله اجرا (اختیاری) */
  stageId?: number
  text: string
  createdAt: number
}

/** روز تمرین در باشگاه — تیک حضور در تقویم */
export interface WorkoutDay {
  id?: number
  /** تاریخ شمسی 'YYYY-MM-DD' */
  date: string
  /** عنوان تمرین (مثلاً سینه، پا، شنا…) */
  title: string
  /** مدت تمرین (دقیقه) */
  duration: number
  /** توضیح تمرین */
  note?: string
  createdAt: number
}

/** برنامه تمرینی هفتگی — چند روز در هفته و چه عضله‌ای */
export interface WorkoutPlan {
  id?: number
  /** تعداد روزهای تمرین در هفته */
  daysPerWeek: number
  /** عنوان تمرین هر روز — مثلاً ['سینه + جلو بازو', 'پا + شکم'] */
  schedule: string[]
  /** روزهای هفته تمرین (۰=شنبه … ۶=جمعه) — هم‌اندازه schedule */
  weekdays: number[]
  /** تاریخ شمسی شروع */
  startDate: string
  createdAt: number
}

/** اندازه‌گیری بدن — وزن، قد، دور شکم… */
export interface BodyMetric {
  id?: number
  /** تاریخ شمسی */
  date: string
  /** وزن (کیلوگرم) */
  weight?: number
  /** قد (سانتی‌متر) */
  height?: number
  /** دور شکم (سانتی‌متر) */
  waist?: number
  /** دور بازو (سانتی‌متر) */
  arm?: number
  /** دور ران (سانتی‌متر) */
  thigh?: number
  /** درصد چربی بدن */
  bodyFat?: number
  note?: string
  createdAt: number
}

/** عکس پیشرفت بدن — قبل/حین/بعد */
export interface ProgressPhoto {
  id?: number
  /** تاریخ شمسی */
  date: string
  /** دسته: جلو، کنار، پشت */
  pose: 'front' | 'side' | 'back'
  /** داده تصویر (فشرده) */
  dataUrl: string
  caption?: string
  createdAt: number
}

/** نسخهٔ پشتیبان خودکار داخل برنامه — فقط در نسخهٔ وب/بدون پوشه */
export interface AutoBackup {
  id?: number
  /** زمان ساخت (timestamp) */
  at: number
  /** محتوای کامل JSON خروجی */
  json: string
}

/** پایگاه داده محلی (IndexedDB) */
export class BanaDB extends Dexie {
  spaces!: EntityTable<Space, 'id'>
  projects!: EntityTable<Project, 'id'>
  tasks!: EntityTable<Task, 'id'>
  workers!: EntityTable<Worker, 'id'>
  attendances!: EntityTable<Attendance, 'id'>
  payments!: EntityTable<Payment, 'id'>
  financeEntries!: EntityTable<FinanceEntry, 'id'>
  stages!: EntityTable<Stage, 'id'>
  projectPhotos!: EntityTable<ProjectPhoto, 'id'>
  dayLogs!: EntityTable<DayLog, 'id'>
  rateItems!: EntityTable<RateItem, 'id'>
  measurements!: EntityTable<Measurement, 'id'>
  transactions!: EntityTable<Transaction, 'id'>
  assets!: EntityTable<Asset, 'id'>
  prices!: EntityTable<PriceCache, 'id'>
  goals!: EntityTable<Goal, 'id'>
  goalItems!: EntityTable<GoalItem, 'id'>
  habits!: EntityTable<Habit, 'id'>
  habitLogs!: EntityTable<HabitLog, 'id'>
  workoutDays!: EntityTable<WorkoutDay, 'id'>
  bodyMetrics!: EntityTable<BodyMetric, 'id'>
  progressPhotos!: EntityTable<ProgressPhoto, 'id'>
  workoutPlans!: EntityTable<WorkoutPlan, 'id'>
  books!: EntityTable<Book, 'id'>
  bookSessions!: EntityTable<BookSession, 'id'>
  autoBackups!: EntityTable<AutoBackup, 'id'>

  constructor() {
    super('sazora-db')
    this.version(1).stores({
      spaces: '++id, name, order',
      projects: '++id, spaceId, status, createdAt',
      tasks: '++id, projectId, parentId, status, dueDate, order',
      workers: '++id, name, projectId',
      attendances: '++id, workerId, date, [workerId+date], projectId',
      payments: '++id, workerId, date, projectId',
    })
    this.version(2).stores({
      financeEntries: '++id, projectId, type, date, category',
      stages: '++id, projectId, status, order',
      projectPhotos: '++id, projectId, category, date',
    })
    this.version(3).stores({
      dayLogs: '++id, [date+projectId]',
    })
    this.version(4).stores({
      rateItems: '++id, projectId, order',
      measurements: '++id, rateId, projectId, date',
    })
    this.version(5).stores({
      transactions: '++id, type, date, category',
      assets: '++id, kind, buyDate',
      prices: 'id',
    })
    this.version(6).stores({
      tasks: '++id, projectId, parentId, status, dueDate, order, createdAt',
      transactions: '++id, type, date, category, createdAt',
      assets: '++id, kind, buyDate, createdAt',
    })
    this.version(7).stores({
      goals: '++id, order',
      goalItems: '++id, goalId, order',
    })
    this.version(8).stores({
      habits: '++id, createdAt',
      habitLogs: '++id, habitId, date',
    })
    this.version(9).stores({
      goals: '++id, order',
    })
    this.version(10).stores({
      workers: '++id, name, projectId',
      habits: '++id, createdAt, title',
      habitLogs: '++id, habitId, date, [habitId+date]',
    })
    this.version(11).stores({
      workoutDays: '++id, date',
      bodyMetrics: '++id, date',
      progressPhotos: '++id, date, pose',
    })
    this.version(12).stores({
      workoutPlans: '++id, startDate',
    })
    this.version(13).stores({
      books: '++id, status, createdAt',
      bookSessions: '++id, bookId, date, [bookId+date]',
    })
    this.version(14).stores({
      books: '++id, status, createdAt, starred, format',
      bookSessions: '++id, bookId, date, [bookId+date]',
    })
    this.version(15).stores({
      autoBackups: '++id, at',
    })
  }
}

export const db = new BanaDB()

/** پاک‌سازی کامل همه داده‌ها — بدون ساخت نمونه. دسته‌ها و بودجه‌های محلی هم پاک می‌شن. */
export async function wipeAll() {
  await db.transaction(
    'rw',
    [
      db.spaces,
      db.projects,
      db.tasks,
      db.workers,
      db.attendances,
      db.payments,
      db.financeEntries,
      db.stages,
      db.projectPhotos,
      db.dayLogs,
      db.rateItems,
      db.measurements,
      db.transactions,
      db.assets,
      db.prices,
      db.goals,
      db.goalItems,
      db.habits,
      db.habitLogs,
      db.workoutDays,
      db.bodyMetrics,
      db.progressPhotos,
      db.workoutPlans,
      db.books,
      db.bookSessions,
      db.autoBackups,
    ],
    async () => {
      await Promise.all([
        db.spaces.clear(),
        db.projects.clear(),
        db.tasks.clear(),
        db.workers.clear(),
        db.attendances.clear(),
        db.payments.clear(),
        db.financeEntries.clear(),
        db.stages.clear(),
        db.projectPhotos.clear(),
        db.dayLogs.clear(),
        db.rateItems.clear(),
        db.measurements.clear(),
        db.transactions.clear(),
        db.assets.clear(),
        db.prices.clear(),
        db.goals.clear(),
        db.goalItems.clear(),
        db.habits.clear(),
        db.habitLogs.clear(),
        db.workoutDays.clear(),
        db.bodyMetrics.clear(),
        db.progressPhotos.clear(),
        db.workoutPlans.clear(),
        db.books.clear(),
        db.bookSessions.clear(),
        db.autoBackups.clear(),
      ])
    },
  )
  try {
    for (const k of Object.keys(localStorage)) {
      if (k.startsWith('sazora')) localStorage.removeItem(k)
    }
  } catch {
    /* ignore */
  }
}

/** خروجی کامل داده‌ها برای بکاپ JSON */
export async function exportAll() {
  const [spaces, projects, tasks, workers, attendances, payments, financeEntries, stages, projectPhotos, dayLogs, rateItems, measurements, transactions, assets, prices, goals, goalItems, habits, habitLogs, workoutDays, bodyMetrics, progressPhotos, workoutPlans, books, bookSessions] = await Promise.all([
    db.spaces.toArray(),
    db.projects.toArray(),
    db.tasks.toArray(),
    db.workers.toArray(),
    db.attendances.toArray(),
    db.payments.toArray(),
    db.financeEntries.toArray(),
    db.stages.toArray(),
    db.projectPhotos.toArray(),
    db.dayLogs.toArray(),
    db.rateItems.toArray(),
    db.measurements.toArray(),
    db.transactions.toArray(),
    db.assets.toArray(),
    db.prices.toArray(),
    db.goals.toArray(),
    db.goalItems.toArray(),
    db.habits.toArray(),
    db.habitLogs.toArray(),
    db.workoutDays.toArray(),
    db.bodyMetrics.toArray(),
    db.progressPhotos.toArray(),
    db.workoutPlans.toArray(),
    db.books.toArray(),
    db.bookSessions.toArray(),
  ])
  // فایل و جلد کتاب‌ها (Blob/dataURL) در بکاپ JSON نمی‌آیند تا فایل سبک بماند
  const booksSafe = books.map(({ fileBlob: _b, cover: _c, ...rest }) => rest)
  return {
    app: 'sazora',
    version: 14,
    exportedAt: new Date().toISOString(),
    data: { spaces, projects, tasks, workers, attendances, payments, financeEntries, stages, projectPhotos, dayLogs, rateItems, measurements, transactions, assets, prices, goals, goalItems, habits, habitLogs, workoutDays, bodyMetrics, progressPhotos, workoutPlans, books: booksSafe, bookSessions },
  }
}

/**
 * بازیابی از فایل بکاپ — از طریق همان مسیر «اعمال» (apply) استفاده می‌شود که
 * فرآیند آپدیت (نصب از فایل) برای داده‌های جدید در نظر گرفته:
 *  - داده‌های فعلی پاک نمی‌شوند و جایگزین نمی‌شوند.
 *  - رکوردهای موجود با همین شناسه (id) جایگزین می‌شوند و رکوردهای جدید اضافه می‌شوند.
 *  - حتی اگر تاریخ رکورد فایل بکاپ قدیمی‌تر از دادهٔ فعلی باشد، مقدار فایل اعمال می‌شود.
 */
export async function importAll(payload: unknown): Promise<MergeStats> {
  return mergeAll(payload)
}

/* ============================================================
   ادغام بکاپ (Merge)
   رکوردهای فایل با داده‌های موجود ترکیب می‌شوند:
   - رکورد هم‌شناسه ← با نسخهٔ فایل به‌روز می‌شود (حتی اگر تاریخش قدیمی‌تر باشد)
   - رکورد جدید ← اضافه می‌شود
   هیچ دادهٔ موجودی حذف نمی‌شود.
   ============================================================ */

interface IdRow {
  id?: number | string
}

export interface MergeStats {
  added: number
  updated: number
  tables: Record<string, { added: number; updated: number }>
}

/** همهٔ جدول‌های دیتابیس — برای بکاپ/بازیابی */
const ALL_TABLES = [
  db.spaces,
  db.projects,
  db.tasks,
  db.workers,
  db.attendances,
  db.payments,
  db.financeEntries,
  db.stages,
  db.projectPhotos,
  db.dayLogs,
  db.rateItems,
  db.measurements,
  db.transactions,
  db.assets,
  db.prices,
  db.goals,
  db.goalItems,
  db.habits,
  db.habitLogs,
  db.workoutDays,
  db.bodyMetrics,
  db.progressPhotos,
  db.workoutPlans,
  db.books,
  db.bookSessions,
]

async function mergeTable(
  table: Table<IdRow, number>,
  rows: unknown[] | undefined,
): Promise<{ added: number; updated: number }> {
  if (!Array.isArray(rows) || rows.length === 0) return { added: 0, updated: 0 }
  const clean = rows.filter((r): r is IdRow => !!r && typeof r === 'object' && !Array.isArray(r))
  if (clean.length === 0) return { added: 0, updated: 0 }
  const existing = new Set<number | string>(
    (await table.toCollection().primaryKeys()) as unknown as Array<number | string>,
  )
  let added = 0
  let updated = 0
  for (const r of clean) {
    if ((typeof r.id === 'number' || typeof r.id === 'string') && existing.has(r.id)) updated++
    else added++
  }
  // bulkPut: هم رکوردهای موجود را جایگزین می‌کند و هم رکوردهای تازه را اضافه می‌کند
  await table.bulkPut(clean)
  return { added, updated }
}

/** ادغام بکاپ با داده‌های فعلی — بدون پاک‌کردن چیزی */
export async function mergeAll(payload: unknown): Promise<MergeStats> {
  const p = payload as { app?: string; data?: Record<string, unknown[]> }
  if (!p || p.app !== 'sazora' || !p.data) throw new Error('invalid-backup')
  const d = p.data
  const stats: MergeStats = { added: 0, updated: 0, tables: {} }

  const pairs: Array<[string, Table<IdRow, number>, unknown[] | undefined]> = [
    ['spaces', db.spaces as unknown as Table<IdRow, number>, d.spaces],
    ['projects', db.projects as unknown as Table<IdRow, number>, d.projects],
    ['tasks', db.tasks as unknown as Table<IdRow, number>, d.tasks],
    ['workers', db.workers as unknown as Table<IdRow, number>, d.workers],
    ['attendances', db.attendances as unknown as Table<IdRow, number>, d.attendances],
    ['payments', db.payments as unknown as Table<IdRow, number>, d.payments],
    ['financeEntries', db.financeEntries as unknown as Table<IdRow, number>, d.financeEntries],
    ['stages', db.stages as unknown as Table<IdRow, number>, d.stages],
    ['projectPhotos', db.projectPhotos as unknown as Table<IdRow, number>, d.projectPhotos],
    ['dayLogs', db.dayLogs as unknown as Table<IdRow, number>, d.dayLogs],
    ['rateItems', db.rateItems as unknown as Table<IdRow, number>, d.rateItems],
    ['measurements', db.measurements as unknown as Table<IdRow, number>, d.measurements],
    ['transactions', db.transactions as unknown as Table<IdRow, number>, d.transactions],
    ['assets', db.assets as unknown as Table<IdRow, number>, d.assets],
    ['prices', db.prices as unknown as Table<IdRow, number>, d.prices],
    ['goals', db.goals as unknown as Table<IdRow, number>, d.goals],
    ['goalItems', db.goalItems as unknown as Table<IdRow, number>, d.goalItems],
    ['habits', db.habits as unknown as Table<IdRow, number>, d.habits],
    ['habitLogs', db.habitLogs as unknown as Table<IdRow, number>, d.habitLogs],
    ['workoutDays', db.workoutDays as unknown as Table<IdRow, number>, d.workoutDays],
    ['bodyMetrics', db.bodyMetrics as unknown as Table<IdRow, number>, d.bodyMetrics],
    ['progressPhotos', db.progressPhotos as unknown as Table<IdRow, number>, d.progressPhotos],
    ['workoutPlans', db.workoutPlans as unknown as Table<IdRow, number>, d.workoutPlans],
    ['books', db.books as unknown as Table<IdRow, number>, d.books],
    ['bookSessions', db.bookSessions as unknown as Table<IdRow, number>, d.bookSessions],
  ]

  await db.transaction('rw', ALL_TABLES as unknown as Table[], async () => {
    for (const [name, table, rows] of pairs) {
      const r = await mergeTable(table, rows)
      stats.tables[name] = r
      stats.added += r.added
      stats.updated += r.updated
    }
  })
  return stats
}

/** جایگزینی کامل — پاک‌سازی و نوشتن بکاپ (رفتار قدیمی) */
export async function replaceAll(payload: unknown) {
  const p = payload as { app?: string; data?: Record<string, unknown[]> }
  if (!p || p.app !== 'sazora' || !p.data) throw new Error('invalid-backup')
  const data = p.data
  await db.transaction(
    'rw',
    [
      db.spaces,
      db.projects,
      db.tasks,
      db.workers,
      db.attendances,
      db.payments,
      db.financeEntries,
      db.stages,
      db.projectPhotos,
      db.dayLogs,
      db.rateItems,
      db.measurements,
      db.transactions,
      db.assets,
      db.prices,
      db.goals,
      db.goalItems,
      db.habits,
      db.habitLogs,
      db.workoutDays,
      db.bodyMetrics,
      db.progressPhotos,
      db.workoutPlans,
      db.books,
      db.bookSessions,
      db.autoBackups,
    ],
    async () => {
      await Promise.all([
        db.spaces.clear(),
        db.projects.clear(),
        db.tasks.clear(),
        db.workers.clear(),
        db.attendances.clear(),
        db.payments.clear(),
        db.financeEntries.clear(),
        db.stages.clear(),
        db.projectPhotos.clear(),
        db.dayLogs.clear(),
        db.rateItems.clear(),
        db.measurements.clear(),
        db.transactions.clear(),
        db.assets.clear(),
        db.prices.clear(),
        db.goals.clear(),
        db.goalItems.clear(),
        db.habits.clear(),
        db.habitLogs.clear(),
        db.workoutDays.clear(),
        db.bodyMetrics.clear(),
        db.progressPhotos.clear(),
        db.workoutPlans.clear(),
        db.books.clear(),
        db.bookSessions.clear(),
        db.autoBackups.clear(),
      ])
      if (data.spaces?.length) await db.spaces.bulkAdd(data.spaces as Space[])
      if (data.projects?.length) await db.projects.bulkAdd(data.projects as Project[])
      if (data.tasks?.length) await db.tasks.bulkAdd(data.tasks as Task[])
      if (data.workers?.length) await db.workers.bulkAdd(data.workers as Worker[])
      if (data.attendances?.length)
        await db.attendances.bulkAdd(data.attendances as Attendance[])
      if (data.payments?.length) await db.payments.bulkAdd(data.payments as Payment[])
      if (data.financeEntries?.length)
        await db.financeEntries.bulkAdd(data.financeEntries as FinanceEntry[])
      if (data.stages?.length) await db.stages.bulkAdd(data.stages as Stage[])
      if (data.projectPhotos?.length)
        await db.projectPhotos.bulkAdd(data.projectPhotos as ProjectPhoto[])
      if (data.dayLogs?.length) await db.dayLogs.bulkAdd(data.dayLogs as DayLog[])
      if (data.rateItems?.length) await db.rateItems.bulkAdd(data.rateItems as RateItem[])
      if (data.measurements?.length)
        await db.measurements.bulkAdd(data.measurements as Measurement[])
      if (data.transactions?.length)
        await db.transactions.bulkAdd(data.transactions as Transaction[])
      if (data.assets?.length) await db.assets.bulkAdd(data.assets as Asset[])
      if (data.prices?.length) await db.prices.bulkAdd(data.prices as PriceCache[])
      if (data.goals?.length) await db.goals.bulkAdd(data.goals as Goal[])
      if (data.goalItems?.length) await db.goalItems.bulkAdd(data.goalItems as GoalItem[])
      if (data.habits?.length) await db.habits.bulkAdd(data.habits as Habit[])
      if (data.habitLogs?.length) await db.habitLogs.bulkAdd(data.habitLogs as HabitLog[])
      if (data.workoutDays?.length) await db.workoutDays.bulkAdd(data.workoutDays as WorkoutDay[])
      if (data.bodyMetrics?.length) await db.bodyMetrics.bulkAdd(data.bodyMetrics as BodyMetric[])
      if (data.progressPhotos?.length) await db.progressPhotos.bulkAdd(data.progressPhotos as ProgressPhoto[])
      if (data.workoutPlans?.length) await db.workoutPlans.bulkAdd(data.workoutPlans as WorkoutPlan[])
      if (data.books?.length) await db.books.bulkAdd(data.books as Book[])
      if (data.bookSessions?.length) await db.bookSessions.bulkAdd(data.bookSessions as BookSession[])
    },
  )
}
