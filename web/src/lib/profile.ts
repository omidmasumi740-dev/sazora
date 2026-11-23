/* ============================================================
   پروفایل محلی — نام و عکس
   نام در sazora-settings (zustand persist) و عکس در localStorage
   نگه داشته می‌شوند؛ هر دو در بکاپ/همگام‌سازی ابری هم می‌آیند.
   ============================================================ */
import { useSettings } from '../store/settings'

export const PROFILE_PHOTO_KEY = 'sazora-profile-photo'
export const PROFILE_EVENT = 'sazora:profile'
const SETTINGS_KEY = 'sazora-settings'

export function getProfilePhoto(): string | null {
  try {
    return localStorage.getItem(PROFILE_PHOTO_KEY)
  } catch {
    return null
  }
}

export function setProfilePhoto(dataUrl: string | null): void {
  try {
    if (dataUrl) localStorage.setItem(PROFILE_PHOTO_KEY, dataUrl)
    else localStorage.removeItem(PROFILE_PHOTO_KEY)
  } catch {
    /* حافظه پر یا غیرفعال — نادیده بگیر */
  }
  try {
    window.dispatchEvent(new CustomEvent(PROFILE_EVENT))
  } catch {
    /* ignore */
  }
}

/** خواندن نام ذخیره‌شده بدون تغییر استور (برای بکاپ) */
export function readStoredUserName(): string {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (!raw) return ''
    const parsed = JSON.parse(raw) as { state?: { userName?: unknown } }
    return typeof parsed.state?.userName === 'string' ? parsed.state.userName : ''
  } catch {
    return ''
  }
}

export interface BackupProfile {
  userName?: string
  photo?: string | null
}

/** snapshot پروفایل برای فایل بکاپ */
export function readBackupProfile(): BackupProfile {
  return {
    userName: useSettings.getState().userName,
    photo: getProfilePhoto(),
  }
}

/** اعمال پروفایلِ آمده از بکاپ/همگام‌سازی روی این دستگاه */
export function applyBackupProfile(profile: unknown): void {
  if (!profile || typeof profile !== 'object') return
  const p = profile as BackupProfile
  if (typeof p.userName === 'string') useSettings.getState().setUserName(p.userName)
  if (p.photo === null) setProfilePhoto(null)
  else if (typeof p.photo === 'string' && p.photo) setProfilePhoto(p.photo)
}
