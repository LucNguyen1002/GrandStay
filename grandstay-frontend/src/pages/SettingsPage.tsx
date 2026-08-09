import { useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Camera, Check, Circle, ExternalLink, Eye, EyeOff, ImageUp, KeyRound, LockKeyhole, LogOut, ShieldCheck, Trash2 } from 'lucide-react'
import { useAuth } from '../auth/AuthProvider'
import { api, errorMessage } from '../api/client'
import { Badge, Button, Card, ConfirmDialog, Modal, PageHeader } from '../components/ui'
import { UserAvatar } from '../components/UserAvatar'
import { notifyAvatarChanged } from '../profile/avatar-events'
import { prepareAvatar, type PreparedAvatar } from '../profile/avatar-image'

const MIN_PASSWORD_LENGTH = 12
const MAX_PASSWORD_LENGTH = 72
export function SettingsPage() {
  const { user, logout } = useAuth()
  const [changingPassword, setChangingPassword] = useState(false)
  const [confirmingAvatarDelete, setConfirmingAvatarDelete] = useState(false)
  const [optimizingAvatar, setOptimizingAvatar] = useState(false)
  const avatarInput = useRef<HTMLInputElement>(null)
  const avatarMutation = useMutation({
    mutationFn: async ({ file }: PreparedAvatar) => {
      const form = new FormData()
      form.append('file', file)
      await api.put('/users/me/avatar', form)
    },
    onSuccess: (_, prepared) => {
      if (user?.sub) notifyAvatarChanged(user.sub)
      toast.success(prepared.optimized ? 'Đã tự động tối ưu và cập nhật ảnh đại diện.' : 'Đã cập nhật ảnh đại diện.')
    },
    onError: error => toast.error(errorMessage(error)),
  })
  const deleteAvatarMutation = useMutation({
    mutationFn: () => api.delete('/users/me/avatar'),
    onSuccess: () => {
      if (user?.sub) notifyAvatarChanged(user.sub)
      setConfirmingAvatarDelete(false)
      toast.success('Đã xóa ảnh đại diện.')
    },
    onError: error => toast.error(errorMessage(error)),
  })
  const avatarBusy = optimizingAvatar || avatarMutation.isPending || deleteAvatarMutation.isPending

  const selectAvatar = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setOptimizingAvatar(true)
    try {
      avatarMutation.mutate(await prepareAvatar(file))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không thể xử lý ảnh đã chọn.')
    } finally {
      setOptimizingAvatar(false)
    }
  }

  return <>
    <PageHeader title="Thiết lập & tài khoản" description="Quản lý hồ sơ, phiên đăng nhập và các tùy chọn bảo mật cá nhân." />
    <div className="grid gap-5 lg:grid-cols-2">
      <Card>
        <div className="flex flex-col gap-4 rounded-2xl bg-slate-50/80 p-4 sm:flex-row sm:items-center">
          <div className="relative w-fit">
            <UserAvatar userId={user?.sub} name={user?.name ?? user?.username} className="size-20 rounded-2xl text-2xl" />
            <button type="button" aria-label="Chọn ảnh đại diện" title="Chọn ảnh đại diện" disabled={avatarBusy} onClick={() => avatarInput.current?.click()} className="absolute -bottom-2 -right-2 grid size-9 place-items-center rounded-xl border-2 border-white bg-ink text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-forest disabled:cursor-not-allowed disabled:opacity-60">
              <Camera size={16}/>
            </button>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2"><h2 className="truncate font-display text-xl font-bold">{user?.name ?? user?.username}</h2><Badge tone="green">Đang hoạt động</Badge></div>
            <p className="text-sm text-ink-soft">@{user?.username}</p>
            <p className="mt-2 text-xs leading-5 text-slate-500">JPEG/PNG tối đa 15 MB; ảnh lớn sẽ được tự động thu nhỏ và tối ưu.</p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2 sm:flex-col">
            <Button variant="secondary" loading={optimizingAvatar || avatarMutation.isPending} disabled={avatarBusy} onClick={() => avatarInput.current?.click()}><ImageUp size={16}/>{optimizingAvatar ? 'Đang tối ưu' : 'Chọn ảnh'}</Button>
            <Button variant="secondary" disabled={avatarBusy} className="text-red-700" onClick={() => setConfirmingAvatarDelete(true)}><Trash2 size={16}/>Xóa ảnh</Button>
          </div>
          <input ref={avatarInput} type="file" accept="image/jpeg,image/png" className="sr-only" aria-label="Tải ảnh đại diện lên" onChange={selectAvatar} />
        </div>
        <dl className="mt-6 grid gap-3 text-sm">
          <div className="flex justify-between gap-4 border-t border-slate-100 pt-3"><dt className="text-ink-soft">Vai trò</dt><dd className="text-right font-semibold">{user?.roles?.join(', ')}</dd></div>
          <div className="flex justify-between gap-4 border-t border-slate-100 pt-3"><dt className="text-ink-soft">Quyền được cấp</dt><dd className="font-semibold">{user?.permissions?.length ?? 0} quyền</dd></div>
          <div className="flex justify-between gap-4 border-t border-slate-100 pt-3"><dt className="text-ink-soft">Bảo mật</dt><dd className="flex items-center gap-1 font-semibold text-emerald-700"><ShieldCheck size={16}/>JWT đang hoạt động</dd></div>
        </dl>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button variant="secondary" onClick={() => setChangingPassword(true)}><KeyRound size={16}/>Đổi mật khẩu</Button>
          <Button variant="secondary" onClick={() => void logout(false)}><LogOut size={16}/>Đăng xuất thiết bị này</Button>
          <Button variant="danger" onClick={() => void logout(true)}>Đăng xuất mọi thiết bị</Button>
        </div>
      </Card>

      <Card>
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-700"><LockKeyhole size={19}/></span>
          <div><h2 className="font-display text-xl font-bold">Bảo mật & tích hợp</h2><p className="mt-1 text-sm leading-6 text-ink-soft">Phiên đăng nhập được bảo vệ bằng access token ngắn hạn và refresh token có cơ chế xoay vòng.</p></div>
        </div>
        <a href="/swagger-ui.html" target="_blank" rel="noreferrer" className="mt-5 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold transition hover:-translate-y-0.5 hover:border-gold hover:text-gold hover:shadow-sm"><ExternalLink size={16}/>Mở tài liệu OpenAPI</a>
        <div className="mt-6 rounded-2xl bg-slate-50 p-4 text-xs leading-6 text-ink-soft">
          <div><strong>API:</strong> {import.meta.env.VITE_API_URL ?? '/api/v1'}</div>
          <div><strong>Múi giờ nghiệp vụ:</strong> Asia/Ho_Chi_Minh</div>
          <div><strong>Đơn vị tiền mặc định:</strong> VND</div>
        </div>
      </Card>
    </div>
    {changingPassword && <ChangePasswordModal onClose={() => setChangingPassword(false)} onComplete={() => void logout(false)} />}
    {confirmingAvatarDelete && <ConfirmDialog
      title="Xóa ảnh đại diện?"
      description="Ảnh hiện tại sẽ bị xóa khỏi tài khoản và được thay bằng chữ cái đại diện mặc định."
      confirmLabel="Xóa ảnh"
      loading={deleteAvatarMutation.isPending}
      onCancel={() => setConfirmingAvatarDelete(false)}
      onConfirm={() => deleteAvatarMutation.mutate()}
    />}
  </>
}

function ChangePasswordModal({ onClose, onComplete }: { onClose: () => void; onComplete: () => void }) {
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })
  const [attempted, setAttempted] = useState(false)
  const mutation = useMutation({
    mutationFn: () => api.post('/auth/change-password', { currentPassword: form.currentPassword, newPassword: form.newPassword }),
    onSuccess: () => {
      toast.success('Đã đổi mật khẩu. Vui lòng đăng nhập lại bằng mật khẩu mới.')
      onComplete()
    },
  })

  const lengthValid = form.newPassword.length >= MIN_PASSWORD_LENGTH && form.newPassword.length <= MAX_PASSWORD_LENGTH
  const different = Boolean(form.newPassword) && form.newPassword !== form.currentPassword
  const matches = Boolean(form.confirmPassword) && form.newPassword === form.confirmPassword
  const valid = Boolean(form.currentPassword) && lengthValid && different && matches
  const charactersNeeded = Math.max(0, MIN_PASSWORD_LENGTH - form.newPassword.length)

  const set = (key: keyof typeof form, value: string) => {
    mutation.reset()
    setForm(previous => ({ ...previous, [key]: value }))
  }

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setAttempted(true)
    if (valid && !mutation.isPending) mutation.mutate()
  }

  return <Modal title="Đổi mật khẩu" size="md" onClose={onClose}>
    <form onSubmit={submit} noValidate>
      <div className="mb-5 rounded-2xl border border-blue-100 bg-blue-50/70 p-4 text-sm leading-6 text-blue-900">
        Sau khi cập nhật, tất cả phiên đăng nhập cũ sẽ bị thu hồi để bảo vệ tài khoản.
      </div>
      <div className="space-y-4">
        <PasswordField
          id="current-password"
          label="Mật khẩu hiện tại"
          value={form.currentPassword}
          autoComplete="current-password"
          autoFocus
          error={attempted && !form.currentPassword ? 'Vui lòng nhập mật khẩu hiện tại.' : undefined}
          onChange={value => set('currentPassword', value)}
        />
        <PasswordField
          id="new-password"
          label="Mật khẩu mới"
          value={form.newPassword}
          autoComplete="new-password"
          hint={form.newPassword && charactersNeeded > 0 ? `Cần thêm ${charactersNeeded} ký tự.` : `${form.newPassword.length}/${MAX_PASSWORD_LENGTH} ký tự`}
          error={attempted && !lengthValid ? `Mật khẩu phải có từ ${MIN_PASSWORD_LENGTH} đến ${MAX_PASSWORD_LENGTH} ký tự.` : undefined}
          onChange={value => set('newPassword', value)}
        />
        <PasswordField
          id="confirm-password"
          label="Nhập lại mật khẩu mới"
          value={form.confirmPassword}
          autoComplete="new-password"
          error={(attempted || form.confirmPassword.length > 0) && !matches ? 'Mật khẩu xác nhận chưa khớp.' : undefined}
          onChange={value => set('confirmPassword', value)}
        />
      </div>

      <div className="mt-5 rounded-2xl bg-slate-50 p-4">
        <p className="mb-3 text-xs font-extrabold uppercase tracking-wider text-ink-soft">Điều kiện mật khẩu</p>
        <div className="grid gap-2 text-sm sm:grid-cols-2">
          <PasswordRule met={lengthValid}>Từ 12 đến 72 ký tự</PasswordRule>
          <PasswordRule met={different}>Khác mật khẩu hiện tại</PasswordRule>
          <PasswordRule met={matches}>Hai lần nhập trùng khớp</PasswordRule>
        </div>
      </div>

      {mutation.error && <div role="alert" className="form-error mt-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{errorMessage(mutation.error)}</div>}

      <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={onClose} disabled={mutation.isPending}>Đóng</Button>
        <Button type="submit" disabled={!valid} loading={mutation.isPending} title={!valid ? 'Hoàn tất các điều kiện mật khẩu trước khi cập nhật' : undefined}>Cập nhật mật khẩu</Button>
      </div>
    </form>
  </Modal>
}

function PasswordField({ id, label, value, onChange, autoComplete, autoFocus = false, hint, error }: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  autoComplete: string
  autoFocus?: boolean
  hint?: string
  error?: string
}) {
  const [visible, setVisible] = useState(false)
  const messageId = `${id}-message`
  return <div className="block">
    <label className="label" htmlFor={id}>{label}</label>
    <div className="relative">
      <input
        id={id}
        type={visible ? 'text' : 'password'}
        className={`field field-with-action ${error ? 'field-error' : ''}`}
        value={value}
        maxLength={MAX_PASSWORD_LENGTH}
        autoComplete={autoComplete}
        autoFocus={autoFocus}
        aria-invalid={Boolean(error)}
        aria-describedby={(error || hint) ? messageId : undefined}
        onChange={event => onChange(event.target.value)}
      />
      <button type="button" className="field-action" aria-label={visible ? `Ẩn ${label.toLowerCase()}` : `Hiện ${label.toLowerCase()}`} onClick={() => setVisible(previous => !previous)}>
        {visible ? <EyeOff size={18}/> : <Eye size={18}/>} 
      </button>
    </div>
    {(error || hint) && <small id={messageId} className={`mt-1.5 block text-xs ${error ? 'text-red-700' : 'text-ink-soft'}`}>{error ?? hint}</small>}
  </div>
}

function PasswordRule({ met, children }: { met: boolean; children: string }) {
  return <div className={`flex items-center gap-2 transition-colors ${met ? 'text-emerald-700' : 'text-slate-500'}`}>
    {met ? <Check size={16} strokeWidth={3}/> : <Circle size={14}/>}<span>{children}</span>
  </div>
}
