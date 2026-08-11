import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { FileSpreadsheet, FileText } from 'lucide-react'
import { toast } from 'sonner'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { api, errorMessage } from '../api/client'
import type { OccupancyReportRow, ReceivableReportRow, RevenueBucket, ServiceSalesReportRow } from '../api/types'
import { Badge, Button, Card, Empty, ErrorState, Loading, PageHeader, statusTone } from '../components/ui'
import { useI18n, type Language } from '../i18n'

type ReportType = 'REVENUE' | 'OCCUPANCY' | 'SERVICES' | 'RECEIVABLES'
type ReportRow = RevenueBucket | OccupancyReportRow | ServiceSalesReportRow | ReceivableReportRow

const reportTypes: ReportType[] = ['REVENUE', 'OCCUPANCY', 'SERVICES', 'RECEIVABLES']
const endpoints: Record<ReportType, string> = { REVENUE: '/reports/revenue', OCCUPANCY: '/reports/occupancy', SERVICES: '/reports/services', RECEIVABLES: '/reports/receivables' }
const today = new Date()
const start = new Date(today.getFullYear(), today.getMonth() - 1, today.getDate())
const dateValue = (date: Date) => {
  const offset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offset).toISOString().slice(0, 10)
}
const fromInstant = (date: string) => new Date(`${date}T00:00:00`).toISOString()
const toInstant = (date: string) => { const end = new Date(`${date}T00:00:00`); end.setDate(end.getDate() + 1); return end.toISOString() }
const csvCell = (value: string | number) => `"${String(value ?? '').replaceAll('"', '""')}"`

function reportLabel(type: ReportType, language: Language) {
  const labels: Record<ReportType, [string, string]> = { REVENUE: ['Doanh thu', 'Revenue'], OCCUPANCY: ['Công suất phòng', 'Occupancy'], SERVICES: ['Dịch vụ', 'Services'], RECEIVABLES: ['Công nợ', 'Receivables'] }
  return labels[type][language === 'vi' ? 0 : 1]
}

export function ReportsPage() {
  const { language, text } = useI18n()
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
    const table = csvData(type, data, language)
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
    <PageHeader title={text('Báo cáo vận hành', 'Operations reports')} description={text('Theo dõi doanh thu, công suất, dịch vụ và các khoản còn phải thu.', 'Monitor revenue, occupancy, services and outstanding receivables.')} action={<div className="flex gap-2"><Button variant="secondary" disabled={!data.length} onClick={exportCsv}><FileSpreadsheet size={16}/>{text('Xuất Excel (CSV)', 'Export Excel (CSV)')}</Button><Button variant="secondary" disabled={!data.length} loading={exporting} onClick={() => void exportPdf()}><FileText size={16}/>{text('Xuất PDF', 'Export PDF')}</Button></div>}/>
    <Card>
      <div role="tablist" aria-label={text('Loại báo cáo', 'Report type')} className="mb-5 flex flex-wrap gap-2">{reportTypes.map(reportType => <button type="button" role="tab" aria-selected={type === reportType} key={reportType} onClick={() => setType(reportType)} className={`rounded-xl px-4 py-2 text-sm font-bold transition ${type === reportType ? 'bg-forest text-white shadow-sm' : 'bg-slate-100 text-ink-soft hover:bg-slate-200'}`}>{reportLabel(reportType, language)}</button>)}</div>
      <div className="grid gap-3 sm:grid-cols-4"><label><span className="label">{text('Từ ngày', 'From')}</span><input type="date" className="field" value={filter.from} onChange={event => setFilter(previous => ({ ...previous, from: event.target.value }))}/></label><label><span className="label">{text('Đến ngày', 'To')}</span><input type="date" min={filter.from || undefined} className="field" value={filter.to} onChange={event => setFilter(previous => ({ ...previous, to: event.target.value }))}/></label>{type === 'REVENUE' && <label><span className="label">{text('Chu kỳ', 'Period')}</span><select className="field" value={filter.granularity} onChange={event => setFilter(previous => ({ ...previous, granularity: event.target.value }))}><option value="DAILY">{text('Theo ngày', 'Daily')}</option><option value="MONTHLY">{text('Theo tháng', 'Monthly')}</option><option value="YEARLY">{text('Theo năm', 'Yearly')}</option></select></label>}<Summary type={type} data={data}/></div>
      {!validPeriod && <p role="alert" className="mt-3 text-sm text-red-700">{text('Ngày kết thúc không được trước ngày bắt đầu.', 'The end date cannot be before the start date.')}</p>}
    </Card>

    {query.isLoading ? <Loading/> : query.error ? <div className="mt-5"><ErrorState message={errorMessage(query.error)} onRetry={() => void query.refetch()}/></div> : <div className="mt-5"><ReportContent type={type} data={data}/></div>}
  </>
}

function Summary({ type, data }: { type: ReportType; data: ReportRow[] }) {
  const { money, text } = useI18n()
  let label = text('Tổng doanh thu', 'Total revenue'); let value = money((data as RevenueBucket[]).reduce((sum, item) => sum + Number(item.revenue ?? 0), 0))
  if (type === 'OCCUPANCY') { const rows = data as OccupancyReportRow[]; const available = rows.reduce((sum, row) => sum + Number(row.availableHours), 0); const occupied = rows.reduce((sum, row) => sum + Number(row.occupiedHours), 0); label = text('Công suất chung', 'Overall occupancy'); value = `${available ? (occupied * 100 / available).toFixed(1) : 0}%` }
  if (type === 'SERVICES') { label = text('Doanh thu dịch vụ', 'Service revenue'); value = money((data as ServiceSalesReportRow[]).reduce((sum, item) => sum + Number(item.revenue), 0)) }
  if (type === 'RECEIVABLES') { label = text('Còn phải thu', 'Outstanding'); value = money((data as ReceivableReportRow[]).reduce((sum, item) => sum + Number(item.outstandingAmount), 0)) }
  return <div className="rounded-xl bg-forest p-3 text-white sm:col-start-4"><div className="text-xs text-emerald-100">{label}</div><div className="mt-1 truncate text-xl font-extrabold">{value}</div></div>
}

function ReportContent({ type, data }: { type: ReportType; data: ReportRow[] }) {
  const { locale, money, text } = useI18n()
  if (!data.length) return <Card><Empty text={text('Không có dữ liệu trong khoảng thời gian đã chọn.', 'No data is available for the selected period.')}/></Card>
  if (type === 'REVENUE') {
    const rows = data as RevenueBucket[]
    return <div className="grid gap-5 xl:grid-cols-[1.6fr_1fr]"><Card><div className="h-96"><ResponsiveContainer width="100%" height="100%"><BarChart data={rows}><CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey="period" tickFormatter={value => new Date(value).toLocaleDateString(locale)} tick={{ fontSize: 11 }}/><YAxis tickFormatter={value => new Intl.NumberFormat(locale, { notation: 'compact' }).format(value)} tick={{ fontSize: 11 }}/><Tooltip formatter={value => money(Number(value))}/><Bar dataKey="revenue" fill="#286052" radius={[7,7,0,0]}/></BarChart></ResponsiveContainer></div></Card><Card><h2 className="font-display text-xl font-bold">{text('Chi tiết kỳ', 'Period details')}</h2><div className="mt-4 max-h-84 space-y-2 overflow-y-auto">{rows.map(row => <div key={row.period} className="flex justify-between rounded-xl bg-slate-50 p-3 text-sm"><div><div className="font-semibold">{new Date(row.period).toLocaleDateString(locale)}</div><div className="text-xs text-ink-soft">{row.invoiceCount} {text('hóa đơn', 'invoices')}</div></div><div className="font-bold">{money(row.revenue)}</div></div>)}</div></Card></div>
  }
  if (type === 'OCCUPANCY') return <ReportTable headers={[text('Hạng phòng','Room class'),text('Số phòng','Rooms'),text('Giờ sử dụng','Occupied hours'),text('Giờ khả dụng','Available hours'),text('Công suất','Occupancy'),text('Doanh thu phòng','Room revenue')]} rows={(data as OccupancyReportRow[]).map(row => [row.roomTypeName,row.roomCount,Number(row.occupiedHours).toLocaleString(locale),Number(row.availableHours).toLocaleString(locale),`${row.occupancyRate}%`,money(row.roomRevenue)])}/>
  if (type === 'SERVICES') return <ReportTable headers={[text('Dịch vụ','Service'),text('Số lượng','Quantity'),text('Đơn vị','Unit'),text('Số booking','Bookings'),text('Doanh thu','Revenue')]} rows={(data as ServiceSalesReportRow[]).map(row => [row.serviceName,Number(row.quantity).toLocaleString(locale),row.unit,row.bookingCount,money(row.revenue)])}/>
  return <ReportTable headers={[text('Hóa đơn','Invoice'),text('Khách hàng','Guest'),text('Ngày phát hành','Issued'),text('Tổng tiền','Total'),text('Đã thu','Paid'),text('Còn phải thu','Outstanding'),text('Tình trạng','Status')]} rows={(data as ReceivableReportRow[]).map(row => [row.invoiceNumber,row.customerName,new Date(row.issuedAt).toLocaleDateString(locale),money(row.grandTotal),money(row.paidAmount),money(row.outstandingAmount),<Badge tone={statusTone(row.overdueDays > 0 ? 'INACTIVE' : 'PENDING')}>{row.overdueDays > 0 ? `${text('Quá hạn','Overdue')} ${row.overdueDays} ${text('ngày','days')}` : text('Trong hạn','Current')}</Badge>])}/>
}

function ReportTable({ headers, rows }: { headers: string[]; rows: (string | number | React.ReactNode)[][] }) {
  return <Card><div className="table-shell"><table className="data-table"><thead><tr>{headers.map(header => <th key={header}>{header}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={index}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>)}</tbody></table></div></Card>
}

function csvData(type: ReportType, data: ReportRow[], language: Language) {
  const pick = (vi: string, en: string) => language === 'vi' ? vi : en
  if (type === 'REVENUE') return { headers: [pick('Kỳ','Period'),pick('Số hóa đơn','Invoices'),pick('Doanh thu','Revenue')], rows: (data as RevenueBucket[]).map(row => [row.period,row.invoiceCount,row.revenue]) }
  if (type === 'OCCUPANCY') return { headers: [pick('Hạng phòng','Room class'),pick('Số phòng','Rooms'),pick('Giờ sử dụng','Occupied hours'),pick('Giờ khả dụng','Available hours'),pick('Công suất (%)','Occupancy (%)'),pick('Doanh thu','Revenue')], rows: (data as OccupancyReportRow[]).map(row => [row.roomTypeName,row.roomCount,row.occupiedHours,row.availableHours,row.occupancyRate,row.roomRevenue]) }
  if (type === 'SERVICES') return { headers: [pick('Dịch vụ','Service'),pick('Số lượng','Quantity'),pick('Đơn vị','Unit'),pick('Số booking','Bookings'),pick('Doanh thu','Revenue')], rows: (data as ServiceSalesReportRow[]).map(row => [row.serviceName,row.quantity,row.unit,row.bookingCount,row.revenue]) }
  return { headers: [pick('Hóa đơn','Invoice'),pick('Khách hàng','Guest'),pick('Ngày phát hành','Issued'),pick('Tổng tiền','Total'),pick('Đã thu','Paid'),pick('Còn phải thu','Outstanding'),pick('Quá hạn (ngày)','Overdue (days)')], rows: (data as ReceivableReportRow[]).map(row => [row.invoiceNumber,row.customerName,row.issuedAt,row.grandTotal,row.paidAmount,row.outstandingAmount,row.overdueDays]) }
}

function saveBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = fileName; anchor.click(); URL.revokeObjectURL(url)
}
