const AVATAR_EVENT = 'grandstay:avatar'

export const avatarStorageKey = (userId: string) => `grandstay:avatar:${userId}`

export function notifyAvatarChanged(userId: string) {
  const revision = Date.now().toString()
  localStorage.setItem(avatarStorageKey(userId), revision)
  window.dispatchEvent(new CustomEvent(AVATAR_EVENT, { detail: { userId, revision } }))
}

export function subscribeToAvatarChanges(listener: (event: Event) => void) {
  window.addEventListener(AVATAR_EVENT, listener)
  window.addEventListener('storage', listener)
  return () => {
    window.removeEventListener(AVATAR_EVENT, listener)
    window.removeEventListener('storage', listener)
  }
}
