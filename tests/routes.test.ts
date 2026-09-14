/**
 * The batch-deletion route's own guards.
 *
 * The dialog is not the boundary — the Host is. A caller that skips the
 * console must be refused for the same reasons the console refuses it: a name
 * list that is empty, over the cap, or not strings at all, and a retyped
 * count that does not match the records actually being removed.
 */

import type { IncomingMessage, ServerResponse } from 'node:http'
import { describe, expect, it, vi } from 'vitest'
import { makeHypatiaRoutes } from '../src/host/routes.ts'
import type { HypatiaService } from '../src/host/service.ts'
import { HYPATIA_API_PREFIX, MAX_BATCH_DELETE } from '../src/protocol.ts'

/** One captured response. */
interface Captured { status: number; body: unknown }

function requestFor(method: string, path: string, body?: unknown): IncomingMessage {
  const payload = body === undefined ? '' : JSON.stringify(body)
  return {
    method,
    url: HYPATIA_API_PREFIX + path,
    headers: { host: '127.0.0.1:3080', origin: 'http://127.0.0.1:3080' },
    socket: { remoteAddress: '127.0.0.1' },
    async *[Symbol.asyncIterator]() { if (payload !== '') yield Buffer.from(payload) },
  } as unknown as IncomingMessage
}

function responseInto(captured: Partial<Captured>): ServerResponse {
  return {
    headersSent: false,
    setHeader: () => undefined,
    writeHead: (status: number) => { captured.status = status },
    end: (payload: string) => { captured.body = JSON.parse(payload) },
    destroy: () => undefined,
  } as unknown as ServerResponse
}

/** Run one request through the single prefix route. */
async function call(service: Partial<HypatiaService>, req: IncomingMessage): Promise<Captured> {
  const captured: Partial<Captured> = {}
  const route = makeHypatiaRoutes(service as HypatiaService)[0]!
  await route.handler(req, responseInto(captured))
  return { status: captured.status ?? 0, body: captured.body }
}

describe('DELETE /knowledge', () => {
  it('deletes the deduplicated names once the retyped count matches', async () => {
    const deleteKnowledgeBatch = vi.fn().mockResolvedValue({
      outcomes: [], deletedCount: 2, missingCount: 0, failedCount: 0, deletedRelations: 0, retainedRelations: 0,
    })
    const result = await call({ deleteKnowledgeBatch }, requestFor('DELETE', '/knowledge?shelf=notes', {
      names: ['a', 'b', 'a'], acknowledgedCount: 2, deleteRelations: true,
    }))

    expect(result.status).toBe(200)
    expect(deleteKnowledgeBatch).toHaveBeenCalledWith('notes', ['a', 'b'], true)
  })

  it('refuses a count that does not match the distinct names', async () => {
    const deleteKnowledgeBatch = vi.fn()
    // Three names were sent, but two of them are the same record.
    const result = await call({ deleteKnowledgeBatch }, requestFor('DELETE', '/knowledge', {
      names: ['a', 'b', 'a'], acknowledgedCount: 3, deleteRelations: false,
    }))

    expect(result.status).toBe(400)
    expect(deleteKnowledgeBatch).not.toHaveBeenCalled()
  })

  it('refuses an absent, empty, over-cap, or non-string name list', async () => {
    const deleteKnowledgeBatch = vi.fn()
    const service = { deleteKnowledgeBatch }
    const bodies = [
      {},
      { names: [], acknowledgedCount: 0 },
      { names: [''], acknowledgedCount: 1 },
      { names: [1, 2], acknowledgedCount: 2 },
      {
        names: Array.from({ length: MAX_BATCH_DELETE + 1 }, (_unused, index) => `n${index}`),
        acknowledgedCount: MAX_BATCH_DELETE + 1,
      },
    ]

    for (const body of bodies) {
      expect((await call(service, requestFor('DELETE', '/knowledge', body))).status).toBe(400)
    }
    expect(deleteKnowledgeBatch).not.toHaveBeenCalled()
  })

  it('still refuses a cross-origin caller before reading the body', async () => {
    const deleteKnowledgeBatch = vi.fn()
    const req = requestFor('DELETE', '/knowledge', { names: ['a'], acknowledgedCount: 1 })
    req.headers.origin = 'https://evil.example'

    expect((await call({ deleteKnowledgeBatch }, req)).status).toBe(403)
    expect(deleteKnowledgeBatch).not.toHaveBeenCalled()
  })

  it('answers 405 for a method the collection route does not serve', async () => {
    const result = await call({}, requestFor('POST', '/knowledge'))
    expect(result.status).toBe(405)
  })
})
