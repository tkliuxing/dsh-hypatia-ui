/**
 * Request-trust checks and JSON helpers for this plugin's routes.
 *
 * DSH's web server carries no authentication of its own — the shipped `dsh
 * web` composition authenticates its *own* API routes, and a route a plugin
 * registers is not one of them. These routes reach the `hypatia` CLI and can
 * delete knowledge, so the boundary is enforced here:
 *
 * - the connecting socket must be loopback, and
 * - the request must be same-origin with the server's own authority.
 *
 * A browser tab on the DSH page passes both. A page on another origin fails
 * the second check even from the same machine, so a drive-by `fetch` cannot
 * reach the CLI. The `sec-fetch-site` / `Origin` reading is a browser signal
 * and not an authority claim; the loopback socket is what actually bounds
 * reachability, and the origin check narrows it to this page.
 *
 * @module @tkliuxing/dsh-hypatia-ui/host/http
 */

import type { IncomingMessage, OutgoingHttpHeaders, ServerResponse } from 'node:http'
import { isIPv4, isIPv6 } from 'node:net'

/** Body cap for the one route that reads a body (deletion confirmation). */
export const JSON_BODY_MAX_BYTES = 8 * 1024

const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
  'referrer-policy': 'no-referrer',
} satisfies OutgoingHttpHeaders

/**
 * Whether an address is a loopback literal.
 * @param address - a remote address, possibly IPv4-mapped IPv6.
 * @returns true for 127.0.0.0/8, ::1, and ::ffff:127.0.0.0/8.
 */
export function isLoopbackAddress(address: string | undefined): boolean {
  if (address === undefined || address === '') return false
  const normalized = address.startsWith('::ffff:') ? address.slice('::ffff:'.length) : address
  if (isIPv4(normalized)) return normalized.startsWith('127.')
  if (isIPv6(normalized)) return normalized === '::1'
  return false
}

/**
 * Whether the request arrived over a loopback socket.
 * @param req - the incoming request.
 * @returns true when the peer address is loopback.
 */
export function isLoopbackRequest(req: IncomingMessage): boolean {
  return isLoopbackAddress(req.socket.remoteAddress ?? undefined)
}

/**
 * Whether the request is same-origin with its own Host authority.
 * @param req - the incoming request.
 * @returns true when `Origin` matches `Host`, or when no `Origin` was sent
 *   and `sec-fetch-site` says same-origin. A cross-site fetch is refused, and
 *   so is a request carrying neither marker (a bare `curl`).
 */
export function isSameOriginRequest(req: IncomingMessage): boolean {
  if (req.headers['sec-fetch-site'] === 'cross-site') return false
  const host = req.headers.host
  if (host === undefined || host === '') return false
  const origin = req.headers.origin
  if (origin === undefined) return req.headers['sec-fetch-site'] === 'same-origin'
  try {
    return new URL(origin).host === host
  } catch {
    return false
  }
}

/**
 * The single admission gate every route calls first.
 * @param req - the incoming request.
 * @returns true when the request may reach the CLI.
 */
export function isTrustedRequest(req: IncomingMessage): boolean {
  return isLoopbackRequest(req) && isSameOriginRequest(req)
}

/**
 * Write one JSON response.
 * @param res - the response to complete.
 * @param status - HTTP status code.
 * @param body - the payload, serialized as JSON.
 */
export function writeJson(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body)
  res.writeHead(status, { ...JSON_HEADERS, 'content-length': Buffer.byteLength(payload) })
  res.end(payload)
}

/**
 * Read a bounded JSON object body.
 * @param req - the incoming request.
 * @param maxBytes - body cap; a larger body destroys the request.
 * @returns the parsed object, or null for an empty body, invalid JSON, a
 *   non-object payload, or an overflow.
 */
export async function readJsonObject(
  req: IncomingMessage, maxBytes = JSON_BODY_MAX_BYTES,
): Promise<Record<string, unknown> | null> {
  const chunks: Buffer[] = []
  let size = 0
  try {
    for await (const chunk of req) {
      const buffer = chunk as Buffer
      size += buffer.length
      if (size > maxBytes) {
        req.destroy()
        return null
      }
      chunks.push(buffer)
    }
    const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'))
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : null
  } catch {
    return null
  }
}
