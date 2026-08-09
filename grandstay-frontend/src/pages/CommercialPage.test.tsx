import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CommercialPage } from './CommercialPage'

const mocks = vi.hoisted(() => ({
  get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(),
  toastSuccess: vi.fn(), toastError: vi.fn(),
}))

vi.mock('../auth/AuthProvider', () => ({ useAuth: () => ({ can: () => true }) }))
vi.mock('../api/client', () => ({
  api: { get: mocks.get, post: mocks.post, put: mocks.put, delete: mocks.delete },
  errorMessage: () => 'Không thể tải dữ liệu.',
}))
vi.mock('sonner', () => ({ toast: { success: mocks.toastSuccess, error: mocks.toastError } }))

const roomType = { id: 'type-1', code: 'STD', name: 'Standard', capacityAdults: 2, capacityChildren: 0, baseNightlyRate: 700000, currency: 'VND', version: 0 }
const amenity = { amenity: { id: 'amenity-1', code: 'WIFI', name: 'Wi-Fi', description: 'Internet tốc độ cao', icon: 'wifi', version: 0 }, roomTypes: [{ roomTypeId: 'type-1', quantity: 1 }] }
const promotion = { id: 'promotion-1', code: 'SUMMER', name: 'Ưu đãi mùa hè', description: 'Giảm trực tiếp', discountType: 'PERCENTAGE', discountValue: 10, maximumDiscount: 200000, minimumBookingAmount: 500000, validFrom: '2030-08-01T00:00:00Z', validTo: '2030-09-01T00:00:00Z', usageLimit: 100, usedCount: 3, active: true, version: 0 }

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(<QueryClientProvider client={client}><CommercialPage/></QueryClientProvider>)
}

describe('CommercialPage', () => {
  beforeEach(() => {
    Object.values(mocks).forEach(mock => mock.mockReset())
    mocks.get.mockImplementation((url: string) => Promise.resolve({ data: { content:
      url === '/amenities' ? [amenity]
        : url === '/room-types' ? [roomType]
          : [promotion] } }))
    mocks.put.mockResolvedValue({ data: {} })
  })

  it('loads the complete promotion catalog for management', async () => {
    renderPage()
    expect(await screen.findByText('Ưu đãi mùa hè')).toBeInTheDocument()
    expect(mocks.get).toHaveBeenCalledWith('/promotions', { params: { size: 100, sort: 'validTo,desc', includeInactive: true } })
  })

  it('updates amenity assignments from the interface', async () => {
    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: 'Sửa Wi-Fi' }))
    fireEvent.change(screen.getByLabelText('Số lượng Standard'), { target: { value: '2' } })
    fireEvent.click(screen.getByRole('button', { name: 'Lưu tiện nghi' }))

    await waitFor(() => expect(mocks.put).toHaveBeenCalledWith('/amenities/amenity-1', {
      code: 'WIFI', name: 'Wi-Fi', description: 'Internet tốc độ cao', icon: 'wifi',
      roomTypes: [{ roomTypeId: 'type-1', quantity: 2 }],
    }))
    expect(mocks.toastSuccess).toHaveBeenCalledWith('Đã cập nhật tiện nghi.')
  })
})
