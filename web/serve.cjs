/* SAZORA Web — سرور محلی سبک برای اجرای نسخه وب (بدون نیاز به Python) */
const http = require('http')
const fs = require('fs')
const path = require('path')

const DIST = path.join(__dirname, 'dist')
// اگر نسخهٔ ساخته‌شده وجود دارد همان را سرو کن؛ در غیر این صورت پوشهٔ پروژه
const ROOT = fs.existsSync(path.join(DIST, 'index.html')) ? DIST : __dirname
const PORT = Number(process.env.PORT || 5180)
const HOST = '127.0.0.1'

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.map': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
}

const server = http.createServer((req, res) => {
  let urlPath = decodeURIComponent((req.url || '/').split('?')[0])
  if (urlPath === '/' || urlPath === '') urlPath = '/index.html'
  const file = path.join(ROOT, urlPath)
  // جلوگیری از خروج از پوشه اپ
  const rel = path.relative(ROOT, file)
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    res.writeHead(403)
    res.end('Forbidden')
    return
  }
  fs.readFile(file, (err, data) => {
    if (err) {
      // مسیرهای SPA به index.html برمی‌گردند
      fs.readFile(path.join(ROOT, 'index.html'), (e2, html) => {
        if (e2) {
          res.writeHead(404)
          res.end('Not found')
        } else {
          res.writeHead(200, { 'Content-Type': MIME['.html'] })
          res.end(html)
        }
      })
      return
    }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
    })
    res.end(data)
  })
})

server.listen(PORT, HOST, () => {
  console.log(`SAZORA web server running at http://localhost:${PORT}`)
})
