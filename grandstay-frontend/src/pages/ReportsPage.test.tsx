import { fireEvent, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ReportsPage } from './ReportsPage'

const mocks = vi.hoisted(() => ({ get: vi.fn(), toastError: vi.fn() }))
vi.mock('../api/client', () => ({ api: { get: mocks.get }, errorMessage: () => 'Không tải được báo cáo.' }))
vi.mock('sonner', () => ({ toast: { error: mocks.toastError } }))
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  BarChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Bar: () => null, CartesianGrid: () => null, Tooltip: () => null, XAxis: () => null, YAxis: () => null,
}))

describe('ReportsPage', () => {
  beforeEach(() => {
    mocks.get.mockReset()
    mocks.get.mockImplementation((url: string) => Promise.resolve({ data: url === '/reports/occupancy'
      ? [{ roomTypeId: 'type-1', roomTypeName: 'Standard', roomCount: 10, occupiedHours: 1200, availableHours: 2400, occupancyRate: 50, roomRevenue: 15000000 }]
      : [{ period: '2026-08-01T00:00:00', invoiceCount: 2, revenue: 2000000 }] }))
  })

  it('switches from revenue to the occupancy report', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(<QueryClientProvider client={client}><ReportsPage/></QueryClientProvider>)
    expect(await screen.findByText('2 hóa đơn')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('tab', { name: 'Công suất phòng' }))

    expect(await screen.findByText('Standard')).toBeInTheDocument()
    expect(screen.getAllByText('50%').length).toBeGreaterThan(0)
    expect(mocks.get).toHaveBeenCalledWith('/reports/occupancy', { params: expect.objectContaining({ from: expect.any(String), to: expect.any(String) }) })
  })
})
