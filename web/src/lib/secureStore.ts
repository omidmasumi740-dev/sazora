/* ============================================================
   ذخیرهٔ امن نشست (توکن‌ها) و نام دستگاه
   - در نسخهٔ نصبی ویندوز: DPAPI (Windows Credential/D PAPI) از طریق پل دسکتاپ
   - در نسخهٔ وب: localStorage با پیشوند szr-secret- (فقط برای توسعه)
   رمز عبور هرگز ذخیره نمی‌شود — فقط access/refresh token.
   ============================================================ */

type Host = {
  postMessage: (msg: string) => void
  addEventListener: (type: 'message', cb: (e: { data: unknown }) => void) => void
  removeEventListener: (type: 'message', cb: (e: { data: unknown }) => void) => void
}

function host(): Host | null {
  try {
    const w = window as unknown as { chrome?: { webview?: Host } }
    return w.chrome?.webview ?? null
  } catch {
    return null
  }
}

function waitFor<T>(match: (d: Record<string, unknown>) => T | undefined, timeout = 10000): Promise<T | null> {
  return new Promise((resolve) => {
    const h = host()
    if (!h) return resolve(null)
    let done = false
    const finish = (v: T | null) => {
      if (done) return
      done = true
      clearTimeout(timer)
      h.removeEventListener('message', handler)
      resolve(v)
    }
    const handler = (e: { data: unknown }) => {
      let data: Record<string, unknown>
      try {
        data = typeof e.data === 'string' ? JSON.parse(e.data) : (e.data as Record<string, unknown>)
      } catch {
        return
      }
      const v = match(data)
      if (v !== undefined) finish(v)
    }
    const timer = setTimeout(() => finish(null), timeout)
    h.addEventListener('message', handler)
  })
}

const LS_PREFIX = 'szr-secret-'

export function bridgeSecretsAvailable(): boolean {
  return !!host()
}

export async function saveSecret(key: string, value: string): Promise<void> {
  const h = host()
  if (h) {
    const p = waitFor<boolean>((d) => (d.action === 'secret-saved' ? Boolean(d.ok) : undefined))
    h.postMessage(JSON.stringify({ action: 'save-secret', key, value }))
    const ok = await p
    if (ok) return
  }
  try {
    localStorage.setItem(LS_PREFIX + key, value)
  } catch {
    /* ignore */
  }
}

export async function loadSecret(key: string): Promise<string | null> {
  const h = host()
  if (h) {
    const p = waitFor<string>((d) =>
      d.action === 'secret' && String(d.key) === key ? String(d.value ?? '') : undefined,
    )
    h.postMessage(JSON.stringify({ action: 'load-secret', key }))
    const v = await p
    if (v !== null) return v || null
  }
  try {
    return localStorage.getItem(LS_PREFIX + key)
  } catch {
    return null
  }
}

export async function deleteSecret(key: string): Promise<void> {
  const h = host()
  if (h) {
    const p = waitFor<boolean>((d) => (d.action === 'secret-deleted' ? Boolean(d.ok) : undefined))
    h.postMessage(JSON.stringify({ action: 'delete-secret', key }))
    await p
  }
  try {
    localStorage.removeItem(LS_PREFIX + key)
  } catch {
    /* ignore */
  }
}

/** نام دستگاه برای metadata بکاپ */
export async function deviceName(): Promise<string> {
  const h = host()
  if (h) {
    const p = waitFor<string>((d) => (d.action === 'device-name' ? String(d.name ?? '') : undefined), 4000)
    h.postMessage(JSON.stringify({ action: 'get-device-name' }))
    const v = await p
    if (v) return v
  }
  try {
    return (navigator.platform || 'Windows').slice(0, 40)
  } catch {
    return 'Windows'
  }
}
