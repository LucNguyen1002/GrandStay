import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SettingsPage } from './SettingsPage'

const mocks = vi.hoisted(() => ({
  post: vi.fn(),
  logout: vi.fn(),
  toastSuccess: vi.fn(),
}))

vi.mock('../auth/AuthProvider', () => ({
  useAuth: () => ({
    user: { username: 'admin', name: 'Administrator', roles: ['ADMIN'], permissions: ['user:write'] },
    logout: mocks.logout,
  }),
}))

vi.mock('../api/client', () => ({
  api: { post: mocks.post },
  errorMessage: () => 'Không thể đổi mật khẩu.',
}))

vi.mock('sonner', () => ({ toast: { success: mocks.toastSuccess } }))

describe('SettingsPage password flow', () => {
  beforeEach(() => {
    mocks.post.mockReset()
    mocks.logout.mockReset()
    mocks.toastSuccess.mockReset()
    mocks.post.mockResolvedValue({ status: 204 })
  })

  it('explains invalid password requirements and only submits a valid form', async () => {
    const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
    render(<QueryClientProvider client={queryClient}><SettingsPage /></QueryClientProvider>)
    fireEvent.click(screen.getByRole('button', { name: 'Đổi mật khẩu' }))

    const submit = screen.getByRole('button', { name: 'Cập nhật mật khẩu' })
    const current = screen.getByLabelText('Mật khẩu hiện tại')
    const next = screen.getByLabelText('Mật khẩu mới')
    const confirmation = screen.getByLabelText('Nhập lại mật khẩu mới')

    expect(submit).toBeDisabled()
    fireEvent.change(current, { target: { value: 'GrandStay!Local2026' } })
    fireEvent.change(next, { target: { value: 'short123' } })
    fireEvent.change(confirmation, { target: { value: 'short123' } })

    expect(screen.getByText('Cần thêm 4 ký tự.')).toBeInTheDocument()
    expect(submit).toBeDisabled()

    fireEvent.change(next, { target: { value: 'NewGrandStay!2026' } })
    fireEvent.change(confirmation, { target: { value: 'NewGrandStay!2026' } })
    expect(submit).toBeEnabled()
    fireEvent.click(submit)

    await waitFor(() => expect(mocks.post).toHaveBeenCalledWith('/auth/change-password', {
      currentPassword: 'GrandStay!Local2026',
      newPassword: 'NewGrandStay!2026',
    }))
    await waitFor(() => expect(mocks.logout).toHaveBeenCalledWith(false))
  })
})
