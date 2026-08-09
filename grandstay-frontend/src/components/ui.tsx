import { useEffect, useId, useRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Inbox, LoaderCircle, RefreshCw, TriangleAlert, X } from 'lucide-react'

export function PageHeader({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return <div className="page-header mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
    <div className="min-w-0">
      <h1 className="page-title font-display text-3xl font-extrabold tracking-tight text-ink">{title}</h1>
      <p className="mt-1 max-w-3xl text-sm leading-6 text-ink-soft">{description}</p>
    </div>
    {action && <div className="shrink-0">{action}</div>}
  </div>
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`surface app-card rounded-2xl p-5 ${className}`}>{children}</section>
}

export function Button({ children, variant = 'primary', loading = false, className = '', type, ...props }:
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger'; loading?: boolean }) {
  const styles = variant === 'danger' ? 'btn-danger' : variant === 'secondary' ? 'btn-secondary' : 'btn-primary'
  const disabled = loading || props.disabled
  return <button
    type={type ?? 'button'}
    className={`${styles} inline-flex items-center justify-center gap-2 ${className}`}
    disabled={disabled}
    aria-busy={loading || undefined}
    {...props}
  >
    {loading && <LoaderCircle size={16} className="animate-spin" aria-hidden="true" />}
    {children}
  </button>
}

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'green' | 'gold' | 'red' | 'blue' | 'neutral' }) {
  const color = {
    green: 'bg-emerald-50 text-emerald-700 ring-emerald-600/10',
    gold: 'bg-amber-50 text-amber-700 ring-amber-600/10',
    red: 'bg-red-50 text-red-700 ring-red-600/10',
    blue: 'bg-blue-50 text-blue-700 ring-blue-600/10',
    neutral: 'bg-slate-100 text-slate-600 ring-slate-500/10',
  }[tone]
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ring-1 ring-inset ${color}`}>{children}</span>
}

export function Loading({ text = 'Đang tải dữ liệu…' }: { text?: string }) {
  return <div role="status" aria-live="polite" className="loading-state flex min-h-60 flex-col items-center justify-center text-ink-soft">
    <div className="loading-orbit"><LoaderCircle className="animate-spin" /></div>
    <span className="mt-3 text-sm font-semibold">{text}</span>
  </div>
}

export function Empty({ text = 'Chưa có dữ liệu.' }: { text?: string }) {
  return <div className="empty-state py-12 text-center text-sm text-ink-soft">
    <span className="mx-auto mb-3 grid size-11 place-items-center rounded-2xl bg-slate-100 text-slate-400"><Inbox size={21} /></span>
    {text}
  </div>
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return <div role="alert" className="error-state rounded-2xl border border-red-100 bg-red-50/80 p-5 text-red-800">
    <div className="flex items-start gap-3">
      <TriangleAlert className="mt-0.5 shrink-0" size={20} />
      <div className="min-w-0 flex-1"><p className="font-bold">Không thể tải dữ liệu</p><p className="mt-1 text-sm text-red-700">{message}</p></div>
      {onRetry && <Button variant="secondary" onClick={onRetry}><RefreshCw size={15} />Thử lại</Button>}
    </div>
  </div>
}

type ModalSize = 'sm' | 'md' | 'lg' | 'xl'

export function Modal({ title, children, onClose, size = 'lg' }: { title: string; children: ReactNode; onClose: () => void; size?: ModalSize }) {
  const titleId = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  const widths: Record<ModalSize, string> = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-2xl', xl: 'max-w-4xl' }

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const focusFirstControl = window.requestAnimationFrame(() => {
      const preferred = panelRef.current?.querySelector<HTMLElement>('[autofocus], input, select, textarea, button, a[href]')
      ;(preferred ?? panelRef.current)?.focus()
    })

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }
      if (event.key !== 'Tab' || !panelRef.current) return
      const controls = [...panelRef.current.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex]:not([tabindex="-1"])')]
      if (!controls.length) return
      const first = controls[0]
      const last = controls[controls.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      window.cancelAnimationFrame(focusFirstControl)
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousOverflow
      previousFocus?.focus()
    }
  }, [onClose])

  return createPortal(
    <div className="modal-backdrop fixed inset-0 z-[100] flex items-center justify-center bg-ink/50 p-4 backdrop-blur-sm" onMouseDown={event => event.target === event.currentTarget && onClose()}>
      <div ref={panelRef} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} className={`modal-panel max-h-[92vh] w-full ${widths[size]} overflow-y-auto rounded-3xl bg-white p-5 shadow-2xl outline-none sm:p-7`}>
        <div className="mb-5 flex items-center justify-between gap-4">
          <h2 id={titleId} className="page-title font-display text-2xl font-bold text-ink">{title}</h2>
          <button type="button" aria-label="Đóng hộp thoại" onClick={onClose} className="icon-button shrink-0 rounded-xl p-2 text-ink-soft hover:bg-slate-100 hover:text-ink"><X size={20}/></button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  )
}

export function ConfirmDialog({ title, description, confirmLabel = 'Xác nhận', loading = false, onCancel, onConfirm }: {
  title: string
  description: string
  confirmLabel?: string
  loading?: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  return <Modal title={title} size="sm" onClose={onCancel}>
    <div className="rounded-2xl border border-red-100 bg-red-50/70 p-4 text-sm leading-6 text-red-900">{description}</div>
    <p className="mt-4 text-xs leading-5 text-ink-soft">Hãy kiểm tra kỹ trước khi tiếp tục. Thao tác có thể làm thay đổi dữ liệu đang được sử dụng.</p>
    <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><Button variant="secondary" disabled={loading} onClick={onCancel}>Hủy</Button><Button variant="danger" loading={loading} onClick={onConfirm}>{confirmLabel}</Button></div>
  </Modal>
}

export function Pagination({ page, totalPages, onChange }: { page: number; totalPages: number; onChange: (page: number) => void }) {
  if (totalPages <= 1) return null
  return <nav aria-label="Phân trang" className="mt-4 flex items-center justify-end gap-3 text-sm">
    <Button variant="secondary" disabled={page === 0} onClick={() => onChange(page - 1)}>Trước</Button>
    <span aria-live="polite">Trang <strong>{page + 1}</strong>/{totalPages}</span>
    <Button variant="secondary" disabled={page + 1 >= totalPages} onClick={() => onChange(page + 1)}>Sau</Button>
  </nav>
}

export function statusTone(status: string): 'green' | 'gold' | 'red' | 'blue' | 'neutral' {
  if (['AVAILABLE','ACTIVE','CONFIRMED','PAID','COMPLETED','CHECKED_OUT'].includes(status)) return 'green'
  if (['RESERVED','PENDING','DRAFT','CLEANING'].includes(status)) return 'gold'
  if (['CANCELLED','FAILED','OUT_OF_SERVICE','MAINTENANCE','INACTIVE','LOCKED'].includes(status)) return 'red'
  if (['OCCUPIED','CHECKED_IN','ISSUED'].includes(status)) return 'blue'
  return 'neutral'
}
