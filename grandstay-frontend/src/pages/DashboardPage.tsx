import { useQuery } from '@tanstack/react-query'
import { ArrowDownRight, ArrowUpRight, BedDouble, CalendarCheck2, CalendarClock, CircleDollarSign, Hotel, Sparkles } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { api, errorMessage } from '../api/client'
import type { Dashboard } from '../api/types'
import { Badge, Card, ErrorState, Loading, PageHeader } from '../components/ui'
import { useI18n } from '../i18n'

export function DashboardPage() {
  const navigate = useNavigate()
  const { locale, money, text } = useI18n()
  const shortMoney = new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 })
  const query = useQuery({ queryKey: ['dashboard'], queryFn: () => api.get<Dashboard>('/dashboard').then(response => response.data) })
  if (query.isLoading) return <Loading />
  if (query.error || !query.data) return <ErrorState message={errorMessage(query.error)} onRetry={() => void query.refetch()}/>
  const data = query.data
  const positive = data.revenueChangePercent >= 0
  const metrics = [
    { label: text('Doanh thu 30 ngày', '30-day revenue'), value: money(data.revenue), detail: <span className={`inline-flex items-center gap-1 ${positive ? 'text-emerald-700' : 'text-red-700'}`}>{positive ? <ArrowUpRight size={13}/> : <ArrowDownRight size={13}/>} {Math.abs(data.revenueChangePercent)}% {text('so với kỳ trước', 'vs previous period')}</span>, icon: CircleDollarSign, tone: 'bg-emerald-50 text-emerald-700' },
    { label: text('Công suất hiện tại', 'Current occupancy'), value: `${data.occupancyRate}%`, detail: `${data.occupiedRooms}/${data.totalRooms} ${text('phòng đang sử dụng', 'rooms occupied')}`, icon: Hotel, tone: 'bg-blue-50 text-blue-700' },
    { label: text('Khách đến hôm nay', "Today's arrivals"), value: String(data.arrivals.length), detail: data.arrivals[0]?.guestName ?? text('Không có lịch nhận phòng', 'No scheduled arrivals'), icon: CalendarCheck2, tone: 'bg-amber-50 text-amber-700' },
    { label: text('Khách đi hôm nay', "Today's departures"), value: String(data.departures.length), detail: data.departures[0]?.guestName ?? text('Không có lịch trả phòng', 'No scheduled departures'), icon: CalendarClock, tone: 'bg-violet-50 text-violet-700' },
  ]
  return <>
    <PageHeader title={text('Tổng quan vận hành', 'Operations overview')} description={text('Doanh thu 30 ngày và các công việc lễ tân cần xử lý hôm nay.', '30-day revenue and front-desk tasks requiring attention today.')} />
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{metrics.map(({ label, value, detail, icon: Icon, tone }) => <Card key={label}><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-xs font-bold uppercase tracking-wide text-ink-soft">{label}</p><p className="mt-3 truncate text-2xl font-extrabold">{value}</p><div className="mt-1 truncate text-xs text-ink-soft">{detail}</div></div><div className={`grid size-11 shrink-0 place-items-center rounded-xl ${tone}`}><Icon size={21}/></div></div></Card>)}</div>

    <div className="mt-5 grid gap-5 xl:grid-cols-[1.65fr_1fr]">
      <Card><div className="mb-5"><h2 className="font-display text-xl font-bold">{text('Xu hướng doanh thu', 'Revenue trend')}</h2><p className="text-xs text-ink-soft">{text('Theo ngày, đơn vị VND', 'Daily, in VND')} · {text('kỳ trước', 'previous period')} {money(data.previousRevenue)}</p></div><div className="h-80"><ResponsiveContainer width="100%" height="100%"><AreaChart data={data.revenueSeries}><defs><linearGradient id="revenue" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#286052" stopOpacity={.32}/><stop offset="95%" stopColor="#286052" stopOpacity={0}/></linearGradient></defs><CartesianGrid stroke="#e8edf0" strokeDasharray="3 3" vertical={false}/><XAxis dataKey="date" tickFormatter={value => new Date(value).toLocaleDateString(locale, { day: '2-digit', month: '2-digit' })} tick={{ fontSize: 11 }} axisLine={false}/><YAxis tickFormatter={value => shortMoney.format(value)} tick={{ fontSize: 11 }} axisLine={false}/><Tooltip formatter={value => money(Number(value))} labelFormatter={value => new Date(String(value)).toLocaleDateString(locale)}/><Area type="monotone" dataKey="revenue" stroke="#286052" strokeWidth={2.5} fill="url(#revenue)"/></AreaChart></ResponsiveContainer></div></Card>
      <Card><h2 className="font-display text-xl font-bold">{text('Lịch lễ tân hôm nay', "Today's front desk schedule")}</h2><p className="mb-4 text-xs text-ink-soft">{text('Nhấn vào hồ sơ để xử lý nhận hoặc trả phòng.', 'Open a record to process check-in or check-out.')}</p><MovementList title={text('Khách đến', 'Arrivals')} items={data.arrivals} tone="gold" onOpen={id => navigate(`/bookings?bookingId=${id}`)}/><div className="my-4 border-t border-slate-100"/><MovementList title={text('Khách đi', 'Departures')} items={data.departures} tone="blue" onOpen={id => navigate(`/bookings?bookingId=${id}`)}/></Card>
    </div>

    <div className="mt-5 grid gap-5 lg:grid-cols-3">
      <Card><div className="mb-4 flex items-center gap-2"><BedDouble size={19} className="text-gold"/><h2 className="font-display text-lg font-bold">{text('Phòng bán tốt', 'Top-selling rooms')}</h2></div><RankList items={data.topRooms.map(room => ({ name: `${text('Phòng', 'Room')} ${room.roomNumber}`, caption: `${room.bookingCount} ${text('lượt lưu trú', 'stays')}`, value: room.revenue }))} empty={text('Chưa có doanh thu phòng.', 'No room revenue yet.')}/></Card>
      <Card><div className="mb-4 flex items-center gap-2"><Sparkles size={19} className="text-gold"/><h2 className="font-display text-lg font-bold">{text('Dịch vụ bán chạy', 'Top-selling services')}</h2></div><RankList items={data.topServices.slice(0, 6).map(service => ({ name: service.name, caption: `${service.quantity} ${text('lượt', 'orders')}`, value: service.revenue }))} empty={text('Chưa có giao dịch dịch vụ.', 'No service transactions yet.')}/></Card>
      <Card><h2 className="font-display text-lg font-bold">{text('Nguồn đặt phòng', 'Booking sources')}</h2><p className="mb-4 text-xs text-ink-soft">{text('Booking mới trong 30 ngày', 'New bookings in the last 30 days')}</p><SourceList items={data.bookingSources}/></Card>
    </div>
  </>
}

function MovementList({ title, items, tone, onOpen }: { title: string; items: Dashboard['arrivals']; tone: 'gold' | 'blue'; onOpen: (id: string) => void }) {
  const { locale, text } = useI18n()
  return <section><div className="mb-2 flex items-center justify-between"><h3 className="text-sm font-bold">{title}</h3><Badge tone={tone}>{items.length}</Badge></div><div className="space-y-1">{items.slice(0, 4).map(item => <button type="button" key={item.bookingId} onClick={() => onOpen(item.bookingId)} className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left transition hover:bg-slate-50"><div className="min-w-0"><p className="truncate text-sm font-semibold">{item.guestName}</p><p className="text-[11px] text-ink-soft">{item.bookingNumber}</p></div><time className="shrink-0 text-xs font-bold">{new Date(item.expectedAt).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}</time></button>)}{!items.length && <p className="rounded-xl bg-slate-50 px-3 py-4 text-center text-xs text-ink-soft">{text('Không có lịch.', 'No scheduled activity.')}</p>}</div></section>
}

function RankList({ items, empty }: { items: { name: string; caption: string; value: number }[]; empty: string }) {
  const { locale } = useI18n()
  const shortMoney = new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 })
  if (!items.length) return <p className="py-10 text-center text-sm text-ink-soft">{empty}</p>
  const maximum = Math.max(...items.map(item => Number(item.value)), 1)
  return <div className="space-y-4">{items.map((item, index) => <div key={item.name} className="flex items-center gap-3">
    <div className="grid size-8 shrink-0 place-items-center rounded-full bg-gold/10 text-xs font-bold text-gold">{index + 1}</div>
    <div className="min-w-0 flex-1">
      <div className="flex justify-between gap-2 text-sm"><span className="truncate font-semibold">{item.name}</span><span className="shrink-0 font-bold">{shortMoney.format(item.value)}</span></div>
      <div className="mt-1 flex items-center gap-2"><div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-gold" style={{ width: `${Math.max(8, (Number(item.value) / maximum) * 100)}%` }}/></div><span className="text-[10px] text-ink-soft">{item.caption}</span></div>
    </div>
  </div>)}</div>
}

function SourceList({ items }: { items: Dashboard['bookingSources'] }) {
  const { language, text } = useI18n()
  const sourceLabels: Record<string, string> = language === 'vi' ? { DIRECT: 'Trực tiếp', WEBSITE: 'Website', PHONE: 'Điện thoại', WALK_IN: 'Khách vãng lai', OTA: 'Kênh OTA', CORPORATE: 'Doanh nghiệp' } : { DIRECT: 'Direct', WEBSITE: 'Website', PHONE: 'Phone', WALK_IN: 'Walk-in', OTA: 'OTA channel', CORPORATE: 'Corporate' }
  if (!items.length) return <p className="py-10 text-center text-sm text-ink-soft">{text('Chưa có booking mới.', 'No new bookings yet.')}</p>
  const total = items.reduce((sum, item) => sum + Number(item.count), 0)
  return <div className="space-y-3">{items.map(item => <div key={item.source}>
    <div className="mb-1 flex justify-between text-sm"><span className="font-semibold">{sourceLabels[item.source] ?? item.source}</span><span>{item.count} · {Math.round(item.count * 100 / total)}%</span></div>
    <div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-forest" style={{ width: `${item.count * 100 / total}%` }}/></div>
  </div>)}</div>
}
