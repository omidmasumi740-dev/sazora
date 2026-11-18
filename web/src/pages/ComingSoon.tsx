import { useTranslation } from 'react-i18next'

/** صفحه‌ی «به‌زودی» برای ماژول‌های فازهای بعدی */
export default function ComingSoon({
  titleKey,
  icon,
  phase,
  items,
}: {
  titleKey: string
  icon: string
  phase: number
  items: string[]
}) {
  const { t } = useTranslation()

  return (
    <div className="b-view max-w-3xl mx-auto">
      <div className="card p-8 text-center">
        <div className="text-5xl mb-4">{icon}</div>
        <h1 className="text-[21px] font-bold tracking-tight">{t(titleKey)}</h1>
        <p className="text-[13px] text-muted mt-1.5">{t('common.comingSoon')} — فاز {phase}</p>

        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {items.map((x) => (
            <span key={x} className="chip chip-accent">
              {x}
            </span>
          ))}
        </div>

        <p className="text-[12px] text-faint mt-6 leading-relaxed max-w-md mx-auto">
          این ماژول طبق نقشه راه در فاز {phase} ساخته می‌شه. فاز ۱ (هسته اپ، تسک‌ها، پروژه‌ها و
          کارکرد کارگران) آماده اجراست.
        </p>
      </div>
    </div>
  )
}
