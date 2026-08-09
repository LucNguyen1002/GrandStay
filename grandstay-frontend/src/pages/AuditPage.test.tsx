import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuditPage } from './AuditPage'

const mocks = vi.hoisted(() => ({ get: vi.fn() }))
vi.mock('../api/client', () => ({ api: { get: mocks.get }, errorMessage: () => 'Không tải được nhật ký.' }))

const log = { id: 1, actorUserId: 'user-1', actorName: 'Quản trị viên', action: 'UPDATE', entityType: 'ROOM', entityId: 'room-1', requestId: 'request-1', ipAddress: '127.0.0.1', occurredAt: '2026-08-09T03:00:00Z' }

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={client}><AuditPage/></QueryClientProvider>)
}

describe('AuditPage', () => {
  beforeEach(() => {
    mocks.get.mockReset()
    mocks.get.mockImplementation((url: string) => Promise.resolve({ data: url === '/users'
      ? { content: [{ id: 'user-1', username: 'admin', fullName: 'Quản trị viên' }] }
      : { content: [log], number: 0, totalPages: 1 } }))
  })

  it('renders safe audit metadata and applies entity filters', async () => {
    renderPage()
    expect(await screen.findByText('Quản trị viên')).toBeInTheDocument()
    expect(screen.getByText('IP: 127.0.0.1')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Đối tượng'), { target: { value: 'ROOM' } })

    await waitFor(() => expect(mocks.get).toHaveBeenLastCalledWith('/audit-logs', { params: expect.objectContaining({ entityType: 'ROOM' }) }))
  })
})
