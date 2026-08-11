import { useCallback, useEffect, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { CircleCheck, Eye, EyeOff, LoaderCircle, LockKeyhole, RefreshCw, UserRound } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useAuth } from '../auth/AuthProvider'
import { authenticatedDestination, defaultAuthenticatedRoute } from '../auth/routes'
import { errorMessage } from '../api/client'
import { AuthLayout } from '../components/AuthLayout'
import { GoogleSignInButton } from '../components/GoogleSignInButton'
import { Button } from '../components/ui'
import { useI18n } from '../i18n'

type LoginForm = { usernameOrEmail: string; password: string }
type BackendStatus = 'checking' | 'ready' | 'slow'

const BACKEND_HEALTH_URL = '/backend-healthz'
const HEALTH_REQUEST_TIMEOUT = 8_000
const HEALTH_RETRY_DELAY = 3_000

export function LoginPage() {
  const { t, text } = useI18n()
  const schema = z.object({ usernameOrEmail: z.string().min(1, t('auth.requiredAccount')), password: z.string().min(1, t('auth.requiredPassword')) })
  const { login, loginWithGoogle, isAuthenticated, user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [serverError, setServerError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [googleBusy, setGoogleBusy] = useState(false)
  const [backendStatus, setBackendStatus] = useState<BackendStatus>('checking')
  const [backendCheckKey, setBackendCheckKey] = useState(0)
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginForm>({ resolver: zodResolver(schema) })
  const requestedRoute = (location.state as { from?: string } | null)?.from
  const backendReady = backendStatus === 'ready'
  const restartBackendCheck = useCallback(() => setBackendCheckKey(value => value + 1), [])

  useEffect(() => {
    let cancelled = false
    let retryTimer: number | undefined
    let activeRequest: AbortController | undefined
    let attempts = 0

    const check = async () => {
      const controller = new AbortController()
      activeRequest = controller
      const timeout = window.setTimeout(() => controller.abort(), HEALTH_REQUEST_TIMEOUT)
      try {
        const response = await fetch(BACKEND_HEALTH_URL, {
          cache: 'no-store',
          headers: { Accept: 'application/json' },
          signal: controller.signal,
        })
        const body = await response.json().catch(() => null) as { status?: string } | null
        if (cancelled) return
        if (response.ok && body?.status === 'UP') {
          setBackendStatus('ready')
          setServerError('')
          return
        }
      } catch {
        if (cancelled) return
      } finally {
        window.clearTimeout(timeout)
      }

      attempts += 1
      setBackendStatus(attempts >= 6 ? 'slow' : 'checking')
      retryTimer = window.setTimeout(() => void check(), HEALTH_RETRY_DELAY)
    }

    setBackendStatus('checking')
    void check()
    return () => {
      cancelled = true
      activeRequest?.abort()
      if (retryTimer !== undefined) window.clearTimeout(retryTimer)
    }
  }, [backendCheckKey])

  const submit = async (values: LoginForm) => {
    if (!backendReady) return
    setServerError('')
    try {
      const user = await login(values.usernameOrEmail, values.password)
      navigate(authenticatedDestination(user, requestedRoute), { replace: true })
    } catch (error) {
      const message = errorMessage(error)
      setServerError(message)
      if (message === t('error.connection')) restartBackendCheck()
    }
  }
  const submitGoogle = useCallback(async (credential: string) => {
    if (!backendReady) return
    setServerError('')
    setGoogleBusy(true)
    try {
      const user = await loginWithGoogle(credential)
      navigate(authenticatedDestination(user, requestedRoute), { replace: true })
    } catch (error) {
      const message = errorMessage(error)
      setServerError(message)
      if (message === t('error.connection')) restartBackendCheck()
      setGoogleBusy(false)
    }
  }, [backendReady, loginWithGoogle, navigate, requestedRoute, restartBackendCheck, t])

  if (isAuthenticated && user) return <Navigate to={defaultAuthenticatedRoute(user)} replace />

  return <AuthLayout eyebrow={t('auth.welcome')} title={t('auth.loginTitle')} description={t('auth.loginDescription')}>
    <div role="status" aria-live="polite" className={`mt-6 rounded-2xl border px-4 py-3 ${backendReady ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-amber-200 bg-amber-50 text-amber-900'}`}>
      <div className="flex items-start gap-3">
        {backendReady
          ? <CircleCheck className="mt-0.5 shrink-0" size={19} aria-hidden="true" />
          : <LoaderCircle className="mt-0.5 shrink-0 animate-spin" size={19} aria-hidden="true" />}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold">{backendReady ? t('auth.serverReady') : backendStatus === 'slow' ? t('auth.serverSlow') : t('auth.serverStarting')}</p>
          {!backendReady && <p className="mt-0.5 text-xs leading-5 text-amber-800">{t('auth.serverHint')}</p>}
        </div>
        {backendStatus === 'slow' && <button type="button" onClick={restartBackendCheck} className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold hover:bg-amber-100"><RefreshCw size={13}/>{t('auth.checkNow')}</button>}
      </div>
    </div>
    <form onSubmit={handleSubmit(submit)} className="mt-8 space-y-5">
      <label className="block"><span className="label">{t('auth.identity')}</span><div className="relative"><UserRound className="field-icon" size={19}/><input autoFocus autoComplete="username" aria-invalid={Boolean(errors.usernameOrEmail)} className={`field field-with-icon ${errors.usernameOrEmail ? 'field-error' : ''}`} {...register('usernameOrEmail')} /></div>{errors.usernameOrEmail && <small className="mt-1 block text-red-700">{errors.usernameOrEmail.message}</small>}</label>
      <label className="block"><span className="label">{t('auth.password')}</span><div className="relative"><LockKeyhole className="field-icon" size={19}/><input type={showPassword ? 'text' : 'password'} autoComplete="current-password" aria-invalid={Boolean(errors.password)} className={`field field-with-icon field-with-action ${errors.password ? 'field-error' : ''}`} {...register('password')} /><button type="button" className="field-action" aria-label={showPassword ? text('Ẩn mật khẩu', 'Hide password') : text('Hiện mật khẩu', 'Show password')} onClick={() => setShowPassword(value => !value)}>{showPassword ? <EyeOff size={18}/> : <Eye size={18}/>}</button></div>{errors.password && <small className="mt-1 block text-red-700">{errors.password.message}</small>}</label>
      {serverError && <div role="alert" className="form-error rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{serverError}</div>}
      <Button type="submit" loading={isSubmitting} disabled={googleBusy || !backendReady} className="w-full py-3.5">{backendReady ? t('auth.login') : t('auth.waitingServer')}</Button>
    </form>
    <div className="auth-divider my-5"><span>{t('auth.or')}</span></div>
    <GoogleSignInButton busy={googleBusy || isSubmitting || !backendReady} onCredential={submitGoogle} onError={setServerError} />
    <p className="mt-6 text-center text-sm text-ink-soft">{t('auth.noAccount')} <Link to="/register" className="font-bold text-gold hover:underline">{t('auth.registerNow')}</Link></p>
  </AuthLayout>
}
