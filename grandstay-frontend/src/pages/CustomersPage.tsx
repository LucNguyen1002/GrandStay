import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Eye, IdCard, Pencil, Plus, Search, ShieldCheck, Trash2, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { api, errorMessage } from '../api/client'
import type { Customer, CustomerProfile, Page } from '../api/types'
import { Badge, Button, Card, ConfirmDialog, Empty, Loading, Modal, PageHeader, Pagination } from '../components/ui'
import { useAuth } from '../auth/AuthProvider'
import { useI18n } from '../i18n'

type CustomerForm = { customerCode: string; fullName: string; email: string; phone: string; nationality: string; dateOfBirth: string; gender: string; address: string; notes: string }
const empty: CustomerForm = { customerCode: '', fullName: '', email: '', phone: '', nationality: 'VN', dateOfBirth: '', gender: '', address: '', notes: '' }

export function CustomersPage() {
  const { text } = useI18n()
  const [page, setPage] = useState(0)
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<Customer | 'new' | null>(null)
  const [deleting, setDeleting] = useState<Customer | null>(null)
  const [identifying, setIdentifying] = useState<Customer | null>(null)
  const { can } = useAuth()
  const client = useQueryClient()
  const query = useQuery({ queryKey: ['customers', page, search], queryFn: () => api.get<Page<Customer>>('/customers', { params: { page, size: 20, search: search || undefined } }).then(r => r.data) })
  const remove = useMutation({ mutationFn: (id: string) => api.delete(`/customers/${id}`), onSuccess: () => { toast.success(text('Đã xóa hồ sơ khách hàng.', 'Guest profile removed.')); setDeleting(null); client.invalidateQueries({ queryKey: ['customers'] }) }, onError: e => toast.error(errorMessage(e)) })
  if (query.isLoading) return <Loading />
  return <>
    <PageHeader title={text('Khách hàng', 'Guests')} description={text('Hồ sơ nhận diện, liên hệ và lịch sử phục vụ của khách.', 'Guest identity, contact details and service history.')} action={can('booking:write') ? <Button onClick={() => setEditing('new')}><Plus size={17}/>{text('Thêm khách hàng', 'Add guest')}</Button> : undefined}/>
    <Card><div className="relative mb-5 max-w-lg"><Search className="field-icon" size={18} aria-hidden="true"/><input className="field field-with-icon" aria-label={text('Tìm khách hàng', 'Search guests')} placeholder={text('Tìm theo tên, mã, email hoặc số điện thoại…', 'Search by name, code, email or phone…')} value={search} onChange={e => { setSearch(e.target.value); setPage(0) }}/></div>
      <div className="table-shell"><table className="data-table"><thead><tr><th>{text('Mã khách', 'Guest code')}</th><th>{text('Họ tên', 'Full name')}</th><th>{text('Liên hệ', 'Contact')}</th><th>{text('Quốc tịch', 'Nationality')}</th><th></th></tr></thead><tbody>{query.data?.content.map(customer => <tr key={customer.id}><td className="font-bold">{customer.customerCode}</td><td>{customer.fullName}</td><td><div>{customer.phone || '—'}</div><div className="text-xs text-ink-soft">{customer.email}</div></td><td>{customer.nationality || '—'}</td><td><div className="flex justify-end gap-1">{can('booking:write') && <><button aria-label={text('Xác minh danh tính', 'Verify identity')} title={text('Xác minh danh tính', 'Verify identity')} className="rounded-lg p-2 text-emerald-700 hover:bg-emerald-50" onClick={() => setIdentifying(customer)}><IdCard size={18}/></button><button aria-label={text('Sửa', 'Edit')} className="rounded-lg p-2 hover:bg-slate-100" onClick={() => setEditing(customer)}><Pencil size={17}/></button><button aria-label={text('Xóa', 'Delete')} className="rounded-lg p-2 text-red-600 hover:bg-red-50" onClick={() => setDeleting(customer)}><Trash2 size={17}/></button></>}</div></td></tr>)}</tbody></table>{!query.data?.content.length && <Empty/>}</div><Pagination page={query.data?.number ?? 0} totalPages={query.data?.totalPages ?? 0} onChange={setPage}/>
    </Card>
    {editing && <CustomerModal customer={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); client.invalidateQueries({ queryKey: ['customers'] }) }}/>} 
    {identifying && <IdentityVerificationModal customer={identifying} onClose={() => setIdentifying(null)}/>}
    {deleting && <ConfirmDialog
      title={text('Xóa hồ sơ khách hàng?', 'Remove guest profile?')}
      description={text(`Hồ sơ “${deleting.fullName}” sẽ được ngưng sử dụng và không còn xuất hiện trong danh sách chọn mới.`, `“${deleting.fullName}” will be deactivated and removed from new selections.`)}
      confirmLabel={text('Xóa hồ sơ', 'Remove profile')}
      loading={remove.isPending}
      onCancel={() => setDeleting(null)}
      onConfirm={() => remove.mutate(deleting.id)}
    />}
  </>
}

function CustomerModal({ customer, onClose, onSaved }: { customer?: Customer; onClose: () => void; onSaved: () => void }) {
  const { text } = useI18n()
  const [form, setForm] = useState<CustomerForm>(customer ? { customerCode: customer.customerCode, fullName: customer.fullName, email: customer.email ?? '', phone: customer.phone ?? '', nationality: customer.nationality ?? 'VN', dateOfBirth: customer.dateOfBirth ?? '', gender: customer.gender ?? '', address: '', notes: '' } : empty)
  const mutation = useMutation({ mutationFn: () => (customer ? api.put(`/customers/${customer.id}`, payload(form)) : api.post('/customers', payload(form))), onSuccess: () => { toast.success(customer ? text('Đã cập nhật khách hàng.', 'Guest updated.') : text('Đã tạo khách hàng.', 'Guest created.')); onSaved() }, onError: e => toast.error(errorMessage(e)) })
  const set = (key: keyof CustomerForm, value: string) => setForm(prev => ({ ...prev, [key]: value }))
  return <Modal title={customer ? text('Cập nhật khách hàng', 'Update guest') : text('Thêm khách hàng', 'Add guest')} onClose={onClose}><div className="grid gap-4 sm:grid-cols-2">
    <Field label={text('Mã khách hàng', 'Guest code')}><input className="field" value={form.customerCode} onChange={e => set('customerCode', e.target.value)} maxLength={30}/></Field><Field label={text('Họ và tên', 'Full name')}><input className="field" value={form.fullName} onChange={e => set('fullName', e.target.value)}/></Field>
    <Field label="Email"><input type="email" className="field" value={form.email} onChange={e => set('email', e.target.value)}/></Field><Field label={text('Số điện thoại', 'Phone number')}><input className="field" value={form.phone} onChange={e => set('phone', e.target.value)}/></Field>
    <Field label={text('Quốc tịch (ISO 2 ký tự)', 'Nationality (2-letter ISO code)')}><input className="field uppercase" value={form.nationality} onChange={e => set('nationality', e.target.value.toUpperCase())} maxLength={2}/></Field><Field label={text('Ngày sinh', 'Date of birth')}><input type="date" className="field" value={form.dateOfBirth} onChange={e => set('dateOfBirth', e.target.value)}/></Field>
    <Field label={text('Giới tính', 'Gender')}><select className="field" value={form.gender} onChange={e => set('gender', e.target.value)}><option value="">{text('Không cung cấp', 'Not provided')}</option><option value="MALE">{text('Nam', 'Male')}</option><option value="FEMALE">{text('Nữ', 'Female')}</option><option value="OTHER">{text('Khác', 'Other')}</option></select></Field><Field label={text('Địa chỉ', 'Address')}><input className="field" value={form.address} onChange={e => set('address', e.target.value)}/></Field>
    <label className="sm:col-span-2"><span className="label">{text('Ghi chú', 'Notes')}</span><textarea className="field min-h-20" value={form.notes} onChange={e => set('notes', e.target.value)}/></label>
  </div><div className="mt-6 flex justify-end gap-3"><Button variant="secondary" onClick={onClose}>{text('Đóng', 'Close')}</Button><Button disabled={!form.customerCode.trim() || !form.fullName.trim() || form.nationality.length !== 2} loading={mutation.isPending} onClick={() => mutation.mutate()}>{text('Lưu hồ sơ', 'Save profile')}</Button></div></Modal>
}

function IdentityVerificationModal({ customer, onClose }: { customer: Customer; onClose: () => void }) {
  const { language, text } = useI18n()
  const client = useQueryClient()
  const key = ['customer-profile', customer.id]
  const query = useQuery({ queryKey: key, queryFn: () => api.get<CustomerProfile>(`/customers/${customer.id}/profile`).then(response => response.data) })
  const profile = query.data
  const [identityType, setIdentityType] = useState<'NATIONAL_ID' | 'PASSPORT' | 'OTHER'>('NATIONAL_ID')
  const [identityNumber, setIdentityNumber] = useState('')
  const [rejectionReason, setRejectionReason] = useState('')
  const refreshProfile = (data?: CustomerProfile) => data ? client.setQueryData(key, data) : client.invalidateQueries({ queryKey: key })
  const saveIdentity = useMutation({
    mutationFn: () => api.put<CustomerProfile>(`/customers/${customer.id}/identity`, { type: identityType, number: identityNumber.trim() }).then(response => response.data),
    onSuccess: data => { refreshProfile(data); setIdentityNumber(''); toast.success(text('Đã lưu thông tin giấy tờ dưới dạng mã hóa.', 'Identity document details saved securely.')) },
    onError: error => toast.error(errorMessage(error)),
  })
  const upload = useMutation({
    mutationFn: ({ side, file }: { side: 'FRONT' | 'BACK'; file: File }) => {
      const body = new FormData()
      body.append('file', file)
      return api.put<CustomerProfile>(`/customers/${customer.id}/identity/documents/${side}`, body).then(response => response.data)
    },
    onSuccess: data => { refreshProfile(data); toast.success(text('Đã tải ảnh giấy tờ lên an toàn.', 'Identity image uploaded securely.')) },
    onError: error => toast.error(errorMessage(error)),
  })
  const verification = useMutation({
    mutationFn: ({ approved, reason }: { approved: boolean; reason?: string }) => api.post<CustomerProfile>(`/customers/${customer.id}/identity/verification`, { approved, reason: reason || null }).then(response => response.data),
    onSuccess: data => { refreshProfile(data); setRejectionReason(''); toast.success(data.identityVerificationStatus === 'VERIFIED' ? text('Đã xác minh danh tính khách hàng.', 'Guest identity verified.') : text('Đã từ chối hồ sơ định danh.', 'Identity verification rejected.')) },
    onError: error => toast.error(errorMessage(error)),
  })
  const viewDocument = async (side: 'FRONT' | 'BACK') => {
    try {
      const response = await api.get<Blob>(`/customers/${customer.id}/identity/documents/${side}`, { responseType: 'blob' })
      const url = URL.createObjectURL(response.data)
      window.open(url, '_blank', 'noopener,noreferrer')
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch (error) {
      toast.error(errorMessage(error))
    }
  }
  const verificationLabel = (language === 'vi'
    ? { UNVERIFIED: 'Chưa cung cấp', PENDING: 'Chờ xác minh', VERIFIED: 'Đã xác minh', REJECTED: 'Bị từ chối' }
    : { UNVERIFIED: 'Not provided', PENDING: 'Pending verification', VERIFIED: 'Verified', REJECTED: 'Rejected' }
  )[profile?.identityVerificationStatus ?? 'UNVERIFIED']
  const verificationTone = profile?.identityVerificationStatus === 'VERIFIED' ? 'green' : profile?.identityVerificationStatus === 'REJECTED' ? 'red' : 'gold'

  return <Modal title={`${text('Xác minh danh tính', 'Verify identity')} · ${customer.fullName}`} size="lg" onClose={onClose}>
    {query.isLoading ? <Loading/> : query.error || !profile ? <div role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{errorMessage(query.error)}</div> : <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-slate-50 p-4"><div><span className="text-xs text-ink-soft">{customer.customerCode}</span><p className="font-display text-lg font-bold">{customer.fullName}</p><p className="mt-1 text-sm text-ink-soft">{profile.identityMasked ? `${profile.identityType} · ${profile.identityMasked}` : text('Chưa có giấy tờ định danh', 'No identity document provided')}</p></div><Badge tone={verificationTone}>{verificationLabel}</Badge></div>
      {profile.identityRejectionReason && <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800"><strong>{text('Lý do từ chối:', 'Rejection reason:')}</strong> {profile.identityRejectionReason}</div>}
      <section><h3 className="mb-1 flex items-center gap-2 font-bold"><IdCard size={18}/>1. {text('Thông tin giấy tờ', 'Document details')}</h3><p className="mb-3 text-xs text-ink-soft">{text('Số giấy tờ được mã hóa; giao diện và API chỉ trả về dạng che một phần.', 'Document numbers are encrypted; the interface and API only return masked values.')}</p><div className="grid gap-3 sm:grid-cols-[.7fr_1fr_auto]"><select aria-label={text('Loại giấy tờ', 'Document type')} className="field" value={identityType} onChange={event => setIdentityType(event.target.value as typeof identityType)}><option value="NATIONAL_ID">{text('CCCD Việt Nam', 'Vietnamese national ID')}</option><option value="PASSPORT">{text('Hộ chiếu', 'Passport')}</option><option value="OTHER">{text('Giấy tờ khác', 'Other document')}</option></select><input aria-label={text('Số giấy tờ', 'Document number')} className="field" inputMode={identityType === 'NATIONAL_ID' ? 'numeric' : 'text'} maxLength={30} placeholder={identityType === 'NATIONAL_ID' ? text('Nhập đúng 12 chữ số CCCD', 'Enter the 12-digit national ID') : text('Nhập số giấy tờ', 'Enter document number')} value={identityNumber} onChange={event => setIdentityNumber(event.target.value)}/><Button disabled={identityType === 'NATIONAL_ID' ? !/^\d{12}$/.test(identityNumber) : identityNumber.trim().length < 4} loading={saveIdentity.isPending} onClick={() => saveIdentity.mutate()}>{text('Lưu', 'Save')}</Button></div></section>
      <section className="border-t border-slate-100 pt-5"><h3 className="mb-1 flex items-center gap-2 font-bold"><Upload size={18}/>2. {text('Ảnh đối chiếu', 'Verification images')}</h3><p className="mb-3 text-xs text-ink-soft">{text('Chỉ nhận JPEG/PNG tối đa 2 MB. Ảnh được mã hóa trước khi lưu vào cơ sở dữ liệu.', 'JPEG/PNG only, up to 2 MB. Images are encrypted before being stored.')}</p><div className="grid gap-3 sm:grid-cols-2"><IdentityDocumentControl label={text('Mặt trước', 'Front side')} uploaded={profile.identityFrontUploaded} loading={upload.isPending} onUpload={file => upload.mutate({ side: 'FRONT', file })} onView={() => void viewDocument('FRONT')}/><IdentityDocumentControl label={text('Mặt sau', 'Back side')} uploaded={profile.identityBackUploaded} loading={upload.isPending} onUpload={file => upload.mutate({ side: 'BACK', file })} onView={() => void viewDocument('BACK')}/></div></section>
      <section className="border-t border-slate-100 pt-5"><h3 className="mb-1 flex items-center gap-2 font-bold"><ShieldCheck size={18}/>3. {text('Kết quả xác minh', 'Verification result')}</h3><p className="mb-3 text-xs text-ink-soft">{text('Chỉ duyệt khi thông tin trên ảnh trùng khớp. Khách cần trạng thái “Đã xác minh” trước khi nhận phòng.', 'Approve only when the document images match the profile. The guest must be verified before check-in.')}</p><textarea className="field min-h-20" maxLength={500} placeholder={text('Lý do từ chối (bắt buộc khi từ chối)', 'Rejection reason (required when rejecting)')} value={rejectionReason} onChange={event => setRejectionReason(event.target.value)}/><div className="mt-3 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><Button variant="danger" disabled={rejectionReason.trim().length < 3} loading={verification.isPending} onClick={() => verification.mutate({ approved: false, reason: rejectionReason.trim() })}>{text('Từ chối hồ sơ', 'Reject')}</Button><Button disabled={!profile.identityMasked || !profile.identityFrontUploaded || (profile.identityType === 'NATIONAL_ID' && !profile.identityBackUploaded)} loading={verification.isPending} onClick={() => verification.mutate({ approved: true })}><ShieldCheck size={16}/>{text('Duyệt danh tính', 'Approve identity')}</Button></div></section>
    </div>}
  </Modal>
}

function IdentityDocumentControl({ label, uploaded, loading, onUpload, onView }: { label: string; uploaded: boolean; loading: boolean; onUpload: (file: File) => void; onView: () => void }) {
  const { text } = useI18n()
  return <div className={`rounded-2xl border p-4 ${uploaded ? 'border-emerald-200 bg-emerald-50/50' : 'border-dashed border-slate-300'}`}><div className="flex items-center justify-between gap-2"><div><strong className="text-sm">{label}</strong><p className="mt-1 text-xs text-ink-soft">{uploaded ? text('Đã tải lên', 'Uploaded') : text('Chưa có ảnh', 'No image')}</p></div>{uploaded && <button type="button" className="rounded-lg p-2 text-emerald-800 hover:bg-emerald-100" aria-label={`${text('Xem', 'View')} ${label.toLowerCase()}`} onClick={onView}><Eye size={18}/></button>}</div><label className={`mt-3 flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold transition hover:border-gold ${loading ? 'pointer-events-none opacity-60' : ''}`}><Upload size={15}/>{uploaded ? text('Thay ảnh', 'Replace image') : text('Chọn ảnh', 'Choose image')}<input className="sr-only" type="file" accept="image/jpeg,image/png" onChange={event => { const file = event.target.files?.[0]; if (file) onUpload(file); event.currentTarget.value = '' }}/></label></div>
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label><span className="label">{label}</span>{children}</label> }
function payload(form: CustomerForm) { return Object.fromEntries(Object.entries(form).map(([key, value]) => [key, value || null])) }
