import { Component, useEffect, useRef, useState, type ReactNode } from 'react'
import { HashRouter, Routes, Route, useLocation, useNavigate, Navigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './db/schema'
import { Sidebar, Topbar } from './ui/layout'
import TodayPage from './pages/Today'
import InboxPage from './pages/Inbox'
import ProjectsPage from './pages/Projects'
import ProjectDetail from './pages/ProjectDetail'
import WorkersPage from './pages/Workers'
import FinancePage from './pages/Finance'
import GoalsPage from './pages/Goals'
import LearnPage from './pages/Learn'
import ClubPage from './pages/Club'
import BoardPage from './pages/Board'
import SettingsPage from './pages/Settings'
import { useAutoBackup } from './lib/autoBackup'
import { useCategorySync } from './lib/categories'

const TITLES: Record<string, string> = {
  '/': 'nav.today',
  '/inbox': 'nav.inbox',
  '/projects': 'nav.projects',
  '/workers': 'nav.workers',
  '/finance': 'nav.finance',
  '/goals': 'nav.goals',
  '/learn': 'nav.learn',
  '/club': 'nav.club',
  '/board': 'nav.board',
  '/settings': 'nav.settings',
}

/** رویداد سفارشی برای باز کردن سرچ از هر جای اپ */
export function openGlobalSearch() {
  window.dispatchEvent(new CustomEvent('sazora:search'))
}

/** مودال جست‌وجوی سراسری — با Ctrl+K یا دکمه سرچ باز می‌شود */
function GlobalSearch() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')

  useEffect(() => {
    const onEvent = () => {
      setQ('')
      setOpen(true)
    }
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setQ('')
        setOpen(true)
      } else if (e.key === 'Escape') {
        setOpen(false)
      }
    }
    window.addEventListener('sazora:search', onEvent)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('sazora:search', onEvent)
      window.removeEventListener('keydown', onKey)
    }
  }, [])

  const tasks = useLiveQuery(() => db.tasks.toArray(), [], [])
  const projects = useLiveQuery(() => db.projects.toArray(), [], [])
  const workers = useLiveQuery(() => db.workers.toArray(), [], [])
  const transactions = useLiveQuery(() => db.transactions.toArray(), [], [])

  function go(path: string) {
    setOpen(false)
    setQ('')
    navigate(path)
  }

  if (!open) return null

  const needle = q.trim().toLowerCase()
  const hasQuery = needle.length > 0
  const match = (s: string | null | undefined) =>
    hasQuery && (s ?? '').toLowerCase().includes(needle)

  const foundTasks = hasQuery
    ? tasks.filter((x) => match(x.title) || match(x.notes)).slice(0, 8)
    : []
  const foundProjects = hasQuery ? projects.filter((p) => match(p.name)).slice(0, 8) : []
  const foundWorkers = hasQuery
    ? workers.filter((w) => match(w.name) || match(w.role)).slice(0, 8)
    : []
  const foundTx = hasQuery
    ? transactions
        .filter((x) => match(x.category) || match(x.note))
        .slice(0, 8)
    : []

  const groups: { label: string; rows: { key: string; title: string; sub?: string; path: string }[] }[] = [
    {
      label: t('nav.today'),
      rows: foundTasks.map((x) => ({
        key: `t-${x.id}`,
        title: x.title,
        sub: x.notes?.slice(0, 60),
        path: '/',
      })),
    },
    {
      label: t('nav.projects'),
      rows: foundProjects.map((p) => ({
        key: `p-${p.id}`,
        title: p.name,
        path: `/projects/${p.id}`,
      })),
    },
    {
      label: t('nav.workers'),
      rows: foundWorkers.map((w) => ({
        key: `w-${w.id}`,
        title: w.name,
        sub: w.role,
        path: '/workers',
      })),
    },
    {
      label: t('nav.finance'),
      rows: foundTx.map((x) => ({
        key: `x-${x.id}`,
        title: x.category,
        sub: x.note?.slice(0, 60),
        path: '/finance',
      })),
    },
  ]
  const total = groups.reduce((n, g) => n + g.rows.length, 0)

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
      <div className="absolute top-[12%] start-1/2 -translate-x-1/2 rtl:translate-x-1/2 w-[min(560px,92vw)] bg-surface border border-line rounded-xl shadow-float overflow-hidden">
        <div className="p-3 border-b border-line">
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t('common.search')}
            className="w-full bg-surface-2 border border-line rounded-lg px-3 py-2 text-[14px] outline-none focus:border-accent"
          />
        </div>
        <div className="max-h-[50vh] overflow-y-auto p-2">
          {!hasQuery ? (
            <div className="text-[12.5px] text-faint text-center py-6">
              {t('common.search')}… (Ctrl+K)
            </div>
          ) : total === 0 ? (
            <div className="text-[12.5px] text-faint text-center py-6">موردی پیدا نشد</div>
          ) : (
            groups
              .filter((g) => g.rows.length > 0)
              .map((g) => (
                <div key={g.label} className="mb-2">
                  <div className="text-[11px] text-faint font-semibold px-2 py-1">{g.label}</div>
                  {g.rows.map((r) => (
                    <button
                      key={r.key}
                      className="w-full text-start px-3 py-2 rounded-lg hover:bg-surface-2 transition-colors"
                      onClick={() => go(r.path)}
                    >
                      <div className="text-[13.5px] font-semibold truncate">{r.title}</div>
                      {r.sub ? (
                        <div className="text-[11.5px] text-faint truncate">{r.sub}</div>
                      ) : null}
                    </button>
                  ))}
                </div>
              ))
          )}
        </div>
      </div>
    </div>
  )
}

function Shell() {
  const { t } = useTranslation()
  const loc = useLocation()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const pathRef = useRef(loc.pathname)
  pathRef.current = loc.pathname

  useAutoBackup()
  useCategorySync()

  /* دکمه Back سخت‌افزاری اندروید — فقط در اپ نیتیو */
  useEffect(() => {
    let cleanup: (() => void) | undefined
    let cancelled = false
    ;(async () => {
      try {
        const [{ App }, { isNative }] = await Promise.all([
          import('@capacitor/app'),
          import('./lib/native'),
        ])
        if (cancelled || !isNative()) return
        const sub = await App.addListener('backButton', ({ canGoBack }) => {
          if (pathRef.current !== '/') navigate(-1)
          else if (!canGoBack) void App.exitApp()
        })
        if (cancelled) void sub.remove()
        else cleanup = () => void sub.remove()
      } catch {
        /* وب — نادیده */
      }
    })()
    return () => {
      cancelled = true
      cleanup?.()
    }
  }, [navigate])

  const key = '/' + (loc.pathname.split('/')[1] ?? '')
  const titleKey = TITLES[key] ?? (key.startsWith('/projects') ? 'nav.projects' : 'nav.today')
  const title = t(titleKey)

  return (
    <div className="h-full flex bg-bg text-ink">
      {/* دسکتاپ */}
      <div className="hidden lg:block w-[236px] shrink-0 border-e border-line">
        <Sidebar />
      </div>

      {/* موبایل */}
      {menuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMenuOpen(false)} />
          <div className="absolute inset-y-0 start-0 w-[260px] border-e border-line shadow-float">
            <Sidebar onNavigate={() => setMenuOpen(false)} />
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <Topbar title={title} onOpenMenu={() => setMenuOpen(true)} />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          <Routes>
            <Route path="/" element={<TodayPage />} />
            <Route path="/inbox" element={<InboxPage />} />
            <Route path="/projects" element={<ProjectsPage />} />
            <Route path="/projects/:id" element={<ProjectDetail />} />
            <Route path="/workers" element={<WorkersPage />} />
            <Route path="/finance" element={<FinancePage />} />
            <Route path="/goals" element={<GoalsPage />} />
            <Route path="/learn" element={<LearnPage />} />
            <Route path="/club" element={<ClubPage />} />
            <Route path="/board" element={<BoardPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>

      <GlobalSearch />
    </div>
  )
}

export default function App() {
  return (
    <HashRouter>
      <BootErrorBoundary>
        <Shell />
      </BootErrorBoundary>
    </HashRouter>
  )
}

/** مرز خطای سراسری — به‌جای صفحه سفید، پیام و دکمه تلاش مجدد */
class BootErrorBoundary extends Component<{ children: ReactNode }, { error: unknown }> {
  state: { error: unknown } = { error: null }
  static getDerivedStateFromError(error: unknown) {
    return { error }
  }
  componentDidCatch(error: unknown) {
    console.error('SAZORA boot error:', error)
  }
  render() {
    if (this.state.error == null) return this.props.children
    return (
      <div dir="rtl" style={{ padding: 24, fontFamily: 'inherit', maxWidth: 560, margin: '40px auto', textAlign: 'center' }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
        <b>برنامه باز نشد</b>
        <p style={{ color: '#71717a', fontSize: 13, marginTop: 8, lineHeight: 2 }}>
          یک خطای غیرمنتظره رخ داد. معمولاً با رفرش سخت (Ctrl+Shift+R) یا پاک‌کردن کش مرورگر درست می‌شود.
          اگر درست نشد، این متن را بفرستید:
        </p>
        <pre dir="ltr" style={{ background: '#f4f4f5', border: '1px solid #e4e4e7', borderRadius: 8, padding: 10, fontSize: 11, overflowX: 'auto', textAlign: 'left' }}>
          {String((this.state.error as Error)?.message ?? this.state.error)}
        </pre>
        <button
          onClick={() => window.location.reload()}
          style={{ marginTop: 12, padding: '8px 20px', borderRadius: 8, border: 'none', background: '#374151', color: '#fff', cursor: 'pointer' }}
        >
          تلاش مجدد
        </button>
      </div>
    )
  }
}
