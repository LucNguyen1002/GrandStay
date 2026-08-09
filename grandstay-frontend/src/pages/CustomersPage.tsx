import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { api, errorMessage } from '../api/client'
import type { Customer, Page } from '../api/types'
import { Button, Card, ConfirmDialog, Empty, Loading, Modal, PageHeader, Pagination } from '../components/ui'
import { useAuth } from '../auth/AuthProvider'

type CustomerForm = { customerCode: string; fullName: string; email: string; phone: string; nationality: string; dateOfBirth: string; gender: string; address: string; notes: string }
const empty: CustomerForm = { customerCode: '', fullName: '', email: '', phone: '', nationality: 'VN', dateOfBirth: '', gender: '', address: '', notes: '' }

export function CustomersPage() {
  const [page, setPage] = useState(0)
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<Customer | 'new' | null>(null)
  const [deleting, setDeleting] = useState<Customer | null>(null)
  const { can } = useAuth()
  const client = useQueryClient()
  const query = useQuery({ queryKey: ['customers', page, search], queryFn: () => api.get<Page<Customer>>('/customers', { params: { page, size: 20, search: search || undefined } }).then(r => r.data) })
  const remove = useMutation({ mutationFn: (id: string) => api.delete(`/customers/${id}`), onSuccess: () => { toast.success('Đã xóa hồ sơ khách hàng.'); setDeleting(null); client.invalidateQueries({ queryKey: ['customers'] }) }, onError: e => toast.error(errorMessage(e)) })
  if (query.isLoading) return <Loading />
  return <>
    <PageHeader title="Khách hàng" description="Hồ sơ nhận diện, liên hệ và lịch sử phục vụ của khách." action={can('booking:write') ? <Button onClick={() => setEditing('new')}><Plus size={17}/>Thêm khách hàng</Button> : undefined}/>
    <Card><div className="relative mb-5 max-w-lg"><Search className="field-icon" size={18} aria-hidden="true"/><input className="field field-with-icon" aria-label="Tìm khách hàng" placeholder="Tìm theo tên, mã, email hoặc số điện thoại…" value={search} onChange={e => { setSearch(e.target.value); setPage(0) }}/></div>
      <div className="table-shell"><table className="data-table"><thead><tr><th>Mã khách</th><th>Họ tên</th><th>Liên hệ</th><th>Quốc tịch</th><th></th></tr></thead><tbody>{query.data?.content.map(customer => <tr key={customer.id}><td className="font-bold">{customer.customerCode}</td><td>{customer.fullName}</td><td><div>{customer.phone || '—'}</div><div className="text-xs text-ink-soft">{customer.email}</div></td><td>{customer.nationality || '—'}</td><td><div className="flex justify-end gap-1">{can('booking:write') && <><button aria-label="Sửa" className="rounded-lg p-2 hover:bg-slate-100" onClick={() => setEditing(customer)}><Pencil size={17}/></button><button aria-label="Xóa" className="rounded-lg p-2 text-red-600 hover:bg-red-50" onClick={() => setDeleting(customer)}><Trash2 size={17}/></button></>}</div></td></tr>)}</tbody></table>{!query.data?.content.length && <Empty/>}</div><Pagination page={query.data?.number ?? 0} totalPages={query.data?.totalPages ?? 0} onChange={setPage}/>
    </Card>
    {editing && <CustomerModal customer={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); client.invalidateQueries({ queryKey: ['customers'] }) }}/>} 
    {deleting && <ConfirmDialog title="Xóa hồ sơ khách hàng?" description={`Hồ sơ “${deleting.fullName}” sẽ được ngưng sử dụng và không còn xuất hiện trong danh sách chọn mới.`} confirmLabel="Xóa hồ sơ" loading={remove.isPending} onCancel={() => setDeleting(null)} onConfirm={() => remove.mutate(deleting.id)}/>} 
  </>
}

function CustomerModal({ customer, onClose, onSaved }: { customer?: Customer; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<CustomerForm>(customer ? { customerCode: customer.customerCode, fullName: customer.fullName, email: customer.email ?? '', phone: customer.phone ?? '', nationality: customer.nationality ?? 'VN', dateOfBirth: customer.dateOfBirth ?? '', gender: customer.gender ?? '', address: '', notes: '' } : empty)
  const mutation = useMutation({ mutationFn: () => (customer ? api.put(`/customers/${customer.id}`, payload(form)) : api.post('/customers', payload(form))), onSuccess: () => { toast.success(customer ? 'Đã cập nhật khách hàng.' : 'Đã tạo khách hàng.'); onSaved() }, onError: e => toast.error(errorMessage(e)) })
  const set = (key: keyof CustomerForm, value: string) => setForm(prev => ({ ...prev, [key]: value }))
  return <Modal title={customer ? 'Cập nhật khách hàng' : 'Thêm khách hàng'} onClose={onClose}><div className="grid gap-4 sm:grid-cols-2">
    <Field label="Mã khách hàng"><input className="field" value={form.customerCode} onChange={e => set('customerCode', e.target.value)} maxLength={30}/></Field><Field label="Họ và tên"><input className="field" value={form.fullName} onChange={e => set('fullName', e.target.value)}/></Field>
    <Field label="Email"><input type="email" className="field" value={form.email} onChange={e => set('email', e.target.value)}/></Field><Field label="Số điện thoại"><input className="field" value={form.phone} onChange={e => set('phone', e.target.value)}/></Field>
    <Field label="Quốc tịch (ISO 2 ký tự)"><input className="field uppercase" value={form.nationality} onChange={e => set('nationality', e.target.value.toUpperCase())} maxLength={2}/></Field><Field label="Ngày sinh"><input type="date" className="field" value={form.dateOfBirth} onChange={e => set('dateOfBirth', e.target.value)}/></Field>
    <Field label="Giới tính"><select className="field" value={form.gender} onChange={e => set('gender', e.target.value)}><option value="">Không cung cấp</option><option value="MALE">Nam</option><option value="FEMALE">Nữ</option><option value="OTHER">Khác</option></select></Field><Field label="Địa chỉ"><input className="field" value={form.address} onChange={e => set('address', e.target.value)}/></Field>
    <label className="sm:col-span-2"><span className="label">Ghi chú</span><textarea className="field min-h-20" value={form.notes} onChange={e => set('notes', e.target.value)}/></label>
  </div><div className="mt-6 flex justify-end gap-3"><Button variant="secondary" onClick={onClose}>Đóng</Button><Button disabled={!form.customerCode.trim() || !form.fullName.trim() || form.nationality.length !== 2} loading={mutation.isPending} onClick={() => mutation.mutate()}>Lưu hồ sơ</Button></div></Modal>
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label><span className="label">{label}</span>{children}</label> }
function payload(form: CustomerForm) { return Object.fromEntries(Object.entries(form).map(([key, value]) => [key, value || null])) }
