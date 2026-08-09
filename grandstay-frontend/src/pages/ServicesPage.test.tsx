import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ServicesPage } from './ServicesPage'

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
  toastSuccess: vi.fn(),
}))

vi.mock('../auth/AuthProvider', () => ({
  useAuth: () => ({ can: (permission: string) => permission === 'service:write' }),
}))

vi.mock('../api/client', () => ({
  api: { get: mocks.get, post: mocks.post, put: mocks.put, delete: mocks.delete },
  errorMessage: () => 'Không thể lưu dịch vụ.',
}))

vi.mock('sonner', () => ({ toast: { success: mocks.toastSuccess, error: vi.fn() } }))

describe('ServicesPage inactive services', () => {
  beforeEach(() => {
    Object.values(mocks).forEach(mock => mock.mockReset())
    mocks.get.mockResolvedValue({ data: { content: [{
      id: 'service-1', code: 'BREAKFAST', name: 'Bữa sáng', category: 'FOOD',
      description: 'Bữa sáng tiêu chuẩn', unit: 'Suất', unitPrice: 120000,
      taxRate: 8, currency: 'VND', active: false, version: 1,
    }] } })
    mocks.put.mockResolvedValue({ data: {} })
  })

  it('requests inactive rows and allows restoring one from the table', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
    render(<QueryClientProvider client={client}><ServicesPage/></QueryClientProvider>)

    expect(await screen.findByText('Tạm ngưng')).toBeInTheDocument()
    expect(mocks.get).toHaveBeenCalledWith('/services', { params: { size: 100, includeInactive: true } })
    fireEvent.click(screen.getByRole('button', { name: 'Bật lại Bữa sáng' }))

    await waitFor(() => expect(mocks.put).toHaveBeenCalledWith('/services/service-1', {
      code: 'BREAKFAST',
      name: 'Bữa sáng',
      category: 'FOOD',
      description: 'Bữa sáng tiêu chuẩn',
      unit: 'Suất',
      unitPrice: 120000,
      taxRate: 8,
      currency: 'VND',
      active: true,
    }))
    expect(mocks.toastSuccess).toHaveBeenCalledWith('Đã bật lại dịch vụ.')
  })
})
