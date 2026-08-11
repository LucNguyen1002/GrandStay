import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { BedDouble, CalendarClock, ChevronRight, RefreshCw, SlidersHorizontal, Sparkles, UsersRound } from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api, errorMessage } from '../api/client'
import type { AmenityView, Page, RatePlan, RoomMatrix, RoomType } from '../api/types'
import { Badge, Button, Card, Empty, ErrorState, Loading, PageHeader, statusTone } from '../components/ui'
import { useAuth } from '../auth/AuthProvider'
import { useI18n } from '../i18n'

const labels: Record<string, string> = {
  AVAILABLE: 'Sẵn sàng',
  RESERVED: 'Đã đặt',
  OCCUPIED: 'Đang ở',
  CLEANING: 'Đang dọn',
  MAINTENANCE: 'Bảo trì',
  OUT_OF_SERVICE: 'Ngưng dùng',
}

const dots: Record<string, string> = {
  AVAILABLE: 'bg-emerald-500',
  RESERVED: 'bg-amber-500',
  OCCUPIED: 'bg-blue-500',
  CLEANING: 'bg-violet-500',
  MAINTENANCE: 'bg-red-500',
  OUT_OF_SERVICE: 'bg-slate-500',
}

export function RoomsPage() {
  const navigate = useNavigate()
  const { can, hasRole } = useAuth()
  const customerDiscovery = hasRole('CUSTOMER') && !can('booking:read')
  const canCreateBooking = can('booking:write') || hasRole('CUSTOMER')
  const query = useQuery({ queryKey: ['room-matrix'], enabled: !customerDiscovery, queryFn: () => api.get<RoomMatrix[]>('/rooms/matrix').then(response => response.data), refetchInterval: 60_000 })
  if (customerDiscovery) return <CustomerRoomDiscovery />
  if (query.isLoading) return <Loading />
  if (query.error) return <ErrorState message={errorMessage(query.error)} onRetry={() => void query.refetch()} />

  const rooms = query.data ?? []
  const grouped = rooms.reduce<Record<string, RoomMatrix[]>>((result, room) => {
    const key = `${room.floorNumber}|${room.floorName}`
    ;(result[key] ??= []).push(room)
    return result
  }, {})
  const floors = Object.entries(grouped).sort((left, right) => Number(left[0].split('|')[0]) - Number(right[0].split('|')[0]))
  const openRoom = (room: RoomMatrix) => {
    if (room.bookingId && can('booking:read')) navigate(`/bookings?bookingId=${room.bookingId}`)
    else if (room.displayStatus === 'AVAILABLE' && canCreateBooking) navigate(`/bookings?new=1&roomId=${room.roomId}`)
  }

  return <>
    <PageHeader title="Sơ đồ phòng" description="Theo dõi tình trạng phòng và mở nhanh nghiệp vụ lưu trú. Dữ liệu tự cập nhật mỗi phút." action={<Button variant="secondary" loading={query.isFetching} onClick={() => void query.refetch()}><RefreshCw size={16}/>Làm mới</Button>} />
    <div className="mb-5 flex flex-wrap gap-x-5 gap-y-2 rounded-2xl border border-slate-200/70 bg-white/60 px-4 py-3">
      {Object.entries(labels).map(([key, value]) => <div key={key} className="flex items-center gap-2 text-xs font-medium text-ink-soft"><span className={`size-2.5 rounded-full ${dots[key]}`}/>{value}<strong className="text-ink">{rooms.filter(room => room.displayStatus === key).length}</strong></div>)}
    </div>
    <div className="space-y-5">
      {floors.map(([key, floorRooms]) => <Card key={key}>
        <div className="mb-4 flex items-center justify-between"><h2 className="font-display text-xl font-bold">{key.split('|')[1]}</h2><span className="text-xs text-ink-soft">{floorRooms.length} phòng</span></div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
          {floorRooms.map(room => {
            const actionable = (Boolean(room.bookingId) && can('booking:read')) || (room.displayStatus === 'AVAILABLE' && canCreateBooking)
            return <button
              type="button"
              key={room.roomId}
              disabled={!actionable}
              onClick={() => openRoom(room)}
              aria-label={`${labels[room.displayStatus] ?? room.displayStatus}: phòng ${room.roomNumber}${actionable ? ' — mở thao tác' : ''}`}
              className={`room-card group rounded-2xl border bg-white p-4 text-left transition ${actionable ? 'border-slate-200 hover:-translate-y-1 hover:border-gold/60 hover:shadow-lg' : 'border-slate-100'}`}
            >
              <div className="flex items-start justify-between"><BedDouble size={19} className="text-ink-soft transition group-hover:text-gold"/><span className="font-display text-xl font-bold">{room.roomNumber}</span></div>
              <p className="mt-4 truncate text-xs text-ink-soft">{room.roomTypeName}</p>
              <div className="mt-2"><Badge tone={statusTone(room.displayStatus)}>{labels[room.displayStatus] ?? room.displayStatus}</Badge></div>
              {room.bookingId && can('booking:read') && <div className="mt-3 flex items-center gap-1 text-[11px] text-ink-soft"><CalendarClock size={12}/>Mở hồ sơ lưu trú<ChevronRight size={12} className="ml-auto transition-transform group-hover:translate-x-0.5"/></div>}
              {!room.bookingId && room.displayStatus === 'AVAILABLE' && canCreateBooking && <div className="mt-3 flex items-center text-[11px] font-semibold text-forest">Chọn phòng này<ChevronRight size={12} className="ml-auto transition-transform group-hover:translate-x-0.5"/></div>}
            </button>
          })}
        </div>
      </Card>)}
    </div>
    {!rooms.length && <Card><Empty text="Chưa có phòng trong danh mục."/></Card>}
  </>
}

function CustomerRoomDiscovery() {
  const { language, t, money } = useI18n()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [filters, setFilters] = useState({ adults: searchParams.get('guests') ?? '1', children: '0', maxNightly: '', amenityId: '' })
  const catalog = useQuery({
    queryKey: ['room-discovery-catalog'],
    queryFn: async () => {
      const [types, rates, amenities] = await Promise.all([
        api.get<Page<RoomType>>('/room-types', { params: { size: 100 } }),
        api.get<Page<RatePlan>>('/rate-plans', { params: { size: 200 } }),
        api.get<Page<AmenityView>>('/amenities', { params: { size: 100 } }),
      ])
      return { types: types.data.content, rates: rates.data.content, amenities: amenities.data.content }
    },
  })
  if (catalog.isLoading) return <Loading />
  if (catalog.error || !catalog.data) return <ErrorState message={errorMessage(catalog.error)} onRetry={() => void catalog.refetch()} />
  const adults = Math.max(1, Number(filters.adults) || 1)
  const children = Math.max(0, Number(filters.children) || 0)
  const maxNightly = Number(filters.maxNightly) || Number.POSITIVE_INFINITY
  const results = catalog.data.types.map((roomType, index) => {
    const rates = catalog.data.rates.filter(rate => rate.roomTypeId === roomType.id && rate.active)
    const nightly = rates.find(rate => rate.pricingUnit === 'NIGHTLY') ?? rates.sort((left, right) => Number(left.rate) - Number(right.rate))[0]
    const amenityNames = catalog.data.amenities.filter(item => item.roomTypes.some(assignment => assignment.roomTypeId === roomType.id)).map(item => item.amenity.name)
    return { roomType, nightly, amenityNames, index }
  }).filter(item => item.roomType.capacityAdults >= adults && item.roomType.capacityChildren >= children
    && Number(item.nightly?.rate ?? item.roomType.baseNightlyRate) <= maxNightly
    && (!filters.amenityId || catalog.data.amenities.find(item => item.amenity.id === filters.amenityId)?.roomTypes.some(assignment => assignment.roomTypeId === item.roomType.id)))
  const startBooking = (roomTypeId: string) => {
    const params = new URLSearchParams({ new: '1', roomTypeId })
    for (const key of ['checkIn', 'checkOut', 'guests']) { const value = searchParams.get(key); if (value) params.set(key, value) }
    navigate(`/bookings?${params}`)
  }
  return <>
    <PageHeader title={t('rooms.title.customer')} description={t('rooms.description.customer')} />
    <Card className="mb-5">
      <div className="mb-4 flex items-center gap-2"><SlidersHorizontal size={18}/><h2 className="font-display text-lg font-bold">{language === 'vi' ? 'Nhu cầu lưu trú' : 'Stay preferences'}</h2></div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><label><span className="label">{language === 'vi' ? 'Người lớn' : 'Adults'}</span><input className="field" type="number" min={1} max={10} value={filters.adults} onChange={event => setFilters(previous => ({ ...previous, adults: event.target.value }))}/></label><label><span className="label">{language === 'vi' ? 'Trẻ em' : 'Children'}</span><input className="field" type="number" min={0} max={10} value={filters.children} onChange={event => setFilters(previous => ({ ...previous, children: event.target.value }))}/></label><label><span className="label">{language === 'vi' ? 'Giá tối đa mỗi đêm' : 'Maximum nightly rate'}</span><input className="field" type="number" min={0} step={50000} placeholder={language === 'vi' ? 'Không giới hạn' : 'No limit'} value={filters.maxNightly} onChange={event => setFilters(previous => ({ ...previous, maxNightly: event.target.value }))}/></label><label><span className="label">{language === 'vi' ? 'Tiện nghi mong muốn' : 'Preferred amenity'}</span><select className="field" value={filters.amenityId} onChange={event => setFilters(previous => ({ ...previous, amenityId: event.target.value }))}><option value="">{language === 'vi' ? 'Tất cả' : 'All'}</option>{catalog.data.amenities.map(item => <option key={item.amenity.id} value={item.amenity.id}>{item.amenity.name}</option>)}</select></label></div>
    </Card>
    <div className="grid gap-5 lg:grid-cols-2">{results.map((item, visibleIndex) => {
      const styles = ['from-sky-950 via-sky-900 to-cyan-800', 'from-emerald-950 via-emerald-900 to-teal-700', 'from-amber-700 via-orange-700 to-rose-700', 'from-violet-950 via-indigo-900 to-blue-800']
      const rate = Number(item.nightly?.rate ?? item.roomType.baseNightlyRate)
      return <article key={item.roomType.id} className={`group relative min-h-80 overflow-hidden rounded-[2rem] bg-gradient-to-br ${styles[visibleIndex % styles.length]} p-6 text-white shadow-xl transition duration-500 hover:-translate-y-1 hover:shadow-2xl sm:p-8`}><span className="absolute -right-16 -top-16 size-64 rounded-full border border-white/10 transition duration-700 group-hover:scale-110"/><div className="relative flex h-full flex-col"><div className="flex items-start justify-between"><div><span className="text-xs font-extrabold uppercase tracking-[.22em] text-white/65">{item.roomType.code}</span><h2 className="mt-3 font-display text-3xl font-black">{item.roomType.name}</h2></div><span className="grid size-14 place-items-center rounded-2xl border border-white/15 bg-white/10"><BedDouble size={25}/></span></div><p className="mt-4 line-clamp-3 max-w-xl text-sm leading-7 text-white/75">{item.roomType.description}</p><div className="mt-4 flex flex-wrap gap-2"><span className="flex items-center gap-1.5 rounded-full bg-black/15 px-3 py-1.5 text-xs"><UsersRound size={14}/>{t('rooms.capacity', { adults: item.roomType.capacityAdults, children: item.roomType.capacityChildren })}</span>{item.amenityNames.slice(0, 3).map(name => <span key={name} className="rounded-full bg-white/10 px-3 py-1.5 text-xs">{name}</span>)}</div><div className="mt-auto flex flex-col gap-4 pt-8 sm:flex-row sm:items-end sm:justify-between"><div><small className="text-white/65">{t('rooms.from')}</small><p className="font-display text-3xl font-black">{money(rate)}<span className="ml-1 text-sm font-medium text-white/65">{t('rooms.perNight')}</span></p></div><Button className="bg-white text-ink hover:bg-amber-50" onClick={() => startBooking(item.roomType.id)}><Sparkles size={16}/>{language === 'vi' ? 'Chọn hạng phòng' : 'Choose this class'}<ChevronRight size={16}/></Button></div></div></article>
    })}</div>
    {!results.length && <Card><Empty text={language === 'vi' ? 'Không có hạng phòng phù hợp. Hãy nới bộ lọc để xem thêm lựa chọn.' : 'No room class matches your filters. Try broadening your preferences.'}/></Card>}
  </>
}
