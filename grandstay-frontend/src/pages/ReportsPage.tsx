import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { FileSpreadsheet, FileText } from 'lucide-react'
import { toast } from 'sonner'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { api, errorMessage } from '../api/client'
import type { OccupancyReportRow, ReceivableReportRow, RevenueBucket, ServiceSalesReportRow } from '../api/types'
import { Badge, Button, Card, Empty, ErrorState, Loading, PageHeader, statusTone } from '../components/ui'

type ReportType = 'REVENUE' | 'OCCUPANCY' | 'SERVICES' | 'RECEIVABLES'
type ReportRow = RevenueBucket | OccupancyReportRow | ServiceSalesReportRow | ReceivableReportRow

const reportTabs: { value: ReportType; label: string }[] = [
  { value: 'REVENUE', label: 'Doanh thu' }, { value: 'OCCUPANCY', label: 'Công suất phòng' },
  { value: 'SERVICES', label: 'Dịch vụ' }, { value: 'RECEIVABLES', label: 'Công nợ' },
]
const endpoints: Record<ReportType, string> = { REVENUE: '/reports/revenue', OCCUPANCY: '/reports/occupancy', SERVICES: '/reports/services', RECEIVABLES: '/reports/receivables' }
const today = new Date()
const start = new Date(today.getFullYear(), today.getMonth() - 1, today.getDate())
const dateValue = (date: Date) => {
  const offset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offset).toISOString().slice(0, 10)
}
const fromInstant = (date: string) => new Date(`${date}T00:00:00`).toISOString()
const toInstant = (date: string) => { const end = new Date(`${date}T00:00:00`); end.setDate(end.getDate() + 1); return end.toISOString() }
const money = (value: number) => `${Number(value).toLocaleString('vi-VN')}đ`
const csvCell = (value: string | number) => `"${String(value ?? '').replaceAll('"', '""')}"`

export function ReportsPage() {
  const [type, setType] = useState<ReportType>('REVENUE')
  const [filter, setFilter] = useState({ from: dateValue(start), to: dateValue(today), granularity: 'DAILY' })
  const [exporting, setExporting] = useState(false)
  const validPeriod = Boolean(filter.from && filter.to && filter.to >= filter.from)
  const params = validPeriod ? { from: fromInstant(filter.from), to: toInstant(filter.to), ...(type === 'REVENUE' ? { granularity: filter.granularity } : {}) } : undefined
  const query = useQuery({
    queryKey: ['report', type, filter], enabled: validPeriod,
    queryFn: () => api.get<ReportRow[]>(endpoints[type], { params }).then(response => response.data),
  })
  const data = query.data ?? []

  const exportCsv = () => {
    const table = csvData(type, data)
    const content = '\uFEFF' + [table.headers, ...table.rows].map(row => row.map(csvCell).join(',')).join('\n')
    saveBlob(new Blob([content], { type: 'text/csv;charset=utf-8' }), `GrandStay-${type.toLowerCase()}-${filter.from}-${filter.to}.csv`)
  }
  const exportPdf = async () => {
    setExporting(true)
    try {
      const response = await api.get<Blob>('/reports/export.pdf', { params: { type, ...params, granularity: filter.granularity }, responseType: 'blob' })
      saveBlob(response.data, `GrandStay-${type.toLowerCase()}-${filter.from}-${filter.to}.pdf`)
    } catch (error) { toast.error(errorMessage(error)) } finally { setExporting(false) }
  }

  return <>
    <PageHeader title="Báo cáo vận hành" description="Theo dõi doanh thu, công suất, dịch vụ và các khoản còn phải thu." action={<div className="flex gap-2"><Button variant="secondary" disabled={!data.length} onClick={exportCsv}><FileSpreadsheet size={16}/>Xuất Excel (CSV)</Button><Button variant="secondary" disabled={!data.length} loading={exporting} onClick={() => void exportPdf()}><FileText size={16}/>Xuất PDF</Button></div>}/>
    <Card>
      <div role="tablist" aria-label="Loại báo cáo" className="mb-5 flex flex-wrap gap-2">{reportTabs.map(tab => <button type="button" role="tab" aria-selected={type === tab.value} key={tab.value} onClick={() => setType(tab.value)} className={`rounded-xl px-4 py-2 text-sm font-bold transition ${type === tab.value ? 'bg-forest text-white shadow-sm' : 'bg-slate-100 text-ink-soft hover:bg-slate-200'}`}>{tab.label}</button>)}</div>
      <div className="grid gap-3 sm:grid-cols-4"><label><span className="label">Từ ngày</span><input type="date" className="field" value={filter.from} onChange={event => setFilter(previous => ({ ...previous, from: event.target.value }))}/></label><label><span className="label">Đến ngày</span><input type="date" min={filter.from || undefined} className="field" value={filter.to} onChange={event => setFilter(previous => ({ ...previous, to: event.target.value }))}/></label>{type === 'REVENUE' && <label><span className="label">Chu kỳ</span><select className="field" value={filter.granularity} onChange={event => setFilter(previous => ({ ...previous, granularity: event.target.value }))}><option value="DAILY">Theo ngày</option><option value="MONTHLY">Theo tháng</option><option value="YEARLY">Theo năm</option></select></label>}<Summary type={type} data={data}/></div>
      {!validPeriod && <p role="alert" className="mt-3 text-sm text-red-700">Ngày kết thúc không được trước ngày bắt đầu.</p>}
    </Card>

    {query.isLoading ? <Loading/> : query.error ? <div className="mt-5"><ErrorState message={errorMessage(query.error)} onRetry={() => void query.refetch()}/></div> : <div className="mt-5"><ReportContent type={type} data={data}/></div>}
  </>
}

function Summary({ type, data }: { type: ReportType; data: ReportRow[] }) {
  let label = 'Tổng doanh thu'; let value = money((data as RevenueBucket[]).reduce((sum, item) => sum + Number(item.revenue ?? 0), 0))
  if (type === 'OCCUPANCY') { const rows = data as OccupancyReportRow[]; const available = rows.reduce((sum, row) => sum + Number(row.availableHours), 0); const occupied = rows.reduce((sum, row) => sum + Number(row.occupiedHours), 0); label = 'Công suất chung'; value = `${available ? (occupied * 100 / available).toFixed(1) : 0}%` }
  if (type === 'SERVICES') { label = 'Doanh thu dịch vụ'; value = money((data as ServiceSalesReportRow[]).reduce((sum, item) => sum + Number(item.revenue), 0)) }
  if (type === 'RECEIVABLES') { label = 'Còn phải thu'; value = money((data as ReceivableReportRow[]).reduce((sum, item) => sum + Number(item.outstandingAmount), 0)) }
  return <div className="rounded-xl bg-forest p-3 text-white sm:col-start-4"><div className="text-xs text-emerald-100">{label}</div><div className="mt-1 truncate text-xl font-extrabold">{value}</div></div>
}

function ReportContent({ type, data }: { type: ReportType; data: ReportRow[] }) {
  if (!data.length) return <Card><Empty text="Không có dữ liệu trong khoảng thời gian đã chọn."/></Card>
  if (type === 'REVENUE') {
    const rows = data as RevenueBucket[]
    return <div className="grid gap-5 xl:grid-cols-[1.6fr_1fr]"><Card><div className="h-96"><ResponsiveContainer width="100%" height="100%"><BarChart data={rows}><CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey="period" tickFormatter={value => new Date(value).toLocaleDateString('vi-VN')} tick={{ fontSize: 11 }}/><YAxis tickFormatter={value => new Intl.NumberFormat('vi-VN', { notation: 'compact' }).format(value)} tick={{ fontSize: 11 }}/><Tooltip formatter={value => `${Number(value).toLocaleString('vi-VN')} VND`}/><Bar dataKey="revenue" fill="#286052" radius={[7,7,0,0]}/></BarChart></ResponsiveContainer></div></Card><Card><h2 className="font-display text-xl font-bold">Chi tiết kỳ</h2><div className="mt-4 max-h-84 space-y-2 overflow-y-auto">{rows.map(row => <div key={row.period} className="flex justify-between rounded-xl bg-slate-50 p-3 text-sm"><div><div className="font-semibold">{new Date(row.period).toLocaleDateString('vi-VN')}</div><div className="text-xs text-ink-soft">{row.invoiceCount} hóa đơn</div></div><div className="font-bold">{money(row.revenue)}</div></div>)}</div></Card></div>
  }
  if (type === 'OCCUPANCY') return <ReportTable headers={['Hạng phòng','Số phòng','Giờ sử dụng','Giờ khả dụng','Công suất','Doanh thu phòng']} rows={(data as OccupancyReportRow[]).map(row => [row.roomTypeName,row.roomCount,Number(row.occupiedHours).toLocaleString('vi-VN'),Number(row.availableHours).toLocaleString('vi-VN'),`${row.occupancyRate}%`,money(row.roomRevenue)])}/>
  if (type === 'SERVICES') return <ReportTable headers={['Dịch vụ','Số lượng','Đơn vị','Số booking','Doanh thu']} rows={(data as ServiceSalesReportRow[]).map(row => [row.serviceName,Number(row.quantity).toLocaleString('vi-VN'),row.unit,row.bookingCount,money(row.revenue)])}/>
  return <ReportTable headers={['Hóa đơn','Khách hàng','Ngày phát hành','Tổng tiền','Đã thu','Còn phải thu','Tình trạng']} rows={(data as ReceivableReportRow[]).map(row => [row.invoiceNumber,row.customerName,new Date(row.issuedAt).toLocaleDateString('vi-VN'),money(row.grandTotal),money(row.paidAmount),money(row.outstandingAmount),<Badge tone={statusTone(row.overdueDays > 0 ? 'INACTIVE' : 'PENDING')}>{row.overdueDays > 0 ? `Quá hạn ${row.overdueDays} ngày` : 'Trong hạn'}</Badge>])}/>
}

function ReportTable({ headers, rows }: { headers: string[]; rows: (string | number | React.ReactNode)[][] }) {
  return <Card><div className="table-shell"><table className="data-table"><thead><tr>{headers.map(header => <th key={header}>{header}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={index}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>)}</tbody></table></div></Card>
}

function csvData(type: ReportType, data: ReportRow[]) {
  if (type === 'REVENUE') return { headers: ['Kỳ','Số hóa đơn','Doanh thu'], rows: (data as RevenueBucket[]).map(row => [row.period,row.invoiceCount,row.revenue]) }
  if (type === 'OCCUPANCY') return { headers: ['Hạng phòng','Số phòng','Giờ sử dụng','Giờ khả dụng','Công suất (%)','Doanh thu'], rows: (data as OccupancyReportRow[]).map(row => [row.roomTypeName,row.roomCount,row.occupiedHours,row.availableHours,row.occupancyRate,row.roomRevenue]) }
  if (type === 'SERVICES') return { headers: ['Dịch vụ','Số lượng','Đơn vị','Số booking','Doanh thu'], rows: (data as ServiceSalesReportRow[]).map(row => [row.serviceName,row.quantity,row.unit,row.bookingCount,row.revenue]) }
  return { headers: ['Hóa đơn','Khách hàng','Ngày phát hành','Tổng tiền','Đã thu','Còn phải thu','Quá hạn (ngày)'], rows: (data as ReceivableReportRow[]).map(row => [row.invoiceNumber,row.customerName,row.issuedAt,row.grandTotal,row.paidAmount,row.outstandingAmount,row.overdueDays]) }
}

function saveBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = fileName; anchor.click(); URL.revokeObjectURL(url)
}
