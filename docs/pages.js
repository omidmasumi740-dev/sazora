(function () {
  'use strict';

  var CFG = window.SITE_CONFIG || {};
  var repoBase = 'https://github.com/omidmasumi740-dev/sazora/releases/download/v';

  var common = {
    fa: {
      skip: 'پرش به محتوا',
      navFeatures: 'پروژه و کارگاه',
      navAccount: 'حساب',
      navScreens: 'تصاویر',
      navDownload: 'دانلود',
      navFaq: 'سوالات',
      downloadShort: 'دانلود',
      backHome: 'بازگشت به صفحهٔ اصلی',
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
      backHome: 'Back to home',
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
      langAria: 'Switch to Persian'
    }
  };

  var pages = {
    account: {
      fa: {
        title: 'SAZORA — حساب و پشتیبان ابری',
        kicker: 'حساب اختیاری',
        heading: 'حساب رایگان SAZORA',
        lead: 'کار اصلی اپ بدون حساب است. حساب رایگان اختیاری است و فقط برای بکاپ ابری رمزنگاری‌شده و بازیابی روی رایانهٔ جدید است.',
        statusTitle: 'ساخت حساب داخل خود برنامه انجام می‌شود',
        statusBody: 'این وب‌سایت فرم ثبت‌نام ندارد؛ ثبت‌نام و ورود با ایمیل داخل SAZORA است و نشست با DPAPI روی همان دستگاه ذخیره می‌شود. اپ بدون حساب هم کامل کار می‌کند و داده‌ها به‌طور پیش‌فرض روی دستگاه می‌ماند. برای حذف حساب یا پشتیبان‌های ابری از صفحهٔ حساب داخل برنامه یا ایمیل پشتیبانی استفاده کنید.',
        cloudTitle: 'حساب رایگان چه چیزی اضافه می‌کند؟',
        cloud1: 'پشتیبان ابری رمزنگاری‌شده (AES-256) در فضای خصوصی حساب',
        cloud2: 'بازیابی روی رایانهٔ جدید با همان حساب',
        cloud3: 'دیدن وضعیت پشتیبان‌ها و حذف حساب',
        localTitle: 'داده‌های محلی',
        localBody: 'پروژه‌ها، مالی، کارکرد کارگران و تنظیمات روی همان دستگاه می‌مانند. حذف حساب، داده‌های محلی را پاک نمی‌کند؛ برای پاک‌کردن کامل، پوشهٔ داده را خودتان حذف کنید.',
        deleteTitle: 'حذف حساب',
        deleteBody1: 'اگر حساب دارید و می‌خواهید آن را با همهٔ پشتیبان‌های ابری حذف کنید، از صفحهٔ حساب داخل برنامه اقدام کنید یا به',
        deleteBody2: 'ایمیل بزنید. داده‌های محلی روی دستگاه با این کار پاک نمی‌شوند.',
        mailCta: 'ایمیل به پشتیبانی',
        downloadCta: 'دانلود SAZORA',
        note: 'حساب اختیاری است؛ نصب و استفادهٔ کامل بدون ثبت‌نام ممکن است.'
      },
      en: {
        title: 'SAZORA — Account and cloud backup',
        kicker: 'Optional account',
        heading: 'Your free SAZORA account',
        lead: 'The core app needs no account. A free account is optional and only adds encrypted cloud backup and restoring on a new computer.',
        statusTitle: 'Accounts are created inside the app',
        statusBody: 'This website has no sign-up form; email sign-up and sign-in happen inside SAZORA, and the session is stored on that device with DPAPI. The app works fully without an account, and data stays on your device by default. To delete an account or its cloud backups, use the account page inside the app or the support email.',
        cloudTitle: 'What does a free account add?',
        cloud1: 'Encrypted cloud backup (AES-256) in your account’s private space',
        cloud2: 'Restore on a new computer with the same account',
        cloud3: 'See backup status and delete the account',
        localTitle: 'Local data',
        localBody: 'Projects, finance, worker attendance and settings stay on the same device. Deleting the account does not erase local data; to remove it completely, delete the data folder yourself.',
        deleteTitle: 'Delete your account',
        deleteBody1: 'If you have an account and want it deleted along with all cloud backups, use the account page inside the app or email',
        deleteBody2: 'Local data on your device is not removed by this request.',
        mailCta: 'Email support',
        downloadCta: 'Download SAZORA',
        note: 'The account is optional; installing and using the full app without signing up works.'
      }
    },
    privacy: {
      fa: {
        title: 'SAZORA — حریم خصوصی',
        kicker: 'حریم خصوصی',
        heading: 'حریم خصوصی SAZORA',
        lead: 'این صفحه توضیح می‌دهد SAZORA چه داده‌ای را روی دستگاه نگه می‌دارد، چه چیزی به اینترنت می‌رود و چه چیزی نمی‌رود.',
        s1t: 'داده‌های کاری روی دستگاه شماست',
        s1b1: 'پروژه‌ها، قراردادها، مالی، کارکرد کارگران، اهداف، عادت‌ها و کتاب‌ها داخل IndexedDB مرورگر داخلی برنامه در مسیر',
        s1b2: 'ذخیره می‌شوند. این داده‌ها به سرور SAZORA ارسال نمی‌شوند.',
        s2t: 'پشتیبان ابری فقط با حساب شما',
        s2b: 'بکاپ ابری داخل برنامه فعال است. اگر حساب بسازید و بکاپ ابری را روشن کنید، فایل پشتیبان قبل از آپلود با AES-256-GCM رمزنگاری می‌شود و در فضای خصوصی حساب شما در Supabase ذخیره می‌شود؛ بازیابی فقط با ورود همان حساب ممکن است. ما ادعای رمزنگاری سرتاسری نمی‌کنیم و به فایل‌های دستگاه شما دسترسی نداریم.',
        s3t: 'اینترنت چه زمانی استفاده می‌شود؟',
        s3b: 'فقط برای بررسی به‌روزرسانی، به‌روزرسانی قیمت دارایی‌ها و ورود اختیاری به حساب. اگر از این موارد استفاده نکنید، برنامه کاملاً آفلاین کار می‌کند.',
        s4t: 'این وب‌سایت',
        s4b: 'سایت SAZORA هیچ تبلیغ، ردیاب یا ابزار تحلیلی شخص ثالث ندارد. فونت و تصاویر از همان دامنه بارگذاری می‌شوند. فرم آنلاین نداریم؛ ارتباط از طریق ایمیل است.',
        s5t: 'حذف داده و حساب',
        s5b1: 'برای حذف حساب و پشتیبان‌های ابری، به',
        s5b2: 'ایمیل بزنید. داده‌های محلی با حذف حساب پاک نمی‌شوند و باید پوشهٔ داده را خودتان حذف کنید.',
        s6t: 'تغییرات این سیاست',
        s6b: 'اگر این سیاست تغییر کند، همین صفحه به‌روزرسانی می‌شود و تاریخ بالای صفحه عوض می‌شود.',
        updated: 'آخرین به‌روزرسانی: آبان ۱۴۰۵'
      },
      en: {
        title: 'SAZORA — Privacy',
        kicker: 'Privacy',
        heading: 'SAZORA privacy',
        lead: 'This page explains what data SAZORA keeps on your device, what goes to the internet and what never does.',
        s1t: 'Your work data stays on your device',
        s1b1: 'Projects, contracts, finance, worker attendance, goals, habits and books are stored in IndexedDB inside the app’s WebView2 profile at',
        s1b2: 'This data is never sent to a SAZORA server.',
        s2t: 'Cloud backup only with your account',
        s2b: 'Cloud backup is available inside the app. If you create an account and turn it on, the backup file is encrypted with AES-256-GCM before upload and stored in your account’s private space on Supabase; it can only be restored by signing in to that account. We don’t claim end-to-end encryption and we have no access to files on your device.',
        s3t: 'When is the internet used?',
        s3b: 'Only for update checks, asset price refreshes and optional account sign-in. If you don’t use those, the app works fully offline.',
        s4t: 'This website',
        s4b: 'The SAZORA site has no ads, trackers or third-party analytics. Fonts and images load from the same domain. There is no online form; contact happens by email.',
        s5t: 'Deleting data and accounts',
        s5b1: 'To delete your account and cloud backups, email',
        s5b2: 'Local data is not removed by deleting the account; you need to delete the data folder yourself.',
        s6t: 'Changes to this policy',
        s6b: 'If this policy changes, this page is updated and the date at the top changes.',
        updated: 'Last updated: November 2026'
      }
    },
    contact: {
      fa: {
        title: 'SAZORA — تماس با ما',
        kicker: 'پشتیبانی',
        heading: 'با SAZORA در تماس باشید',
        lead: 'پرسش، گزارش خطا یا درخواست حذف حساب را از طریق ایمیل بفرستید. فرم آنلاین نداریم و ایمیل شما جای دیگری استفاده نمی‌شود.',
        emailLabel: 'ایمیل پشتیبانی',
        responseLabel: 'زمان پاسخ',
        responseBody: 'معمولاً تا ۲ روز کاری.',
        issuesLabel: 'برای گزارش خطا',
        issuesBody: 'نسخهٔ برنامه (مثلاً ۱٫۹٫۲۲)، نسخهٔ ویندوز و توضیح کوتاه مشکل را بنویسید. اگر ممکن است، تصویر صفحه را هم بفرستید.',
        deleteLabel: 'حذف حساب',
        deleteBody: 'از همان ایمیل حساب پیام بدهید تا پشتیبان‌های ابری هم پاک شوند.',
        home: 'بازگشت به صفحهٔ اصلی'
      },
      en: {
        title: 'SAZORA — Contact us',
        kicker: 'Support',
        heading: 'Get in touch with SAZORA',
        lead: 'Send questions, bug reports or account-deletion requests by email. There is no online form, and your email is not used anywhere else.',
        emailLabel: 'Support email',
        responseLabel: 'Response time',
        responseBody: 'Usually within 2 business days.',
        issuesLabel: 'Reporting a bug',
        issuesBody: 'Include the app version (for example 1.9.22), your Windows version and a short description of the problem. If you can, attach a screenshot.',
        deleteLabel: 'Account deletion',
        deleteBody: 'Write from the account’s email so cloud backups can be removed too.',
        home: 'Back to home'
      }
    },
    notfound: {
      fa: {
        title: 'SAZORA — صفحه پیدا نشد',
        kicker: 'خطای ۴۰۴',
        heading: 'این صفحه پیدا نشد',
        body: 'نشانی اشتباه است یا صفحه جابه‌جا شده است.',
        home: 'بازگشت به صفحهٔ اصلی',
        download: 'دانلود SAZORA'
      },
      en: {
        title: 'SAZORA — Page not found',
        kicker: 'Error 404',
        heading: 'This page was not found',
        body: 'The address is wrong or the page has moved.',
        home: 'Back to home',
        download: 'Download SAZORA'
      }
    }
  };

  var state = {
    lang: document.documentElement.lang === 'en' ? 'en' : 'fa',
    page: document.body.getAttribute('data-page') || ''
  };

  function mergeDict(lang) {
    var t = {};
    var base = common[lang] || common.fa;
    Object.keys(base).forEach(function (k) { t[k] = base[k]; });
    var extra = (pages[state.page] || {})[lang] || (pages[state.page] || {}).fa || {};
    Object.keys(extra).forEach(function (k) { t[k] = extra[k]; });
    return t;
  }

  function applyLanguage(lang) {
    state.lang = lang;
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'fa' ? 'rtl' : 'ltr';
    var t = mergeDict(lang);

    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      var key = el.getAttribute('data-i18n');
      if (t[key] != null) el.textContent = t[key];
    });

    document.title = t.title || document.title;

    var toggle = document.getElementById('langToggle');
    if (toggle) toggle.setAttribute('aria-label', t.langAria);

    if (CFG.CONTACT_EMAIL) {
      document.querySelectorAll('[data-email]').forEach(function (el) {
        el.setAttribute('href', 'mailto:' + CFG.CONTACT_EMAIL);
        el.textContent = CFG.CONTACT_EMAIL;
      });
    }

    var version = CFG.VERSION || '1.9.22';
    var dl = CFG.DOWNLOAD_URL || repoBase + version + '/SAZORA_' + version + '_Setup.exe';
    document.querySelectorAll('[data-download="sazora"]').forEach(function (el) {
      el.setAttribute('href', dl);
    });
    document.querySelectorAll('[data-version]').forEach(function (el) {
      el.textContent = version;
    });

    try {
      localStorage.setItem('sazora-lang', lang);
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

  function syncUrl() {
    try {
      var url = new URL(window.location.href);
      url.searchParams.set('lang', state.lang);
      history.replaceState(null, '', url.pathname + '?' + url.searchParams.toString() + url.hash);
    } catch (e) {}
  }

  function init() {
    initLanguage();
    applyLanguage(state.lang);

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
