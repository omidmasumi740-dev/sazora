/* ============================================================
   رمزنگاری بکاپ ابری — AES-GCM با کلید مشتق‌شده از رمز کاربر
   - PBKDF2-SHA256 با salt تصادفی
   - کلید خام فقط با DPAPI روی همین دستگاه نگه داشته می‌شود
   - هیچ متن روشنی از داده‌ها به Supabase نمی‌رود
   ============================================================ */

export const PBKDF2_ITERATIONS = 210000

const enc = new TextEncoder()
const dec = new TextDecoder()

export function randomB64(bytes: number): string {
  const arr = new Uint8Array(bytes)
  crypto.getRandomValues(arr)
  return bytesToB64(arr)
}

export function bytesToB64(bytes: Uint8Array): string {
  let s = ''
  for (let i = 0; i < bytes.length; i += 0x8000) {
    s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  }
  return btoa(s)
}

export function b64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
  const bin = atob(b64)
  const out = new Uint8Array(new ArrayBuffer(bin.length))
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

function buf(u: Uint8Array): ArrayBuffer {
  const copy = new ArrayBuffer(u.byteLength)
  new Uint8Array(copy).set(u)
  return copy
}

async function importAesKey(raw: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', buf(raw), { name: 'AES-GCM' }, false, ['encrypt', 'decrypt'])
}

export async function deriveKeyRaw(passphrase: string, saltB64: string): Promise<string> {
  const base = await crypto.subtle.importKey('raw', enc.encode(passphrase), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: buf(b64ToBytes(saltB64)), iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    base,
    256,
  )
  return bytesToB64(new Uint8Array(bits))
}

export interface EncryptedBlob {
  iv: string
  ciphertext: string
}

export async function encryptText(text: string, rawKeyB64: string): Promise<EncryptedBlob> {
  const key = await importAesKey(b64ToBytes(rawKeyB64))
  const iv = new Uint8Array(12)
  crypto.getRandomValues(iv)
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(text))
  return { iv: bytesToB64(iv), ciphertext: bytesToB64(new Uint8Array(ct)) }
}

export async function decryptText(blob: EncryptedBlob, rawKeyB64: string): Promise<string> {
  const key = await importAesKey(b64ToBytes(rawKeyB64))
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: b64ToBytes(blob.iv) },
    key,
    b64ToBytes(blob.ciphertext),
  )
  return dec.decode(plain)
}
