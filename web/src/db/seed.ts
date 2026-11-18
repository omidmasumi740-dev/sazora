import { db, type Space, type Project, type Task, type Worker, type Attendance, type Payment, type FinanceEntry, type Stage, type DayLog, type RateItem, type Measurement } from './schema'
import { addDays, addMonths, startOfMonth, todayJalali, startOfWeek } from '../lib/jalali'

/** آیا دیتابیس خالیه؟ */
export async function isEmpty(): Promise<boolean> {
  const n = await db.spaces.count()
  return n === 0
}

/**
 * داده نمونه — پروژه ساختمانی واقعی‌نما + نیروها + کارکرد چند روز اخیر
 * فقط وقتی دیتابیس خالیه اجرا می‌شه
 */
export async function seed(): Promise<void> {
  const now = Date.now()
  const t = todayJalali()

  /* ---------- فضاها ---------- */
  const spaces: Space[] = [
    { name: 'کاری', color: '#059669', order: 1 },
    { name: 'شخصی', color: '#0ea5e9', order: 2 },
    { name: 'یادگیری', color: '#f59e0b', order: 3 },
  ]
  const spaceIds = await db.spaces.bulkAdd(spaces, { allKeys: true })

  /* ---------- پروژه‌ها ---------- */
  const projects: Project[] = [
    {
      spaceId: spaceIds[0]!,
      name: 'بازسازی ساختمان اداری مهرآباد',
      client: 'شرکت عمران آپادانا',
      address: 'تهران، خیابان ستارخان',
      status: 'active',
      contractAmount: 4_850_000_000,
      received: 2_900_000_000,
      progress: 62,
      startDate: '1404-04-15',
      endDate: '1404-08-30',
      createdAt: now,
    },
    {
      spaceId: spaceIds[0]!,
      name: 'ساخت ویلای دوطبقه لواسان',
      client: 'آقای رضایی',
      address: 'لواسان، جاده امامزاده',
      status: 'waiting',
      contractAmount: 8_200_000_000,
      received: 2_400_000_000,
      progress: 28,
      startDate: '1404-05-01',
      endDate: '1405-02-15',
      createdAt: now,
    },
    {
      spaceId: spaceIds[0]!,
      name: 'نماکاری برج مسکونی گلشهر',
      client: 'تعاونی مسکن گلشهر',
      address: 'کرج، گلشهر',
      status: 'done',
      contractAmount: 3_100_000_000,
      received: 3_100_000_000,
      progress: 100,
      startDate: '1404-01-10',
      endDate: '1404-07-12',
      createdAt: now,
    },
  ]
  const projectIds = await db.projects.bulkAdd(projects, { allKeys: true })
  const p1 = projectIds[0]!
  const p2 = projectIds[1]!

  /* ---------- کارها ---------- */
  const tasks: Task[] = [
    // فوری و مهم
    mk('طراحی نقشه اجرایی طبقه دوم', p1, 0, 'doing', ['نقشه'], t, now, 1),
    mk('سفارش ۲۰۰ کیسه سیمان', p1, 0, 'todo', ['مصالح'], addDays(t, 1), now, 2),
    mk('تماس با کارفرما برای پرداختی مرحله بعد', p1, 1, 'todo', ['مالی'], t, now, 3),
    mk('بازدید از پروژه لواسان', p2, 1, 'todo', [], t, now, 4),
    // بقیه روز
    mk('مرور ایشو‌های ریپو', null, 2, 'done', ['توسعه'], null, now - 3600_000, 5, now - 1800_000),
    mk('تمیزکاری ایمیل‌ها', null, 3, 'done', [], null, now - 7200_000, 6, now - 5400_000),
    mk('۳۰ دقیقه پیاده‌روی عصرگاهی', null, 3, 'todo', ['سلامت'], t, now, 7),
    // زیرتسک‌های طراحی نقشه
    mk('اندازه‌گیری مجدد ابعاد ستون‌ها', p1, 2, 'done', [], null, now, 8, now - 86400_000),
    mk('ترسیم جزئیات آرماتورگذاری', p1, 2, 'todo', [], addDays(t, 2), now, 9),
    mk('هماهنگی با مهندس ناظر', p1, 2, 'todo', [], addDays(t, 3), now, 10),
  ]

  const taskIds = await db.tasks.bulkAdd(tasks, { allKeys: true })
  // زیرتسک‌ها رو به والد وصل کن
  await db.tasks.update(taskIds[7]!, { parentId: taskIds[0]! })
  await db.tasks.update(taskIds[8]!, { parentId: taskIds[0]! })
  await db.tasks.update(taskIds[9]!, { parentId: taskIds[0]! })

  /* ---------- نیروها ---------- */
  const workers: Worker[] = [
    { name: 'خودم', role: 'بنا', dailyWage: 1_000_000, projectId: p1, active: true, isSelf: true, createdAt: now },
    { name: 'عباس محمدی', role: 'سرکارگر', dailyWage: 900_000, phone: '09121112233', projectId: p1, active: true, createdAt: now },
    { name: 'رضا کریمی', role: 'بنای ماهر', dailyWage: 800_000, phone: '09124445566', projectId: p1, active: true, createdAt: now },
    { name: 'حسین علی‌پور', role: 'کارگر', dailyWage: 600_000, projectId: p1, active: true, createdAt: now },
    { name: 'مهدی صادقی', role: 'کارگر', dailyWage: 600_000, projectId: p1, active: true, createdAt: now },
    { name: 'جواد نوروزی', role: 'جوشکار', dailyWage: 850_000, projectId: p2, active: true, createdAt: now },
  ]
  const workerIds = await db.workers.bulkAdd(workers, { allKeys: true })

  /* ---------- کارکرد ۷ روز اخیر ---------- */
  // الگوی حضور: [روز-۶ … امروز] — خودم و سرکارگر همیشه هستن
  const patterns: number[][] = [
    [1, 1, 1, 1, 1, 1, 1], // خودم
    [1, 1, 1, 1, 1, 1, 1], // عباس
    [1, 1, 0, 1, 1, 1, 1], // رضا
    [1, 1, 1, 1, 1, 0, 1], // حسین
    [1, 0, 1, 1, 1, 1, 0], // مهدی
    [0, 1, 1, 0, 1, 1, 1], // جواد
  ]
  const hoursPattern = [8, 8, 9, 8, 8, 9.5, 8]
  const attendances: Attendance[] = []
  const weekStart = startOfWeek(t)
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const today = todayJalali()

  days.forEach((date, di) => {
    if (date > today) return
    workerIds.forEach((wid, wi) => {
      if (patterns[wi]![di]) {
        attendances.push({
          workerId: wid!,
          date,
          hours: hoursPattern[di]!,
          projectId: workers[wi]!.projectId ?? null,
          createdAt: now,
        })
      }
    })
  })
  await db.attendances.bulkAdd(attendances)

  /* ---------- پرداختی‌ها ---------- */
  const payments: Payment[] = [
    { workerId: workerIds[1]!, amount: 2_700_000, date: addDays(weekStart, 0), projectId: p1, note: 'پرداخت هفتگی', createdAt: now },
    { workerId: workerIds[2]!, amount: 1_600_000, date: addDays(weekStart, 0), projectId: p1, note: 'پرداخت هفتگی', createdAt: now },
    { workerId: workerIds[3]!, amount: 1_800_000, date: addDays(weekStart, 0), projectId: p1, note: 'پرداخت هفتگی', createdAt: now },
  ]
  await db.payments.bulkAdd(payments)

  // مالی و مراحل (هم برای seed اولیه، هم برای مهاجرت v1 → v2)
  await seedExtras()
}

/** داده‌های ساخته‌شده در فاز ۲ — مالی پروژه و تایم‌لاین مراحل */
export async function seedExtras(): Promise<void> {
  const now = Date.now()

  const projects = await db.projects.toArray()
  const p1 = projects[0]?.id
  const p2 = projects[1]?.id

  const financeCount = await db.financeEntries.count()
  if (financeCount === 0 && p1) {
    const finance: FinanceEntry[] = [
      { projectId: p1, type: 'income', category: 'پیش‌پرداخت', amount: 970_000_000, date: '1404-04-15', description: 'پیش‌پرداخت ۲۰٪ قرارداد', createdAt: now },
      { projectId: p1, type: 'income', category: 'پیش‌پرداخت', amount: 600_000_000, date: '1404-05-20', description: 'مرحله اسکلت', createdAt: now },
      { projectId: p1, type: 'income', category: 'پیش‌پرداخت', amount: 800_000_000, date: '1404-07-05', description: 'مرحله تاسیسات', createdAt: now },
      { projectId: p1, type: 'income', category: 'پیش‌پرداخت', amount: 600_000_000, date: '1405-07-01', description: 'مرحله نازک‌کاری', createdAt: now },
      { projectId: p1, type: 'expense', category: 'مصالح', amount: 480_000_000, date: '1404-05-25', description: 'آهن‌آلات و میلگرد', createdAt: now },
      { projectId: p1, type: 'expense', category: 'مصالح', amount: 58_000_000, date: '1405-07-02', description: 'گچ و سیمان', createdAt: now },
      { projectId: p1, type: 'expense', category: 'دستمزد', amount: 684_000_000, date: '1405-07-12', description: 'حقوق نیروها', createdAt: now },
      { projectId: p1, type: 'expense', category: 'ماشین‌آلات', amount: 45_000_000, date: '1404-09-04', description: 'کرایه بالابر', createdAt: now },
    ]
    await db.financeEntries.bulkAdd(finance)
  }

  const stageCount = await db.stages.count()
  if (stageCount === 0 && p1) {
    const stages: Stage[] = [
      { projectId: p1, title: 'تخریب و آماده‌سازی', description: 'تخریب سازه، جمع‌آوری نخاله', progress: 100, status: 'done', startDate: '1404-04-15', endDate: '1404-05-05', estimatedCost: 85_000_000, order: 1 },
      { projectId: p1, title: 'فونداسیون و اسکلت', description: 'آرماتوربندی و بتن‌ریزی', progress: 100, status: 'done', startDate: '1404-05-05', endDate: '1404-06-20', estimatedCost: 520_000_000, order: 2 },
      { projectId: p1, title: 'تاسیسات برق و آب', description: 'لوله‌کشی و سیم‌کشی زیر', progress: 100, status: 'done', startDate: '1404-06-20', endDate: '1404-07-08', estimatedCost: 310_000_000, order: 3 },
      { projectId: p1, title: 'نازک‌کاری و گچ‌کاری', description: 'گچ و خاک، کاشی‌کاری', progress: 45, status: 'active', startDate: '1405-07-08', estimatedCost: 420_000_000, order: 4 },
      { projectId: p1, title: 'کاشی و سرامیک', progress: 0, status: 'pending', startDate: '1405-07-20', estimatedCost: 280_000_000, order: 5 },
      { projectId: p1, title: 'رنگ‌آمیزی و نهایی', progress: 0, status: 'pending', startDate: '1405-08-10', estimatedCost: 180_000_000, order: 6 },
      { projectId: p1, title: 'تحویل و تسویه', progress: 0, status: 'pending', startDate: '1405-08-25', order: 7 },
    ]
    await db.stages.bulkAdd(stages)
  }

  // رکورد «خودم» برای دیتابیس‌های قدیمی که ندارن
  const workers = await db.workers.toArray()
  if (!workers.some((w) => w.isSelf)) {
    await db.workers.add({
      name: 'خودم',
      role: 'بنا',
      dailyWage: 0,
      projectId: p1 ?? null,
      active: true,
      isSelf: true,
      createdAt: now,
    })
  }

  // نمونه گزارش روزانه برای دیتابیس‌های قدیمی
  const logCount = await db.dayLogs.count()
  if (logCount === 0 && p1) {
    const t = todayJalali()
    await db.dayLogs.bulkAdd([
      { date: addDays(t, -1), projectId: p1, text: 'گچ‌کاری اتاق‌های طبقه اول تمام شد. فردا سراغ راهرو می‌ریم.', createdAt: now },
      { date: addDays(t, -2), projectId: p1, text: 'سیمان و گچ رسید. دیوار حمال آشپزخانه چیده شد.', createdAt: now },
    ])
  }

  // نمونه نرخ‌نامه و متراژ برای دیتابیس‌های قدیمی
  const rateCount = await db.rateItems.count()
  if (rateCount === 0 && p1) {
    const t = todayJalali()
    const rates: RateItem[] = [
      { projectId: p1, title: 'سرامیک کف', unit: 'm2', price: 650_000, currency: 'toman', order: 1, createdAt: now },
      { projectId: p1, title: 'سرامیک دیوار (بدنه)', unit: 'm2', price: 600_000, currency: 'toman', order: 2, createdAt: now },
      { projectId: p1, title: 'قرنیز', unit: 'm', price: 180_000, currency: 'toman', order: 3, createdAt: now },
      { projectId: p1, title: 'گچ‌کاری', unit: 'm2', price: 320_000, currency: 'toman', order: 4, createdAt: now },
      { projectId: p1, title: 'نصب درب', unit: 'item', price: 2_500_000, currency: 'toman', order: 5, createdAt: now },
    ]
    const rateIds = await db.rateItems.bulkAdd(rates, { allKeys: true })
    const measures: Measurement[] = [
      { rateId: rateIds[0]!, projectId: p1, qty: 42, date: addDays(t, -2), zone: 'کف سالن', note: 'سالن طبقه اول', createdAt: now },
      { rateId: rateIds[0]!, projectId: p1, qty: 18, date: addDays(t, -1), zone: 'راهرو', note: 'راهرو', createdAt: now },
      { rateId: rateIds[3]!, projectId: p1, qty: 120, date: addDays(t, -1), zone: 'اتاق‌ها', note: 'اتاق‌ها', createdAt: now },
    ]
    await db.measurements.bulkAdd(measures)
  }

  // تکمیل عنوان قسمت برای متراژهای نمونه قدیمی که zone ندارن
  const zoneFix: Record<string, string> = {
    'سالن طبقه اول': 'کف سالن',
    'راهرو': 'راهرو',
    'اتاق‌ها': 'اتاق‌ها',
  }
  const zoneless = await db.measurements.filter((m) => !m.zone && !!m.note).toArray()
  for (const m of zoneless) {
    const z = zoneFix[m.note!.trim()]
    if (z && m.id) await db.measurements.update(m.id, { zone: z })
  }

  // نمونه دفتر شخصی و سبد سرمایه برای دیتابیس‌های قدیمی
  const t = todayJalali()
  if ((await db.transactions.count()) === 0) {
    await db.transactions.bulkAdd([
      { type: 'income', category: 'دستمزد', amount: 85_000_000, date: addDays(t, -6), note: 'پیش‌پرداخت مرحله نازک‌کاری', createdAt: now },
      { type: 'expense', category: 'مصالح', amount: 12_500_000, date: addDays(t, -4), note: 'سیمان و گچ', createdAt: now },
      { type: 'expense', category: 'زندگی', amount: 5_400_000, date: addDays(t, -3), note: 'خرید هفتگی', createdAt: now },
      { type: 'expense', category: 'حمل‌ونقل', amount: 1_800_000, date: addDays(t, -1), note: 'بنزین و کرایه', createdAt: now },
      { type: 'income', category: 'سایر', amount: 4_000_000, date: addDays(t, -1), note: 'فروش ابزار دست‌دوم', createdAt: now },
    ])
  }
  if ((await db.assets.count()) === 0) {
    await db.assets.bulkAdd([
      { kind: 'gold', title: 'طلای ۱۸ عیار', qty: 20, buyPrice: 4_200_000, buyDate: addMonths(t, -6), note: 'پس‌انداز', createdAt: now },
      { kind: 'usd', title: 'دلار', qty: 1500, buyPrice: 45, buyDate: addMonths(t, -4), createdAt: now },
    ])
  } else {
    // اصلاح مقادیر نمونه قدیمی که غیرواقعی بودن
    const olds = await db.assets.toArray()
    for (const a of olds) {
      if (a.buyPrice === 7_850_000 && a.id) await db.assets.update(a.id, { buyPrice: 4_200_000 })
      if (a.buyPrice === 76_200 && a.id) await db.assets.update(a.id, { buyPrice: 45 })
    }
  }

  // نمونه اهداف برای دیتابیس‌های قدیمی
  if ((await db.goals.count()) === 0) {
    const gt = todayJalali()
    const dl = (n: number) => startOfMonth(addMonths(gt, n))
    const gIds = await db.goals.bulkAdd(
      [
        { title: 'مهاجرت به کانادا', icon: '✈️', targetAmount: 1_500_000_000, savedAmount: 680_000_000, monthlyCommit: 58_000_000, deadline: dl(14), note: 'ویزای تحصیلی', order: 1, createdAt: now },
        { title: 'خرید خودروی پژو ۲۰۷', icon: '🚗', targetAmount: 1_250_000_000, savedAmount: 780_000_000, monthlyCommit: 80_000_000, deadline: dl(5), note: '', order: 2, createdAt: now },
        { title: 'پیش‌پرداخت آپارتمان', icon: '🏠', targetAmount: 3_000_000_000, savedAmount: 540_000_000, monthlyCommit: 102_000_000, deadline: dl(24), note: 'بلندمدت', order: 3, createdAt: now },
      ],
      { allKeys: true },
    )
    await db.goalItems.bulkAdd([
      { goalId: gIds[0]!, title: 'آیلتس ۶٫۵ بگیر', done: true, order: 1, createdAt: now },
      { goalId: gIds[0]!, title: 'ارزیابی مدارک تحصیلی', done: true, order: 2, createdAt: now },
      { goalId: gIds[0]!, title: 'ارسال پرونده ویزا', done: false, dueDate: '1404-08-15', order: 3, createdAt: now },
      { goalId: gIds[0]!, title: 'پس‌انداز تا ۸۰۰ میلیون', done: false, dueDate: '1404-08-30', order: 4, createdAt: now },
      { goalId: gIds[1]!, title: 'مقایسه مدل‌ها و قیمت روز', done: true, order: 1, createdAt: now },
      { goalId: gIds[1]!, title: 'فروش خودروی فعلی', done: false, dueDate: '1404-08-10', order: 2, createdAt: now },
      { goalId: gIds[1]!, title: 'پس‌انداز تا ۱٬۰۰۰ میلیون', done: false, dueDate: '1404-09-15', order: 3, createdAt: now },
      { goalId: gIds[2]!, title: 'تعیین بودجه و محل', done: true, order: 1, createdAt: now },
      { goalId: gIds[2]!, title: 'بررسی وام بانکی', done: false, dueDate: '1404-08-20', order: 2, createdAt: now },
    ])
  } else {
    // اصلاح موعدهای نمونه قدیمی که گذشته بودن
    const fixDl: Record<string, number> = {
      'مهاجرت به کانادا': 14,
      'خرید خودروی پژو ۲۰۷': 5,
      'پیش‌پرداخت آپارتمان': 24,
    }
    const gt = todayJalali()
    const all = await db.goals.toArray()
    for (const g of all) {
      const n = fixDl[g.title]
      if (n && g.id && g.deadline < gt) {
        await db.goals.update(g.id, { deadline: startOfMonth(addMonths(gt, n)) })
      }
    }
  }

  // نمونه عادت‌های یادگیری
  if ((await db.habits.count()) === 0) {
    const hIds = await db.habits.bulkAdd(
      [
        { title: 'خواندن انگلیسی', icon: '🇬🇧', unit: 'min', dailyGoal: 30, color: '#2563eb', createdAt: now },
        { title: 'کتاب‌خوانی', icon: '📖', unit: 'min', dailyGoal: 20, color: '#059669', createdAt: now },
        { title: 'تمرکز', icon: '⏱️', unit: 'min', dailyGoal: 60, color: '#7c3aed', createdAt: now },
      ],
      { allKeys: true },
    )
    const day = (n: number) => addDays(t, -n)
    const logs: { habitId: number; date: string; amount: number; note?: string; createdAt: number }[] = []
    // خواندن انگلیسی — ۶ روز اخیر تقریباً کامل
    ;[6, 5, 4, 3, 1, 0].forEach((n) => logs.push({ habitId: hIds[0]!, date: day(n), amount: 30 + (n % 3) * 5, createdAt: now }))
    // کتاب — ۴ روز اخیر
    ;[5, 3, 2, 0].forEach((n) => logs.push({ habitId: hIds[1]!, date: day(n), amount: 20 + (n % 2) * 10, createdAt: now }))
    // تمرکز — چند جلسه پومودورو
    ;[6, 5, 4, 2, 1, 0].forEach((n) => {
      logs.push({ habitId: hIds[2]!, date: day(n), amount: 50 + (n % 3) * 25, note: n % 2 ? 'بازسازی مهرآباد' : undefined, createdAt: now })
    })
    await db.habitLogs.bulkAdd(logs)
  }

  // نمونه کارت‌های کانبان (برای دیتابیس‌هایی که هنوز تسکی ندارن)
  if ((await db.tasks.count()) === 0) {
    const p1 = (await db.projects.toArray())[0]?.id ?? null
    await db.tasks.bulkAdd([
      mk('تماس با کارفرمای ویلای لواسان', p1, 1, 'todo', [], addDays(t, 1), now, 1),
      mk('خرید سرامیک سرویس بهداشتی', p1, 0, 'todo', [], addDays(t, 2), now, 2),
      mk('صدور صورت‌وضعیت مهرآباد', p1, 1, 'todo', [], addDays(t, 5), now, 3),
      mk('اجراي کف‌سازی طبقه اول', p1, 0, 'doing', [], null, now, 4),
      mk('گچ‌کاری سقف راهرو', p1, 2, 'doing', [], null, now, 5),
      mk('منتظر جواب استعلام قیمت گچ', p1, 3, 'waiting', [], null, now, 6),
      mk('تمیزکاری نهایی طبقه همکف', p1, 2, 'done', [], addDays(t, -2), now, 7, now - 86400000),
      mk('آیلتس ۶٫۵ بگیر', null, 1, 'doing', [], null, now, 8),
    ])
  }
}

function mk(
  title: string,
  projectId: number | null,
  priority: 0 | 1 | 2 | 3,
  status: Task['status'],
  tags: string[],
  dueDate: string | null,
  createdAt: number,
  order: number,
  completedAt?: number,
): Task {
  return {
    title,
    projectId,
    parentId: null,
    priority,
    status,
    tags,
    dueDate,
    order,
    createdAt,
    completedAt: completedAt ?? (status === 'done' ? createdAt : null),
    notes: '',
  }
}
