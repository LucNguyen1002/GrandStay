import type { InternalAxiosRequestConfig } from 'axios'
import { afterEach, describe, expect, it } from 'vitest'
import { api, errorMessage } from './client'
import { clearSession, saveSession } from './token-store'

const session = {
  tokenType: 'Bearer',
  accessToken: 'expired-access-token',
  accessTokenExpiresAt: '2020-01-01T00:00:00Z',
  refreshToken: 'expired-refresh-token',
  refreshTokenExpiresAt: '2020-01-02T00:00:00Z',
}

const captureAdapter = (captured: InternalAxiosRequestConfig[]) =>
  async (config: InternalAxiosRequestConfig) => {
    captured.push(config)
    return { data: {}, status: 200, statusText: 'OK', headers: {}, config }
  }

afterEach(() => {
  clearSession()
  window.localStorage.removeItem('grandstay:language')
})

describe('API authorization header', () => {
  it.each(['/auth/register', '/auth/login', '/auth/google', '/auth/refresh', '/auth/logout'])('does not attach a stale token to %s', async url => {
    saveSession(session)
    const captured: InternalAxiosRequestConfig[] = []

    await api.post(url, {}, { adapter: captureAdapter(captured) })

    expect(captured[0].headers.get('Authorization')).toBeUndefined()
  })

  it('still attaches the token to protected business endpoints', async () => {
    saveSession(session)
    const captured: InternalAxiosRequestConfig[] = []

    await api.get('/bookings', { adapter: captureAdapter(captured) })

    expect(captured[0].headers.get('Authorization')).toBe(`Bearer ${session.accessToken}`)
  })
})

describe('localized API errors', () => {
  it('shows the missing verified-profile check-in error in Vietnamese', () => {
    window.localStorage.setItem('grandstay:language', 'vi')
    const error = {
      isAxiosError: true,
      response: {
        status: 422,
        data: {
          code: 'IDENTITY_REQUIRED',
          detail: 'A verified customer profile is required before check-in',
        },
      },
    }

    expect(errorMessage(error)).toContain('hồ sơ khách hàng đã xác minh')
  })

  it('keeps the same check-in error understandable in English', () => {
    window.localStorage.setItem('grandstay:language', 'en')
    const error = {
      isAxiosError: true,
      response: {
        status: 422,
        data: {
          code: 'IDENTITY_REQUIRED',
          detail: 'A verified customer profile is required before check-in',
        },
      },
    }

    expect(errorMessage(error)).toBe('A verified customer profile is required before check-in.')
  })
})
