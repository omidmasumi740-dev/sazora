SAZORA Web App v1.9.13
=====================

HOW TO RUN (from source):
1. Install Node.js (https://nodejs.org) — version 20 or newer
2. Double-click "run-web.bat"
   - The first run installs dependencies (needs internet) and builds the app
   - Then it serves the app and opens http://localhost:5180 automatically
3. Keep the black console window open while using the app

Manual run (alternative):
  npm install
  npm run build
  npm run preview      (or: node serve.cjs)

NOTE: Do NOT open index.html directly by double-clicking it.
The app needs a local HTTP server (IndexedDB + ES modules).

DEVELOPMENT:
  npm run dev          opens Vite dev server on http://localhost:5180

DATA:
- Everything is stored offline in the browser IndexedDB.
- Use Settings -> Data to export/import a JSON backup.
- Browser data clearing will erase the app data, so keep a backup.
- Data is tied to the address it was created on (localhost:5180).

For more help, visit: https://github.com/omidmasumi740-dev
