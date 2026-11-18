/* ============================================================
   فشرده‌سازی عکس برای ذخیره داخل IndexedDB
   - تغییر اندازه به حداکثر ۱۲۸۰ پیکسل
   - خروجی JPEG با کیفیت ۰.۷۵
   ============================================================ */

export async function compressImage(file: File, maxSize = 1280, quality = 0.75): Promise<string> {
  // imageOrientation از چرخش EXIF عکس‌های گوشی پیروی می‌کند
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    bitmap = await createImageBitmap(file)
  }
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height))
  const w = Math.round(bitmap.width * scale)
  const h = Math.round(bitmap.height * scale)

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(bitmap, 0, 0, w, h)
  bitmap.close()

  return canvas.toDataURL('image/jpeg', quality)
}

/** حجم تقریبی dataURL به کیلوبایت */
export function dataUrlKB(dataUrl: string): number {
  // هر ۴ کاراکتر base64 ≈ ۳ بایت
  const base64 = dataUrl.split(',')[1] ?? ''
  return Math.round((base64.length * 3) / 4 / 1024)
}

/** نمایش خوانا: ۸۶ مگابایت / ۴۱۲ کیلوبایت */
export function humanSize(kb: number): string {
  if (kb >= 1024) return `${(kb / 1024).toFixed(kb >= 10240 ? 0 : 1)} مگابایت`
  return `${kb} کیلوبایت`
}
