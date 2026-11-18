import { NavLink } from 'react-router-dom'
import { useEffect, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/schema'
import { Kbd } from './components'
import { useSettings } from '../store/settings'
import { PROFILE_EVENT, getProfilePhoto } from '../pages/Settings'

/* ---------- آیکون‌ها ---------- */
const I = {
  today: (
    <svg className="w-[17px] h-[17px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  ),
  inbox: (
    <svg className="w-[17px] h-[17px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 13h4l2 3h4l2-3h4" />
      <path d="M5 5h14l2 8v6H3v-6z" />
    </svg>
  ),
  projects: (
    <svg className="w-[17px] h-[17px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-5h6v5" />
    </svg>
  ),
  workers: (
    <svg className="w-[17px] h-[17px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="4" width="18" height="17" rx="2" />
      <path d="M3 9h18M8 2v4M16 2v4M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01" />
    </svg>
  ),
  finance: (
    <svg className="w-[17px] h-[17px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 17 9 11l4 4 8-8" />
      <path d="M21 3h-5v5" />
    </svg>
  ),
  goals: (
    <svg className="w-[17px] h-[17px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1.5" />
    </svg>
  ),
  learn: (
    <svg className="w-[17px] h-[17px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H12v18H6.5A2.5 2.5 0 0 1 4 18.5z" />
      <path d="M20 5.5A2.5 2.5 0 0 0 17.5 3H12v18h5.5a2.5 2.5 0 0 0 2.5-2.5z" />
    </svg>
  ),
  board: (
    <svg className="w-[17px] h-[17px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="4" width="5" height="16" rx="1" />
      <rect x="10" y="4" width="5" height="11" rx="1" />
      <rect x="17" y="4" width="4" height="7" rx="1" />
    </svg>
  ),
  club: (
    <svg className="w-[17px] h-[17px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="4.2" r="2" />
      <path d="M12 7.5V15" />
      <path d="M12 9.5 7.5 11 6 7.5" />
      <path d="M12 9.5l4.5 1.5L18 7.5" />
      <path d="M12 15l-3 6" />
      <path d="M12 15l3 6" />
    </svg>
  ),
  settings: (
    <svg className="w-[17px] h-[17px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1A1.7 1.7 0 0 0 9 19.4a1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
    </svg>
  ),
}

const MAIN: { to: string; key: string; icon: ReactNode; end?: boolean }[] = [
  { to: '/', key: 'today', icon: I.today, end: true },
  { to: '/inbox', key: 'inbox', icon: I.inbox },
  { to: '/projects', key: 'projects', icon: I.projects },
  { to: '/workers', key: 'workers', icon: I.workers },
  { to: '/finance', key: 'finance', icon: I.finance },
  { to: '/goals', key: 'goals', icon: I.goals },
  { to: '/learn', key: 'learn', icon: I.learn },
  { to: '/club', key: 'club', icon: I.club },
  { to: '/board', key: 'board', icon: I.board },
]

/** منوی قابل‌تنظیم کاربر — ترتیب و مخفی‌ها از تنظیمات */
export function useVisibleMenu() {
  const order = useSettings((s) => s.menuOrder)
  const hidden = useSettings((s) => s.hiddenMenus)
  const rank = (key: string) => {
    const i = order.indexOf(key as never)
    return i < 0 ? Number.MAX_SAFE_INTEGER : i
  }
  return MAIN
    .filter((item) => !hidden.includes(item.key as never))
    .sort((a, b) => rank(a.key) - rank(b.key))
}

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { t } = useTranslation()
  const userName = useSettings((s) => s.userName)
  const visibleMenu = useVisibleMenu()

  const todoCount = useLiveQuery(async () => {
    const all = await db.tasks.where('status').notEqual('done').toArray()
    return all.filter((x) => !x.parentId).length
  }, [], 0)

  const projects = useLiveQuery(() => db.projects.toArray(), [], [])
  const activeProjects = projects.filter((p) => p.status !== 'done')
  const activeWorkers = useLiveQuery(
    async () => (await db.workers.toArray()).filter((w) => w.active).length,
    [],
    0,
  )

  const counts: Record<string, number | undefined> = {
    today: todoCount,
    projects: activeProjects.length,
    workers: activeWorkers,
  }

  return (
    <aside className="app-sidebar border-line h-full flex flex-col overflow-y-auto">
      {/* برند */}
      <div className="flex items-center gap-2.5 px-4 pt-4 pb-1">
        <img src="./logo.svg" alt="SAZORA" className="w-9 h-9 shrink-0" />
        <div className="min-w-0">
          <div className="font-bold text-[16px] tracking-wide leading-tight" dir="ltr" style={{ textAlign: 'start' }}>
            SAZORA
          </div>
          {userName.trim() && (
            <div className="text-[11.5px] text-muted truncate">{userName.trim()}</div>
          )}
        </div>
        <span className="ms-auto text-[10px] text-faint bg-surface-2 border border-line rounded px-1.5">
          v1.9.14
        </span>
      </div>

      {/* ناوبری اصلی */}
      <nav className="px-2.5 pt-3 flex flex-col gap-0.5">
        {visibleMenu.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={onNavigate}
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          >
            {item.icon}
            <span className="truncate">{t(`nav.${item.key}`)}</span>
            {counts[item.key] ? (
              <span className="ms-auto text-[11px] bg-surface-2 border border-line text-muted rounded-full px-2 leading-[18px]">
                {counts[item.key]}
              </span>
            ) : null}
          </NavLink>
        ))}
      </nav>

      {/* فضاها / پروژه‌ها */}
      <div className="px-4 mt-5">
        <div className="text-[11px] text-faint font-semibold tracking-wide mb-2 flex items-center justify-between">
          <span>{t('nav.spaces')}</span>
        </div>
        <div className="flex flex-col gap-0.5">
          {activeProjects.slice(0, 5).map((p) => (
            <NavLink
              key={p.id}
              to={`/projects/${p.id}`}
              onClick={onNavigate}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            >
              <span
                className="w-2 h-2 rounded-sm shrink-0"
                style={{ background: statusColor(p.status) }}
              />
              <span className="truncate text-[12.5px]">{p.name}</span>
            </NavLink>
          ))}
        </div>
      </div>

      {/* تنظیمات */}
      <div className="px-2.5 mt-5 mb-4">
        <NavLink
          to="/settings"
          onClick={onNavigate}
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
        >
          {I.settings}
          <span>{t('nav.settings')}</span>
        </NavLink>
      </div>

      {/* جست‌وجو */}
      <div className="mt-auto px-3 pb-4">
        <button
          className="w-full flex items-center gap-2 bg-surface-2 border border-line rounded-lg px-3 py-2 text-[13px] text-faint hover:border-faint transition-colors"
          onClick={() => window.dispatchEvent(new CustomEvent('sazora:search'))}
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <span className="truncate">{t('common.search')}</span>
          <span className="ms-auto">
            <Kbd>Ctrl K</Kbd>
          </span>
        </button>
      </div>
    </aside>
  )
}

export function statusColor(status: string): string {
  switch (status) {
    case 'active':
      return 'var(--b-orange)'
    case 'waiting':
      return 'var(--b-amber)'
    case 'paused':
      return 'var(--b-gray)'
    case 'done':
      return 'var(--b-green)'
    default:
      return 'var(--b-gray)'
  }
}

/** نوار بالا — عنوان صفحه، تاریخ، تغییر تم و زبان */
export function Topbar({ title, onOpenMenu }: { title: string; onOpenMenu?: () => void }) {
  const { t } = useTranslation()
  const settings = useSettings()
  const [photo, setPhoto] = useState<string | null>(() => getProfilePhoto())

  useEffect(() => {
    const refresh = () => setPhoto(getProfilePhoto())
    window.addEventListener(PROFILE_EVENT, refresh)
    window.addEventListener('storage', refresh)
    return () => {
      window.removeEventListener(PROFILE_EVENT, refresh)
      window.removeEventListener('storage', refresh)
    }
  }, [])

  const now = new Date()
  const dateLabel = new Intl.DateTimeFormat(settings.lang === 'fa' ? 'fa-IR' : 'en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(now)

  return (
    <header className="h-14 shrink-0 border-b border-line flex items-center gap-3 px-4 sm:px-6 bg-bg">
      <button
        className="lg:hidden btn btn-ghost !px-2"
        onClick={onOpenMenu}
        aria-label="menu"
      >
        ☰
      </button>
      <div className="font-bold text-[15px] truncate">{title}</div>
      <div className="hidden md:block text-[12.5px] text-muted border-s border-line ps-4 truncate">
        {dateLabel}
      </div>

      <div className="ms-auto flex items-center gap-2">
        <button
          className="hidden sm:flex items-center gap-1.5 bg-surface border border-line rounded-lg px-3 py-1.5 text-[13px] text-faint hover:border-faint transition-colors"
          onClick={() => window.dispatchEvent(new CustomEvent('sazora:search'))}
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <span>{t('common.search')}</span>
        </button>
        <button
          className="w-8 h-8 rounded-lg border border-line bg-surface grid place-items-center text-muted hover:bg-surface-2 transition-colors"
          onClick={settings.toggleTheme}
          title={settings.theme === 'light' ? t('settings.dark') : t('settings.light')}
        >
          {settings.theme === 'light' ? '◐' : '◑'}
        </button>
        <button
          className="w-8 h-8 rounded-lg border border-line bg-surface grid place-items-center text-muted hover:bg-surface-2 transition-colors text-[12px] font-semibold"
          onClick={() => settings.setLang(settings.lang === 'fa' ? 'en' : 'fa')}
          title={t('settings.language')}
        >
          {settings.lang === 'fa' ? 'EN' : 'فا'}
        </button>
        {photo ? (
          <img
            src={photo}
            alt="پروفایل"
            className="w-8 h-8 rounded-full object-cover border border-line"
          />
        ) : (
          <div
            className="w-8 h-8 rounded-full grid place-items-center text-white text-xs font-semibold overflow-hidden"
            style={{ background: 'linear-gradient(135deg, #E07B39, #F2B33D)' }}
          >
            {settings.userName.trim() ? (
              settings.userName.trim().slice(0, 1)
            ) : (
              <img src="./logo.svg" alt="SAZORA" className="w-8 h-8 object-cover" />
            )}
          </div>
        )}
      </div>
    </header>
  )
}

