import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'
import { readSession } from '../api/token-store'
import { useAuth } from '../auth/AuthProvider'

const RECONNECT_DELAY = 3_000
const FALLBACK_REFRESH_INTERVAL = 15_000

export function RealtimeSync() {
  const queryClient = useQueryClient()
  const { isAuthenticated } = useAuth()

  useEffect(() => {
    if (!isAuthenticated) return

    let stopped = false
    let connected = false
    let controller: AbortController | undefined
    let reconnectTimer: number | undefined
    let refreshTimer: number | undefined

    const refreshActiveData = () => {
      window.clearTimeout(refreshTimer)
      refreshTimer = window.setTimeout(() => {
        void queryClient.invalidateQueries({ refetchType: 'active' })
      }, 120)
    }

    const connect = async () => {
      controller = new AbortController()
      try {
        // This lightweight request also lets the Axios interceptor rotate an expired access token.
        await api.get('/realtime/handshake', { signal: controller.signal })
        const token = readSession()?.accessToken
        if (!token || stopped) return

        const baseUrl = String(api.defaults.baseURL ?? '/api/v1').replace(/\/$/, '')
        const response = await fetch(`${baseUrl}/realtime/stream`, {
          headers: { Accept: 'text/event-stream', Authorization: `Bearer ${token}` },
          cache: 'no-store',
          signal: controller.signal,
        })
        if (!response.ok || !response.body) throw new Error(`Realtime stream returned ${response.status}`)

        connected = true
        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        while (!stopped) {
          const { value, done } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true }).replaceAll('\r\n', '\n')
          const blocks = buffer.split('\n\n')
          buffer = blocks.pop() ?? ''
          for (const block of blocks) {
            if (block.split('\n').some(line => line.startsWith('event:') && line.slice(6).trim() === 'update')) {
              refreshActiveData()
            }
          }
        }
      } catch (error) {
        if (!stopped && !(error instanceof DOMException && error.name === 'AbortError')) {
          connected = false
        }
      } finally {
        connected = false
        if (!stopped) reconnectTimer = window.setTimeout(() => void connect(), RECONNECT_DELAY)
      }
    }

    const fallbackTimer = window.setInterval(() => {
      if (!connected) void queryClient.invalidateQueries({ refetchType: 'active' })
    }, FALLBACK_REFRESH_INTERVAL)

    void connect()
    return () => {
      stopped = true
      controller?.abort()
      window.clearTimeout(reconnectTimer)
      window.clearTimeout(refreshTimer)
      window.clearInterval(fallbackTimer)
    }
  }, [isAuthenticated, queryClient])

  return null
}
