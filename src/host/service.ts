/**
 * The read and write use-cases the routes expose, ported from
 * `hypatia-archive`'s `createApp` so the two consoles answer identically.
 *
 * Three behaviors carry real weight and are preserved exactly:
 *
 * - **Cursor paging over a filtered stream.** Tag and scope filters have no
 *   CLI expression, so a page is assembled by scanning source batches and
 *   keeping the matches. The cursor is the source offset just past the last
 *   returned row, bound to the query it was issued for — a cursor replayed
 *   against a different shelf, term, or filter is refused rather than
 *   silently paging through the wrong result set.
 * - **Deletion does not cascade.** Hypatia's `knowledge-delete` leaves
 *   statements behind, and so does this service unless the caller explicitly
 *   asked for the statements too. The receipt reports both counts.
 * - **Writes are serialized among themselves.** `HypatiaCli` already
 *   serializes every invocation, but a deletion is a *read-then-write*
 *   sequence; `queueMutation` keeps two concurrent deletions from
 *   interleaving their impact reads and removals.
 *
 * @module @tkliuxing/dsh-hypatia-ui/host/service
 */

import {
  DEFAULT_SHELF, GLOBAL_SCOPE_TOKEN,
  type DeleteResponse, type GraphEdge, type GraphNode, type GraphNodeResponse,
  type Impact, type Knowledge, type KnowledgePage, type Relationship, type Shelf,
} from '../protocol.ts'
import { buildKnowledgeQuery, filterKnowledge, HypatiaCli, normalizeKnowledge } from './hypatia-cli.ts'

/** Source rows read per scan pass while a tag or scope filter is active. */
const SCAN_BATCH_SIZE = 200

/** Per-direction statement cap for one graph focus read. */
const GRAPH_RELATION_LIMIT = 60

/** A request the caller composed wrongly; answered 400, never 500. */
export class RequestValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'RequestValidationError'
  }
}

/** The query identity a cursor is bound to, plus its position. */
interface KnowledgeCursor {
  shelf: string
  q: string
  tag: string
  scope: string
  offset: number
}

/** One source row with the offset a cursor would resume from just past it. */
interface IndexedKnowledge {
  knowledge: Knowledge
  nextOffset: number
}

/** The query identity half of a cursor. */
export type CursorQuery = Omit<KnowledgeCursor, 'offset'>

/**
 * Encode a paging cursor.
 * @param cursor - the query identity and source offset.
 * @returns an opaque base64url token.
 */
export function encodeCursor(cursor: KnowledgeCursor): string {
  return Buffer.from(JSON.stringify(cursor)).toString('base64url')
}

/**
 * Decode a paging cursor, checking it belongs to the query replaying it.
 * @param value - the token, or the empty string for the first page.
 * @param expected - the query identity the caller is paging.
 * @returns the source offset to resume from.
 * @throws {RequestValidationError} when the token is malformed or was issued
 *   for a different shelf, term, or filter.
 */
export function decodeCursor(value: string, expected: CursorQuery): number {
  if (value === '') return 0

  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as Partial<KnowledgeCursor>
    const offset = parsed.offset
    if (
      typeof offset !== 'number' || !Number.isSafeInteger(offset) || offset < 0
      || parsed.shelf !== expected.shelf || parsed.q !== expected.q
      || parsed.tag !== expected.tag || parsed.scope !== expected.scope
    ) {
      throw new Error('Cursor does not match the current query.')
    }
    return offset
  } catch {
    throw new RequestValidationError('The list cursor is invalid or belongs to a different query.')
  }
}

/** Stable edge identity; the components are escaped so none can contain the separator. */
function graphEdgeId(relationship: Relationship): string {
  return [relationship.subject, relationship.predicate, relationship.object]
    .map(encodeURIComponent)
    .join('%00')
}

/** The knowledge-console use-cases over one serialized CLI adapter. */
export class HypatiaService {
  /** Tail of the mutation queue; settles (never rejects) after each write. */
  private mutationTail: Promise<void> = Promise.resolve()

  constructor(private readonly cli: HypatiaCli) {}

  private queueMutation<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.mutationTail.then(operation, operation)
    this.mutationTail = result.then(() => undefined, () => undefined)
    return result
  }

  /**
   * Health probe.
   * @returns the CLI version line, proving the binary is reachable.
   */
  version(): Promise<string> {
    return this.cli.version()
  }

  /**
   * Shelf roster.
   * @returns every registered shelf with its connection state.
   */
  shelves(): Promise<Shelf[]> {
    return this.cli.shelves()
  }

  /**
   * Read one source batch: relevance-ordered search hits, or the plain
   * knowledge stream when no term was given.
   * @param shelf - shelf name.
   * @param search - free-text term; empty selects the plain stream.
   * @param offset - source offset.
   * @param limit - batch size.
   * @returns the batch and whether the source is exhausted behind it.
   */
  private async loadSourceBatch(
    shelf: string, search: string, offset: number, limit: number,
  ): Promise<{ rows: IndexedKnowledge[]; exhausted: boolean }> {
    if (search !== '') {
      const names = await this.cli.searchKnowledgeKeys(shelf, search, limit, offset)
      const knowledgeByName = new Map(
        (await this.cli.knowledgeByNames(shelf, names)).map(knowledge => [knowledge.name, knowledge]),
      )
      return {
        // A hit whose record has since been deleted drops out of the page but
        // still consumes its source offset, so paging cannot loop on it.
        rows: names.flatMap((name, index): IndexedKnowledge[] => {
          const knowledge = knowledgeByName.get(name)
          return knowledge === undefined ? [] : [{ knowledge, nextOffset: offset + index + 1 }]
        }),
        exhausted: names.length < limit,
      }
    }

    const rows = await this.cli.query(shelf, buildKnowledgeQuery('', { limit, offset }))
    return {
      rows: rows.map(normalizeKnowledge).map((knowledge, index) => ({ knowledge, nextOffset: offset + index + 1 })),
      exhausted: rows.length < limit,
    }
  }

  /**
   * Assemble one page of records under the active filters.
   * @param shelf - shelf name.
   * @param search - free-text term.
   * @param tag - tag filter.
   * @param scope - scope filter, or the global token.
   * @param limit - page size.
   * @param offset - source offset to resume from.
   * @returns the page and the cursor for the next one.
   */
  async knowledgePage(
    shelf: string, search: string, tag: string, scope: string, limit: number, offset: number,
  ): Promise<KnowledgePage> {
    const selected: IndexedKnowledge[] = []
    // With a local filter active, a source batch may yield very few matches,
    // so scan in wide batches; unfiltered, one page plus the lookahead row
    // that decides whether a next cursor exists is enough.
    const filtered = tag !== '' || scope !== ''
    const sourceLimit = filtered ? SCAN_BATCH_SIZE : limit + 1
    let sourceOffset = offset

    while (selected.length <= limit) {
      const batch = await this.loadSourceBatch(shelf, search, sourceOffset, sourceLimit)
      const matchingNames = new Set(
        filterKnowledge(batch.rows.map(row => row.knowledge), tag, scope).map(knowledge => knowledge.name),
      )

      for (const row of batch.rows) {
        if (!matchingNames.has(row.knowledge.name)) continue
        selected.push(row)
        if (selected.length > limit) break
      }

      if (selected.length > limit) {
        const items = selected.slice(0, limit)
        const last = items.at(-1)
        return {
          items: items.map(row => row.knowledge),
          nextCursor: last === undefined
            ? null
            : encodeCursor({ shelf, q: search, tag, scope, offset: last.nextOffset }),
        }
      }

      if (batch.exhausted) {
        return { items: selected.map(row => row.knowledge), nextCursor: null }
      }

      sourceOffset += sourceLimit
    }

    return { items: [], nextCursor: null }
  }

  /**
   * Read one record together with every statement touching it.
   * @param shelf - shelf name.
   * @param name - record name.
   * @returns the record and its relationships, or null when no record exists.
   */
  async impact(shelf: string, name: string): Promise<Impact | null> {
    const [knowledge, relationships] = await Promise.all([
      this.cli.knowledge(shelf, name),
      this.cli.relationships(shelf, name),
    ])
    return knowledge === null ? null : { knowledge, relationships }
  }

  /**
   * Map the local neighborhood around one entity.
   * @param shelf - shelf name.
   * @param name - the entity to focus.
   * @returns the focus, its neighbors, and the edges between them; null when
   *   the shelf knows neither a record nor a statement by that name.
   */
  async graphNode(shelf: string, name: string): Promise<GraphNodeResponse | null> {
    const relationships = await this.cli.relationships(shelf, name, GRAPH_RELATION_LIMIT)
    const names = [...new Set([name, ...relationships.flatMap(item => [item.subject, item.object])])]
    const knowledgeByName = new Map(
      (await this.cli.knowledgeByNames(shelf, names)).map(knowledge => [knowledge.name, knowledge]),
    )

    if (!knowledgeByName.has(name) && relationships.length === 0) return null

    const nodes: GraphNode[] = names.map(nodeName => ({
      id: nodeName,
      name: nodeName,
      // null marks a dangling reference: a statement still names this entity
      // although no record stores it — the visible trace of non-cascading
      // deletion, and deliberately kept on the map.
      knowledge: knowledgeByName.get(nodeName) ?? null,
    }))
    const edges: GraphEdge[] = relationships.map(relationship => ({
      id: graphEdgeId(relationship),
      source: relationship.subject,
      target: relationship.object,
      predicate: relationship.predicate,
      createdAt: relationship.createdAt,
      content: relationship.content,
    }))

    return { focus: name, nodes, edges }
  }

  /**
   * Delete one record, optionally with the statements that touch it.
   * @param shelf - shelf name.
   * @param name - record name.
   * @param deleteRelations - when true, remove the related statements first;
   *   when false, they deliberately survive (Hypatia's own behavior).
   * @returns the receipt, or null when no record carries that name.
   */
  deleteKnowledge(shelf: string, name: string, deleteRelations: boolean): Promise<Omit<DeleteResponse, 'name'> | null> {
    return this.queueMutation(async () => {
      const impact = await this.impact(shelf, name)
      if (impact === null) return null

      let deletedRelations = 0
      if (deleteRelations) {
        for (const relationship of impact.relationships) {
          await this.cli.deleteStatement(shelf, relationship)
          deletedRelations += 1
        }
      }
      await this.cli.deleteKnowledge(shelf, name)
      return {
        deletedRelations,
        retainedRelations: deleteRelations ? 0 : impact.relationships.length,
      }
    })
  }
}

/** Re-exported so route code spells one import for the request vocabulary. */
export { DEFAULT_SHELF, GLOBAL_SCOPE_TOKEN }
