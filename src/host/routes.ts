/**
 * The `/api/dsh-hypatia` route family.
 *
 * One prefix route owns the whole family and dispatches internally, so the
 * plugin claims exactly one pattern on `ctx.webServer` and cannot collide
 * with a sibling plugin over individual paths.
 *
 * Failure mapping is deliberate and mirrors `hypatia-archive`:
 * a malformed request is 400, an absent record is 404, a CLI failure is 502
 * (the console is reachable, its backing tool is not), anything else is 500.
 *
 * @module @tkliuxing/dsh-hypatia-ui/host/routes
 */

import type { IncomingMessage, ServerResponse } from 'node:http'
import type { WebRoute } from '@deepseek-ai/dsh-host-webserver'
import {
  DEFAULT_PAGE_LIMIT, DEFAULT_SHELF, HYPATIA_API_PREFIX, MAX_BATCH_DELETE, MAX_PAGE_LIMIT,
} from '../protocol.ts'
import { HypatiaCliError } from './hypatia-cli.ts'
import { isTrustedRequest, readJsonObject, writeJson } from './http.ts'
import { decodeCursor, RequestValidationError, type HypatiaService } from './service.ts'

/** Sub-path of one request, plus the parsed query. */
interface ParsedRequest {
  /** Path after the family prefix, e.g. `/knowledge`. */
  path: string
  query: URLSearchParams
}

function parseRequest(req: IncomingMessage): ParsedRequest | null {
  const raw = req.url
  if (raw === undefined) return null
  try {
    // The base is a placeholder: only the pathname and search are read.
    const url = new URL(raw, 'http://localhost')
    if (!url.pathname.startsWith(HYPATIA_API_PREFIX)) return null
    const path = url.pathname.slice(HYPATIA_API_PREFIX.length)
    return { path: path === '' ? '/' : path, query: url.searchParams }
  } catch {
    return null
  }
}

function queryValue(query: URLSearchParams, key: string, fallback = ''): string {
  return query.get(key) ?? fallback
}

function limitValue(query: URLSearchParams): number {
  const parsed = Number.parseInt(queryValue(query, 'limit', String(DEFAULT_PAGE_LIMIT)), 10)
  return Number.isFinite(parsed) ? Math.min(Math.max(parsed, 1), MAX_PAGE_LIMIT) : DEFAULT_PAGE_LIMIT
}

/**
 * Decode one path segment carrying a knowledge name.
 * @param segment - the raw, percent-encoded segment.
 * @returns the decoded name, or null when the escape is malformed or empty.
 */
function decodeName(segment: string): string | null {
  try {
    const name = decodeURIComponent(segment)
    return name === '' ? null : name
  } catch {
    return null
  }
}

/**
 * Read the name list out of a batch-deletion body.
 * @param value - the raw `names` member.
 * @returns the deduplicated names, or null when the member is not a
 *   non-empty array of non-empty strings within the batch cap.
 */
function decodeNames(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null
  if (!value.every((item): item is string => typeof item === 'string' && item !== '')) return null
  const names = [...new Set(value)]
  return names.length === 0 || names.length > MAX_BATCH_DELETE ? null : names
}

function statusFor(error: unknown): number {
  if (error instanceof RequestValidationError) return 400
  if (error instanceof HypatiaCliError) return 502
  return 500
}

function messageFor(error: unknown): string {
  return error instanceof Error ? error.message : 'Unexpected server error.'
}

/**
 * Build the plugin's route table.
 * @param service - the use-case face backed by the CLI adapter.
 * @returns the routes to register on `ctx.webServer`.
 */
export function makeHypatiaRoutes(service: HypatiaService): WebRoute[] {
  const handler = async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    if (!isTrustedRequest(req)) {
      writeJson(res, 403, { error: 'This endpoint only answers same-origin requests from the local DSH page.' })
      return
    }
    const parsed = parseRequest(req)
    if (parsed === null) {
      writeJson(res, 400, { error: 'Malformed request URL.' })
      return
    }

    try {
      await dispatch(service, req, res, parsed)
    } catch (error: unknown) {
      if (res.headersSent) {
        res.destroy()
        return
      }
      writeJson(res, statusFor(error), { error: messageFor(error) })
    }
  }

  return [{ kind: 'prefix', path: HYPATIA_API_PREFIX, handler }]
}

async function dispatch(
  service: HypatiaService, req: IncomingMessage, res: ServerResponse, { path, query }: ParsedRequest,
): Promise<void> {
  const method = req.method ?? 'GET'
  const shelf = queryValue(query, 'shelf', DEFAULT_SHELF)

  if (path === '/health') {
    if (method !== 'GET' && method !== 'HEAD') return methodNotAllowed(res, 'GET, HEAD')
    writeJson(res, 200, { status: 'ready', version: await service.version() })
    return
  }

  if (path === '/shelves') {
    if (method !== 'GET' && method !== 'HEAD') return methodNotAllowed(res, 'GET, HEAD')
    writeJson(res, 200, { shelves: await service.shelves() })
    return
  }

  if (path === '/knowledge') {
    if (method === 'DELETE') return deleteBatch(service, req, res, shelf)
    if (method !== 'GET' && method !== 'HEAD') return methodNotAllowed(res, 'GET, HEAD, DELETE')
    const search = queryValue(query, 'q')
    const tag = queryValue(query, 'tag')
    const scope = queryValue(query, 'scope')
    const offset = decodeCursor(queryValue(query, 'cursor'), { shelf, q: search, tag, scope })
    writeJson(res, 200, await service.knowledgePage(shelf, search, tag, scope, limitValue(query), offset))
    return
  }

  const graphMatch = /^\/graph\/node\/([^/]+)$/.exec(path)
  if (graphMatch !== null) {
    if (method !== 'GET' && method !== 'HEAD') return methodNotAllowed(res, 'GET, HEAD')
    const name = decodeName(graphMatch[1]!)
    if (name === null) {
      writeJson(res, 400, { error: 'Malformed knowledge name.' })
      return
    }
    const graphNode = await service.graphNode(shelf, name)
    if (graphNode === null) {
      writeJson(res, 404, { error: 'Knowledge or graph entity was not found.' })
      return
    }
    writeJson(res, 200, graphNode)
    return
  }

  const impactMatch = /^\/knowledge\/([^/]+)\/impact$/.exec(path)
  if (impactMatch !== null) {
    if (method !== 'GET' && method !== 'HEAD') return methodNotAllowed(res, 'GET, HEAD')
    const name = decodeName(impactMatch[1]!)
    if (name === null) {
      writeJson(res, 400, { error: 'Malformed knowledge name.' })
      return
    }
    const impact = await service.impact(shelf, name)
    if (impact === null) {
      writeJson(res, 404, { error: 'Knowledge entry was not found.' })
      return
    }
    writeJson(res, 200, impact)
    return
  }

  const deleteMatch = /^\/knowledge\/([^/]+)$/.exec(path)
  if (deleteMatch !== null) {
    if (method !== 'DELETE') return methodNotAllowed(res, 'DELETE')
    const name = decodeName(deleteMatch[1]!)
    if (name === null) {
      writeJson(res, 400, { error: 'Malformed knowledge name.' })
      return
    }
    const body = await readJsonObject(req) ?? {}
    const acknowledgedName = typeof body['acknowledgedName'] === 'string' ? body['acknowledgedName'] : ''
    const deleteRelations = body['deleteRelations'] === true

    // The retyped name is the confirmation itself, checked on the Host so a
    // caller that skips the dialog is refused the same way.
    if (acknowledgedName !== name) {
      writeJson(res, 400, { error: 'Enter the exact knowledge name to confirm deletion.' })
      return
    }

    const result = await service.deleteKnowledge(shelf, name, deleteRelations)
    if (result === null) {
      writeJson(res, 404, { error: 'Knowledge entry was not found.' })
      return
    }
    writeJson(res, 200, { name, ...result })
    return
  }

  writeJson(res, 404, { error: 'Unknown endpoint.' })
}

/**
 * Handle `DELETE /knowledge`: remove several records in one queued run.
 *
 * The retyped *count* plays the part the retyped *name* plays for a single
 * record — it is checked here, not only in the dialog, so a caller that skips
 * the dialog is refused the same way. The batch itself is not a transaction:
 * a 200 carries a per-record receipt that may name records that were already
 * gone or whose removal failed.
 *
 * @param service - the use-case face.
 * @param req - the incoming request.
 * @param res - the response to complete.
 * @param shelf - the shelf named by the query string.
 */
async function deleteBatch(
  service: HypatiaService, req: IncomingMessage, res: ServerResponse, shelf: string,
): Promise<void> {
  const body = await readJsonObject(req) ?? {}
  const names = decodeNames(body['names'])
  if (names === null) {
    writeJson(res, 400, {
      error: `Provide between 1 and ${MAX_BATCH_DELETE} knowledge names to delete.`,
    })
    return
  }
  if (body['acknowledgedCount'] !== names.length) {
    writeJson(res, 400, { error: 'Enter the exact number of records to confirm deletion.' })
    return
  }

  writeJson(res, 200, await service.deleteKnowledgeBatch(shelf, names, body['deleteRelations'] === true))
}

function methodNotAllowed(res: ServerResponse, allow: 'GET, HEAD' | 'GET, HEAD, DELETE' | 'DELETE'): void {
  res.setHeader('allow', allow)
  writeJson(res, 405, { error: `Method not allowed; use ${allow}.` })
}
