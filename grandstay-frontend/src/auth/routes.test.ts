import { describe, expect, it } from 'vitest'
import type { JwtUser } from '../api/types'
import { authenticatedDestination, defaultAuthenticatedRoute } from './routes'

const customer: JwtUser = {
  sub: 'customer-id', username: 'guest', name: 'Guest', roles: ['CUSTOMER'],
  permissions: ['room:read'], exp: 9_999_999_999,
}

const receptionist: JwtUser = {
  sub: 'staff-id', username: 'staff', name: 'Staff', roles: ['RECEPTIONIST'],
  permissions: ['report:read', 'room:read'], exp: 9_999_999_999,
}

describe('authenticated routes', () => {
  it('sends customers to the room view by default', () => {
    expect(defaultAuthenticatedRoute(customer)).toBe('/rooms')
    expect(authenticatedDestination(customer, '/')).toBe('/rooms')
  })

  it('restores customer self-service bookings but blocks staff-only routes', () => {
    expect(authenticatedDestination(customer, '/bookings')).toBe('/bookings')
    expect(authenticatedDestination(customer, '/customers')).toBe('/rooms')
    expect(authenticatedDestination(customer, '/dashboard')).toBe('/rooms')
    expect(authenticatedDestination(customer, '/rooms')).toBe('/rooms')
  })

  it('preserves public search parameters after login', () => {
    expect(authenticatedDestination(customer, '/rooms?checkIn=2026-08-08&checkOut=2026-08-09&guests=2'))
      .toBe('/rooms?checkIn=2026-08-08&checkOut=2026-08-09&guests=2')
  })

  it('keeps the public homepage separate from the operations dashboard', () => {
    expect(defaultAuthenticatedRoute(receptionist)).toBe('/dashboard')
    expect(authenticatedDestination(receptionist, '/')).toBe('/dashboard')
  })
})
