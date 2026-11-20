(function () {
  'use strict';

  var dict = {
    fa: {
      skip: 'پرش به محتوا',
      navFeatures: 'ویژگی‌ها',
      navNew: 'تازه‌ها',
      navScreens: 'تصاویر',
      navDownload: 'دانلود',
      navFaq: 'سوالات',
      downloadShort: 'دانلود',
      heroBadgePrefix: 'نسخهٔ',
      heroBadgeSuffix: 'منتشر شد',
      heroTitle: 'همهٔ کارهایت، در یک جای آرام و <span class="grad">آفلاین.</span>',
      heroLede: 'کارهای روزانه، پروژه‌های ساختمانی، کارگران، مالی، اهداف و کتاب‌خوانی — یک دستیار ویندوز که بدون اینترنت هم کامل کار می‌کند و داده‌هایت را روی دستگاه خودت نگه می‌دارد.',
      heroCta: 'دانلود نسخهٔ ویندوز',
      heroSecondary: 'دیدن قابلیت‌ها',
      heroNote: 'نسخهٔ',
      heroPoint1: 'بدون نیاز به اینترنت برای کار روزانه',
      heroPoint2: 'داده‌ها روی دستگاه؛ بدون حساب آنلاین',
      heroPoint3: 'پشتیبان خودکار و به‌روزرسانی داخل برنامه',
      windowReading: 'کتاب‌خوانی',
      floatBackup: 'پشتیبان خودکار',
      floatBackupSub: '۵ نسخهٔ آخر، داخل برنامه',
      floatTimer: '۲۴ دقیقه تمرکز',
      floatTimerSub: 'تایمر مطالعه و پومودورو',
      trust1: 'آفلاین و خصوصی',
      trust2: 'کاملاً فارسی و راست‌چین',
      trust3: 'به‌روزرسانی یک‌کلیکی',
      featuresKicker: 'یک اپ، تمام کارها',
      featuresTitle: 'از کار روزانه تا پروژه و مالی',
      featuresSub: 'بخش‌ها به هم وصل‌اند: کارها، پروژه‌ها، کارگران، هزینه‌ها و اهداف در یک تصویر روشن.',
      f1t: 'امروز',
      f1d: 'کارهای امروز، اولویت‌ها و کارهای عقب‌افتاده؛ با پشتیبانی از هزاران تسک بدون کندی.',
      f2t: 'کانبان',
      f2d: 'کارت‌ها را بکش و رها کن؛ از فهرست تا در حال انجام، متوقف و انجام‌شده.',
      f3t: 'پروژه‌های ساختمانی',
      f3d: 'قرارداد، دریافتی، هزینه، سود، مراحل اجرا، عکس نمونه‌کار و صورت‌وضعیت متراژ.',
      f4t: 'کارکرد کارگران',
      f4d: 'تقویم روزانه، ساعت کار، مزد هفتگی و ماهانه، پرداخت‌ها و مانده حساب هر نیرو.',
      f5t: 'مالی و سرمایه‌گذاری',
      f5d: 'دفتر دریافتی و پرداختی، دسته‌بندی هزینه‌ها، نمودار ماهانه و سبد طلا، دلار و سهام.',
      f6t: 'اهداف با پیش‌بینی',
      f6d: 'مبلغ هدف، کنارگذاری ماهانه و زمان رسیدن؛ جلوتر یا عقب‌تر بودن مسیر را ببین.',
      f7t: 'کتاب‌خوانی آفلاین',
      f7d: 'قفسهٔ کتاب، PDF و Word، یادداشت چسبان، تایمر مطالعه و آمار صفحه و دقیقه.',
      f8t: 'یادگیری، تمرکز و باشگاه',
      f8d: 'عادت‌های روزانه، پومودورو، گزارش هفتگی، تمرین باشگاه و عکس‌های پیشرفت بدن.',
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
      screensTitle: 'آرام، خوانا و ساخته‌شده برای هر روز',
      screensSub: 'کتاب‌خانه، حالت مطالعه و تایمر؛ نمونه‌ای از بخش کتاب‌خوانی SAZORA.',
      shot1: 'قفسهٔ کتاب با پیشرفت مطالعه، وضعیت و آمار روزانه',
      shot2: 'حالت مطالعه با تایمر، یادداشت و تنظیم اندازهٔ متن',
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
      a1: 'نه. کارها، پروژه‌ها، مالی، اهداف و کتاب‌خوانی آفلاین کار می‌کنند. فقط بررسی به‌روزرسانی و به‌روزرسانی قیمت دارایی‌ها از اینترنت استفاده می‌کند.',
      q2: 'داده‌هایم کجا ذخیره می‌شود؟',
      a2: 'داخل IndexedDB مرورگر داخلی برنامه در مسیر <code>%LocalAppData%\\SAZORA\\WebView2Data</code>. پشتیبان خودکار هم آخرین ۵ نسخه را داخل برنامه نگه می‌دارد و می‌توانید یک فایل JSON هم در پوشهٔ دلخواه داشته باشید.',
      q3: 'به‌روزرسانی خودکار چطور کار می‌کند؟',
      a3: 'نسخهٔ نصبی هنگام باز شدن، آخرین انتشار GitHub را بررسی می‌کند. با تأیید شما فایل به‌روزرسانی دانلود و SHA-256 آن بررسی می‌شود، سپس برنامه بسته، جایگزین و دوباره باز می‌شود.',
      q4: 'کتاب‌خوان چه فایل‌هایی را باز می‌کند؟',
      a4: 'PDF و اسناد Word به‌صورت آفلاین. قفسه، جلد، یادداشت چسبان، تایمر مطالعه و آمار صفحه و دقیقه هم در همان بخش است.',
      q5: 'آیا داده‌ها به سروری فرستاده می‌شوند؟',
      a5: 'نه. SAZORA برای کار اصلی به حساب کاربری یا سرور نیاز ندارد؛ داده‌ها روی همان ویندوز شما می‌مانند.',
      q6: 'روی ویندوز ۷ اجرا می‌شود؟',
      a6: 'حداقل نسخهٔ پشتیبانی‌شده Windows 10 نسخهٔ 1809 (x64) است. WebView2 هم لازم است؛ اگر نصب نباشد، نصب‌کننده راهنمایی می‌کند.',
      crossKicker: 'از همین سازنده',
      crossTitle: 'Sortiva — فایل‌هایت را مرتب کن',
      crossSub: 'مرتب‌سازی فایل‌ها بر اساس نوع و تاریخ، تاریخ واقعی عکس‌ها، پیدا کردن تکراری‌ها و زمان‌بندی خودکار برای ویندوز.',
      crossCta: 'دیدن سایت Sortiva',
      footerTag: 'دستیار آفلاین کار، پروژه، مالی و اهداف.',
      footerNote: 'داده‌های شما روی دستگاه خودتان می‌ماند.',
      footerLinks: 'لینک‌ها',
      footerReleases: 'انتشارها',
      footerNotes: 'تغییرات نسخه',
      footerSortiva: 'Sortiva',
      footerSupport: 'حمایت',
      footerDonate: 'صفحهٔ دونیت',
      footerAuthor: 'سایر پروژه‌ها',
      footerRights: 'همهٔ حقوق محفوظ است',
      footerMade: 'ساختهٔ Omid Masomi',
      pageTitle: 'SAZORA — دستیار آفلاین کار، پروژه، مالی و اهداف',
      pageDesc: 'SAZORA یک دستیار آفلاین برای مدیریت کارهای روزانه، پروژه‌های ساختمانی، کارگران، مالی، اهداف و کتاب‌خوانی است. داده‌ها روی دستگاه خودتان می‌ماند.',
      langAria: 'تغییر زبان به انگلیسی'
    },
    en: {
      skip: 'Skip to content',
      navFeatures: 'Features',
      navNew: "What's new",
      navScreens: 'Screenshots',
      navDownload: 'Download',
      navFaq: 'FAQ',
      downloadShort: 'Download',
      heroBadgePrefix: 'Version',
      heroBadgeSuffix: 'is out',
      heroTitle: 'All your work, in one quiet <span class="grad">offline place.</span>',
      heroLede: 'Daily tasks, construction projects, workers, finance, goals and reading — a Windows assistant that works fully offline and keeps your data on your own machine.',
      heroCta: 'Download for Windows',
      heroSecondary: 'Explore features',
      heroNote: 'Version',
      heroPoint1: 'No internet needed for daily work',
      heroPoint2: 'Data stays local; no online account',
      heroPoint3: 'Automatic backups and in-app updates',
      windowReading: 'Reading',
      floatBackup: 'Automatic backup',
      floatBackupSub: 'Last 5 snapshots, in-app',
      floatTimer: '24 min focus',
      floatTimerSub: 'Reading timer and Pomodoro',
      trust1: 'Offline and private',
      trust2: 'Fully Persian, RTL-native',
      trust3: 'One-click updates',
      featuresKicker: 'One app, every part of the work',
      featuresTitle: 'From daily tasks to projects and finance',
      featuresSub: 'The sections connect: tasks, projects, workers, costs and goals in one clear picture.',
      f1t: 'Today',
      f1d: 'Today’s tasks, priorities and overdue work; stays smooth with thousands of tasks.',
      f2t: 'Kanban',
      f2d: 'Drag cards across To do, Doing, Waiting and Done — a board that matches how work moves.',
      f3t: 'Construction projects',
      f3d: 'Contract, receipts, costs, profit, build stages, portfolio photos and measured statements.',
      f4t: 'Worker attendance',
      f4d: 'Daily calendar, hours, weekly and monthly wages, payments and each worker’s balance.',
      f5t: 'Finance & investments',
      f5d: 'Income and expense ledger, categories, monthly charts, plus gold, USD and stock holdings.',
      f6t: 'Goals with forecasts',
      f6d: 'Target amount, monthly saving and arrival date; see whether you are ahead or behind.',
      f7t: 'Offline reading',
      f7d: 'Book shelf, PDF and Word files, sticky notes, reading timer and page and minute stats.',
      f8t: 'Habits, focus & gym',
      f8d: 'Daily habits, Pomodoro, weekly reports, workout log and body progress photos.',
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
      screensTitle: 'Calm, readable and made for every day',
      screensSub: 'The library, the reading session and the timer — a sample of SAZORA’s reading section.',
      shot1: 'Book shelf with progress, status and daily reading stats',
      shot2: 'Reading mode with timer, notes and text size controls',
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
      a1: 'No. Tasks, projects, finance, goals and reading all work offline. Only update checks and optional asset price refreshes use the internet.',
      q2: 'Where is my data stored?',
      a2: 'In IndexedDB inside the app’s WebView2 profile at <code>%LocalAppData%\\SAZORA\\WebView2Data</code>. Automatic backup keeps the last 5 snapshots inside the app, and you can also keep a JSON file in a folder you choose.',
      q3: 'How does automatic updating work?',
      a3: 'The installed app checks the latest GitHub release when it opens. After you confirm, it downloads the update, verifies its SHA-256, closes, replaces the files and reopens.',
      q4: 'Which files can the reader open?',
      a4: 'PDF and Word documents, fully offline. The shelf, covers, sticky notes, reading timer and page and minute stats live in the same section.',
      q5: 'Is my data sent to a server?',
      a5: 'No. SAZORA needs no account or server for its core work; your data stays on your Windows machine.',
      q6: 'Does it run on Windows 7?',
      a6: 'The minimum supported version is Windows 10 version 1809 (x64). WebView2 is also required; the installer guides you if it is missing.',
      crossKicker: 'From the same maker',
      crossTitle: 'Sortiva — keep your files in order',
      crossSub: 'Organize by type and date, use real photo dates, find duplicates and schedule automatic runs on Windows.',
      crossCta: 'Visit Sortiva',
      footerTag: 'An offline assistant for tasks, projects, finance and goals.',
      footerNote: 'Your data stays on your own device.',
      footerLinks: 'Links',
      footerReleases: 'Releases',
      footerNotes: 'Release notes',
      footerSortiva: 'Sortiva',
      footerSupport: 'Support',
      footerDonate: 'Donate page',
      footerAuthor: 'More projects',
      footerRights: 'All rights reserved',
      footerMade: 'Built by Omid Masomi',
      pageTitle: 'SAZORA — Offline tasks, projects, finance and goals',
      pageDesc: 'SAZORA is an offline assistant for daily tasks, construction projects, workers, finance, goals and reading. Your data stays on your device.',
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
