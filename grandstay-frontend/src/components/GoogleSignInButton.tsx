import { useEffect, useRef } from 'react'
import { useI18n } from '../i18n'

let googleScript: Promise<void> | null = null

function loadGoogleIdentity(loadError: string) {
  if (window.google?.accounts?.id) return Promise.resolve()
  if (googleScript) return googleScript
  googleScript = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.defer = true
    script.onload = () => resolve()
    script.onerror = () => {
      googleScript = null
      reject(new Error(loadError))
    }
    document.head.appendChild(script)
  })
  return googleScript
}

export function GoogleSignInButton({ onCredential, onError, busy = false }: {
  onCredential: (credential: string) => void
  onError: (message: string) => void
  busy?: boolean
}) {
  const { language, t, text } = useI18n()
  const container = useRef<HTMLDivElement>(null)
  const credentialHandler = useRef(onCredential)
  const errorHandler = useRef(onError)
  const interactionTimer = useRef<number | null>(null)
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim()

  useEffect(() => { credentialHandler.current = onCredential }, [onCredential])
  useEffect(() => { errorHandler.current = onError }, [onError])

  useEffect(() => {
    if (!clientId) return
    let active = true
    loadGoogleIdentity(text('Không thể tải dịch vụ đăng nhập Google.', 'Unable to load Google Sign-In.')).then(() => {
      if (!active || !container.current) return
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: response => {
          if (interactionTimer.current !== null) window.clearTimeout(interactionTimer.current)
          interactionTimer.current = null
          if (response.credential) credentialHandler.current(response.credential)
          else errorHandler.current(text('Google không trả về thông tin đăng nhập hợp lệ.', 'Google did not return valid sign-in information.'))
        },
        auto_select: false,
        cancel_on_tap_outside: true,
        ux_mode: 'popup',
        use_fedcm_for_button: false,
      })
      container.current.replaceChildren()
      window.google.accounts.id.renderButton(container.current, {
        type: 'standard', theme: 'outline', size: 'large', text: 'continue_with',
        shape: 'rectangular', logo_alignment: 'left', width: Math.min(container.current.clientWidth, 400),
        locale: language,
        click_listener: () => {
          errorHandler.current('')
          if (interactionTimer.current !== null) window.clearTimeout(interactionTimer.current)
          interactionTimer.current = window.setTimeout(() => {
            errorHandler.current(text('Google chưa trả về thông tin đăng nhập. Hãy tải lại trang hoặc thử trong cửa sổ riêng tư.', 'Google has not returned sign-in information. Reload the page or try a private window.'))
          }, 30_000)
        },
      })
    }).catch(error => active && errorHandler.current(error instanceof Error ? error.message : text('Không thể tải đăng nhập Google.', 'Unable to load Google Sign-In.')))
    return () => {
      active = false
      if (interactionTimer.current !== null) window.clearTimeout(interactionTimer.current)
      interactionTimer.current = null
    }
  }, [clientId, language, text])

  if (!clientId) {
    return <button type="button" disabled className="google-fallback w-full" title={text('Cần cấu hình VITE_GOOGLE_CLIENT_ID', 'VITE_GOOGLE_CLIENT_ID must be configured')}>
      <span className="google-mark" aria-hidden="true">G</span> {t('auth.google')}
    </button>
  }
  return <div className={busy ? 'pointer-events-none opacity-50' : ''} aria-busy={busy || undefined}>
    <div ref={container} className="google-button-container min-h-11 w-full" />
  </div>
}
