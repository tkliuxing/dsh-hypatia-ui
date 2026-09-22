/**
 * Browser face over the Host route family.
 *
 * Every call is same-origin against the page the shell already serves, so no
 * base URL, host, or port is configured here — the Host refuses anything that
 * is not same-origin loopback anyway.
 *
 * Errors arrive as the Host's `{ error }` envelope and are rethrown as plain
 * `Error`s carrying that message, so callers render the Host's own diagnosis
 * (a CLI failure reads like a CLI failure) instead of a generic HTTP code.
 *
 * @module @tkliuxing/dsh-hypatia-ui/client/api
 */

import {
  HYPATIA_API_PREFIX,
  type BatchDeleteResponse, type DeleteResponse, type GraphNodeResponse, type Impact,
  type KnowledgePage, type ScopesResponse, type ShelvesResponse,
} from '../protocol.ts'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(HYPATIA_API_PREFIX + path, {
    credentials: 'same-origin',
    ...init,
  })
  const body: unknown = await response.json().catch(() => ({}))
  if (!response.ok) {
    const message = typeof body === 'object' && body !== null && typeof (body as { error?: unknown }).error === 'string'
      ? (body as { error: string }).error
      : `Request failed (${response.status}).`
    throw new Error(message)
  }
  return body as T
}

/**
 * Read the shelf roster.
 * @param signal - abort signal.
 * @returns every registered shelf.
 */
export function getShelves(signal?: AbortSignal): Promise<ShelvesResponse> {
  return request('/shelves', signal === undefined ? undefined : { signal })
}

/**
 * Read every scope one shelf uses.
 * @param shelf - shelf name.
 * @param signal - abort signal.
 * @returns the scopes, or `supported: false` when the CLI cannot list them.
 */
export function getScopes(shelf: string, signal?: AbortSignal): Promise<ScopesResponse> {
  const search = new URLSearchParams({ shelf })
  return request(`/scopes?${search.toString()}`, signal === undefined ? undefined : { signal })
}

/** One page request's parameters. */
export interface KnowledgePageQuery {
  shelf: string
  q: string
  tag: string
  scope: string
  cursor?: string | undefined
  limit?: number
  signal?: AbortSignal | undefined
}

/**
 * Read one page of knowledge records.
 * @param params - shelf, filters, and the cursor to resume from.
 * @returns the page and its continuation cursor.
 */
export function getKnowledgePage(params: KnowledgePageQuery): Promise<KnowledgePage> {
  const search = new URLSearchParams({ shelf: params.shelf })
  if (params.q !== '') search.set('q', params.q)
  if (params.tag !== '') search.set('tag', params.tag)
  if (params.scope !== '') search.set('scope', params.scope)
  if (params.cursor !== undefined && params.cursor !== '') search.set('cursor', params.cursor)
  search.set('limit', String(params.limit ?? 50))
  return request(
    `/knowledge?${search.toString()}`,
    params.signal === undefined ? undefined : { signal: params.signal },
  )
}

/**
 * Read one record with every statement touching it.
 * @param shelf - shelf name.
 * @param name - record name.
 * @param signal - abort signal.
 * @returns the record and its relationships.
 */
export function getImpact(shelf: string, name: string, signal?: AbortSignal): Promise<Impact> {
  const search = new URLSearchParams({ shelf })
  return request(
    `/knowledge/${encodeURIComponent(name)}/impact?${search.toString()}`,
    signal === undefined ? undefined : { signal },
  )
}

/**
 * Read the local graph neighborhood around one entity.
 * @param shelf - shelf name.
 * @param name - the entity to focus.
 * @param signal - abort signal.
 * @returns the focus, its neighbors, and the edges between them.
 */
export function getGraphNode(shelf: string, name: string, signal?: AbortSignal): Promise<GraphNodeResponse> {
  const search = new URLSearchParams({ shelf })
  return request(
    `/graph/node/${encodeURIComponent(name)}?${search.toString()}`,
    signal === undefined ? undefined : { signal },
  )
}

/**
 * Delete one record.
 * @param shelf - shelf name.
 * @param name - record name.
 * @param deleteRelations - also remove the statements touching it.
 * @param acknowledgedName - the name the user retyped; the Host refuses a mismatch.
 * @returns the deletion receipt.
 */
export function deleteKnowledge(
  shelf: string, name: string, deleteRelations: boolean, acknowledgedName: string,
): Promise<DeleteResponse> {
  const search = new URLSearchParams({ shelf })
  return request(`/knowledge/${encodeURIComponent(name)}?${search.toString()}`, {
    method: 'DELETE',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ deleteRelations, acknowledgedName }),
  })
}

/**
 * Delete several records in one request.
 * @param shelf - shelf name.
 * @param names - record names; the Host deduplicates and caps them.
 * @param deleteRelations - also remove the statements touching them.
 * @param acknowledgedCount - the count the user retyped; the Host refuses a
 *   mismatch with the number of distinct names.
 * @returns the per-record receipt and the batch totals.
 */
export function deleteKnowledgeBatch(
  shelf: string, names: readonly string[], deleteRelations: boolean, acknowledgedCount: number,
): Promise<BatchDeleteResponse> {
  const search = new URLSearchParams({ shelf })
  return request(`/knowledge?${search.toString()}`, {
    method: 'DELETE',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ names: [...names], deleteRelations, acknowledgedCount }),
  })
}
