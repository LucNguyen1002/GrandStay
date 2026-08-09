import { useEffect, useRef } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, Clock3, RefreshCw, XCircle } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import { api, errorMessage } from '../api/client'
import { useAuth } from '../auth/AuthProvider'
import { Badge, Button, Card, Loading, PageHeader, statusTone } from '../components/ui'

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

const money = (value: number, currency = 'VND') => new Intl.NumberFormat('vi-VN', {
  style: 'currency', currency, maximumFractionDigits: 0,
}).format(Number(value))

export function VnPayPaymentResultPage() {
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
    <PageHeader title="Kết quả thanh toán VNPay" description="GrandStay đối chiếu trực tiếp với VNPay trước khi cập nhật tiền cọc hoặc công nợ."/>
    <div className="mx-auto max-w-2xl">
      <Card className="text-center">
        {payment.isLoading ? <Loading text="Đang kiểm tra giao dịch VNPay…"/> : <>
          <StatusIcon status={state}/>
          <h2 className="mt-5 font-display text-2xl font-extrabold">{statusTitle(state)}</h2>
          <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-ink-soft">{statusMessage(state, current?.failureReason, error)}</p>
          {current && <div className="mx-auto mt-6 max-w-md rounded-2xl bg-slate-50 p-4 text-left text-sm">
            <Row label="Mã giao dịch" value={current.transactionCode}/>
            <Row label="Phương thức" value="VNPay"/>
            <Row label="Số tiền" value={money(current.amount, current.currency)}/>
            <Row label="Trạng thái" value={<Badge tone={statusTone(current.status)}>{current.status}</Badge>}/>
            {current.providerReference && <Row label="Mã VNPay" value={current.providerReference}/>} 
          </div>}
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            {bookingId && <Link to={selfService ? `/bookings?bookingId=${bookingId}` : `/billing?bookingId=${bookingId}`}><Button variant="secondary">{selfService ? 'Quay lại đặt phòng' : 'Quay lại thu ngân'}</Button></Link>}
            {current?.status === 'PENDING' && (can('payment:write') || selfService) && <Button loading={reconcile.isPending} onClick={() => reconcile.mutate()}><RefreshCw size={17}/>Kiểm tra lại VNPay</Button>}
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

function statusTitle(status: string) {
  if (status === 'COMPLETED') return 'Thanh toán thành công'
  if (status === 'PENDING' || status === 'PROCESSING') return 'Đang chờ VNPay xác nhận'
  if (status === 'INVALID') return 'Kết quả chuyển hướng không hợp lệ'
  return 'Thanh toán chưa thành công'
}

function statusMessage(status: string, failure?: string, error?: unknown) {
  if (error) return errorMessage(error)
  if (status === 'COMPLETED') return 'Giao dịch đã được xác minh và dữ liệu thanh toán của booking đã được cập nhật.'
  if (status === 'PENDING' || status === 'PROCESSING') return 'Hệ thống đang đợi IPN hoặc truy vấn trạng thái trực tiếp từ VNPay. Bạn có thể kiểm tra lại sau ít phút.'
  if (status === 'INVALID') return 'GrandStay không thể xác minh chữ ký hoặc không tìm thấy giao dịch tương ứng.'
  return failure || 'VNPay trả về trạng thái chưa thành công. Không có khoản tiền nào được ghi nhận.'
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return <div className="flex items-center justify-between gap-4 border-b border-slate-200 py-2 last:border-0"><span className="text-ink-soft">{label}</span><span className="text-right font-semibold">{value}</span></div>
}
