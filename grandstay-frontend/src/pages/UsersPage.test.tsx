import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { UsersPage } from './UsersPage'

const mocks = vi.hoisted(() => ({
  get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(),
  toastSuccess: vi.fn(), toastError: vi.fn(),
}))

vi.mock('../auth/AuthProvider', () => ({
  useAuth: () => ({ hasRole: (role: string) => role === 'ADMIN', user: { sub: 'admin-1' } }),
}))
vi.mock('../api/client', () => ({
  api: { get: mocks.get, post: mocks.post, put: mocks.put, delete: mocks.delete },
  errorMessage: () => 'Không thể thực hiện thao tác.',
}))
vi.mock('sonner', () => ({ toast: { success: mocks.toastSuccess, error: mocks.toastError } }))

const staff = { id: 'user-1', username: 'staff', email: 'staff@grandstay.vn', fullName: 'Nhân viên', phone: '0900000000', status: 'ACTIVE', version: 0 }
const session = { familyId: 'family-1', startedAt: '2026-08-09T01:00:00Z', lastActivityAt: '2026-08-09T02:00:00Z', expiresAt: '2026-09-09T01:00:00Z', userAgent: 'Microsoft Edge trên Windows', ipAddress: '127.0.0.1', active: true }

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(<QueryClientProvider client={client}><UsersPage/></QueryClientProvider>)
}

describe('UsersPage account administration', () => {
  beforeEach(() => {
    Object.values(mocks).forEach(mock => mock.mockReset())
    mocks.get.mockImplementation((url: string) => Promise.resolve({ data:
      url === '/users' ? { content: [staff] }
        : url.endsWith('/roles') ? ['RECEPTIONIST']
          : [session] }))
    mocks.put.mockResolvedValue({ data: staff })
    mocks.delete.mockResolvedValue({ status: 204 })
  })

  it('shows active sessions and revokes one device', async () => {
    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: 'Xem phiên của staff' }))
    expect(await screen.findByText('Microsoft Edge trên Windows')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Thu hồi' }))

    await waitFor(() => expect(mocks.delete).toHaveBeenCalledWith('/users/user-1/sessions/family-1'))
    expect(mocks.toastSuccess).toHaveBeenCalledWith('Đã thu hồi phiên đăng nhập.')
  })

  it('updates an existing staff account without forcing a password reset', async () => {
    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: 'Sửa tài khoản staff' }))
    expect(await screen.findByRole('option', { name: 'Lễ tân' })).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Họ và tên'), { target: { value: 'Nhân viên lễ tân' } })
    fireEvent.click(screen.getByRole('button', { name: 'Lưu tài khoản' }))

    await waitFor(() => expect(mocks.put).toHaveBeenCalledWith('/users/user-1', {
      email: 'staff@grandstay.vn', fullName: 'Nhân viên lễ tân', phone: '0900000000',
      password: null, status: 'ACTIVE', roles: ['RECEPTIONIST'],
    }))
    expect(mocks.toastSuccess).toHaveBeenCalledWith('Đã cập nhật tài khoản.')
  })
})
