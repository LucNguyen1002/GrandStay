import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Filter, ShieldCheck } from 'lucide-react'
import { api, errorMessage } from '../api/client'
import type { AuditLog, Page, User } from '../api/types'
import { Badge, Card, Empty, ErrorState, Loading, PageHeader, Pagination, statusTone } from '../components/ui'

const actionLabels: Record<string, string> = {
  CREATE: 'Tạo mới', UPDATE: 'Cập nhật', DELETE: 'Xóa', CONFIRM: 'Xác nhận',
  CHECK_IN: 'Nhận phòng', CHECK_OUT: 'Trả phòng', CANCEL: 'Hủy', LOCK: 'Khóa',
  UNLOCK: 'Mở khóa', REVOKE_SESSIONS: 'Thu hồi phiên', CHANGE_PASSWORD: 'Đổi mật khẩu',
  COMPLETE: 'Hoàn tất', REFUNDS: 'Hoàn tiền', SERVICES: 'Thêm dịch vụ',
}

const entityLabels: Record<string, string> = {
  USER: 'Người dùng', BOOKING: 'Đặt phòng', PAYMENT: 'Thanh toán', ROOM: 'Phòng',
  ROOM_TYPE: 'Hạng phòng', RATE_PLAN: 'Gói giá', AMENITY: 'Tiện nghi',
  PROMOTION: 'Ưu đãi', SERVICE: 'Dịch vụ', CUSTOMER: 'Khách hàng', AUTH: 'Bảo mật',
}

const entityOptions = ['', 'USER', 'BOOKING', 'PAYMENT', 'ROOM', 'ROOM_TYPE', 'RATE_PLAN', 'AMENITY', 'PROMOTION', 'SERVICE', 'CUSTOMER', 'AUTH']
const actionOptions = ['', ...Object.keys(actionLabels)]

const endExclusive = (date: string) => {
  if (!date) return undefined
  const next = new Date(`${date}T00:00:00`)
  next.setDate(next.getDate() + 1)
  return next.toISOString()
}

export function AuditPage() {
  const [page, setPage] = useState(0)
  const [filters, setFilters] = useState({ entityType: '', action: '', actorUserId: '', from: '', to: '' })
  const users = useQuery({ queryKey: ['users', 'audit-filter'], queryFn: () => api.get<Page<User>>('/users', { params: { size: 100 } }).then(response => response.data.content) })
  const logs = useQuery({
    queryKey: ['audit-logs', page, filters],
    queryFn: () => api.get<Page<AuditLog>>('/audit-logs', { params: {
      page, size: 30, sort: 'occurredAt,desc', entityType: filters.entityType || undefined,
      action: filters.action || undefined, actorUserId: filters.actorUserId || undefined,
      from: filters.from ? new Date(`${filters.from}T00:00:00`).toISOString() : undefined,
      to: endExclusive(filters.to),
    } }).then(response => response.data),
  })
  const set = (key: keyof typeof filters, value: string) => { setFilters(previous => ({ ...previous, [key]: value })); setPage(0) }

  return <>
    <PageHeader title="Nhật ký kiểm toán" description="Theo dõi các thay đổi nghiệp vụ và thao tác bảo mật thành công trên hệ thống."/>
    <Card>
      <div className="mb-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <label><span className="label">Đối tượng</span><select className="field" value={filters.entityType} onChange={event => set('entityType', event.target.value)}>{entityOptions.map(value => <option key={value} value={value}>{value ? entityLabels[value] ?? value : 'Tất cả đối tượng'}</option>)}</select></label>
        <label><span className="label">Hành động</span><select className="field" value={filters.action} onChange={event => set('action', event.target.value)}>{actionOptions.map(value => <option key={value} value={value}>{value ? actionLabels[value] ?? value : 'Tất cả hành động'}</option>)}</select></label>
        <label><span className="label">Người thực hiện</span><select className="field" value={filters.actorUserId} onChange={event => set('actorUserId', event.target.value)}><option value="">Tất cả người dùng</option>{users.data?.map(user => <option key={user.id} value={user.id}>{user.fullName} · {user.username}</option>)}</select></label>
        <label><span className="label">Từ ngày</span><input type="date" className="field" value={filters.from} onChange={event => set('from', event.target.value)}/></label>
        <label><span className="label">Đến ngày</span><input type="date" className="field" min={filters.from || undefined} value={filters.to} onChange={event => set('to', event.target.value)}/></label>
      </div>
      <div className="mb-4 flex items-center gap-2 rounded-xl bg-slate-50 px-4 py-3 text-xs text-ink-soft"><ShieldCheck size={16} className="text-emerald-700"/><span>Nhật ký chỉ lưu metadata cần thiết; mật khẩu, token và nội dung giấy tờ cá nhân không được ghi lại.</span></div>
      {logs.isLoading ? <Loading text="Đang tải nhật ký…"/> : logs.error ? <ErrorState message={errorMessage(logs.error)} onRetry={() => void logs.refetch()}/> : <>
        <div className="table-shell"><table className="data-table"><thead><tr><th>Thời gian</th><th>Người thực hiện</th><th>Hành động</th><th>Đối tượng</th><th>Thông tin yêu cầu</th></tr></thead><tbody>{logs.data?.content.map(log => <tr key={log.id}>
          <td className="whitespace-nowrap text-sm">{new Date(log.occurredAt).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'medium' })}</td>
          <td><strong>{log.actorName || 'Tài khoản đã xóa'}</strong>{log.actorUserId && <div className="font-mono text-[10px] text-ink-soft">{log.actorUserId}</div>}</td>
          <td><Badge tone={statusTone(log.action === 'DELETE' || log.action === 'LOCK' ? 'INACTIVE' : log.action === 'CREATE' ? 'ACTIVE' : 'PENDING')}>{actionLabels[log.action] ?? log.action}</Badge></td>
          <td><strong>{entityLabels[log.entityType] ?? log.entityType}</strong><div className="max-w-48 truncate font-mono text-[10px] text-ink-soft" title={log.entityId}>{log.entityId}</div></td>
          <td><div className="text-xs">IP: {log.ipAddress || '—'}</div><div className="mt-0.5 max-w-52 truncate font-mono text-[10px] text-ink-soft" title={log.requestId}>Request: {log.requestId || '—'}</div></td>
        </tr>)}</tbody></table>{!logs.data?.content.length && <Empty text="Không có sự kiện phù hợp với bộ lọc."/>}</div>
        <Pagination page={logs.data?.number ?? 0} totalPages={logs.data?.totalPages ?? 0} onChange={setPage}/>
      </>}
      <div className="mt-4 flex items-center gap-2 text-xs text-ink-soft"><Filter size={14}/>Có thể kết hợp nhiều bộ lọc để phục vụ đối soát.</div>
    </Card>
  </>
}
