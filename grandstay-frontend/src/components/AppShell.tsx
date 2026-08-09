import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { BadgePercent, BedDouble, BookOpenCheck, Building2, CalendarDays, ChartNoAxesCombined, ChevronDown, ChevronLeft, CircleDollarSign, ConciergeBell, FileClock, Gauge, LogOut, Menu, Settings, ShieldCheck, UserRoundCog, Users, X } from 'lucide-react'
import { useAuth } from '../auth/AuthProvider'
import { defaultAuthenticatedRoute } from '../auth/routes'
import { UserAvatar } from './UserAvatar'
import { RealtimeSync } from './RealtimeSync'

type NavigationItem = {
  to: string
  label: string
  icon: typeof Gauge
  permission?: string
  role?: string
  alternativeRole?: string
}

const navigation: NavigationItem[] = [
  { to: '/dashboard', label: 'Tổng quan', icon: Gauge, permission: 'report:read' },
  { to: '/rooms', label: 'Sơ đồ phòng', icon: BedDouble, permission: 'room:read' },
  { to: '/bookings', label: 'Đặt phòng', icon: BookOpenCheck, permission: 'booking:read', alternativeRole: 'CUSTOMER' },
  { to: '/customers', label: 'Khách hàng', icon: Users, permission: 'booking:read' },
  { to: '/billing', label: 'Thu ngân', icon: CircleDollarSign, permission: 'payment:read' },
  { to: '/services', label: 'Dịch vụ', icon: ConciergeBell, permission: 'service:read' },
  { to: '/catalog', label: 'Danh mục phòng', icon: Building2, permission: 'room:read' },
  { to: '/commercial', label: 'Tiện nghi & ưu đãi', icon: BadgePercent, permission: 'promotion:write' },
  { to: '/reports', label: 'Báo cáo', icon: ChartNoAxesCombined, permission: 'report:read' },
  { to: '/users', label: 'Người dùng', icon: UserRoundCog, role: 'ADMIN' },
  { to: '/audit', label: 'Nhật ký kiểm toán', icon: FileClock, permission: 'audit:read' },
  { to: '/settings', label: 'Thiết lập', icon: Settings },
]

export function AppShell() {
  const [open, setOpen] = useState(false)
  const [compact, setCompact] = useState(() => localStorage.getItem('grandstay:compact-nav') === 'true')
  const [profileOpen, setProfileOpen] = useState(false)
  const profileRef = useRef<HTMLDivElement>(null)
  const location = useLocation()
  const { user, logout, can, hasRole } = useAuth()
  const items = navigation.filter(item => ((!item.permission || can(item.permission)) && (!item.role || hasRole(item.role)))
    || Boolean(item.alternativeRole && hasRole(item.alternativeRole)))
  const currentPage = navigation.find(item => item.to === location.pathname)?.label ?? 'GrandStay'
  const today = new Intl.DateTimeFormat('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date())

  useEffect(() => {
    localStorage.setItem('grandstay:compact-nav', String(compact))
  }, [compact])

  useEffect(() => {
    const closeProfile = (event: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) setProfileOpen(false)
    }
    document.addEventListener('mousedown', closeProfile)
    return () => document.removeEventListener('mousedown', closeProfile)
  }, [])

  return <div className="min-h-screen bg-canvas">
    <RealtimeSync />
    {open && <button aria-label="Đóng trình đơn" className="sidebar-backdrop fixed inset-0 z-30 bg-ink/45 backdrop-blur-[2px] lg:hidden" onClick={() => setOpen(false)} />}
    <aside className={`app-sidebar fixed inset-y-0 left-0 z-40 flex flex-col bg-ink text-white shadow-2xl transition-[width,transform] duration-300 ease-out ${compact ? 'w-21' : 'w-68'} ${open ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}>
      <div className={`flex h-20 items-center border-b border-white/10 ${compact ? 'justify-center px-3' : 'justify-between px-5'}`}>
        <Link to={user ? defaultAuthenticatedRoute(user) : '/'} aria-label="GrandStay - Trang chính" onClick={() => { setOpen(false); setProfileOpen(false) }} className="flex items-center gap-3 overflow-hidden rounded-xl focus-visible:outline-offset-4">
          <div className="brand-mark grid size-11 shrink-0 place-items-center rounded-xl border border-gold/60 bg-white/5 font-brand text-xl text-gold">G</div>
          {!compact && <div className="whitespace-nowrap"><div className="font-brand text-xl font-bold">GrandStay</div><div className="text-[10px] uppercase tracking-[.25em] text-gold-soft">Hotel management</div></div>}
        </Link>
        {!compact && <button type="button" aria-label="Đóng trình đơn" className="icon-button lg:hidden" onClick={() => setOpen(false)}><X size={21}/></button>}
      </div>
      <nav aria-label="Điều hướng chính" className="sidebar-scroll flex-1 space-y-1 overflow-y-auto p-3">
        {items.map(({ to, label, icon: Icon }) => <NavLink
          key={to}
          to={to}
          end
          title={compact ? label : undefined}
          onClick={() => { setOpen(false); setProfileOpen(false) }}
          className={({ isActive }) => `nav-item relative flex items-center rounded-xl px-3 py-3 text-sm font-semibold ${compact ? 'justify-center' : 'gap-3'} ${isActive ? 'nav-item-active bg-gold text-white shadow-lg shadow-black/10' : 'text-slate-300 hover:bg-white/8 hover:text-white'}`}
        >
          <Icon size={19} className="shrink-0"/>{!compact && <span>{label}</span>}
        </NavLink>)}
      </nav>
      <div className="border-t border-white/10 p-3">
        <button type="button" onClick={() => void logout()} title={compact ? 'Đăng xuất' : undefined} className={`nav-item flex w-full items-center rounded-xl px-3 py-3 text-left text-sm text-slate-300 hover:bg-white/8 hover:text-white ${compact ? 'justify-center' : 'gap-3'}`}><LogOut size={19}/>{!compact && 'Đăng xuất'}</button>
        <button type="button" onClick={() => setCompact(value => !value)} className={`nav-item mt-1 hidden w-full items-center rounded-xl px-3 py-2 text-xs text-slate-400 hover:text-white lg:flex ${compact ? 'justify-center' : 'gap-3'}`} title={compact ? 'Mở rộng thanh điều hướng' : undefined}><ChevronLeft size={17} className={`transition-transform duration-300 ${compact ? 'rotate-180' : ''}`}/>{!compact && 'Thu gọn'}</button>
      </div>
    </aside>

    <div className={`transition-[padding] duration-300 ease-out ${compact ? 'lg:pl-21' : 'lg:pl-68'}`}>
      <header className="app-header sticky top-0 z-20 flex h-20 items-center justify-between border-b border-slate-200/70 bg-canvas/90 px-4 backdrop-blur-xl sm:px-7">
        <div className="flex min-w-0 items-center gap-3">
          <button type="button" aria-label="Mở trình đơn" className="icon-button rounded-xl border border-slate-200 bg-white p-2 lg:hidden" onClick={() => setOpen(true)}><Menu/></button>
          <div className="hidden min-w-0 sm:block">
            <div className="flex items-center gap-2 text-sm"><span className="text-ink-soft">Vận hành khách sạn</span><span className="text-slate-300">/</span><strong className="truncate text-ink">{currentPage}</strong></div>
            <div className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-400"><CalendarDays size={12}/>{today}</div>
          </div>
        </div>

        <div ref={profileRef} className="relative">
          <button type="button" aria-haspopup="menu" aria-expanded={profileOpen} onClick={() => setProfileOpen(value => !value)} className="profile-trigger flex items-center gap-3 rounded-2xl p-1.5 pl-3 text-left transition hover:bg-white hover:shadow-sm">
            <div className="hidden text-right sm:block"><div className="max-w-40 truncate text-sm font-bold">{user?.name ?? user?.username}</div><div className="text-xs text-ink-soft">{user?.roles?.join(' · ')}</div></div>
            <UserAvatar userId={user?.sub} name={user?.name ?? user?.username} />
            <ChevronDown size={15} className={`hidden text-ink-soft transition-transform sm:block ${profileOpen ? 'rotate-180' : ''}`}/>
          </button>
          {profileOpen && <div role="menu" className="profile-menu absolute right-0 mt-2 w-64 overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
            <div className="border-b border-slate-100 px-3 py-3"><p className="truncate text-sm font-bold">{user?.name ?? user?.username}</p><p className="truncate text-xs text-ink-soft">@{user?.username}</p></div>
            <div className="py-2">
              <Link role="menuitem" to="/settings" onClick={() => setProfileOpen(false)} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold hover:bg-slate-50"><Settings size={17}/>Thiết lập tài khoản</Link>
              <div className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-emerald-700"><ShieldCheck size={17}/><span>Phiên được bảo vệ</span></div>
            </div>
            <button type="button" role="menuitem" onClick={() => void logout()} className="flex w-full items-center gap-3 border-t border-slate-100 px-3 py-3 text-left text-sm font-semibold text-red-700 hover:bg-red-50"><LogOut size={17}/>Đăng xuất</button>
          </div>}
        </div>
      </header>
      <main className="p-4 sm:p-7 lg:p-9"><div key={location.pathname} className="page-enter"><Outlet /></div></main>
    </div>
  </div>
}
