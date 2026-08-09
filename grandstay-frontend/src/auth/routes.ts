import type { JwtUser } from '../api/types'

export function defaultAuthenticatedRoute(user: JwtUser) {
  if (user.permissions?.includes('report:read') || user.roles?.includes('ADMIN')) return '/dashboard'
  if (user.permissions?.includes('room:read')) return '/rooms'
  return '/settings'
}

export function authenticatedDestination(user: JwtUser, requestedRoute?: string) {
  if (!requestedRoute) return defaultAuthenticatedRoute(user)
  const requestedPath = requestedRoute.split(/[?#]/, 1)[0]
  const requiredPermission = [
    { prefix: '/dashboard', permission: 'report:read' },
    { prefix: '/rooms', permission: 'room:read' },
    { prefix: '/catalog', permission: 'room:read' },
    { prefix: '/bookings', permission: 'booking:read' },
    { prefix: '/customers', permission: 'booking:read' },
    { prefix: '/services', permission: 'service:read' },
    { prefix: '/commercial', permission: 'promotion:write' },
    { prefix: '/billing', permission: 'payment:read' },
    { prefix: '/reports', permission: 'report:read' },
    { prefix: '/users', role: 'ADMIN' },
    { prefix: '/audit', permission: 'audit:read' },
  ].find(rule => requestedPath === rule.prefix || requestedPath.startsWith(`${rule.prefix}/`))
  if (requestedPath === '/') return defaultAuthenticatedRoute(user)
  if (!requiredPermission || requiredPermission.prefix === '/settings') return requestedRoute
  if (user.roles?.includes('ADMIN')
      || (requiredPermission.prefix === '/bookings' && user.roles?.includes('CUSTOMER'))
      || (requiredPermission.role && user.roles?.includes(requiredPermission.role))
      || (requiredPermission.permission && user.permissions?.includes(requiredPermission.permission))) {
    return requestedRoute
  }
  return defaultAuthenticatedRoute(user)
}
