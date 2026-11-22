(function () {
  'use strict';

  var dict = {
    fa: {
      skip: 'پرش به محتوا',
      navFeatures: 'پروژه و کارگاه',
      navAccount: 'حساب',
      navScreens: 'تصاویر',
      navDownload: 'دانلود',
      navFaq: 'سوالات',
      downloadShort: 'دانلود',
      heroBadgePrefix: 'نسخهٔ',
      heroBadgeSuffix: 'منتشر شد',
      heroTitleA: 'مدیریت کار، پروژه و مالی کارگاه',
      heroTitleB: 'در یک اپ آفلاین.',
      heroLede: 'SAZORA یک مدیر پروژهٔ ساختمانی آفلاین برای ویندوز است: قرارداد، دریافتی و هزینهٔ هر پروژه، مراحل اجرا با تاریخ شمسی، کارکرد و مزد کارگران، صورت‌وضعیت متراژ و مالی — همه روی دستگاه خودت، بدون اینترنت.',
      heroCta: 'دانلود نسخهٔ ویندوز',
      heroSecondary: 'دیدن قابلیت‌ها',
      freeBadge: 'رایگان',
      heroFree: 'رایگان است. بدون ثبت‌نام هم کامل کار می‌کند.',
      heroNote: 'نسخهٔ',
      heroPoint1: 'همهٔ اعداد پروژه — قرارداد، سود، پیشرفت — در یک‌جا',
      heroPoint2: 'کاملاً آفلاین؛ ورود اختیاری فقط برای پشتیبان ابری',
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
      featuresSub: 'ساخته‌شده برای پیمانکار، سرکارگر، بنا و دفتر فنی: هر بخش، تصویری واقعی از خود برنامه با دادهٔ نمونه است و پروژه‌ها، مراحل، مالی، متراژ و کارگران به هم وصل‌اند.',
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
      auxKicker: 'فراتر از کارگاه',
      auxTitle: 'امکانات جانبی',
      auxSub: 'اگر خواستید، کارهای روزانه، عادت‌ها، ورزش، اهداف، مالی شخصی و کتاب‌خوانی هم در همین اپ آفلاین هستند.',
      m1t: 'امروز',
      m1d: 'کارهای امروز، اولویت‌ها و عقب‌افتاده‌ها — با هزاران تسک هم روان می‌ماند.',
      m2t: 'مالی شخصی',
      m2d: 'دفتر دریافتی و پرداختی، نمودار ماهانه و سبد طلا، دلار و سهام — جدا از مالی پروژه.',
      m5t: 'عادت‌ها',
      m5d: 'عادت‌های روزانه را با زنجیرهٔ تکرار و مرور هفتگی دنبال کنید.',
      m3t: 'اهداف با پیش‌بینی',
      m3d: 'مبلغ هدف، پس‌انداز ماهانه و تاریخ رسیدن؛ جلوتر یا عقب‌تر بودن مسیر.',
      m6t: 'ورزش',
      m6d: 'برنامهٔ تمرین و روزهای ورزش، کنار بقیهٔ کارهای روزانه.',
      m4t: 'کتاب‌خوانی آفلاین',
      m4d: 'قفسهٔ PDF و Word، یادداشت چسبان، تایمر مطالعه و آمار صفحه و دقیقه.',
      screensKicker: 'نگاهی به داخل برنامه',
      screensTitle: 'بقیهٔ بخش‌ها هم همان‌جاست',
      screensSub: 'پروژه‌ها، امروز، کانبان، کارگران، مالی، اهداف و کتاب‌خوانی — همه با دادهٔ نمونه و در همان پنجرهٔ آفلاین.',
      gProjects: 'پروژه‌ها',
      gToday: 'امروز',
      gBoard: 'کانبان',
      gWorkers: 'کارگران',
      gFinance: 'مالی',
      gGoals: 'اهداف',
      gReading: 'کتاب‌خوانی',
      shotProjects: 'پروژه‌ها: قرارداد، دریافتی، هزینه، سود و درصد پیشرفت',
      shotToday: 'امروز: کارهای روز، عقب‌افتاده‌ها و اولویت‌ها',
      shotBoard: 'کانبان: از «در انتظار» تا «انجام‌شده»',
      shotWorkers: 'کارگران: تقویم کارکرد، مزد و ماندهٔ حساب',
      shotFinance: 'مالی: تراکنش‌ها، دسته‌بندی و نمودار ماهانه',
      shotGoals: 'اهداف: پیش‌بینی رسیدن به هدف',
      shotReading: 'کتاب‌خانه: قفسه، جلد و پیشرفت مطالعه',
      accountKicker: 'حساب اختیاری',
      accountTitle: 'بدون حساب / با حساب رایگان',
      accountSub: 'SAZORA برای کار اصلی حساب نمی‌خواهد. حساب رایگان اختیاری است و بکاپ ابری رمزنگاری‌شده را اضافه می‌کند.',
      noAccTitle: 'بدون حساب',
      noAccSub: 'همهٔ کار روزمره، کامل و آفلاین.',
      noAcc1: 'پروژه‌ها، مراحل اجرا، مالی، متراژ و کارگران',
      noAcc2: 'ذخیرهٔ خودکار روی همان دستگاه',
      noAcc3: 'پشتیبان محلی و فایل JSON در پوشهٔ دلخواه',
      noAcc4: 'بررسی به‌روزرسانی و قیمت دارایی‌ها',
      noAccNote: 'هیچ دادهٔ کاری از دستگاه خارج نمی‌شود.',
      accTitle: 'با حساب رایگان',
      accSub: 'برای بکاپ ابری رمزنگاری‌شده و بازیابی روی دستگاه جدید.',
      acc1: 'پشتیبان ابری رمزنگاری‌شده (AES-256) در فضای خصوصی حساب',
      acc2: 'بازیابی روی رایانهٔ جدید با همان حساب',
      acc3: 'ایمیل فقط برای ورود و بازیابی رمز استفاده می‌شود',
      acc4: 'ورود و خروج هر زمان؛ حذف حساب با یک ایمیل',
      accCta: 'ساخت حساب رایگان',
      accountFoot: 'بدون ثبت‌نام هم کامل کار می‌کند. حساب رایگان فقط برای پشتیبان ابری لازم است.',
      noteNoCloud: 'حساب اختیاری است؛ اپ بدون حساب هم کامل کار می‌کند و بکاپ ابری داخل برنامه در دسترس است.',
      downloadKicker: 'نصب روی ویندوز',
      downloadTitle: 'همین حالا SAZORA را نصب کنید',
      downloadSub: 'فایل نصب را اجرا کنید؛ نسخهٔ قبلی و اطلاعات شما در جای خود می‌ماند. نسخهٔ نصبی هنگام باز شدن، به‌روزرسانی‌ها را خودش بررسی می‌کند.',
      downloadSetup: 'دانلود Setup',
      downloadReleases: 'صفحهٔ انتشارها',
      downloadAccountNote: 'بدون ثبت‌نام هم کامل کار می‌کند. حساب رایگان فقط برای پشتیبان ابری لازم است.',
      verifyTitle: 'قبل از اجرا، فایل را بررسی کنید',
      copySha: 'کپی هش',
      verifyHow: 'مقدار زیر را با PowerShell مقایسه کنید (در پوشهٔ دانلود):',
      verifyVt: 'اسکن VirusTotal این نسخه',
      copied: 'هش SHA-256 کپی شد.',
      copyFailed: 'کپی نشد؛ هش را دستی انتخاب کنید.',
      downloadPortable: 'نسخهٔ Portable (ZIP)',
      downloadSums: 'فایل SHA-256',
      reqTitle: 'نیازمندی‌ها',
      reqWebview: 'Microsoft Edge WebView2',
      reqSize: 'حجم نصب‌کننده',
      reqVersion: 'نسخه',
      downloadNote: 'SAZORA آفلاین است؛ کار اصلی هیچ داده‌ای نمی‌فرستد. فقط بررسی به‌روزرسانی و قیمت دارایی‌ها به اینترنت وصل می‌شود.',
      faqKicker: 'پرسش‌های رایج',
      faqTitle: 'چیزهایی که قبل از نصب خوب است بدانید',
      q1: 'آیا برای استفاده به اینترنت نیاز دارم؟',
      a1: 'نه. پروژه‌ها، مراحل اجرا، کارکرد کارگران، مالی، اهداف و کتاب‌خوانی آفلاین کار می‌کنند. فقط بررسی به‌روزرسانی و به‌روزرسانی قیمت دارایی‌ها از اینترنت استفاده می‌کند.',
      q2: 'داده‌هایم کجا ذخیره می‌شود؟',
      a2a: 'داخل IndexedDB مرورگر داخلی برنامه در مسیر',
      a2b: 'ذخیره می‌شود. پشتیبان خودکار هم آخرین ۵ نسخه را داخل برنامه نگه می‌دارد و می‌توانید یک فایل JSON هم در پوشهٔ دلخواه داشته باشید.',
      q3: 'به‌روزرسانی خودکار چطور کار می‌کند؟',
      a3: 'نسخهٔ نصبی هنگام باز شدن، آخرین انتشار GitHub را بررسی می‌کند. با تأیید شما فایل به‌روزرسانی دانلود و SHA-256 آن بررسی می‌شود، سپس برنامه بسته، جایگزین و دوباره باز می‌شود.',
      q4: 'تاریخ‌ها شمسی است یا میلادی؟',
      a4: 'همهٔ تاریخ‌ها — مراحل اجرا، سررسید کارها، کارکرد کارگران و تراکنش‌های مالی — به تقویم شمسی نمایش داده می‌شوند و نیازی به تبدیل دستی نیست.',
      q5: 'آیا داده‌ها به سروری فرستاده می‌شوند؟',
      a5: 'کاملاً آفلاین کار می‌کند. ورود اختیاری است و فقط برای پشتیبان ابری لازم است. بدون ورود هیچ دادهٔ کاری ارسال نمی‌شود؛ فقط بررسی به‌روزرسانی و قیمت دارایی‌ها به اینترنت وصل می‌شود.',
      q6: 'روی ویندوز ۷ اجرا می‌شود؟',
      a6: 'حداقل نسخهٔ پشتیبانی‌شده Windows 10 نسخهٔ 1809 (x64) است.',
      q7: 'چرا حساب بسازم؟ چه مزیتی دارد؟',
      a7: 'کار اصلی اپ بدون حساب است. حساب رایگان اختیاری است و بکاپ ابری رمزنگاری‌شده، بازیابی روی رایانهٔ جدید و دیدن وضعیت پشتیبان‌ها را اضافه می‌کند. ایمیل فقط برای ورود و بازیابی رمز استفاده می‌شود و اپ بدون حساب هم کامل کار می‌کند.',
      q8: 'پشتیبان ابری کجا ذخیره می‌شود و چه کسی آن را می‌بیند؟',
      a8: 'بکاپ ابری داخل برنامه فعال است. فایل پشتیبان قبل از آپلود با AES-256-GCM رمزنگاری می‌شود، کلید رمزنگاری با DPAPI روی همان دستگاه می‌ماند و نسخه‌ها در فضای خصوصی حساب شما در Supabase نگهداری می‌شوند. ما ادعای رمزنگاری سرتاسری نمی‌کنیم؛ به فایل‌های دستگاه شما دسترسی نداریم و پشتیبان بدون ورود به حساب شما در دسترس نیست.',
      q9: 'چطور حساب و پشتیبان‌هایم را حذف کنم؟',
      a9a: 'از همان صفحهٔ حساب پس از ورود، گزینهٔ حذف حساب را بزنید؛ پشتیبان‌های ابری هم پاک می‌شوند. اگر دسترسی نداشتید، به',
      a9b: 'ایمیل بزنید. داده‌های محلی روی دستگاه با حذف حساب پاک نمی‌شوند و خودتان باید پوشهٔ داده را پاک کنید.',
      q10: 'ویندوز هشدار SmartScreen می‌دهد؛ فایل امن است؟',
      a10: 'نصب‌کننده امضای دیجیتال تجاری ندارد، بنابراین SmartScreen ممکن است هشدار «ناشر ناشناس» بدهد. SHA-256 همین صفحه را با PowerShell مقایسه کنید؛ اگر یکی بود، فایل همان نسخهٔ رسمی است. برای اطمینان بیشتر، فایل را در VirusTotal هم اسکن کنید.',
      q11: 'اگر پوشهٔ دادهٔ برنامه را پاک کنم چه می‌شود؟',
      a11: 'همهٔ پروژه‌ها، مالی، کارکرد و تنظیمات محلی از بین می‌رود. اگر پشتیبان ابری یا فایل JSON داشته باشید، با آنها برمی‌گردد. این کار را فقط بعد از گرفتن پشتیبان انجام دهید.',
      q12: 'آیا برنامه به WebView2 نیاز دارد؟',
      a12: 'بله، رابط برنامه با Microsoft Edge WebView2 اجرا می‌شود. اگر روی سیستم نصب نباشد، نصب‌کننده در همان مرحله راهنمایی می‌کند که آن را نصب کنید.',
      newKicker: 'تازه در نسخهٔ ۱٫۹٫۱۸',
      newTitle: 'بکاپ ساده‌تر، امن‌تر، بدون رمز',
      newSub: 'دو دکمهٔ روشن برای ذخیره و بازیابی، رمزنگاری خودکار ابری و دسترسی مستقیم به پشتیبانی.',
      newDetails: 'جزئیات تغییرات این نسخه',
      stat1v: '۲',
      stat1t: 'دکمه برای همه چیز',
      stat1d: '«ذخیره داده» و «بازیابی داده»؛ بقیهٔ گزینه‌ها داخل پنجرهٔ همان دکمه‌اند و تنظیمات شلوغ نیست.',
      stat2v: 'AES-256',
      stat2t: 'رمزنگاری خودکار',
      stat2d: 'کلید را خود برنامه می‌سازد و با DPAPI روی دستگاه نگه می‌دارد؛ رمزی از شما پرسیده نمی‌شود.',
      stat3v: '۳',
      stat3t: 'مسیر برای بازیابی',
      stat3d: 'از فایل، از نسخه‌های خودکار داخل برنامه یا از بکاپ ابری — همه در یک پنجره.',
      newItem1: 'ایمیل پشتیبانی sazorasupport@gmail.com در تنظیمات و همین صفحه در دسترس است.',
      newItem2: 'بکاپ‌های قدیمی رمزدار همچنان با همان رمز قبلی بازیابی می‌شوند.',
      newItem3: 'به‌روزرسانی، حافظه و پاک‌سازی داده داخل بخش‌های جمع‌شونده رفتند.',
      fullNotes: 'مشاهدهٔ همهٔ تغییرات در GitHub',
      nextSummary: 'در نسخهٔ بعدی (در حال آماده‌سازی): داده و بکاپ ساده‌تر',
      nextBody: 'این تغییرات برای نسخهٔ دسکتاپ آماده می‌شود و هنوز در انتشار عمومی نیست. نسخهٔ فعلی همین صفحه (۱٫۹٫۱۸) را نصب کنید.',
      next1: 'بخش «داده و بکاپ» با چهار کارت روشن: امنیت داده‌ها، ذخیره، بازیابی، حساب و همگام‌سازی.',
      next2: 'دکمهٔ «💾 ذخیره» در نوار بالا برای بکاپ سریع روی دستگاه یا فضای ابری.',
      next3: 'بکاپ خودکار gzip تا حدود ۱۲ برابر کوچک‌تر و صفحهٔ «امروز» روان‌تر با داده‌های زیاد.',
      crossKicker: 'از همین سازنده',
      crossTitle: 'Sortiva — فایل‌هایت را مرتب کن',
      crossSub: 'مرتب‌سازی فایل‌ها بر اساس نوع و تاریخ، تاریخ واقعی عکس‌ها، پیدا کردن تکراری‌ها و زمان‌بندی خودکار برای ویندوز.',
      crossCta: 'دیدن سایت Sortiva',
      footerTag: 'مدیر پروژهٔ ساختمانی و مالی، آفلاین روی ویندوز.',
      footerNote: 'داده‌های شما روی دستگاه خودتان می‌ماند.',
      footerAbout: 'ساختهٔ Omid Masomi · کد و انتشارها روی GitHub · بدون تبلیغ و ردیاب.',
      footerLinks: 'لینک‌ها',
      footerReleases: 'انتشارها',
      footerNotes: 'تغییرات نسخه',
      footerAccount: 'حساب و پشتیبان ابری',
      footerPrivacy: 'حریم خصوصی',
      footerContactPage: 'تماس با ما',
      footerSortiva: 'Sortiva',
      footerSupport: 'حمایت',
      footerDonate: 'صفحهٔ دونیت',
      footerAuthor: 'سایر پروژه‌ها',
      footerContact: 'ارتباط با ما',
      footerSite: 'صفحهٔ رسمی',
      footerRights: 'همهٔ حقوق محفوظ است',
      footerMade: 'ساختهٔ Omid Masomi',
      pageTitle: 'SAZORA — مدیریت پروژهٔ ساختمانی، کارگر و مالی، آفلاین',
      pageDesc: 'SAZORA یک مدیر پروژهٔ آفلاین رایگان برای ویندوز است: قرارداد، دریافتی و هزینهٔ پروژه، مراحل اجرا با تاریخ شمسی، کارکرد و مزد کارگران، صورت‌وضعیت متراژ و مالی — داده‌ها روی دستگاه خودتان می‌ماند.',
      langAria: 'تغییر زبان به انگلیسی'
    },
    en: {
      skip: 'Skip to content',
      navFeatures: 'Projects & site',
      navAccount: 'Account',
      navScreens: 'Screenshots',
      navDownload: 'Download',
      navFaq: 'FAQ',
      downloadShort: 'Download',
      heroBadgePrefix: 'Version',
      heroBadgeSuffix: 'is out',
      heroTitleA: 'Run the work, the project and the site money',
      heroTitleB: 'in one offline app.',
      heroLede: 'SAZORA is an offline construction project manager for Windows: contract, receipts and costs per project, build stages with Jalali dates, worker attendance and wages, measured statements and finance — all on your own machine, no internet.',
      heroCta: 'Download for Windows',
      heroSecondary: 'Explore features',
      freeBadge: 'Free',
      heroFree: 'It’s free. It works fully even without signing up.',
      heroNote: 'Version',
      heroPoint1: 'Every project number — contract, profit, progress — in one view',
      heroPoint2: 'Fully offline; an optional sign-in only for cloud backup',
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
      featuresSub: 'Built for contractors, foremen, masons and site offices: each section is a real screenshot of the app with sample data, and projects, stages, finance, measured statements and workers are linked.',
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
      auxKicker: 'Beyond the site',
      auxTitle: 'Side features',
      auxSub: 'If you want them, daily tasks, habits, workouts, goals, personal finance and offline reading live in the same offline app.',
      m1t: 'Today',
      m1d: 'Today’s tasks, priorities and overdue work — stays smooth with thousands of tasks.',
      m2t: 'Personal finance',
      m2d: 'Income and expense ledger, monthly charts, plus gold, USD and stock holdings — separate from project money.',
      m5t: 'Habits',
      m5d: 'Track daily habits with streaks and a weekly review.',
      m3t: 'Goals with forecasts',
      m3d: 'Target amount, monthly saving and arrival date; see whether you are ahead or behind.',
      m6t: 'Workouts',
      m6d: 'Training plans and workout days, next to the rest of your daily tasks.',
      m4t: 'Offline reading',
      m4d: 'Book shelf, PDF and Word files, sticky notes, reading timer and page and minute stats.',
      screensKicker: 'A look inside',
      screensTitle: 'The rest of the app is right here',
      screensSub: 'Projects, today, kanban, workers, finance, goals and reading — all with sample data inside the same offline window.',
      gProjects: 'Projects',
      gToday: 'Today',
      gBoard: 'Kanban',
      gWorkers: 'Workers',
      gFinance: 'Finance',
      gGoals: 'Goals',
      gReading: 'Reading',
      shotProjects: 'Projects: contract, receipts, costs, profit and progress',
      shotToday: 'Today: daily tasks, overdue items and priorities',
      shotBoard: 'Kanban: from “waiting” to “done”',
      shotWorkers: 'Workers: attendance calendar, wages and balance',
      shotFinance: 'Finance: transactions, categories and monthly chart',
      shotGoals: 'Goals: forecasting the arrival date',
      shotReading: 'Library: shelf, covers and reading progress',
      accountKicker: 'Optional account',
      accountTitle: 'No account / free account',
      accountSub: 'SAZORA needs no account for its core work. A free account is optional and adds encrypted cloud backup.',
      noAccTitle: 'No account',
      noAccSub: 'All everyday work, complete and offline.',
      noAcc1: 'Projects, build stages, finance, measured statements and workers',
      noAcc2: 'Automatic saving on the same device',
      noAcc3: 'Local backup and a JSON file in any folder you choose',
      noAcc4: 'Update checks and asset prices',
      noAccNote: 'No work data ever leaves your device.',
      accTitle: 'With a free account',
      accSub: 'For encrypted cloud backup and restoring on a new device.',
      acc1: 'Encrypted cloud backup (AES-256) in your account’s private space',
      acc2: 'Restore on a new computer with the same account',
      acc3: 'Email is used only for sign-in and password recovery',
      acc4: 'Sign in and out any time; delete the account with one email',
      accCta: 'Create a free account',
      accountFoot: 'It works fully without signing up. A free account is only needed for cloud backup.',
      noteNoCloud: 'The account is optional; the app works fully without one, and cloud backup is available inside the app.',
      downloadKicker: 'Install on Windows',
      downloadTitle: 'Install SAZORA now',
      downloadSub: 'Run the installer; your existing version and data stay in place. The installed app checks for updates when it opens.',
      downloadSetup: 'Download Setup',
      downloadReleases: 'Releases page',
      downloadAccountNote: 'It works fully without signing up. A free account is only needed for cloud backup.',
      verifyTitle: 'Check the file before you run it',
      copySha: 'Copy hash',
      verifyHow: 'Compare the value below with PowerShell (in your Downloads folder):',
      verifyVt: 'VirusTotal scan of this version',
      copied: 'SHA-256 hash copied.',
      copyFailed: 'Copy failed; select the hash manually.',
      downloadPortable: 'Portable build (ZIP)',
      downloadSums: 'SHA-256 file',
      reqTitle: 'Requirements',
      reqWebview: 'Microsoft Edge WebView2',
      reqSize: 'Installer size',
      reqVersion: 'Version',
      downloadNote: 'SAZORA is offline; core work never sends your data. Only update checks and asset price refreshes use the internet.',
      faqKicker: 'FAQ',
      faqTitle: 'Good to know before you install',
      q1: 'Do I need internet to use it?',
      a1: 'No. Projects, build stages, worker attendance, finance, goals and reading all work offline. Only update checks and optional asset price refreshes use the internet.',
      q2: 'Where is my data stored?',
      a2a: 'In IndexedDB inside the app’s WebView2 profile at',
      a2b: 'Automatic backup keeps the last 5 snapshots inside the app, and you can also keep a JSON file in a folder you choose.',
      q3: 'How does automatic updating work?',
      a3: 'The installed app checks the latest GitHub release when it opens. After you confirm, it downloads the update, verifies its SHA-256, closes, replaces the files and reopens.',
      q4: 'Are dates Jalali or Gregorian?',
      a4: 'All dates — build stages, task due dates, worker attendance and finance transactions — are shown on the Jalali calendar, with no manual conversion needed.',
      q5: 'Is my data sent to a server?',
      a5: 'It works fully offline. Signing in is optional and only needed for cloud backup. Without signing in, no work data is sent; only update checks and asset prices use the internet.',
      q6: 'Does it run on Windows 7?',
      a6: 'The minimum supported version is Windows 10 version 1809 (x64).',
      q7: 'Why create an account? What does it add?',
      a7: 'The core app works without an account. A free account is optional and adds encrypted cloud backup, restoring on a new computer and backup status; email is used only for sign-in and password recovery, and the app works fully without an account.',
      q8: 'Where is cloud backup stored and who can see it?',
      a8: 'Cloud backup is available inside the app. The backup file is encrypted with AES-256-GCM before upload, the encryption key stays on that device via DPAPI, and versions are kept in your account’s private space on Supabase. We don’t claim end-to-end encryption; we have no access to your files on your device, and the backup is not available without signing in to your account.',
      q9: 'How do I delete my account and backups?',
      a9a: 'On the account page, after signing in, use the delete-account option; cloud backups are removed too. If you can’t access it, email',
      a9b: 'Local data on your device is not removed by deleting the account; you need to delete the data folder yourself.',
      q10: 'Windows shows a SmartScreen warning — is the file safe?',
      a10: 'The installer has no commercial code-signing certificate, so SmartScreen may warn about an “unknown publisher”. Compare the SHA-256 on this page with PowerShell; if it matches, the file is the official build. For extra assurance, scan it on VirusTotal.',
      q11: 'What happens if I delete the app’s data folder?',
      a11: 'All projects, finance, attendance and local settings are lost. If you have cloud backup or a JSON file, they can be restored. Only do this after taking a backup.',
      q12: 'Does the app need WebView2?',
      a12: 'Yes, the interface runs on Microsoft Edge WebView2. If it isn’t installed, the installer tells you at that step and points you to the download.',
      newKicker: 'New in 1.9.18',
      newTitle: 'Simpler, safer backups — no password',
      newSub: 'Two clear buttons for saving and restoring, automatic cloud encryption, and direct support access.',
      newDetails: 'What changed in this version',
      stat1v: '2',
      stat1t: 'Buttons for everything',
      stat1d: '“Save data” and “Restore data”; the rest of the options live inside each button’s popup.',
      stat2v: 'AES-256',
      stat2t: 'Automatic encryption',
      stat2d: 'The app generates the key itself and keeps it on the device via DPAPI; it never asks you for a password.',
      stat3v: '3',
      stat3t: 'Restore sources',
      stat3d: 'From a file, from in-app automatic snapshots, or from cloud backup — all in one popup.',
      newItem1: 'Support email sazorasupport@gmail.com is available in Settings and on this page.',
      newItem2: 'Older password-protected backups still restore with their original password.',
      newItem3: 'Update, storage and data cleanup moved into collapsible sections.',
      fullNotes: 'See all changes on GitHub',
      nextSummary: 'Coming next (in progress): simpler data and backups',
      nextBody: 'These changes are being prepared for the desktop app and are not in the public release yet. Install the current release of this page (1.9.18).',
      next1: 'A “Data & backup” area with four clear cards: data safety, save, restore, account and cloud sync.',
      next2: 'A “💾 Save” button in the top bar for a quick backup to this device or the cloud.',
      next3: 'Compressed automatic backups (gzip, up to ~12× smaller) and a smoother Today page with large data.',
      crossKicker: 'From the same maker',
      crossTitle: 'Sortiva — keep your files in order',
      crossSub: 'Organize by type and date, use real photo dates, find duplicates and schedule automatic runs on Windows.',
      crossCta: 'Visit Sortiva',
      footerTag: 'Construction projects and finance, offline on Windows.',
      footerNote: 'Your data stays on your own device.',
      footerAbout: 'Built by Omid Masomi · code and releases on GitHub · no ads, no trackers.',
      footerLinks: 'Links',
      footerReleases: 'Releases',
      footerNotes: 'Release notes',
      footerAccount: 'Account & cloud backup',
      footerPrivacy: 'Privacy',
      footerContactPage: 'Contact us',
      footerSortiva: 'Sortiva',
      footerSupport: 'Support',
      footerDonate: 'Donate page',
      footerAuthor: 'More projects',
      footerContact: 'Contact',
      footerSite: 'Official site',
      footerRights: 'All rights reserved',
      footerMade: 'Built by Omid Masomi',
      pageTitle: 'SAZORA — Offline construction project, worker and finance manager',
      pageDesc: 'SAZORA is a free offline Windows construction project manager: contract, receipts and costs, build stages with Jalali dates, worker attendance and wages, measured statements and finance. Your data stays on your device.',
      langAria: 'Switch to Persian'
    }
  };

  var faDigits = '۰۱۲۳۴۵۶۷۸۹';
  var CFG = window.SITE_CONFIG || {};
  var repoBase = 'https://github.com/omidmasumi740-dev/sazora/releases/download/v';
  var state = {
    lang: document.documentElement.lang === 'en' ? 'en' : 'fa',
    version: CFG.VERSION || '1.9.18',
    size: Number(CFG.FILE_SIZE) || 7217290
  };

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
    document.querySelectorAll('[data-version-raw]').forEach(function (el) {
      el.textContent = state.version;
    });
  }

  function releaseFile(name) {
    return repoBase + state.version + '/' + name;
  }

  function renderRelease() {
    renderNumbers();
    var links = {
      sazora: CFG.DOWNLOAD_URL || releaseFile('SAZORA_' + state.version + '_Setup.exe'),
      'sazora-zip': releaseFile('SAZORA-Desktop-v' + state.version + '.zip'),
      'sazora-sums': releaseFile('SHA256SUMS-v' + state.version + '.txt')
    };
    Object.keys(links).forEach(function (key) {
      document.querySelectorAll('[data-download="' + key + '"]').forEach(function (el) {
        el.setAttribute('href', links[key]);
      });
    });
    document.querySelectorAll('[data-sha]').forEach(function (el) {
      el.textContent = CFG.SHA256 || '';
    });
  }

  function renderConfigNotes() {
    var t = dict[state.lang] || dict.fa;
    var cloud = CFG.CLOUD_BACKUP_ENABLED !== false;
    document.querySelectorAll('[data-cloud-item]').forEach(function (el) {
      el.hidden = !cloud;
    });
    document.querySelectorAll('[data-cloud-soon]').forEach(function (el) {
      el.hidden = cloud;
    });
    var note = cloud ? t.accountFoot : t.noteNoCloud;
    document.querySelectorAll('[data-account-note]').forEach(function (el) {
      el.textContent = note;
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

    document.title = t.pageTitle;
    setMeta('meta[name="description"]', t.pageDesc);
    setMeta('meta[property="og:title"]', t.pageTitle);
    setMeta('meta[property="og:description"]', t.pageDesc);
    setMeta('meta[property="og:locale"]', lang === 'fa' ? 'fa_IR' : 'en_US');
    setMeta('meta[name="twitter:title"]', t.pageTitle);
    setMeta('meta[name="twitter:description"]', t.pageDesc);

    var toggle = document.getElementById('langToggle');
    if (toggle) toggle.setAttribute('aria-label', t.langAria);

    renderRelease();
    renderConfigNotes();
    try {
      localStorage.setItem('sazora-lang', lang);
    } catch (e) {}
  }

  function syncUrl() {
    try {
      var url = new URL(window.location.href);
      url.searchParams.set('lang', state.lang);
      history.replaceState(null, '', url.pathname + '?' + url.searchParams.toString() + url.hash);
    } catch (e) {}
  }

  function initLanguage() {
    var param = null;
    try {
      param = new URLSearchParams(window.location.search).get('lang');
    } catch (e) {}
    if (param === 'fa' || param === 'en') {
      state.lang = param;
      return;
    }
    try {
      var stored = localStorage.getItem('sazora-lang');
      if (stored === 'fa' || stored === 'en') state.lang = stored;
    } catch (e) {}
  }

  function initGallery() {
    var gallery = document.querySelector('[data-gallery]');
    if (!gallery) return;
    var tabs = Array.prototype.slice.call(gallery.querySelectorAll('[data-gallery-tab]'));
    if (!tabs.length) return;
    var panels = {};
    gallery.querySelectorAll('[data-gallery-panel]').forEach(function (panel) {
      panels[panel.getAttribute('data-gallery-panel')] = panel;
    });

    function activate(tab, focus) {
      var name = tab.getAttribute('data-gallery-tab');
      tabs.forEach(function (t) {
        var on = t === tab;
        t.classList.toggle('is-active', on);
        t.setAttribute('aria-selected', on ? 'true' : 'false');
        t.tabIndex = on ? 0 : -1;
      });
      Object.keys(panels).forEach(function (key) {
        panels[key].hidden = key !== name;
      });
      if (focus) tab.focus();
    }

    tabs.forEach(function (tab, i) {
      tab.addEventListener('click', function () {
        activate(tab, false);
      });
      tab.addEventListener('keydown', function (e) {
        var next = null;
        var rtl = document.documentElement.dir === 'rtl';
        if (e.key === 'ArrowRight') next = i + (rtl ? -1 : 1);
        else if (e.key === 'ArrowLeft') next = i + (rtl ? 1 : -1);
        else if (e.key === 'Home') next = 0;
        else if (e.key === 'End') next = tabs.length - 1;
        if (next === null) return;
        e.preventDefault();
        activate(tabs[(next + tabs.length) % tabs.length], true);
      });
    });
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise(function (resolve, reject) {
      var area = document.createElement('textarea');
      area.value = text;
      area.setAttribute('readonly', '');
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      try {
        document.execCommand('copy') ? resolve() : reject(new Error('copy failed'));
      } catch (err) {
        reject(err);
      } finally {
        document.body.removeChild(area);
      }
    });
  }

  function initVerify() {
    var btn = document.getElementById('copySha');
    var msg = document.getElementById('copyMsg');
    if (btn && msg) {
      btn.addEventListener('click', function () {
        var t = dict[state.lang] || dict.fa;
        copyText(CFG.SHA256 || '').then(function () {
          msg.textContent = t.copied;
          msg.hidden = false;
        }).catch(function () {
          msg.textContent = t.copyFailed;
          msg.hidden = false;
        });
      });
    }
    var vt = document.getElementById('vtLink');
    if (vt) {
      if (CFG.VIRUSTOTAL_URL) vt.href = CFG.VIRUSTOTAL_URL;
      else vt.parentNode.removeChild(vt);
    }
  }

  function init() {
    initLanguage();
    applyLanguage(state.lang);
    initGallery();
    initVerify();

    var toggle = document.getElementById('langToggle');
    if (toggle) {
      toggle.addEventListener('click', function () {
        applyLanguage(state.lang === 'fa' ? 'en' : 'fa');
        syncUrl();
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
  }

  init();
})();
