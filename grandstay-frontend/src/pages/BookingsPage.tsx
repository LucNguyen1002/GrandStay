import { useDeferredValue, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { DoorOpen, DoorClosed, Eye, Plus, Search, Trash2, UserPlus, WalletCards, XCircle } from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { api, errorMessage } from '../api/client'
import type { Booking, BookingView, Customer, HotelService, Page, Promotion, RatePlan, Room } from '../api/types'
import { Badge, Button, Card, Empty, Loading, Modal, PageHeader, Pagination, statusTone } from '../components/ui'
import { useAuth } from '../auth/AuthProvider'
import { CustomerDepositPanel } from '../components/CustomerDepositPanel'

const dateTime = (value: string) => new Date(value).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })
const statuses = ['', 'PENDING', 'CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT', 'CANCELLED', 'NO_SHOW']
const statusLabels: Record<string, string> = { PENDING: 'Chờ xác nhận', CONFIRMED: 'Đã xác nhận', CHECKED_IN: 'Đang lưu trú', CHECKED_OUT: 'Đã trả phòng', CANCELLED: 'Đã hủy', NO_SHOW: 'Không đến' }

export function BookingsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const initialBookingId = searchParams.get('bookingId')
  const initialRoomId = searchParams.get('roomId') ?? ''
  const [page, setPage] = useState(0)
  const [status, setStatus] = useState('')
  const [search, setSearch] = useState('')
  const deferredSearch = useDeferredValue(search)
  const [creating, setCreating] = useState(searchParams.get('new') === '1')
  const [details, setDetails] = useState<string | null>(initialBookingId)
  const navigate = useNavigate()
  const { can, hasRole, user } = useAuth()
  const selfService = hasRole('CUSTOMER') && !can('booking:read')
  const bookingBase = selfService ? '/self/bookings' : '/bookings'
  const canCreate = can('booking:write') || selfService
  const queryClient = useQueryClient()
  const query = useQuery({ queryKey: ['bookings', selfService ? 'self' : 'staff', page, status, deferredSearch], queryFn: () => api.get<Page<Booking>>(bookingBase, { params: { page, size: 20, sort: 'createdAt,desc', status: status || undefined, search: deferredSearch || undefined } }).then(r => r.data) })
  const action = useMutation({ mutationFn: ({ id, kind }: { id: string; kind: string }) => kind === 'cancel' ? api.post(`${bookingBase}/${id}/cancel`, { reason: selfService ? 'Hủy theo yêu cầu của khách hàng' : 'Hủy bởi nhân viên trên hệ thống' }) : api.post(`${bookingBase}/${id}/${kind}`), onSuccess: () => { toast.success('Cập nhật đặt phòng thành công.'); queryClient.invalidateQueries({ queryKey: ['bookings'] }); queryClient.invalidateQueries({ queryKey: ['room-matrix'] }); queryClient.invalidateQueries({ queryKey: ['dashboard'] }); queryClient.invalidateQueries({ queryKey: ['report'] }) }, onError: e => toast.error(errorMessage(e)) })
  if (query.isLoading) return <Loading />
  const data = query.data
  const visible = data?.content ?? []
  const openDetails = (id: string) => { setDetails(id); setSearchParams({ bookingId: id }, { replace: true }) }
  const closeDialog = () => { setCreating(false); setDetails(null); setSearchParams({}, { replace: true }) }

  return <>
    <PageHeader title={selfService ? 'Đặt phòng của tôi' : 'Đặt phòng & lưu trú'} description={selfService ? 'Chọn phòng trống, theo dõi và quản lý các kỳ lưu trú của bạn.' : 'Quản lý xuyên suốt từ giữ phòng, nhận phòng đến trả phòng.'} action={canCreate ? <Button onClick={() => { setCreating(true); setSearchParams({ new: '1' }, { replace: true }) }}><Plus size={17}/>Đặt phòng mới</Button> : undefined}/>
    <Card>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row"><div className="relative flex-1"><Search className="field-icon" size={18} aria-hidden="true"/><input className="field field-with-icon" aria-label="Tìm đặt phòng" placeholder="Tìm theo mã đặt phòng hoặc tên khách…" value={search} onChange={e => { setSearch(e.target.value); setPage(0) }}/></div><select aria-label="Lọc theo trạng thái" className="field sm:w-52" value={status} onChange={e => { setStatus(e.target.value); setPage(0) }}>{statuses.map(s => <option key={s} value={s}>{s ? statusLabels[s] : 'Tất cả trạng thái'}</option>)}</select></div>
      <div className="table-shell"><table className="data-table"><thead><tr><th>Mã đặt phòng</th><th>Nhận phòng</th><th>Trả phòng</th><th>Khách</th><th>Trạng thái</th><th></th></tr></thead><tbody>{visible.map(item => <tr key={item.id}><td className="font-bold text-ink">{item.bookingNumber}</td><td>{dateTime(item.expectedCheckInAt)}</td><td>{dateTime(item.expectedCheckOutAt)}</td><td>{item.adults} người lớn · {item.children} trẻ em</td><td><Badge tone={statusTone(item.status)}>{statusLabels[item.status] ?? item.status}</Badge></td><td><div className="flex justify-end gap-2"><button title="Chi tiết" aria-label={`Xem ${item.bookingNumber}`} className="rounded-lg p-2 hover:bg-slate-100" onClick={() => openDetails(item.id)}><Eye size={18}/></button>{item.status === 'PENDING' && can('booking:write') && <Button variant="secondary" onClick={() => action.mutate({ id: item.id, kind: 'confirm' })}>Xác nhận</Button>}{item.status === 'CONFIRMED' && can('booking:checkin') && <Button variant="secondary" onClick={() => action.mutate({ id: item.id, kind: 'check-in' })}><DoorOpen size={15}/>Nhận phòng</Button>}{item.status === 'CHECKED_IN' && can('booking:checkout') && <Button variant="secondary" onClick={() => action.mutate({ id: item.id, kind: 'check-out' })}><DoorClosed size={15}/>Trả phòng</Button>}{item.status === 'CHECKED_OUT' && can('payment:read') && <Button variant="secondary" onClick={() => navigate(`/billing?bookingId=${item.id}`)}><WalletCards size={15}/>Thu ngân</Button>}{['PENDING','CONFIRMED'].includes(item.status) && (can('booking:write') || selfService) && <button title="Hủy" className="rounded-lg p-2 text-red-600 hover:bg-red-50" onClick={() => action.mutate({ id: item.id, kind: 'cancel' })}><XCircle size={18}/></button>}</div></td></tr>)}</tbody></table>{!visible.length && <Empty text={selfService ? 'Bạn chưa có đặt phòng nào.' : 'Không tìm thấy đặt phòng phù hợp.'}/>}</div>
      <Pagination page={data?.number ?? 0} totalPages={data?.totalPages ?? 0} onChange={setPage}/>
    </Card>
    {creating && <CreateBookingModal
      initialRoomId={initialRoomId}
      selfService={selfService}
      customerName={user?.name ?? user?.username ?? ''}
      onClose={closeDialog}
      onCreated={id => { setCreating(false); setDetails(id); setSearchParams({ bookingId: id }, { replace: true }); queryClient.invalidateQueries({ queryKey: ['bookings'] }); queryClient.invalidateQueries({ queryKey: ['room-matrix'] }) }}
    />}
    {details && <BookingDetailsModal bookingId={details} selfService={selfService} onClose={closeDialog}/>}
  </>
}

function BookingDetailsModal({ bookingId, selfService, onClose }: { bookingId: string; selfService: boolean; onClose: () => void }) {
  const { can } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const bookingBase = selfService ? '/self/bookings' : '/bookings'
  const details = useQuery({ queryKey: ['booking', selfService ? 'self' : 'staff', bookingId], queryFn: () => api.get<BookingView>(`${bookingBase}/${bookingId}`).then(response => response.data) })
  const view = details.data
  const summary = view?.booking
  const services = useQuery({
    queryKey: ['services', 'usage'],
    enabled: summary?.status === 'CHECKED_IN' && can('service:write'),
    queryFn: () => api.get<Page<HotelService>>('/services', { params: { size: 100 } }).then(response => response.data.content),
  })
  const [usage, setUsage] = useState({ bookingRoomId: '', serviceId: '', quantity: 1, notes: '' })
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['booking', bookingId] })
    queryClient.invalidateQueries({ queryKey: ['bookings'] })
    queryClient.invalidateQueries({ queryKey: ['room-matrix'] })
    queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    queryClient.invalidateQueries({ queryKey: ['report'] })
  }
  const lifecycle = useMutation({
    mutationFn: (kind: string) => kind === 'cancel'
      ? api.post(`${bookingBase}/${bookingId}/cancel`, { reason: selfService ? 'Hủy theo yêu cầu của khách hàng' : 'Hủy bởi nhân viên trên hệ thống' })
      : api.post(`${bookingBase}/${bookingId}/${kind}`),
    onSuccess: () => { toast.success('Đã cập nhật trạng thái lưu trú.'); refresh() },
    onError: error => toast.error(errorMessage(error)),
  })
  const addUsage = useMutation({
    mutationFn: () => api.post(`/bookings/${bookingId}/services`, usage),
    onSuccess: () => { toast.success('Đã ghi nhận dịch vụ vào phòng.'); setUsage({ bookingRoomId: '', serviceId: '', quantity: 1, notes: '' }); refresh() },
    onError: error => toast.error(errorMessage(error)),
  })

  return <Modal title={summary ? `Đặt phòng ${summary.bookingNumber}` : 'Chi tiết đặt phòng'} size="xl" onClose={onClose}>
    {details.isLoading ? <Loading /> : details.error || !view || !summary ? <div role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{errorMessage(details.error)}</div> : <div className="space-y-5">
      <div className="grid gap-3 rounded-2xl bg-slate-50 p-4 text-sm sm:grid-cols-2">
        <div><span className="text-ink-soft">ID hồ sơ</span><p className="break-all font-mono text-xs font-semibold">{summary.id}</p></div>
        <div><span className="text-ink-soft">Trạng thái</span><p className="mt-1"><Badge tone={statusTone(summary.status)}>{statusLabels[summary.status] ?? summary.status}</Badge></p></div>
        <div><span className="text-ink-soft">Nhận phòng</span><p className="font-semibold">{dateTime(summary.expectedCheckInAt)}</p></div>
        <div><span className="text-ink-soft">Trả phòng</span><p className="font-semibold">{dateTime(summary.expectedCheckOutAt)}</p></div>
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        <div><h3 className="mb-2 font-bold">Khách lưu trú</h3>{view.guests.map(guest => <div key={guest.id} className="border-t border-slate-100 py-2 text-sm">{guest.fullName} {guest.primary && <span className="text-gold">· Khách chính</span>}</div>)}</div>
        <div><h3 className="mb-2 font-bold">Phòng đã phân</h3>{view.rooms.map(room => <div key={room.id} className="flex justify-between gap-3 border-t border-slate-100 py-2 text-sm"><span className="truncate">ID phòng: <span className="font-mono text-xs">{room.roomId}</span></span><span className="shrink-0 font-bold">{Number(room.roomCharge).toLocaleString('vi-VN')}đ</span></div>)}</div>
      </div>
      {selfService && <CustomerDepositPanel bookingId={bookingId}/>} 
      {summary.status === 'CHECKED_IN' && can('service:write') && <div className="rounded-2xl border border-gold-soft bg-amber-50/40 p-4">
        <h3 className="mb-3 font-bold">Thêm dịch vụ sử dụng</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <select aria-label="Phòng sử dụng dịch vụ" className="field" value={usage.bookingRoomId} onChange={event => setUsage(previous => ({ ...previous, bookingRoomId: event.target.value }))}><option value="">Chọn phòng đã phân</option>{view.rooms.map(room => <option key={room.id} value={room.id}>{room.roomId}</option>)}</select>
          <select aria-label="Dịch vụ" className="field" value={usage.serviceId} onChange={event => setUsage(previous => ({ ...previous, serviceId: event.target.value }))}><option value="">Chọn dịch vụ</option>{services.data?.filter(service => service.active).map(service => <option key={service.id} value={service.id}>{service.name} · {Number(service.unitPrice).toLocaleString('vi-VN')}đ</option>)}</select>
          <input aria-label="Số lượng dịch vụ" type="number" min={0.01} step={0.01} className="field" value={usage.quantity} onChange={event => setUsage(previous => ({ ...previous, quantity: Number(event.target.value) }))}/>
          <input aria-label="Ghi chú dịch vụ" className="field" placeholder="Ghi chú" value={usage.notes} onChange={event => setUsage(previous => ({ ...previous, notes: event.target.value }))}/>
        </div>
        <Button className="mt-3" disabled={!usage.bookingRoomId || !usage.serviceId || usage.quantity <= 0} loading={addUsage.isPending} onClick={() => addUsage.mutate()}>Ghi nhận dịch vụ</Button>
      </div>}
      <div className="flex flex-wrap justify-end gap-3 border-t border-slate-100 pt-5">
        {summary.status === 'PENDING' && can('booking:write') && <Button loading={lifecycle.isPending} onClick={() => lifecycle.mutate('confirm')}>Xác nhận đặt phòng</Button>}
        {summary.status === 'CONFIRMED' && can('booking:checkin') && <Button loading={lifecycle.isPending} onClick={() => lifecycle.mutate('check-in')}><DoorOpen size={16}/>Nhận phòng</Button>}
        {summary.status === 'CHECKED_IN' && can('booking:checkout') && <Button loading={lifecycle.isPending} onClick={() => lifecycle.mutate('check-out')}><DoorClosed size={16}/>Trả phòng</Button>}
        {summary.status === 'CHECKED_OUT' && can('payment:read') && <Button onClick={() => navigate(`/billing?bookingId=${bookingId}`)}><WalletCards size={16}/>Mở thu ngân</Button>}
        {['PENDING', 'CONFIRMED'].includes(summary.status) && (can('booking:write') || selfService) && <Button variant="danger" loading={lifecycle.isPending} onClick={() => lifecycle.mutate('cancel')}><XCircle size={16}/>Hủy đặt phòng</Button>}
      </div>
    </div>}
  </Modal>
}

type BookingRoomDraft = { key: string; roomId: string; ratePlanId: string; adults: number; children: number }
type BookingGuestDraft = { key: string; fullName: string; nationality: string; dateOfBirth: string }
const draftKey = () => globalThis.crypto.randomUUID()

function CreateBookingModal({ initialRoomId, selfService, customerName, onClose, onCreated }: { initialRoomId?: string; selfService: boolean; customerName: string; onClose: () => void; onCreated: (id: string) => void }) {
  const { can } = useAuth()
  const [form, setForm] = useState({ customerId: '', guestName: selfService ? customerName : '', checkIn: '', checkOut: '', promotionId: '', specialRequests: '' })
  const [roomDrafts, setRoomDrafts] = useState<BookingRoomDraft[]>([{ key: draftKey(), roomId: initialRoomId ?? '', ratePlanId: '', adults: 1, children: 0 }])
  const [guestDrafts, setGuestDrafts] = useState<BookingGuestDraft[]>([])
  const customers = useQuery({ queryKey: ['customers', 'booking-form'], enabled: !selfService, queryFn: () => api.get<Page<Customer>>('/customers', { params: { size: 100 } }).then(response => response.data.content) })
  const roomCatalog = useQuery({ queryKey: ['rooms', 'booking-form'], queryFn: () => api.get<Page<Room>>('/rooms', { params: { size: 200 } }).then(response => response.data.content) })
  const rates = useQuery({ queryKey: ['rate-plans', 'booking-form'], queryFn: () => api.get<Page<RatePlan>>('/rate-plans', { params: { size: 200 } }).then(response => response.data.content) })
  const promotions = useQuery({
    queryKey: ['promotions', 'booking-form'],
    enabled: can('promotion:read'),
    queryFn: () => api.get<Page<Promotion>>('/promotions', { params: { size: 100 } }).then(response => response.data.content),
  })
  const validPeriod = Boolean(form.checkIn && form.checkOut && new Date(form.checkOut) > new Date(form.checkIn))
  const availableRooms = useQuery({
    queryKey: ['available-rooms', form.checkIn, form.checkOut],
    enabled: validPeriod,
    queryFn: () => api.get<Room[]>('/rooms/available', { params: { from: new Date(form.checkIn).toISOString(), to: new Date(form.checkOut).toISOString() } }).then(response => response.data),
  })
  const selectedCustomer = customers.data?.find(customer => customer.id === form.customerId)
  const availableIds = new Set(availableRooms.data?.map(room => room.id) ?? [])
  const adults = roomDrafts.reduce((total, room) => total + room.adults, 0)
  const children = roomDrafts.reduce((total, room) => total + room.children, 0)
  const roomsValid = roomDrafts.length > 0 && roomDrafts.every(room => room.roomId && room.ratePlanId && room.adults >= 1 && room.children >= 0 && availableIds.has(room.roomId))
  const guestsValid = Boolean(selfService || selectedCustomer || form.guestName.trim()) && guestDrafts.every(guest => guest.fullName.trim())
  const valid = validPeriod && roomsValid && guestsValid

  const mutation = useMutation({
    mutationFn: () => api.post<{ id: string }>(selfService ? '/self/bookings' : '/bookings', {
      customerId: form.customerId || null,
      promotionId: form.promotionId || null,
      source: 'DIRECT',
      expectedCheckInAt: new Date(form.checkIn).toISOString(),
      expectedCheckOutAt: new Date(form.checkOut).toISOString(),
      adults,
      children,
      specialRequests: form.specialRequests || null,
      currency: 'VND',
      confirmImmediately: true,
      rooms: roomDrafts.map(room => ({ roomId: room.roomId, ratePlanId: room.ratePlanId, adults: room.adults, children: room.children })),
      guests: selfService ? guestDrafts.map(guest => ({ fullName: guest.fullName.trim(), nationality: guest.nationality || null, dateOfBirth: guest.dateOfBirth || null })) : [
        { customerId: form.customerId || null, fullName: selectedCustomer?.fullName ?? form.guestName.trim(), primary: true, nationality: selectedCustomer?.nationality ?? 'VN', dateOfBirth: selectedCustomer?.dateOfBirth ?? null },
        ...guestDrafts.map(guest => ({ customerId: null, fullName: guest.fullName.trim(), primary: false, nationality: guest.nationality || null, dateOfBirth: guest.dateOfBirth || null })),
      ],
    }).then(response => response.data),
    onSuccess: data => { toast.success(`Đã tạo đặt phòng gồm ${roomDrafts.length} phòng.`); onCreated(data.id) },
    onError: error => toast.error(errorMessage(error)),
  })

  const set = (key: keyof typeof form, value: string) => setForm(previous => ({ ...previous, [key]: value }))
  const updateRoom = (key: string, patch: Partial<BookingRoomDraft>) => setRoomDrafts(previous => previous.map(room => room.key === key ? { ...room, ...patch, ...(patch.roomId !== undefined ? { ratePlanId: '' } : {}) } : room))
  const updateGuest = (key: string, patch: Partial<BookingGuestDraft>) => setGuestDrafts(previous => previous.map(guest => guest.key === key ? { ...guest, ...patch } : guest))

  return <Modal title="Tạo đặt phòng" size="xl" onClose={onClose}>
    <div className="space-y-6">
      <section>
        <h3 className="mb-3 font-bold">1. Khách chính và thời gian lưu trú</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          {selfService ? <div className="sm:col-span-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900"><span className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Khách chính</span><p className="mt-1 font-bold">{customerName}</p><p className="mt-1 text-xs">Booking sẽ được liên kết trực tiếp với tài khoản đang đăng nhập.</p></div> : <>
            <label className="sm:col-span-2"><span className="label">Khách hàng có sẵn</span><select className="field" value={form.customerId} onChange={event => set('customerId', event.target.value)}><option value="">Khách vãng lai / nhập tên mới</option>{customers.data?.map(customer => <option key={customer.id} value={customer.id}>{customer.customerCode} · {customer.fullName}</option>)}</select></label>
            {!form.customerId && <label className="sm:col-span-2"><span className="label">Họ tên khách chính</span><input autoFocus className="field" value={form.guestName} onChange={event => set('guestName', event.target.value)} required/></label>}
          </>}
          <label><span className="label">Giờ nhận phòng dự kiến</span><input type="datetime-local" className="field" value={form.checkIn} onChange={event => set('checkIn', event.target.value)}/></label>
          <label><span className="label">Giờ trả phòng dự kiến</span><input type="datetime-local" className={`field ${form.checkOut && !validPeriod ? 'field-error' : ''}`} value={form.checkOut} min={form.checkIn || undefined} onChange={event => set('checkOut', event.target.value)}/>{form.checkOut && !validPeriod && <small className="mt-1 block text-xs text-red-700">Thời gian trả phòng phải sau thời gian nhận phòng.</small>}</label>
          {can('promotion:read') && <label className="sm:col-span-2"><span className="label">Chương trình ưu đãi</span><select className="field" value={form.promotionId} onChange={event => set('promotionId', event.target.value)}><option value="">Không áp dụng ưu đãi</option>{promotions.data?.map(item => <option key={item.id} value={item.id}>{item.code} · {item.name} · {item.discountType === 'PERCENTAGE' ? `giảm ${item.discountValue}%` : `giảm ${Number(item.discountValue).toLocaleString('vi-VN')}đ`}</option>)}</select>{promotions.isLoading && <small className="mt-1 block text-xs text-ink-soft">Đang tải ưu đãi hợp lệ…</small>}{promotions.error && <small role="alert" className="mt-1 block text-xs text-red-700">{errorMessage(promotions.error)}</small>}</label>}
        </div>
      </section>

      <section className="border-t border-slate-100 pt-5">
        <div className="mb-3 flex items-center justify-between gap-3"><div><h3 className="font-bold">2. Phòng và số khách</h3><p className="text-xs text-ink-soft">Chỉ hiển thị phòng thực sự trống trong toàn bộ khoảng lưu trú.</p></div><Button variant="secondary" disabled={!validPeriod} onClick={() => setRoomDrafts(previous => [...previous, { key: draftKey(), roomId: '', ratePlanId: '', adults: 1, children: 0 }])}><Plus size={15}/>Thêm phòng</Button></div>
        {!validPeriod && <div className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">Chọn thời gian nhận và trả phòng trước khi phân phòng.</div>}
        {availableRooms.isFetching && <p className="py-3 text-sm text-ink-soft">Đang kiểm tra phòng trống…</p>}
        {availableRooms.error && <p role="alert" className="py-3 text-sm text-red-700">{errorMessage(availableRooms.error)}</p>}
        <div className="space-y-3">{roomDrafts.map((draft, index) => {
          const selectedRoom = roomCatalog.data?.find(room => room.id === draft.roomId)
          const chosenElsewhere = new Set(roomDrafts.filter(room => room.key !== draft.key).map(room => room.roomId))
          const roomOptions = availableRooms.data?.filter(room => !chosenElsewhere.has(room.id) || room.id === draft.roomId) ?? []
          const rateOptions = rates.data?.filter(rate => rate.active && rate.roomTypeId === selectedRoom?.roomTypeId) ?? []
          const unavailable = Boolean(draft.roomId && validPeriod && !availableIds.has(draft.roomId))
          return <div key={draft.key} className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
            <div className="mb-3 flex items-center justify-between"><strong className="text-sm">Phòng {index + 1}</strong>{roomDrafts.length > 1 && <button type="button" aria-label={`Xóa phòng ${index + 1}`} className="rounded-lg p-2 text-red-600 hover:bg-red-50" onClick={() => setRoomDrafts(previous => previous.filter(room => room.key !== draft.key))}><Trash2 size={16}/></button>}</div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <label><span className="label">Phòng</span><select className={`field ${unavailable ? 'field-error' : ''}`} value={draft.roomId} disabled={!validPeriod} onChange={event => updateRoom(draft.key, { roomId: event.target.value })}><option value="">Chọn phòng trống</option>{roomOptions.map(room => <option key={room.id} value={room.id}>Phòng {room.roomNumber}</option>)}{draft.roomId && !roomOptions.some(room => room.id === draft.roomId) && selectedRoom && <option value={selectedRoom.id}>Phòng {selectedRoom.roomNumber} · không còn trống</option>}</select>{unavailable && <small className="mt-1 block text-xs text-red-700">Phòng không trống trong thời gian này.</small>}</label>
              <label><span className="label">Gói giá</span><select className="field" value={draft.ratePlanId} disabled={!selectedRoom || unavailable} onChange={event => updateRoom(draft.key, { ratePlanId: event.target.value })}><option value="">Chọn gói giá</option>{rateOptions.map(rate => <option key={rate.id} value={rate.id}>{rate.name} · {Number(rate.rate).toLocaleString('vi-VN')}đ/{rate.pricingUnit.toLowerCase()}</option>)}</select></label>
              <label><span className="label">Người lớn</span><input type="number" min={1} className="field" value={draft.adults} onChange={event => updateRoom(draft.key, { adults: Number(event.target.value) })}/></label>
              <label><span className="label">Trẻ em</span><input type="number" min={0} className="field" value={draft.children} onChange={event => updateRoom(draft.key, { children: Number(event.target.value) })}/></label>
            </div>
          </div>
        })}</div>
        <p className="mt-3 text-right text-sm text-ink-soft">Tổng cộng: <strong className="text-ink">{roomDrafts.length} phòng · {adults} người lớn · {children} trẻ em</strong></p>
      </section>

      <section className="border-t border-slate-100 pt-5">
        <div className="mb-3 flex items-center justify-between gap-3"><div><h3 className="font-bold">3. Danh sách khách đi cùng</h3><p className="text-xs text-ink-soft">Không bắt buộc; có thể bổ sung sau khi khách đến.</p></div><Button variant="secondary" onClick={() => setGuestDrafts(previous => [...previous, { key: draftKey(), fullName: '', nationality: 'VN', dateOfBirth: '' }])}><UserPlus size={15}/>Thêm khách</Button></div>
        <div className="space-y-3">{guestDrafts.map((guest, index) => <div key={guest.key} className="grid gap-3 rounded-2xl border border-slate-200 p-4 sm:grid-cols-[1fr_.35fr_.55fr_auto]"><label><span className="label">Họ tên khách {index + 2}</span><input className="field" value={guest.fullName} onChange={event => updateGuest(guest.key, { fullName: event.target.value })}/></label><label><span className="label">Quốc tịch</span><input className="field uppercase" maxLength={2} value={guest.nationality} onChange={event => updateGuest(guest.key, { nationality: event.target.value.toUpperCase() })}/></label><label><span className="label">Ngày sinh</span><input type="date" className="field" value={guest.dateOfBirth} onChange={event => updateGuest(guest.key, { dateOfBirth: event.target.value })}/></label><button type="button" aria-label={`Xóa khách ${index + 2}`} className="self-end rounded-xl p-3 text-red-600 hover:bg-red-50" onClick={() => setGuestDrafts(previous => previous.filter(item => item.key !== guest.key))}><Trash2 size={17}/></button></div>)}</div>
      </section>

      <label className="block border-t border-slate-100 pt-5"><span className="label">Yêu cầu đặc biệt</span><textarea className="field min-h-20" value={form.specialRequests} onChange={event => set('specialRequests', event.target.value)}/></label>
    </div>
    <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><Button variant="secondary" onClick={onClose}>Đóng</Button><Button disabled={!valid} loading={mutation.isPending} onClick={() => mutation.mutate()}>{selfService ? 'Xác nhận đặt phòng' : 'Tạo và xác nhận đặt phòng'}</Button></div>
  </Modal>
}
