import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  AUTH_OPEN,
  AuthError,
  resetPassword,
  setNewPassword,
  signIn,
  signUp,
  type AuthOpenDetail,
} from '../../lib/auth'
import { Field, TextInput } from '../components'

type Mode = AuthOpenDetail['mode']

/** دیالوگ‌های ورود/ثبت‌نام/بازیابی رمز — با رویداد سراسری باز می‌شوند */
export function AuthDialogs() {
  const { t } = useTranslation()
  const [mode, setMode] = useState<Mode | null>(null)
  const [gated, setGated] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    const onOpen = (e: Event) => {
      const detail = (e as CustomEvent<AuthOpenDetail>).detail || {}
      setMode(detail.mode || 'login')
      setGated(Boolean(detail.gated))
      setNotice(detail.notice || null)
      setEmail('')
      setPassword('')
      setConfirm('')
      setError(null)
      setInfo(null)
      setBusy(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMode(null)
    }
    window.addEventListener(AUTH_OPEN, onOpen)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener(AUTH_OPEN, onOpen)
      window.removeEventListener('keydown', onKey)
    }
  }, [])

  if (!mode) return null

  const close = () => {
    if (busy) return
    setMode(null)
  }

  const switchMode = (m: Mode) => {
    if (busy) return
    setMode(m)
    setError(null)
    setInfo(null)
    setPassword('')
    setConfirm('')
  }

  const fail = (err: unknown) => {
    const code = err instanceof AuthError ? err.code : 'unknown'
    setError(t(`auth.err_${code}`))
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    setError(null)
    setInfo(null)
    try {
      if (mode === 'login') {
        await signIn(email, password)
        setMode(null)
      } else if (mode === 'signup') {
        const res = await signUp(email, password, confirm)
        if (res === 'confirm_email') {
          setInfo(t('auth.confirmEmail'))
          setMode('login')
          setPassword('')
          setConfirm('')
        } else {
          setMode(null)
        }
      } else if (mode === 'new-password') {
        await setNewPassword(password, confirm)
        setNotice('auth.passwordUpdated')
        setMode('notice')
        setPassword('')
        setConfirm('')
      } else {
        await resetPassword(email)
        setInfo(t('auth.recoverSent'))
      }
    } catch (err) {
      fail(err)
    } finally {
      setBusy(false)
    }
  }

  const title =
    mode === 'signup'
      ? t('auth.title_signup')
      : mode === 'recover'
        ? t('auth.title_recover')
        : mode === 'new-password'
          ? t('auth.title_newPassword')
          : mode === 'notice'
            ? t('auth.noticeTitle')
            : t('auth.title_login')

  return (
    <div className="fixed inset-0 z-[70] grid place-items-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/45" onClick={close} />
      <div className="relative w-[min(400px,94vw)] bg-surface border border-line rounded-2xl shadow-float p-5">
        <div className="flex items-start gap-2 mb-3">
          <div className="min-w-0">
            <div className="font-bold text-[15px]">{title}</div>
            <div className="text-[11.5px] text-faint mt-0.5">{t('auth.subtitle')}</div>
          </div>
          <button
            type="button"
            className="ms-auto btn btn-ghost !px-2 !py-0.5 text-[14px]"
            onClick={close}
            aria-label="close"
          >
            ✕
          </button>
        </div>

        {gated && (
          <div className="rounded-xl border border-line bg-surface-2 p-3 mb-3">
            <div className="text-[12.5px] font-semibold">{t('auth.gatedTitle')}</div>
            <div className="text-[11.5px] text-muted mt-1 leading-relaxed">{t('auth.gatedBody')}</div>
          </div>
        )}

        {mode === 'notice' ? (
          <div className="flex flex-col gap-3">
            <div className="text-[12.5px] text-muted leading-relaxed">{notice ? t(notice) : ''}</div>
            <button type="button" className="btn btn-primary w-full" onClick={close}>
              {t('common.close')}
            </button>
          </div>
        ) : (
          <>
            <form onSubmit={submit} className="flex flex-col gap-3">
              {mode !== 'new-password' && (
                <Field label={t('auth.email')}>
                  <TextInput
                    type="email"
                    dir="ltr"
                    autoFocus
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@mail.com"
                    autoComplete="email"
                  />
                </Field>
              )}

              {mode !== 'recover' && (
                <Field
                  label={mode === 'new-password' ? t('auth.newPassword') : t('auth.password')}
                  hint={mode === 'signup' || mode === 'new-password' ? t('auth.passwordHint') : undefined}
                >
                  <TextInput
                    type="password"
                    dir="ltr"
                    autoFocus={mode === 'new-password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  />
                </Field>
              )}

              {(mode === 'signup' || mode === 'new-password') && (
                <Field label={t('auth.confirm')}>
                  <TextInput
                    type="password"
                    dir="ltr"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    autoComplete="new-password"
                  />
                </Field>
              )}

              {error && <div className="text-[12px] text-danger leading-relaxed">{error}</div>}
              {info && <div className="text-[12px] text-success leading-relaxed">{info}</div>}

              <button type="submit" className="btn btn-primary w-full" disabled={busy}>
                {busy
                  ? t('auth.working')
                  : mode === 'login'
                    ? t('auth.login')
                    : mode === 'signup'
                      ? t('auth.signup')
                      : mode === 'new-password'
                        ? t('auth.setPassword')
                        : t('auth.recover')}
              </button>
            </form>

            <div className="flex flex-col gap-1 mt-3 text-[11.5px] text-muted">
              {mode === 'login' && (
                <>
                  <button type="button" className="text-start hover:text-ink" onClick={() => switchMode('signup')}>
                    {t('auth.noAccount')}
                  </button>
                  <button type="button" className="text-start hover:text-ink" onClick={() => switchMode('recover')}>
                    {t('auth.forgot')}
                  </button>
                </>
              )}
              {mode === 'signup' && (
                <button type="button" className="text-start hover:text-ink" onClick={() => switchMode('login')}>
                  {t('auth.haveAccount')}
                </button>
              )}
              {mode === 'recover' && (
                <button type="button" className="text-start hover:text-ink" onClick={() => switchMode('login')}>
                  {t('auth.haveAccount')}
                </button>
              )}
            </div>
          </>
        )}

        <div className="text-[10.5px] text-faint mt-3 leading-relaxed">{t('auth.guestHint')}</div>
      </div>
    </div>
  )
}
