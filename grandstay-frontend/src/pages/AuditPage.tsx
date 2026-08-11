import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Filter, ShieldCheck } from 'lucide-react'
import { api, errorMessage } from '../api/client'
import type { AuditLog, Page, User } from '../api/types'
import { Badge, Card, Empty, ErrorState, Loading, PageHeader, Pagination, statusTone } from '../components/ui'
import { useI18n, type Language } from '../i18n'

function auditLabels(language: Language) {
  const actions: Record<string, [string, string]> = {
    CREATE: ['Tạo mới', 'Create'], UPDATE: ['Cập nhật', 'Update'], DELETE: ['Xóa', 'Delete'], CONFIRM: ['Xác nhận', 'Confirm'],
    CHECK_IN: ['Nhận phòng', 'Check in'], CHECK_OUT: ['Trả phòng', 'Check out'], CANCEL: ['Hủy', 'Cancel'], LOCK: ['Khóa', 'Lock'],
    UNLOCK: ['Mở khóa', 'Unlock'], REVOKE_SESSIONS: ['Thu hồi phiên', 'Revoke sessions'], CHANGE_PASSWORD: ['Đổi mật khẩu', 'Change password'],
    COMPLETE: ['Hoàn tất', 'Complete'], REFUNDS: ['Hoàn tiền', 'Refund'], SERVICES: ['Thêm dịch vụ', 'Add services'],
  }
  const entities: Record<string, [string, string]> = {
    USER: ['Người dùng', 'User'], BOOKING: ['Đặt phòng', 'Booking'], PAYMENT: ['Thanh toán', 'Payment'], ROOM: ['Phòng', 'Room'],
    ROOM_TYPE: ['Hạng phòng', 'Room class'], RATE_PLAN: ['Gói giá', 'Rate plan'], AMENITY: ['Tiện nghi', 'Amenity'],
    PROMOTION: ['Ưu đãi', 'Promotion'], SERVICE: ['Dịch vụ', 'Service'], CUSTOMER: ['Khách hàng', 'Guest'], AUTH: ['Bảo mật', 'Security'],
  }
  const index = language === 'vi' ? 0 : 1
  return {
    actions: Object.fromEntries(Object.entries(actions).map(([key, value]) => [key, value[index]])),
    entities: Object.fromEntries(Object.entries(entities).map(([key, value]) => [key, value[index]])),
  }
}

const entityOptions = ['', 'USER', 'BOOKING', 'PAYMENT', 'ROOM', 'ROOM_TYPE', 'RATE_PLAN', 'AMENITY', 'PROMOTION', 'SERVICE', 'CUSTOMER', 'AUTH']
const actionOptions = ['', 'CREATE', 'UPDATE', 'DELETE', 'CONFIRM', 'CHECK_IN', 'CHECK_OUT', 'CANCEL', 'LOCK', 'UNLOCK', 'REVOKE_SESSIONS', 'CHANGE_PASSWORD', 'COMPLETE', 'REFUNDS', 'SERVICES']

const endExclusive = (date: string) => {
  if (!date) return undefined
  const next = new Date(`${date}T00:00:00`)
  next.setDate(next.getDate() + 1)
  return next.toISOString()
}

export function AuditPage() {
  const { language, locale, text } = useI18n()
  const { actions: actionLabels, entities: entityLabels } = auditLabels(language)
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
    <PageHeader title={text('Nhật ký kiểm toán', 'Audit log')} description={text('Theo dõi các thay đổi nghiệp vụ và thao tác bảo mật thành công trên hệ thống.', 'Track successful operational changes and security actions across the system.')}/>
    <Card>
      <div className="mb-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <label><span className="label">{text('Đối tượng', 'Entity')}</span><select className="field" value={filters.entityType} onChange={event => set('entityType', event.target.value)}>{entityOptions.map(value => <option key={value} value={value}>{value ? entityLabels[value] ?? value : text('Tất cả đối tượng', 'All entities')}</option>)}</select></label>
        <label><span className="label">{text('Hành động', 'Action')}</span><select className="field" value={filters.action} onChange={event => set('action', event.target.value)}>{actionOptions.map(value => <option key={value} value={value}>{value ? actionLabels[value] ?? value : text('Tất cả hành động', 'All actions')}</option>)}</select></label>
        <label><span className="label">{text('Người thực hiện', 'Performed by')}</span><select className="field" value={filters.actorUserId} onChange={event => set('actorUserId', event.target.value)}><option value="">{text('Tất cả người dùng', 'All users')}</option>{users.data?.map(user => <option key={user.id} value={user.id}>{user.fullName} · {user.username}</option>)}</select></label>
        <label><span className="label">{text('Từ ngày', 'From')}</span><input type="date" className="field" value={filters.from} onChange={event => set('from', event.target.value)}/></label>
        <label><span className="label">{text('Đến ngày', 'To')}</span><input type="date" className="field" min={filters.from || undefined} value={filters.to} onChange={event => set('to', event.target.value)}/></label>
      </div>
      <div className="mb-4 flex items-center gap-2 rounded-xl bg-slate-50 px-4 py-3 text-xs text-ink-soft"><ShieldCheck size={16} className="text-emerald-700"/><span>{text('Nhật ký chỉ lưu metadata cần thiết; mật khẩu, token và nội dung giấy tờ cá nhân không được ghi lại.', 'The audit log stores only essential metadata; passwords, tokens and identity document contents are never recorded.')}</span></div>
      {logs.isLoading ? <Loading text={text('Đang tải nhật ký…', 'Loading audit log…')}/> : logs.error ? <ErrorState message={errorMessage(logs.error)} onRetry={() => void logs.refetch()}/> : <>
        <div className="table-shell"><table className="data-table"><thead><tr><th>{text('Thời gian', 'Time')}</th><th>{text('Người thực hiện', 'Performed by')}</th><th>{text('Hành động', 'Action')}</th><th>{text('Đối tượng', 'Entity')}</th><th>{text('Thông tin yêu cầu', 'Request details')}</th></tr></thead><tbody>{logs.data?.content.map(log => <tr key={log.id}>
          <td className="whitespace-nowrap text-sm">{new Date(log.occurredAt).toLocaleString(locale, { dateStyle: 'short', timeStyle: 'medium' })}</td>
          <td><strong>{log.actorName || text('Tài khoản đã xóa', 'Deleted account')}</strong>{log.actorUserId && <div className="font-mono text-[10px] text-ink-soft">{log.actorUserId}</div>}</td>
          <td><Badge tone={statusTone(log.action === 'DELETE' || log.action === 'LOCK' ? 'INACTIVE' : log.action === 'CREATE' ? 'ACTIVE' : 'PENDING')}>{actionLabels[log.action] ?? log.action}</Badge></td>
          <td><strong>{entityLabels[log.entityType] ?? log.entityType}</strong><div className="max-w-48 truncate font-mono text-[10px] text-ink-soft" title={log.entityId}>{log.entityId}</div></td>
          <td><div className="text-xs">IP: {log.ipAddress || '—'}</div><div className="mt-0.5 max-w-52 truncate font-mono text-[10px] text-ink-soft" title={log.requestId}>{text('Yêu cầu', 'Request')}: {log.requestId || '—'}</div></td>
        </tr>)}</tbody></table>{!logs.data?.content.length && <Empty text={text('Không có sự kiện phù hợp với bộ lọc.', 'No events match these filters.')}/>}</div>
        <Pagination page={logs.data?.number ?? 0} totalPages={logs.data?.totalPages ?? 0} onChange={setPage}/>
      </>}
      <div className="mt-4 flex items-center gap-2 text-xs text-ink-soft"><Filter size={14}/>{text('Có thể kết hợp nhiều bộ lọc để phục vụ đối soát.', 'Combine filters to support reconciliation and reviews.')}</div>
    </Card>
  </>
}
