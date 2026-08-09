import { useCallback, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, LockKeyhole, ShieldCheck, UserRound } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useAuth } from '../auth/AuthProvider'
import { authenticatedDestination, defaultAuthenticatedRoute } from '../auth/routes'
import { errorMessage } from '../api/client'
import { AuthLayout } from '../components/AuthLayout'
import { GoogleSignInButton } from '../components/GoogleSignInButton'
import { Button } from '../components/ui'

const schema = z.object({
  usernameOrEmail: z.string().min(1, 'Vui lòng nhập tài khoản.'),
  password: z.string().min(1, 'Vui lòng nhập mật khẩu.'),
})
type LoginForm = z.infer<typeof schema>

export function LoginPage() {
  const { login, loginWithGoogle, isAuthenticated, user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [serverError, setServerError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [googleBusy, setGoogleBusy] = useState(false)
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginForm>({ resolver: zodResolver(schema) })
  const requestedRoute = (location.state as { from?: string } | null)?.from

  const submit = async (values: LoginForm) => {
    setServerError('')
    try {
      const user = await login(values.usernameOrEmail, values.password)
      navigate(authenticatedDestination(user, requestedRoute), { replace: true })
    } catch (error) { setServerError(errorMessage(error)) }
  }
  const submitGoogle = useCallback(async (credential: string) => {
    setServerError('')
    setGoogleBusy(true)
    try {
      const user = await loginWithGoogle(credential)
      navigate(authenticatedDestination(user, requestedRoute), { replace: true })
    } catch (error) {
      setServerError(errorMessage(error))
      setGoogleBusy(false)
    }
  }, [loginWithGoogle, navigate, requestedRoute])

  if (isAuthenticated && user) return <Navigate to={defaultAuthenticatedRoute(user)} replace />

  return <AuthLayout eyebrow="Chào mừng trở lại" title="Đăng nhập GrandStay" description="Đăng nhập bằng tài khoản của bạn để tiếp tục.">
    <form onSubmit={handleSubmit(submit)} className="mt-8 space-y-5">
      <label className="block"><span className="label">Tên đăng nhập hoặc email</span><div className="relative"><UserRound className="field-icon" size={19}/><input autoFocus autoComplete="username" aria-invalid={Boolean(errors.usernameOrEmail)} className={`field field-with-icon ${errors.usernameOrEmail ? 'field-error' : ''}`} {...register('usernameOrEmail')} /></div>{errors.usernameOrEmail && <small className="mt-1 block text-red-700">{errors.usernameOrEmail.message}</small>}</label>
      <label className="block"><span className="label">Mật khẩu</span><div className="relative"><LockKeyhole className="field-icon" size={19}/><input type={showPassword ? 'text' : 'password'} autoComplete="current-password" aria-invalid={Boolean(errors.password)} className={`field field-with-icon field-with-action ${errors.password ? 'field-error' : ''}`} {...register('password')} /><button type="button" className="field-action" aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'} onClick={() => setShowPassword(value => !value)}>{showPassword ? <EyeOff size={18}/> : <Eye size={18}/>}</button></div>{errors.password && <small className="mt-1 block text-red-700">{errors.password.message}</small>}</label>
      {serverError && <div role="alert" className="form-error rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{serverError}</div>}
      <Button type="submit" loading={isSubmitting} disabled={googleBusy} className="w-full py-3.5">Đăng nhập</Button>
    </form>
    <div className="auth-divider my-5"><span>hoặc</span></div>
    <GoogleSignInButton busy={googleBusy || isSubmitting} onCredential={submitGoogle} onError={setServerError} />
    <p className="mt-6 text-center text-sm text-ink-soft">Chưa có tài khoản? <Link to="/register" className="font-bold text-gold hover:underline">Đăng ký ngay</Link></p>
    <p className="mt-7 flex items-center justify-center gap-1.5 text-center text-xs text-slate-400"><ShieldCheck size={14}/>GrandStay HMS · Kết nối được bảo vệ bằng JWT</p>
  </AuthLayout>
}
