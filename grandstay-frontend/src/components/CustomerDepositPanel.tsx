import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, Clock3, ExternalLink, ShieldCheck, WalletCards } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { api, errorMessage } from '../api/client'
import type { DepositQuote, SelfPayment, VnPayCheckout } from '../api/types'
import { Badge, Button, Loading, statusTone } from './ui'
import { useI18n } from '../i18n'

const paymentLabels: Record<string, string> = {
  PENDING: 'Đang chờ',
  COMPLETED: 'Đã thanh toán',
  FAILED: 'Thất bại',
  CANCELLED: 'Đã hủy',
  REFUNDED: 'Đã hoàn tiền',
  PARTIALLY_REFUNDED: 'Hoàn một phần',
}
const paymentLabelsEn: Record<string, string> = { PENDING: 'Pending', COMPLETED: 'Paid', FAILED: 'Failed', CANCELLED: 'Cancelled', REFUNDED: 'Refunded', PARTIALLY_REFUNDED: 'Partially refunded' }

export function CustomerDepositPanel({ bookingId }: { bookingId: string }) {
  const { language, money } = useI18n()
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
  if (quote.isLoading) return <div className="rounded-2xl border border-slate-200 p-4"><Loading text={language === 'vi' ? 'Đang tính tiền cọc…' : 'Calculating deposit…'}/></div>
  if (quote.error || !quote.data) return <div role="alert" className="rounded-2xl bg-red-50 p-4 text-sm text-red-700">{errorMessage(quote.error)}</div>

  const data = quote.data
  const pending = data.payments.find(payment => payment.status === 'PENDING')
  const fullyPaid = data.remainingDeposit <= 0
  const canCreate = data.bookingStatus === 'CONFIRMED' && data.vnpayEnabled
    && !data.hasPendingPayment && !fullyPaid

  return <section className="rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 to-white p-4 sm:p-5">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <div className="flex items-center gap-2 text-violet-800"><WalletCards size={19}/><h3 className="font-bold">{language === 'vi' ? 'Thanh toán tiền cọc' : 'Deposit payment'}</h3></div>
        <p className="mt-1 text-xs leading-5 text-ink-soft">{language === 'vi' ? `Tiền cọc được tính bằng ${Number(data.depositPercent)}% giá trị phòng dự kiến sau ưu đãi.` : `The deposit is ${Number(data.depositPercent)}% of the estimated room total after discounts.`}</p>
      </div>
      <Badge tone={fullyPaid ? 'green' : data.hasPendingPayment ? 'gold' : 'neutral'}>
        {fullyPaid ? (language === 'vi' ? 'Đã đủ tiền cọc' : 'Deposit paid') : data.hasPendingPayment ? (language === 'vi' ? 'Đang xử lý' : 'Processing') : (language === 'vi' ? 'Chưa thanh toán' : 'Not paid')}
      </Badge>
    </div>

    <div className="mt-4 grid gap-3 sm:grid-cols-3">
      <Metric label={language === 'vi' ? 'Tổng dự kiến' : 'Estimated total'} value={money(data.estimatedTotal, data.currency)}/>
      <Metric label={language === 'vi' ? 'Cọc cần thanh toán' : 'Required deposit'} value={money(data.requiredDeposit, data.currency)}/>
      <Metric label={language === 'vi' ? 'Còn phải cọc' : 'Deposit remaining'} value={money(data.remainingDeposit, data.currency)} highlight={!fullyPaid}/>
    </div>

    {data.discountAmount > 0 && <p className="mt-3 text-xs text-emerald-700">{language === 'vi' ? `Đã áp dụng ưu đãi ${money(data.discountAmount, data.currency)} trước khi tính tiền cọc.` : `${money(data.discountAmount, data.currency)} discount applied before calculating the deposit.`}</p>}

    <div className="mt-4 flex flex-wrap items-center gap-3">
      {canCreate && <Button loading={checkout.isPending} onClick={() => checkout.mutate()}>
        <ExternalLink size={16}/>{language === 'vi' ? 'Thanh toán qua VNPay' : 'Pay with VNPay'}
      </Button>}
      {pending && <Button variant="secondary" onClick={() => navigate(`/payment/vnpay/result?result=PROCESSING&paymentId=${pending.id}&bookingId=${bookingId}`)}>
        <Clock3 size={16}/>{language === 'vi' ? 'Kiểm tra giao dịch đang chờ' : 'Check pending payment'}
      </Button>}
      {fullyPaid && <span className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-700"><CheckCircle2 size={17}/>{language === 'vi' ? 'Đặt phòng đã đáp ứng mức cọc yêu cầu.' : 'The required deposit has been paid.'}</span>}
      {data.bookingStatus === 'CONFIRMED' && !data.vnpayEnabled && !fullyPaid && <span className="text-sm text-amber-700">VNPay chưa được cấu hình; vui lòng liên hệ lễ tân để thanh toán cọc.</span>}
      {!['CONFIRMED'].includes(data.bookingStatus) && !fullyPaid && <span className="text-sm text-ink-soft">Chỉ booking đã xác nhận mới có thể thanh toán cọc trực tuyến.</span>}
    </div>

    {data.payments.length > 0 && <div className="mt-5 border-t border-violet-100 pt-4">
      <div className="mb-2 flex items-center gap-2 text-sm font-bold"><ShieldCheck size={16} className="text-violet-700"/>{language === 'vi' ? 'Lịch sử tiền cọc' : 'Deposit history'}</div>
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
  const { language, dateTime, money } = useI18n()
  return <div className="flex flex-col gap-1 rounded-xl bg-white/80 px-3 py-2 text-xs sm:flex-row sm:items-center sm:justify-between">
    <div><strong>{payment.transactionCode}</strong><span className="ml-2 text-ink-soft">{dateTime(payment.createdAt)}</span></div>
    <div className="flex items-center gap-2"><span className="font-semibold">{money(payment.amount, payment.currency)}</span><Badge tone={statusTone(payment.status)}>{(language === 'vi' ? paymentLabels : paymentLabelsEn)[payment.status] ?? payment.status}</Badge></div>
  </div>
}
