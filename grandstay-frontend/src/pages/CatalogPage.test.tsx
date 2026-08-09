import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CatalogPage } from './CatalogPage'

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}))

vi.mock('../auth/AuthProvider', () => ({
  useAuth: () => ({ can: (permission: string) => permission === 'room:write' }),
}))

vi.mock('../api/client', () => ({
  api: { get: mocks.get, post: mocks.post, put: mocks.put, delete: mocks.delete },
  errorMessage: () => 'Không thể lưu danh mục.',
}))

vi.mock('sonner', () => ({ toast: { success: mocks.toastSuccess, error: mocks.toastError } }))

const floor = { id: 'floor-1', code: 'F1', name: 'Tầng 1', floorNumber: 1, description: 'Tầng trệt', version: 0 }
const roomType = { id: 'type-1', code: 'STD', name: 'Standard', description: 'Phòng tiêu chuẩn', capacityAdults: 2, capacityChildren: 0, baseHourlyRate: 180000, baseDailyRate: 650000, baseNightlyRate: 720000, currency: 'VND', version: 0 }
const room = { id: 'room-1', roomNumber: '101', floorId: floor.id, roomTypeId: roomType.id, operationalStatus: 'AVAILABLE', notes: '', version: 0 }
const rate = { id: 'rate-1', roomTypeId: roomType.id, code: 'STD-NIGHT', name: 'Standard - Theo đêm', pricingUnit: 'NIGHTLY', rate: 720000, currency: 'VND', minStayUnits: 1, refundable: true, active: true, version: 0 }

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(<QueryClientProvider client={client}><CatalogPage/></QueryClientProvider>)
}

describe('CatalogPage CRUD', () => {
  beforeEach(() => {
    Object.values(mocks).forEach(mock => mock.mockReset())
    mocks.get.mockImplementation((url: string) => Promise.resolve({ data: { content:
      url === '/floors' ? [floor]
        : url === '/room-types' ? [roomType]
          : url === '/rooms' ? [room]
            : [rate] } }))
    mocks.put.mockResolvedValue({ data: floor })
    mocks.delete.mockResolvedValue({ status: 204 })
  })

  it('loads an existing floor into the editor and persists changes', async () => {
    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: 'Sửa Tầng 1' }))
    fireEvent.change(screen.getByLabelText('Tên'), { target: { value: 'Tầng lễ tân' } })
    fireEvent.click(screen.getByRole('button', { name: 'Lưu danh mục' }))

    await waitFor(() => expect(mocks.put).toHaveBeenCalledWith('/floors/floor-1', {
      code: 'F1',
      name: 'Tầng lễ tân',
      floorNumber: 1,
      description: 'Tầng trệt',
    }))
    expect(mocks.toastSuccess).toHaveBeenCalledWith('Đã cập nhật dữ liệu danh mục.')
  })

  it('asks for confirmation and deletes the selected room through the API', async () => {
    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: 'Xóa phòng 101' }))
    expect(screen.getByText('Xóa phòng?')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Xóa khỏi danh mục' }))

    await waitFor(() => expect(mocks.delete).toHaveBeenCalledWith('/rooms/room-1'))
    expect(mocks.toastSuccess).toHaveBeenCalledWith('Đã xóa phòng khỏi danh mục.')
  })
})
