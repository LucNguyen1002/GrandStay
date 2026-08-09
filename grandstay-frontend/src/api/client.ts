import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios'
import { clearSession, readSession, saveSession } from './token-store'
import type { ProblemDetail, TokenPair } from './types'

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
  if (axios.isAxiosError<ProblemDetail | string>(error)) {
    if (!error.response) return 'Không thể kết nối máy chủ.'

    const data = error.response.data
    if (typeof data === 'string') {
      return data === 'Invalid CORS request'
        ? 'Yêu cầu bị máy chủ từ chối do cấu hình kết nối.'
        : data
    }
    if (data?.errors && Object.keys(data.errors).length > 0) {
      return Object.values(data.errors)[0]
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
    }
    if (data?.detail && translatedDetail[data.detail]) return translatedDetail[data.detail]

    const translatedCode: Record<string, string> = {
      INVALID_CREDENTIALS: 'Tên đăng nhập hoặc mật khẩu không chính xác.',
      USERNAME_TAKEN: 'Tên đăng nhập này đã được sử dụng.',
      EMAIL_TAKEN: 'Email này đã được sử dụng.',
      GOOGLE_AUTH_FAILED: 'Không thể xác thực tài khoản Google. Vui lòng thử lại.',
      GOOGLE_AUTH_UNAVAILABLE: 'Đăng nhập Google chưa được cấu hình trên hệ thống.',
      ACCOUNT_LOCKED: 'Tài khoản đang bị khóa tạm thời do đăng nhập sai nhiều lần.',
      ROOM_NOT_AVAILABLE: 'Phòng không còn trống trong khoảng thời gian đã chọn.',
      RATE_PLAN_NOT_AVAILABLE: 'Gói giá không còn hiệu lực.',
      PAYMENT_EXCEEDS_BALANCE: 'Số tiền thanh toán vượt quá công nợ còn lại.',
      REFUND_EXCEEDS_PAYMENT: 'Số tiền hoàn vượt quá số tiền đã thanh toán.',
      CONCURRENT_MODIFICATION: 'Dữ liệu vừa được cập nhật ở nơi khác. Vui lòng tải lại.',
      RATE_LIMITED: 'Bạn thao tác quá nhanh. Vui lòng thử lại sau ít phút.',
      TOKEN_INVALID: 'Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại.',
      TOKEN_REUSED: 'Phiên đăng nhập đã bị thu hồi vì lý do bảo mật.',
      AUTHENTICATION_REQUIRED: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
    }
    if (data?.code && translatedCode[data.code]) return translatedCode[data.code]
    return data?.detail ?? data?.title ?? `Máy chủ trả về lỗi ${error.response.status}.`
  }
  return error instanceof Error ? error.message : 'Đã xảy ra lỗi không xác định.'
}
