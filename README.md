# SAZORA

دستیار آفلاین مدیریت کار، پروژه‌های ساختمانی، مالی، اهداف و مطالعه.

SAZORA is an offline-first desktop assistant for tasks, construction projects, finance, goals and reading. Your data stays on your device (IndexedDB inside WebView2).

## دانلود و نصب

از صفحهٔ [Releases](https://github.com/omidmasumi740-dev/sazora/releases/latest) استفاده کنید:

| فایل | کاربرد |
|---|---|
| `SAZORA_1.9.23_Setup.exe` | نصب معمول ویندوز |
| `SAZORA-Desktop-v1.9.23.zip` | نسخهٔ کامل برای اجرای Portable / نصب دستی |
| `SAZORA-Update-v1.9.23.zip` | فایل به‌روزرسانی داخل اپ (محتوای ZIP در ریشه است) |
| `SHA256SUMS.txt` | هش SHA-256 همهٔ فایل‌های انتشار |

نیازمندی‌ها: Windows 10/11 (x64) و Microsoft Edge WebView2 Runtime.

## به‌روزرسانی آنلاین

در نسخهٔ نصبی ویندوز:

1. برنامه هنگام باز شدن، به‌صورت خودکار آخرین انتشار را از GitHub می‌خواند (قابل خاموش‌کردن در **تنظیمات → به‌روزرسانی**).
2. اگر نسخهٔ جدید باشد، نوار «نسخهٔ جدید آماده است» نمایش داده می‌شود.
3. با یک کلیک، فایل `SAZORA-Update-vX.Y.Z.zip` دانلود و SHA-256 آن بررسی می‌شود.
4. پس از پایان، اپ بسته می‌شود، محتوای ZIP روی پوشهٔ نصب جایگزین می‌شود و اپ دوباره باز می‌شود.

بررسی دستی هم از **تنظیمات → به‌روزرسانی → بررسی برای به‌روزرسانی** و نصب دستی از فایل ZIP در همان تب ممکن است.

داده‌های کاربر در `%LocalAppData%\SAZORA\WebView2Data` نگهداری می‌شود و در به‌روزرسانی دست‌نخورده می‌ماند.

- بررسی نسخه از `https://api.github.com/repos/omidmasumi740-dev/sazora/releases/latest` انجام می‌شود (مخزن عمومی است و توکن لازم ندارد).
- دانلود در میزبان C# انجام می‌شود تا محدودیت CORS مرورگر مشکلی ایجاد نکند.
- اگر GitHub فیلد `digest` را برای asset برگرداند، SHA-256 فایل دانلودشده قبل از نصب بررسی می‌شود.
- نصب دستی از فایل ZIP نیز در همان تب وجود دارد.

## ساخت از سورس

پیش‌نیازها:

- Node.js 20+ و npm
- .NET Framework 4.8 (شامل `csc.exe`)
- Inno Setup 7 (برای ساخت Setup)
- فایل‌های WebView2 SDK: `Microsoft.Web.WebView2.Core.dll`، `Microsoft.Web.WebView2.WinForms.dll` و `WebView2Loader.dll` در پوشهٔ `desktop-host`

مراحل:

```powershell
cd web
npm ci
npm run build

cd ..
Remove-Item desktop-host/app -Recurse -Force -ErrorAction SilentlyContinue
Copy-Item web/dist desktop-host/app -Recurse

cd desktop-host
.\BUILD.bat
```

`BUILD.bat` فایل `SAZORA.exe` را می‌سازد و سپس با Inno Setup فایل نصب را در `desktop-host/installer/` تولید می‌کند.

برای ساخت دستی ZIP به‌روزرسانی، محتوای زیر باید **در ریشهٔ ZIP** باشد:

```text
app/
SAZORA.exe
app.ico
Microsoft.Web.WebView2.Core.dll
Microsoft.Web.WebView2.WinForms.dll
WebView2Loader.dll
README-DESKTOP.txt
```

## انتشار نسخهٔ جدید

نسخه را در این فایل‌ها هم‌زمان تغییر دهید:

- `web/package.json` → `version`
- `web/src/lib/updater.ts` → `APP_VERSION`
- `desktop-host/installer.iss` → `MyAppVersion` و `OutputBaseFilename`
- `desktop-host/BUILD.bat` و `README-DESKTOP.txt` در صورت نیاز

سپس:

```powershell
git add .
git commit -m "Release vX.Y.Z"
git tag vX.Y.Z
git push origin main --tags
gh release create vX.Y.Z release/SAZORA-Update-vX.Y.Z.zip release/SAZORA-Desktop-vX.Y.Z.zip release/SAZORA_X.Y.Z_Setup.exe release/SHA256SUMS.txt --title "SAZORA vX.Y.Z" --notes-file release-notes.md
```

## ساختار مخزن

```text
web/                 اپ React + Vite + TypeScript + Tailwind + Dexie
  src/lib/updater.ts پل WebView2 و بررسی/دانلود به‌روزرسانی
desktop-host/        میزبان C# WinForms + WebView2 + HttpListener
  Sazora.cs          پل پیام، بررسی GitHub، دانلود و نصب
  installer.iss      اسکریپت Inno Setup 7
  BUILD.bat          بیلد کامل ویندوز
README.md
SAZORA-ROADMAP-v1.9.23.md
```

## مجوز

این پروژه `UNLICENSED` است؛ همهٔ حقوق محفوظ است.
