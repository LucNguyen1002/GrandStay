import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { api, errorMessage } from '../api/client'
import type { Floor, Page, RatePlan, Room, RoomType } from '../api/types'
import { Badge, Button, Card, ConfirmDialog, Empty, Loading, Modal, PageHeader, statusTone } from '../components/ui'
import { useAuth } from '../auth/AuthProvider'
import { useI18n, type Language } from '../i18n'

type Kind = 'floor' | 'type' | 'room' | 'rate'
type CatalogEntity = Floor | RoomType | Room | RatePlan
type Editor = { kind: Kind; item?: CatalogEntity } | null
type DeleteTarget = { kind: Kind; id: string; name: string } | null

const endpoints: Record<Kind, string> = {
  floor: '/floors',
  type: '/room-types',
  room: '/rooms',
  rate: '/rate-plans',
}

function catalogLabels(language: Language) {
  const vi = language === 'vi'
  return {
    kinds: { floor: vi ? 'tầng' : 'floor', type: vi ? 'hạng phòng' : 'room class', room: vi ? 'phòng' : 'room', rate: vi ? 'gói giá' : 'rate plan' } as Record<Kind, string>,
    statuses: { AVAILABLE: vi ? 'Sẵn sàng' : 'Available', CLEANING: vi ? 'Đang dọn' : 'Cleaning', MAINTENANCE: vi ? 'Bảo trì' : 'Maintenance', OUT_OF_SERVICE: vi ? 'Ngưng dùng' : 'Out of service' } as Record<string, string>,
    units: { HOURLY: vi ? 'Theo giờ' : 'Hourly', DAILY: vi ? 'Theo ngày' : 'Daily', NIGHTLY: vi ? 'Qua đêm' : 'Nightly' } as Record<string, string>,
  }
}

export function CatalogPage() {
  const { language, money, text } = useI18n()
  const { kinds: kindLabels, statuses: roomStatuses, units: pricingUnits } = catalogLabels(language)
  const [editor, setEditor] = useState<Editor>(null)
  const [deleting, setDeleting] = useState<DeleteTarget>(null)
  const { can } = useAuth()
  const client = useQueryClient()
  const floors = useQuery({ queryKey: ['floors'], queryFn: () => api.get<Page<Floor>>('/floors', { params: { size: 100 } }).then(response => response.data.content) })
  const types = useQuery({ queryKey: ['room-types'], queryFn: () => api.get<Page<RoomType>>('/room-types', { params: { size: 100 } }).then(response => response.data.content) })
  const rooms = useQuery({ queryKey: ['rooms', 'catalog'], queryFn: () => api.get<Page<Room>>('/rooms', { params: { size: 100 } }).then(response => response.data.content) })
  const rates = useQuery({ queryKey: ['rate-plans'], queryFn: () => api.get<Page<RatePlan>>('/rate-plans', { params: { size: 100 } }).then(response => response.data.content) })

  const refresh = () => {
    client.invalidateQueries({ queryKey: ['floors'] })
    client.invalidateQueries({ queryKey: ['room-types'] })
    client.invalidateQueries({ queryKey: ['rooms'] })
    client.invalidateQueries({ queryKey: ['rate-plans'] })
  }

  const remove = useMutation({
    mutationFn: (target: Exclude<DeleteTarget, null>) => api.delete(`${endpoints[target.kind]}/${target.id}`),
    onSuccess: (_, target) => {
      toast.success(text(`Đã xóa ${kindLabels[target.kind]} khỏi danh mục.`, `${kindLabels[target.kind]} removed from the catalog.`))
      setDeleting(null)
      refresh()
    },
    onError: error => toast.error(errorMessage(error)),
  })

  if ([floors, types, rooms, rates].some(query => query.isLoading)) return <Loading />

  const actions = (kind: Kind, item: CatalogEntity, name: string) => can('room:write') ? <div className="flex justify-end gap-1">
    <button type="button" aria-label={`${text('Sửa', 'Edit')} ${name}`} className="rounded-lg p-2 hover:bg-slate-100" onClick={() => setEditor({ kind, item })}><Pencil size={17}/></button>
    <button type="button" aria-label={`${text('Xóa', 'Delete')} ${name}`} className="rounded-lg p-2 text-red-600 hover:bg-red-50" onClick={() => setDeleting({ kind, id: item.id, name })}><Trash2 size={17}/></button>
  </div> : null

  return <>
    <PageHeader title={text('Danh mục phòng', 'Room catalog')} description={text('Cấu hình, chỉnh sửa và ngừng sử dụng tầng, hạng phòng, phòng vật lý và gói giá.', 'Configure, edit and deactivate floors, room classes, physical rooms and rate plans.')}/>
    <div className="grid gap-5 xl:grid-cols-2">
      <CatalogCard title={text('Tầng', 'Floors')} action={can('room:write') && <Button variant="secondary" onClick={() => setEditor({ kind: 'floor' })}><Plus size={15}/>{text('Thêm', 'Add')}</Button>}>
        <table className="data-table"><thead><tr><th>{text('Mã', 'Code')}</th><th>{text('Tên tầng', 'Floor name')}</th><th>{text('Số tầng', 'Floor number')}</th><th></th></tr></thead><tbody>{floors.data?.map(item => <tr key={item.id}><td className="font-bold">{item.code}</td><td>{item.name}</td><td>{item.floorNumber}</td><td>{actions('floor', item, item.name)}</td></tr>)}</tbody></table>
        {!floors.data?.length && <Empty/>}
      </CatalogCard>

      <CatalogCard title={text('Hạng phòng', 'Room classes')} action={can('room:write') && <Button variant="secondary" onClick={() => setEditor({ kind: 'type' })}><Plus size={15}/>{text('Thêm', 'Add')}</Button>}>
        <table className="data-table"><thead><tr><th>{text('Mã', 'Code')}</th><th>{text('Tên hạng', 'Class name')}</th><th>{text('Sức chứa', 'Capacity')}</th><th>{text('Giá đêm', 'Nightly rate')}</th><th></th></tr></thead><tbody>{types.data?.map(item => <tr key={item.id}><td className="font-bold">{item.code}</td><td>{item.name}</td><td>{item.capacityAdults} {text('người lớn', 'adults')} · {item.capacityChildren} {text('trẻ em', 'children')}</td><td>{money(Number(item.baseNightlyRate), item.currency)}</td><td>{actions('type', item, item.name)}</td></tr>)}</tbody></table>
        {!types.data?.length && <Empty/>}
      </CatalogCard>

      <CatalogCard title={text('Phòng', 'Rooms')} action={can('room:write') && <Button variant="secondary" onClick={() => setEditor({ kind: 'room' })}><Plus size={15}/>{text('Thêm', 'Add')}</Button>}>
        <table className="data-table"><thead><tr><th>{text('Số phòng', 'Room number')}</th><th>{text('Tầng', 'Floor')}</th><th>{text('Hạng', 'Class')}</th><th>{text('Trạng thái', 'Status')}</th><th></th></tr></thead><tbody>{rooms.data?.map(item => <tr key={item.id}><td className="font-bold">{item.roomNumber}</td><td>{floors.data?.find(floor => floor.id === item.floorId)?.name ?? '—'}</td><td>{types.data?.find(type => type.id === item.roomTypeId)?.name ?? '—'}</td><td><Badge tone={statusTone(item.operationalStatus)}>{roomStatuses[item.operationalStatus] ?? item.operationalStatus}</Badge></td><td>{actions('room', item, `${text('phòng', 'room')} ${item.roomNumber}`)}</td></tr>)}</tbody></table>
        {!rooms.data?.length && <Empty/>}
      </CatalogCard>

      <CatalogCard title={text('Gói giá', 'Rate plans')} action={can('room:write') && <Button variant="secondary" onClick={() => setEditor({ kind: 'rate' })}><Plus size={15}/>{text('Thêm', 'Add')}</Button>}>
        <table className="data-table"><thead><tr><th>{text('Mã', 'Code')}</th><th>{text('Tên gói', 'Plan name')}</th><th>{text('Đơn vị', 'Unit')}</th><th>{text('Giá', 'Rate')}</th><th></th></tr></thead><tbody>{rates.data?.map(item => <tr key={item.id}><td className="font-bold">{item.code}</td><td>{item.name}</td><td>{pricingUnits[item.pricingUnit] ?? item.pricingUnit}</td><td>{money(Number(item.rate), item.currency)}</td><td>{actions('rate', item, item.name)}</td></tr>)}</tbody></table>
        {!rates.data?.length && <Empty/>}
      </CatalogCard>
    </div>

    {editor && <CatalogModal
      key={`${editor.kind}-${editor.item?.id ?? 'new'}`}
      kind={editor.kind}
      item={editor.item}
      floors={floors.data ?? []}
      types={types.data ?? []}
      onClose={() => setEditor(null)}
      onSaved={() => { setEditor(null); refresh() }}
    />}

    {deleting && <ConfirmDialog
      title={`${text('Xóa', 'Delete')} ${kindLabels[deleting.kind]}?`}
      description={text(`“${deleting.name}” sẽ không còn xuất hiện trong danh mục và các lựa chọn mới. Dữ liệu lịch sử đã phát sinh vẫn được bảo toàn.`, `“${deleting.name}” will no longer appear in the catalog or new selections. Historical data will be preserved.`)}
      confirmLabel={text('Xóa khỏi danh mục', 'Remove from catalog')}
      loading={remove.isPending}
      onCancel={() => setDeleting(null)}
      onConfirm={() => remove.mutate(deleting)}
    />}
  </>
}

function CatalogCard({ title, action, children }: { title: string; action: React.ReactNode; children: React.ReactNode }) {
  return <Card className="min-w-0"><div className="mb-4 flex items-center justify-between"><h2 className="font-display text-xl font-bold">{title}</h2>{action}</div><div className="table-shell">{children}</div></Card>
}

function CatalogModal({ kind, item, floors, types, onClose, onSaved }: {
  kind: Kind
  item?: CatalogEntity
  floors: Floor[]
  types: RoomType[]
  onClose: () => void
  onSaved: () => void
}) {
  const { language, text } = useI18n()
  const { kinds: kindLabels, statuses: roomStatuses, units: pricingUnits } = catalogLabels(language)
  const floor = kind === 'floor' ? item as Floor | undefined : undefined
  const roomType = kind === 'type' ? item as RoomType | undefined : undefined
  const room = kind === 'room' ? item as Room | undefined : undefined
  const rate = kind === 'rate' ? item as RatePlan | undefined : undefined
  const [form, setForm] = useState<Record<string, string | number | boolean>>({
    code: floor?.code ?? roomType?.code ?? rate?.code ?? '',
    name: floor?.name ?? roomType?.name ?? rate?.name ?? '',
    floorNumber: floor?.floorNumber ?? 1,
    description: floor?.description ?? roomType?.description ?? '',
    capacityAdults: roomType?.capacityAdults ?? 2,
    capacityChildren: roomType?.capacityChildren ?? 0,
    baseHourlyRate: Number(roomType?.baseHourlyRate ?? 0),
    baseDailyRate: Number(roomType?.baseDailyRate ?? 0),
    baseNightlyRate: Number(roomType?.baseNightlyRate ?? 0),
    currency: roomType?.currency ?? rate?.currency ?? 'VND',
    roomNumber: room?.roomNumber ?? '',
    floorId: room?.floorId ?? floors[0]?.id ?? '',
    roomTypeId: room?.roomTypeId ?? rate?.roomTypeId ?? types[0]?.id ?? '',
    status: room?.operationalStatus ?? 'AVAILABLE',
    pricingUnit: rate?.pricingUnit ?? 'NIGHTLY',
    rate: Number(rate?.rate ?? 0),
    validFrom: rate?.validFrom ?? '',
    validTo: rate?.validTo ?? '',
    minStayUnits: rate?.minStayUnits ?? 1,
    refundable: rate?.refundable ?? true,
    active: rate?.active ?? true,
    notes: room?.notes ?? '',
  })

  const set = (key: string, value: string | number | boolean) => setForm(previous => ({ ...previous, [key]: value }))
  const payload = () => kind === 'floor'
    ? { code: form.code, name: form.name, floorNumber: form.floorNumber, description: form.description || null }
    : kind === 'type'
      ? { code: form.code, name: form.name, description: form.description || null, capacityAdults: form.capacityAdults, capacityChildren: form.capacityChildren, baseHourlyRate: form.baseHourlyRate, baseDailyRate: form.baseDailyRate, baseNightlyRate: form.baseNightlyRate, currency: form.currency }
      : kind === 'room'
        ? { roomNumber: form.roomNumber, floorId: form.floorId, roomTypeId: form.roomTypeId, status: form.status, notes: form.notes || null }
        : { roomTypeId: form.roomTypeId, code: form.code, name: form.name, pricingUnit: form.pricingUnit, rate: form.rate, currency: form.currency, validFrom: form.validFrom || null, validTo: form.validTo || null, minStayUnits: form.minStayUnits, refundable: form.refundable, active: form.active }

  const mutation = useMutation({
    mutationFn: () => item ? api.put(`${endpoints[kind]}/${item.id}`, payload()) : api.post(endpoints[kind], payload()),
    onSuccess: () => { toast.success(item ? text('Đã cập nhật dữ liệu danh mục.', 'Catalog data updated.') : text('Đã thêm dữ liệu danh mục.', 'Catalog data added.')); onSaved() },
    onError: error => toast.error(errorMessage(error)),
  })

  const valid = kind === 'room'
    ? Boolean(form.roomNumber && form.floorId && form.roomTypeId)
    : kind === 'rate'
      ? Boolean(form.code && form.name && form.roomTypeId && Number(form.rate) >= 0 && Number(form.minStayUnits) >= 1)
      : kind === 'type'
        ? Boolean(form.code && form.name && Number(form.capacityAdults) >= 1 && Number(form.baseNightlyRate) >= 0)
        : Boolean(form.code && form.name)
  const title = `${item ? text('Cập nhật', 'Update') : text('Thêm', 'Add')} ${kindLabels[kind]}`

  return <Modal title={title} onClose={onClose}><div className="grid gap-4 sm:grid-cols-2">
    {kind !== 'room' && <><label><span className="label">{text('Mã', 'Code')}</span><input className="field" value={String(form.code)} onChange={event => set('code', event.target.value.toUpperCase())}/></label><label><span className="label">{text('Tên', 'Name')}</span><input className="field" value={String(form.name)} onChange={event => set('name', event.target.value)}/></label></>}

    {kind === 'floor' && <><label><span className="label">{text('Số tầng', 'Floor number')}</span><input type="number" className="field" value={Number(form.floorNumber)} onChange={event => set('floorNumber', Number(event.target.value))}/></label><label><span className="label">{text('Mô tả', 'Description')}</span><input className="field" value={String(form.description)} onChange={event => set('description', event.target.value)}/></label></>}

    {kind === 'type' && <><label><span className="label">{text('Người lớn', 'Adults')}</span><input type="number" min={1} className="field" value={Number(form.capacityAdults)} onChange={event => set('capacityAdults', Number(event.target.value))}/></label><label><span className="label">{text('Trẻ em', 'Children')}</span><input type="number" min={0} className="field" value={Number(form.capacityChildren)} onChange={event => set('capacityChildren', Number(event.target.value))}/></label><label><span className="label">{text('Giá theo giờ', 'Hourly rate')}</span><input type="number" min={0} className="field" value={Number(form.baseHourlyRate)} onChange={event => set('baseHourlyRate', Number(event.target.value))}/></label><label><span className="label">{text('Giá theo ngày', 'Daily rate')}</span><input type="number" min={0} className="field" value={Number(form.baseDailyRate)} onChange={event => set('baseDailyRate', Number(event.target.value))}/></label><label><span className="label">{text('Giá qua đêm', 'Nightly rate')}</span><input type="number" min={0} className="field" value={Number(form.baseNightlyRate)} onChange={event => set('baseNightlyRate', Number(event.target.value))}/></label><label><span className="label">{text('Tiền tệ', 'Currency')}</span><input maxLength={3} className="field" value={String(form.currency)} onChange={event => set('currency', event.target.value.toUpperCase())}/></label><label className="sm:col-span-2"><span className="label">{text('Mô tả', 'Description')}</span><textarea className="field min-h-20" value={String(form.description)} onChange={event => set('description', event.target.value)}/></label></>}

    {kind === 'room' && <><label><span className="label">{text('Số phòng', 'Room number')}</span><input className="field" value={String(form.roomNumber)} onChange={event => set('roomNumber', event.target.value)}/></label><label><span className="label">{text('Tầng', 'Floor')}</span><select className="field" value={String(form.floorId)} onChange={event => set('floorId', event.target.value)}>{floors.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}</select></label><label><span className="label">{text('Hạng phòng', 'Room class')}</span><select className="field" value={String(form.roomTypeId)} onChange={event => set('roomTypeId', event.target.value)}>{types.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}</select></label><label><span className="label">{text('Trạng thái', 'Status')}</span><select className="field" value={String(form.status)} onChange={event => set('status', event.target.value)}>{Object.entries(roomStatuses).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="sm:col-span-2"><span className="label">{text('Ghi chú', 'Notes')}</span><textarea className="field min-h-20" value={String(form.notes)} onChange={event => set('notes', event.target.value)}/></label></>}

    {kind === 'rate' && <><label><span className="label">{text('Hạng phòng', 'Room class')}</span><select className="field" value={String(form.roomTypeId)} onChange={event => set('roomTypeId', event.target.value)}>{types.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}</select></label><label><span className="label">{text('Đơn vị tính', 'Pricing unit')}</span><select className="field" value={String(form.pricingUnit)} onChange={event => set('pricingUnit', event.target.value)}>{Object.entries(pricingUnits).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label><span className="label">{text('Đơn giá', 'Rate')}</span><input type="number" min={0} className="field" value={Number(form.rate)} onChange={event => set('rate', Number(event.target.value))}/></label><label><span className="label">{text('Tiền tệ', 'Currency')}</span><input maxLength={3} className="field" value={String(form.currency)} onChange={event => set('currency', event.target.value.toUpperCase())}/></label><label><span className="label">{text('Hiệu lực từ', 'Valid from')}</span><input type="date" className="field" value={String(form.validFrom)} onChange={event => set('validFrom', event.target.value)}/></label><label><span className="label">{text('Hiệu lực đến', 'Valid to')}</span><input type="date" className="field" value={String(form.validTo)} onChange={event => set('validTo', event.target.value)}/></label><label><span className="label">{text('Số kỳ tối thiểu', 'Minimum units')}</span><input type="number" min={1} className="field" value={Number(form.minStayUnits)} onChange={event => set('minStayUnits', Number(event.target.value))}/></label><div className="flex flex-col justify-end gap-3 pb-2"><label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={Boolean(form.refundable)} onChange={event => set('refundable', event.target.checked)}/>{text('Cho phép hoàn', 'Refundable')}</label><label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={Boolean(form.active)} onChange={event => set('active', event.target.checked)}/>{text('Đang áp dụng', 'Active')}</label></div></>}
  </div><div className="mt-6 flex justify-end gap-3"><Button variant="secondary" onClick={onClose}>{text('Đóng', 'Close')}</Button><Button disabled={!valid} loading={mutation.isPending} onClick={() => mutation.mutate()}>{text('Lưu danh mục', 'Save catalog')}</Button></div></Modal>
}
