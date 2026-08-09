import { render, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { RealtimeSync } from './RealtimeSync'

const mocks = vi.hoisted(() => ({ handshake: vi.fn() }))

vi.mock('../api/client', () => ({
  api: { get: mocks.handshake, defaults: { baseURL: '/api/v1' } },
}))
vi.mock('../api/token-store', () => ({
  readSession: () => ({ accessToken: 'test-access-token' }),
}))
vi.mock('../auth/AuthProvider', () => ({
  useAuth: () => ({ isAuthenticated: true }),
}))

describe('RealtimeSync', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('invalidates active queries when the server pushes an update', async () => {
    mocks.handshake.mockResolvedValue({ status: 204 })
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode('event:connected\ndata:{}\n\n'))
        controller.enqueue(encoder.encode('event:update\ndata:{"resource":"bookings"}\n\n'))
        controller.close()
      },
    })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(stream, { status: 200 })))

    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const invalidate = vi.spyOn(client, 'invalidateQueries').mockResolvedValue()
    const view = render(<QueryClientProvider client={client}><RealtimeSync /></QueryClientProvider>)

    await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ refetchType: 'active' }))
    view.unmount()
  })
})
