/**
 * The request-admission gate.
 *
 * These routes reach the `hypatia` CLI and can delete knowledge, and DSH's web
 * server authenticates only its own API routes — not a plugin's. So the
 * boundary asserted here is the whole boundary: a loopback socket AND either
 * a same-origin request or the marker-free shape the DSH desktop shell
 * forwards. A regression in any half would expose the CLI to any local
 * process or any page in the user's browser.
 */

import type { IncomingMessage } from 'node:http'
import { describe, expect, it } from 'vitest'
import {
  isDesktopShellRequest, isLoopbackAddress, isSameOriginRequest, isTrustedRequest,
} from '../src/host/http.ts'

function request(
  headers: Record<string, string>, remoteAddress: string | undefined = '127.0.0.1',
): IncomingMessage {
  return { headers, socket: { remoteAddress } } as unknown as IncomingMessage
}

describe('isLoopbackAddress', () => {
  it('accepts loopback literals, including IPv4-mapped IPv6', () => {
    expect(isLoopbackAddress('127.0.0.1')).toBe(true)
    expect(isLoopbackAddress('127.5.5.5')).toBe(true)
    expect(isLoopbackAddress('::1')).toBe(true)
    expect(isLoopbackAddress('::ffff:127.0.0.1')).toBe(true)
  })

  it('refuses every non-loopback address and an absent one', () => {
    expect(isLoopbackAddress('10.0.0.4')).toBe(false)
    expect(isLoopbackAddress('192.168.1.9')).toBe(false)
    expect(isLoopbackAddress('::ffff:10.0.0.4')).toBe(false)
    expect(isLoopbackAddress('fe80::1')).toBe(false)
    expect(isLoopbackAddress(undefined)).toBe(false)
    expect(isLoopbackAddress('')).toBe(false)
    expect(isLoopbackAddress('localhost')).toBe(false)
  })
})

describe('isSameOriginRequest', () => {
  it('accepts an Origin matching the Host authority', () => {
    expect(isSameOriginRequest(request({ host: '127.0.0.1:3080', origin: 'http://127.0.0.1:3080' }))).toBe(true)
  })

  it('accepts a same-origin fetch that sent no Origin header', () => {
    expect(isSameOriginRequest(request({ host: '127.0.0.1:3080', 'sec-fetch-site': 'same-origin' }))).toBe(true)
  })

  it('refuses another origin on the same host', () => {
    expect(isSameOriginRequest(request({ host: '127.0.0.1:3080', origin: 'http://127.0.0.1:5173' }))).toBe(false)
    expect(isSameOriginRequest(request({ host: '127.0.0.1:3080', origin: 'https://evil.example' }))).toBe(false)
  })

  it('refuses a cross-site request even when its Origin matches', () => {
    expect(isSameOriginRequest(request({
      host: '127.0.0.1:3080', origin: 'http://127.0.0.1:3080', 'sec-fetch-site': 'cross-site',
    }))).toBe(false)
  })

  it('refuses a request carrying neither marker (a bare curl)', () => {
    expect(isSameOriginRequest(request({ host: '127.0.0.1:3080' }))).toBe(false)
  })

  it('refuses a malformed Origin or a missing Host', () => {
    expect(isSameOriginRequest(request({ host: '127.0.0.1:3080', origin: 'not a url' }))).toBe(false)
    expect(isSameOriginRequest(request({ origin: 'http://127.0.0.1:3080' }))).toBe(false)
  })
})

describe('isDesktopShellRequest', () => {
  // The wire shape `forwardWebRequest` produces: `fetch` puts `Host` back from
  // the target URL, the browser markers stay deleted, the session cookie is set.
  const forwarded = { host: '127.0.0.1:53702', cookie: 'dsh_session=8f3a1c' }

  it('accepts the shape the desktop shell forwards, Host included', () => {
    expect(isDesktopShellRequest(request(forwarded))).toBe(true)
  })

  it('refuses the shape as soon as one browser marker survives', () => {
    expect(isDesktopShellRequest(request({ ...forwarded, origin: 'http://127.0.0.1:3080' }))).toBe(false)
    expect(isDesktopShellRequest(request({ ...forwarded, 'sec-fetch-site': 'same-origin' }))).toBe(false)
  })

  it('refuses a request without a cookie (a bare curl keeps its Host)', () => {
    expect(isDesktopShellRequest(request({ host: '127.0.0.1:53702' }))).toBe(false)
    expect(isDesktopShellRequest(request({ cookie: '' }))).toBe(false)
  })

  it('ignores the fetch-metadata headers the shell leaves untouched', () => {
    expect(isDesktopShellRequest(request({
      ...forwarded,
      'sec-fetch-mode': 'cors',
      'sec-fetch-dest': 'empty',
      accept: 'application/json',
      'content-type': 'application/json',
    }))).toBe(true)
  })
})

describe('isTrustedRequest', () => {
  const sameOrigin = { host: '127.0.0.1:3080', origin: 'http://127.0.0.1:3080' }

  it('admits a same-origin request over a loopback socket', () => {
    expect(isTrustedRequest(request(sameOrigin))).toBe(true)
  })

  it('admits the desktop shell forward over a loopback socket', () => {
    expect(isTrustedRequest(request({ host: '127.0.0.1:53702', cookie: 'dsh_session=8f3a1c' }))).toBe(true)
  })

  it('refuses the desktop shell forward over a non-loopback socket', () => {
    expect(isTrustedRequest(request({ host: '127.0.0.1:53702', cookie: 'dsh_session=8f3a1c' }, '10.0.0.4'))).toBe(false)
  })

  it('refuses a same-origin request arriving over a non-loopback socket', () => {
    expect(isTrustedRequest(request(sameOrigin, '10.0.0.4'))).toBe(false)
  })

  it('refuses a loopback request from another origin', () => {
    expect(isTrustedRequest(request({ host: '127.0.0.1:3080', origin: 'http://localhost:5173' }))).toBe(false)
  })
})
