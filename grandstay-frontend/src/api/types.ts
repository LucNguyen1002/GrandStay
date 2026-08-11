export type Page<T> = {
  content: T[]
  totalElements: number
  totalPages: number
  number: number
  size: number
}

export type TokenPair = {
  tokenType: string
  accessToken: string
  accessTokenExpiresAt: string
  refreshToken: string
  refreshTokenExpiresAt: string
}

export type JwtUser = {
  sub: string
  username: string
  name: string
  roles: string[]
  permissions: string[]
  exp: number
}

export type Dashboard = {
  from: string
  to: string
  revenue: number
  previousRevenue: number
  revenueChangePercent: number
  occupancyRate: number
  totalRooms: number
  occupiedRooms: number
  revenueSeries: { date: string; revenue: number }[]
  topServices: { name: string; quantity: number; revenue: number }[]
  topRooms: { roomId: string; roomNumber: string; bookingCount: number; revenue: number }[]
  bookingSources: { source: string; count: number }[]
  arrivals: { bookingId: string; bookingNumber: string; guestName: string; expectedAt: string }[]
  departures: { bookingId: string; bookingNumber: string; guestName: string; expectedAt: string }[]
}

export type RoomMatrix = {
  roomId: string
  roomNumber: string
  floorId: string
  floorName: string
  floorNumber: number
  roomTypeId: string
  roomTypeName: string
  displayStatus: 'AVAILABLE' | 'RESERVED' | 'OCCUPIED' | 'CLEANING' | 'MAINTENANCE' | 'OUT_OF_SERVICE'
  bookingId?: string
}

export type Booking = {
  id: string
  bookingNumber: string
  customerId?: string
  bookingSource: string
  status: string
  expectedCheckInAt: string
  expectedCheckOutAt: string
  adults: number
  children: number
  currency: string
  discountAmount: number
  taxRate: number
  version: number
}

export type BookingRoom = {
  id: string
  roomId: string
  roomNumber?: string
  roomTypeCode?: string
  roomTypeName?: string
  ratePlanId?: string
  ratePlanName?: string
  pricingUnit: string
  unitRate: number
  quantity: number
  roomCharge: number
}
export type BookingGuest = { id: string; bookingId: string; customerId?: string; fullName: string; primary: boolean; nationality?: string; dateOfBirth?: string; version: number }
export type BookingView = { booking: Booking; rooms: BookingRoom[]; guests: BookingGuest[] }

export type SelfPayment = {
  id: string
  originalPaymentId?: string
  transactionCode: string
  type: string
  purpose: string
  method: string
  status: string
  amount: number
  currency: string
  paidAt?: string
  providerReference?: string
  failureReason?: string
  createdAt: string
}

export type DepositQuote = {
  bookingId: string
  bookingNumber: string
  bookingStatus: string
  roomSubtotal: number
  discountAmount: number
  estimatedTax: number
  estimatedTotal: number
  depositPercent: number
  requiredDeposit: number
  paidDeposit: number
  remainingDeposit: number
  currency: string
  vnpayEnabled: boolean
  hasPendingPayment: boolean
  payments: SelfPayment[]
}

export type VnPayCheckout = {
  paymentId: string
  bookingId: string
  txnRef: string
  payUrl: string
  status: string
  amount: number
  currency: string
}

export type Customer = {
  id: string
  customerCode: string
  fullName: string
  email?: string
  phone?: string
  nationality?: string
  dateOfBirth?: string
  gender?: string
  version: number
}

export type CustomerProfile = {
  id: string
  customerCode: string
  fullName: string
  email: string
  phone?: string
  nationality?: string
  dateOfBirth?: string
  gender?: string
  address?: string
  identityType?: 'NATIONAL_ID' | 'PASSPORT' | 'OTHER'
  identityMasked?: string
  identityVerificationStatus: 'UNVERIFIED' | 'PENDING' | 'VERIFIED' | 'REJECTED'
  identityRejectionReason?: string
  identityFrontUploaded: boolean
  identityBackUploaded: boolean
  version: number
}

export type Room = {
  id: string
  roomNumber: string
  floorId: string
  roomTypeId: string
  operationalStatus: string
  notes?: string
  version: number
}

export type RoomType = {
  id: string
  code: string
  name: string
  description?: string
  capacityAdults: number
  capacityChildren: number
  baseHourlyRate?: number
  baseDailyRate?: number
  baseNightlyRate: number
  currency: string
  version: number
}

export type Floor = { id: string; code: string; name: string; floorNumber: number; description?: string; version: number }
export type RatePlan = { id: string; roomTypeId: string; code: string; name: string; pricingUnit: string; rate: number; currency: string; validFrom?: string; validTo?: string; minStayUnits: number; refundable: boolean; active: boolean; version: number }

export type Amenity = { id: string; code: string; name: string; description?: string; icon?: string; version: number }
export type AmenityView = { amenity: Amenity; roomTypes: { roomTypeId: string; quantity: number }[] }

export type Promotion = {
  id: string
  code: string
  name: string
  description?: string
  discountType: 'PERCENTAGE' | 'FIXED_AMOUNT'
  discountValue: number
  maximumDiscount?: number
  minimumBookingAmount: number
  validFrom: string
  validTo: string
  usageLimit?: number
  usedCount: number
  active: boolean
  version: number
}

export type HotelService = {
  id: string
  code: string
  name: string
  category: string
  description?: string
  unit: string
  unitPrice: number
  taxRate: number
  currency: string
  active: boolean
  version: number
}

export type User = {
  id: string
  username: string
  email: string
  fullName: string
  phone?: string
  status: string
  version: number
}

export type AuditLog = {
  id: number
  actorUserId?: string
  actorName?: string
  action: string
  entityType: string
  entityId: string
  requestId?: string
  ipAddress?: string
  changes?: string
  occurredAt: string
}

export type RevenueBucket = { period: string; invoiceCount: number; revenue: number }
export type OccupancyReportRow = { roomTypeId: string; roomTypeName: string; roomCount: number; occupiedHours: number; availableHours: number; occupancyRate: number; roomRevenue: number }
export type ServiceSalesReportRow = { serviceId: string; serviceName: string; unit: string; quantity: number; revenue: number; bookingCount: number }
export type ReceivableReportRow = { invoiceId: string; invoiceNumber: string; bookingId: string; customerName: string; issuedAt: string; dueAt?: string; grandTotal: number; paidAmount: number; outstandingAmount: number; overdueDays: number }

export type ProblemDetail = {
  title?: string
  detail?: string
  code?: string
  status?: number
  errors?: Record<string, string>
}
