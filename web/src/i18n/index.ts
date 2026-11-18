import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { fa } from './fa'
import { en } from './en'

export type Lang = 'fa' | 'en'

i18n.use(initReactI18next).init({
  resources: {
    fa: { translation: fa },
    en: { translation: en },
  },
  lng: 'fa',
  fallbackLng: 'fa',
  interpolation: { escapeValue: false },
})

/**
 * جهت متن — طبق درخواست کاربر، اپ همیشه راست‌چین (RTL) می‌ماند؛
 * تغییر زبان فقط متن‌ها را عوض می‌کند و چیدمان صفحه را برنمی‌گرداند.
 */
export function dirOf(_lang: Lang): 'rtl' | 'ltr' {
  return 'rtl'
}

export function setLang(lang: Lang) {
  i18n.changeLanguage(lang)
  document.documentElement.lang = lang
  document.documentElement.dir = 'rtl'
  document.documentElement.dataset.lang = lang
}

export default i18n
