import type { JwtUser, TokenPair } from './types'

const STORAGE_KEY = 'grandstay.session'
let current: TokenPair | null = null

export function readSession(): TokenPair | null {
  if (current) return current
  try {
    // Keep authentication scoped to the current browser tab/session. This
    // avoids leaving refresh tokens in persistent localStorage after the
    // browser has been closed.
    localStorage.removeItem(STORAGE_KEY)
    const raw = sessionStorage.getItem(STORAGE_KEY)
    current = raw ? JSON.parse(raw) as TokenPair : null
  } catch {
    current = null
  }
  return current
}

export function saveSession(tokens: TokenPair) {
  current = tokens
  localStorage.removeItem(STORAGE_KEY)
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(tokens))
  window.dispatchEvent(new Event('grandstay:auth'))
}

export function clearSession() {
  current = null
  localStorage.removeItem(STORAGE_KEY)
  sessionStorage.removeItem(STORAGE_KEY)
  window.dispatchEvent(new Event('grandstay:auth'))
}

export function decodeUser(token?: string): JwtUser | null {
  if (!token) return null
  try {
    const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    return JSON.parse(decodeURIComponent(Array.from(atob(payload)).map(c => `%${c.charCodeAt(0).toString(16).padStart(2, '0')}`).join(''))) as JwtUser
  } catch {
    return null
  }
}
