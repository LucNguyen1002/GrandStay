import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios'
import { clearSession, readSession, saveSession } from './token-store'
import type { ProblemDetail, TokenPair } from './types'
import { getStoredLanguage, translate } from '../i18n'

export const api = axios.create({ baseURL: import.meta.env.VITE_API_URL ?? '/api/v1', timeout: 15_000 })

const anonymousAuthEndpoint = (url?: string) =>
  Boolean(url && /\/auth\/(register|login|google|refresh|logout)(?:\?|$)/.test(url))

api.interceptors.request.use(config => {
  // A stale/invalid Bearer header is rejected by the resource-server filter
  // before a permitAll authentication endpoint reaches its controller.
  if (anonymousAuthEndpoint(config.url)) {
    config.headers.delete('Authorization')
    return config
  }
  const token = readSession()?.accessToken
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

type RetryRequest = InternalAxiosRequestConfig & { _retry?: boolean }
let refreshRequest: Promise<TokenPair> | null = null

api.interceptors.response.use(undefined, async (error: AxiosError<ProblemDetail>) => {
  const request = error.config as RetryRequest | undefined
  if (error.response?.status !== 401 || !request || request._retry || request.url?.includes('/auth/')) {
    return Promise.reject(error)
  }
  const refreshToken = readSession()?.refreshToken
  if (!refreshToken) {
    clearSession()
    return Promise.reject(error)
  }
  request._retry = true
  try {
    refreshRequest ??= axios.post<TokenPair>(`${api.defaults.baseURL}/auth/refresh`, { refreshToken })
      .then(response => response.data)
      .finally(() => { refreshRequest = null })
    const tokens = await refreshRequest
    saveSession(tokens)
    request.headers.Authorization = `Bearer ${tokens.accessToken}`
    return api(request)
  } catch (refreshError) {
    clearSession()
    return Promise.reject(refreshError)
  }
})

export function errorMessage(error: unknown): string {
  const language = getStoredLanguage()
  const localized = (vi: string, en: string) => language === 'en' ? en : vi
  if (axios.isAxiosError<ProblemDetail | string>(error)) {
    if (!error.response) return translate('error.connection', undefined, language)

    const data = error.response.data
    if (typeof data === 'string') {
      return data === 'Invalid CORS request'
        ? localized('Yêu cầu bị máy chủ từ chối do cấu hình kết nối.', 'The request was rejected by the server connection policy.')
        : language === 'vi' ? localized('Máy chủ không thể xử lý yêu cầu.', 'The server could not process the request.') : data
    }
    if (data?.errors && Object.keys(data.errors).length > 0) {
      const validation = Object.values(data.errors)[0]
      const validationMap: Record<string, [string, string]> = {
        'must not be blank': ['Trường này không được để trống.', 'This field is required.'],
        'must be a well-formed email address': ['Email không đúng định dạng.', 'Enter a valid email address.'],
        'size must be between 12 and 72': ['Mật khẩu phải có từ 12 đến 72 ký tự.', 'Password must be between 12 and 72 characters.'],
        'must be greater than or equal to 1': ['Giá trị phải từ 1 trở lên.', 'The value must be at least 1.'],
      }
      return validationMap[validation] ? localized(...validationMap[validation]) : localized('Thông tin nhập vào chưa hợp lệ.', validation)
    }

    const translatedDetail: Record<string, string> = {
      'Current password is incorrect': 'Mật khẩu hiện tại không chính xác.',
      'New password must be different from the current password': 'Mật khẩu mới phải khác mật khẩu hiện tại.',
      'A new password between 12 and 72 characters is required': 'Mật khẩu mới phải có từ 12 đến 72 ký tự.',
      'One or more rooms are no longer available for the selected period': 'Một hoặc nhiều phòng không còn trống trong khoảng thời gian đã chọn.',
      'The operation conflicts with existing data': 'Thao tác xung đột với dữ liệu hiện có.',
      'The resource was modified by another request; reload and retry': 'Dữ liệu vừa được thay đổi. Vui lòng tải lại và thử lại.',
      'Transaction code already exists': 'Mã giao dịch đã tồn tại.',
      'Payment amount exceeds outstanding balance': 'Số tiền thanh toán vượt quá công nợ còn lại.',
      'A settlement payment requires an issued invoice': 'Chỉ có thể thanh toán hóa đơn sau khi hóa đơn được phát hành.',
      'Refund amount exceeds the remaining refundable amount': 'Số tiền hoàn vượt quá số tiền còn có thể hoàn.',
      'Only a pending payment can be completed': 'Chỉ giao dịch đang chờ mới có thể được hoàn tất.',
      'Only a completed payment can be refunded': 'Chỉ giao dịch đã hoàn tất mới có thể được hoàn tiền.',
      'A valid availability period is required': 'Khoảng thời gian nhận và trả phòng không hợp lệ.',
      'Avatar image is required': 'Vui lòng chọn ảnh đại diện.',
      'Avatar image must not exceed 2 MB': 'Ảnh đại diện không được vượt quá 2 MB.',
      'Avatar image could not be read': 'Không thể đọc ảnh đại diện đã chọn.',
      'Avatar must be a valid JPEG or PNG image': 'Ảnh đại diện phải là tệp JPEG hoặc PNG hợp lệ.',
      'Avatar must be a JPEG or PNG image': 'Ảnh đại diện phải có định dạng JPEG hoặc PNG.',
      'Avatar dimensions must not exceed 2048 x 2048 pixels': 'Kích thước ảnh không được vượt quá 2048 × 2048 px.',
      'Administrators cannot lock their own account': 'Quản trị viên không thể tự khóa tài khoản đang sử dụng.',
      'Only a locked account can be unlocked': 'Chỉ tài khoản đang bị khóa mới có thể được mở khóa.',
      'Floor still contains active rooms': 'Tầng vẫn còn phòng đang sử dụng. Hãy xóa hoặc chuyển các phòng sang tầng khác trước.',
      'Room type still contains active rooms or rate plans': 'Hạng phòng vẫn còn phòng hoặc gói giá đang sử dụng. Hãy xử lý các dữ liệu liên quan trước.',
      'Room has an active booking and cannot be deleted': 'Phòng đang có hồ sơ đặt phòng hoạt động nên chưa thể xóa.',
      'Rate plan has an active booking and cannot be deleted': 'Gói giá đang được dùng trong hồ sơ đặt phòng hoạt động nên chưa thể xóa.',
      'Password must contain uppercase, lowercase, number and special character': 'Mật khẩu phải có chữ hoa, chữ thường, số và ký tự đặc biệt.',
      'National ID must contain exactly 12 digits': 'CCCD phải có đúng 12 chữ số.',
      'Identity document number is invalid': 'Số giấy tờ định danh không hợp lệ.',
      'Identity document is already registered': 'Số giấy tờ này đã được đăng ký cho khách hàng khác.',
      'Identity number is required before verification': 'Cần lưu số giấy tờ trước khi xác minh.',
      'Required identity document images are missing': 'Chưa tải đủ ảnh giấy tờ cần thiết.',
      'A rejection reason is required': 'Vui lòng nhập lý do từ chối hồ sơ.',
      'Identity image must be between 1 byte and 2 MB': 'Ảnh giấy tờ không được vượt quá 2 MB.',
      'Identity image must be a valid JPEG or PNG file': 'Ảnh giấy tờ phải là tệp JPEG hoặc PNG hợp lệ.',
    }
    const englishDetail: Record<string, string> = {
      'Current password is incorrect': 'The current password is incorrect.',
      'New password must be different from the current password': 'The new password must be different from the current password.',
      'A new password between 12 and 72 characters is required': 'The new password must contain 12–72 characters.',
      'One or more rooms are no longer available for the selected period': 'One or more rooms are no longer available for the selected period.',
      'The operation conflicts with existing data': 'This operation conflicts with existing data.',
      'The resource was modified by another request; reload and retry': 'The data was updated elsewhere. Refresh and try again.',
      'Cancellation reason is required': 'A cancellation reason is required.',
      'Identity verification is required before check-in': 'Identity verification is required before check-in.',
      'Password must contain uppercase, lowercase, number and special character': 'Password must include uppercase, lowercase, a number and a special character.',
      'National ID must contain exactly 12 digits': 'The national ID must contain exactly 12 digits.',
      'Identity document number is invalid': 'The identity document number is invalid.',
      'Identity document is already registered': 'This identity document is already registered to another guest.',
      'Identity number is required before verification': 'Save the document number before verification.',
      'Required identity document images are missing': 'Required identity document images are missing.',
      'A rejection reason is required': 'Enter a reason for rejecting this profile.',
      'Identity image must be between 1 byte and 2 MB': 'The identity image must not exceed 2 MB.',
      'Identity image must be a valid JPEG or PNG file': 'The identity image must be a valid JPEG or PNG file.',
    }
    if (data?.detail && (translatedDetail[data.detail] || englishDetail[data.detail])) {
      return language === 'en' ? (englishDetail[data.detail] ?? data.detail) : (translatedDetail[data.detail] ?? data.detail)
    }

    const translatedCode: Record<string, string> = {
      INVALID_CREDENTIALS: 'Tên đăng nhập hoặc mật khẩu không chính xác.',
      USERNAME_TAKEN: 'Tên đăng nhập này đã được sử dụng.',
      EMAIL_TAKEN: 'Email này đã được sử dụng.',
      GOOGLE_AUTH_FAILED: 'Không thể xác thực tài khoản Google. Vui lòng thử lại.',
      GOOGLE_AUTH_UNAVAILABLE: 'Đăng nhập Google chưa được cấu hình trên hệ thống.',
      ACCOUNT_LOCKED: 'Tài khoản đang bị khóa tạm thời do đăng nhập sai nhiều lần.',
      ROOM_NOT_AVAILABLE: 'Phòng không còn trống trong khoảng thời gian đã chọn.',
      ROOM_CAPACITY_EXCEEDED: 'Số khách vượt quá sức chứa tối đa của hạng phòng đã chọn.',
      GUEST_CAPACITY_EXCEEDED: 'Đặt phòng đã khai báo đủ số khách tối đa.',
      RATE_PLAN_NOT_AVAILABLE: 'Gói giá không còn hiệu lực.',
      PAYMENT_EXCEEDS_BALANCE: 'Số tiền thanh toán vượt quá công nợ còn lại.',
      DEPOSIT_REQUIRED: 'Cần thanh toán đủ tiền cọc trước khi nhận phòng cho đặt phòng trực tuyến.',
      REFUND_EXCEEDS_PAYMENT: 'Số tiền hoàn vượt quá số tiền đã thanh toán.',
      CONCURRENT_MODIFICATION: 'Dữ liệu vừa được cập nhật ở nơi khác. Vui lòng tải lại.',
      RATE_LIMITED: 'Bạn thao tác quá nhanh. Vui lòng thử lại sau ít phút.',
      TOKEN_INVALID: 'Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại.',
      TOKEN_REUSED: 'Phiên đăng nhập đã bị thu hồi vì lý do bảo mật.',
      AUTHENTICATION_REQUIRED: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
      IDENTITY_REQUIRED: 'Khách chính cần hoàn tất và xác minh thông tin danh tính trước khi nhận phòng.',
      WEAK_PASSWORD: 'Mật khẩu phải có 12–72 ký tự, gồm chữ hoa, chữ thường, số và ký tự đặc biệt.',
    }
    const englishCode: Record<string, string> = {
      INVALID_CREDENTIALS: translate('error.invalidCredentials', undefined, 'en'),
      USERNAME_TAKEN: translate('error.usernameTaken', undefined, 'en'),
      EMAIL_TAKEN: translate('error.emailTaken', undefined, 'en'),
      GOOGLE_AUTH_FAILED: 'Google authentication failed. Please try again.',
      GOOGLE_AUTH_UNAVAILABLE: 'Google sign-in is not configured.',
      ACCOUNT_LOCKED: 'This account is temporarily locked after repeated failed sign-in attempts.',
      ROOM_NOT_AVAILABLE: translate('error.roomUnavailable', undefined, 'en'),
      ROOM_CAPACITY_EXCEEDED: 'The guest count exceeds the selected room capacity.',
      GUEST_CAPACITY_EXCEEDED: 'This booking already has its maximum declared number of guests.',
      RATE_PLAN_NOT_AVAILABLE: 'This rate plan is no longer available.',
      DEPOSIT_REQUIRED: 'The required deposit must be paid before an online booking can check in.',
      RATE_LIMITED: 'Too many requests. Try again in a few minutes.',
      TOKEN_INVALID: 'Your session is invalid. Sign in again.',
      TOKEN_REUSED: 'Your session was revoked for security reasons.',
      AUTHENTICATION_REQUIRED: 'Your session expired. Sign in again.',
      IDENTITY_REQUIRED: translate('error.identityRequired', undefined, 'en'),
      WEAK_PASSWORD: 'Use 12–72 characters with uppercase, lowercase, a number and a special character.',
    }
    if (data?.code && (translatedCode[data.code] || englishCode[data.code])) return language === 'en' ? (englishCode[data.code] ?? translate('error.unknown', undefined, 'en')) : (translatedCode[data.code] ?? translate('error.unknown', undefined, 'vi'))
    if (language === 'en' && data?.detail) return data.detail
    return error.response.status >= 500
      ? localized('Máy chủ đang gặp sự cố. Vui lòng thử lại sau.', 'The server encountered a problem. Please try again later.')
      : translate('error.validation', undefined, language)
  }
  return error instanceof Error && language === 'en' ? error.message : translate('error.unknown', undefined, language)
}
