import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Banknote, CheckCircle2, CreditCard, Download, Eye, Printer, QrCode, ReceiptText, RefreshCw, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'
import { useSearchParams } from 'react-router-dom'
import { api, errorMessage } from '../api/client'
import type { Booking, Page } from '../api/types'
import { Badge, Button, Card, Empty, ErrorState, Loading, Modal, PageHeader, statusTone } from '../components/ui'
import { useAuth } from '../auth/AuthProvider'
import { useI18n } from '../i18n'

type Balance = { invoiced: number; netPaid: number; outstanding: number }
type Invoice = { id: string; invoiceNumber: string; status: string; issuedAt?: string; customerName: string; currency: string; grandTotal: number }
type InvoiceItem = { id: string; description: string; unit: string; quantity: number; unitPrice: number; taxAmount: number; lineTotal: number }
type InvoiceView = { invoice: Invoice & { roomCharge: number; serviceCharge: number; extraFee: number; discountAmount: number; taxAmount: number; billingAddress?: string }; items: InvoiceItem[] }
type PaymentRecord = { id: string; originalPaymentId?: string; transactionCode: string; type: string; purpose: string; method: string; status: string; amount: number; currency: string; paidAt?: string; provider?: string; providerOrderId?: string; providerReference?: string; failureReason?: string; createdAt: string }
type VnPayCheckout = { paymentId: string; bookingId: string; txnRef: string; payUrl: string; status: string; amount: number; currency: string }

function transactionCode() {
  const now = new Date()
  const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`
  return `GS-${stamp}`
}

export function BillingPage() {
  const { language, locale, money, dateTime, text } = useI18n()
  const bookingStatuses: Record<string, string> = language === 'vi' ? { PENDING: 'Chờ xác nhận', CONFIRMED: 'Đã xác nhận', CHECKED_IN: 'Đang lưu trú', CHECKED_OUT: 'Đã trả phòng', CANCELLED: 'Đã hủy', NO_SHOW: 'Không đến' } : { PENDING: 'Pending', CONFIRMED: 'Confirmed', CHECKED_IN: 'Checked in', CHECKED_OUT: 'Checked out', CANCELLED: 'Cancelled', NO_SHOW: 'No-show' }
  const paymentStatuses: Record<string, string> = language === 'vi' ? { PENDING: 'Chờ hoàn tất', COMPLETED: 'Hoàn tất', FAILED: 'Thất bại', PARTIALLY_REFUNDED: 'Hoàn một phần', REFUNDED: 'Đã hoàn tiền' } : { PENDING: 'Pending', COMPLETED: 'Completed', FAILED: 'Failed', PARTIALLY_REFUNDED: 'Partially refunded', REFUNDED: 'Refunded' }
  const invoiceStatuses: Record<string, string> = language === 'vi' ? { DRAFT: 'Bản nháp', ISSUED: 'Đã phát hành', PAID: 'Đã thanh toán', VOID: 'Đã hủy' } : { DRAFT: 'Draft', ISSUED: 'Issued', PAID: 'Paid', VOID: 'Void' }
  const paymentMethods: Record<string, string> = language === 'vi' ? { CASH: 'Tiền mặt', CARD: 'Thẻ', BANK_TRANSFER: 'Chuyển khoản', QR: 'Mã QR', MOMO: 'MoMo (đã ngừng)', VNPAY: 'VNPay' } : { CASH: 'Cash', CARD: 'Card', BANK_TRANSFER: 'Bank transfer', QR: 'QR code', MOMO: 'MoMo (retired)', VNPAY: 'VNPay' }
  const [searchParams, setSearchParams] = useSearchParams()
  const initialBookingId = searchParams.get('bookingId') ?? ''
  const [lookup, setLookup] = useState(initialBookingId)
  const [invoiceId, setInvoiceId] = useState<string | null>(null)
  const [refund, setRefund] = useState<PaymentRecord | null>(null)
  const [payment, setPayment] = useState({ transactionCode: transactionCode(), purpose: 'SETTLEMENT', method: 'CASH', amount: 0 })
  const { can } = useAuth()
  const queryClient = useQueryClient()
  const bookings = useQuery({ queryKey: ['bookings', 'cashier-picker'], queryFn: () => api.get<Page<Booking>>('/bookings', { params: { size: 100, sort: 'createdAt,desc' } }).then(response => response.data.content) })
  const balance = useQuery({ queryKey: ['balance', lookup], enabled: Boolean(lookup), queryFn: () => api.get<Balance>(`/payments/bookings/${lookup}/balance`).then(response => response.data) })
  const invoices = useQuery({ queryKey: ['invoices', lookup], enabled: Boolean(lookup), queryFn: () => api.get<Invoice[]>(`/invoices/bookings/${lookup}`).then(response => response.data) })
  const payments = useQuery({ queryKey: ['payments', lookup], enabled: Boolean(lookup), queryFn: () => api.get<PaymentRecord[]>(`/payments/bookings/${lookup}`).then(response => response.data) })
  const vnpayConfig = useQuery({ queryKey: ['vnpay-config'], queryFn: () => api.get<{ enabled: boolean; configured: boolean; sandbox: boolean }>('/payments/vnpay/config').then(response => response.data) })
  const selectedBooking = bookings.data?.find(booking => booking.id === lookup)
  const outstanding = Number(balance.data?.outstanding ?? 0)

  const refreshCashier = () => {
    queryClient.invalidateQueries({ queryKey: ['balance', lookup] })
    queryClient.invalidateQueries({ queryKey: ['invoices', lookup] })
    queryClient.invalidateQueries({ queryKey: ['payments', lookup] })
  }
  const chooseBooking = (id: string) => {
    setLookup(id)
    setSearchParams(id ? { bookingId: id } : {}, { replace: true })
    setPayment(previous => ({ ...previous, amount: 0, transactionCode: transactionCode() }))
  }
  const record = useMutation({
    mutationFn: () => api.post('/payments', { bookingId: lookup, transactionCode: payment.transactionCode, purpose: payment.purpose, method: payment.method, amount: payment.amount, currency: 'VND', completed: true, providerReference: null, notes: null }),
    onSuccess: () => { toast.success(text('Đã ghi nhận thanh toán.', 'Payment recorded.')); setPayment(previous => ({ ...previous, transactionCode: transactionCode(), amount: 0 })); refreshCashier() },
    onError: error => toast.error(errorMessage(error)),
  })
  const vnpay = useMutation({
    mutationFn: () => api.post<VnPayCheckout>('/payments/vnpay', { bookingId: lookup, purpose: payment.purpose, amount: payment.amount }).then(response => response.data),
    onSuccess: checkout => {
      toast.success(text('Đã tạo giao dịch VNPay. Đang chuyển sang cổng thanh toán…', 'VNPay transaction created. Redirecting to payment…'))
      window.location.assign(checkout.payUrl)
    },
    onError: error => toast.error(errorMessage(error)),
  })
  const complete = useMutation({
    mutationFn: (id: string) => api.post(`/payments/${id}/complete`),
    onSuccess: () => { toast.success(text('Đã hoàn tất giao dịch.', 'Transaction completed.')); refreshCashier() },
    onError: error => toast.error(errorMessage(error)),
  })
  const reconcileVnPay = useMutation({
    mutationFn: (id: string) => api.post(`/payments/vnpay/${id}/reconcile`),
    onSuccess: () => { toast.success(text('Đã đối soát giao dịch VNPay.', 'VNPay transaction reconciled.')); refreshCashier() },
    onError: error => toast.error(errorMessage(error)),
  })

  return <>
    <PageHeader title={text('Thu ngân & hóa đơn', 'Billing & invoices')} description={text('Đối soát công nợ, ghi nhận thanh toán, hoàn tiền và in hóa đơn cho khách.', 'Reconcile balances, record payments, process refunds and print guest invoices.')}/>
    <Card className="mb-5">
      <label htmlFor="cashier-booking" className="label">{text('Chọn hồ sơ đặt phòng', 'Select booking')}</label>
      <select id="cashier-booking" className="field" value={lookup} onChange={event => chooseBooking(event.target.value)} disabled={bookings.isLoading}>
        <option value="">{bookings.isLoading ? text('Đang tải danh sách…', 'Loading bookings…') : text('Chọn theo mã đặt phòng', 'Select by booking number')}</option>
        {bookings.data?.map(booking => <option key={booking.id} value={booking.id}>{booking.bookingNumber} · {bookingStatuses[booking.status] ?? booking.status} · {new Date(booking.expectedCheckInAt).toLocaleDateString(locale)}</option>)}
      </select>
      {bookings.error && <div className="mt-3"><ErrorState message={errorMessage(bookings.error)} onRetry={() => void bookings.refetch()}/></div>}
      {lookup && !selectedBooking && <p className="mt-2 text-xs text-ink-soft">{text('Hồ sơ được mở từ liên kết trực tiếp:', 'Record opened from a direct link:')} <span className="font-mono">{lookup}</span></p>}
      {balance.error && <p role="alert" className="mt-3 text-sm text-red-700">{errorMessage(balance.error)}</p>}
    </Card>

    {!lookup ? <Card><Empty text={text('Chọn một hồ sơ đặt phòng để bắt đầu đối soát.', 'Select a booking to begin reconciliation.')}/></Card> : <div className="grid gap-5 xl:grid-cols-[1.25fr_.75fr]">
      <div className="space-y-5">
        <Card>
          <div className="mb-4 flex items-center justify-between"><div><h2 className="font-display text-xl font-bold">{text('Hóa đơn', 'Invoices')}</h2><p className="text-xs text-ink-soft">{text('Bấm vào hóa đơn để xem và in chi tiết', 'Open an invoice to view or print details')}</p></div><ReceiptText className="text-gold" size={22}/></div>
          {invoices.error ? <ErrorState message={errorMessage(invoices.error)} onRetry={() => void invoices.refetch()}/> : invoices.isLoading ? <Loading text={text('Đang tải hóa đơn…', 'Loading invoices…')}/> : <div className="space-y-3">{invoices.data?.map(invoice => <button type="button" key={invoice.id} onClick={() => setInvoiceId(invoice.id)} className="group flex w-full items-center justify-between gap-3 rounded-2xl border border-slate-200 p-4 text-left transition hover:-translate-y-0.5 hover:border-gold/50 hover:shadow-md"><div className="flex min-w-0 items-center gap-3"><div className="grid size-10 shrink-0 place-items-center rounded-xl bg-amber-50 text-amber-700"><ReceiptText size={20}/></div><div className="min-w-0"><p className="truncate font-bold">{invoice.invoiceNumber}</p><p className="truncate text-xs text-ink-soft">{invoice.customerName} · {invoiceStatuses[invoice.status] ?? invoice.status}</p></div></div><div className="flex shrink-0 items-center gap-3"><span className="font-bold">{money(invoice.grandTotal, invoice.currency)}</span><Eye size={17} className="text-slate-400 group-hover:text-gold"/></div></button>)}{invoices.data?.length === 0 && <Empty text={text('Hóa đơn được phát hành sau khi trả phòng.', 'Invoices are issued after check-out.')}/>}</div>}
        </Card>

        <Card>
          <h2 className="font-display text-xl font-bold">{text('Lịch sử giao dịch', 'Transaction history')}</h2>
          <p className="mb-4 text-xs text-ink-soft">{text('Mọi lần thanh toán và hoàn tiền của hồ sơ', 'All payments and refunds for this booking')}</p>
          {payments.error ? <ErrorState message={errorMessage(payments.error)} onRetry={() => void payments.refetch()}/> : payments.isLoading ? <Loading text={text('Đang tải giao dịch…', 'Loading transactions…')}/> : <div className="table-shell"><table className="data-table"><thead><tr><th>{text('Mã giao dịch', 'Transaction code')}</th><th>{text('Phương thức', 'Method')}</th><th>{text('Trạng thái', 'Status')}</th><th>{text('Số tiền', 'Amount')}</th><th></th></tr></thead><tbody>{payments.data?.map(item => <tr key={item.id}><td><strong>{item.transactionCode}</strong><div className="text-xs text-ink-soft">{item.type === 'REFUND' ? text('Hoàn tiền', 'Refund') : item.purpose === 'DEPOSIT' ? text('Tiền cọc', 'Deposit') : text('Thanh toán', 'Payment')} · {dateTime(item.paidAt ?? item.createdAt)}</div>{item.providerReference && <div className="mt-1 text-xs text-ink-soft">{text('Mã đối tác', 'Provider reference')}: {item.providerReference}</div>}</td><td>{paymentMethods[item.method] ?? item.method}</td><td><Badge tone={statusTone(item.status)}>{paymentStatuses[item.status] ?? item.status}</Badge>{item.failureReason && <div className="mt-1 max-w-48 text-xs text-red-600">{item.failureReason}</div>}</td><td className={item.type === 'REFUND' ? 'font-bold text-red-700' : 'font-bold'}>{item.type === 'REFUND' ? '−' : ''}{money(item.amount, item.currency)}</td><td><div className="flex justify-end gap-2">{item.status === 'PENDING' && !item.provider && can('payment:write') && <Button variant="secondary" loading={complete.isPending} onClick={() => complete.mutate(item.id)}><CheckCircle2 size={15}/>{text('Hoàn tất', 'Complete')}</Button>}{item.status === 'PENDING' && item.provider === 'VNPAY' && can('payment:write') && <Button variant="secondary" loading={reconcileVnPay.isPending} onClick={() => reconcileVnPay.mutate(item.id)}><RefreshCw size={15}/>{text('Đối soát', 'Reconcile')}</Button>}{item.type === 'PAYMENT' && !item.provider && ['COMPLETED','PARTIALLY_REFUNDED'].includes(item.status) && can('payment:write') && <Button variant="secondary" onClick={() => setRefund(item)}><RotateCcw size={15}/>{text('Hoàn tiền', 'Refund')}</Button>}</div></td></tr>)}</tbody></table>{!payments.data?.length && <Empty text={text('Chưa có giao dịch nào.', 'No transactions yet.')}/>}</div>}
        </Card>
      </div>

      <div className="space-y-5">
        {balance.data && <Card><h2 className="font-display text-xl font-bold">{text('Công nợ', 'Balance')}</h2><div className="mt-5 space-y-3"><Amount label={text('Tổng hóa đơn', 'Invoiced')} value={balance.data.invoiced}/><Amount label={text('Đã thanh toán', 'Paid')} value={balance.data.netPaid}/><div className="border-t border-slate-100 pt-3"><Amount label={text('Còn phải thu', 'Outstanding')} value={balance.data.outstanding} strong/></div></div></Card>}
        {balance.data && can('payment:write') && <Card>
          <h2 className="font-display text-xl font-bold">{text('Ghi nhận thanh toán', 'Record payment')}</h2>
          <div className="mt-5 space-y-4">
            {vnpayConfig.error && <p role="alert" className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">{errorMessage(vnpayConfig.error)}</p>}
            {payment.method !== 'VNPAY' && <label><span className="label">{text('Mã giao dịch', 'Transaction code')}</span><input className="field" value={payment.transactionCode} onChange={event => setPayment(previous => ({ ...previous, transactionCode: event.target.value }))}/></label>}
            <label><span className="label">{text('Mục đích', 'Purpose')}</span><select className="field" value={payment.purpose} onChange={event => setPayment(previous => ({ ...previous, purpose: event.target.value }))}><option value="SETTLEMENT">{text('Thanh toán hóa đơn', 'Invoice settlement')}</option><option value="DEPOSIT">{text('Tiền cọc', 'Deposit')}</option><option value="EXTRA">{text('Khoản thu khác', 'Other charge')}</option></select></label>
            <label><span className="label">{text('Phương thức', 'Method')}</span><select className="field" value={payment.method} onChange={event => setPayment(previous => ({ ...previous, method: event.target.value }))}><option value="CASH">{text('Tiền mặt', 'Cash')}</option><option value="CARD">{text('Thẻ', 'Card')}</option><option value="BANK_TRANSFER">{text('Chuyển khoản', 'Bank transfer')}</option><option value="QR">{text('Chuyển khoản QR thủ công', 'Manual QR transfer')}</option>{vnpayConfig.data?.enabled && <option value="VNPAY">VNPay Sandbox</option>}</select></label>
            {payment.method === 'VNPAY' && <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900"><div className="flex items-center gap-2 font-bold"><QrCode size={18}/>{text('Thanh toán trực tuyến qua VNPay', 'Online payment via VNPay')}</div><p className="mt-1 leading-6">{text('Khách sẽ chọn QR, thẻ nội địa hoặc thẻ quốc tế tại VNPay. Giao dịch chỉ được ghi nhận sau khi đối soát thành công.', 'The guest can select QR, a domestic card or an international card on VNPay. Payment is recorded only after successful reconciliation.')}</p></div>}
            <label><span className="label">{text('Số tiền', 'Amount')}</span><div className="relative"><input type="number" min={payment.method === 'VNPAY' ? 5000 : 1} max={payment.purpose === 'SETTLEMENT' ? outstanding || undefined : undefined} className="field field-with-inline-action" value={payment.amount || ''} onChange={event => setPayment(previous => ({ ...previous, amount: Number(event.target.value) }))}/>{outstanding > 0 && payment.purpose === 'SETTLEMENT' && <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg px-2 py-1 text-xs font-bold text-forest hover:bg-emerald-50" onClick={() => setPayment(previous => ({ ...previous, amount: outstanding }))}>{text('Thu đủ', 'Pay full')}</button>}</div></label>
            <Button className="w-full" loading={record.isPending || vnpay.isPending} disabled={(payment.method !== 'VNPAY' && !payment.transactionCode.trim()) || payment.amount < (payment.method === 'VNPAY' ? 5000 : 1) || (payment.purpose === 'SETTLEMENT' && (outstanding <= 0 || payment.amount > outstanding))} onClick={() => payment.method === 'VNPAY' ? vnpay.mutate() : record.mutate()}>{payment.method === 'CASH' ? <Banknote size={18}/> : payment.method === 'VNPAY' ? <QrCode size={18}/> : <CreditCard size={18}/>} {payment.method === 'VNPAY' ? text('Thanh toán qua VNPay', 'Pay with VNPay') : text('Xác nhận đã thu', 'Confirm payment')}</Button>
          </div>
        </Card>}
      </div>
    </div>}
    {invoiceId && <InvoiceModal invoiceId={invoiceId} onClose={() => setInvoiceId(null)}/>} 
    {refund && <RefundModal payment={refund} onClose={() => setRefund(null)} onSaved={() => { setRefund(null); refreshCashier() }}/>} 
  </>
}

function Amount({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  const { money } = useI18n()
  return <div className={`flex justify-between gap-3 ${strong ? 'text-lg font-extrabold text-forest' : 'text-sm'}`}><span>{label}</span><span>{money(value)}</span></div>
}

function InvoiceModal({ invoiceId, onClose }: { invoiceId: string; onClose: () => void }) {
  const { language, money, dateTime, text } = useI18n()
  const invoiceStatuses: Record<string, string> = language === 'vi' ? { DRAFT: 'Bản nháp', ISSUED: 'Đã phát hành', PAID: 'Đã thanh toán', VOID: 'Đã hủy' } : { DRAFT: 'Draft', ISSUED: 'Issued', PAID: 'Paid', VOID: 'Void' }
  const query = useQuery({ queryKey: ['invoice', invoiceId], queryFn: () => api.get<InvoiceView>(`/invoices/${invoiceId}`).then(response => response.data) })
  const view = query.data
  const downloadPdf = useMutation({
    mutationFn: () => api.get<Blob>(`/invoices/${invoiceId}/pdf`, { responseType: 'blob' }).then(response => response.data),
    onSuccess: blob => {
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `GrandStay-${view?.invoice.invoiceNumber ?? 'invoice'}.pdf`
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(url)
      toast.success(text('Đã tải hóa đơn PDF.', 'Invoice PDF downloaded.'))
    },
    onError: error => toast.error(errorMessage(error)),
  })
  const print = () => {
    const source = document.getElementById('invoice-print-area')
    const popup = window.open('', '_blank', 'width=900,height=760')
    if (!source || !popup) { toast.error(text('Trình duyệt đang chặn cửa sổ in.', 'Your browser blocked the print window.')); return }
    popup.document.title = view?.invoice.invoiceNumber ?? 'GrandStay Invoice'
    const style = popup.document.createElement('style')
    style.textContent = 'body{font-family:Segoe UI,Arial,sans-serif;color:#102a43;padding:36px;max-width:900px;margin:auto}h2{font-family:Georgia,serif}table{width:100%;border-collapse:collapse;margin-top:20px}th,td{padding:10px;border-bottom:1px solid #e5e7eb;text-align:left}th{font-size:12px;text-transform:uppercase;color:#64748b}.total{font-size:20px;font-weight:800}@media print{body{padding:0}}'
    popup.document.head.appendChild(style)
    popup.document.body.appendChild(source.cloneNode(true))
    popup.focus()
    popup.print()
  }
  return <Modal title={text('Chi tiết hóa đơn', 'Invoice details')} size="xl" onClose={onClose}>
    {query.isLoading ? <Loading/> : query.error || !view ? <p role="alert" className="text-sm text-red-700">{errorMessage(query.error)}</p> : <>
      <div id="invoice-print-area">
        <div className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-5 sm:flex-row"><div><p className="text-xs font-extrabold uppercase tracking-[.2em] text-gold">GrandStay Hotel</p><h2 className="mt-2 font-display text-3xl font-bold">{view.invoice.invoiceNumber}</h2><p className="mt-1 text-sm text-ink-soft">{text('Ngày phát hành', 'Issued')}: {dateTime(view.invoice.issuedAt)}</p></div><div className="sm:text-right"><Badge tone={statusTone(view.invoice.status)}>{invoiceStatuses[view.invoice.status] ?? view.invoice.status}</Badge><p className="mt-3 font-bold">{view.invoice.customerName}</p><p className="text-sm text-ink-soft">{view.invoice.billingAddress}</p></div></div>
        <table className="data-table mt-5"><thead><tr><th>{text('Nội dung', 'Description')}</th><th>{text('SL', 'Qty')}</th><th>{text('Đơn giá', 'Unit price')}</th><th>{text('Thuế', 'Tax')}</th><th>{text('Thành tiền', 'Total')}</th></tr></thead><tbody>{view.items.map(item => <tr key={item.id}><td>{item.description}<div className="text-xs text-ink-soft">/{item.unit}</div></td><td>{Number(item.quantity)}</td><td>{money(item.unitPrice, view.invoice.currency)}</td><td>{money(item.taxAmount, view.invoice.currency)}</td><td className="font-bold">{money(item.lineTotal, view.invoice.currency)}</td></tr>)}</tbody></table>
        <div className="ml-auto mt-5 max-w-sm space-y-2 text-sm"><Amount label={text('Tiền phòng', 'Room charge')} value={view.invoice.roomCharge}/><Amount label={text('Dịch vụ', 'Services')} value={view.invoice.serviceCharge}/><Amount label={text('Phụ phí', 'Extra fees')} value={view.invoice.extraFee}/><Amount label={text('Giảm giá', 'Discount')} value={-Number(view.invoice.discountAmount)}/><Amount label={text('Thuế', 'Tax')} value={view.invoice.taxAmount}/><div className="border-t border-slate-200 pt-3"><Amount label={text('Tổng thanh toán', 'Grand total')} value={view.invoice.grandTotal} strong/></div></div>
      </div>
      <div className="mt-6 flex flex-wrap justify-end gap-3"><Button variant="secondary" onClick={onClose}>{text('Đóng', 'Close')}</Button><Button variant="secondary" onClick={print}><Printer size={17}/>{text('In hóa đơn', 'Print invoice')}</Button><Button loading={downloadPdf.isPending} onClick={() => downloadPdf.mutate()}><Download size={17}/>{text('Tải PDF', 'Download PDF')}</Button></div>
    </>}
  </Modal>
}

function RefundModal({ payment, onClose, onSaved }: { payment: PaymentRecord; onClose: () => void; onSaved: () => void }) {
  const { money, text } = useI18n()
  const [form, setForm] = useState({ transactionCode: `RF-${transactionCode()}`, amount: 0, reason: '' })
  const valid = useMemo(() => form.transactionCode.trim() && form.amount > 0 && form.amount <= Number(payment.amount) && form.reason.trim(), [form, payment.amount])
  const mutation = useMutation({
    mutationFn: () => api.post(`/payments/${payment.id}/refunds`, form),
    onSuccess: () => { toast.success(text('Đã ghi nhận hoàn tiền.', 'Refund recorded.')); onSaved() },
    onError: error => toast.error(errorMessage(error)),
  })
  return <Modal title={text('Hoàn tiền giao dịch', 'Refund transaction')} size="md" onClose={onClose}>
    <div className="mb-5 rounded-2xl bg-slate-50 p-4 text-sm"><div className="flex justify-between"><span>{text('Giao dịch gốc', 'Original transaction')}</span><strong>{payment.transactionCode}</strong></div><div className="mt-2 flex justify-between"><span>{text('Số tiền đã thu', 'Amount paid')}</span><strong>{money(payment.amount, payment.currency)}</strong></div></div>
    <div className="space-y-4"><label><span className="label">{text('Mã giao dịch hoàn', 'Refund transaction code')}</span><input autoFocus className="field" value={form.transactionCode} onChange={event => setForm(previous => ({ ...previous, transactionCode: event.target.value }))}/></label><label><span className="label">{text('Số tiền hoàn', 'Refund amount')}</span><input type="number" min={1} max={payment.amount} className="field" value={form.amount || ''} onChange={event => setForm(previous => ({ ...previous, amount: Number(event.target.value) }))}/></label><label><span className="label">{text('Lý do hoàn tiền', 'Refund reason')}</span><textarea className="field min-h-24" value={form.reason} onChange={event => setForm(previous => ({ ...previous, reason: event.target.value }))}/></label></div>
    <div className="mt-6 flex justify-end gap-3"><Button variant="secondary" onClick={onClose}>{text('Đóng', 'Close')}</Button><Button variant="danger" disabled={!valid} loading={mutation.isPending} onClick={() => mutation.mutate()}><RotateCcw size={16}/>{text('Xác nhận hoàn tiền', 'Confirm refund')}</Button></div>
  </Modal>
}
