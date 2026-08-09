import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { AtSign, Eye, EyeOff, LockKeyhole, ShieldCheck, UserRound, UsersRound } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useAuth } from '../auth/AuthProvider'
import { defaultAuthenticatedRoute } from '../auth/routes'
import { errorMessage } from '../api/client'
import { AuthLayout } from '../components/AuthLayout'
import { Button } from '../components/ui'

const schema = z.object({
  fullName: z.string().trim().min(2, 'Họ tên phải có ít nhất 2 ký tự.').max(150, 'Họ tên quá dài.'),
  username: z.string().trim().regex(/^[A-Za-z0-9._-]{3,80}$/, 'Dùng 3–80 chữ cái không dấu, số, dấu chấm, gạch dưới hoặc gạch ngang.'),
  email: z.email('Email không hợp lệ.').max(254, 'Email quá dài.'),
  password: z.string().min(12, 'Mật khẩu phải có ít nhất 12 ký tự.').max(72, 'Mật khẩu không được quá 72 ký tự.')
    .refine(value => new TextEncoder().encode(value).length <= 72, 'Mật khẩu Unicode không được vượt quá 72 byte.'),
  confirmPassword: z.string(),
}).refine(values => values.password === values.confirmPassword, {
  message: 'Mật khẩu xác nhận chưa khớp.', path: ['confirmPassword'],
})
type RegisterForm = z.infer<typeof schema>

export function RegisterPage() {
  const { registerAccount, isAuthenticated, user } = useAuth()
  const navigate = useNavigate()
  const [serverError, setServerError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<RegisterForm>({ resolver: zodResolver(schema) })

  if (isAuthenticated && user) return <Navigate to={defaultAuthenticatedRoute(user)} replace />

  const submit = async (values: RegisterForm) => {
    setServerError('')
    try {
      const user = await registerAccount({
        fullName: values.fullName,
        username: values.username,
        email: values.email,
        password: values.password,
      })
      navigate(defaultAuthenticatedRoute(user), { replace: true })
    } catch (error) { setServerError(errorMessage(error)) }
  }

  return <AuthLayout eyebrow="Bắt đầu cùng GrandStay" title="Tạo tài khoản" description="Đăng ký tài khoản khách hàng để đăng nhập và tra cứu thông tin phòng.">
    <form onSubmit={handleSubmit(submit)} className="mt-7 space-y-4">
      <label className="block"><span className="label">Họ và tên</span><div className="relative"><UsersRound className="field-icon" size={18}/><input autoFocus autoComplete="name" className={`field field-with-icon ${errors.fullName ? 'field-error' : ''}`} {...register('fullName')} /></div>{errors.fullName && <small className="mt-1 block text-red-700">{errors.fullName.message}</small>}</label>
      <label className="block"><span className="label">Tên đăng nhập</span><div className="relative"><UserRound className="field-icon" size={18}/><input autoComplete="username" className={`field field-with-icon ${errors.username ? 'field-error' : ''}`} {...register('username')} /></div>{errors.username && <small className="mt-1 block text-red-700">{errors.username.message}</small>}</label>
      <label className="block"><span className="label">Email</span><div className="relative"><AtSign className="field-icon" size={18}/><input type="email" autoComplete="email" className={`field field-with-icon ${errors.email ? 'field-error' : ''}`} {...register('email')} /></div>{errors.email && <small className="mt-1 block text-red-700">{errors.email.message}</small>}</label>
      <label className="block"><span className="label">Mật khẩu</span><div className="relative"><LockKeyhole className="field-icon" size={18}/><input type={showPassword ? 'text' : 'password'} autoComplete="new-password" className={`field field-with-icon field-with-action ${errors.password ? 'field-error' : ''}`} {...register('password')} /><button type="button" className="field-action" aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'} onClick={() => setShowPassword(value => !value)}>{showPassword ? <EyeOff size={18}/> : <Eye size={18}/>}</button></div>{errors.password && <small className="mt-1 block text-red-700">{errors.password.message}</small>}</label>
      <label className="block"><span className="label">Xác nhận mật khẩu</span><div className="relative"><ShieldCheck className="field-icon" size={18}/><input type={showPassword ? 'text' : 'password'} autoComplete="new-password" className={`field field-with-icon ${errors.confirmPassword ? 'field-error' : ''}`} {...register('confirmPassword')} /></div>{errors.confirmPassword && <small className="mt-1 block text-red-700">{errors.confirmPassword.message}</small>}</label>
      {serverError && <div role="alert" className="form-error rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{serverError}</div>}
      <Button type="submit" loading={isSubmitting} className="w-full py-3.5">Tạo tài khoản</Button>
    </form>
    <p className="mt-6 text-center text-sm text-ink-soft">Đã có tài khoản? <Link to="/login" className="font-bold text-gold hover:underline">Đăng nhập</Link></p>
  </AuthLayout>
}
