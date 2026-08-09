import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { VnPayPaymentResultPage } from './VnPayPaymentResultPage'

const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), customer: false }))

vi.mock('../api/client', () => ({
  api: { get: mocks.get, post: mocks.post },
  errorMessage: () => 'Không thể đối soát giao dịch.',
}))

vi.mock('../auth/AuthProvider', () => ({
  useAuth: () => ({
    hasRole: (role: string) => role === 'CUSTOMER' && mocks.customer,
    can: (permission: string) => permission === 'payment:write' && !mocks.customer,
  }),
}))

const pending = { id: 'payment-1', bookingId: 'booking-1', transactionCode: 'VNPAY-GS1', status: 'PENDING', amount: 195000, currency: 'VND' }
const completed = { ...pending, status: 'COMPLETED', providerReference: '14985233' }

function renderPage(path: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(<QueryClientProvider client={queryClient}><MemoryRouter initialEntries={[path]}><VnPayPaymentResultPage /></MemoryRouter></QueryClientProvider>)
}

describe('VnPayPaymentResultPage', () => {
  beforeEach(() => {
    mocks.get.mockReset()
    mocks.post.mockReset()
    mocks.customer = false
    mocks.post.mockResolvedValue({ data: {} })
  })

  it('reconciles a returned pending transaction and displays the verified result', async () => {
    mocks.get.mockResolvedValueOnce({ data: pending }).mockResolvedValue({ data: completed })
    renderPage('/payment/vnpay/result?result=PROCESSING&paymentId=payment-1&bookingId=booking-1')

    await waitFor(() => expect(mocks.post).toHaveBeenCalledWith('/payments/vnpay/payment-1/reconcile'))
    expect(await screen.findByText('Thanh toán thành công')).toBeInTheDocument()
    expect(screen.getByText('14985233')).toBeInTheDocument()
  })

  it('does not call an API when the return data is invalid', async () => {
    renderPage('/payment/vnpay/result?result=INVALID')

    expect(await screen.findByText('Kết quả chuyển hướng không hợp lệ')).toBeInTheDocument()
    expect(mocks.get).not.toHaveBeenCalled()
    expect(mocks.post).not.toHaveBeenCalled()
  })

  it('uses ownership-scoped endpoints for a customer account', async () => {
    mocks.customer = true
    mocks.get.mockResolvedValueOnce({ data: pending }).mockResolvedValue({ data: completed })
    renderPage('/payment/vnpay/result?result=PROCESSING&paymentId=payment-1&bookingId=booking-1')

    await waitFor(() => expect(mocks.get).toHaveBeenCalledWith('/self/payments/payment-1'))
    await waitFor(() => expect(mocks.post).toHaveBeenCalledWith('/self/payments/payment-1/vnpay/reconcile'))
    expect(await screen.findByText('Quay lại đặt phòng')).toBeInTheDocument()
  })
})
