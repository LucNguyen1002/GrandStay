import type { ReactNode } from 'react'
import { BedDouble } from 'lucide-react'
import { LanguageToggle, useI18n } from '../i18n'

export function AuthLayout({ eyebrow, title, description, children }: {
  eyebrow: string
  title: string
  description: string
  children: ReactNode
}) {
  const { language } = useI18n()
  return <main className="relative grid min-h-screen overflow-hidden bg-ink lg:grid-cols-[1.1fr_.9fr]">
    <div className="login-hero relative hidden items-end overflow-hidden p-14 lg:flex">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_20%,#286052_0,transparent_42%),radial-gradient(circle_at_75%_70%,#bc8b3c55_0,transparent_36%)]" />
      <div className="login-orb login-orb-one" />
      <div className="login-orb login-orb-two" />
      <div className="absolute inset-8 rounded-[2.5rem] border border-white/10" />
      <div className="login-copy relative max-w-2xl pb-12">
        <div className="mb-7 inline-flex items-center gap-3 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm text-gold-soft backdrop-blur-sm"><BedDouble size={18}/> {language === 'vi' ? 'Vận hành tinh gọn, trải nghiệm trọn vẹn' : 'Effortless operations, memorable stays'}</div>
        <h1 className="font-sans text-6xl font-black leading-[1.08] tracking-[-0.04em] text-white">{language === 'vi' ? <>Mỗi kỳ nghỉ,<br/><span className="text-gold-soft">một dấu ấn.</span></> : <>Every stay,<br/><span className="text-gold-soft">a lasting memory.</span></>}</h1>
        <p className="mt-6 max-w-lg text-lg leading-8 text-slate-300">{language === 'vi' ? 'Nền tảng điều hành tập trung cho lễ tân, buồng phòng, doanh thu và chăm sóc khách hàng.' : 'One connected platform for front desk, housekeeping, revenue and guest care.'}</p>
      </div>
    </div>
    <div className="relative flex items-center justify-center overflow-y-auto bg-cream px-5 py-10 sm:px-12">
      <LanguageToggle className="absolute right-4 top-4 sm:right-7 sm:top-6" />
      <div className="login-form-panel w-full max-w-md">
        <div className="mb-8 flex items-center gap-3 lg:hidden"><div className="grid size-11 place-items-center rounded-xl bg-ink font-brand text-xl text-gold">G</div><span className="font-brand text-2xl font-bold">GrandStay</span></div>
        <p className="text-xs font-bold uppercase tracking-[.22em] text-gold">{eyebrow}</p>
        <h2 className="mt-3 font-sans text-4xl font-black tracking-[-0.035em]">{title}</h2>
        <p className="mt-3 text-sm leading-6 text-ink-soft">{description}</p>
        {children}
      </div>
    </div>
  </main>
}
