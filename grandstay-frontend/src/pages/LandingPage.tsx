import { useEffect, useRef, useState, type CSSProperties, type FormEvent, type PointerEvent as ReactPointerEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  ArrowLeft,
  ArrowUp,
  BedDouble,
  CalendarDays,
  Check,
  ChevronDown,
  Clock3,
  Coffee,
  Headphones,
  KeyRound,
  Menu,
  ShieldCheck,
  Sparkles,
  UsersRound,
  Waves,
  Wifi,
  X,
} from 'lucide-react'
import { useAuth } from '../auth/AuthProvider'
import { defaultAuthenticatedRoute } from '../auth/routes'
import heroImage from '../assets/grandstay-hero.png'
import journeyDuringImage from '../assets/journey-during.webp'
import journeyAfterImage from '../assets/journey-after.webp'
import { LanguageToggle, useI18n } from '../i18n'

const navigation = [
  { href: '#phong-nghi', label: 'Phòng nghỉ', labelEn: 'Rooms' },
  { href: '#trai-nghiem', label: 'Trải nghiệm', labelEn: 'Experience' },
  { href: '#tien-nghi', label: 'Tiện nghi', labelEn: 'Amenities' },
  { href: '#ve-grandstay', label: 'Về GrandStay', labelEn: 'About GrandStay' },
]

const roomOptions = [
  {
    eyebrow: '01 · Nghỉ dưỡng',
    title: 'Không gian để thật sự nghỉ ngơi',
    description: 'Thiết kế ấm áp, ánh sáng tự nhiên và từng tiện nghi được chọn lọc để bạn luôn thấy thoải mái như ở nhà.',
    eyebrowEn: '01 · REST', titleEn: 'A space designed for true rest', descriptionEn: 'Warm design, natural light and carefully selected amenities make every stay feel effortlessly comfortable.',
    icon: BedDouble,
    tone: 'from-[#173b55] to-[#102a43]',
  },
  {
    eyebrow: '02 · Linh hoạt',
    title: 'Một lựa chọn cho mọi hành trình',
    description: 'Từ chuyến công tác ngắn ngày đến kỳ nghỉ cùng gia đình, GrandStay giúp bạn tìm không gian phù hợp nhanh chóng.',
    eyebrowEn: '02 · FLEXIBLE', titleEn: 'One choice for every journey', descriptionEn: 'From a short business trip to a family holiday, GrandStay helps you quickly find the right space.',
    icon: KeyRound,
    tone: 'from-[#347466] to-[#24554b]',
  },
  {
    eyebrow: '03 · An tâm',
    title: 'Trải nghiệm liền mạch từ đầu đến cuối',
    description: 'Thông tin lưu trú rõ ràng, dữ liệu được bảo vệ và đội ngũ luôn sẵn sàng hỗ trợ trong suốt kỳ nghỉ.',
    eyebrowEn: '03 · PEACE OF MIND', titleEn: 'A seamless stay from start to finish', descriptionEn: 'Clear stay information, protected data and a team ready to support you throughout the journey.',
    icon: ShieldCheck,
    tone: 'from-[#c89a4f] to-[#a8792f]',
  },
]

const amenities = [
  { icon: Wifi, title: 'Kết nối liền mạch', text: 'Không gian làm việc và kết nối ổn định cho cả nghỉ dưỡng lẫn công tác.', titleEn: 'Seamless connection', textEn: 'Reliable connectivity and work-friendly spaces for both leisure and business.' },
  { icon: Coffee, title: 'Khởi đầu thư thái', text: 'Những khoảng nghỉ chậm rãi để mỗi ngày của bạn bắt đầu thật dễ chịu.', titleEn: 'A relaxed beginning', textEn: 'Thoughtful pauses that help each day begin with calm and comfort.' },
  { icon: Waves, title: 'Cân bằng thân tâm', text: 'Một nhịp sống nhẹ nhàng, gần thiên nhiên và tách biệt khỏi ồn ào thường nhật.', titleEn: 'Mindful balance', textEn: 'A gentler rhythm close to nature and away from everyday noise.' },
  { icon: Headphones, title: 'Hỗ trợ tận tâm', text: 'Đồng hành trước, trong và sau kỳ nghỉ với quy trình rõ ràng, chuyên nghiệp.', titleEn: 'Thoughtful support', textEn: 'Professional assistance before, during and after every stay.' },
]

const journeySlides = [
  {
    eyebrow: 'Trước kỳ nghỉ',
    title: 'Tìm đúng không gian chỉ trong vài thao tác.',
    text: 'Ngày lưu trú, số khách và nhu cầu của bạn được đặt ở trung tâm để hành trình lựa chọn luôn ngắn gọn, rõ ràng.',
    quote: 'Sự thư thái bắt đầu ngay từ lúc bạn lên kế hoạch.',
    points: ['Tìm phòng nhanh chóng', 'Thông tin dễ so sánh', 'Lựa chọn chủ động', 'Tài khoản bảo mật'],
    image: heroImage,
    imageAlt: 'Phòng nghỉ GrandStay ấm áp với ban công hướng ra thiên nhiên',
    position: '66% center',
  },
  {
    eyebrow: 'Trong kỳ nghỉ',
    title: 'Mọi trải nghiệm diễn ra theo nhịp của bạn.',
    text: 'Từ lúc nhận phòng đến những nhu cầu phát sinh, quy trình thống nhất giúp đội ngũ GrandStay phục vụ nhanh và chính xác hơn.',
    quote: 'Sang trọng là khi mọi điều bạn cần xuất hiện đúng lúc.',
    points: ['Nhận phòng thuận tiện', 'Hỗ trợ xuyên suốt', 'Dịch vụ nhất quán', 'Không gian riêng tư'],
    image: journeyDuringImage,
    imageAlt: 'Không gian thư giãn bên hồ bơi trong khuôn viên GrandStay',
    position: 'center',
  },
  {
    eyebrow: 'Sau kỳ nghỉ',
    title: 'Một lời tạm biệt nhẹ nhàng, một ký ức ở lại.',
    text: 'Thông tin minh bạch và trải nghiệm liền mạch giúp bạn kết thúc hành trình an tâm, đồng thời sẵn sàng cho lần trở lại tiếp theo.',
    quote: 'Một kỳ nghỉ đẹp luôn để lại cảm giác muốn quay về.',
    points: ['Trả phòng rõ ràng', 'Thông tin được lưu giữ', 'Chăm sóc tận tâm', 'Sẵn sàng trở lại'],
    image: journeyAfterImage,
    imageAlt: 'Sảnh đón GrandStay mở ra lối đi xanh mát khi kết thúc kỳ nghỉ',
    position: 'center',
  },
]

const journeyEnglish = [
  { eyebrow: 'Before your stay', title: 'Find the right space in just a few steps.', text: 'Your dates, guest count and preferences stay at the center, keeping every choice simple and clear.', quote: 'Relaxation begins the moment you start planning.', points: ['Quick room search', 'Easy comparison', 'Flexible choices', 'Protected account'], imageAlt: 'A warm GrandStay guest room opening to a nature-facing balcony' },
  { eyebrow: 'During your stay', title: 'Every experience follows your rhythm.', text: 'From check-in to every request along the way, one consistent process helps our team serve you quickly and accurately.', quote: 'True luxury is having what you need at exactly the right moment.', points: ['Convenient check-in', 'Continuous support', 'Consistent service', 'Private space'], imageAlt: 'A relaxing poolside space at GrandStay' },
  { eyebrow: 'After your stay', title: 'A gentle goodbye, a lasting memory.', text: 'Transparent information and a seamless experience help you leave with confidence and look forward to returning.', quote: 'A beautiful stay always leaves you wanting to return.', points: ['Clear check-out', 'Saved stay information', 'Thoughtful care', 'Ready to return'], imageAlt: 'GrandStay lobby opening onto a green walkway after check-out' },
]

function dateInputValue(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function nextDate(value: string) {
  const date = new Date(`${value}T12:00:00`)
  date.setDate(date.getDate() + 1)
  return dateInputValue(date)
}

export function LandingPage() {
  const { language } = useI18n()
  const navigate = useNavigate()
  const { isAuthenticated, user } = useAuth()
  const pageRef = useRef<HTMLElement>(null)
  const today = dateInputValue(new Date())
  const [checkIn, setCheckIn] = useState(today)
  const [checkOut, setCheckOut] = useState(nextDate(today))
  const [guests, setGuests] = useState('2')
  const [menuOpen, setMenuOpen] = useState(false)
  const [activeJourney, setActiveJourney] = useState(0)
  const [sliderPaused, setSliderPaused] = useState(false)
  const [showBackToTop, setShowBackToTop] = useState(false)
  const [reduceMotion, setReduceMotion] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  const systemRoute = user ? defaultAuthenticatedRoute(user) : '/login'
  const journey = language === 'en' ? { ...journeySlides[activeJourney], ...journeyEnglish[activeJourney] } : journeySlides[activeJourney]

  useEffect(() => {
    // Wake the free Render instance while visitors explore the landing page.
    // Authentication remains an explicit user action on the login page.
    void fetch('/backend-healthz', {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    }).catch(() => undefined)
  }, [])

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    const updatePreference = () => setReduceMotion(mediaQuery.matches)
    mediaQuery.addEventListener('change', updatePreference)
    return () => mediaQuery.removeEventListener('change', updatePreference)
  }, [])

  useEffect(() => {
    const root = pageRef.current
    if (!root) return
    root.classList.add('landing-motion-ready')
    const elements = root.querySelectorAll<HTMLElement>('[data-reveal]')
    if (reduceMotion || !('IntersectionObserver' in window)) {
      elements.forEach(element => element.classList.add('is-visible'))
      return
    }
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return
        entry.target.classList.add('is-visible')
        observer.unobserve(entry.target)
      })
    }, { rootMargin: '0px 0px -9% 0px', threshold: 0.12 })
    elements.forEach(element => observer.observe(element))
    return () => observer.disconnect()
  }, [reduceMotion])

  useEffect(() => {
    if (sliderPaused || reduceMotion) return
    const timer = window.setInterval(() => {
      setActiveJourney(current => (current + 1) % journeySlides.length)
    }, 6000)
    return () => window.clearInterval(timer)
  }, [sliderPaused, reduceMotion])

  useEffect(() => {
    const updateVisibility = () => setShowBackToTop(window.scrollY > 640)
    updateVisibility()
    window.addEventListener('scroll', updateVisibility, { passive: true })
    return () => window.removeEventListener('scroll', updateVisibility)
  }, [])

  const moveHero = (event: ReactPointerEvent<HTMLElement>) => {
    if (reduceMotion || event.pointerType === 'touch') return
    const bounds = event.currentTarget.getBoundingClientRect()
    const x = ((event.clientX - bounds.left) / bounds.width - 0.5) * -8
    const y = ((event.clientY - bounds.top) / bounds.height - 0.5) * -5
    event.currentTarget.style.setProperty('--hero-x', `${x}px`)
    event.currentTarget.style.setProperty('--hero-y', `${y}px`)
  }

  const resetHero = (event: ReactPointerEvent<HTMLElement>) => {
    event.currentTarget.style.setProperty('--hero-x', '0px')
    event.currentTarget.style.setProperty('--hero-y', '0px')
  }

  const showJourney = (index: number) => setActiveJourney((index + journeySlides.length) % journeySlides.length)

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' })

  const changeCheckIn = (value: string) => {
    setCheckIn(value)
    if (checkOut <= value) setCheckOut(nextDate(value))
  }

  const searchRooms = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const destination = `/rooms?checkIn=${encodeURIComponent(checkIn)}&checkOut=${encodeURIComponent(checkOut)}&guests=${guests}`
    if (isAuthenticated) navigate(destination)
    else navigate('/login', { state: { from: destination } })
  }

  return <main ref={pageRef} className="landing-page min-h-screen overflow-hidden bg-[#f8f5ee] text-ink">
    <section onPointerMove={moveHero} onPointerLeave={resetHero} className="landing-hero relative min-h-[760px] overflow-hidden bg-ink text-white lg:min-h-[820px]">
      <img src={heroImage} alt="Không gian phòng nghỉ GrandStay hướng ra thiên nhiên" className="landing-hero-image absolute inset-0 size-full object-cover object-[62%_center]" />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(8,27,43,.96)_0%,rgba(10,33,51,.88)_35%,rgba(9,27,42,.32)_72%,rgba(8,24,38,.18)_100%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,20,32,.55)_0%,transparent_28%,rgba(5,20,32,.28)_100%)]" />

      <header className="landing-header relative z-30 border-b border-white/12">
        <div className="mx-auto flex h-20 max-w-[1440px] items-center justify-between px-5 sm:px-8 lg:px-12">
          <Link to="/" className="landing-brand flex items-center gap-3 rounded-xl" aria-label="GrandStay - Trang chủ">
            <span className="landing-brand-mark grid size-11 place-items-center rounded-xl border border-gold/60 bg-white/8 font-brand text-xl font-bold text-gold-soft backdrop-blur">G</span>
            <span>
              <span className="block font-brand text-xl font-bold tracking-wide">GrandStay</span>
              <span className="block text-[9px] font-bold uppercase tracking-[.28em] text-gold-soft">Stay beautifully</span>
            </span>
          </Link>

          <nav aria-label={language === 'vi' ? 'Điều hướng trang chủ' : 'Main navigation'} className="hidden items-center gap-8 lg:flex">
            {navigation.map(item => <a key={item.href} href={item.href} className="landing-nav-link relative py-2 text-sm font-semibold text-white/78 transition hover:text-gold-soft">{language === 'en' ? item.labelEn : item.label}</a>)}
          </nav>

          <div className="hidden items-center gap-3 sm:flex">
            <LanguageToggle compact className="!border-white/20 !bg-white/10 !text-white shadow-none"/>
            {!isAuthenticated && <Link to="/login" className="rounded-xl px-4 py-2.5 text-sm font-bold text-white/85 transition hover:bg-white/8 hover:text-white">{language === 'vi' ? 'Đăng nhập' : 'Sign in'}</Link>}
            <Link to={systemRoute} className="landing-arrow-button inline-flex min-h-11 items-center gap-2 rounded-xl bg-gold px-5 py-2.5 text-sm font-extrabold text-white shadow-lg shadow-black/15 transition hover:-translate-y-0.5 hover:bg-[#c99a4d]">
              {isAuthenticated ? (language === 'vi' ? 'Vào hệ thống' : 'Open dashboard') : (language === 'vi' ? 'Đặt phòng ngay' : 'Book now')}<ArrowRight size={16}/>
            </Link>
          </div>

          <button type="button" aria-label="Mở trình đơn" aria-expanded={menuOpen} onClick={() => setMenuOpen(value => !value)} className="grid size-11 place-items-center rounded-xl border border-white/15 bg-white/8 sm:hidden">
            {menuOpen ? <X size={21}/> : <Menu size={21}/>} 
          </button>
        </div>
        {menuOpen && <div className="border-t border-white/10 bg-ink/95 px-5 py-5 backdrop-blur-xl sm:hidden">
          <div className="mb-3 flex justify-end"><LanguageToggle className="!border-white/20 !bg-white/10 !text-white shadow-none"/></div>
          <nav className="grid gap-1">
            {navigation.map(item => <a key={item.href} href={item.href} onClick={() => setMenuOpen(false)} className="rounded-xl px-3 py-3 text-sm font-semibold text-white/80 hover:bg-white/8 hover:text-white">{language === 'en' ? item.labelEn : item.label}</a>)}
          </nav>
          <div className="mt-4 grid grid-cols-2 gap-3 border-t border-white/10 pt-4">
            {!isAuthenticated && <Link to="/login" className="grid min-h-11 place-items-center rounded-xl border border-white/20 text-sm font-bold">{language === 'vi' ? 'Đăng nhập' : 'Sign in'}</Link>}
            <Link to={systemRoute} className={`grid min-h-11 place-items-center rounded-xl bg-gold px-3 text-sm font-bold ${isAuthenticated ? 'col-span-2' : ''}`}>{isAuthenticated ? (language === 'vi' ? 'Vào hệ thống' : 'Dashboard') : (language === 'vi' ? 'Đặt phòng' : 'Book')}</Link>
          </div>
        </div>}
      </header>

      <div className="relative z-10 mx-auto flex min-h-[610px] max-w-[1440px] items-center px-5 pb-28 pt-14 sm:px-8 lg:min-h-[660px] lg:px-12 lg:pb-32">
        <div className="max-w-3xl">
          <div className="landing-hero-kicker mb-6 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/8 px-4 py-2 text-xs font-bold uppercase tracking-[.2em] text-gold-soft backdrop-blur-md">
            <Sparkles size={15}/> {language === 'vi' ? 'Kỳ nghỉ theo cách của riêng bạn' : 'A stay shaped around you'}
          </div>
          <h1 className="landing-hero-title max-w-3xl font-display text-[clamp(3.2rem,7vw,6.75rem)] font-black leading-[.92] tracking-[-.055em] text-white">
            {language === 'vi' ? <>Chạm vào sự <span className="font-brand font-normal italic text-gold-soft">thảnh thơi.</span></> : <>Step into <span className="font-brand font-normal italic text-gold-soft">effortless calm.</span></>}
          </h1>
          <p className="landing-hero-description mt-7 max-w-xl text-base leading-8 text-slate-200 sm:text-lg">
            {language === 'vi' ? 'Một nơi dừng chân tinh tế, nơi từng không gian được tạo nên để bạn nghỉ sâu hơn, kết nối nhiều hơn và lưu giữ những khoảnh khắc đáng nhớ.' : 'A refined place to stay, where every space helps you rest more deeply, connect more meaningfully and preserve memorable moments.'}
          </p>
          <div className="landing-hero-actions mt-9 flex flex-wrap items-center gap-5">
            <a href="#dat-phong" className="landing-arrow-button inline-flex min-h-13 items-center gap-2 rounded-xl bg-gold px-6 text-sm font-extrabold text-white shadow-xl shadow-black/20 transition hover:-translate-y-0.5 hover:bg-[#ca9a4b]">{language === 'vi' ? 'Khám phá kỳ nghỉ' : 'Explore your stay'}<ArrowRight size={17}/></a>
            <a href="#phong-nghi" className="group inline-flex items-center gap-2 text-sm font-bold text-white/85 transition hover:text-white">{language === 'vi' ? 'Xem không gian phòng' : 'View our rooms'} <span className="grid size-9 place-items-center rounded-full border border-white/25 transition group-hover:border-gold-soft group-hover:text-gold-soft"><ChevronDown size={16}/></span></a>
          </div>
          <div className="landing-hero-trust mt-11 flex flex-wrap gap-x-7 gap-y-3 text-xs font-semibold text-white/72">
            <span className="flex items-center gap-2"><Check size={15} className="text-gold-soft"/>{language === 'vi' ? 'Quy trình minh bạch' : 'Transparent process'}</span>
            <span className="flex items-center gap-2"><Check size={15} className="text-gold-soft"/>{language === 'vi' ? 'Dữ liệu được bảo vệ' : 'Protected data'}</span>
            <span className="flex items-center gap-2"><Check size={15} className="text-gold-soft"/>{language === 'vi' ? 'Hỗ trợ tận tâm' : 'Thoughtful support'}</span>
          </div>
        </div>
      </div>
    </section>

    <section id="dat-phong" className="relative z-20 mx-auto -mt-20 max-w-[1340px] scroll-mt-24 px-4 sm:px-8">
      <form onSubmit={searchRooms} className="landing-search grid overflow-hidden rounded-[1.5rem] border border-white/70 bg-white shadow-[0_24px_70px_rgba(16,42,67,.16)] lg:grid-cols-[1fr_1fr_.85fr_auto]">
        <label className="landing-search-field group flex min-h-25 items-center gap-4 border-b border-slate-100 px-5 py-5 transition hover:bg-amber-50/35 sm:px-7 lg:border-b-0 lg:border-r">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-forest/8 text-forest"><CalendarDays size={20}/></span>
          <span className="min-w-0 flex-1">
            <span className="mb-1 block text-[10px] font-extrabold uppercase tracking-[.16em] text-ink-soft">{language === 'vi' ? 'Nhận phòng' : 'Check-in'}</span>
            <input type="date" value={checkIn} min={today} onChange={event => changeCheckIn(event.target.value)} className="w-full bg-transparent text-sm font-bold text-ink outline-none" aria-label={language === 'vi' ? 'Ngày nhận phòng' : 'Check-in date'} />
          </span>
        </label>
        <label className="landing-search-field group flex min-h-25 items-center gap-4 border-b border-slate-100 px-5 py-5 transition hover:bg-amber-50/35 sm:px-7 lg:border-b-0 lg:border-r">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-gold/10 text-gold"><Clock3 size={20}/></span>
          <span className="min-w-0 flex-1">
            <span className="mb-1 block text-[10px] font-extrabold uppercase tracking-[.16em] text-ink-soft">{language === 'vi' ? 'Trả phòng' : 'Check-out'}</span>
            <input type="date" value={checkOut} min={nextDate(checkIn)} onChange={event => setCheckOut(event.target.value)} className="w-full bg-transparent text-sm font-bold text-ink outline-none" aria-label={language === 'vi' ? 'Ngày trả phòng' : 'Check-out date'} />
          </span>
        </label>
        <label className="landing-search-field group flex min-h-25 items-center gap-4 border-b border-slate-100 px-5 py-5 transition hover:bg-amber-50/35 sm:px-7 lg:border-b-0 lg:border-r">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-ink/6 text-ink"><UsersRound size={20}/></span>
          <span className="min-w-0 flex-1">
            <span className="mb-1 block text-[10px] font-extrabold uppercase tracking-[.16em] text-ink-soft">{language === 'vi' ? 'Khách lưu trú' : 'Guests'}</span>
            <select value={guests} onChange={event => setGuests(event.target.value)} className="w-full appearance-none bg-transparent text-sm font-bold text-ink outline-none" aria-label={language === 'vi' ? 'Số khách' : 'Guest count'}>
              {[1, 2, 3, 4].map(count => <option key={count} value={count}>{count} {language === 'vi' ? 'khách' : count === 1 ? 'guest' : 'guests'}</option>)}
              <option value="5">5+ {language === 'vi' ? 'khách' : 'guests'}</option>
            </select>
          </span>
        </label>
        <div className="flex items-stretch p-3 sm:p-4">
          <button type="submit" className="landing-arrow-button inline-flex min-h-16 w-full items-center justify-center gap-2 rounded-xl bg-ink px-7 text-sm font-extrabold text-white shadow-lg shadow-ink/15 transition hover:-translate-y-0.5 hover:bg-[#183f61] lg:min-w-48">
            {language === 'vi' ? 'Tìm phòng phù hợp' : 'Find a room'}<ArrowRight size={17}/>
          </button>
        </div>
      </form>
      {!isAuthenticated && <p className="mt-3 text-center text-xs text-ink-soft">{language === 'vi' ? 'Bạn sẽ được yêu cầu đăng nhập để xem thông tin phòng phù hợp.' : 'You will be asked to sign in before viewing matching rooms.'}</p>}
    </section>

    <section id="phong-nghi" className="scroll-mt-24 px-5 pb-24 pt-28 sm:px-8 lg:pb-32 lg:pt-36">
      <div className="mx-auto max-w-[1240px]">
        <div className="grid items-end gap-8 lg:grid-cols-[1fr_.75fr]">
          <div data-reveal="left">
            <p className="text-xs font-extrabold uppercase tracking-[.22em] text-gold">{language === 'vi' ? 'Không gian GrandStay' : 'GrandStay spaces'}</p>
            <h2 className="mt-4 max-w-3xl font-display text-4xl font-black leading-[1.05] tracking-[-.04em] sm:text-5xl lg:text-6xl">{language === 'vi' ? 'Được thiết kế cho cách bạn muốn tận hưởng.' : 'Designed around the way you want to stay.'}</h2>
          </div>
          <p data-reveal="right" className="max-w-xl text-sm leading-7 text-ink-soft lg:justify-self-end">{language === 'vi' ? 'Không chỉ là một căn phòng. Đó là khoảng không riêng tư để nghỉ ngơi, làm việc, sum họp và tận hưởng chuyến đi theo đúng nhịp của bạn.' : 'More than a room: a private space to rest, work, reconnect and enjoy the journey at your own pace.'}</p>
        </div>

        <div className="mt-14 grid items-stretch gap-5 lg:grid-cols-3">
          {roomOptions.map((option, index) => { const { icon: Icon, tone } = option; const eyebrow = language === 'en' ? option.eyebrowEn : option.eyebrow; const title = language === 'en' ? option.titleEn : option.title; const description = language === 'en' ? option.descriptionEn : option.description; return <article key={title} data-reveal="feature-card" style={{ '--reveal-delay': `${index * 90}ms` } as CSSProperties} className={`landing-feature-card group relative h-full min-h-[390px] overflow-hidden rounded-[1.75rem] bg-gradient-to-br ${tone} p-7 text-white shadow-[0_18px_45px_rgba(16,42,67,.12)] sm:p-8`}>
            <div className="absolute -right-12 -top-12 size-52 rounded-full border border-white/10 transition duration-700 group-hover:scale-110" />
            <div className="absolute -bottom-20 -left-16 size-60 rounded-full bg-white/5 blur-2xl" />
            <div className="relative flex h-full min-h-[326px] flex-col">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-extrabold uppercase tracking-[.2em] text-white/68">{eyebrow}</p>
                <span className="grid size-12 place-items-center rounded-2xl border border-white/14 bg-white/8"><Icon size={22}/></span>
              </div>
              <div className="mt-auto">
                <h3 className="max-w-xs font-display text-3xl font-black leading-tight tracking-[-.03em]">{title}</h3>
                <p className="mt-4 text-sm leading-7 text-white/72">{description}</p>
              </div>
            </div>
          </article>})}
        </div>
      </div>
    </section>

    <section id="trai-nghiem" className="landing-journey scroll-mt-24 bg-[#0d273d] px-5 py-24 text-white sm:px-8 lg:py-32">
      <div
        className="mx-auto grid max-w-[1240px] gap-12 lg:grid-cols-[1fr_1.05fr] lg:items-center"
        onPointerEnter={() => setSliderPaused(true)}
        onPointerLeave={() => setSliderPaused(false)}
        onFocusCapture={() => setSliderPaused(true)}
        onBlurCapture={event => {
          if (!event.currentTarget.contains(event.relatedTarget)) setSliderPaused(false)
        }}
      >
        <div data-reveal="left" className="landing-experience-visual relative min-h-[460px] overflow-hidden rounded-[2rem]">
          {journeySlides.map((slide, index) => <img
            key={slide.image}
            src={slide.image}
            alt={activeJourney === index ? (language === 'en' ? journeyEnglish[index].imageAlt : slide.imageAlt) : ''}
            aria-hidden={activeJourney !== index}
            className={`landing-experience-image absolute inset-0 size-full object-cover ${activeJourney === index ? 'is-active' : ''}`}
            style={{ objectPosition: slide.position }}
            loading="lazy"
          />)}
          <div className="absolute inset-0 bg-gradient-to-t from-ink/90 via-ink/10 to-transparent" />
          <div key={`quote-${activeJourney}`} className="landing-slide-quote absolute bottom-0 left-0 p-7 sm:p-9">
            <p className="text-xs font-bold uppercase tracking-[.2em] text-gold-soft">{journey.eyebrow}</p>
            <p className="landing-journey-quote mt-3 max-w-sm text-2xl leading-snug">“{journey.quote}”</p>
          </div>
          <div className="absolute right-5 top-5 rounded-full border border-white/15 bg-ink/35 px-3 py-1.5 text-[10px] font-extrabold tracking-[.18em] backdrop-blur-md">
            0{activeJourney + 1} / 0{journeySlides.length}
          </div>
        </div>

        <div data-reveal="right" className="lg:pl-10">
          <div key={`content-${activeJourney}`} className="landing-slide-copy">
            <p className="text-xs font-extrabold uppercase tracking-[.22em] text-gold-soft">{journey.eyebrow} · {language === 'vi' ? 'Trọn vẹn từng khoảnh khắc' : 'Every moment, considered'}</p>
            <h2 className="mt-4 font-display text-4xl font-black leading-[1.05] tracking-[-.04em] sm:text-5xl">{journey.title}</h2>
            <p className="mt-6 max-w-xl text-sm leading-7 text-slate-300">{journey.text}</p>
            <div className="mt-9 grid gap-4 sm:grid-cols-2">
              {journey.points.map((item, index) => <div key={item} style={{ '--item-delay': `${index * 70}ms` } as CSSProperties} className="landing-slide-point flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3.5 text-sm font-semibold transition hover:-translate-y-0.5 hover:border-gold/35 hover:bg-white/9"><span className="grid size-6 place-items-center rounded-full bg-gold/20 text-gold-soft"><Check size={14}/></span>{item}</div>)}
            </div>
          </div>

          <div className="mt-9 flex flex-wrap items-center justify-between gap-5">
            <div className="flex items-center gap-2" role="tablist" aria-label={language === 'vi' ? 'Các giai đoạn trải nghiệm' : 'Stay journey stages'}>
              {journeySlides.map((slide, index) => <button
                key={slide.eyebrow}
                type="button"
                role="tab"
                aria-selected={activeJourney === index}
                aria-label={`${language === 'vi' ? 'Xem' : 'View'} ${(language === 'en' ? journeyEnglish[index].eyebrow : slide.eyebrow).toLowerCase()}`}
                onClick={() => showJourney(index)}
                className={`landing-slide-dot relative h-1.5 overflow-hidden rounded-full transition-[width,background] duration-500 ${activeJourney === index ? 'w-14 bg-white/22' : 'w-7 bg-white/18 hover:bg-white/35'}`}
              >
                {activeJourney === index && <span key={activeJourney} className={`landing-slide-progress absolute inset-y-0 left-0 rounded-full bg-gold-soft ${sliderPaused ? 'is-paused' : ''}`} />}
              </button>)}
            </div>
            <div className="flex gap-2">
              <button type="button" aria-label={language === 'vi' ? 'Trải nghiệm trước' : 'Previous slide'} onClick={() => showJourney(activeJourney - 1)} className="landing-slider-arrow grid size-11 place-items-center rounded-full border border-white/15 text-white/80 transition hover:border-gold-soft hover:bg-gold hover:text-white"><ArrowLeft size={17}/></button>
              <button type="button" aria-label={language === 'vi' ? 'Trải nghiệm tiếp theo' : 'Next slide'} onClick={() => showJourney(activeJourney + 1)} className="landing-slider-arrow grid size-11 place-items-center rounded-full border border-white/15 text-white/80 transition hover:border-gold-soft hover:bg-gold hover:text-white"><ArrowRight size={17}/></button>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section id="tien-nghi" className="scroll-mt-24 px-5 py-24 sm:px-8 lg:py-32">
      <div className="mx-auto max-w-[1240px]">
        <div data-reveal="up" className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-extrabold uppercase tracking-[.22em] text-gold">{language === 'vi' ? 'Tận tâm trong từng chi tiết' : 'Thoughtful in every detail'}</p>
          <h2 className="mt-4 font-display text-4xl font-black tracking-[-.04em] sm:text-5xl">{language === 'vi' ? 'Thoải mái theo một cách rất riêng.' : 'Comfort, in a way that feels personal.'}</h2>
          <p className="mt-5 text-sm leading-7 text-ink-soft">{language === 'vi' ? 'Mọi điểm chạm được cân nhắc để thời gian của bạn tại GrandStay luôn dễ chịu, chủ động và đáng nhớ.' : 'Every touchpoint is considered so your time at GrandStay feels easy, flexible and memorable.'}</p>
        </div>
        <div className="mt-14 grid gap-px overflow-hidden rounded-[1.75rem] border border-slate-200 bg-slate-200 sm:grid-cols-2 lg:grid-cols-4">
          {amenities.map((amenity, index) => { const { icon: Icon } = amenity; const title = language === 'en' ? amenity.titleEn : amenity.title; const text = language === 'en' ? amenity.textEn : amenity.text; return <article key={title} data-reveal="up" style={{ '--reveal-delay': `${index * 80}ms` } as CSSProperties} className="landing-amenity-card group min-h-72 bg-white p-7 transition hover:bg-[#fffcf4] sm:p-8">
            <span className="grid size-13 place-items-center rounded-2xl bg-forest/8 text-forest transition group-hover:-translate-y-1 group-hover:bg-forest group-hover:text-white"><Icon size={23}/></span>
            <h3 className="mt-8 font-display text-xl font-black">{title}</h3>
            <p className="mt-3 text-sm leading-7 text-ink-soft">{text}</p>
          </article>})}
        </div>
      </div>
    </section>

    <section id="ve-grandstay" className="scroll-mt-24 px-5 pb-24 sm:px-8 lg:pb-32">
      <div data-reveal="up" className="landing-cta mx-auto max-w-[1240px] overflow-hidden rounded-[2rem] bg-gold px-6 py-14 text-white shadow-[0_24px_70px_rgba(153,106,39,.2)] sm:px-12 lg:flex lg:items-center lg:justify-between lg:px-16 lg:py-16">
        <div className="max-w-2xl">
          <p className="text-xs font-extrabold uppercase tracking-[.22em] text-white/70">{language === 'vi' ? 'GrandStay chờ đón bạn' : 'GrandStay awaits'}</p>
          <h2 className="mt-4 font-display text-4xl font-black leading-tight tracking-[-.04em] sm:text-5xl">{language === 'vi' ? 'Một kỳ nghỉ đáng nhớ bắt đầu từ đây.' : 'A memorable stay begins here.'}</h2>
          <p className="mt-5 max-w-xl text-sm leading-7 text-white/80">{language === 'vi' ? 'Chọn ngày lưu trú của bạn và để GrandStay giúp hành trình trở nên đơn giản hơn ngay từ bước đầu tiên.' : 'Choose your dates and let GrandStay make the journey simpler from the very first step.'}</p>
        </div>
        <a href="#dat-phong" className="landing-arrow-button relative mt-8 inline-flex min-h-13 shrink-0 items-center gap-2 rounded-xl bg-white px-6 text-sm font-extrabold text-ink shadow-lg transition hover:-translate-y-0.5 lg:mt-0">{language === 'vi' ? 'Tìm phòng ngay' : 'Find a room'}<ArrowRight size={17}/></a>
      </div>
    </section>

    <footer className="border-t border-slate-200 bg-[#f1ede3] px-5 py-10 sm:px-8">
      <div className="mx-auto flex max-w-[1240px] flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
        <Link to="/" className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-ink font-brand text-lg font-bold text-gold-soft">G</span>
          <span><span className="block font-brand text-lg font-bold">GrandStay</span><span className="text-[9px] font-bold uppercase tracking-[.25em] text-ink-soft">Stay beautifully</span></span>
        </Link>
        <nav aria-label="Điều hướng cuối trang" className="flex flex-wrap gap-x-6 gap-y-3 text-xs font-semibold text-ink-soft">
          {navigation.map(item => <a key={item.href} href={item.href} className="hover:text-ink">{language === 'en' ? item.labelEn : item.label}</a>)}
          <Link to="/login" className="hover:text-ink">{language === 'vi' ? 'Đăng nhập' : 'Sign in'}</Link>
        </nav>
        <p className="text-xs text-ink-soft">© {new Date().getFullYear()} GrandStay. {language === 'vi' ? 'Mọi quyền được bảo lưu.' : 'All rights reserved.'}</p>
      </div>
    </footer>

    <button
      type="button"
      aria-label={language === 'vi' ? 'Quay lại đầu trang' : 'Back to top'}
      aria-hidden={!showBackToTop}
      tabIndex={showBackToTop ? 0 : -1}
      onClick={scrollToTop}
      className={`landing-back-to-top fixed bottom-5 right-5 z-50 grid size-12 place-items-center rounded-full border border-white/15 bg-ink text-white shadow-[0_14px_36px_rgba(8,27,43,.28)] transition-[opacity,transform,background-color] duration-300 hover:-translate-y-1 hover:bg-gold focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-gold/30 sm:bottom-7 sm:right-7 ${showBackToTop ? 'pointer-events-auto translate-y-0 opacity-100' : 'pointer-events-none translate-y-3 opacity-0'}`}
    >
      <ArrowUp size={20}/>
    </button>
  </main>
}
