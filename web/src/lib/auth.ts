/* ============================================================
   AuthService — ثبت‌نام/ورود/خروج/بازیابی رمز با Supabase Auth
   - نشست (access/refresh) با DPAPI در ویندوز ذخیره می‌شود
   - رمز عبور هرگز ذخیره نمی‌شود
   - همهٔ خطاها به کد قابل‌ترجمه تبدیل می‌شوند (UI پیام دوستانه نشان می‌دهد)
   ============================================================ */
import { useSyncExternalStore } from 'react'
import { ApiError, supabase, type SupabaseSession } from './supabase'
import { deleteSecret, loadSecret, saveSecret } from './secureStore'

export type AuthErrorCode =
  | 'invalid_email'
  | 'short_password'
  | 'password_mismatch'
  | 'invalid_credentials'
  | 'email_unconfirmed'
  | 'email_exists'
  | 'weak_password'
  | 'rate_limit'
  | 'offline'
  | 'timeout'
  | 'session_expired'
  | 'too_large'
  | 'invalid_link'
  | 'unknown'

export class AuthError extends Error {
  code: AuthErrorCode
  constructor(code: AuthErrorCode, message?: string) {
    super(message || code)
    this.code = code
  }
}

export interface AuthUser {
  id: string
  email: string | null
}

const SECRET_KEY = 'supabase-session'
const AUTH_CHANGED = 'szr:auth-changed'
export const AUTH_OPEN = 'szr:auth-open'

export type AuthOpenDetail = {
  mode: 'login' | 'signup' | 'recover' | 'new-password' | 'notice'
  gated?: boolean
  notice?: string
}

let session: SupabaseSession | null = null
/** snapshot پایدار برای useSyncExternalStore (ارجاع ثابت تا تغییر واقعی) */
let snapshot: { user: AuthUser | null; ready: boolean } = { user: null, ready: false }
let ready = false
const listeners = new Set<() => void>()

function emit() {
  for (const fn of listeners) fn()
  try {
    window.dispatchEvent(new CustomEvent(AUTH_CHANGED))
  } catch {
    /* ignore */
  }
}

function publish() {
  snapshot = {
    user: session ? { id: session.user.id, email: session.user.email } : null,
    ready,
  }
  emit()
}

function setSession(s: SupabaseSession | null) {
  session = s
  publish()
}

function mapError(err: unknown): AuthError {
  if (err instanceof AuthError) return err
  if (err instanceof ApiError) {
    if (err.code === 'offline') return new AuthError('offline')
    if (err.status === 0) return new AuthError('offline')
    if (err.code === 'invalid_credentials') return new AuthError('invalid_credentials')
    if (err.code === 'email_unconfirmed') return new AuthError('email_unconfirmed')
    if (err.code === 'email_exists') return new AuthError('email_exists')
    if (err.code === 'weak_password') return new AuthError('weak_password')
    if (err.code === 'rate_limit') return new AuthError('rate_limit')
    if (err.code === 'too_large') return new AuthError('too_large')
    if (err.code === 'session_expired' || err.code === 'unauthorized') return new AuthError('session_expired')
    return new AuthError('unknown', err.message)
  }
  if (err instanceof DOMException && err.name === 'AbortError') return new AuthError('timeout')
  return new AuthError('unknown', err instanceof Error ? err.message : undefined)
}

export function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())
}

export function validatePassword(password: string): boolean {
  return password.length >= 8
}

async function persist(s: SupabaseSession | null): Promise<void> {
  if (s) await saveSecret(SECRET_KEY, JSON.stringify(s))
  else await deleteSecret(SECRET_KEY)
}

/** خواندن نشست ذخیره‌شده و تازه‌سازی توکن در شروع برنامه */
export async function initAuth(): Promise<void> {
  if (ready) return
  try {
    const raw = await loadSecret(SECRET_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as SupabaseSession
      if (parsed?.access_token && parsed?.refresh_token) {
        session = parsed
        if (parsed.expires_at - 120 <= nowSec()) {
          try {
            session = await supabase.refresh(parsed.refresh_token)
            await persist(session)
          } catch {
            session = null
            await persist(null)
          }
        }
      }
    }
  } catch {
    session = null
  } finally {
    ready = true
    publish()
  }
}

function nowSec(): number {
  return Math.floor(Date.now() / 1000)
}

/** توکن معتبر برای درخواست‌های Storage — در صورت انقضا تازه می‌شود */
export async function getAccessToken(): Promise<string> {
  if (!session) throw new AuthError('session_expired')
  if (session.expires_at - 60 <= nowSec()) {
    try {
      session = await supabase.refresh(session.refresh_token)
      await persist(session)
      publish()
    } catch (err) {
      session = null
      await persist(null)
      publish()
      throw mapError(err)
    }
  }
  return session.access_token
}

export async function signUp(email: string, password: string, confirm: string): Promise<'logged_in' | 'confirm_email'> {
  if (!validateEmail(email)) throw new AuthError('invalid_email')
  if (!validatePassword(password)) throw new AuthError('short_password')
  if (password !== confirm) throw new AuthError('password_mismatch')
  try {
    const res = await supabase.signUp(email.trim(), password)
    if (res.session) {
      setSession(res.session)
      await persist(res.session)
      return 'logged_in'
    }
    return 'confirm_email'
  } catch (err) {
    throw mapError(err)
  }
}

export async function signIn(email: string, password: string): Promise<void> {
  if (!validateEmail(email)) throw new AuthError('invalid_email')
  if (!validatePassword(password)) throw new AuthError('short_password')
  try {
    const s = await supabase.signIn(email.trim(), password)
    setSession(s)
    await persist(s)
  } catch (err) {
    throw mapError(err)
  }
}

export async function signOut(): Promise<void> {
  const current = session
  setSession(null)
  await persist(null)
  if (current) await supabase.logout(current.access_token)
}

export async function resetPassword(email: string): Promise<void> {
  if (!validateEmail(email)) throw new AuthError('invalid_email')
  try {
    await supabase.recover(email.trim())
  } catch (err) {
    throw mapError(err)
  }
}

/* ------- لینک‌های تأیید ایمیل و بازیابی رمز ------- */

const REDIRECT_KEY = 'sazora-auth-redirect'

export interface AuthRedirect {
  access_token: string
  refresh_token: string
  expires_in: number
  type: string
  error_description: string
}

/**
 * Supabase پس از کلیک روی لینک ایمیل، توکن‌ها را در hash برمی‌گرداند.
 * چون از HashRouter استفاده می‌کنیم باید قبل از mount شدن React آن را بخوانیم
 * و hash را پاک کنیم تا مسیریابی برنامه خراب نشود.
 */
export function captureAuthRedirect(): void {
  try {
    const hash = window.location.hash
    if (!hash || hash.length < 2) return
    const qs = hash.replace(/^#/, '')
    if (qs.startsWith('/')) return
    const looksLikeAuth = /(^|&)(access_token|error_description|error)=/.test(qs)
    if (!looksLikeAuth) return
    const p = new URLSearchParams(qs)
    const data: AuthRedirect = {
      access_token: p.get('access_token') || '',
      refresh_token: p.get('refresh_token') || '',
      expires_in: Number(p.get('expires_in') || 0) || 3600,
      type: p.get('type') || '',
      error_description: p.get('error_description') || '',
    }
    if (data.access_token || data.error_description) {
      sessionStorage.setItem(REDIRECT_KEY, JSON.stringify(data))
    }
    history.replaceState(null, '', window.location.pathname + window.location.search + '#/')
  } catch {
    /* ignore */
  }
}

export function takeAuthRedirect(): AuthRedirect | null {
  try {
    const raw = sessionStorage.getItem(REDIRECT_KEY)
    if (!raw) return null
    sessionStorage.removeItem(REDIRECT_KEY)
    return JSON.parse(raw) as AuthRedirect
  } catch {
    return null
  }
}

/** اعمال توکن‌های لینک ایمیل: ورود خودکار؛ نوع recovery را برمی‌گرداند */
export async function applyAuthRedirect(r: AuthRedirect): Promise<'recovery' | 'confirmed'> {
  if (!r.access_token || !r.refresh_token) throw new AuthError('invalid_link')
  try {
    const user = await supabase.getUser(r.access_token)
    const s: SupabaseSession = {
      access_token: r.access_token,
      refresh_token: r.refresh_token,
      expires_at: nowSec() + (r.expires_in || 3600),
      user,
    }
    setSession(s)
    await persist(s)
    return r.type === 'recovery' ? 'recovery' : 'confirmed'
  } catch (err) {
    throw mapError(err)
  }
}

/** تعیین رمز جدید پس از کلیک روی لینک بازیابی */
export async function setNewPassword(password: string, confirm: string): Promise<void> {
  if (!validatePassword(password)) throw new AuthError('short_password')
  if (password !== confirm) throw new AuthError('password_mismatch')
  try {
    const token = await getAccessToken()
    await supabase.updatePassword(token, password)
  } catch (err) {
    throw mapError(err)
  }
}

export function getCurrentUser(): AuthUser | null {
  return session ? { id: session.user.id, email: session.user.email } : null
}

export function isLoggedIn(): boolean {
  return !!session
}

export function openAuth(mode: AuthOpenDetail['mode'] = 'login', gated = false, notice?: string): void {
  try {
    window.dispatchEvent(new CustomEvent<AuthOpenDetail>(AUTH_OPEN, { detail: { mode, gated, notice } }))
  } catch {
    /* ignore */
  }
}

/** محافظ ویژگی‌های قفل‌شده — اگر مهمان باشد دیالوگ دوستانه باز می‌شود */
export function requireLogin(): boolean {
  if (session) return true
  openAuth('login', true)
  return false
}

/** API عمومی AuthService (نام‌های خواسته‌شده) */
export const AuthService = {
  sign_up: signUp,
  sign_in: signIn,
  sign_out: signOut,
  reset_password: resetPassword,
  get_current_user: getCurrentUser,
  is_logged_in: isLoggedIn,
  require_login: requireLogin,
}

/* ------- هوک‌های React ------- */

function subscribe(fn: () => void) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function useAuth() {
  const s = useSyncExternalStore(
    subscribe,
    () => snapshot,
    () => ({ user: null, ready: false }),
  )
  return { user: s.user, loggedIn: !!s.user, ready: s.ready }
}

export { AUTH_CHANGED }
