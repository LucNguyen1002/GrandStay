import { useDeferredValue, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { BedDouble, DoorOpen, DoorClosed, Eye, Filter, Plus, Search, Sparkles, Trash2, UserPlus, UsersRound, WalletCards, XCircle } from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { api, errorMessage } from '../api/client'
import type { AmenityView, Booking, BookingView, Customer, HotelService, Page, Promotion, RatePlan, Room, RoomType } from '../api/types'
import { Badge, Button, Card, Empty, Loading, Modal, PageHeader, Pagination, statusTone } from '../components/ui'
import { useAuth } from '../auth/AuthProvider'
import { CustomerDepositPanel } from '../components/CustomerDepositPanel'
import { formatDateTime, formatMoney, useI18n, type Language } from '../i18n'

const dateTime = (value: string, language: Language) => formatDateTime(value, language)
const money = (value: number, currency = 'VND', language: Language = 'vi') => formatMoney(value, currency, language)
const clampGuestCount = (rawValue: string, minimum: number, maximum: number) => {
  const value = Number(rawValue)
  if (!Number.isFinite(value)) return minimum
  return Math.min(maximum, Math.max(minimum, Math.trunc(value)))
}
const statuses = ['', 'PENDING', 'CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT', 'CANCELLED', 'NO_SHOW']
const statusLabelsVi: Record<string, string> = { PENDING: 'Chờ xác nhận', CONFIRMED: 'Đã xác nhận', CHECKED_IN: 'Đang lưu trú', CHECKED_OUT: 'Đã trả phòng', CANCELLED: 'Đã hủy', NO_SHOW: 'Không đến' }
const statusLabelsEn: Record<string, string> = { PENDING: 'Pending', CONFIRMED: 'Confirmed', CHECKED_IN: 'Staying', CHECKED_OUT: 'Checked out', CANCELLED: 'Cancelled', NO_SHOW: 'No-show' }
const statusLabel = (status: string, language: Language) => (language === 'en' ? statusLabelsEn : statusLabelsVi)[status] ?? status
const pricingUnitLabel = (unit: string, language: 'vi' | 'en') => ({
  HOURLY: language === 'vi' ? 'theo giờ' : 'hourly',
  DAILY: language === 'vi' ? 'theo ngày' : 'daily',
  NIGHTLY: language === 'vi' ? 'theo đêm' : 'nightly',
}[unit] ?? unit)
type HistoryGroup = 'ALL' | 'UPCOMING' | 'STAYING' | 'COMPLETED' | 'CANCELLED'

export function BookingsPage() {
  const { language, t } = useI18n()
  const [searchParams, setSearchParams] = useSearchParams()
  const initialBookingId = searchParams.get('bookingId')
  const initialRoomId = searchParams.get('roomId') ?? ''
  const initialRoomTypeId = searchParams.get('roomTypeId') ?? ''
  const initialCheckIn = searchParams.get('checkIn') ?? ''
  const initialCheckOut = searchParams.get('checkOut') ?? ''
  const initialGuests = searchParams.get('guests') ?? '1'
  const [page, setPage] = useState(0)
  const [status, setStatus] = useState('')
  const [historyGroup, setHistoryGroup] = useState<HistoryGroup>('ALL')
  const [search, setSearch] = useState('')
  const deferredSearch = useDeferredValue(search)
  const [creating, setCreating] = useState(searchParams.get('new') === '1')
  const [details, setDetails] = useState<string | null>(initialBookingId)
  const [cancelTarget, setCancelTarget] = useState<Booking | null>(null)
  const navigate = useNavigate()
  const { can, hasRole, user } = useAuth()
  const selfService = hasRole('CUSTOMER') && !can('booking:read')
  const bookingBase = selfService ? '/self/bookings' : '/bookings'
  const canCreate = can('booking:write') || selfService
  const queryClient = useQueryClient()
  const query = useQuery({ queryKey: ['bookings', selfService ? 'self' : 'staff', page, status, deferredSearch], queryFn: () => api.get<Page<Booking>>(bookingBase, { params: { page: selfService ? 0 : page, size: selfService ? 100 : 20, sort: 'createdAt,desc', status: selfService ? undefined : status || undefined, search: deferredSearch || undefined } }).then(r => r.data) })
  const action = useMutation({
    mutationFn: ({ id, kind, reason }: { id: string; kind: string; reason?: string }) => kind === 'cancel' ? api.post(`${bookingBase}/${id}/cancel`, { reason }) : api.post(`${bookingBase}/${id}/${kind}`),
    onSuccess: () => { setCancelTarget(null); toast.success(language === 'vi' ? 'Đã cập nhật đặt phòng.' : 'Booking updated.'); queryClient.invalidateQueries({ queryKey: ['bookings'] }); queryClient.invalidateQueries({ queryKey: ['room-matrix'] }); queryClient.invalidateQueries({ queryKey: ['dashboard'] }); queryClient.invalidateQueries({ queryKey: ['report'] }) },
    onError: e => toast.error(errorMessage(e)),
  })
  if (query.isLoading) return <Loading />
  const data = query.data
  const belongsToGroup = (item: Booking) => historyGroup === 'ALL'
    || (historyGroup === 'UPCOMING' && ['PENDING', 'CONFIRMED'].includes(item.status))
    || (historyGroup === 'STAYING' && item.status === 'CHECKED_IN')
    || (historyGroup === 'COMPLETED' && item.status === 'CHECKED_OUT')
    || (historyGroup === 'CANCELLED' && ['CANCELLED', 'NO_SHOW'].includes(item.status))
  const visible = (data?.content ?? []).filter(item => !selfService || belongsToGroup(item))
  const openDetails = (id: string) => { setDetails(id); setSearchParams({ bookingId: id }, { replace: true }) }
  const closeDialog = () => { setCreating(false); setDetails(null); setSearchParams({}, { replace: true }) }

  return <>
    <PageHeader title={selfService ? t('bookings.title.customer') : t('bookings.title.staff')} description={selfService ? t('bookings.description.customer') : t('bookings.description.staff')} action={canCreate ? <Button onClick={() => { setCreating(true); setSearchParams({ new: '1' }, { replace: true }) }}><Plus size={17}/>{t('bookings.new')}</Button> : undefined}/>
    <Card>
      {selfService && <div className="mb-5 flex gap-2 overflow-x-auto pb-1">{([
        ['ALL', t('bookings.all')], ['UPCOMING', t('bookings.upcoming')], ['STAYING', t('bookings.staying')], ['COMPLETED', t('bookings.completed')], ['CANCELLED', t('bookings.cancelled')],
      ] as [HistoryGroup, string][]).map(([key, label]) => <button key={key} type="button" onClick={() => setHistoryGroup(key)} className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold transition ${historyGroup === key ? 'bg-ink text-white shadow-sm' : 'bg-slate-100 text-ink-soft hover:bg-slate-200'}`}>{label}</button>)}</div>}
      <div className="mb-5 flex flex-col gap-3 sm:flex-row"><div className="relative flex-1"><Search className="field-icon" size={18}/><input className="field field-with-icon" aria-label={t('common.search')} placeholder={language === 'vi' ? 'Tìm theo mã đặt phòng…' : 'Search booking number…'} value={search} onChange={e => { setSearch(e.target.value); setPage(0) }}/></div>{!selfService && <select aria-label="Status" className="field sm:w-52" value={status} onChange={e => { setStatus(e.target.value); setPage(0) }}>{statuses.map(s => <option key={s} value={s}>{s ? statusLabel(s, language) : t('bookings.all')}</option>)}</select>}</div>
      {selfService && <div className="grid gap-3 md:hidden">{visible.map(item => <article key={item.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-start justify-between gap-3"><div><strong className="font-display text-lg">{item.bookingNumber}</strong><p className="mt-1 text-xs text-ink-soft">{t('bookings.totalGuests', { adults: item.adults, children: item.children })}</p></div><Badge tone={statusTone(item.status)}>{statusLabel(item.status, language)}</Badge></div><div className="mt-4 grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-3 text-xs"><div><span className="text-ink-soft">{t('bookings.checkIn')}</span><strong className="mt-1 block">{dateTime(item.expectedCheckInAt, language)}</strong></div><div><span className="text-ink-soft">{t('bookings.checkOut')}</span><strong className="mt-1 block">{dateTime(item.expectedCheckOutAt, language)}</strong></div></div><div className="mt-4 flex justify-end gap-2"><Button variant="secondary" onClick={() => openDetails(item.id)}><Eye size={16}/>{language === 'vi' ? 'Chi tiết' : 'Details'}</Button>{['PENDING','CONFIRMED'].includes(item.status) && <Button variant="danger" onClick={() => setCancelTarget(item)}><XCircle size={16}/>{t('common.cancel')}</Button>}</div></article>)}</div>}
      <div className={`table-shell ${selfService ? 'hidden md:block' : ''}`}><table className="data-table"><thead><tr><th>{t('bookings.number')}</th><th>{t('bookings.checkIn')}</th><th>{t('bookings.checkOut')}</th><th>{t('bookings.guests')}</th><th>{t('bookings.status')}</th><th></th></tr></thead><tbody>{visible.map(item => <tr key={item.id}><td className="font-bold text-ink">{item.bookingNumber}</td><td>{dateTime(item.expectedCheckInAt, language)}</td><td>{dateTime(item.expectedCheckOutAt, language)}</td><td>{t('bookings.totalGuests', { adults: item.adults, children: item.children })}</td><td><Badge tone={statusTone(item.status)}>{statusLabel(item.status, language)}</Badge></td><td><div className="flex justify-end gap-2"><button title="Details" className="rounded-lg p-2 hover:bg-slate-100" onClick={() => openDetails(item.id)}><Eye size={18}/></button>{item.status === 'PENDING' && can('booking:write') && <Button variant="secondary" onClick={() => action.mutate({ id: item.id, kind: 'confirm' })}>{t('common.confirm')}</Button>}{item.status === 'CONFIRMED' && can('booking:checkin') && <Button variant="secondary" onClick={() => action.mutate({ id: item.id, kind: 'check-in' })}><DoorOpen size={15}/>{t('bookings.checkIn')}</Button>}{item.status === 'CHECKED_IN' && can('booking:checkout') && <Button variant="secondary" onClick={() => action.mutate({ id: item.id, kind: 'check-out' })}><DoorClosed size={15}/>{t('bookings.checkOut')}</Button>}{item.status === 'CHECKED_OUT' && can('payment:read') && <Button variant="secondary" onClick={() => navigate(`/billing?bookingId=${item.id}`)}><WalletCards size={15}/>{language === 'vi' ? 'Thu ngân' : 'Billing'}</Button>}{['PENDING','CONFIRMED'].includes(item.status) && (can('booking:write') || selfService) && <button title={t('common.cancel')} className="rounded-lg p-2 text-red-600 hover:bg-red-50" onClick={() => setCancelTarget(item)}><XCircle size={18}/></button>}</div></td></tr>)}</tbody></table>{!visible.length && <Empty text={selfService ? t('bookings.empty.customer') : (language === 'vi' ? 'Không tìm thấy đặt phòng phù hợp.' : 'No matching bookings found.')}/>}</div>
      {!selfService && <Pagination page={data?.number ?? 0} totalPages={data?.totalPages ?? 0} onChange={setPage}/>}
    </Card>
    {creating && <CreateBookingModal
      initialRoomId={initialRoomId}
      initialRoomTypeId={initialRoomTypeId}
      initialCheckIn={initialCheckIn}
      initialCheckOut={initialCheckOut}
      initialGuests={initialGuests}
      selfService={selfService}
      customerName={user?.name ?? user?.username ?? ''}
      onClose={closeDialog}
      onCreated={id => { setCreating(false); setDetails(id); setSearchParams({ bookingId: id }, { replace: true }); queryClient.invalidateQueries({ queryKey: ['bookings'] }); queryClient.invalidateQueries({ queryKey: ['room-matrix'] }) }}
    />}
    {details && <BookingDetailsModal bookingId={details} selfService={selfService} onClose={closeDialog}/>}
    {cancelTarget && <CancelBookingDialog bookingNumber={cancelTarget.bookingNumber} loading={action.isPending} onClose={() => setCancelTarget(null)} onConfirm={reason => action.mutate({ id: cancelTarget.id, kind: 'cancel', reason })}/>}
  </>
}

function BookingDetailsModal({ bookingId, selfService, onClose }: { bookingId: string; selfService: boolean; onClose: () => void }) {
  const { language, t } = useI18n()
  const { can } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const bookingBase = selfService ? '/self/bookings' : '/bookings'
  const [confirmingCancellation, setConfirmingCancellation] = useState(false)
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
    mutationFn: ({ kind, reason }: { kind: string; reason?: string }) => kind === 'cancel'
      ? api.post(`${bookingBase}/${bookingId}/cancel`, { reason })
      : api.post(`${bookingBase}/${bookingId}/${kind}`),
    onSuccess: () => { setConfirmingCancellation(false); toast.success(language === 'vi' ? 'Đã cập nhật đặt phòng.' : 'Booking updated.'); refresh() },
    onError: error => toast.error(errorMessage(error)),
  })
  const addUsage = useMutation({
    mutationFn: () => api.post(`/bookings/${bookingId}/services`, usage),
    onSuccess: () => { toast.success('Đã ghi nhận dịch vụ vào phòng.'); setUsage({ bookingRoomId: '', serviceId: '', quantity: 1, notes: '' }); refresh() },
    onError: error => toast.error(errorMessage(error)),
  })

  return <>
  <Modal title={summary ? `${language === 'vi' ? 'Đặt phòng' : 'Booking'} ${summary.bookingNumber}` : (language === 'vi' ? 'Chi tiết đặt phòng' : 'Booking details')} size="xl" onClose={onClose}>
    {details.isLoading ? <Loading /> : details.error || !view || !summary ? <div role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{errorMessage(details.error)}</div> : <div className="space-y-5">
      <div className="grid gap-3 rounded-2xl bg-slate-50 p-4 text-sm sm:grid-cols-2">
        <div><span className="text-ink-soft">{t('bookings.number')}</span><p className="font-display text-lg font-bold">{summary.bookingNumber}</p></div>
        <div><span className="text-ink-soft">{t('bookings.status')}</span><p className="mt-1"><Badge tone={statusTone(summary.status)}>{statusLabel(summary.status, language)}</Badge></p></div>
        <div><span className="text-ink-soft">{t('bookings.checkIn')}</span><p className="font-semibold">{dateTime(summary.expectedCheckInAt, language)}</p></div>
        <div><span className="text-ink-soft">{t('bookings.checkOut')}</span><p className="font-semibold">{dateTime(summary.expectedCheckOutAt, language)}</p></div>
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        <div><h3 className="mb-2 font-bold">{language === 'vi' ? 'Khách lưu trú' : 'Guests'}</h3>{view.guests.map(guest => <div key={guest.id} className="border-t border-slate-100 py-2 text-sm">{guest.fullName} {guest.primary && <span className="text-gold">· {language === 'vi' ? 'Khách chính' : 'Primary guest'}</span>}</div>)}</div>
        <div><h3 className="mb-2 font-bold">{language === 'vi' ? 'Phòng đã chọn' : 'Selected rooms'}</h3>{view.rooms.map(room => <div key={room.id} className="flex justify-between gap-3 border-t border-slate-100 py-2 text-sm"><span><strong>{language === 'vi' ? 'Phòng' : 'Room'} {room.roomNumber ?? '—'}</strong><small className="mt-0.5 block text-ink-soft">{room.roomTypeName ?? room.roomTypeCode ?? ''}{room.ratePlanName ? ` · ${room.ratePlanName}` : ''}</small></span><span className="shrink-0 font-bold">{money(Number(room.roomCharge), summary.currency, language)}</span></div>)}</div>
      </div>
      {selfService && <CustomerDepositPanel bookingId={bookingId}/>} 
      {summary.status === 'CHECKED_IN' && can('service:write') && <div className="rounded-2xl border border-gold-soft bg-amber-50/40 p-4">
        <h3 className="mb-3 font-bold">Thêm dịch vụ sử dụng</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <select aria-label="Phòng sử dụng dịch vụ" className="field" value={usage.bookingRoomId} onChange={event => setUsage(previous => ({ ...previous, bookingRoomId: event.target.value }))}><option value="">Chọn phòng đã phân</option>{view.rooms.map(room => <option key={room.id} value={room.id}>Phòng {room.roomNumber ?? '—'} · {room.roomTypeName ?? ''}</option>)}</select>
          <select aria-label="Dịch vụ" className="field" value={usage.serviceId} onChange={event => setUsage(previous => ({ ...previous, serviceId: event.target.value }))}><option value="">Chọn dịch vụ</option>{services.data?.filter(service => service.active).map(service => <option key={service.id} value={service.id}>{service.name} · {Number(service.unitPrice).toLocaleString('vi-VN')}đ</option>)}</select>
          <input aria-label="Số lượng dịch vụ" type="number" min={0.01} step={0.01} className="field" value={usage.quantity} onChange={event => setUsage(previous => ({ ...previous, quantity: Number(event.target.value) }))}/>
          <input aria-label="Ghi chú dịch vụ" className="field" placeholder="Ghi chú" value={usage.notes} onChange={event => setUsage(previous => ({ ...previous, notes: event.target.value }))}/>
        </div>
        <Button className="mt-3" disabled={!usage.bookingRoomId || !usage.serviceId || usage.quantity <= 0} loading={addUsage.isPending} onClick={() => addUsage.mutate()}>Ghi nhận dịch vụ</Button>
      </div>}
      <div className="flex flex-wrap justify-end gap-3 border-t border-slate-100 pt-5">
        {summary.status === 'PENDING' && can('booking:write') && <Button loading={lifecycle.isPending} onClick={() => lifecycle.mutate({ kind: 'confirm' })}>Xác nhận đặt phòng</Button>}
        {summary.status === 'CONFIRMED' && can('booking:checkin') && <Button loading={lifecycle.isPending} onClick={() => lifecycle.mutate({ kind: 'check-in' })}><DoorOpen size={16}/>Nhận phòng</Button>}
        {summary.status === 'CHECKED_IN' && can('booking:checkout') && <Button loading={lifecycle.isPending} onClick={() => lifecycle.mutate({ kind: 'check-out' })}><DoorClosed size={16}/>Trả phòng</Button>}
        {summary.status === 'CHECKED_OUT' && can('payment:read') && <Button onClick={() => navigate(`/billing?bookingId=${bookingId}`)}><WalletCards size={16}/>Mở thu ngân</Button>}
        {['PENDING', 'CONFIRMED'].includes(summary.status) && (can('booking:write') || selfService) && <Button variant="danger" onClick={() => setConfirmingCancellation(true)}><XCircle size={16}/>{language === 'vi' ? 'Hủy đặt phòng' : 'Cancel booking'}</Button>}
      </div>
    </div>}
  </Modal>
  {confirmingCancellation && summary && <CancelBookingDialog bookingNumber={summary.bookingNumber} loading={lifecycle.isPending} onClose={() => setConfirmingCancellation(false)} onConfirm={reason => lifecycle.mutate({ kind: 'cancel', reason })}/>}
  </>
}

function CancelBookingDialog({ bookingNumber, loading, onClose, onConfirm }: { bookingNumber: string; loading: boolean; onClose: () => void; onConfirm: (reason: string) => void }) {
  const { language } = useI18n()
  const [reason, setReason] = useState('')
  const title = language === 'vi' ? 'Xác nhận hủy đặt phòng' : 'Confirm cancellation'
  return <Modal title={title} size="sm" onClose={onClose}>
    <div className="rounded-2xl border border-red-100 bg-red-50 p-4 text-sm text-red-900">
      {language === 'vi'
        ? <>Bạn có chắc muốn hủy đặt phòng <strong>{bookingNumber}</strong>? Thao tác này sẽ giải phóng phòng đã giữ và không thể hoàn tác trực tiếp.</>
        : <>Are you sure you want to cancel booking <strong>{bookingNumber}</strong>? Reserved rooms will be released.</>}
    </div>
    <label className="mt-4 block"><span className="label">{language === 'vi' ? 'Lý do hủy' : 'Cancellation reason'}</span><textarea autoFocus className="field min-h-24" maxLength={500} placeholder={language === 'vi' ? 'Ví dụ: Khách thay đổi kế hoạch' : 'Example: Travel plans changed'} value={reason} onChange={event => setReason(event.target.value)}/><small className="mt-1 block text-xs text-ink-soft">{reason.length}/500</small></label>
    <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><Button variant="secondary" onClick={onClose}>{language === 'vi' ? 'Giữ đặt phòng' : 'Keep booking'}</Button><Button variant="danger" loading={loading} disabled={reason.trim().length < 3} onClick={() => onConfirm(reason.trim())}>{language === 'vi' ? 'Xác nhận hủy' : 'Confirm cancellation'}</Button></div>
  </Modal>
}

type BookingRoomDraft = { key: string; roomId: string; ratePlanId: string; adults: number; children: number }
type BookingGuestDraft = { key: string; fullName: string; nationality: string; dateOfBirth: string }
const draftKey = () => globalThis.crypto.randomUUID()

function CreateBookingModal({ initialRoomId, initialRoomTypeId, initialCheckIn, initialCheckOut, initialGuests, selfService, customerName, onClose, onCreated }: { initialRoomId?: string; initialRoomTypeId?: string; initialCheckIn?: string; initialCheckOut?: string; initialGuests?: string; selfService: boolean; customerName: string; onClose: () => void; onCreated: (id: string) => void }) {
  const { language } = useI18n()
  const { can } = useAuth()
  const dateTimeInput = (value?: string, time = '14:00') => value ? `${value.slice(0, 10)}T${time}` : ''
  const [form, setForm] = useState({ customerId: '', guestName: selfService ? customerName : '', checkIn: dateTimeInput(initialCheckIn), checkOut: dateTimeInput(initialCheckOut, '12:00'), promotionId: '', specialRequests: '' })
  const [roomFilters, setRoomFilters] = useState({ adults: initialGuests ?? '1', children: '0', pricingUnit: '', maxTotal: '', amenityId: '' })
  const [roomDrafts, setRoomDrafts] = useState<BookingRoomDraft[]>([{ key: draftKey(), roomId: initialRoomId ?? '', ratePlanId: '', adults: 1, children: 0 }])
  const [guestDrafts, setGuestDrafts] = useState<BookingGuestDraft[]>([])
  const customers = useQuery({ queryKey: ['customers', 'booking-form'], enabled: !selfService, queryFn: () => api.get<Page<Customer>>('/customers', { params: { size: 100 } }).then(response => response.data.content) })
  const roomCatalog = useQuery({ queryKey: ['rooms', 'booking-form'], queryFn: () => api.get<Page<Room>>('/rooms', { params: { size: 200 } }).then(response => response.data.content) })
  const roomTypes = useQuery({ queryKey: ['room-types', 'booking-form'], queryFn: () => api.get<Page<RoomType>>('/room-types', { params: { size: 100 } }).then(response => response.data.content) })
  const rates = useQuery({ queryKey: ['rate-plans', 'booking-form'], queryFn: () => api.get<Page<RatePlan>>('/rate-plans', { params: { size: 200 } }).then(response => response.data.content) })
  const amenities = useQuery({ queryKey: ['amenities', 'booking-form'], queryFn: () => api.get<Page<AmenityView>>('/amenities', { params: { size: 100 } }).then(response => response.data.content) })
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
  const stayHours = validPeriod ? Math.max(1, (new Date(form.checkOut).getTime() - new Date(form.checkIn).getTime()) / 3_600_000) : 0
  const unitsFor = (unit: string) => unit === 'HOURLY' ? Math.ceil(stayHours) : Math.max(1, Math.ceil(stayHours / 24))
  const estimatedTotal = (rate: RatePlan) => Number(rate.rate) * Math.max(Number(rate.minStayUnits) || 1, unitsFor(rate.pricingUnit))
  const requestedAdults = Math.max(1, Number(roomFilters.adults) || 1)
  const requestedChildren = Math.max(0, Number(roomFilters.children) || 0)
  const maximumTotal = Number(roomFilters.maxTotal) || Number.POSITIVE_INFINITY
  const matchingOffers = (roomTypes.data ?? []).map((roomType, index) => {
    const physicalRooms = (availableRooms.data ?? []).filter(room => room.roomTypeId === roomType.id && room.operationalStatus === 'AVAILABLE')
    const typeRates = (rates.data ?? []).filter(rate => rate.active && rate.roomTypeId === roomType.id && (!roomFilters.pricingUnit || rate.pricingUnit === roomFilters.pricingUnit))
      .map(rate => ({ rate, total: estimatedTotal(rate) })).sort((left, right) => left.total - right.total)
    const amenityNames = (amenities.data ?? []).filter(item => item.roomTypes.some(assignment => assignment.roomTypeId === roomType.id)).map(item => item.amenity.name)
    return { roomType, physicalRooms, rates: typeRates, cheapest: typeRates[0], amenityNames, index }
  }).filter(offer => offer.physicalRooms.length > 0
    && offer.roomType.capacityAdults >= requestedAdults
    && offer.roomType.capacityChildren >= requestedChildren
    && Boolean(offer.cheapest)
    && (offer.cheapest?.total ?? Number.POSITIVE_INFINITY) <= maximumTotal
    && (!roomFilters.amenityId || amenities.data?.find(item => item.amenity.id === roomFilters.amenityId)?.roomTypes.some(item => item.roomTypeId === offer.roomType.id)))
    .sort((left, right) => Number(right.roomType.id === initialRoomTypeId) - Number(left.roomType.id === initialRoomTypeId) || left.index - right.index)
  const capacityForRoom = (roomId: string) => {
    const room = roomCatalog.data?.find(item => item.id === roomId)
    return roomTypes.data?.find(item => item.id === room?.roomTypeId)
  }
  const adults = roomDrafts.reduce((total, room) => total + room.adults, 0)
  const children = roomDrafts.reduce((total, room) => total + room.children, 0)
  const roomsValid = roomDrafts.length > 0 && roomDrafts.every(room => {
    const capacity = capacityForRoom(room.roomId)
    return room.roomId && room.ratePlanId && capacity
      && room.adults >= 1 && room.adults <= capacity.capacityAdults
      && room.children >= 0 && room.children <= capacity.capacityChildren
      && availableIds.has(room.roomId)
  })
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
  const updateRoom = (key: string, patch: Partial<BookingRoomDraft>) => setRoomDrafts(previous => previous.map(room => room.key === key ? { ...room, ...patch, ...(patch.roomId !== undefined && patch.ratePlanId === undefined ? { ratePlanId: '' } : {}) } : room))
  const updateGuest = (key: string, patch: Partial<BookingGuestDraft>) => setGuestDrafts(previous => previous.map(guest => guest.key === key ? { ...guest, ...patch } : guest))
  const chooseOffer = (offer: (typeof matchingOffers)[number]) => {
    const alreadyChosen = new Set(roomDrafts.map(room => room.roomId).filter(Boolean))
    const room = offer.physicalRooms.find(item => !alreadyChosen.has(item.id))
    if (!room || !offer.cheapest) return
    const next = { roomId: room.id, ratePlanId: offer.cheapest.rate.id, adults: Math.min(requestedAdults, offer.roomType.capacityAdults), children: Math.min(requestedChildren, offer.roomType.capacityChildren) }
    const empty = roomDrafts.find(item => !item.roomId)
    if (empty) updateRoom(empty.key, next)
    else setRoomDrafts(previous => [...previous, { key: draftKey(), ...next }])
  }

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
        {validPeriod && !availableRooms.isFetching && <div className="mb-5 rounded-3xl border border-slate-200 bg-white p-4 sm:p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2"><div><h4 className="flex items-center gap-2 font-display text-lg font-bold"><Sparkles size={18} className="text-gold"/>{language === 'vi' ? 'Chọn hạng phòng phù hợp' : 'Choose a room class'}</h4><p className="mt-1 text-xs text-ink-soft">{language === 'vi' ? 'Giá hiển thị là tổng ước tính cho toàn bộ kỳ nghỉ; hệ thống tự chọn gói hợp lý nhất.' : 'Displayed price estimates the entire stay and uses the best matching rate.'}</p></div><Badge tone="green">{availableRooms.data?.length ?? 0} {language === 'vi' ? 'phòng trống' : 'available rooms'}</Badge></div>
          <details className="group mb-4 rounded-2xl bg-slate-50 p-3" open>
            <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-bold"><Filter size={16}/>{language === 'vi' ? 'Bộ lọc nhu cầu' : 'Stay filters'}</summary>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <label><span className="label">{language === 'vi' ? 'Người lớn' : 'Adults'}</span><input className="field" type="number" min={1} max={10} inputMode="numeric" value={roomFilters.adults} onChange={event => setRoomFilters(previous => ({ ...previous, adults: event.target.value }))}/></label>
              <label><span className="label">{language === 'vi' ? 'Trẻ em' : 'Children'}</span><input className="field" type="number" min={0} max={10} inputMode="numeric" value={roomFilters.children} onChange={event => setRoomFilters(previous => ({ ...previous, children: event.target.value }))}/></label>
              <label><span className="label">{language === 'vi' ? 'Cách tính giá' : 'Rate type'}</span><select className="field" value={roomFilters.pricingUnit} onChange={event => setRoomFilters(previous => ({ ...previous, pricingUnit: event.target.value }))}><option value="">{language === 'vi' ? 'Tốt nhất' : 'Best value'}</option><option value="HOURLY">{language === 'vi' ? 'Theo giờ' : 'Hourly'}</option><option value="DAILY">{language === 'vi' ? 'Theo ngày' : 'Daily'}</option><option value="NIGHTLY">{language === 'vi' ? 'Theo đêm' : 'Nightly'}</option></select></label>
              <label><span className="label">{language === 'vi' ? 'Ngân sách tối đa' : 'Maximum budget'}</span><input className="field" type="number" min={0} step={50000} inputMode="numeric" placeholder={language === 'vi' ? 'Không giới hạn' : 'No limit'} value={roomFilters.maxTotal} onChange={event => setRoomFilters(previous => ({ ...previous, maxTotal: event.target.value }))}/></label>
              <label><span className="label">{language === 'vi' ? 'Tiện nghi' : 'Amenity'}</span><select className="field" value={roomFilters.amenityId} onChange={event => setRoomFilters(previous => ({ ...previous, amenityId: event.target.value }))}><option value="">{language === 'vi' ? 'Tất cả tiện nghi' : 'All amenities'}</option>{amenities.data?.map(item => <option key={item.amenity.id} value={item.amenity.id}>{item.amenity.name}</option>)}</select></label>
            </div>
          </details>
          <div className="grid gap-4 lg:grid-cols-2">{matchingOffers.map((offer, offerIndex) => {
            const styles = [
              'from-sky-950 via-sky-900 to-cyan-800 text-white',
              'from-emerald-950 via-emerald-900 to-teal-700 text-white',
              'from-amber-700 via-orange-700 to-rose-700 text-white',
              'from-violet-950 via-indigo-900 to-blue-800 text-white',
            ]
            const occupiedForType = roomDrafts.filter(draft => offer.physicalRooms.some(room => room.id === draft.roomId)).length
            const canChoose = occupiedForType < offer.physicalRooms.length
            const preferred = offer.roomType.id === initialRoomTypeId
            return <button key={offer.roomType.id} type="button" disabled={!canChoose} onClick={() => chooseOffer(offer)} className={`group relative min-h-56 overflow-hidden rounded-3xl bg-gradient-to-br p-5 text-left shadow-lg transition duration-500 ease-out hover:-translate-y-1 hover:scale-[1.01] hover:shadow-2xl disabled:cursor-not-allowed disabled:opacity-60 ${preferred ? 'ring-4 ring-gold/40' : ''} ${styles[offerIndex % styles.length]}`}>
              <span className="absolute -right-12 -top-14 size-44 rounded-full border border-white/15 transition duration-700 group-hover:scale-125"/>
              <div className="relative flex h-full flex-col"><div className="flex items-start justify-between gap-4"><div><span className="text-[11px] font-extrabold uppercase tracking-[.22em] text-white/70">{offer.roomType.code}{preferred ? ` · ${language === 'vi' ? 'Bạn vừa chọn' : 'Your selection'}` : ''}</span><h5 className="mt-2 font-display text-2xl font-bold">{offer.roomType.name}</h5></div><span className="rounded-2xl border border-white/20 bg-white/10 p-3"><BedDouble size={22}/></span></div>
                <p className="mt-3 line-clamp-2 text-sm leading-6 text-white/75">{offer.roomType.description || (language === 'vi' ? 'Không gian nghỉ ngơi tiện nghi, phù hợp với nhu cầu của bạn.' : 'A comfortable space tailored to your stay.')}</p>
                <div className="mt-3 flex flex-wrap gap-2 text-xs text-white/85"><span className="flex items-center gap-1 rounded-full bg-black/15 px-2.5 py-1"><UsersRound size={13}/>{offer.roomType.capacityAdults} {language === 'vi' ? 'người lớn' : 'adults'} · {offer.roomType.capacityChildren} {language === 'vi' ? 'trẻ em' : 'children'}</span>{offer.amenityNames.slice(0, 2).map(name => <span key={name} className="rounded-full bg-white/10 px-2.5 py-1">{name}</span>)}</div>
                <div className="mt-auto flex items-end justify-between gap-3 pt-5"><div><small className="block text-white/65">{language === 'vi' ? 'Tổng kỳ nghỉ từ' : 'Estimated stay from'}</small><strong className="font-display text-2xl">{money(offer.cheapest?.total ?? 0, 'VND', language)}</strong><small className="ml-1 text-white/65">· {pricingUnitLabel(offer.cheapest?.rate.pricingUnit ?? '', language)}</small></div><span className="rounded-xl bg-white px-3 py-2 text-xs font-extrabold text-slate-900 shadow">{canChoose ? (language === 'vi' ? 'Chọn hạng' : 'Select') : (language === 'vi' ? 'Đã chọn hết' : 'Selected')}</span></div>
              </div>
            </button>
          })}</div>
          {!matchingOffers.length && <div className="rounded-2xl bg-amber-50 px-4 py-5 text-center text-sm text-amber-900">{language === 'vi' ? 'Không có hạng phòng phù hợp với bộ lọc. Hãy tăng ngân sách hoặc giảm số khách.' : 'No room class matches these filters. Try a higher budget or fewer guests.'}</div>}
        </div>}
        <div className="space-y-3">{roomDrafts.map((draft, index) => {
          const selectedRoom = roomCatalog.data?.find(room => room.id === draft.roomId)
          const selectedRoomType = roomTypes.data?.find(roomType => roomType.id === selectedRoom?.roomTypeId)
          const chosenElsewhere = new Set(roomDrafts.filter(room => room.key !== draft.key).map(room => room.roomId))
          const roomOptions = availableRooms.data?.filter(room => !chosenElsewhere.has(room.id) || room.id === draft.roomId) ?? []
          const rateOptions = rates.data?.filter(rate => rate.active && rate.roomTypeId === selectedRoom?.roomTypeId) ?? []
          const unavailable = Boolean(draft.roomId && validPeriod && !availableIds.has(draft.roomId))
          return <div key={draft.key} className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
            <div className="mb-3 flex items-center justify-between gap-3"><div className="flex flex-wrap items-center gap-2"><strong className="text-sm">Phòng {index + 1}</strong>{selectedRoomType && <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-800">Tối đa {selectedRoomType.capacityAdults} người lớn · {selectedRoomType.capacityChildren} trẻ em</span>}</div>{roomDrafts.length > 1 && <button type="button" aria-label={`Xóa phòng ${index + 1}`} className="rounded-lg p-2 text-red-600 hover:bg-red-50" onClick={() => setRoomDrafts(previous => previous.filter(room => room.key !== draft.key))}><Trash2 size={16}/></button>}</div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <label><span className="label">Phòng</span><select className={`field ${unavailable ? 'field-error' : ''}`} value={draft.roomId} disabled={!validPeriod} onChange={event => {
                const roomId = event.target.value
                const capacity = capacityForRoom(roomId)
                updateRoom(draft.key, {
                  roomId,
                  adults: capacity ? Math.min(draft.adults, capacity.capacityAdults) : draft.adults,
                  children: capacity ? Math.min(draft.children, capacity.capacityChildren) : draft.children,
                })
              }}><option value="">Chọn phòng trống</option>{roomOptions.map(room => {
                const roomType = roomTypes.data?.find(item => item.id === room.roomTypeId)
                return <option key={room.id} value={room.id}>Phòng {room.roomNumber}{roomType ? ` · ${roomType.name} · ${roomType.capacityAdults} NL + ${roomType.capacityChildren} TE` : ''}</option>
              })}{draft.roomId && !roomOptions.some(room => room.id === draft.roomId) && selectedRoom && <option value={selectedRoom.id}>Phòng {selectedRoom.roomNumber} · không còn trống</option>}</select>{unavailable && <small className="mt-1 block text-xs text-red-700">Phòng không trống trong thời gian này.</small>}</label>
              <label><span className="label">Gói giá</span><select className="field" value={draft.ratePlanId} disabled={!selectedRoom || unavailable} onChange={event => updateRoom(draft.key, { ratePlanId: event.target.value })}><option value="">Chọn gói giá</option>{rateOptions.map(rate => <option key={rate.id} value={rate.id}>{rate.name} · {Number(rate.rate).toLocaleString('vi-VN')}đ/{rate.pricingUnit.toLowerCase()}</option>)}</select></label>
              <label><span className="label">Người lớn</span><input type="number" inputMode="numeric" min={1} max={selectedRoomType?.capacityAdults} disabled={!selectedRoomType} className="field" value={draft.adults} onChange={event => updateRoom(draft.key, { adults: clampGuestCount(event.target.value, 1, selectedRoomType?.capacityAdults ?? 1) })}/>{selectedRoomType && <small className="mt-1 block text-xs text-ink-soft">Từ 1 đến {selectedRoomType.capacityAdults} người lớn.</small>}</label>
              <label><span className="label">Trẻ em</span><input type="number" inputMode="numeric" min={0} max={selectedRoomType?.capacityChildren} disabled={!selectedRoomType || selectedRoomType.capacityChildren === 0} className="field" value={draft.children} onChange={event => updateRoom(draft.key, { children: clampGuestCount(event.target.value, 0, selectedRoomType?.capacityChildren ?? 0) })}/>{selectedRoomType && <small className="mt-1 block text-xs text-ink-soft">{selectedRoomType.capacityChildren > 0 ? `Tối đa ${selectedRoomType.capacityChildren} trẻ em.` : 'Hạng phòng này không nhận thêm trẻ em.'}</small>}</label>
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
