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
import { useI18n } from '../i18n'

type RegisterForm = { fullName: string; username: string; email: string; password: string; confirmPassword: string }

function registrationSchema(english: boolean) {
  const message = (vi: string, en: string) => english ? en : vi
  return z.object({
    fullName: z.string().trim().min(2, message('Họ tên phải có ít nhất 2 ký tự.', 'Full name must contain at least 2 characters.')).max(150, message('Họ tên quá dài.', 'Full name is too long.'))
      .regex(/^[\p{L}][\p{L}\p{M} .'-]*$/u, message('Họ tên chứa ký tự không hợp lệ.', 'Full name contains invalid characters.')),
    username: z.string().trim().regex(/^[A-Za-z0-9._-]{3,80}$/, message('Dùng 3–80 chữ cái không dấu, số, dấu chấm, gạch dưới hoặc gạch ngang.', 'Use 3–80 letters, numbers, dots, underscores or hyphens.')),
    email: z.email(message('Email không hợp lệ.', 'Enter a valid email address.')).max(254, message('Email quá dài.', 'Email is too long.')),
    password: z.string().min(12, message('Mật khẩu phải có ít nhất 12 ký tự.', 'Password must be at least 12 characters.')).max(72, message('Mật khẩu không được quá 72 ký tự.', 'Password must not exceed 72 characters.'))
      .regex(/[A-Z]/, message('Mật khẩu cần ít nhất một chữ hoa.', 'Include at least one uppercase letter.'))
      .regex(/[a-z]/, message('Mật khẩu cần ít nhất một chữ thường.', 'Include at least one lowercase letter.'))
      .regex(/[0-9]/, message('Mật khẩu cần ít nhất một chữ số.', 'Include at least one number.'))
      .regex(/[^A-Za-z0-9]/, message('Mật khẩu cần ít nhất một ký tự đặc biệt.', 'Include at least one special character.'))
      .refine(value => new TextEncoder().encode(value).length <= 72, message('Mật khẩu Unicode không được vượt quá 72 byte.', 'Unicode password must not exceed 72 bytes.')),
    confirmPassword: z.string(),
  }).superRefine((values, context) => {
    if (values.password !== values.confirmPassword) context.addIssue({ code: 'custom', message: message('Mật khẩu xác nhận chưa khớp.', 'Passwords do not match.'), path: ['confirmPassword'] })
    const lowered = values.password.toLowerCase()
    if (lowered.includes(values.username.toLowerCase()) || lowered.includes(values.email.split('@')[0].toLowerCase())) {
      context.addIssue({ code: 'custom', message: message('Mật khẩu không được chứa tên đăng nhập hoặc phần tên email.', 'Password must not contain your username or email name.'), path: ['password'] })
    }
  })
}

export function RegisterPage() {
  const { language, t } = useI18n()
  const { registerAccount, isAuthenticated, user } = useAuth()
  const navigate = useNavigate()
  const [serverError, setServerError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<RegisterForm>({ resolver: zodResolver(registrationSchema(language === 'en')) })

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

  return <AuthLayout eyebrow={t('auth.registerEyebrow')} title={t('auth.registerTitle')} description={t('auth.registerDescription')}>
    <form onSubmit={handleSubmit(submit)} className="mt-7 space-y-4">
      <label className="block"><span className="label">{t('auth.fullName')}</span><div className="relative"><UsersRound className="field-icon" size={18}/><input autoFocus autoComplete="name" className={`field field-with-icon ${errors.fullName ? 'field-error' : ''}`} {...register('fullName')} /></div>{errors.fullName && <small className="mt-1 block text-red-700">{errors.fullName.message}</small>}</label>
      <label className="block"><span className="label">{t('auth.username')}</span><div className="relative"><UserRound className="field-icon" size={18}/><input autoComplete="username" className={`field field-with-icon ${errors.username ? 'field-error' : ''}`} {...register('username')} /></div>{errors.username && <small className="mt-1 block text-red-700">{errors.username.message}</small>}</label>
      <label className="block"><span className="label">{t('auth.email')}</span><div className="relative"><AtSign className="field-icon" size={18}/><input type="email" autoComplete="email" className={`field field-with-icon ${errors.email ? 'field-error' : ''}`} {...register('email')} /></div>{errors.email && <small className="mt-1 block text-red-700">{errors.email.message}</small>}</label>
      <label className="block"><span className="label">{t('auth.password')}</span><div className="relative"><LockKeyhole className="field-icon" size={18}/><input type={showPassword ? 'text' : 'password'} autoComplete="new-password" className={`field field-with-icon field-with-action ${errors.password ? 'field-error' : ''}`} {...register('password')} /><button type="button" className="field-action" aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'} onClick={() => setShowPassword(value => !value)}>{showPassword ? <EyeOff size={18}/> : <Eye size={18}/>}</button></div>{errors.password && <small className="mt-1 block text-red-700">{errors.password.message}</small>}</label>
      <p className="-mt-1 text-xs leading-5 text-ink-soft">{t('auth.passwordRules')}</p>
      <label className="block"><span className="label">{t('auth.confirmPassword')}</span><div className="relative"><ShieldCheck className="field-icon" size={18}/><input type={showPassword ? 'text' : 'password'} autoComplete="new-password" className={`field field-with-icon ${errors.confirmPassword ? 'field-error' : ''}`} {...register('confirmPassword')} /></div>{errors.confirmPassword && <small className="mt-1 block text-red-700">{errors.confirmPassword.message}</small>}</label>
      {serverError && <div role="alert" className="form-error rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{serverError}</div>}
      <Button type="submit" loading={isSubmitting} className="w-full py-3.5">{t('auth.createAccount')}</Button>
    </form>
    <p className="mt-6 text-center text-sm text-ink-soft">{t('auth.hasAccount')} <Link to="/login" className="font-bold text-gold hover:underline">{t('auth.login')}</Link></p>
  </AuthLayout>
}
