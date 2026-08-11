import { useEffect, useRef } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, Clock3, RefreshCw, XCircle } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import { api, errorMessage } from '../api/client'
import { useAuth } from '../auth/AuthProvider'
import { Badge, Button, Card, Loading, PageHeader, statusTone } from '../components/ui'
import { useI18n } from '../i18n'

type PaymentDetails = {
  id: string
  bookingId: string
  transactionCode: string
  status: string
  amount: number
  currency: string
  providerReference?: string
  failureReason?: string
}

export function VnPayPaymentResultPage() {
  const { money, text } = useI18n()
  const [params] = useSearchParams()
  const paymentId = params.get('paymentId') ?? ''
  const bookingId = params.get('bookingId') ?? ''
  const redirectResult = params.get('result') ?? 'INVALID'
  const { hasRole, can } = useAuth()
  const selfService = hasRole('CUSTOMER')
  const queryClient = useQueryClient()
  const autoReconciled = useRef(false)
  const paymentUrl = selfService ? `/self/payments/${paymentId}` : `/payments/${paymentId}`
  const reconcileUrl = selfService
    ? `/self/payments/${paymentId}/vnpay/reconcile`
    : `/payments/vnpay/${paymentId}/reconcile`

  const payment = useQuery({
    queryKey: ['vnpay-result', paymentId, selfService],
    enabled: Boolean(paymentId),
    queryFn: () => api.get<PaymentDetails>(paymentUrl).then(response => response.data),
  })
  const reconcile = useMutation({
    mutationFn: () => api.post(reconcileUrl),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vnpay-result', paymentId, selfService] })
      if (bookingId) {
        queryClient.invalidateQueries({ queryKey: ['self-deposit', bookingId] })
        queryClient.invalidateQueries({ queryKey: ['payments', bookingId] })
        queryClient.invalidateQueries({ queryKey: ['balance', bookingId] })
      }
    },
  })

  useEffect(() => {
    if (!autoReconciled.current && payment.data?.status === 'PENDING'
      && ['PROCESSING', 'FAILED'].includes(redirectResult)) {
      autoReconciled.current = true
      reconcile.mutate()
    }
  }, [payment.data?.status, redirectResult, reconcile])

  const current = payment.data
  const state = current?.status ?? redirectResult
  const error = payment.error ?? reconcile.error

  return <>
    <PageHeader title={text('Kết quả thanh toán VNPay', 'VNPay payment result')} description={text('GrandStay đối chiếu trực tiếp với VNPay trước khi cập nhật tiền cọc hoặc công nợ.', 'GrandStay verifies the transaction directly with VNPay before updating deposits or balances.')}/>
    <div className="mx-auto max-w-2xl">
      <Card className="text-center">
        {payment.isLoading ? <Loading text={text('Đang kiểm tra giao dịch VNPay…', 'Checking VNPay transaction…')}/> : <>
          <StatusIcon status={state}/>
          <h2 className="mt-5 font-display text-2xl font-extrabold">{statusTitle(state, text)}</h2>
          <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-ink-soft">{statusMessage(state, current?.failureReason, error, text)}</p>
          {current && <div className="mx-auto mt-6 max-w-md rounded-2xl bg-slate-50 p-4 text-left text-sm">
            <Row label={text('Mã giao dịch', 'Transaction code')} value={current.transactionCode}/>
            <Row label={text('Phương thức', 'Method')} value="VNPay"/>
            <Row label={text('Số tiền', 'Amount')} value={money(current.amount, current.currency)}/>
            <Row label={text('Trạng thái', 'Status')} value={<Badge tone={statusTone(current.status)}>{statusLabel(current.status, text)}</Badge>}/>
            {current.providerReference && <Row label={text('Mã VNPay', 'VNPay reference')} value={current.providerReference}/>}
          </div>}
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            {bookingId && <Link to={selfService ? `/bookings?bookingId=${bookingId}` : `/billing?bookingId=${bookingId}`}><Button variant="secondary">{selfService ? text('Quay lại đặt phòng', 'Back to booking') : text('Quay lại thu ngân', 'Back to billing')}</Button></Link>}
            {current?.status === 'PENDING' && (can('payment:write') || selfService) && <Button loading={reconcile.isPending} onClick={() => reconcile.mutate()}><RefreshCw size={17}/>{text('Kiểm tra lại VNPay', 'Check VNPay again')}</Button>}
          </div>
        </>}
      </Card>
    </div>
  </>
}

function StatusIcon({ status }: { status: string }) {
  if (status === 'COMPLETED') return <div className="mx-auto grid size-16 place-items-center rounded-full bg-emerald-100 text-emerald-700"><CheckCircle2 size={34}/></div>
  if (status === 'PENDING' || status === 'PROCESSING') return <div className="mx-auto grid size-16 place-items-center rounded-full bg-amber-100 text-amber-700"><Clock3 size={34}/></div>
  return <div className="mx-auto grid size-16 place-items-center rounded-full bg-red-100 text-red-700"><XCircle size={34}/></div>
}

type TextPicker = (vietnamese: string, english: string) => string

function statusLabel(status: string, text: TextPicker) {
  const labels: Record<string, string> = {
    PENDING: text('Đang chờ', 'Pending'), PROCESSING: text('Đang xử lý', 'Processing'),
    COMPLETED: text('Đã thanh toán', 'Completed'), FAILED: text('Thất bại', 'Failed'),
    CANCELLED: text('Đã hủy', 'Cancelled'), REFUNDED: text('Đã hoàn tiền', 'Refunded'),
    PARTIALLY_REFUNDED: text('Hoàn một phần', 'Partially refunded'), INVALID: text('Không hợp lệ', 'Invalid'),
  }
  return labels[status] ?? status
}

function statusTitle(status: string, text: TextPicker) {
  if (status === 'COMPLETED') return text('Thanh toán thành công', 'Payment successful')
  if (status === 'PENDING' || status === 'PROCESSING') return text('Đang chờ VNPay xác nhận', 'Waiting for VNPay confirmation')
  if (status === 'INVALID') return text('Kết quả chuyển hướng không hợp lệ', 'Invalid redirect result')
  return text('Thanh toán chưa thành công', 'Payment unsuccessful')
}

function statusMessage(status: string, failure: string | undefined, error: unknown, text: TextPicker) {
  if (error) return errorMessage(error)
  if (status === 'COMPLETED') return text('Giao dịch đã được xác minh và dữ liệu thanh toán của booking đã được cập nhật.', 'The transaction was verified and the booking payment data has been updated.')
  if (status === 'PENDING' || status === 'PROCESSING') return text('Hệ thống đang đợi IPN hoặc truy vấn trạng thái trực tiếp từ VNPay. Bạn có thể kiểm tra lại sau ít phút.', 'The system is waiting for VNPay IPN or a direct status query. Try checking again in a few minutes.')
  if (status === 'INVALID') return text('GrandStay không thể xác minh chữ ký hoặc không tìm thấy giao dịch tương ứng.', 'GrandStay could not verify the signature or locate the matching transaction.')
  return failure || text('VNPay trả về trạng thái chưa thành công. Không có khoản tiền nào được ghi nhận.', 'VNPay returned an unsuccessful status. No payment was recorded.')
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return <div className="flex items-center justify-between gap-4 border-b border-slate-200 py-2 last:border-0"><span className="text-ink-soft">{label}</span><span className="text-right font-semibold">{value}</span></div>
}
