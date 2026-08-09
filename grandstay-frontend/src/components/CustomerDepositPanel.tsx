import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, Clock3, ExternalLink, ShieldCheck, WalletCards } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { api, errorMessage } from '../api/client'
import type { DepositQuote, SelfPayment, VnPayCheckout } from '../api/types'
import { Badge, Button, Loading, statusTone } from './ui'

const money = (value: number, currency = 'VND') => new Intl.NumberFormat('vi-VN', {
  style: 'currency', currency, maximumFractionDigits: 0,
}).format(Number(value))

const paymentLabels: Record<string, string> = {
  PENDING: 'Đang chờ',
  COMPLETED: 'Đã thanh toán',
  FAILED: 'Thất bại',
  CANCELLED: 'Đã hủy',
  REFUNDED: 'Đã hoàn tiền',
  PARTIALLY_REFUNDED: 'Hoàn một phần',
}

export function CustomerDepositPanel({ bookingId }: { bookingId: string }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const quote = useQuery({
    queryKey: ['self-deposit', bookingId],
    queryFn: () => api.get<DepositQuote>(`/self/payments/bookings/${bookingId}/deposit`)
      .then(response => response.data),
  })
  const checkout = useMutation({
    mutationFn: () => api.post<VnPayCheckout>(`/self/payments/bookings/${bookingId}/vnpay`)
      .then(response => response.data),
    onSuccess: data => {
      queryClient.invalidateQueries({ queryKey: ['self-deposit', bookingId] })
      window.location.assign(data.payUrl)
    },
    onError: error => toast.error(errorMessage(error)),
  })
  if (quote.isLoading) return <div className="rounded-2xl border border-slate-200 p-4"><Loading text="Đang tính tiền cọc…"/></div>
  if (quote.error || !quote.data) return <div role="alert" className="rounded-2xl bg-red-50 p-4 text-sm text-red-700">{errorMessage(quote.error)}</div>

  const data = quote.data
  const pending = data.payments.find(payment => payment.status === 'PENDING')
  const fullyPaid = data.remainingDeposit <= 0
  const canCreate = data.bookingStatus === 'CONFIRMED' && data.vnpayEnabled
    && !data.hasPendingPayment && !fullyPaid

  return <section className="rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 to-white p-4 sm:p-5">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <div className="flex items-center gap-2 text-violet-800"><WalletCards size={19}/><h3 className="font-bold">Thanh toán tiền cọc</h3></div>
        <p className="mt-1 text-xs leading-5 text-ink-soft">Tiền cọc được hệ thống tính bằng {Number(data.depositPercent).toLocaleString('vi-VN')}% giá trị phòng dự kiến sau ưu đãi.</p>
      </div>
      <Badge tone={fullyPaid ? 'green' : data.hasPendingPayment ? 'gold' : 'neutral'}>
        {fullyPaid ? 'Đã đủ tiền cọc' : data.hasPendingPayment ? 'Đang xử lý' : 'Chưa thanh toán'}
      </Badge>
    </div>

    <div className="mt-4 grid gap-3 sm:grid-cols-3">
      <Metric label="Tổng dự kiến" value={money(data.estimatedTotal, data.currency)}/>
      <Metric label="Cọc cần thanh toán" value={money(data.requiredDeposit, data.currency)}/>
      <Metric label="Còn phải cọc" value={money(data.remainingDeposit, data.currency)} highlight={!fullyPaid}/>
    </div>

    {data.discountAmount > 0 && <p className="mt-3 text-xs text-emerald-700">Đã áp dụng ưu đãi {money(data.discountAmount, data.currency)} trước khi tính tiền cọc.</p>}

    <div className="mt-4 flex flex-wrap items-center gap-3">
      {canCreate && <Button loading={checkout.isPending} onClick={() => checkout.mutate()}>
        <ExternalLink size={16}/>Thanh toán qua VNPay
      </Button>}
      {pending && <Button variant="secondary" onClick={() => navigate(`/payment/vnpay/result?result=PROCESSING&paymentId=${pending.id}&bookingId=${bookingId}`)}>
        <Clock3 size={16}/>Kiểm tra giao dịch đang chờ
      </Button>}
      {fullyPaid && <span className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-700"><CheckCircle2 size={17}/>Booking đã đáp ứng mức cọc yêu cầu.</span>}
      {data.bookingStatus === 'CONFIRMED' && !data.vnpayEnabled && !fullyPaid && <span className="text-sm text-amber-700">VNPay chưa được cấu hình; vui lòng liên hệ lễ tân để thanh toán cọc.</span>}
      {!['CONFIRMED'].includes(data.bookingStatus) && !fullyPaid && <span className="text-sm text-ink-soft">Chỉ booking đã xác nhận mới có thể thanh toán cọc trực tuyến.</span>}
    </div>

    {data.payments.length > 0 && <div className="mt-5 border-t border-violet-100 pt-4">
      <div className="mb-2 flex items-center gap-2 text-sm font-bold"><ShieldCheck size={16} className="text-violet-700"/>Lịch sử tiền cọc</div>
      <div className="space-y-2">{data.payments.map(payment => <PaymentRow key={payment.id} payment={payment}/>)}</div>
    </div>}
    {data.vnpayEnabled && <p className="mt-4 text-[11px] leading-5 text-ink-soft">Bạn sẽ được chuyển sang cổng VNPay để chọn QR, thẻ nội địa hoặc thẻ quốc tế. GrandStay chỉ ghi nhận tiền sau khi VNPay xác nhận giao dịch.</p>}
  </section>
}

function Metric({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return <div className={`rounded-xl border px-3 py-3 ${highlight ? 'border-violet-200 bg-violet-100/60' : 'border-slate-200 bg-white/80'}`}>
    <span className="text-xs text-ink-soft">{label}</span>
    <p className={`mt-1 font-bold ${highlight ? 'text-violet-800' : 'text-ink'}`}>{value}</p>
  </div>
}

function PaymentRow({ payment }: { payment: SelfPayment }) {
  return <div className="flex flex-col gap-1 rounded-xl bg-white/80 px-3 py-2 text-xs sm:flex-row sm:items-center sm:justify-between">
    <div><strong>{payment.transactionCode}</strong><span className="ml-2 text-ink-soft">{new Date(payment.createdAt).toLocaleString('vi-VN')}</span></div>
    <div className="flex items-center gap-2"><span className="font-semibold">{money(payment.amount, payment.currency)}</span><Badge tone={statusTone(payment.status)}>{paymentLabels[payment.status] ?? payment.status}</Badge></div>
  </div>
}
