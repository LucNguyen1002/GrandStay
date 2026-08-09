import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DashboardPage } from './DashboardPage'

const mocks = vi.hoisted(() => ({ get: vi.fn() }))
vi.mock('../api/client', () => ({ api: { get: mocks.get }, errorMessage: () => 'Không tải được dashboard.' }))
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AreaChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Area: () => null, CartesianGrid: () => null, Tooltip: () => null, XAxis: () => null, YAxis: () => null,
}))

const dashboard = {
  from: '2026-07-10T00:00:00Z', to: '2026-08-09T00:00:00Z', revenue: 12000000,
  previousRevenue: 10000000, revenueChangePercent: 20, occupancyRate: 50,
  totalRooms: 24, occupiedRooms: 12, revenueSeries: [],
  topServices: [{ name: 'Bữa sáng', quantity: 10, revenue: 1000000 }],
  topRooms: [{ roomId: 'room-1', roomNumber: '101', bookingCount: 5, revenue: 5000000 }],
  bookingSources: [{ source: 'DIRECT', count: 8 }, { source: 'WEBSITE', count: 2 }],
  arrivals: [{ bookingId: 'booking-1', bookingNumber: 'BKG-001', guestName: 'Nguyễn Văn A', expectedAt: '2026-08-09T07:00:00Z' }],
  departures: [],
}

describe('DashboardPage operations', () => {
  beforeEach(() => mocks.get.mockResolvedValue({ data: dashboard }))

  it('shows period comparison and todays front-desk workload', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(<MemoryRouter><QueryClientProvider client={client}><DashboardPage/></QueryClientProvider></MemoryRouter>)

    expect(await screen.findByText('20% so với kỳ trước')).toBeInTheDocument()
    expect(screen.getAllByText('Nguyễn Văn A')).toHaveLength(2)
    expect(screen.getByText('Phòng 101')).toBeInTheDocument()
    expect(screen.getByText('Trực tiếp')).toBeInTheDocument()
  })
})
