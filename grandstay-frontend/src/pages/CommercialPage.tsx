import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { BadgePercent, Pencil, Plus, Sparkles, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { api, errorMessage } from '../api/client'
import type { AmenityView, Page, Promotion, RoomType } from '../api/types'
import { Badge, Button, Card, ConfirmDialog, Empty, ErrorState, Loading, Modal, PageHeader, statusTone } from '../components/ui'
import { useAuth } from '../auth/AuthProvider'

type Editor = { kind: 'amenity'; item?: AmenityView } | { kind: 'promotion'; item?: Promotion } | null
type CommercialKind = 'amenity' | 'promotion'
type DeleteTarget = { kind: CommercialKind; id: string; name: string } | null

const money = (value: number) => `${Number(value).toLocaleString('vi-VN')}đ`
const dateTime = (value: string) => new Date(value).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })

function promotionState(item: Promotion) {
  const now = Date.now()
  if (!item.active) return { label: 'Tạm ngưng', status: 'INACTIVE' }
  if (new Date(item.validFrom).getTime() > now) return { label: 'Sắp diễn ra', status: 'PENDING' }
  if (new Date(item.validTo).getTime() < now) return { label: 'Hết hạn', status: 'INACTIVE' }
  if (item.usageLimit != null && item.usedCount >= item.usageLimit) return { label: 'Hết lượt', status: 'INACTIVE' }
  return { label: 'Đang áp dụng', status: 'ACTIVE' }
}

export function CommercialPage() {
  const { can } = useAuth()
  const client = useQueryClient()
  const [editor, setEditor] = useState<Editor>(null)
  const [deleting, setDeleting] = useState<DeleteTarget>(null)
  const amenities = useQuery({
    queryKey: ['amenities'],
    queryFn: () => api.get<Page<AmenityView>>('/amenities', { params: { size: 100, sort: 'name,asc' } }).then(response => response.data.content),
  })
  const roomTypes = useQuery({
    queryKey: ['room-types'],
    queryFn: () => api.get<Page<RoomType>>('/room-types', { params: { size: 100, sort: 'name,asc' } }).then(response => response.data.content),
  })
  const promotions = useQuery({
    queryKey: ['promotions', 'catalog'],
    queryFn: () => api.get<Page<Promotion>>('/promotions', { params: { size: 100, sort: 'validTo,desc', includeInactive: true } }).then(response => response.data.content),
  })

  const refresh = (kind?: CommercialKind) => {
    if (!kind || kind === 'amenity') client.invalidateQueries({ queryKey: ['amenities'] })
    if (!kind || kind === 'promotion') client.invalidateQueries({ queryKey: ['promotions'] })
  }
  const remove = useMutation({
    mutationFn: (target: Exclude<DeleteTarget, null>) => api.delete(`/${target.kind === 'amenity' ? 'amenities' : 'promotions'}/${target.id}`),
    onSuccess: (_, target) => {
      toast.success(target.kind === 'amenity' ? 'Đã xóa tiện nghi khỏi danh mục.' : 'Đã ngừng và xóa ưu đãi.')
      setDeleting(null)
      refresh(target.kind)
    },
    onError: error => toast.error(errorMessage(error)),
  })

  if (amenities.isLoading || roomTypes.isLoading || promotions.isLoading) return <Loading />
  const loadError = amenities.error ?? roomTypes.error ?? promotions.error
  if (loadError) return <ErrorState message={errorMessage(loadError)} onRetry={() => { void amenities.refetch(); void roomTypes.refetch(); void promotions.refetch() }}/>

  return <>
    <PageHeader title="Tiện nghi & ưu đãi" description="Chuẩn hóa tiện nghi theo hạng phòng và quản lý chương trình giảm giá có kiểm soát."/>
    <div className="space-y-6">
      <Card>
        <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div><div className="flex items-center gap-2"><Sparkles className="text-gold" size={20}/><h2 className="font-display text-xl font-bold">Tiện nghi phòng</h2></div><p className="mt-1 text-sm text-ink-soft">Gán từng tiện nghi cho các hạng phòng phù hợp.</p></div>
          {can('room:write') && <Button variant="secondary" onClick={() => setEditor({ kind: 'amenity' })}><Plus size={16}/>Thêm tiện nghi</Button>}
        </div>
        <div className="table-shell"><table className="data-table"><thead><tr><th>Mã</th><th>Tiện nghi</th><th>Áp dụng cho hạng phòng</th><th></th></tr></thead><tbody>{amenities.data?.map(item => <tr key={item.amenity.id}>
          <td className="font-bold">{item.amenity.code}</td>
          <td><strong>{item.amenity.name}</strong>{item.amenity.description && <div className="mt-0.5 max-w-md text-xs text-ink-soft">{item.amenity.description}</div>}</td>
          <td><div className="flex max-w-xl flex-wrap gap-1.5">{item.roomTypes.map(assignment => {
            const roomType = roomTypes.data?.find(type => type.id === assignment.roomTypeId)
            return roomType ? <Badge key={assignment.roomTypeId} tone="neutral">{roomType.name}{assignment.quantity > 1 ? ` × ${assignment.quantity}` : ''}</Badge> : null
          })}{!item.roomTypes.length && <span className="text-sm text-ink-soft">Chưa gán</span>}</div></td>
          <td>{can('room:write') && <div className="flex justify-end gap-1"><button type="button" aria-label={`Sửa ${item.amenity.name}`} className="rounded-lg p-2 hover:bg-slate-100" onClick={() => setEditor({ kind: 'amenity', item })}><Pencil size={17}/></button><button type="button" aria-label={`Xóa ${item.amenity.name}`} className="rounded-lg p-2 text-red-600 hover:bg-red-50" onClick={() => setDeleting({ kind: 'amenity', id: item.amenity.id, name: item.amenity.name })}><Trash2 size={17}/></button></div>}</td>
        </tr>)}</tbody></table>{!amenities.data?.length && <Empty text="Chưa có tiện nghi nào."/>}</div>
      </Card>

      <Card>
        <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div><div className="flex items-center gap-2"><BadgePercent className="text-gold" size={21}/><h2 className="font-display text-xl font-bold">Chương trình ưu đãi</h2></div><p className="mt-1 text-sm text-ink-soft">Kiểm soát thời hạn, điều kiện đơn tối thiểu và số lượt sử dụng.</p></div>
          {can('promotion:write') && <Button onClick={() => setEditor({ kind: 'promotion' })}><Plus size={16}/>Thêm ưu đãi</Button>}
        </div>
        <div className="table-shell"><table className="data-table"><thead><tr><th>Mã</th><th>Chương trình</th><th>Mức giảm</th><th>Hiệu lực</th><th>Lượt dùng</th><th>Trạng thái</th><th></th></tr></thead><tbody>{promotions.data?.map(item => {
          const state = promotionState(item)
          return <tr key={item.id} className={state.status === 'ACTIVE' ? '' : 'bg-slate-50/70'}>
            <td className="font-bold">{item.code}</td><td><strong>{item.name}</strong>{item.minimumBookingAmount > 0 && <div className="text-xs text-ink-soft">Đơn từ {money(item.minimumBookingAmount)}</div>}</td>
            <td className="font-semibold">{item.discountType === 'PERCENTAGE' ? `${item.discountValue}%` : money(item.discountValue)}{item.maximumDiscount != null && <div className="text-xs font-normal text-ink-soft">Tối đa {money(item.maximumDiscount)}</div>}</td>
            <td><div className="text-xs leading-5">{dateTime(item.validFrom)}<br/>đến {dateTime(item.validTo)}</div></td>
            <td>{item.usedCount}{item.usageLimit != null ? ` / ${item.usageLimit}` : ' / Không giới hạn'}</td>
            <td><Badge tone={statusTone(state.status)}>{state.label}</Badge></td>
            <td>{can('promotion:write') && <div className="flex justify-end gap-1"><button type="button" aria-label={`Sửa ${item.name}`} className="rounded-lg p-2 hover:bg-slate-100" onClick={() => setEditor({ kind: 'promotion', item })}><Pencil size={17}/></button><button type="button" aria-label={`Xóa ${item.name}`} className="rounded-lg p-2 text-red-600 hover:bg-red-50" onClick={() => setDeleting({ kind: 'promotion', id: item.id, name: item.name })}><Trash2 size={17}/></button></div>}</td>
          </tr>
        })}</tbody></table>{!promotions.data?.length && <Empty text="Chưa có chương trình ưu đãi nào."/>}</div>
      </Card>
    </div>

    {editor?.kind === 'amenity' && <AmenityModal item={editor.item} roomTypes={roomTypes.data ?? []} onClose={() => setEditor(null)} onSaved={() => { setEditor(null); refresh('amenity') }}/>} 
    {editor?.kind === 'promotion' && <PromotionModal item={editor.item} onClose={() => setEditor(null)} onSaved={() => { setEditor(null); refresh('promotion') }}/>} 
    {deleting && <ConfirmDialog title={deleting.kind === 'amenity' ? 'Xóa tiện nghi?' : 'Xóa chương trình ưu đãi?'} description={deleting.kind === 'amenity' ? `Tiện nghi “${deleting.name}” sẽ được gỡ khỏi tất cả hạng phòng.` : `Ưu đãi “${deleting.name}” sẽ ngừng áp dụng cho các booking mới; số tiền giảm của booking cũ vẫn được giữ nguyên.`} confirmLabel="Xóa khỏi danh mục" loading={remove.isPending} onCancel={() => setDeleting(null)} onConfirm={() => remove.mutate(deleting)}/>} 
  </>
}

function AmenityModal({ item, roomTypes, onClose, onSaved }: { item?: AmenityView; roomTypes: RoomType[]; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ code: item?.amenity.code ?? '', name: item?.amenity.name ?? '', description: item?.amenity.description ?? '', icon: item?.amenity.icon ?? '' })
  const [selected, setSelected] = useState<Record<string, number>>(() => Object.fromEntries(item?.roomTypes.map(assignment => [assignment.roomTypeId, assignment.quantity]) ?? []))
  const mutation = useMutation({
    mutationFn: () => {
      const payload = { ...form, roomTypes: Object.entries(selected).map(([roomTypeId, quantity]) => ({ roomTypeId, quantity })) }
      return item ? api.put(`/amenities/${item.amenity.id}`, payload) : api.post('/amenities', payload)
    },
    onSuccess: () => { toast.success(item ? 'Đã cập nhật tiện nghi.' : 'Đã thêm tiện nghi.'); onSaved() },
    onError: error => toast.error(errorMessage(error)),
  })
  const set = (key: keyof typeof form, value: string) => setForm(previous => ({ ...previous, [key]: value }))
  const valid = Boolean(form.code.trim() && form.name.trim())

  return <Modal title={item ? 'Cập nhật tiện nghi' : 'Thêm tiện nghi'} size="lg" onClose={onClose}>
    <div className="grid gap-4 sm:grid-cols-2">
      <label><span className="label">Mã tiện nghi</span><input autoFocus className="field uppercase" maxLength={50} value={form.code} onChange={event => set('code', event.target.value.toUpperCase())}/></label>
      <label><span className="label">Tên tiện nghi</span><input className="field" maxLength={100} value={form.name} onChange={event => set('name', event.target.value)}/></label>
      <label className="sm:col-span-2"><span className="label">Mô tả</span><textarea className="field min-h-20" maxLength={500} value={form.description} onChange={event => set('description', event.target.value)}/></label>
      <label className="sm:col-span-2"><span className="label">Tên biểu tượng (không bắt buộc)</span><input className="field" maxLength={100} placeholder="Ví dụ: wifi, tv, snowflake" value={form.icon} onChange={event => set('icon', event.target.value)}/></label>
    </div>
    <div className="mt-5 border-t border-slate-100 pt-5"><h3 className="font-bold">Áp dụng cho hạng phòng</h3><p className="mt-1 text-xs text-ink-soft">Tích các hạng có sẵn tiện nghi này và nhập số lượng nếu cần.</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">{roomTypes.map(roomType => {
        const checked = selected[roomType.id] != null
        return <div key={roomType.id} className={`flex items-center gap-3 rounded-xl border p-3 ${checked ? 'border-gold-soft bg-amber-50/50' : 'border-slate-200'}`}><label className="flex min-w-0 flex-1 items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={checked} onChange={event => setSelected(previous => { const next = { ...previous }; if (event.target.checked) next[roomType.id] = 1; else delete next[roomType.id]; return next })}/><span className="truncate">{roomType.name}</span></label>{checked && <input aria-label={`Số lượng ${roomType.name}`} type="number" min={1} className="field w-20 py-2" value={selected[roomType.id]} onChange={event => setSelected(previous => ({ ...previous, [roomType.id]: Math.max(1, Number(event.target.value)) }))}/>}</div>
      })}</div>
    </div>
    <div className="mt-6 flex justify-end gap-3"><Button variant="secondary" onClick={onClose}>Đóng</Button><Button disabled={!valid} loading={mutation.isPending} onClick={() => mutation.mutate()}>Lưu tiện nghi</Button></div>
  </Modal>
}

const localInput = (value?: string, daysFromNow = 0) => {
  const date = value ? new Date(value) : new Date(Date.now() + daysFromNow * 86_400_000)
  const offset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}

function PromotionModal({ item, onClose, onSaved }: { item?: Promotion; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    code: item?.code ?? '', name: item?.name ?? '', description: item?.description ?? '', discountType: item?.discountType ?? 'PERCENTAGE',
    discountValue: String(item?.discountValue ?? 10), maximumDiscount: item?.maximumDiscount == null ? '' : String(item.maximumDiscount),
    minimumBookingAmount: String(item?.minimumBookingAmount ?? 0), validFrom: localInput(item?.validFrom), validTo: localInput(item?.validTo, 30),
    usageLimit: item?.usageLimit == null ? '' : String(item.usageLimit), active: item?.active ?? true,
  })
  const mutation = useMutation({
    mutationFn: () => {
      const payload = {
        code: form.code, name: form.name, description: form.description || null, discountType: form.discountType,
        discountValue: Number(form.discountValue), maximumDiscount: form.maximumDiscount === '' ? null : Number(form.maximumDiscount),
        minimumBookingAmount: Number(form.minimumBookingAmount), validFrom: new Date(form.validFrom).toISOString(), validTo: new Date(form.validTo).toISOString(),
        usageLimit: form.usageLimit === '' ? null : Number(form.usageLimit), active: form.active,
      }
      return item ? api.put(`/promotions/${item.id}`, payload) : api.post('/promotions', payload)
    },
    onSuccess: () => { toast.success(item ? 'Đã cập nhật chương trình ưu đãi.' : 'Đã tạo chương trình ưu đãi.'); onSaved() },
    onError: error => toast.error(errorMessage(error)),
  })
  const set = (key: keyof typeof form, value: string | boolean) => setForm(previous => ({ ...previous, [key]: value }))
  const valid = useMemo(() => Boolean(form.code.trim() && form.name.trim() && Number(form.discountValue) > 0
    && (form.discountType !== 'PERCENTAGE' || Number(form.discountValue) <= 100)
    && Number(form.minimumBookingAmount) >= 0 && form.validFrom && form.validTo
    && new Date(form.validTo) > new Date(form.validFrom)
    && (form.maximumDiscount === '' || Number(form.maximumDiscount) >= 0)
    && (form.usageLimit === '' || Number(form.usageLimit) >= Math.max(1, item?.usedCount ?? 1))), [form, item?.usedCount])

  return <Modal title={item ? 'Cập nhật chương trình ưu đãi' : 'Thêm chương trình ưu đãi'} size="lg" onClose={onClose}>
    <div className="grid gap-4 sm:grid-cols-2">
      <label><span className="label">Mã ưu đãi</span><input autoFocus className="field uppercase" maxLength={50} value={form.code} onChange={event => set('code', event.target.value.toUpperCase())}/></label>
      <label><span className="label">Tên chương trình</span><input className="field" maxLength={150} value={form.name} onChange={event => set('name', event.target.value)}/></label>
      <label><span className="label">Loại giảm</span><select className="field" value={form.discountType} onChange={event => set('discountType', event.target.value)}><option value="PERCENTAGE">Theo phần trăm</option><option value="FIXED_AMOUNT">Số tiền cố định</option></select></label>
      <label><span className="label">Giá trị giảm</span><input type="number" min={0.01} max={form.discountType === 'PERCENTAGE' ? 100 : undefined} className="field" value={form.discountValue} onChange={event => set('discountValue', event.target.value)}/></label>
      <label><span className="label">Giảm tối đa</span><input type="number" min={0} className="field" placeholder="Không giới hạn" value={form.maximumDiscount} onChange={event => set('maximumDiscount', event.target.value)}/></label>
      <label><span className="label">Giá trị booking tối thiểu</span><input type="number" min={0} className="field" value={form.minimumBookingAmount} onChange={event => set('minimumBookingAmount', event.target.value)}/></label>
      <label><span className="label">Bắt đầu</span><input type="datetime-local" className="field" value={form.validFrom} onChange={event => set('validFrom', event.target.value)}/></label>
      <label><span className="label">Kết thúc</span><input type="datetime-local" min={form.validFrom} className="field" value={form.validTo} onChange={event => set('validTo', event.target.value)}/></label>
      <label><span className="label">Giới hạn lượt dùng</span><input type="number" min={Math.max(1, item?.usedCount ?? 1)} className="field" placeholder="Không giới hạn" value={form.usageLimit} onChange={event => set('usageLimit', event.target.value)}/>{item && <small className="mt-1 block text-xs text-ink-soft">Đã dùng {item.usedCount} lượt.</small>}</label>
      <label className="flex items-end pb-3"><span className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={form.active} onChange={event => set('active', event.target.checked)}/>Cho phép áp dụng</span></label>
      <label className="sm:col-span-2"><span className="label">Mô tả/điều kiện</span><textarea className="field min-h-20" maxLength={1000} value={form.description} onChange={event => set('description', event.target.value)}/></label>
    </div>
    {!valid && form.validFrom && form.validTo && new Date(form.validTo) <= new Date(form.validFrom) && <p role="alert" className="mt-3 text-sm text-red-700">Thời gian kết thúc phải sau thời gian bắt đầu.</p>}
    <div className="mt-6 flex justify-end gap-3"><Button variant="secondary" onClick={onClose}>Đóng</Button><Button disabled={!valid} loading={mutation.isPending} onClick={() => mutation.mutate()}>Lưu ưu đãi</Button></div>
  </Modal>
}
