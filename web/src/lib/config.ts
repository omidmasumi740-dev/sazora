/* ============================================================
   پیکربندی اتصال به Supabase
   - از متغیرهای محیطی خوانده می‌شود (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY)
   - کلید publishable امن است و در مرورگر استفاده می‌شود؛ service_role هرگز.
   ============================================================ */

const FALLBACK_URL = 'https://qzhnlfjrieznjhhtzmhh.supabase.co'
const FALLBACK_KEY = 'sb_publishable_ytSHE2QPH9WGuMYNfuWqZg_rPGGeSel'

export const SUPABASE_URL: string =
  (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() || FALLBACK_URL
export const SUPABASE_ANON_KEY: string =
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim() || FALLBACK_KEY

/** باکت خصوصی پشتیبان‌گیری — مسیر فایل‌ها: {user_id}/{timestamp}.zip */
export const BACKUP_BUCKET = 'backups'
/** سقف مجاز بکاپ ابری (هیچ نسخه‌ای خودکار حذف نمی‌شود) */
export const MAX_BACKUP_BYTES = 20 * 1024 * 1024
/** مهلت هر درخواست شبکه */
export const NET_TIMEOUT_MS = 15000

export const APP_SCHEMA_SUPPORTED = 14
