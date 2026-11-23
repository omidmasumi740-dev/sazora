import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { EmptyState, Field, Panel, TextInput } from './components'
import { openAuth, useAuth } from '../lib/auth'
import {
  CloudError,
  cloudBackup,
  exportRecoveryCode,
  importRecoveryCode,
  lastCloudBackupAt,
  type CloudBackupItem,
} from '../lib/cloudBackup'
import { useSettings } from '../store/settings'

function stampLabel(stamp: string, lang: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})_(\d{2})-(\d{2})-(\d{2})$/.exec(stamp)
  if (!m) return stamp
  const d = new Date(
    Number(m[1]),
    Number(m[2]) - 1,
    Number(m[3]),
    Number(m[4]),
    Number(m[5]),
    Number(m[6]),
  )
  try {
    return new Intl.DateTimeFormat(lang === 'fa' ? 'fa-IR' : 'en-GB', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(d)
  } catch {
    return stamp
  }
}

function formatBytes(n: number): string {
  if (!n) return '—'
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} KB`
  return `${(n / 1048576).toFixed(1)} MB`
}

/** فهرست نسخه‌های ابری — بدون رمز؛ رمزنگاری خودکار است */
export function CloudBackupPanel({ embedded = false }: { embedded?: boolean }) {
  const { t, i18n } = useTranslation()
  const s = useSettings()
  const { loggedIn, ready, user } = useAuth()
  const [items, setItems] = useState<CloudBackupItem[] | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [note, setNote] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const [needsReload, setNeedsReload] = useState(false)
  const [legacy, setLegacy] = useState<{ path: string; salt: string } | null>(null)
  const [legacyPass, setLegacyPass] = useState('')
  const [legacyError, setLegacyError] = useState<string | null>(null)
  const [legacyBusy, setLegacyBusy] = useState(false)
  const [recovery, setRecovery] = useState<string | null>(null)
  const [recoveryInput, setRecoveryInput] = useState('')
  const [recoveryBusy, setRecoveryBusy] = useState(false)

  useEffect(() => {
    if (!note) return
    const id = setTimeout(() => setNote(null), 6000)
    return () => clearTimeout(id)
  }, [note])

  const refresh = useCallback(async () => {
    try {
      const rows = await cloudBackup.list_backups()
      setItems(rows)
    } catch (err) {
      handleError(err)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!ready) return
    if (!loggedIn) {
      setItems(null)
      return
    }
    void refresh()
  }, [loggedIn, ready, refresh])

  function handleError(err: unknown) {
    const code = err instanceof CloudError ? err.code : 'unknown'
    if (code === 'login_required' || code === 'session_expired') {
      openAuth('login', true)
      setNote({ kind: 'err', text: t('auth.err_session_expired') })
      return
    }
    const map: Record<string, string> = {
      offline: t('auth.err_offline'),
      timeout: t('auth.err_timeout'),
      too_large: t('cloud.tooLarge'),
      storage_full: t('cloud.storageFull'),
      rate_limit: t('auth.err_rate_limit'),
      invalid_file: t('cloud.err_invalid_file'),
      schema_newer: t('cloud.err_schema_newer'),
      restore_failed: t('cloud.err_restore'),
      wrong_passphrase: t('cloud.encWrong'),
      need_passphrase: t('cloud.encNeed'),
      no_backup: t('quickSave.pullNoBackup'),
      bad_key: t('cloud.recoveryBad'),
    }
    setNote({ kind: 'err', text: map[code] ?? t('auth.err_unknown') })
  }

  async function doRestore(item: CloudBackupItem, passphrase?: string) {
    if (busy) return
    if (!passphrase) {
      const ok = window.confirm(t('cloud.confirmRestore'))
      if (!ok) return
    }
    setBusy(`restore:${item.path}`)
    setNote(null)
    try {
      await cloudBackup.restore_backup(item.path, passphrase)
      setNote({ kind: 'ok', text: t('cloud.doneRestore') })
      setNeedsReload(true)
      setLegacy(null)
    } catch (err) {
      if (err instanceof CloudError && (err.code === 'need_passphrase' || err.code === 'wrong_passphrase')) {
        if (err.code === 'wrong_passphrase' && passphrase) {
          setLegacyError(t('cloud.encWrong'))
        } else {
          setLegacy({ path: item.path, salt: err.salt || '' })
          setLegacyPass('')
          setLegacyError(null)
        }
      } else {
        handleError(err)
      }
    } finally {
      setBusy(null)
    }
  }

  async function doDelete(item: CloudBackupItem) {
    if (busy) return
    const ok = window.confirm(`${t('cloud.delete')}? ${stampLabel(item.stamp, s.lang)}`)
    if (!ok) return
    setBusy(`delete:${item.path}`)
    setNote(null)
    try {
      await cloudBackup.delete_backup(item.path)
      setNote({ kind: 'ok', text: t('cloud.doneDelete') })
      await refresh()
    } catch (err) {
      handleError(err)
    } finally {
      setBusy(null)
    }
  }

  async function submitLegacy(e: React.FormEvent) {
    e.preventDefault()
    if (!legacy || legacyBusy) return
    if (!legacyPass.trim()) {
      setLegacyError(t('cloud.encWrong'))
      return
    }
    const target = items?.find((x) => x.path === legacy.path)
    if (!target) {
      setLegacy(null)
      return
    }
    setLegacyBusy(true)
    setLegacyError(null)
    try {
      await doRestore(target, legacyPass)
    } finally {
      setLegacyBusy(false)
    }
  }

  async function toggleRecovery() {
    if (recovery) {
      setRecovery(null)
      return
    }
    try {
      setRecovery(await exportRecoveryCode())
    } catch (err) {
      handleError(err)
    }
  }

  async function copyRecovery() {
    if (!recovery) return
    try {
      await navigator.clipboard.writeText(recovery)
      setNote({ kind: 'ok', text: t('cloud.recoveryCopied') })
    } catch {
      /* انتخاب دستی کافی است */
    }
  }

  async function saveRecovery() {
    if (recoveryBusy || !recoveryInput.trim()) return
    setRecoveryBusy(true)
    try {
      await importRecoveryCode(recoveryInput)
      setRecoveryInput('')
      setNote({ kind: 'ok', text: t('cloud.recoverySaved') })
    } catch (err) {
      handleError(err)
    } finally {
      setRecoveryBusy(false)
    }
  }

  if (!ready) return null

  if (!loggedIn) {
    return (
      <Panel>
        <EmptyState
          icon="🔒"
          title={t('auth.gatedTitle')}
          hint={t('auth.gatedBody')}
          action={
            <div className="flex gap-2">
              <button className="btn btn-primary" onClick={() => openAuth('login', true)}>
                {t('auth.login')}
              </button>
              <button className="btn" onClick={() => openAuth('signup', true)}>
                {t('auth.signup')}
              </button>
            </div>
          }
        />
      </Panel>
    )
  }

  const last = lastCloudBackupAt()

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-1.5 text-[11.5px]">
        <span className="chip">{t('cloud.lastBackup')}: {last ? stampLabel(
          new Date(last).toISOString().slice(0, 19).replace('T', '_').replace(/:/g, '-'),
          s.lang,
        ) : t('cloud.never')}</span>
        <span className="chip chip-success">🔐 {t('cloud.autoEnc')}</span>
      </div>

      <div className={embedded ? '' : 'card p-4 sm:p-5'}>
        <div className={`flex items-center gap-2 mb-2 ${embedded ? 'justify-end' : 'justify-between'}`}>
          {!embedded && <b className="text-[13.5px]">{t('cloud.title')}</b>}
          <button className="btn btn-ghost !py-0.5 !px-2 text-[11.5px]" onClick={() => void refresh()}>
            ↻
          </button>
        </div>

        {items == null ? (
          <div className="text-[12px] text-faint py-4 text-center">{t('cloud.loading')}</div>
        ) : items.length === 0 ? (
          <div className="text-[12px] text-faint py-4 text-center">{t('cloud.noBackups')}</div>
        ) : (
          <div className="flex flex-col">
            {items.map((item) => (
              <div key={item.path} className="flex items-center gap-2 py-2 border-b border-line last:border-0 flex-wrap">
                <div className="min-w-0 flex-1">
                  <div className="text-[12.5px] font-medium">{stampLabel(item.stamp, s.lang)}</div>
                  <div className="text-[11px] text-faint" dir="ltr">
                    {formatBytes(item.size)} · {item.name}
                  </div>
                </div>
                <button
                  className="btn !py-1 !px-2.5 text-[11.5px]"
                  disabled={busy != null}
                  onClick={() => void doRestore(item)}
                >
                  {busy === `restore:${item.path}` ? t('cloud.restoring') : t('cloud.restore')}
                </button>
                <button
                  className="btn btn-ghost !py-1 !px-2.5 text-[11.5px] text-danger"
                  disabled={busy != null}
                  onClick={() => void doDelete(item)}
                >
                  {busy === `delete:${item.path}` ? '…' : t('cloud.delete')}
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="text-[11px] text-faint mt-3 leading-relaxed">{t('cloud.replaceNote')}</div>
        <div className="text-[11px] text-faint mt-1 leading-relaxed">{t('cloud.autoEncBody')}</div>
        <div className="text-[11px] text-faint mt-1 leading-relaxed">{t('cloud.keepNote')}</div>
        <div className="text-[11px] text-faint mt-1 leading-relaxed">{t('cloud.limitNote')}</div>

        <div className="mt-3 rounded-lg border border-line bg-surface-2 p-2.5">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="text-[12px] font-semibold">🔑 {t('cloud.recoveryTitle')}</div>
            <button className="btn btn-ghost !py-0.5 !px-2 text-[11.5px]" onClick={() => void toggleRecovery()}>
              {recovery ? t('cloud.recoveryHide') : t('cloud.recoveryShow')}
            </button>
          </div>
          {recovery && (
            <>
              <div className="text-[11px] text-faint mt-1 leading-relaxed">{t('cloud.recoveryShowHint')}</div>
              <div className="flex gap-2 mt-2">
                <TextInput dir="ltr" readOnly value={recovery} onFocus={(e) => e.currentTarget.select()} className="flex-1" />
                <button className="btn !py-1 !px-2.5 text-[11.5px]" onClick={() => void copyRecovery()}>
                  {t('cloud.recoveryCopy')}
                </button>
              </div>
              <div className="text-[11px] text-faint mt-3 leading-relaxed">{t('cloud.recoveryImportHint')}</div>
              <div className="flex gap-2 mt-1.5">
                <TextInput
                  dir="ltr"
                  value={recoveryInput}
                  onChange={(e) => setRecoveryInput(e.target.value)}
                  placeholder="SZR-KEY1.…"
                  className="flex-1"
                />
                <button
                  className="btn !py-1 !px-2.5 text-[11.5px]"
                  disabled={recoveryBusy || !recoveryInput.trim()}
                  onClick={() => void saveRecovery()}
                >
                  {t('cloud.recoveryApply')}
                </button>
              </div>
            </>
          )}
        </div>

        {note && (
          <div
            className={`mt-3 text-[12px] rounded-lg border px-3 py-2 ${
              note.kind === 'ok' ? 'border-line bg-surface-2 text-success' : 'border-line bg-surface-2 text-danger'
            }`}
          >
            {note.text}
          </div>
        )}

        {needsReload && (
          <div className="mt-3 flex items-center gap-2 flex-wrap rounded-lg border border-line bg-surface-2 px-3 py-2">
            <span className="text-[12px] text-muted">{t('cloud.replaceNote')}</span>
            <button className="btn btn-primary !py-1 !px-2.5 text-[11.5px]" onClick={() => window.location.reload()}>
              ⟳ Reload
            </button>
          </div>
        )}
      </div>

      {legacy && (
        <div
          className="fixed inset-0 z-[80] grid place-items-center p-4"
          role="dialog"
          aria-modal="true"
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.stopPropagation()
              if (!legacyBusy) setLegacy(null)
            }
          }}
        >
          <div className="absolute inset-0 bg-black/45" onClick={() => (legacyBusy ? undefined : setLegacy(null))} />
          <form
            onSubmit={submitLegacy}
            className="relative w-[min(400px,94vw)] bg-surface border border-line rounded-2xl shadow-float p-5"
          >
            <div className="font-bold text-[15px] mb-1">{t('cloud.encRestoreTitle')}</div>
            <div className="text-[11.5px] text-muted leading-relaxed mb-3">{t('cloud.encRestoreBody')}</div>
            <div className="flex flex-col gap-3">
              <Field label={t('cloud.encPass')}>
                <TextInput
                  type="password"
                  dir="ltr"
                  autoFocus
                  value={legacyPass}
                  onChange={(e) => setLegacyPass(e.target.value)}
                  autoComplete="current-password"
                />
              </Field>
              {legacyError && <div className="text-[12px] text-danger">{legacyError}</div>}
              <div className="flex gap-2">
                <button type="submit" className="btn btn-primary flex-1" disabled={legacyBusy}>
                  {legacyBusy ? t('auth.working') : t('cloud.restore')}
                </button>
                <button type="button" className="btn" disabled={legacyBusy} onClick={() => setLegacy(null)}>
                  {t('common.cancel')}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
