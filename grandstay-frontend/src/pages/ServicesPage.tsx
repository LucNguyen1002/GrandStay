import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CirclePause, Pencil, Plus, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'
import { api, errorMessage } from '../api/client'
import type { HotelService, Page } from '../api/types'
import { Badge, Button, Card, ConfirmDialog, Empty, Loading, Modal, PageHeader, statusTone } from '../components/ui'
import { useAuth } from '../auth/AuthProvider'
import { useI18n, type Language } from '../i18n'
import { catalogDescription, catalogName, catalogUnit } from '../i18n/catalog'

type Form = { code: string; name: string; category: string; description: string; unit: string; unitPrice: number; taxRate: number; currency: string; active: boolean }
const blank: Form = { code: '', name: '', category: 'FOOD_BEVERAGE', description: '', unit: 'lần', unitPrice: 0, taxRate: 8, currency: 'VND', active: true }

function serviceCategoryLabel(value: string, language: Language) {
  const labels: Record<string, [string, string]> = {
    FOOD_BEVERAGE: ['Ẩm thực & đồ uống', 'Food & beverage'],
    LAUNDRY: ['Giặt ủi', 'Laundry'], TRANSPORT: ['Di chuyển', 'Transport'],
    WELLNESS: ['Sức khỏe', 'Wellness'], OTHER: ['Khác', 'Other'],
  }
  return labels[value]?.[language === 'vi' ? 0 : 1] ?? value
}

export function ServicesPage() {
  const { language, money, text } = useI18n()
  const query = useQuery({ queryKey: ['services', 'catalog'], queryFn: () => api.get<Page<HotelService>>('/services', { params: { size: 100, includeInactive: true } }).then(r => r.data.content) })
  const [editing, setEditing] = useState<HotelService | 'new' | null>(null)
  const [deleting, setDeleting] = useState<HotelService | null>(null)
  const client = useQueryClient()
  const { can } = useAuth()
  const refresh = () => client.invalidateQueries({ queryKey: ['services'] })
  const remove = useMutation({ mutationFn: (id: string) => api.delete(`/services/${id}`), onSuccess: () => { toast.success(text('Đã tạm ngưng dịch vụ.', 'Service paused.')); setDeleting(null); refresh() }, onError: e => toast.error(errorMessage(e)) })
  const restore = useMutation({ mutationFn: (service: HotelService) => api.put(`/services/${service.id}`, { code: service.code, name: service.name, category: service.category, description: service.description ?? null, unit: service.unit, unitPrice: service.unitPrice, taxRate: service.taxRate, currency: service.currency, active: true }), onSuccess: () => { toast.success(text('Đã bật lại dịch vụ.', 'Service restored.')); refresh() }, onError: e => toast.error(errorMessage(e)) })
  if (query.isLoading) return <Loading />
  return <><PageHeader title={text('Danh mục dịch vụ', 'Service catalog')} description={text('Quản lý cả dịch vụ đang bán và tạm ngưng; chỉ dịch vụ đang bán mới xuất hiện khi ghi nhận cho khách.', 'Manage active and paused services. Only active services can be added to a guest stay.')} action={can('service:write') ? <Button onClick={() => setEditing('new')}><Plus size={17}/>{text('Thêm dịch vụ', 'Add service')}</Button> : undefined}/><Card><div className="table-shell"><table className="data-table"><thead><tr><th>{text('Mã', 'Code')}</th><th>{text('Dịch vụ', 'Service')}</th><th>{text('Nhóm', 'Category')}</th><th>{text('Đơn giá', 'Unit price')}</th><th>{text('Thuế', 'Tax')}</th><th>{text('Trạng thái', 'Status')}</th><th></th></tr></thead><tbody>{query.data?.map(item => <tr key={item.id} className={item.active ? '' : 'bg-slate-50/70'}><td className="font-bold">{item.code}</td><td>{catalogName(item.code, item.name, language)}<div className="text-xs text-ink-soft">/{catalogUnit(item.code, item.unit, language)}</div>{item.description && <div className="mt-1 max-w-sm text-xs text-ink-soft">{catalogDescription(item.code, item.description, language)}</div>}</td><td>{serviceCategoryLabel(item.category, language)}</td><td>{money(Number(item.unitPrice), item.currency)}</td><td>{item.taxRate}%</td><td><Badge tone={statusTone(item.active ? 'ACTIVE' : 'INACTIVE')}>{item.active ? text('Đang bán', 'Active') : text('Tạm ngưng', 'Paused')}</Badge></td><td><div className="flex justify-end gap-1">{can('service:write') && <>{!item.active && <button aria-label={`${text('Bật lại', 'Restore')} ${catalogName(item.code, item.name, language)}`} title={text('Bật lại dịch vụ', 'Restore service')} className="rounded-lg p-2 text-emerald-700 hover:bg-emerald-50" disabled={restore.isPending} onClick={() => restore.mutate(item)}><RotateCcw size={17}/></button>}<button aria-label={`${text('Sửa', 'Edit')} ${catalogName(item.code, item.name, language)}`} className="rounded-lg p-2 hover:bg-slate-100" onClick={() => setEditing(item)}><Pencil size={17}/></button>{item.active && <button aria-label={`${text('Tạm ngưng', 'Pause')} ${catalogName(item.code, item.name, language)}`} className="rounded-lg p-2 text-amber-700 hover:bg-amber-50" onClick={() => setDeleting(item)}><CirclePause size={17}/></button>}</>}</div></td></tr>)}</tbody></table>{!query.data?.length && <Empty/>}</div></Card>{editing && <ServiceModal service={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); refresh() }}/>} {deleting && <ConfirmDialog title={text('Tạm ngưng dịch vụ?', 'Pause this service?')} description={text(`Dịch vụ “${deleting.name}” sẽ không thể được thêm vào lượt lưu trú mới, nhưng dữ liệu đã phát sinh vẫn được giữ và bạn có thể bật lại bất cứ lúc nào.`, `“${catalogName(deleting.code, deleting.name, language)}” cannot be added to new stays while paused. Existing transactions remain intact and the service can be restored at any time.`)} confirmLabel={text('Tạm ngưng', 'Pause service')} loading={remove.isPending} onCancel={() => setDeleting(null)} onConfirm={() => remove.mutate(deleting.id)}/>}</>
}

function ServiceModal({ service, onClose, onSaved }: { service?: HotelService; onClose: () => void; onSaved: () => void }) {
  const { text } = useI18n()
  const [form, setForm] = useState<Form>(service ? { code: service.code, name: service.name, category: service.category, description: service.description ?? '', unit: service.unit, unitPrice: Number(service.unitPrice), taxRate: Number(service.taxRate), currency: service.currency, active: service.active } : blank)
  const mutation = useMutation({ mutationFn: () => service ? api.put(`/services/${service.id}`, form) : api.post('/services', form), onSuccess: () => { toast.success(text('Đã lưu dịch vụ.', 'Service saved.')); onSaved() }, onError: e => toast.error(errorMessage(e)) })
  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm(prev => ({ ...prev, [key]: value }))
  return <Modal title={service ? text('Cập nhật dịch vụ', 'Update service') : text('Thêm dịch vụ', 'Add service')} onClose={onClose}><div className="grid gap-4 sm:grid-cols-2"><label><span className="label">{text('Mã dịch vụ', 'Service code')}</span><input className="field" value={form.code} onChange={e => set('code', e.target.value.toUpperCase())}/></label><label><span className="label">{text('Tên dịch vụ', 'Service name')}</span><input className="field" value={form.name} onChange={e => set('name', e.target.value)}/></label><label><span className="label">{text('Nhóm', 'Category')}</span><input className="field" value={form.category} onChange={e => set('category', e.target.value.toUpperCase())}/></label><label><span className="label">{text('Đơn vị', 'Unit')}</span><input className="field" value={form.unit} onChange={e => set('unit', e.target.value)}/></label><label><span className="label">{text('Đơn giá', 'Unit price')}</span><input type="number" min={0} className="field" value={form.unitPrice} onChange={e => set('unitPrice', Number(e.target.value))}/></label><label><span className="label">{text('Thuế (%)', 'Tax (%)')}</span><input type="number" min={0} max={100} className="field" value={form.taxRate} onChange={e => set('taxRate', Number(e.target.value))}/></label><label className="sm:col-span-2"><span className="label">{text('Mô tả', 'Description')}</span><textarea className="field" value={form.description} onChange={e => set('description', e.target.value)}/></label><label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={form.active} onChange={e => set('active', e.target.checked)}/>{text('Đang kinh doanh', 'Active')}</label></div><div className="mt-6 flex justify-end gap-3"><Button variant="secondary" onClick={onClose}>{text('Đóng', 'Close')}</Button><Button disabled={!form.code || !form.name || !form.category || !form.unit} loading={mutation.isPending} onClick={() => mutation.mutate()}>{text('Lưu dịch vụ', 'Save service')}</Button></div></Modal>
}
