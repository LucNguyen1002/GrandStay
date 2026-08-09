import { useQuery } from '@tanstack/react-query'
import { ArrowDownRight, ArrowUpRight, BedDouble, CalendarCheck2, CalendarClock, CircleDollarSign, Hotel, Sparkles } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { api, errorMessage } from '../api/client'
import type { Dashboard } from '../api/types'
import { Badge, Card, ErrorState, Loading, PageHeader } from '../components/ui'

const money = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 })
const shortMoney = new Intl.NumberFormat('vi-VN', { notation: 'compact', maximumFractionDigits: 1 })
const sourceLabels: Record<string, string> = { DIRECT: 'Trực tiếp', WEBSITE: 'Website', PHONE: 'Điện thoại', WALK_IN: 'Khách vãng lai', OTA: 'Kênh OTA', CORPORATE: 'Doanh nghiệp' }

export function DashboardPage() {
  const navigate = useNavigate()
  const query = useQuery({ queryKey: ['dashboard'], queryFn: () => api.get<Dashboard>('/dashboard').then(response => response.data) })
  if (query.isLoading) return <Loading />
  if (query.error || !query.data) return <ErrorState message={errorMessage(query.error)} onRetry={() => void query.refetch()}/>
  const data = query.data
  const positive = data.revenueChangePercent >= 0
  const metrics = [
    { label: 'Doanh thu 30 ngày', value: money.format(data.revenue), detail: <span className={`inline-flex items-center gap-1 ${positive ? 'text-emerald-700' : 'text-red-700'}`}>{positive ? <ArrowUpRight size={13}/> : <ArrowDownRight size={13}/>} {Math.abs(data.revenueChangePercent)}% so với kỳ trước</span>, icon: CircleDollarSign, tone: 'bg-emerald-50 text-emerald-700' },
    { label: 'Công suất hiện tại', value: `${data.occupancyRate}%`, detail: `${data.occupiedRooms}/${data.totalRooms} phòng đang sử dụng`, icon: Hotel, tone: 'bg-blue-50 text-blue-700' },
    { label: 'Khách đến hôm nay', value: String(data.arrivals.length), detail: data.arrivals[0]?.guestName ?? 'Không có lịch nhận phòng', icon: CalendarCheck2, tone: 'bg-amber-50 text-amber-700' },
    { label: 'Khách đi hôm nay', value: String(data.departures.length), detail: data.departures[0]?.guestName ?? 'Không có lịch trả phòng', icon: CalendarClock, tone: 'bg-violet-50 text-violet-700' },
  ]
  return <>
    <PageHeader title="Tổng quan vận hành" description="Doanh thu 30 ngày và các công việc lễ tân cần xử lý hôm nay." />
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{metrics.map(({ label, value, detail, icon: Icon, tone }) => <Card key={label}><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-xs font-bold uppercase tracking-wide text-ink-soft">{label}</p><p className="mt-3 truncate text-2xl font-extrabold">{value}</p><div className="mt-1 truncate text-xs text-ink-soft">{detail}</div></div><div className={`grid size-11 shrink-0 place-items-center rounded-xl ${tone}`}><Icon size={21}/></div></div></Card>)}</div>

    <div className="mt-5 grid gap-5 xl:grid-cols-[1.65fr_1fr]">
      <Card><div className="mb-5"><h2 className="font-display text-xl font-bold">Xu hướng doanh thu</h2><p className="text-xs text-ink-soft">Theo ngày, đơn vị VND · kỳ trước {money.format(data.previousRevenue)}</p></div><div className="h-80"><ResponsiveContainer width="100%" height="100%"><AreaChart data={data.revenueSeries}><defs><linearGradient id="revenue" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#286052" stopOpacity={.32}/><stop offset="95%" stopColor="#286052" stopOpacity={0}/></linearGradient></defs><CartesianGrid stroke="#e8edf0" strokeDasharray="3 3" vertical={false}/><XAxis dataKey="date" tickFormatter={value => new Date(value).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })} tick={{ fontSize: 11 }} axisLine={false}/><YAxis tickFormatter={value => shortMoney.format(value)} tick={{ fontSize: 11 }} axisLine={false}/><Tooltip formatter={value => money.format(Number(value))} labelFormatter={value => new Date(String(value)).toLocaleDateString('vi-VN')}/><Area type="monotone" dataKey="revenue" stroke="#286052" strokeWidth={2.5} fill="url(#revenue)"/></AreaChart></ResponsiveContainer></div></Card>
      <Card><h2 className="font-display text-xl font-bold">Lịch lễ tân hôm nay</h2><p className="mb-4 text-xs text-ink-soft">Nhấn vào hồ sơ để xử lý nhận hoặc trả phòng.</p><MovementList title="Khách đến" items={data.arrivals} tone="gold" onOpen={id => navigate(`/bookings?bookingId=${id}`)}/><div className="my-4 border-t border-slate-100"/><MovementList title="Khách đi" items={data.departures} tone="blue" onOpen={id => navigate(`/bookings?bookingId=${id}`)}/></Card>
    </div>

    <div className="mt-5 grid gap-5 lg:grid-cols-3">
      <Card><div className="mb-4 flex items-center gap-2"><BedDouble size={19} className="text-gold"/><h2 className="font-display text-lg font-bold">Phòng bán tốt</h2></div><RankList items={data.topRooms.map(room => ({ name: `Phòng ${room.roomNumber}`, caption: `${room.bookingCount} lượt lưu trú`, value: room.revenue }))} empty="Chưa có doanh thu phòng."/></Card>
      <Card><div className="mb-4 flex items-center gap-2"><Sparkles size={19} className="text-gold"/><h2 className="font-display text-lg font-bold">Dịch vụ bán chạy</h2></div><RankList items={data.topServices.slice(0, 6).map(service => ({ name: service.name, caption: `${service.quantity} lượt`, value: service.revenue }))} empty="Chưa có giao dịch dịch vụ."/></Card>
      <Card><h2 className="font-display text-lg font-bold">Nguồn đặt phòng</h2><p className="mb-4 text-xs text-ink-soft">Booking mới trong 30 ngày</p><SourceList items={data.bookingSources}/></Card>
    </div>
  </>
}

function MovementList({ title, items, tone, onOpen }: { title: string; items: Dashboard['arrivals']; tone: 'gold' | 'blue'; onOpen: (id: string) => void }) {
  return <section><div className="mb-2 flex items-center justify-between"><h3 className="text-sm font-bold">{title}</h3><Badge tone={tone}>{items.length}</Badge></div><div className="space-y-1">{items.slice(0, 4).map(item => <button type="button" key={item.bookingId} onClick={() => onOpen(item.bookingId)} className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left transition hover:bg-slate-50"><div className="min-w-0"><p className="truncate text-sm font-semibold">{item.guestName}</p><p className="text-[11px] text-ink-soft">{item.bookingNumber}</p></div><time className="shrink-0 text-xs font-bold">{new Date(item.expectedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</time></button>)}{!items.length && <p className="rounded-xl bg-slate-50 px-3 py-4 text-center text-xs text-ink-soft">Không có lịch.</p>}</div></section>
}

function RankList({ items, empty }: { items: { name: string; caption: string; value: number }[]; empty: string }) {
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
  if (!items.length) return <p className="py-10 text-center text-sm text-ink-soft">Chưa có booking mới.</p>
  const total = items.reduce((sum, item) => sum + Number(item.count), 0)
  return <div className="space-y-3">{items.map(item => <div key={item.source}>
    <div className="mb-1 flex justify-between text-sm"><span className="font-semibold">{sourceLabels[item.source] ?? item.source}</span><span>{item.count} · {Math.round(item.count * 100 / total)}%</span></div>
    <div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-forest" style={{ width: `${item.count * 100 / total}%` }}/></div>
  </div>)}</div>
}
