(function () {
  'use strict';

  var dict = {
    fa: {
      skip: 'پرش به محتوا',
      navFeatures: 'پروژه و کارگاه',
      navNew: 'تازه‌ها',
      navScreens: 'تصاویر',
      navDownload: 'دانلود',
      navFaq: 'سوالات',
      downloadShort: 'دانلود',
      heroBadgePrefix: 'نسخهٔ',
      heroBadgeSuffix: 'منتشر شد',
      heroTitle: 'کارگاه، قرارداد و کارگرت را <span class="grad">یک‌جا مدیریت کن.</span>',
      heroLede: 'SAZORA یک مدیر پروژهٔ ساختمانی آفلاین برای ویندوز است: قرارداد، دریافتی و هزینهٔ هر پروژه، مراحل اجرا با تاریخ شمسی، کارکرد و مزد کارگران، صورت‌وضعیت متراژ و مالی — همه روی دستگاه خودت، بدون اینترنت.',
      heroCta: 'دانلود نسخهٔ ویندوز',
      heroSecondary: 'دیدن قابلیت‌ها',
      heroNote: 'نسخهٔ',
      heroPoint1: 'همهٔ اعداد پروژه — قرارداد، سود، پیشرفت — در یک‌جا',
      heroPoint2: 'بدون اینترنت و بدون حساب آنلاین؛ داده روی دستگاه',
      heroPoint3: 'کاملاً فارسی، با تاریخ شمسی و تقویم کارگاه',
      windowProjects: 'پروژه‌ها',
      floatA: '۶۱٪ پیشرفت اجرا',
      floatASub: 'از روی مراحل، با تاریخ شمسی',
      floatB: '۴ میلیارد قرارداد',
      floatBSub: 'دریافتی، هزینه و سود لحظه‌ای',
      trust1: 'آفلاین و خصوصی',
      trust2: 'کاملاً فارسی و راست‌چین',
      trust3: 'به‌روزرسانی یک‌کلیکی',
      featuresKicker: 'مدیریت پروژهٔ ساختمانی',
      featuresTitle: 'از قرارداد تا تحویل، بدون دفتر و ماشین‌حساب',
      featuresSub: 'هر بخش، تصویری واقعی از خود برنامه با دادهٔ نمونه است — نه ماکت. پروژه‌ها، مراحل، مالی، متراژ و کارگران به هم وصل‌اند.',
      sampleNote: 'نمونهٔ واقعی از برنامه با دادهٔ آزمایشی',
      winOverview: 'SAZORA — پروژه‌ها',
      winStages: 'SAZORA — مراحل اجرا',
      winFinance: 'SAZORA — مالی پروژه',
      winRates: 'SAZORA — صورت‌وضعیت متراژ',
      winWorkers: 'SAZORA — کارگران',
      winBoard: 'SAZORA — کانبان',
      r1k: 'هستهٔ پروژه',
      r1t: 'هر پروژه، یک صفحهٔ تصمیم',
      r1d: 'از لحظهٔ بستن قرارداد تا آخرین پرداخت: مبلغ قرارداد، دریافتی‌ها، هزینه‌ها، سود و درصد پیشرفت هر پروژه در یک صفحه — همان چیزی که در این تصویر می‌بینی.',
      r1a: 'جمع قرارداد، دریافتی، هزینه و سود — خودکار و لحظه‌ای',
      r1b: 'درصد پیشرفت پروژه؛ دستی یا از روی مراحل اجرا',
      r1c: 'فهرست همهٔ پروژه‌ها با وضعیت و جست‌وجو',
      r2k: 'مراحل اجرا',
      r2t: 'تایم‌لاین اجرا با تاریخ شمسی',
      r2d: 'تخریب، تأسیسات، کاشی، نقاشی… هر مرحله را با تاریخ شروع و پایان شمسی ثبت کن، برایش درصد پیشرفت بگذار و وضعیتش را ببین.',
      r2a: 'تاریخ شمسی برای هر مرحله، بدون تبدیل دستی',
      r2b: 'درصد پیشرفت هر مرحله با اسلایدر',
      r2c: 'وضعیت روشن: در جریان، تمام‌شده، متوقف',
      r3k: 'مالی پروژه',
      r3t: 'پول پروژه را با پول شخصی قاطی نکن',
      r3d: 'هر دریافتی و هزینه در ردیف خودش؛ سود پروژه از همان لحظه محاسبه می‌شود و هر ردیف را می‌شود یک‌جا به دفتر مالی فرستاد.',
      r3a: 'ردیف‌های دریافتی و هزینه برای هر پروژه',
      r3b: 'سود پروژه در همان صفحه، بدون فایل جداگانه',
      r3c: 'انتقال ردیف‌ها به دفتر مالی در یک تراکنش',
      r4k: 'صورت‌وضعیت',
      r4t: 'متراژ و مبلغ کار، بدون ماشین‌حساب',
      r4d: 'متراژ هر آیتم، قیمت واحد و مبلغ نهایی را ثبت کن تا صورت‌وضعیت کارگاه همان‌جا بسته شود و به مالی پروژه وصل باشد.',
      r4a: 'آیتم‌های متراژ با قیمت واحد',
      r4b: 'جمع خودکار مبلغ صورت‌وضعیت',
      r4c: 'اتصال مستقیم به مالی پروژه',
      r5k: 'کارگران',
      r5t: 'کارکرد روزانه، مزد و ماندهٔ حساب',
      r5d: 'حضور و ساعت کار هر نیرو روی تقویم؛ مزد هفتگی و ماهانه، پرداخت‌ها و ماندهٔ حساب هر کارگر همیشه جلوی چشم.',
      r5a: 'تقویم کارکرد روزانه برای هر کارگر',
      r5b: 'مزد هفتگی و ماهانه، پرداخت و مانده',
      r5c: 'خروجی CSV از کارکرد و مزد',
      r6k: 'کارها',
      r6t: 'کانبان برای خودِ کار',
      r6d: 'قرارداد، خرید مصالح و هماهنگی‌ها را مثل کارت جابه‌جا کن — از «در انتظار» تا «در حال انجام» و «انجام‌شده».',
      r6a: 'کشیدن و رها کردن کارت‌ها',
      r6b: 'اولویت و سررسید برای هر کار',
      r6c: 'اتصال کارها به پروژه‌ها',
      m1t: 'امروز',
      m1d: 'کارهای امروز، اولویت‌ها و عقب‌افتاده‌ها — با هزاران تسک هم روان می‌ماند.',
      m2t: 'مالی و سرمایه‌گذاری',
      m2d: 'دفتر دریافتی و پرداختی، نمودار ماهانه و سبد طلا، دلار و سهام.',
      m3t: 'اهداف با پیش‌بینی',
      m3d: 'مبلغ هدف، پس‌انداز ماهانه و تاریخ رسیدن؛ جلوتر یا عقب‌تر بودن مسیر.',
      m4t: 'کتاب‌خوانی آفلاین',
      m4d: 'قفسهٔ PDF و Word، یادداشت چسبان، تایمر مطالعه و آمار صفحه و دقیقه.',
      newKicker: 'تازه در نسخهٔ ۱٫۹٫۱۷',
      newTitle: 'سریع‌تر، سبک‌تر، بی‌صدا در پس‌زمینه',
      newSub: 'این نسخه روی روان بودن با داده‌های زیاد و کوچک‌تر شدن پشتیبان‌ها تمرکز دارد.',
      stat1v: '۱۲×',
      stat1t: 'پشتیبان کوچک‌تر',
      stat1d: 'پشتیبان فشردهٔ gzip در نمونهٔ ۵٬۰۰۰ تسک از ۱٫۶ مگابایت به ۱۲۹ کیلوبایت رسید.',
      stat2v: '۱۲۰',
      stat2t: 'تسک در هر مرحله',
      stat2d: 'صفحهٔ «امروز» فقط بخش لازم را رندر می‌کند و بقیه با «نمایش بیشتر» اضافه می‌شوند.',
      stat3v: '۵',
      stat3t: 'نسخهٔ پشتیبان خودکار',
      stat3d: 'آخرین نسخه‌ها با تاریخچهٔ بازیابی داخل برنامه می‌مانند؛ ساخت پشتیبان رابط را قفل نمی‌کند.',
      newItem1: 'مالی سریع‌تر: نمودارها فقط تراکنش‌های بازهٔ نمایش را می‌خوانند.',
      newItem2: 'بارگذاری تنبل جست‌وجوی سراسری و خروجی CSV کارگران.',
      newItem3: 'انتقال یک‌بارهٔ ردیف‌های پروژه به بخش مالی در یک تراکنش.',
      fullNotes: 'مشاهدهٔ همهٔ تغییرات در GitHub',
      screensKicker: 'نگاهی به داخل برنامه',
      screensTitle: 'بقیهٔ بخش‌ها هم همان‌جاست',
      screensSub: 'امروز، کانبان، مالی، اهداف و کتاب‌خوانی — همه با دادهٔ نمونه و در همان پنجرهٔ آفلاین.',
      shot1: 'امروز: کارهای روز، عقب‌افتاده‌ها و اولویت‌ها',
      shot2: 'کانبان: از «در انتظار» تا «انجام‌شده»',
      shot3: 'مالی: تراکنش‌ها، دسته‌بندی و نمودار ماهانه',
      shot4: 'اهداف: پیش‌بینی رسیدن به هدف',
      shot5: 'کتاب‌خانه: قفسه، جلد و پیشرفت مطالعه',
      shot6: 'مطالعه: تایمر، یادداشت و اندازهٔ متن',
      downloadKicker: 'نصب روی ویندوز',
      downloadTitle: 'همین حالا SAZORA را نصب کنید',
      downloadSub: 'فایل نصب را اجرا کنید؛ نسخهٔ قبلی و اطلاعات شما در جای خود می‌ماند. نسخهٔ نصبی هنگام باز شدن، به‌روزرسانی‌ها را خودش بررسی می‌کند.',
      downloadSetup: 'دانلود Setup',
      downloadReleases: 'صفحهٔ انتشارها',
      downloadPortable: 'نسخهٔ Portable (ZIP)',
      downloadSums: 'فایل SHA-256',
      reqTitle: 'نیازمندی‌ها',
      reqWebview: 'Microsoft Edge WebView2',
      reqSize: 'حجم نصب‌کننده',
      reqVersion: 'نسخه',
      shaTitle: 'SHA-256 نصب‌کننده',
      downloadNote: 'SAZORA آفلاین است؛ فایل نصب هیچ داده‌ای از شما نمی‌فرستد.',
      faqKicker: 'پرسش‌های رایج',
      faqTitle: 'چیزهایی که قبل از نصب خوب است بدانید',
      q1: 'آیا برای استفاده به اینترنت نیاز دارم؟',
      a1: 'نه. پروژه‌ها، مراحل اجرا، کارکرد کارگران، مالی، اهداف و کتاب‌خوانی آفلاین کار می‌کنند. فقط بررسی به‌روزرسانی و به‌روزرسانی قیمت دارایی‌ها از اینترنت استفاده می‌کند.',
      q2: 'داده‌هایم کجا ذخیره می‌شود؟',
      a2: 'داخل IndexedDB مرورگر داخلی برنامه در مسیر <code>%LocalAppData%\\SAZORA\\WebView2Data</code>. پشتیبان خودکار هم آخرین ۵ نسخه را داخل برنامه نگه می‌دارد و می‌توانید یک فایل JSON هم در پوشهٔ دلخواه داشته باشید.',
      q3: 'به‌روزرسانی خودکار چطور کار می‌کند؟',
      a3: 'نسخهٔ نصبی هنگام باز شدن، آخرین انتشار GitHub را بررسی می‌کند. با تأیید شما فایل به‌روزرسانی دانلود و SHA-256 آن بررسی می‌شود، سپس برنامه بسته، جایگزین و دوباره باز می‌شود.',
      q4: 'تاریخ‌ها شمسی است یا میلادی؟',
      a4: 'همهٔ تاریخ‌ها — مراحل اجرا، سررسید کارها، کارکرد کارگران و تراکنش‌های مالی — به تقویم شمسی نمایش داده می‌شوند و نیازی به تبدیل دستی نیست.',
      q5: 'آیا داده‌ها به سروری فرستاده می‌شوند؟',
      a5: 'نه. SAZORA برای کار اصلی به حساب کاربری یا سرور نیاز ندارد؛ داده‌ها روی همان ویندوز شما می‌مانند.',
      q6: 'روی ویندوز ۷ اجرا می‌شود؟',
      a6: 'حداقل نسخهٔ پشتیبانی‌شده Windows 10 نسخهٔ 1809 (x64) است. WebView2 هم لازم است؛ اگر نصب نباشد، نصب‌کننده راهنمایی می‌کند.',
      crossKicker: 'از همین سازنده',
      crossTitle: 'Sortiva — فایل‌هایت را مرتب کن',
      crossSub: 'مرتب‌سازی فایل‌ها بر اساس نوع و تاریخ، تاریخ واقعی عکس‌ها، پیدا کردن تکراری‌ها و زمان‌بندی خودکار برای ویندوز.',
      crossCta: 'دیدن سایت Sortiva',
      footerTag: 'مدیر پروژهٔ ساختمانی و مالی، آفلاین روی ویندوز.',
      footerNote: 'داده‌های شما روی دستگاه خودتان می‌ماند.',
      footerLinks: 'لینک‌ها',
      footerReleases: 'انتشارها',
      footerNotes: 'تغییرات نسخه',
      footerSortiva: 'Sortiva',
      footerSupport: 'حمایت',
      footerDonate: 'صفحهٔ دونیت',
      footerAuthor: 'سایر پروژه‌ها',
      footerContact: 'ارتباط با ما',
      footerSite: 'صفحهٔ رسمی',
      footerRights: 'همهٔ حقوق محفوظ است',
      footerMade: 'ساختهٔ Omid Masomi',
      pageTitle: 'SAZORA — مدیریت پروژهٔ ساختمانی، کارگر و مالی، آفلاین',
      pageDesc: 'SAZORA یک مدیر پروژهٔ آفلاین برای ویندوز است: قرارداد، دریافتی و هزینهٔ پروژه، مراحل اجرا با تاریخ شمسی، کارکرد و مزد کارگران، صورت‌وضعیت متراژ و مالی — داده‌ها روی دستگاه خودتان می‌ماند.',
      langAria: 'تغییر زبان به انگلیسی'
    },
    en: {
      skip: 'Skip to content',
      navFeatures: 'Projects & site',
      navNew: "What's new",
      navScreens: 'Screenshots',
      navDownload: 'Download',
      navFaq: 'FAQ',
      downloadShort: 'Download',
      heroBadgePrefix: 'Version',
      heroBadgeSuffix: 'is out',
      heroTitle: 'Run the site, the contract and the crew <span class="grad">in one place.</span>',
      heroLede: 'SAZORA is an offline construction project manager for Windows: contract, receipts and costs per project, build stages with Jalali dates, worker attendance and wages, measured statements and finance — all on your own machine, no internet.',
      heroCta: 'Download for Windows',
      heroSecondary: 'Explore features',
      heroNote: 'Version',
      heroPoint1: 'Every project number — contract, profit, progress — in one view',
      heroPoint2: 'No internet, no online account; data stays local',
      heroPoint3: 'Fully Persian with Jalali dates and a site calendar',
      windowProjects: 'Projects',
      floatA: '61% complete',
      floatASub: 'From stages, with Jalali dates',
      floatB: '4B contract',
      floatBSub: 'Live receipts, costs and profit',
      trust1: 'Offline and private',
      trust2: 'Fully Persian, RTL-native',
      trust3: 'One-click updates',
      featuresKicker: 'Construction project management',
      featuresTitle: 'From contract to handover, without books or spreadsheets',
      featuresSub: 'Each section is a real screenshot of the app with sample data — not a mockup. Projects, stages, finance, measured statements and workers are linked.',
      sampleNote: 'A real screenshot from the app with sample data',
      winOverview: 'SAZORA — Projects',
      winStages: 'SAZORA — Build stages',
      winFinance: 'SAZORA — Project finance',
      winRates: 'SAZORA — Measured statement',
      winWorkers: 'SAZORA — Workers',
      winBoard: 'SAZORA — Kanban',
      r1k: 'Project core',
      r1t: 'Every project, one decision screen',
      r1d: 'From signing the contract to the last payment: contract value, receipts, costs, profit and progress in one screen — exactly what this screenshot shows.',
      r1a: 'Contract, received, spent and profit totals — automatic and live',
      r1b: 'Project progress by hand or derived from build stages',
      r1c: 'All projects with status and search',
      r2k: 'Build stages',
      r2t: 'A build timeline with Jalali dates',
      r2d: 'Demolition, electrical, tiling, painting… record each stage with its Jalali start and end dates, set its progress and see its status.',
      r2a: 'Jalali dates per stage, no manual conversion',
      r2b: 'Per-stage progress slider',
      r2c: 'Clear status: running, finished, paused',
      r3k: 'Project finance',
      r3t: 'Keep project money apart from personal money',
      r3d: 'Every receipt and expense on its own row; profit is computed instantly and any row can be pushed to the finance ledger.',
      r3a: 'Receipt and expense rows per project',
      r3b: 'Project profit on the same screen, no side file',
      r3c: 'Send rows to the finance ledger in one transaction',
      r4k: 'Measured statement',
      r4t: 'Areas and amounts without a calculator',
      r4d: 'Record the area of each item, its unit price and final amount, and close the site statement right there — linked to project finance.',
      r4a: 'Measured items with unit prices',
      r4b: 'Automatic statement total',
      r4c: 'Direct link to project finance',
      r5k: 'Workers',
      r5t: 'Daily attendance, wages and balance',
      r5d: 'Attendance and hours for each worker on a calendar; weekly and monthly wages, payments and each worker’s balance always in sight.',
      r5a: 'Daily attendance calendar per worker',
      r5b: 'Weekly and monthly wages, payments, balance',
      r5c: 'CSV export of attendance and wages',
      r6k: 'Work',
      r6t: 'A kanban for the work itself',
      r6d: 'Contracts, material purchases and coordination move like cards — from “waiting” to “doing” to “done”.',
      r6a: 'Drag and drop cards',
      r6b: 'Priority and due date per task',
      r6c: 'Tasks linked to projects',
      m1t: 'Today',
      m1d: 'Today’s tasks, priorities and overdue work — stays smooth with thousands of tasks.',
      m2t: 'Finance & investments',
      m2d: 'Income and expense ledger, monthly charts, plus gold, USD and stock holdings.',
      m3t: 'Goals with forecasts',
      m3d: 'Target amount, monthly saving and arrival date; see whether you are ahead or behind.',
      m4t: 'Offline reading',
      m4d: 'Book shelf, PDF and Word files, sticky notes, reading timer and page and minute stats.',
      newKicker: 'New in 1.9.17',
      newTitle: 'Faster, lighter, quiet in the background',
      newSub: 'This release focuses on staying smooth with large datasets and making backups much smaller.',
      stat1v: '12×',
      stat1t: 'Smaller backups',
      stat1d: 'Compressed gzip backups in a 5,000-task sample went from 1.6 MB to 129 KB.',
      stat2v: '120',
      stat2t: 'Tasks per batch',
      stat2d: 'Today renders only what you need; “Show more” adds the rest in steps.',
      stat3v: '5',
      stat3t: 'Automatic snapshots',
      stat3d: 'Recent versions stay in the app with a restore history, and creating a backup no longer freezes the UI.',
      newItem1: 'Faster finance: charts read only transactions in the visible range.',
      newItem2: 'Lazy loading for global search and the worker CSV export.',
      newItem3: 'One-step transfer of project rows into the finance ledger in a single transaction.',
      fullNotes: 'See all changes on GitHub',
      screensKicker: 'A look inside',
      screensTitle: 'The rest of the app is right here',
      screensSub: 'Today, kanban, finance, goals and reading — all with sample data inside the same offline window.',
      shot1: 'Today: daily tasks, overdue items and priorities',
      shot2: 'Kanban: from “waiting” to “done”',
      shot3: 'Finance: transactions, categories and monthly chart',
      shot4: 'Goals: forecasting the arrival date',
      shot5: 'Library: shelf, covers and reading progress',
      shot6: 'Reading: timer, notes and text size',
      downloadKicker: 'Install on Windows',
      downloadTitle: 'Install SAZORA now',
      downloadSub: 'Run the installer; your existing version and data stay in place. The installed app checks for updates when it opens.',
      downloadSetup: 'Download Setup',
      downloadReleases: 'Releases page',
      downloadPortable: 'Portable build (ZIP)',
      downloadSums: 'SHA-256 file',
      reqTitle: 'Requirements',
      reqWebview: 'Microsoft Edge WebView2',
      reqSize: 'Installer size',
      reqVersion: 'Version',
      shaTitle: 'Installer SHA-256',
      downloadNote: 'SAZORA is offline; the installer never sends your data anywhere.',
      faqKicker: 'FAQ',
      faqTitle: 'Good to know before you install',
      q1: 'Do I need internet to use it?',
      a1: 'No. Projects, build stages, worker attendance, finance, goals and reading all work offline. Only update checks and optional asset price refreshes use the internet.',
      q2: 'Where is my data stored?',
      a2: 'In IndexedDB inside the app’s WebView2 profile at <code>%LocalAppData%\\SAZORA\\WebView2Data</code>. Automatic backup keeps the last 5 snapshots inside the app, and you can also keep a JSON file in a folder you choose.',
      q3: 'How does automatic updating work?',
      a3: 'The installed app checks the latest GitHub release when it opens. After you confirm, it downloads the update, verifies its SHA-256, closes, replaces the files and reopens.',
      q4: 'Are dates Jalali or Gregorian?',
      a4: 'All dates — build stages, task due dates, worker attendance and finance transactions — are shown on the Jalali calendar, with no manual conversion needed.',
      q5: 'Is my data sent to a server?',
      a5: 'No. SAZORA needs no account or server for its core work; your data stays on your Windows machine.',
      q6: 'Does it run on Windows 7?',
      a6: 'The minimum supported version is Windows 10 version 1809 (x64). WebView2 is also required; the installer guides you if it is missing.',
      crossKicker: 'From the same maker',
      crossTitle: 'Sortiva — keep your files in order',
      crossSub: 'Organize by type and date, use real photo dates, find duplicates and schedule automatic runs on Windows.',
      crossCta: 'Visit Sortiva',
      footerTag: 'Construction projects and finance, offline on Windows.',
      footerNote: 'Your data stays on your own device.',
      footerLinks: 'Links',
      footerReleases: 'Releases',
      footerNotes: 'Release notes',
      footerSortiva: 'Sortiva',
      footerSupport: 'Support',
      footerDonate: 'Donate page',
      footerAuthor: 'More projects',
      footerContact: 'Contact',
      footerSite: 'Official site',
      footerRights: 'All rights reserved',
      footerMade: 'Built by Omid Masomi',
      pageTitle: 'SAZORA — Offline construction project, worker and finance manager',
      pageDesc: 'SAZORA is an offline Windows construction project manager: contract, receipts and costs, build stages with Jalali dates, worker attendance and wages, measured statements and finance. Your data stays on your device.',
      langAria: 'Switch to Persian'
    }
  };

  var faDigits = '۰۱۲۳۴۵۶۷۸۹';
  var state = {
    lang: document.documentElement.lang === 'en' ? 'en' : 'fa',
    version: '1.9.17',
    size: 7217206
  };
  var CACHE_KEY = 'sazora-release-v1';
  var CACHE_MS = 6 * 60 * 60 * 1000;
  var API = 'https://api.github.com/repos/omidmasumi740-dev/sazora/releases/latest';

  function toFa(value) {
    return String(value).replace(/\d/g, function (d) {
      return faDigits[+d];
    }).replace(/\./g, '٫');
  }

  function formatVersion(v) {
    return state.lang === 'fa' ? toFa(v) : v;
  }

  function formatSize(bytes) {
    var mb = bytes / 1048576;
    var text = mb.toFixed(1);
    return state.lang === 'fa' ? toFa(text) + ' مگابایت' : text + ' MB';
  }

  function renderNumbers() {
    document.querySelectorAll('[data-version]').forEach(function (el) {
      el.textContent = formatVersion(state.version);
    });
    document.querySelectorAll('[data-size]').forEach(function (el) {
      el.textContent = formatSize(state.size);
    });
  }

  function setMeta(selector, value) {
    var el = document.querySelector(selector);
    if (el) el.setAttribute('content', value);
  }

  function applyLanguage(lang) {
    var t = dict[lang] || dict.fa;
    state.lang = lang;
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'fa' ? 'rtl' : 'ltr';

    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      var key = el.getAttribute('data-i18n');
      if (t[key] != null) el.textContent = t[key];
    });
    document.querySelectorAll('[data-i18n-html]').forEach(function (el) {
      var key = el.getAttribute('data-i18n-html');
      if (t[key] != null) el.innerHTML = t[key];
    });

    document.title = t.pageTitle;
    setMeta('meta[name="description"]', t.pageDesc);
    setMeta('meta[property="og:title"]', t.pageTitle);
    setMeta('meta[property="og:description"]', t.pageDesc);
    setMeta('meta[property="og:locale"]', lang === 'fa' ? 'fa_IR' : 'en_US');
    setMeta('meta[name="twitter:title"]', t.pageTitle);
    setMeta('meta[name="twitter:description"]', t.pageDesc);

    var toggle = document.getElementById('langToggle');
    if (toggle) toggle.setAttribute('aria-label', t.langAria);

    renderNumbers();
    try {
      localStorage.setItem('sazora-lang', lang);
    } catch (e) {}
  }

  function applyRelease(release) {
    if (!release) return;
    if (release.version) state.version = release.version;
    if (release.size) state.size = release.size;
    if (release.url) {
      document.querySelectorAll('[data-download="sazora"]').forEach(function (a) {
        a.setAttribute('href', release.url);
      });
    }
    renderNumbers();
  }

  function loadLatestRelease() {
    var cached = null;
    try {
      cached = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
    } catch (e) {}
    if (cached && cached.release && Date.now() - cached.ts < CACHE_MS) {
      applyRelease(cached.release);
      return;
    }

    var controller = new AbortController();
    var timer = setTimeout(function () {
      controller.abort();
    }, 5000);

    fetch(API, {
      headers: { Accept: 'application/vnd.github+json' },
      signal: controller.signal
    })
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (data) {
        var assets = data.assets || [];
        var asset = assets.filter(function (a) {
          return /setup/i.test(a.name) && /\.exe$/i.test(a.name);
        })[0] || assets.filter(function (a) {
          return /\.exe$/i.test(a.name);
        })[0];
        if (!asset) return;
        var release = {
          version: String(data.tag_name || '').replace(/^v/i, '') || state.version,
          size: asset.size || state.size,
          url: asset.browser_download_url || ''
        };
        applyRelease(release);
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), release: release }));
        } catch (e) {}
      })
      .catch(function () {})
      .finally(function () {
        clearTimeout(timer);
      });
  }

  function init() {
    applyLanguage(state.lang);

    var toggle = document.getElementById('langToggle');
    if (toggle) {
      toggle.addEventListener('click', function () {
        applyLanguage(state.lang === 'fa' ? 'en' : 'fa');
      });
    }

    var header = document.getElementById('siteHeader');
    function onScroll() {
      if (header) header.classList.toggle('scrolled', window.scrollY > 12);
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    var year = document.getElementById('year');
    if (year) year.textContent = String(new Date().getFullYear());

    setTimeout(loadLatestRelease, 900);
  }

  init();
})();
