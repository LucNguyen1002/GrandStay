import { useEffect, useState } from 'react'
import { avatarStorageKey, subscribeToAvatarChanges } from '../profile/avatar-events'

function storedRevision(userId?: string) {
  return userId ? localStorage.getItem(avatarStorageKey(userId)) ?? '0' : '0'
}

function useAvatarRevision(userId?: string) {
  const [revision, setRevision] = useState(() => storedRevision(userId))

  useEffect(() => {
    const sync = (event: Event) => {
      if (!userId) return
      if (event instanceof StorageEvent) {
        if (event.key === avatarStorageKey(userId)) setRevision(event.newValue ?? '0')
        return
      }
      const detail = (event as CustomEvent<{ userId: string; revision: string }>).detail
      if (detail?.userId === userId) setRevision(detail.revision)
    }
    return subscribeToAvatarChanges(sync)
  }, [userId])

  return revision
}

export function UserAvatar({ userId, name, className = 'size-10 rounded-full' }: {
  userId?: string
  name?: string
  className?: string
}) {
  const revision = useAvatarRevision(userId)
  const baseUrl = import.meta.env.VITE_API_URL ?? '/api/v1'
  const imageUrl = userId ? `${baseUrl}/users/${encodeURIComponent(userId)}/avatar?v=${revision}` : ''
  const [failedUrl, setFailedUrl] = useState<string>()
  const showImage = Boolean(imageUrl && failedUrl !== imageUrl)
  const initial = (name?.trim() || 'G').charAt(0).toUpperCase()

  return <div className={`avatar-glow relative grid shrink-0 place-items-center overflow-hidden bg-forest font-display font-bold text-white ${className}`}>
    {showImage
      ? <img src={imageUrl} alt={`Ảnh đại diện của ${name || 'tài khoản'}`} className="absolute inset-0 size-full object-cover" onError={() => setFailedUrl(imageUrl)} />
      : <span aria-hidden="true">{initial}</span>}
  </div>
}
