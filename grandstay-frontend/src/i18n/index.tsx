/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Languages } from 'lucide-react'

export type Language = 'vi' | 'en'
const STORAGE_KEY = 'grandstay:language'

const messages = {
  vi: {
    'language.vi': 'Tiếng Việt', 'language.en': 'English', 'language.switch': 'Đổi ngôn ngữ',
    'common.close': 'Đóng', 'common.cancel': 'Hủy', 'common.confirm': 'Xác nhận', 'common.save': 'Lưu thay đổi',
    'common.loading': 'Đang tải…', 'common.retry': 'Thử lại', 'common.search': 'Tìm kiếm', 'common.all': 'Tất cả', 'common.refresh': 'Làm mới',
    'nav.dashboard': 'Tổng quan', 'nav.rooms': 'Tìm & chọn phòng', 'nav.bookings': 'Lịch sử đặt phòng',
    'nav.customers': 'Khách hàng', 'nav.billing': 'Thu ngân', 'nav.services': 'Dịch vụ', 'nav.catalog': 'Danh mục phòng',
    'nav.commercial': 'Tiện nghi & ưu đãi', 'nav.reports': 'Báo cáo', 'nav.users': 'Người dùng',
    'nav.audit': 'Nhật ký kiểm toán', 'nav.settings': 'Tài khoản', 'nav.logout': 'Đăng xuất',
    'nav.collapse': 'Thu gọn', 'nav.hotelOperations': 'Vận hành khách sạn',
    'auth.welcome': 'Chào mừng trở lại', 'auth.loginTitle': 'Đăng nhập GrandStay',
    'auth.loginDescription': 'Đăng nhập bằng tài khoản của bạn để tiếp tục.', 'auth.identity': 'Tên đăng nhập hoặc email',
    'auth.password': 'Mật khẩu', 'auth.login': 'Đăng nhập', 'auth.or': 'hoặc',
    'auth.google': 'Tiếp tục sử dụng dịch vụ bằng Google', 'auth.noAccount': 'Chưa có tài khoản?',
    'auth.registerNow': 'Đăng ký ngay', 'auth.registerEyebrow': 'Bắt đầu cùng GrandStay',
    'auth.registerTitle': 'Tạo tài khoản', 'auth.registerDescription': 'Đăng ký tài khoản khách hàng để tìm và đặt phòng.',
    'auth.fullName': 'Họ và tên', 'auth.username': 'Tên đăng nhập', 'auth.email': 'Email',
    'auth.confirmPassword': 'Xác nhận mật khẩu', 'auth.createAccount': 'Tạo tài khoản', 'auth.hasAccount': 'Đã có tài khoản?',
    'auth.passwordRules': 'Mật khẩu cần có 12–72 ký tự, chữ hoa, chữ thường, số và ký tự đặc biệt.',
    'auth.requiredAccount': 'Vui lòng nhập tài khoản.', 'auth.requiredPassword': 'Vui lòng nhập mật khẩu.',
    'auth.serverReady': 'Máy chủ đã sẵn sàng', 'auth.serverStarting': 'Đang khởi động máy chủ…',
    'auth.serverSlow': 'Máy chủ đang khởi động lâu hơn dự kiến',
    'auth.serverHint': 'Render Free có thể cần khoảng một phút. Trang sẽ tự kiểm tra và bật nút đăng nhập khi sẵn sàng.',
    'auth.checkNow': 'Kiểm tra ngay', 'auth.waitingServer': 'Đang chờ máy chủ',
    'rooms.title.customer': 'Tìm phòng phù hợp', 'rooms.description.customer': 'So sánh hạng phòng, sức chứa và mức giá trước khi đặt.',
    'rooms.title.staff': 'Sơ đồ phòng', 'rooms.description.staff': 'Theo dõi tình trạng phòng và mở nhanh nghiệp vụ lưu trú.',
    'rooms.available': 'Sẵn sàng', 'rooms.reserved': 'Đã đặt', 'rooms.occupied': 'Đang ở', 'rooms.cleaning': 'Đang dọn',
    'rooms.maintenance': 'Bảo trì', 'rooms.outOfService': 'Ngừng sử dụng', 'rooms.choose': 'Chọn phòng này',
    'rooms.from': 'Từ', 'rooms.perNight': '/đêm', 'rooms.capacity': 'Tối đa {adults} người lớn · {children} trẻ em',
    'bookings.title.customer': 'Lịch sử đặt phòng',
    'bookings.description.customer': 'Theo dõi kỳ lưu trú sắp tới, đang diễn ra và đã hoàn thành.',
    'bookings.title.staff': 'Đặt phòng & lưu trú',
    'bookings.description.staff': 'Quản lý xuyên suốt từ giữ phòng, nhận phòng đến trả phòng.',
    'bookings.new': 'Đặt phòng mới', 'bookings.upcoming': 'Sắp tới', 'bookings.staying': 'Đang lưu trú',
    'bookings.completed': 'Đã hoàn thành', 'bookings.cancelled': 'Đã hủy', 'bookings.all': 'Tất cả',
    'bookings.number': 'Mã đặt phòng', 'bookings.checkIn': 'Nhận phòng', 'bookings.checkOut': 'Trả phòng',
    'bookings.guests': 'Số khách', 'bookings.status': 'Trạng thái', 'bookings.cancelTitle': 'Hủy đặt phòng?',
    'bookings.cancelDescription': 'Thao tác này sẽ giải phóng phòng đã giữ. Khoản đã thanh toán không tự động hoàn; nhân viên cần đối chiếu chính sách và xử lý tại Thu ngân.',
    'bookings.cancelReason': 'Lý do hủy', 'bookings.keep': 'Giữ đặt phòng', 'bookings.confirmCancel': 'Xác nhận hủy',
    'bookings.cancelDefaultReason': 'Khách hàng thay đổi kế hoạch', 'bookings.room': 'Phòng {number}',
    'bookings.roomType': 'Hạng phòng', 'bookings.pricePlan': 'Gói giá',
    'bookings.totalGuests': '{adults} người lớn · {children} trẻ em',
    'bookings.empty.customer': 'Bạn chưa có đặt phòng nào trong nhóm này.',
    'profile.title': 'Hồ sơ cá nhân', 'profile.description': 'Cập nhật thông tin liên hệ và danh tính dùng khi lưu trú.',
    'profile.contact': 'Thông tin liên hệ', 'profile.phone': 'Số điện thoại', 'profile.birthDate': 'Ngày sinh',
    'profile.gender': 'Giới tính', 'profile.nationality': 'Quốc tịch', 'profile.address': 'Địa chỉ',
    'profile.identity': 'Thông tin định danh', 'profile.identityType': 'Loại giấy tờ',
    'profile.identityNumber': 'Số CCCD/Hộ chiếu',
    'profile.identityHint': 'Số giấy tờ được mã hóa và chỉ hiển thị dạng che bớt.',
    'profile.unverified': 'Chưa cung cấp', 'profile.pending': 'Chờ xác minh', 'profile.verified': 'Đã xác minh',
    'profile.rejected': 'Cần bổ sung', 'profile.saved': 'Đã cập nhật thông tin cá nhân.',
    'profile.identitySaved': 'Đã lưu thông tin định danh để nhân viên xác minh.',
    'profile.changePassword': 'Đổi mật khẩu', 'profile.logoutDevice': 'Đăng xuất thiết bị này',
    'profile.logoutAll': 'Đăng xuất mọi thiết bị',
    'error.connection': 'Không thể kết nối máy chủ.', 'error.unknown': 'Đã xảy ra lỗi. Vui lòng thử lại.',
    'error.invalidCredentials': 'Tên đăng nhập hoặc mật khẩu không chính xác.',
    'error.usernameTaken': 'Tên đăng nhập này đã được sử dụng.', 'error.emailTaken': 'Email này đã được sử dụng.',
    'error.roomUnavailable': 'Phòng không còn trống trong khoảng thời gian đã chọn.',
    'error.identityRequired': 'Khách chính cần hoàn tất và xác minh thông tin danh tính trước khi nhận phòng.',
    'error.validation': 'Thông tin nhập vào chưa hợp lệ.',
  },
  en: {
    'language.vi': 'Tiếng Việt', 'language.en': 'English', 'language.switch': 'Change language',
    'common.close': 'Close', 'common.cancel': 'Cancel', 'common.confirm': 'Confirm', 'common.save': 'Save changes',
    'common.loading': 'Loading…', 'common.retry': 'Try again', 'common.search': 'Search', 'common.all': 'All', 'common.refresh': 'Refresh',
    'nav.dashboard': 'Overview', 'nav.rooms': 'Find a room', 'nav.bookings': 'Booking history', 'nav.customers': 'Guests',
    'nav.billing': 'Billing', 'nav.services': 'Services', 'nav.catalog': 'Room catalog',
    'nav.commercial': 'Amenities & offers', 'nav.reports': 'Reports', 'nav.users': 'Users',
    'nav.audit': 'Audit log', 'nav.settings': 'Account', 'nav.logout': 'Sign out', 'nav.collapse': 'Collapse',
    'nav.hotelOperations': 'Hotel operations', 'auth.welcome': 'Welcome back', 'auth.loginTitle': 'Sign in to GrandStay',
    'auth.loginDescription': 'Sign in with your account to continue.', 'auth.identity': 'Username or email',
    'auth.password': 'Password', 'auth.login': 'Sign in', 'auth.or': 'or', 'auth.google': 'Continue with Google',
    'auth.noAccount': 'New to GrandStay?', 'auth.registerNow': 'Create an account',
    'auth.registerEyebrow': 'Get started with GrandStay', 'auth.registerTitle': 'Create an account',
    'auth.registerDescription': 'Create a customer account to find and book rooms.', 'auth.fullName': 'Full name',
    'auth.username': 'Username', 'auth.email': 'Email', 'auth.confirmPassword': 'Confirm password',
    'auth.createAccount': 'Create account', 'auth.hasAccount': 'Already have an account?',
    'auth.passwordRules': 'Use 12–72 characters with uppercase, lowercase, a number and a special character.',
    'auth.requiredAccount': 'Enter your username or email.', 'auth.requiredPassword': 'Enter your password.',
    'auth.serverReady': 'Server is ready', 'auth.serverStarting': 'Starting the server…',
    'auth.serverSlow': 'The server is taking longer than expected to start',
    'auth.serverHint': 'Render Free may take about a minute. This page will keep checking and enable sign-in when ready.',
    'auth.checkNow': 'Check now', 'auth.waitingServer': 'Waiting for server',
    'rooms.title.customer': 'Find your ideal room', 'rooms.description.customer': 'Compare room classes, capacity and rates before booking.',
    'rooms.title.staff': 'Room map', 'rooms.description.staff': 'Track room status and access stay operations quickly.',
    'rooms.available': 'Available', 'rooms.reserved': 'Reserved', 'rooms.occupied': 'Occupied', 'rooms.cleaning': 'Cleaning',
    'rooms.maintenance': 'Maintenance', 'rooms.outOfService': 'Out of service', 'rooms.choose': 'Choose this room',
    'rooms.from': 'From', 'rooms.perNight': '/night', 'rooms.capacity': 'Up to {adults} adults · {children} children',
    'bookings.title.customer': 'Booking history', 'bookings.description.customer': 'Track upcoming, active and completed stays.',
    'bookings.title.staff': 'Bookings & stays', 'bookings.description.staff': 'Manage reservations from confirmation through check-out.',
    'bookings.new': 'New booking', 'bookings.upcoming': 'Upcoming', 'bookings.staying': 'Staying now',
    'bookings.completed': 'Completed', 'bookings.cancelled': 'Cancelled', 'bookings.all': 'All',
    'bookings.number': 'Booking number', 'bookings.checkIn': 'Check-in', 'bookings.checkOut': 'Check-out',
    'bookings.guests': 'Guests', 'bookings.status': 'Status', 'bookings.cancelTitle': 'Cancel this booking?',
    'bookings.cancelDescription': 'This releases the reserved room. Paid amounts are not refunded automatically; staff must review the policy and process them in Billing.',
    'bookings.cancelReason': 'Cancellation reason', 'bookings.keep': 'Keep booking',
    'bookings.confirmCancel': 'Cancel booking', 'bookings.cancelDefaultReason': 'The guest changed their plans',
    'bookings.room': 'Room {number}', 'bookings.roomType': 'Room class', 'bookings.pricePlan': 'Rate plan',
    'bookings.totalGuests': '{adults} adults · {children} children', 'bookings.empty.customer': 'You have no bookings in this group.',
    'profile.title': 'My profile', 'profile.description': 'Update the contact and identity details used for your stay.',
    'profile.contact': 'Contact details', 'profile.phone': 'Phone number', 'profile.birthDate': 'Date of birth',
    'profile.gender': 'Gender', 'profile.nationality': 'Nationality', 'profile.address': 'Address',
    'profile.identity': 'Identity details', 'profile.identityType': 'Document type',
    'profile.identityNumber': 'National ID / Passport number',
    'profile.identityHint': 'Your document number is encrypted and only shown in masked form.',
    'profile.unverified': 'Not provided', 'profile.pending': 'Pending verification', 'profile.verified': 'Verified',
    'profile.rejected': 'More information required', 'profile.saved': 'Your profile has been updated.',
    'profile.identitySaved': 'Identity details saved for staff verification.',
    'profile.changePassword': 'Change password', 'profile.logoutDevice': 'Sign out this device',
    'profile.logoutAll': 'Sign out all devices', 'error.connection': 'Unable to reach the server.',
    'error.unknown': 'Something went wrong. Please try again.',
    'error.invalidCredentials': 'The username or password is incorrect.', 'error.usernameTaken': 'This username is already in use.',
    'error.emailTaken': 'This email is already in use.', 'error.roomUnavailable': 'The room is no longer available for the selected period.',
    'error.identityRequired': 'The primary guest must complete identity verification before check-in.',
    'error.validation': 'Some of the information entered is invalid.',
  },
} as const

export type MessageKey = keyof typeof messages.vi
type Variables = Record<string, string | number>

function interpolate(value: string, variables?: Variables) {
  if (!variables) return value
  return Object.entries(variables).reduce((result, [key, replacement]) => result.replaceAll(`{${key}}`, String(replacement)), value)
}

export function getStoredLanguage(): Language {
  if (typeof window === 'undefined') return 'vi'
  return window.localStorage.getItem(STORAGE_KEY) === 'en' ? 'en' : 'vi'
}

export function translate(key: MessageKey, variables?: Variables, language = getStoredLanguage()) {
  return interpolate(messages[language][key] ?? messages.vi[key], variables)
}

export function localeFor(language = getStoredLanguage()) { return language === 'en' ? 'en-US' : 'vi-VN' }

export function formatDateTime(value?: string | number | Date, language = getStoredLanguage()) {
  if (value == null || value === '') return '—'
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat(localeFor(language), { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: language === 'en' }).format(date)
}

export function formatDate(value?: string | number | Date, language = getStoredLanguage()) {
  if (value == null || value === '') return '—'
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat(localeFor(language), { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date)
}

export function formatMoney(value: number, currency = 'VND', language = getStoredLanguage()) {
  return new Intl.NumberFormat(localeFor(language), { style: 'currency', currency, maximumFractionDigits: currency === 'VND' ? 0 : 2 }).format(Number(value))
}

type I18nContextValue = {
  language: Language; locale: string; setLanguage: (language: Language) => void
  t: (key: MessageKey, variables?: Variables) => string
  text: (vietnamese: string, english: string) => string
  dateTime: (value?: string | number | Date) => string; date: (value?: string | number | Date) => string
  money: (value: number, currency?: string) => string
}
const fallbackLanguage = getStoredLanguage()
const I18nContext = createContext<I18nContextValue>({
  language: fallbackLanguage,
  locale: localeFor(fallbackLanguage),
  setLanguage: () => undefined,
  t: (key, variables) => translate(key, variables, fallbackLanguage),
  text: (vietnamese, english) => fallbackLanguage === 'vi' ? vietnamese : english,
  dateTime: value => formatDateTime(value, fallbackLanguage),
  date: value => formatDate(value, fallbackLanguage),
  money: (value, currency) => formatMoney(value, currency, fallbackLanguage),
})

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>(getStoredLanguage)
  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, language)
    document.documentElement.lang = language
    document.title = language === 'vi' ? 'GrandStay | Kỳ nghỉ theo cách của bạn' : 'GrandStay | Your stay, your way'
  }, [language])
  const value = useMemo<I18nContextValue>(() => ({
    language, locale: localeFor(language), setLanguage,
    t: (key, variables) => translate(key, variables, language),
    text: (vietnamese, english) => language === 'vi' ? vietnamese : english,
    dateTime: value => formatDateTime(value, language), date: value => formatDate(value, language),
    money: (value, currency) => formatMoney(value, currency, language),
  }), [language])
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n() {
  return useContext(I18nContext)
}

export function LanguageToggle({ compact = false, className = '' }: { compact?: boolean; className?: string }) {
  const { language, setLanguage, t } = useI18n()
  const next: Language = language === 'vi' ? 'en' : 'vi'
  return <button type="button" aria-label={`${t('language.switch')}: ${t(`language.${next}`)}`} title={t(`language.${next}`)}
    onClick={() => setLanguage(next)}
    className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white/90 px-3 text-xs font-bold text-ink shadow-sm transition hover:border-gold hover:text-gold ${className}`}>
    <Languages size={16}/>{!compact && <span>{language === 'vi' ? 'VI' : 'EN'}</span>}
  </button>
}
