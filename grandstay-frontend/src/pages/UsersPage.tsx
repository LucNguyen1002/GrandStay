import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { KeyRound, LockKeyhole, LockOpen, MonitorSmartphone, Pencil, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { api, errorMessage } from '../api/client'
import type { Page, User } from '../api/types'
import { Badge, Button, Card, ConfirmDialog, Empty, ErrorState, Loading, Modal, PageHeader, statusTone } from '../components/ui'
import { useAuth } from '../auth/AuthProvider'

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

const actionMessages: Record<ActionKind, string> = {
  delete: 'Đã xóa người dùng.',
  revoke: 'Đã thu hồi mọi phiên đăng nhập.',
  lock: 'Đã khóa tài khoản và thu hồi các phiên đăng nhập.',
  unlock: 'Đã mở khóa tài khoản.',
}

const statusLabels: Record<string, string> = {
  ACTIVE: 'Hoạt động',
  LOCKED: 'Đã khóa',
  INACTIVE: 'Ngừng hoạt động',
}

export function UsersPage() {
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
    return <Card><p className="text-sm text-red-700">Chỉ quản trị viên được truy cập chức năng này.</p></Card>
  }
  if (query.isLoading) return <Loading />

  return <>
    <PageHeader
      title="Người dùng & phân quyền"
      description="Cấp tài khoản nhân viên, khóa truy cập và kiểm soát phiên đăng nhập."
      action={<Button onClick={() => setCreating(true)}><Plus size={17}/>Tạo người dùng</Button>}
    />
    <Card>
      <div className="table-shell">
        <table className="data-table">
          <thead><tr><th>Tài khoản</th><th>Họ tên</th><th>Liên hệ</th><th>Trạng thái</th><th><span className="sr-only">Thao tác</span></th></tr></thead>
          <tbody>{query.data?.map(user => {
            const isCurrentUser = user.id === currentUser?.sub
            return <tr key={user.id}>
              <td className="font-bold">
                {user.username}
                {isCurrentUser && <div className="text-xs font-normal text-forest">Tài khoản hiện tại</div>}
              </td>
              <td>{user.fullName}</td>
              <td>{user.email}<div className="text-xs text-ink-soft">{user.phone}</div></td>
              <td><Badge tone={statusTone(user.status)}>{statusLabels[user.status] ?? user.status}</Badge></td>
              <td>
                <div className="flex justify-end gap-1">
                  <button type="button" title="Xem phiên đăng nhập" aria-label={`Xem phiên của ${user.username}`} className="rounded-lg p-2 text-blue-700 transition hover:bg-blue-50" onClick={() => setSessions(user)}>
                    <MonitorSmartphone size={17}/>
                  </button>
                  <button type="button" title="Sửa tài khoản" aria-label={`Sửa tài khoản ${user.username}`} className="rounded-lg p-2 text-slate-700 transition hover:bg-slate-100" onClick={() => setEditing(user)}><Pencil size={17}/></button>
                  {!isCurrentUser && user.status === 'ACTIVE' && <button type="button" title="Khóa tài khoản" aria-label={`Khóa tài khoản ${user.username}`} disabled={action.isPending} className="rounded-lg p-2 text-red-600 transition hover:bg-red-50 disabled:opacity-50" onClick={() => setLocking(user)}>
                    <LockKeyhole size={17}/>
                  </button>}
                  {!isCurrentUser && user.status === 'LOCKED' && <button type="button" title="Mở khóa tài khoản" aria-label={`Mở khóa tài khoản ${user.username}`} disabled={action.isPending} className="rounded-lg p-2 text-emerald-700 transition hover:bg-emerald-50 disabled:opacity-50" onClick={() => action.mutate({ id: user.id, kind: 'unlock' })}>
                    <LockOpen size={17}/>
                  </button>}
                  {!isCurrentUser && <button type="button" title="Xóa người dùng" aria-label={`Xóa tài khoản ${user.username}`} disabled={action.isPending} className="rounded-lg p-2 text-red-600 transition hover:bg-red-50 disabled:opacity-50" onClick={() => setDeleting(user)}>
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
      title="Khóa tài khoản?"
      description={`Tài khoản “${locking.username}” sẽ không thể đăng nhập hoặc tiếp tục sử dụng phiên hiện tại. Dữ liệu nghiệp vụ vẫn được giữ nguyên.`}
      confirmLabel="Khóa tài khoản"
      loading={action.isPending}
      onCancel={() => setLocking(null)}
      onConfirm={() => action.mutate({ id: locking.id, kind: 'lock' })}
    />}
    {deleting && <ConfirmDialog
      title="Xóa tài khoản nhân viên?"
      description={`Tài khoản “${deleting.username}” sẽ bị vô hiệu hóa và mọi phiên đăng nhập sẽ bị thu hồi. Dữ liệu nghiệp vụ do tài khoản tạo vẫn được giữ lại.`}
      confirmLabel="Xóa tài khoản"
      loading={action.isPending}
      onCancel={() => setDeleting(null)}
      onConfirm={() => action.mutate({ id: deleting.id, kind: 'delete' })}
    />}
  </>
}

function UserModal({ user, isCurrentUser = false, onClose, onSaved }: { user?: User; isCurrentUser?: boolean; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<Form>(user ? { username: user.username, email: user.email, fullName: user.fullName, phone: user.phone ?? '', password: '', status: user.status, role: '' } : blank)
  const roles = useQuery({ queryKey: ['user-roles', user?.id], enabled: Boolean(user), queryFn: () => api.get<string[]>(`/users/${user?.id}/roles`).then(response => response.data) })
  const selectedRole = form.role || roles.data?.[0] || blank.role
  const mutation = useMutation({
    mutationFn: async () => {
      if (user) await api.put(`/users/${user.id}`, { email: form.email, fullName: form.fullName, phone: form.phone || null, password: form.password || null, status: form.status, roles: [selectedRole] })
      else await api.post('/users', { ...form, roles: [selectedRole], role: undefined })
    },
    onSuccess: () => {
      toast.success(user ? 'Đã cập nhật tài khoản.' : 'Đã tạo tài khoản mới.')
      onSaved()
    },
    onError: error => toast.error(errorMessage(error)),
  })
  const set = (key: keyof Form, value: string) => setForm(previous => ({ ...previous, [key]: value }))

  const validPassword = user ? !form.password || form.password.length >= 12 : form.password.length >= 12

  return <Modal title={user ? 'Cập nhật tài khoản' : 'Tạo người dùng'} onClose={onClose}>
    <div className="grid gap-4 sm:grid-cols-2">
      <label><span className="label">Tên đăng nhập</span><input className="field" autoComplete="off" disabled={Boolean(user)} value={form.username} onChange={event => set('username', event.target.value)}/></label>
      <label><span className="label">Họ và tên</span><input className="field" value={form.fullName} onChange={event => set('fullName', event.target.value)}/></label>
      <label><span className="label">Email</span><input type="email" className="field" value={form.email} onChange={event => set('email', event.target.value)}/></label>
      <label><span className="label">Số điện thoại</span><input className="field" value={form.phone} onChange={event => set('phone', event.target.value)}/></label>
      <label><span className="label">{user ? 'Mật khẩu mới (để trống nếu giữ nguyên)' : 'Mật khẩu ban đầu (ít nhất 12 ký tự)'}</span><input type="password" autoComplete="new-password" className="field" value={form.password} onChange={event => set('password', event.target.value)}/></label>
      <label><span className="label">Vai trò</span><select className="field" disabled={roles.isLoading || isCurrentUser} value={selectedRole} onChange={event => set('role', event.target.value)}><option value="RECEPTIONIST">Lễ tân</option><option value="MANAGER">Quản lý</option><option value="ADMIN">Quản trị viên</option><option value="CUSTOMER">Khách hàng</option></select>{isCurrentUser && <small className="mt-1 block text-xs text-ink-soft">Không thể tự gỡ quyền quản trị.</small>}</label>
    </div>
    {roles.error && <p role="alert" className="mt-3 text-sm text-red-700">{errorMessage(roles.error)}</p>}
    <div className="mt-6 flex justify-end gap-3">
      <Button variant="secondary" onClick={onClose}>Đóng</Button>
      <Button disabled={!form.username || !form.fullName || !form.email || !validPassword || Boolean(roles.error)} loading={mutation.isPending} onClick={() => mutation.mutate()}>{user ? 'Lưu tài khoản' : 'Tạo tài khoản'}</Button>
    </div>
  </Modal>
}

function SessionsModal({ user, onClose }: { user: User; onClose: () => void }) {
  const client = useQueryClient()
  const [confirmAll, setConfirmAll] = useState(false)
  const sessions = useQuery({ queryKey: ['user-sessions', user.id], queryFn: () => api.get<UserSession[]>(`/users/${user.id}/sessions`).then(response => response.data) })
  const revoke = useMutation({
    mutationFn: (familyId?: string) => familyId ? api.delete(`/users/${user.id}/sessions/${familyId}`) : api.post(`/users/${user.id}/revoke-sessions`),
    onSuccess: (_, familyId) => {
      toast.success(familyId ? 'Đã thu hồi phiên đăng nhập.' : 'Đã thu hồi mọi phiên đăng nhập.')
      setConfirmAll(false)
      client.invalidateQueries({ queryKey: ['user-sessions', user.id] })
    },
    onError: error => toast.error(errorMessage(error)),
  })
  const format = (value: string) => new Date(value).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })

  return <Modal title={`Phiên đăng nhập · ${user.username}`} size="lg" onClose={onClose}>
    <div className="mb-4 flex items-center justify-between gap-3"><p className="text-sm text-ink-soft">Hiển thị tối đa 20 thiết bị gần nhất; hệ thống không bao giờ hiển thị token.</p>{sessions.data?.some(item => item.active) && <Button variant="danger" onClick={() => setConfirmAll(true)}><KeyRound size={16}/>Thu hồi tất cả</Button>}</div>
    {sessions.isLoading ? <Loading text="Đang tải phiên đăng nhập…"/> : sessions.error ? <ErrorState message={errorMessage(sessions.error)} onRetry={() => void sessions.refetch()}/> : <div className="space-y-3">{sessions.data?.map(session => <div key={session.familyId} className="rounded-2xl border border-slate-200 p-4">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start"><div className="min-w-0"><div className="flex items-center gap-2"><MonitorSmartphone size={18} className="text-ink-soft"/><strong>{session.userAgent || 'Thiết bị không xác định'}</strong></div><p className="mt-1 text-xs text-ink-soft">IP: {session.ipAddress || 'Không xác định'} · Hoạt động gần nhất: {format(session.lastActivityAt)}</p><p className="mt-1 text-xs text-ink-soft">Bắt đầu: {format(session.startedAt)} · Hết hạn: {format(session.expiresAt)}</p></div><div className="flex shrink-0 items-center gap-2"><Badge tone={statusTone(session.active ? 'ACTIVE' : 'INACTIVE')}>{session.active ? 'Đang hoạt động' : 'Đã kết thúc'}</Badge>{session.active && <Button variant="secondary" loading={revoke.isPending} onClick={() => revoke.mutate(session.familyId)}>Thu hồi</Button>}</div></div>
    </div>)}{!sessions.data?.length && <Empty text="Tài khoản chưa có phiên đăng nhập nào."/>}</div>}
    <div className="mt-6 flex justify-end"><Button variant="secondary" onClick={onClose}>Đóng</Button></div>
    {confirmAll && <ConfirmDialog title="Thu hồi tất cả phiên?" description={`Mọi thiết bị của “${user.username}” sẽ phải đăng nhập lại. Tài khoản và dữ liệu không bị xóa.`} confirmLabel="Thu hồi tất cả" loading={revoke.isPending} onCancel={() => setConfirmAll(false)} onConfirm={() => revoke.mutate(undefined)}/>} 
  </Modal>
}
