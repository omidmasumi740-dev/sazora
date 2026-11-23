/* ============================================================
   کلاینت سبک Supabase روی REST API رسمی (بدون SDK اضافه)
   - Auth: /auth/v1/*
   - Storage: /storage/v1/object/*
   - همیشه با کلید publishable و توکن همان کاربر؛ هرگز service_role
   ============================================================ */
import { NET_TIMEOUT_MS, SUPABASE_ANON_KEY, SUPABASE_URL } from './config'

export class ApiError extends Error {
  status: number
  code: string
  constructor(status: number, code: string, message: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

export interface SupabaseUser {
  id: string
  email: string | null
  /** user_metadata — مثل full_name برای نام نمایشی */
  metadata?: Record<string, unknown>
}

export interface SupabaseSession {
  access_token: string
  refresh_token: string
  /** ثانیهٔ یونیکس */
  expires_at: number
  user: SupabaseUser
}

export interface StorageObject {
  name: string
  path: string
  createdAt: string | null
  size: number
}

interface RawSession {
  access_token?: string
  refresh_token?: string
  expires_at?: number
  expires_in?: number
  user?: { id?: string; email?: string | null; user_metadata?: Record<string, unknown> }
  error_description?: string
  msg?: string
  message?: string
}

function toSession(raw: RawSession): SupabaseSession | null {
  if (!raw || !raw.access_token || !raw.refresh_token || !raw.user?.id) return null
  const expires = raw.expires_at
    ? Number(raw.expires_at)
    : Math.floor(Date.now() / 1000) + Number(raw.expires_in || 3600)
  return {
    access_token: raw.access_token,
    refresh_token: raw.refresh_token,
    expires_at: expires,
    user: {
      id: raw.user.id,
      email: raw.user.email ?? null,
      metadata: raw.user.user_metadata && typeof raw.user.user_metadata === 'object' ? raw.user.user_metadata : {},
    },
  }
}

async function call(
  path: string,
  opts: { method?: string; token?: string; body?: unknown; rawBody?: BodyInit; headers?: Record<string, string> } = {},
): Promise<Response> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), NET_TIMEOUT_MS)
  const headers: Record<string, string> = {
    apikey: SUPABASE_ANON_KEY,
    ...(opts.headers || {}),
  }
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json'
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`
  try {
    return await fetch(`${SUPABASE_URL}${path}`, {
      method: opts.method || (opts.body !== undefined ? 'POST' : 'GET'),
      headers,
      body: opts.rawBody ?? (opts.body !== undefined ? JSON.stringify(opts.body) : undefined),
      signal: ctrl.signal,
    })
  } finally {
    clearTimeout(timer)
  }
}

/** پیام خطای Supabase را به کد خوانا تبدیل می‌کند */
async function parseError(res: Response): Promise<ApiError> {
  let msg = ''
  let code = ''
  try {
    const j = (await res.json()) as Record<string, unknown>
    msg = String(j.msg ?? j.message ?? j.error_description ?? j.error ?? '')
    code = String(j.error_code ?? j.code ?? '')
  } catch {
    /* بدنهٔ غیر JSON */
  }
  const lower = (msg + ' ' + code).toLowerCase()
  if (res.status === 0) return new ApiError(0, 'offline', msg)
  if (lower.includes('invalid login credentials')) return new ApiError(res.status, 'invalid_credentials', msg)
  if (lower.includes('email not confirmed')) return new ApiError(res.status, 'email_unconfirmed', msg)
  if (lower.includes('already registered') || lower.includes('already exists')) return new ApiError(res.status, 'email_exists', msg)
  if (lower.includes('weak password') || lower.includes('password should be')) return new ApiError(res.status, 'weak_password', msg)
  if (res.status === 429) return new ApiError(429, 'rate_limit', msg)
  if (res.status === 401) return new ApiError(401, 'unauthorized', msg)
  if (res.status === 413) return new ApiError(413, 'too_large', msg)
  return new ApiError(res.status, code || 'request_failed', msg)
}

function netGuard(): void {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    throw new ApiError(0, 'offline', 'offline')
  }
}

export const supabase = {
  async signUp(
    email: string,
    password: string,
    data?: Record<string, unknown>,
  ): Promise<{ session: SupabaseSession | null; needsConfirm: boolean }> {
    netGuard()
    const body: Record<string, unknown> = { email, password }
    if (data && Object.keys(data).length) body.data = data
    const res = await call('/auth/v1/signup', { body })
    if (!res.ok) throw await parseError(res)
    const raw = (await res.json()) as RawSession
    const session = toSession(raw)
    return { session, needsConfirm: !session }
  },

  async signIn(email: string, password: string): Promise<SupabaseSession> {
    netGuard()
    const res = await call('/auth/v1/token?grant_type=password', { body: { email, password } })
    if (!res.ok) throw await parseError(res)
    const session = toSession((await res.json()) as RawSession)
    if (!session) throw new ApiError(500, 'bad_response', 'bad_response')
    return session
  },

  async refresh(refreshToken: string): Promise<SupabaseSession> {
    netGuard()
    const res = await call('/auth/v1/token?grant_type=refresh_token', { body: { refresh_token: refreshToken } })
    if (!res.ok) throw await parseError(res)
    const session = toSession((await res.json()) as RawSession)
    if (!session) throw new ApiError(401, 'session_expired', 'session_expired')
    return session
  },

  async logout(accessToken: string): Promise<void> {
    try {
      await call('/auth/v1/logout', { method: 'POST', token: accessToken })
    } catch {
      /* خروج محلی هم کافی است */
    }
  },

  async recover(email: string): Promise<void> {
    netGuard()
    const res = await call('/auth/v1/recover', { body: { email } })
    if (!res.ok) throw await parseError(res)
  },

  /** کاربر جاری از روی توکن (برای لینک تأیید ایمیل/بازیابی) */
  async getUser(accessToken: string): Promise<SupabaseUser> {
    netGuard()
    const res = await call('/auth/v1/user', { token: accessToken })
    if (!res.ok) throw await parseError(res)
    const raw = (await res.json()) as { id?: string; email?: string | null; user_metadata?: Record<string, unknown> }
    if (!raw.id) throw new ApiError(401, 'unauthorized', 'unauthorized')
    return {
      id: raw.id,
      email: raw.email ?? null,
      metadata: raw.user_metadata && typeof raw.user_metadata === 'object' ? raw.user_metadata : {},
    }
  },

  /** به‌روزرسانی metadata کاربر — مثل full_name */
  async updateProfile(accessToken: string, data: Record<string, unknown>): Promise<SupabaseUser> {
    netGuard()
    const res = await call('/auth/v1/user', { method: 'PUT', token: accessToken, body: { data } })
    if (!res.ok) throw await parseError(res)
    const raw = (await res.json()) as { id?: string; email?: string | null; user_metadata?: Record<string, unknown> }
    if (!raw.id) throw new ApiError(401, 'unauthorized', 'unauthorized')
    return {
      id: raw.id,
      email: raw.email ?? null,
      metadata: raw.user_metadata && typeof raw.user_metadata === 'object' ? raw.user_metadata : {},
    }
  },

  async updatePassword(accessToken: string, password: string): Promise<void> {
    netGuard()
    const res = await call('/auth/v1/user', { method: 'PUT', token: accessToken, body: { password } })
    if (!res.ok) throw await parseError(res)
  },

  async upload(bucket: string, path: string, blob: Blob, token: string): Promise<void> {
    netGuard()
    const res = await call(`/storage/v1/object/${bucket}/${encodeURI(path)}`, {
      method: 'POST',
      token,
      rawBody: blob,
      headers: { 'Content-Type': 'application/zip', 'x-upsert': 'false' },
    })
    if (!res.ok) throw await parseError(res)
  },

  async list(bucket: string, prefix: string, token: string): Promise<StorageObject[]> {
    netGuard()
    const res = await call(`/storage/v1/object/list/${bucket}`, {
      method: 'POST',
      token,
      body: {
        prefix,
        limit: 100,
        offset: 0,
        sortBy: { column: 'name', order: 'desc' },
      },
    })
    if (!res.ok) throw await parseError(res)
    const rows = (await res.json()) as Array<Record<string, unknown>>
    return rows
      .filter((r) => typeof r.name === 'string' && String(r.name).endsWith('.zip'))
      .map((r) => {
        const meta = (r.metadata || {}) as Record<string, unknown>
        return {
          name: String(r.name),
          path: `${prefix}${String(r.name)}`,
          createdAt: r.created_at ? String(r.created_at) : null,
          size: Number(meta.size ?? 0),
        }
      })
  },

  async download(bucket: string, path: string, token: string): Promise<Blob> {
    netGuard()
    const res = await call(`/storage/v1/object/${bucket}/${encodeURI(path)}`, { token })
    if (!res.ok) throw await parseError(res)
    return await res.blob()
  },

  async remove(bucket: string, paths: string[], token: string): Promise<void> {
    netGuard()
    const res = await call(`/storage/v1/object/${bucket}`, { method: 'DELETE', token, body: { prefixes: paths } })
    if (!res.ok) throw await parseError(res)
  },
}
