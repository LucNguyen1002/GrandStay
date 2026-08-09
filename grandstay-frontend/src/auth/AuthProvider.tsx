import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api } from '../api/client'
import { clearSession, decodeUser, readSession, saveSession } from '../api/token-store'
import type { JwtUser, TokenPair } from '../api/types'

type AuthValue = {
  user: JwtUser | null
  isAuthenticated: boolean
  login: (identity: string, password: string) => Promise<JwtUser>
  registerAccount: (input: RegisterInput) => Promise<JwtUser>
  loginWithGoogle: (credential: string) => Promise<JwtUser>
  logout: (allDevices?: boolean) => Promise<void>
  can: (permission: string) => boolean
  hasRole: (role: string) => boolean
}

export type RegisterInput = { fullName: string; username: string; email: string; password: string }

const AuthContext = createContext<AuthValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState(readSession)

  useEffect(() => {
    const sync = () => setSession(readSession())
    window.addEventListener('grandstay:auth', sync)
    window.addEventListener('storage', sync)
    return () => { window.removeEventListener('grandstay:auth', sync); window.removeEventListener('storage', sync) }
  }, [])

  const user = useMemo(() => decodeUser(session?.accessToken), [session])
  const storeAuthenticatedSession = useCallback((tokens: TokenPair) => {
    const authenticatedUser = decodeUser(tokens.accessToken)
    if (!authenticatedUser) throw new Error('Máy chủ trả về phiên đăng nhập không hợp lệ.')
    saveSession(tokens)
    setSession(tokens)
    return authenticatedUser
  }, [])
  const resetSession = useCallback(() => {
    // The login screen can be reached while an expired session is still stored.
    // Remove it first so it cannot interfere with a fresh authentication attempt.
    clearSession()
    setSession(null)
  }, [])
  const login = useCallback(async (usernameOrEmail: string, password: string) => {
    resetSession()
    const { data } = await api.post<TokenPair>('/auth/login', { usernameOrEmail, password })
    return storeAuthenticatedSession(data)
  }, [resetSession, storeAuthenticatedSession])
  const registerAccount = useCallback(async (input: RegisterInput) => {
    resetSession()
    const { data } = await api.post<TokenPair>('/auth/register', input)
    return storeAuthenticatedSession(data)
  }, [resetSession, storeAuthenticatedSession])
  const loginWithGoogle = useCallback(async (credential: string) => {
    resetSession()
    const { data } = await api.post<TokenPair>('/auth/google', { credential })
    return storeAuthenticatedSession(data)
  }, [resetSession, storeAuthenticatedSession])
  const logout = useCallback(async (allDevices = false) => {
    const refreshToken = readSession()?.refreshToken
    try { if (refreshToken) await api.post('/auth/logout', { refreshToken, allDevices }) } finally {
      clearSession(); setSession(null)
    }
  }, [])

  const value = useMemo<AuthValue>(() => ({
    user,
    isAuthenticated: Boolean(user && user.exp * 1000 > Date.now()),
    login,
    registerAccount,
    loginWithGoogle,
    logout,
    can: permission => Boolean(user?.permissions?.includes(permission) || user?.roles?.includes('ADMIN')),
    hasRole: role => Boolean(user?.roles?.includes(role)),
  }), [user, login, registerAccount, loginWithGoogle, logout])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}


export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside AuthProvider')
  return value
}
