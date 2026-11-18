import { useState, type InputHTMLAttributes } from 'react'

interface NumberInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
  value: string
  onChange: (value: string) => void
}

/**
 * ورودی عددی با جداکننده هزارگان خودکار.
 * وقتی کاربر تایپ می‌کند، هر ۳ رقم یک کاما اضافه می‌شود.
 * مقدار خام (بدون کاما) به onChange ارسال می‌شود.
 */
export function NumberInput({ value, onChange, ...props }: NumberInputProps) {
  const [display, setDisplay] = useState(() => formatNumber(value))

  function formatNumber(raw: string): string {
    // حذف همه غیر از اعداد
    const digits = raw.replace(/[^\d]/g, '')
    if (!digits) return ''
    // تبدیل به عدد و جداکننده هزارگان
    const num = Number(digits)
    if (isNaN(num)) return ''
    return num.toLocaleString('en-US')
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value.replace(/[^\d]/g, '')
    const formatted = formatNumber(raw)
    setDisplay(formatted)
    onChange(raw)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    // اجازه حذف با Backspace
    if (e.key === 'Backspace') {
      const raw = value.slice(0, -1)
      setDisplay(formatNumber(raw))
      onChange(raw)
    }
  }

  return (
    <input
      {...props}
      type="text"
      inputMode="numeric"
      dir="ltr"
      value={display}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      className={`field ${props.className ?? ''}`}
    />
  )
}
