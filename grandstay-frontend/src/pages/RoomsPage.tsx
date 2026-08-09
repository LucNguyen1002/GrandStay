import { useQuery } from '@tanstack/react-query'
import { BedDouble, CalendarClock, ChevronRight, RefreshCw } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { api, errorMessage } from '../api/client'
import type { RoomMatrix } from '../api/types'
import { Badge, Button, Card, Empty, ErrorState, Loading, PageHeader, statusTone } from '../components/ui'
import { useAuth } from '../auth/AuthProvider'

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
  const canCreateBooking = can('booking:write') || hasRole('CUSTOMER')
  const query = useQuery({ queryKey: ['room-matrix'], queryFn: () => api.get<RoomMatrix[]>('/rooms/matrix').then(response => response.data), refetchInterval: 60_000 })
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
