import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { KeyRound, LockKeyhole, LockOpen, MonitorSmartphone, Pencil, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { api, errorMessage } from '../api/client'
import type { Page, User } from '../api/types'
import { Badge, Button, Card, ConfirmDialog, Empty, ErrorState, Loading, Modal, PageHeader, statusTone } from '../components/ui'
import { useAuth } from '../auth/AuthProvider'
import { useI18n } from '../i18n'

type Form = {
  username: string
  email: string
  fullName: string
  phone: string
  password: string
  status: string
  role: string
}

type ActionKind = 'delete' | 'revoke' | 'lock' | 'unlock'

type UserSession = {
  familyId: string
  startedAt: string
  lastActivityAt: string
  expiresAt: string
  userAgent?: string
  ipAddress?: string
  active: boolean
  revokedAt?: string
  revokeReason?: string
}

const blank: Form = {
  username: '', email: '', fullName: '', phone: '', password: '',
  status: 'ACTIVE', role: 'RECEPTIONIST',
}

export function UsersPage() {
  const { language, text } = useI18n()
  const actionMessages: Record<ActionKind, string> = language === 'vi' ? { delete: 'Đã xóa người dùng.', revoke: 'Đã thu hồi mọi phiên đăng nhập.', lock: 'Đã khóa tài khoản và thu hồi các phiên đăng nhập.', unlock: 'Đã mở khóa tài khoản.' } : { delete: 'User removed.', revoke: 'All sign-in sessions revoked.', lock: 'Account locked and all sessions revoked.', unlock: 'Account unlocked.' }
  const statusLabels: Record<string, string> = language === 'vi' ? { ACTIVE: 'Hoạt động', LOCKED: 'Đã khóa', INACTIVE: 'Ngừng hoạt động' } : { ACTIVE: 'Active', LOCKED: 'Locked', INACTIVE: 'Inactive' }
  const { hasRole, user: currentUser } = useAuth()
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<User | null>(null)
  const [sessions, setSessions] = useState<User | null>(null)
  const [deleting, setDeleting] = useState<User | null>(null)
  const [locking, setLocking] = useState<User | null>(null)
  const client = useQueryClient()
  const query = useQuery({
    queryKey: ['users'],
    enabled: hasRole('ADMIN'),
    queryFn: () => api.get<Page<User>>('/users', { params: { size: 100 } }).then(response => response.data.content),
  })
  const action = useMutation({
    mutationFn: ({ id, kind }: { id: string; kind: ActionKind }) => {
      if (kind === 'delete') return api.delete(`/users/${id}`)
      if (kind === 'revoke') return api.post(`/users/${id}/revoke-sessions`)
      return api.post(`/users/${id}/${kind}`)
    },
    onSuccess: (_, input) => {
      toast.success(actionMessages[input.kind])
      setDeleting(null)
      setLocking(null)
      client.invalidateQueries({ queryKey: ['users'] })
    },
    onError: error => toast.error(errorMessage(error)),
  })

  if (!hasRole('ADMIN')) {
    return <Card><p className="text-sm text-red-700">{text('Chỉ quản trị viên được truy cập chức năng này.', 'Only administrators can access this feature.')}</p></Card>
  }
  if (query.isLoading) return <Loading />

  return <>
    <PageHeader
      title={text('Người dùng & phân quyền', 'Users & access control')}
      description={text('Cấp tài khoản nhân viên, khóa truy cập và kiểm soát phiên đăng nhập.', 'Create staff accounts, lock access and manage sign-in sessions.')}
      action={<Button onClick={() => setCreating(true)}><Plus size={17}/>{text('Tạo người dùng', 'Create user')}</Button>}
    />
    <Card>
      <div className="table-shell">
        <table className="data-table">
          <thead><tr><th>{text('Tài khoản', 'Account')}</th><th>{text('Họ tên', 'Full name')}</th><th>{text('Liên hệ', 'Contact')}</th><th>{text('Trạng thái', 'Status')}</th><th><span className="sr-only">{text('Thao tác', 'Actions')}</span></th></tr></thead>
          <tbody>{query.data?.map(user => {
            const isCurrentUser = user.id === currentUser?.sub
            return <tr key={user.id}>
              <td className="font-bold">
                {user.username}
                {isCurrentUser && <div className="text-xs font-normal text-forest">{text('Tài khoản hiện tại', 'Current account')}</div>}
              </td>
              <td>{user.fullName}</td>
              <td>{user.email}<div className="text-xs text-ink-soft">{user.phone}</div></td>
              <td><Badge tone={statusTone(user.status)}>{statusLabels[user.status] ?? user.status}</Badge></td>
              <td>
                <div className="flex justify-end gap-1">
                  <button type="button" title={text('Xem phiên đăng nhập', 'View sign-in sessions')} aria-label={`${text('Xem phiên của', 'View sessions for')} ${user.username}`} className="rounded-lg p-2 text-blue-700 transition hover:bg-blue-50" onClick={() => setSessions(user)}>
                    <MonitorSmartphone size={17}/>
                  </button>
                  <button type="button" title={text('Sửa tài khoản', 'Edit account')} aria-label={`${text('Sửa tài khoản', 'Edit account')} ${user.username}`} className="rounded-lg p-2 text-slate-700 transition hover:bg-slate-100" onClick={() => setEditing(user)}><Pencil size={17}/></button>
                  {!isCurrentUser && user.status === 'ACTIVE' && <button type="button" title={text('Khóa tài khoản', 'Lock account')} aria-label={`${text('Khóa tài khoản', 'Lock account')} ${user.username}`} disabled={action.isPending} className="rounded-lg p-2 text-red-600 transition hover:bg-red-50 disabled:opacity-50" onClick={() => setLocking(user)}>
                    <LockKeyhole size={17}/>
                  </button>}
                  {!isCurrentUser && user.status === 'LOCKED' && <button type="button" title={text('Mở khóa tài khoản', 'Unlock account')} aria-label={`${text('Mở khóa tài khoản', 'Unlock account')} ${user.username}`} disabled={action.isPending} className="rounded-lg p-2 text-emerald-700 transition hover:bg-emerald-50 disabled:opacity-50" onClick={() => action.mutate({ id: user.id, kind: 'unlock' })}>
                    <LockOpen size={17}/>
                  </button>}
                  {!isCurrentUser && <button type="button" title={text('Xóa người dùng', 'Delete user')} aria-label={`${text('Xóa tài khoản', 'Delete account')} ${user.username}`} disabled={action.isPending} className="rounded-lg p-2 text-red-600 transition hover:bg-red-50 disabled:opacity-50" onClick={() => setDeleting(user)}>
                    <Trash2 size={17}/>
                  </button>}
                </div>
              </td>
            </tr>
          })}</tbody>
        </table>
        {!query.data?.length && <Empty/>}
      </div>
    </Card>

    {creating && <UserModal onClose={() => setCreating(false)} onSaved={() => {
      setCreating(false)
      client.invalidateQueries({ queryKey: ['users'] })
    }}/>} 
    {editing && <UserModal user={editing} isCurrentUser={editing.id === currentUser?.sub} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); client.invalidateQueries({ queryKey: ['users'] }) }}/>} 
    {sessions && <SessionsModal user={sessions} onClose={() => setSessions(null)}/>} 
    {locking && <ConfirmDialog
      title={text('Khóa tài khoản?', 'Lock account?')}
      description={text(`Tài khoản “${locking.username}” sẽ không thể đăng nhập hoặc tiếp tục sử dụng phiên hiện tại. Dữ liệu nghiệp vụ vẫn được giữ nguyên.`, `“${locking.username}” will no longer be able to sign in or use existing sessions. Operational data will be preserved.`)}
      confirmLabel={text('Khóa tài khoản', 'Lock account')}
      loading={action.isPending}
      onCancel={() => setLocking(null)}
      onConfirm={() => action.mutate({ id: locking.id, kind: 'lock' })}
    />}
    {deleting && <ConfirmDialog
      title={text('Xóa tài khoản nhân viên?', 'Delete staff account?')}
      description={text(`Tài khoản “${deleting.username}” sẽ bị vô hiệu hóa và mọi phiên đăng nhập sẽ bị thu hồi. Dữ liệu nghiệp vụ do tài khoản tạo vẫn được giữ lại.`, `“${deleting.username}” will be disabled and all sessions revoked. Operational records created by this account will remain.`)}
      confirmLabel={text('Xóa tài khoản', 'Delete account')}
      loading={action.isPending}
      onCancel={() => setDeleting(null)}
      onConfirm={() => action.mutate({ id: deleting.id, kind: 'delete' })}
    />}
  </>
}

function UserModal({ user, isCurrentUser = false, onClose, onSaved }: { user?: User; isCurrentUser?: boolean; onClose: () => void; onSaved: () => void }) {
  const { text } = useI18n()
  const [form, setForm] = useState<Form>(user ? { username: user.username, email: user.email, fullName: user.fullName, phone: user.phone ?? '', password: '', status: user.status, role: '' } : blank)
  const roles = useQuery({ queryKey: ['user-roles', user?.id], enabled: Boolean(user), queryFn: () => api.get<string[]>(`/users/${user?.id}/roles`).then(response => response.data) })
  const selectedRole = form.role || roles.data?.[0] || blank.role
  const mutation = useMutation({
    mutationFn: async () => {
      if (user) await api.put(`/users/${user.id}`, { email: form.email, fullName: form.fullName, phone: form.phone || null, password: form.password || null, status: form.status, roles: [selectedRole] })
      else await api.post('/users', { ...form, roles: [selectedRole], role: undefined })
    },
    onSuccess: () => {
      toast.success(user ? text('Đã cập nhật tài khoản.', 'Account updated.') : text('Đã tạo tài khoản mới.', 'Account created.'))
      onSaved()
    },
    onError: error => toast.error(errorMessage(error)),
  })
  const set = (key: keyof Form, value: string) => setForm(previous => ({ ...previous, [key]: value }))

  const validPassword = user ? !form.password || form.password.length >= 12 : form.password.length >= 12

  return <Modal title={user ? text('Cập nhật tài khoản', 'Update account') : text('Tạo người dùng', 'Create user')} onClose={onClose}>
    <div className="grid gap-4 sm:grid-cols-2">
      <label><span className="label">{text('Tên đăng nhập', 'Username')}</span><input className="field" autoComplete="off" disabled={Boolean(user)} value={form.username} onChange={event => set('username', event.target.value)}/></label>
      <label><span className="label">{text('Họ và tên', 'Full name')}</span><input className="field" value={form.fullName} onChange={event => set('fullName', event.target.value)}/></label>
      <label><span className="label">Email</span><input type="email" className="field" value={form.email} onChange={event => set('email', event.target.value)}/></label>
      <label><span className="label">{text('Số điện thoại', 'Phone number')}</span><input className="field" value={form.phone} onChange={event => set('phone', event.target.value)}/></label>
      <label><span className="label">{user ? text('Mật khẩu mới (để trống nếu giữ nguyên)', 'New password (leave blank to keep current)') : text('Mật khẩu ban đầu (ít nhất 12 ký tự)', 'Initial password (at least 12 characters)')}</span><input type="password" autoComplete="new-password" className="field" value={form.password} onChange={event => set('password', event.target.value)}/></label>
      <label><span className="label">{text('Vai trò', 'Role')}</span><select className="field" disabled={roles.isLoading || isCurrentUser} value={selectedRole} onChange={event => set('role', event.target.value)}><option value="RECEPTIONIST">{text('Lễ tân', 'Receptionist')}</option><option value="MANAGER">{text('Quản lý', 'Manager')}</option><option value="ADMIN">{text('Quản trị viên', 'Administrator')}</option><option value="CUSTOMER">{text('Khách hàng', 'Guest')}</option></select>{isCurrentUser && <small className="mt-1 block text-xs text-ink-soft">{text('Không thể tự gỡ quyền quản trị.', 'You cannot remove your own administrator role.')}</small>}</label>
    </div>
    {roles.error && <p role="alert" className="mt-3 text-sm text-red-700">{errorMessage(roles.error)}</p>}
    <div className="mt-6 flex justify-end gap-3">
      <Button variant="secondary" onClick={onClose}>{text('Đóng', 'Close')}</Button>
      <Button disabled={!form.username || !form.fullName || !form.email || !validPassword || Boolean(roles.error)} loading={mutation.isPending} onClick={() => mutation.mutate()}>{user ? text('Lưu tài khoản', 'Save account') : text('Tạo tài khoản', 'Create account')}</Button>
    </div>
  </Modal>
}

function SessionsModal({ user, onClose }: { user: User; onClose: () => void }) {
  const { locale, text } = useI18n()
  const client = useQueryClient()
  const [confirmAll, setConfirmAll] = useState(false)
  const sessions = useQuery({ queryKey: ['user-sessions', user.id], queryFn: () => api.get<UserSession[]>(`/users/${user.id}/sessions`).then(response => response.data) })
  const revoke = useMutation({
    mutationFn: (familyId?: string) => familyId ? api.delete(`/users/${user.id}/sessions/${familyId}`) : api.post(`/users/${user.id}/revoke-sessions`),
    onSuccess: (_, familyId) => {
      toast.success(familyId ? text('Đã thu hồi phiên đăng nhập.', 'Sign-in session revoked.') : text('Đã thu hồi mọi phiên đăng nhập.', 'All sign-in sessions revoked.'))
      setConfirmAll(false)
      client.invalidateQueries({ queryKey: ['user-sessions', user.id] })
    },
    onError: error => toast.error(errorMessage(error)),
  })
  const format = (value: string) => new Date(value).toLocaleString(locale, { dateStyle: 'short', timeStyle: 'short' })

  return <Modal title={`${text('Phiên đăng nhập', 'Sign-in sessions')} · ${user.username}`} size="lg" onClose={onClose}>
    <div className="mb-4 flex items-center justify-between gap-3"><p className="text-sm text-ink-soft">{text('Hiển thị tối đa 20 thiết bị gần nhất; hệ thống không bao giờ hiển thị token.', 'Showing up to 20 recent devices; tokens are never displayed.')}</p>{sessions.data?.some(item => item.active) && <Button variant="danger" onClick={() => setConfirmAll(true)}><KeyRound size={16}/>{text('Thu hồi tất cả', 'Revoke all')}</Button>}</div>
    {sessions.isLoading ? <Loading text={text('Đang tải phiên đăng nhập…', 'Loading sign-in sessions…')}/> : sessions.error ? <ErrorState message={errorMessage(sessions.error)} onRetry={() => void sessions.refetch()}/> : <div className="space-y-3">{sessions.data?.map(session => <div key={session.familyId} className="rounded-2xl border border-slate-200 p-4">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start"><div className="min-w-0"><div className="flex items-center gap-2"><MonitorSmartphone size={18} className="text-ink-soft"/><strong>{session.userAgent || text('Thiết bị không xác định', 'Unknown device')}</strong></div><p className="mt-1 text-xs text-ink-soft">IP: {session.ipAddress || text('Không xác định', 'Unknown')} · {text('Hoạt động gần nhất', 'Last active')}: {format(session.lastActivityAt)}</p><p className="mt-1 text-xs text-ink-soft">{text('Bắt đầu', 'Started')}: {format(session.startedAt)} · {text('Hết hạn', 'Expires')}: {format(session.expiresAt)}</p></div><div className="flex shrink-0 items-center gap-2"><Badge tone={statusTone(session.active ? 'ACTIVE' : 'INACTIVE')}>{session.active ? text('Đang hoạt động', 'Active') : text('Đã kết thúc', 'Ended')}</Badge>{session.active && <Button variant="secondary" loading={revoke.isPending} onClick={() => revoke.mutate(session.familyId)}>{text('Thu hồi', 'Revoke')}</Button>}</div></div>
    </div>)}{!sessions.data?.length && <Empty text={text('Tài khoản chưa có phiên đăng nhập nào.', 'This account has no sign-in sessions.')}/>}</div>}
    <div className="mt-6 flex justify-end"><Button variant="secondary" onClick={onClose}>{text('Đóng', 'Close')}</Button></div>
    {confirmAll && <ConfirmDialog
      title={text('Thu hồi tất cả phiên?', 'Revoke all sessions?')}
      description={text(`Mọi thiết bị của “${user.username}” sẽ phải đăng nhập lại. Tài khoản và dữ liệu không bị xóa.`, `Every device signed in as “${user.username}” will need to sign in again. The account and data will remain.`)}
      confirmLabel={text('Thu hồi tất cả', 'Revoke all')}
      loading={revoke.isPending}
      onCancel={() => setConfirmAll(false)}
      onConfirm={() => revoke.mutate(undefined)}
    />}
  </Modal>
}
