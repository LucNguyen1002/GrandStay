import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { BedDouble, CalendarClock, ChevronRight, RefreshCw, SlidersHorizontal, Sparkles, UsersRound } from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { api, errorMessage } from '../api/client'
import type { AmenityView, Page, RatePlan, RoomMatrix, RoomType } from '../api/types'
import { Badge, Button, Card, Empty, ErrorState, Loading, PageHeader, statusTone } from '../components/ui'
import { useAuth } from '../auth/AuthProvider'
import { useI18n, type Language } from '../i18n'
import { catalogDescription, catalogName } from '../i18n/catalog'

const dots: Record<string, string> = {
  AVAILABLE: 'bg-emerald-500',
  RESERVED: 'bg-amber-500',
  OCCUPIED: 'bg-blue-500',
  CLEANING: 'bg-violet-500',
  MAINTENANCE: 'bg-red-500',
  OUT_OF_SERVICE: 'bg-slate-500',
}

const roomClassPalettes = [
  { accent: 'bg-sky-600', border: 'border-sky-200', soft: 'bg-sky-50', text: 'text-sky-800', gradient: 'from-sky-950 via-sky-900 to-cyan-800' },
  { accent: 'bg-emerald-600', border: 'border-emerald-200', soft: 'bg-emerald-50', text: 'text-emerald-800', gradient: 'from-emerald-950 via-emerald-900 to-teal-700' },
  { accent: 'bg-amber-500', border: 'border-amber-200', soft: 'bg-amber-50', text: 'text-amber-800', gradient: 'from-amber-700 via-orange-700 to-rose-700' },
  { accent: 'bg-violet-600', border: 'border-violet-200', soft: 'bg-violet-50', text: 'text-violet-800', gradient: 'from-violet-950 via-indigo-900 to-blue-800' },
]

function statusLabels(language: Language): Record<string, string> {
  return language === 'vi' ? {
    AVAILABLE: 'Sẵn sàng', RESERVED: 'Đã đặt', OCCUPIED: 'Đang ở', CLEANING: 'Đang dọn',
    MAINTENANCE: 'Bảo trì', OUT_OF_SERVICE: 'Ngưng dùng',
  } : {
    AVAILABLE: 'Available', RESERVED: 'Reserved', OCCUPIED: 'Occupied', CLEANING: 'Cleaning',
    MAINTENANCE: 'Maintenance', OUT_OF_SERVICE: 'Out of service',
  }
}

function classNameFor(name: string, code: string | undefined, language: Language) {
  if (language === 'vi') return name
  const normalized = `${code ?? ''} ${name}`.toLowerCase()
  if (normalized.includes('standard') || normalized.includes('tiêu chuẩn')) return 'Standard'
  if (normalized.includes('superior') || normalized.includes('cao cấp')) return 'Superior'
  if (normalized.includes('deluxe') || normalized.includes('sang trọng')) return 'Deluxe'
  if (normalized.includes('family') || normalized.includes('gia đình')) return 'Family'
  return name
}

export function RoomsPage() {
  const navigate = useNavigate()
  const { can, hasRole } = useAuth()
  const { language, text, money } = useI18n()
  const [selectedType, setSelectedType] = useState('')
  const customerDiscovery = hasRole('CUSTOMER') && !can('booking:read')
  const canCreateBooking = can('booking:write') || hasRole('CUSTOMER')
  const canManageRooms = can('room:write')
  const query = useQuery({
    queryKey: ['room-matrix'],
    enabled: !customerDiscovery,
    queryFn: async () => {
      const [matrix, types, rates] = await Promise.all([
        api.get<RoomMatrix[]>('/rooms/matrix'),
        api.get<Page<RoomType>>('/room-types', { params: { size: 100 } }),
        api.get<Page<RatePlan>>('/rate-plans', { params: { size: 200 } }),
      ])
      return { rooms: matrix.data, types: types.data.content, rates: rates.data.content }
    },
    refetchInterval: 60_000,
  })
  const completeCleaning = useMutation({
    mutationFn: (roomId: string) => api.post(`/rooms/${roomId}/complete-cleaning`),
    onSuccess: () => {
      toast.success(text('Phòng đã sẵn sàng đón khách.', 'Room is ready for the next guest.'))
      void query.refetch()
    },
    onError: error => toast.error(errorMessage(error)),
  })
  if (customerDiscovery) return <CustomerRoomDiscovery />
  if (query.isLoading) return <Loading />
  if (query.error) return <ErrorState message={errorMessage(query.error)} onRetry={() => void query.refetch()} />

  const rooms = query.data?.rooms ?? []
  const labels = statusLabels(language)
  const roomTypes = (query.data?.types ?? []).map((roomType, index) => {
    const typeRooms = rooms.filter(room => room.roomTypeId === roomType.id)
    const rates = (query.data?.rates ?? []).filter(rate => rate.roomTypeId === roomType.id && rate.active)
    const nightlyRate = rates.filter(rate => rate.pricingUnit === 'NIGHTLY').sort((left, right) => Number(left.rate) - Number(right.rate))[0]
    return {
      ...roomType,
      displayName: catalogName(roomType.code, classNameFor(roomType.name, roomType.code, language), language),
      palette: roomClassPalettes[index % roomClassPalettes.length],
      total: typeRooms.length,
      available: typeRooms.filter(room => room.displayStatus === 'AVAILABLE').length,
      fromRate: Number(nightlyRate?.rate ?? roomType.baseNightlyRate),
    }
  }).filter(roomType => roomType.total > 0)
  const visibleRooms = selectedType ? rooms.filter(room => room.roomTypeId === selectedType) : rooms
  const grouped = visibleRooms.reduce<Record<string, RoomMatrix[]>>((result, room) => {
    const key = `${room.floorNumber}|${room.floorName}`
    ;(result[key] ??= []).push(room)
    return result
  }, {})
  const floors = Object.entries(grouped).sort((left, right) => Number(left[0].split('|')[0]) - Number(right[0].split('|')[0]))
  const openRoom = (room: RoomMatrix) => {
    if (room.displayStatus === 'CLEANING' && canManageRooms) completeCleaning.mutate(room.roomId)
    else if (room.bookingId && can('booking:read')) navigate(`/bookings?bookingId=${room.bookingId}`)
    else if (room.displayStatus === 'AVAILABLE' && canCreateBooking) navigate(`/bookings?new=1&roomId=${room.roomId}`)
  }

  return <>
    <PageHeader title={text('Tìm & chọn phòng', 'Find & choose a room')} description={text('Nhận biết hạng phòng qua màu sắc, sức chứa và mức giá; dữ liệu trạng thái tự cập nhật mỗi phút.', 'Compare room classes by color, capacity and price. Availability refreshes every minute.')} action={<Button variant="secondary" loading={query.isFetching} onClick={() => void query.refetch()}><RefreshCw size={16}/>{text('Làm mới', 'Refresh')}</Button>} />

    <section className="mb-5" aria-labelledby="room-class-heading">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div><h2 id="room-class-heading" className="font-display text-xl font-bold">{text('Chọn hạng phòng phù hợp', 'Choose a room class')}</h2><p className="text-sm text-ink-soft">{text('Mỗi màu đại diện cho một trải nghiệm và mức giá khác nhau.', 'Each color represents a distinct stay experience and price range.')}</p></div>
        {selectedType && <button type="button" className="text-sm font-bold text-forest hover:text-gold" onClick={() => setSelectedType('')}>{text('Hiển thị tất cả', 'Show all rooms')}</button>}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {roomTypes.map(roomType => {
          const active = selectedType === roomType.id
          return <button type="button" key={roomType.id} aria-pressed={active} onClick={() => setSelectedType(active ? '' : roomType.id)} className={`group relative overflow-hidden rounded-2xl border p-4 text-left transition duration-300 hover:-translate-y-0.5 hover:shadow-lg ${roomType.palette.border} ${roomType.palette.soft} ${active ? 'ring-2 ring-ink ring-offset-2 shadow-lg' : 'shadow-sm'}`}>
            <span className={`absolute inset-y-0 left-0 w-1.5 ${roomType.palette.accent}`}/>
            <div className="flex items-start justify-between gap-3"><div><span className={`text-[10px] font-black uppercase tracking-[.18em] ${roomType.palette.text}`}>{roomType.code}</span><h3 className="mt-1 font-display text-xl font-black text-ink">{roomType.displayName}</h3></div><span className={`grid size-10 shrink-0 place-items-center rounded-xl bg-white/80 ${roomType.palette.text}`}><BedDouble size={20}/></span></div>
            <div className="mt-4 flex items-center justify-between gap-3 text-xs"><span className="flex items-center gap-1.5 text-ink-soft"><UsersRound size={14}/>{text(`${roomType.capacityAdults} người lớn · ${roomType.capacityChildren} trẻ em`, `${roomType.capacityAdults} adults · ${roomType.capacityChildren} children`)}</span><strong className={roomType.palette.text}>{roomType.available}/{roomType.total} {text('phòng trống', 'available')}</strong></div>
            <div className="mt-3 border-t border-black/5 pt-3"><span className="text-[11px] text-ink-soft">{text('Từ', 'From')}</span><p className="font-display text-lg font-black">{money(roomType.fromRate, roomType.currency)}<small className="ml-1 font-sans text-[11px] font-semibold text-ink-soft">{text('/đêm', '/night')}</small></p></div>
          </button>
        })}
      </div>
    </section>

    <div className="mb-5 flex flex-wrap gap-x-5 gap-y-2 rounded-2xl border border-slate-200/70 bg-white/60 px-4 py-3">
      {Object.entries(labels).map(([key, value]) => <div key={key} className="flex items-center gap-2 text-xs font-medium text-ink-soft"><span className={`size-2.5 rounded-full ${dots[key]}`}/>{value}<strong className="text-ink">{visibleRooms.filter(room => room.displayStatus === key).length}</strong></div>)}
    </div>
    <div className="space-y-5">
      {floors.map(([key, floorRooms]) => <Card key={key}>
        <div className="mb-4 flex items-center justify-between"><h2 className="font-display text-xl font-bold">{language === 'en' ? `Floor ${key.split('|')[0]}` : key.split('|')[1]}</h2><span className="text-xs text-ink-soft">{floorRooms.length} {text('phòng', 'rooms')}</span></div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
          {floorRooms.map(room => {
            const actionable = (Boolean(room.bookingId) && can('booking:read'))
              || (room.displayStatus === 'AVAILABLE' && canCreateBooking)
              || (room.displayStatus === 'CLEANING' && canManageRooms)
            const roomType = roomTypes.find(item => item.id === room.roomTypeId)
            const palette = roomType?.palette ?? roomClassPalettes[0]
            return <button
              type="button"
              key={room.roomId}
              disabled={!actionable}
              onClick={() => openRoom(room)}
              aria-label={`${labels[room.displayStatus] ?? room.displayStatus}: ${text('phòng', 'room')} ${room.roomNumber}${actionable ? text(' — mở thao tác', ' — open actions') : ''}`}
              className={`room-card group relative overflow-hidden rounded-2xl border p-4 text-left transition duration-300 ${palette.border} ${palette.soft} ${actionable ? 'hover:-translate-y-1 hover:shadow-lg' : 'opacity-80'}`}
            >
              <span className={`absolute inset-x-0 top-0 h-1 ${palette.accent}`}/>
              <div className="flex items-start justify-between"><BedDouble size={19} className={`${palette.text} transition group-hover:scale-110`}/><span className="font-display text-2xl font-black">{room.roomNumber}</span></div>
              <p className={`mt-3 truncate text-xs font-extrabold uppercase tracking-wide ${palette.text}`}>{roomType?.displayName ?? room.roomTypeName}</p>
              <div className="mt-2"><Badge tone={statusTone(room.displayStatus)}>{labels[room.displayStatus] ?? room.displayStatus}</Badge></div>
              {room.bookingId && can('booking:read') && <div className="mt-3 flex items-center gap-1 text-[11px] text-ink-soft"><CalendarClock size={12}/>{text('Mở hồ sơ lưu trú', 'Open stay record')}<ChevronRight size={12} className="ml-auto transition-transform group-hover:translate-x-0.5"/></div>}
              {!room.bookingId && room.displayStatus === 'AVAILABLE' && canCreateBooking && <div className="mt-3 flex items-center text-[11px] font-semibold text-forest">{text('Chọn phòng này', 'Choose this room')}<ChevronRight size={12} className="ml-auto transition-transform group-hover:translate-x-0.5"/></div>}
              {room.displayStatus === 'CLEANING' && canManageRooms && <div className="mt-3 flex items-center text-[11px] font-semibold text-violet-800">{completeCleaning.isPending && completeCleaning.variables === room.roomId ? text('Đang cập nhật…', 'Updating…') : text('Đánh dấu đã dọn xong', 'Mark cleaning complete')}<ChevronRight size={12} className="ml-auto transition-transform group-hover:translate-x-0.5"/></div>}
            </button>
          })}
        </div>
      </Card>)}
    </div>
    {!visibleRooms.length && <Card><Empty text={text('Không có phòng phù hợp với hạng đã chọn.', 'No rooms match the selected class.')}/></Card>}
  </>
}

function CustomerRoomDiscovery() {
  const { language, t, text, money } = useI18n()
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
    const amenityNames = catalog.data.amenities.filter(item => item.roomTypes.some(assignment => assignment.roomTypeId === roomType.id)).map(item => catalogName(item.amenity.code, item.amenity.name, language))
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
      <div className="mb-4 flex items-center gap-2"><SlidersHorizontal size={18}/><h2 className="font-display text-lg font-bold">{text('Nhu cầu lưu trú', 'Stay preferences')}</h2></div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><label><span className="label">{text('Người lớn', 'Adults')}</span><input className="field" type="number" min={1} max={10} value={filters.adults} onChange={event => setFilters(previous => ({ ...previous, adults: event.target.value }))}/></label><label><span className="label">{text('Trẻ em', 'Children')}</span><input className="field" type="number" min={0} max={10} value={filters.children} onChange={event => setFilters(previous => ({ ...previous, children: event.target.value }))}/></label><label><span className="label">{text('Giá tối đa mỗi đêm', 'Maximum nightly rate')}</span><input className="field" type="number" min={0} step={50000} placeholder={text('Không giới hạn', 'No limit')} value={filters.maxNightly} onChange={event => setFilters(previous => ({ ...previous, maxNightly: event.target.value }))}/></label><label><span className="label">{text('Tiện nghi mong muốn', 'Preferred amenity')}</span><select className="field" value={filters.amenityId} onChange={event => setFilters(previous => ({ ...previous, amenityId: event.target.value }))}><option value="">{text('Tất cả', 'All')}</option>{catalog.data.amenities.map(item => <option key={item.amenity.id} value={item.amenity.id}>{catalogName(item.amenity.code, item.amenity.name, language)}</option>)}</select></label></div>
    </Card>
    <div className="grid gap-5 lg:grid-cols-2">{results.map((item, visibleIndex) => {
      const rate = Number(item.nightly?.rate ?? item.roomType.baseNightlyRate)
      return <article key={item.roomType.id} className={`group relative min-h-80 overflow-hidden rounded-[2rem] bg-gradient-to-br ${roomClassPalettes[visibleIndex % roomClassPalettes.length].gradient} p-6 text-white shadow-xl transition duration-500 hover:-translate-y-1 hover:shadow-2xl sm:p-8`}><span className="absolute -right-16 -top-16 size-64 rounded-full border border-white/10 transition duration-700 group-hover:scale-110"/><div className="relative flex h-full flex-col"><div className="flex items-start justify-between"><div><span className="text-xs font-extrabold uppercase tracking-[.22em] text-white/65">{item.roomType.code}</span><h2 className="mt-3 font-display text-3xl font-black">{catalogName(item.roomType.code, classNameFor(item.roomType.name, item.roomType.code, language), language)}</h2></div><span className="grid size-14 place-items-center rounded-2xl border border-white/15 bg-white/10"><BedDouble size={25}/></span></div><p className="mt-4 line-clamp-3 max-w-xl text-sm leading-7 text-white/75">{catalogDescription(item.roomType.code, item.roomType.description, language)}</p><div className="mt-4 flex flex-wrap gap-2"><span className="flex items-center gap-1.5 rounded-full bg-black/15 px-3 py-1.5 text-xs"><UsersRound size={14}/>{t('rooms.capacity', { adults: item.roomType.capacityAdults, children: item.roomType.capacityChildren })}</span>{item.amenityNames.slice(0, 3).map(name => <span key={name} className="rounded-full bg-white/10 px-3 py-1.5 text-xs">{name}</span>)}</div><div className="mt-auto flex flex-col gap-4 pt-8 sm:flex-row sm:items-end sm:justify-between"><div><small className="text-white/65">{t('rooms.from')}</small><p className="font-display text-3xl font-black">{money(rate)}<span className="ml-1 text-sm font-medium text-white/65">{t('rooms.perNight')}</span></p></div><Button className="bg-white text-ink hover:bg-amber-50" onClick={() => startBooking(item.roomType.id)}><Sparkles size={16}/>{text('Chọn hạng phòng', 'Choose this class')}<ChevronRight size={16}/></Button></div></div></article>
    })}</div>
    {!results.length && <Card><Empty text={text('Không có hạng phòng phù hợp. Hãy nới bộ lọc để xem thêm lựa chọn.', 'No room class matches your filters. Try broadening your preferences.')}/></Card>}
  </>
}
