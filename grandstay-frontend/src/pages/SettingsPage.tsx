import { useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Camera, Check, Circle, Eye, EyeOff, FileBadge2, ImageUp, KeyRound, LogOut, Save, Trash2, Upload, UserRound } from 'lucide-react'
import { useAuth } from '../auth/AuthProvider'
import { api, errorMessage } from '../api/client'
import type { CustomerProfile } from '../api/types'
import { Badge, Button, Card, ConfirmDialog, Loading, Modal, PageHeader, statusTone } from '../components/ui'
import { UserAvatar } from '../components/UserAvatar'
import { notifyAvatarChanged } from '../profile/avatar-events'
import { prepareAvatar, type PreparedAvatar } from '../profile/avatar-image'
import { useI18n } from '../i18n'

const MIN_PASSWORD_LENGTH = 12
const MAX_PASSWORD_LENGTH = 72

export function SettingsPage() {
  const { user, logout, hasRole } = useAuth()
  const { language, t, text } = useI18n()
  const customer = hasRole('CUSTOMER')
  const [changingPassword, setChangingPassword] = useState(false)
  const [confirmingAvatarDelete, setConfirmingAvatarDelete] = useState(false)
  const [optimizingAvatar, setOptimizingAvatar] = useState(false)
  const avatarInput = useRef<HTMLInputElement>(null)
  const avatarMutation = useMutation({
    mutationFn: async ({ file }: PreparedAvatar) => {
      const form = new FormData(); form.append('file', file); await api.put('/users/me/avatar', form)
    },
    onSuccess: (_, prepared) => {
      if (user?.sub) notifyAvatarChanged(user.sub)
      toast.success(prepared.optimized ? (language === 'vi' ? 'Đã tối ưu và cập nhật ảnh đại diện.' : 'Avatar optimized and updated.') : (language === 'vi' ? 'Đã cập nhật ảnh đại diện.' : 'Avatar updated.'))
    },
    onError: error => toast.error(errorMessage(error)),
  })
  const deleteAvatarMutation = useMutation({
    mutationFn: () => api.delete('/users/me/avatar'),
    onSuccess: () => {
      if (user?.sub) notifyAvatarChanged(user.sub)
      setConfirmingAvatarDelete(false)
      toast.success(language === 'vi' ? 'Đã xóa ảnh đại diện.' : 'Avatar removed.')
    },
    onError: error => toast.error(errorMessage(error)),
  })
  const avatarBusy = optimizingAvatar || avatarMutation.isPending || deleteAvatarMutation.isPending

  const selectAvatar = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; event.target.value = ''
    if (!file) return
    setOptimizingAvatar(true)
    try { avatarMutation.mutate(await prepareAvatar(file)) }
    catch (error) { toast.error(error instanceof Error ? error.message : (language === 'vi' ? 'Không thể xử lý ảnh đã chọn.' : 'Could not process the selected image.')) }
    finally { setOptimizingAvatar(false) }
  }

  return <>
    <PageHeader title={customer ? t('profile.title') : t('nav.settings')} description={customer ? t('profile.description') : (language === 'vi' ? 'Quản lý ảnh đại diện, mật khẩu và phiên đăng nhập.' : 'Manage your avatar, password and sign-in sessions.')} />
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(280px,.72fr)_minmax(0,1.28fr)]">
      <Card>
        <div className="flex flex-col gap-4 rounded-2xl bg-slate-50/80 p-4 sm:flex-row sm:items-center">
          <div className="relative w-fit">
            <UserAvatar userId={user?.sub} name={user?.name ?? user?.username} className="size-20 rounded-2xl text-2xl" />
            <button type="button" aria-label={text('Chọn ảnh đại diện', 'Choose avatar')} disabled={avatarBusy} onClick={() => avatarInput.current?.click()} className="absolute -bottom-2 -right-2 grid size-9 place-items-center rounded-xl border-2 border-white bg-ink text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-forest disabled:opacity-60"><Camera size={16}/></button>
          </div>
          <div className="min-w-0 flex-1"><h2 className="truncate font-display text-xl font-bold">{user?.name ?? user?.username}</h2><p className="text-sm text-ink-soft">@{user?.username}</p><p className="mt-2 text-xs leading-5 text-slate-500">JPEG/PNG · 15 MB</p></div>
          <div className="flex shrink-0 flex-wrap gap-2 sm:flex-col">
            <Button variant="secondary" loading={optimizingAvatar || avatarMutation.isPending} disabled={avatarBusy} onClick={() => avatarInput.current?.click()}><ImageUp size={16}/>{language === 'vi' ? 'Chọn ảnh' : 'Choose image'}</Button>
            <Button variant="secondary" disabled={avatarBusy} className="text-red-700" onClick={() => setConfirmingAvatarDelete(true)}><Trash2 size={16}/>{language === 'vi' ? 'Xóa ảnh' : 'Remove'}</Button>
          </div>
          <input ref={avatarInput} type="file" accept="image/jpeg,image/png" className="sr-only" onChange={selectAvatar} />
        </div>
        <div className="mt-6 flex flex-col gap-3">
          <Button variant="secondary" onClick={() => setChangingPassword(true)}><KeyRound size={16}/>{t('profile.changePassword')}</Button>
          <Button variant="secondary" onClick={() => void logout(false)}><LogOut size={16}/>{t('profile.logoutDevice')}</Button>
          <Button variant="danger" onClick={() => void logout(true)}>{t('profile.logoutAll')}</Button>
        </div>
      </Card>
      {customer ? <CustomerProfileSection /> : <Card><div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-700"><UserRound size={19}/></span><div><h2 className="font-display text-xl font-bold">{language === 'vi' ? 'Thông tin tài khoản' : 'Account information'}</h2><p className="mt-1 text-sm text-ink-soft">{user?.name} · @{user?.username}</p></div></div></Card>}
    </div>
    {changingPassword && <ChangePasswordModal onClose={() => setChangingPassword(false)} onComplete={() => void logout(false)} />}
    {confirmingAvatarDelete && <ConfirmDialog title={language === 'vi' ? 'Xóa ảnh đại diện?' : 'Remove avatar?'} description={language === 'vi' ? 'Ảnh hiện tại sẽ được thay bằng chữ cái đại diện mặc định.' : 'Your current image will be replaced by the default initial.'} confirmLabel={language === 'vi' ? 'Xóa ảnh' : 'Remove'} loading={deleteAvatarMutation.isPending} onCancel={() => setConfirmingAvatarDelete(false)} onConfirm={() => deleteAvatarMutation.mutate()}/>}
  </>
}

function CustomerProfileSection() {
  const query = useQuery({ queryKey: ['self-profile'], queryFn: () => api.get<CustomerProfile>('/self/profile').then(response => response.data) })
  if (query.isLoading) return <Card><Loading /></Card>
  if (!query.data) return <Card><div role="alert" className="text-red-700">{errorMessage(query.error)}</div></Card>
  return <CustomerProfileEditor key={query.data.version} profile={query.data}/>
}

function CustomerProfileEditor({ profile }: { profile: CustomerProfile }) {
  const { language, t, text } = useI18n()
  const client = useQueryClient()
  const [form, setForm] = useState({ fullName: profile.fullName ?? '', email: profile.email ?? '', phone: profile.phone ?? '', nationality: profile.nationality ?? 'VN', dateOfBirth: profile.dateOfBirth ?? '', gender: profile.gender ?? '', address: profile.address ?? '' })
  const [identity, setIdentity] = useState({ type: profile.identityType ?? 'NATIONAL_ID', number: '' })
  const save = useMutation({
    mutationFn: () => api.put<CustomerProfile>('/self/profile', { ...form, phone: form.phone || null, nationality: form.nationality || null, dateOfBirth: form.dateOfBirth || null, gender: form.gender || null, address: form.address || null }),
    onSuccess: data => { client.setQueryData(['self-profile'], data.data); toast.success(t('profile.saved')) },
    onError: error => toast.error(errorMessage(error)),
  })
  const saveIdentity = useMutation({
    mutationFn: () => api.put<CustomerProfile>('/self/profile/identity', { type: identity.type, number: identity.number }),
    onSuccess: data => { client.setQueryData(['self-profile'], data.data); setIdentity(previous => ({ ...previous, number: '' })); toast.success(t('profile.identitySaved')) },
    onError: error => toast.error(errorMessage(error)),
  })
  const upload = useMutation({
    mutationFn: ({ side, file }: { side: 'FRONT' | 'BACK'; file: File }) => { const data = new FormData(); data.append('file', file); return api.put<CustomerProfile>(`/self/profile/identity/documents/${side}`, data) },
    onSuccess: data => { client.setQueryData(['self-profile'], data.data); toast.success(language === 'vi' ? 'Đã tải ảnh giấy tờ.' : 'Document image uploaded.') },
    onError: error => toast.error(errorMessage(error)),
  })
  const statuses = { UNVERIFIED: t('profile.unverified'), PENDING: t('profile.pending'), VERIFIED: t('profile.verified'), REJECTED: t('profile.rejected') }
  const set = (key: keyof typeof form, value: string) => setForm(previous => ({ ...previous, [key]: value }))
  const profileValid = form.fullName.trim().length >= 2 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email) && (!form.phone || /^(?:\+84|0)(?:3|5|7|8|9)\d{8}$/.test(form.phone))
  const identityValid = identity.type === 'NATIONAL_ID' ? /^\d{12}$/.test(identity.number.replace(/\s/g, '')) : /^[A-Za-z0-9]{4,30}$/.test(identity.number.replace(/[\s.-]/g, ''))

  return <div className="space-y-5">
    <Card>
      <div className="mb-5 flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-blue-50 text-blue-700"><UserRound size={19}/></span><div><h2 className="font-display text-xl font-bold">{t('profile.contact')}</h2><p className="text-sm text-ink-soft">{profile.customerCode}</p></div></div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label><span className="label">{t('auth.fullName')}</span><input className="field" value={form.fullName} onChange={event => set('fullName', event.target.value)}/></label>
        <label><span className="label">{t('auth.email')}</span><input type="email" className="field" value={form.email} onChange={event => set('email', event.target.value)}/></label>
        <label><span className="label">{t('profile.phone')}</span><input type="tel" className="field" placeholder="0901234567" value={form.phone} onChange={event => set('phone', event.target.value.replace(/[ .-]/g, ''))}/></label>
        <label><span className="label">{t('profile.birthDate')}</span><input type="date" max={new Date().toISOString().slice(0, 10)} className="field" value={form.dateOfBirth} onChange={event => set('dateOfBirth', event.target.value)}/></label>
        <label><span className="label">{t('profile.gender')}</span><select className="field" value={form.gender} onChange={event => set('gender', event.target.value)}><option value="">—</option><option value="MALE">{language === 'vi' ? 'Nam' : 'Male'}</option><option value="FEMALE">{language === 'vi' ? 'Nữ' : 'Female'}</option><option value="OTHER">{language === 'vi' ? 'Khác' : 'Other'}</option></select></label>
        <label><span className="label">{t('profile.nationality')}</span><input className="field uppercase" maxLength={2} value={form.nationality} onChange={event => set('nationality', event.target.value.toUpperCase())}/></label>
        <label className="sm:col-span-2"><span className="label">{t('profile.address')}</span><textarea className="field min-h-24" maxLength={500} value={form.address} onChange={event => set('address', event.target.value)}/></label>
      </div>
      <div className="mt-5 flex justify-end"><Button disabled={!profileValid} loading={save.isPending} onClick={() => save.mutate()}><Save size={16}/>{t('common.save')}</Button></div>
    </Card>
    <Card>
      <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-start"><div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-amber-50 text-amber-700"><FileBadge2 size={20}/></span><div><h2 className="font-display text-xl font-bold">{t('profile.identity')}</h2><p className="text-sm text-ink-soft">{t('profile.identityHint')}</p></div></div><Badge tone={statusTone(profile.identityVerificationStatus)}>{statuses[profile.identityVerificationStatus]}</Badge></div>
      {profile.identityMasked && <div className="mb-4 rounded-xl bg-slate-50 px-4 py-3 font-mono text-sm font-bold">{profile.identityType} · {profile.identityMasked}</div>}
      {profile.identityRejectionReason && <div className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{profile.identityRejectionReason}</div>}
      <div className="grid gap-4 sm:grid-cols-[.75fr_1.25fr]">
        <label><span className="label">{t('profile.identityType')}</span><select className="field" value={identity.type} onChange={event => setIdentity(previous => ({ ...previous, type: event.target.value as typeof identity.type }))}><option value="NATIONAL_ID">{text('CCCD', 'National ID')}</option><option value="PASSPORT">Passport</option><option value="OTHER">{text('Giấy tờ khác', 'Other document')}</option></select></label>
        <label><span className="label">{t('profile.identityNumber')}</span><input className="field uppercase" inputMode={identity.type === 'NATIONAL_ID' ? 'numeric' : 'text'} maxLength={30} value={identity.number} onChange={event => setIdentity(previous => ({ ...previous, number: event.target.value }))}/></label>
      </div>
      <div className="mt-4 flex justify-end"><Button disabled={!identityValid} loading={saveIdentity.isPending} onClick={() => saveIdentity.mutate()}><Save size={16}/>{language === 'vi' ? 'Lưu số giấy tờ' : 'Save document number'}</Button></div>
      <div className="mt-5 grid gap-3 border-t border-slate-100 pt-5 sm:grid-cols-2">
        <IdentityUpload label={language === 'vi' ? 'Mặt trước' : 'Front'} uploaded={profile.identityFrontUploaded} busy={upload.isPending} onFile={file => upload.mutate({ side: 'FRONT', file })}/>
        <IdentityUpload label={language === 'vi' ? 'Mặt sau' : 'Back'} uploaded={profile.identityBackUploaded} busy={upload.isPending} onFile={file => upload.mutate({ side: 'BACK', file })}/>
      </div>
    </Card>
  </div>
}

function IdentityUpload({ label, uploaded, busy, onFile }: { label: string; uploaded: boolean; busy: boolean; onFile: (file: File) => void }) {
  const { text } = useI18n()
  return <label className={`flex min-h-24 cursor-pointer items-center gap-3 rounded-2xl border border-dashed p-4 transition hover:border-gold ${uploaded ? 'border-emerald-300 bg-emerald-50/60' : 'border-slate-300 bg-slate-50'}`}><span className="grid size-10 place-items-center rounded-xl bg-white text-ink shadow-sm"><Upload size={18}/></span><span className="min-w-0 flex-1"><strong className="block">{label}</strong><small className={uploaded ? 'text-emerald-700' : 'text-ink-soft'}>{uploaded ? text('✓ Đã tải lên', '✓ Uploaded') : 'JPEG/PNG · 2 MB'}</small></span><input type="file" accept="image/jpeg,image/png" disabled={busy} className="sr-only" onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; if (file) onFile(file) }}/></label>
}

function ChangePasswordModal({ onClose, onComplete }: { onClose: () => void; onComplete: () => void }) {
  const { language, t, text } = useI18n()
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })
  const [attempted, setAttempted] = useState(false)
  const mutation = useMutation({ mutationFn: () => api.post('/auth/change-password', { currentPassword: form.currentPassword, newPassword: form.newPassword }), onSuccess: () => { toast.success(language === 'vi' ? 'Đã đổi mật khẩu. Vui lòng đăng nhập lại.' : 'Password changed. Please sign in again.'); onComplete() } })
  const rules = {
    length: form.newPassword.length >= MIN_PASSWORD_LENGTH && form.newPassword.length <= MAX_PASSWORD_LENGTH,
    upper: /[A-Z]/.test(form.newPassword), lower: /[a-z]/.test(form.newPassword), number: /\d/.test(form.newPassword), special: /[^A-Za-z0-9]/.test(form.newPassword),
    different: Boolean(form.newPassword) && form.newPassword !== form.currentPassword,
    matches: Boolean(form.confirmPassword) && form.newPassword === form.confirmPassword,
  }
  const valid = Boolean(form.currentPassword) && Object.values(rules).every(Boolean)
  const set = (key: keyof typeof form, value: string) => { mutation.reset(); setForm(previous => ({ ...previous, [key]: value })) }
  const submit = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); setAttempted(true); if (valid && !mutation.isPending) mutation.mutate() }
  return <Modal title={t('profile.changePassword')} size="md" onClose={onClose}>
    <form onSubmit={submit} noValidate>
      <div className="space-y-4">
        <PasswordField id="current-password" label={language === 'vi' ? 'Mật khẩu hiện tại' : 'Current password'} value={form.currentPassword} autoComplete="current-password" autoFocus error={attempted && !form.currentPassword ? t('auth.requiredPassword') : undefined} onChange={value => set('currentPassword', value)}/>
        <PasswordField id="new-password" label={language === 'vi' ? 'Mật khẩu mới' : 'New password'} value={form.newPassword} autoComplete="new-password" onChange={value => set('newPassword', value)}/>
        <PasswordField id="confirm-password" label={t('auth.confirmPassword')} value={form.confirmPassword} autoComplete="new-password" error={(attempted || form.confirmPassword.length > 0) && !rules.matches ? (language === 'vi' ? 'Mật khẩu xác nhận chưa khớp.' : 'Passwords do not match.') : undefined} onChange={value => set('confirmPassword', value)}/>
      </div>
      <div className="mt-5 grid gap-2 rounded-2xl bg-slate-50 p-4 text-sm sm:grid-cols-2">
        <PasswordRule met={rules.length}>{text('12–72 ký tự', '12–72 characters')}</PasswordRule><PasswordRule met={rules.upper}>A–Z</PasswordRule><PasswordRule met={rules.lower}>a–z</PasswordRule><PasswordRule met={rules.number}>0–9</PasswordRule><PasswordRule met={rules.special}>!@#$%</PasswordRule><PasswordRule met={rules.different}>{language === 'vi' ? 'Khác mật khẩu cũ' : 'Different from current'}</PasswordRule>
      </div>
      {mutation.error && <div role="alert" className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{errorMessage(mutation.error)}</div>}
      <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><Button variant="secondary" onClick={onClose}>{t('common.close')}</Button><Button type="submit" disabled={!valid} loading={mutation.isPending}>{t('common.save')}</Button></div>
    </form>
  </Modal>
}

function PasswordField({ id, label, value, onChange, autoComplete, autoFocus = false, error }: { id: string; label: string; value: string; onChange: (value: string) => void; autoComplete: string; autoFocus?: boolean; error?: string }) {
  const [visible, setVisible] = useState(false)
  return <label className="block"><span className="label">{label}</span><div className="relative"><input id={id} type={visible ? 'text' : 'password'} className={`field field-with-action ${error ? 'field-error' : ''}`} value={value} maxLength={MAX_PASSWORD_LENGTH} autoComplete={autoComplete} autoFocus={autoFocus} aria-invalid={Boolean(error)} onChange={event => onChange(event.target.value)}/><button type="button" className="field-action" aria-label={visible ? 'Hide' : 'Show'} onClick={() => setVisible(previous => !previous)}>{visible ? <EyeOff size={18}/> : <Eye size={18}/>}</button></div>{error && <small className="mt-1.5 block text-xs text-red-700">{error}</small>}</label>
}

function PasswordRule({ met, children }: { met: boolean; children: string }) {
  return <div className={`flex items-center gap-2 ${met ? 'text-emerald-700' : 'text-slate-500'}`}>{met ? <Check size={16} strokeWidth={3}/> : <Circle size={14}/>}<span>{children}</span></div>
}
