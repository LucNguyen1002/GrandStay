import { beforeEach, describe, expect, it } from 'vitest'
import { clearSession, decodeUser, readSession, saveSession } from './token-store'

const encode = (value: object) => btoa(JSON.stringify(value)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')

describe('token store', () => {
  beforeEach(clearSession)
  it('persists and clears token pairs', () => {
    const pair = { tokenType: 'Bearer', accessToken: 'a.b.c', accessTokenExpiresAt: '2026-01-01', refreshToken: 'refresh', refreshTokenExpiresAt: '2026-02-01' }
    saveSession(pair)
    expect(readSession()).toEqual(pair)
    clearSession()
    expect(readSession()).toBeNull()
  })
  it('decodes JWT claims', () => {
    const claims = { sub: 'id', username: 'admin', name: 'Admin', roles: ['ADMIN'], permissions: ['room:read'], exp: 9999999999 }
    expect(decodeUser(`${encode({ alg: 'none' })}.${encode(claims)}.`)).toEqual(claims)
  })
  it('rejects malformed JWT input', () => expect(decodeUser('invalid')).toBeNull())
})
