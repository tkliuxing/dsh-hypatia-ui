/**
 * The `hypatia` CLI adapter: every read and write this plugin performs goes
 * through here.
 *
 * Two invariants come straight from Hypatia itself and must not be relaxed:
 *
 * 1. **One process at a time.** A shelf store admits a single CLI process, so
 *    every invocation queues behind the previous one on `commandTail`. The
 *    queue is per-adapter, and the plugin builds exactly one adapter.
 * 2. **argv, never a shell string.** Knowledge names, JSE queries, and
 *    predicates are user data; `spawn` receives them as an argv array with
 *    `shell: false` so no payload can compose a second command.
 *
 * Ported from `hypatia-ui`'s `server/hypatia.ts` (validated against Hypatia
 * 0.3.0), keeping its response normalization: 0.3.0 spells statement
 * positions `head` / `relation` / `tail`, while older shelves and CLI builds
 * spell them `subject` / `predicate` / `object`. Both are accepted.
 *
 * @module @tkliuxing/dsh-hypatia-ui/host/hypatia-cli
 */

import { spawn } from 'node:child_process'
import { GLOBAL_SCOPE_TOKEN } from '../protocol.ts'
import type {
  Knowledge, KnowledgeContent, Relationship, Shelf, Statement,
} from '../protocol.ts'

/** What the CLI prints for an empty result set. */
const NO_RESULTS = 'No results found.'

/** Fallback per-invocation timeout. */
const DEFAULT_TIMEOUT_MS = 20_000

/** An arbitrary JSON object decoded from CLI output. */
export type JsonRecord = Record<string, unknown>

/** A CLI invocation that failed: non-zero exit, timeout, or a spawn error. */
export class HypatiaCliError extends Error {
  constructor(message: string, readonly exitCode?: number | null) {
    super(message)
    this.name = 'HypatiaCliError'
  }
}

/** Adapter settings resolved from plugin config and the environment. */
export interface HypatiaCliOptions {
  /** Executable to run; an absolute path or a name resolved through PATH. */
  binary?: string
  /** Per-invocation timeout in milliseconds. */
  timeoutMs?: number
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

/**
 * Normalize a content envelope, defaulting an absent format to `markdown`
 * (the format the CLI itself assumes).
 * @param value - the raw `content` member of a CLI row.
 * @returns a fully populated content envelope.
 */
export function normalizeContent(value: unknown): KnowledgeContent {
  const source = isRecord(value) ? value : {}
  return {
    data: asString(source['data']),
    format: asString(source['format']) || 'markdown',
    tags: asStringArray(source['tags']),
    scopes: asStringArray(source['scopes']),
    figures: asStringArray(source['figures']),
  }
}

/**
 * Normalize one knowledge row.
 * @param value - a raw CLI row.
 * @returns the wire shape the browser reads.
 */
export function normalizeKnowledge(value: JsonRecord): Knowledge {
  return {
    name: asString(value['name']),
    content: normalizeContent(value['content']),
    createdAt: asString(value['created_at']),
  }
}

/**
 * Normalize one statement row across both CLI response shapes.
 * @param value - a raw CLI row using either `head`/`relation`/`tail` (0.3.0)
 *   or `subject`/`predicate`/`object` (older shelves).
 * @returns the wire shape the browser reads.
 */
export function normalizeStatement(value: JsonRecord): Statement {
  return {
    subject: asString(value['head']) || asString(value['subject']),
    predicate: asString(value['relation']) || asString(value['predicate']),
    object: asString(value['tail']) || asString(value['object']),
    createdAt: asString(value['created_at']),
    content: normalizeContent(value['content']),
  }
}

/**
 * Parse a JSON array of rows from CLI output.
 * @param stdout - raw command output.
 * @returns the rows, or an empty list for the no-results marker.
 * @throws {HypatiaCliError} when the payload is not an array of objects.
 */
export function parseCliRows(stdout: string): JsonRecord[] {
  const trimmed = stdout.trim()
  if (trimmed === '' || trimmed === NO_RESULTS) return []

  const parsed: unknown = JSON.parse(trimmed)
  if (!Array.isArray(parsed) || !parsed.every(isRecord)) {
    throw new HypatiaCliError('Hypatia returned an unexpected query response.')
  }
  return parsed
}

/**
 * Parse a single JSON object from CLI output.
 * @param stdout - raw command output.
 * @returns the object, or null for the no-results / not-found markers.
 * @throws {HypatiaCliError} when the payload is not a JSON object.
 */
export function parseCliObject(stdout: string): JsonRecord | null {
  const trimmed = stdout.trim()
  if (trimmed === '' || trimmed === NO_RESULTS || /not found\.$/i.test(trimmed)) return null

  const parsed: unknown = JSON.parse(trimmed)
  if (!isRecord(parsed)) {
    throw new HypatiaCliError('Hypatia returned an unexpected knowledge response.')
  }
  return parsed
}

/**
 * Parse the `hypatia list` table.
 * @param stdout - raw command output; columns are separated by runs of spaces
 *   and the state is bracketed.
 * @returns one row per parseable line; unparseable lines are dropped.
 */
export function parseShelves(stdout: string): Shelf[] {
  return stdout
    .split('\n')
    .map(line => line.trim())
    .filter(line => line !== '')
    .flatMap((line): Shelf[] => {
      const match = /^(.+?)\s{2,}(.+?)\s{2,}\[(connected|disconnected)\]$/.exec(line)
      if (match === null) return []
      return [{ name: match[1]!, path: match[2]!, connected: match[3] === 'connected' }]
    })
}

/**
 * Build the JSE query selecting knowledge records.
 * @param search - free-text term; empty selects everything.
 * @param options - paging window; omit for an unbounded array-form query.
 * @returns the JSE value to hand `hypatia query`.
 */
export function buildKnowledgeQuery(search: string, options?: { limit: number; offset: number }): unknown {
  const value = search.trim()
  const conditions: unknown[] = value !== '' ? [['$search', value]] : []

  if (options === undefined) return ['$knowledge', ...conditions]
  return { $knowledge: conditions, limit: options.limit, offset: options.offset }
}

/**
 * Build the JSE query selecting statements matching one triple pattern.
 * @param condition - the `$triple` condition.
 * @param limit - optional cap; omit for the unbounded array form.
 * @returns the JSE value to hand `hypatia query`.
 */
export function buildStatementQuery(condition: unknown, limit?: number): unknown {
  if (limit === undefined || limit === 0) return ['$statement', condition]
  return { $statement: [condition], limit, offset: 0 }
}

/**
 * Apply the local tag and scope filters the CLI itself does not express.
 * @param items - one source batch.
 * @param tag - case-insensitive substring match against any tag; empty matches all.
 * @param scope - exact scope match, or the global token for the empty scope;
 *   empty matches all.
 * @returns the records passing both filters.
 */
export function filterKnowledge(items: Knowledge[], tag: string, scope: string): Knowledge[] {
  const normalizedTag = tag.trim().toLocaleLowerCase()
  const normalizedScope = scope.trim()

  return items.filter(item => {
    const tagMatches = normalizedTag === ''
      || item.content.tags.some(itemTag => itemTag.toLocaleLowerCase().includes(normalizedTag))
    const scopeMatches = normalizedScope === ''
      || (normalizedScope === GLOBAL_SCOPE_TOKEN
        ? item.content.scopes.includes('')
        : item.content.scopes.includes(normalizedScope))
    return tagMatches && scopeMatches
  })
}

function relationshipKey(statement: Statement): string {
  return [statement.subject, statement.predicate, statement.object].join('\u0000')
}

/**
 * The serialized `hypatia` CLI face. One instance owns one invocation queue,
 * so callers never have to think about the store's single-process rule.
 */
export class HypatiaCli {
  private readonly binary: string
  private readonly timeoutMs: number
  /** Tail of the invocation queue; settles (never rejects) after each run. */
  private commandTail: Promise<void> = Promise.resolve()

  constructor(options: HypatiaCliOptions = {}) {
    this.binary = options.binary ?? process.env['HYPATIA_BIN'] ?? 'hypatia'
    const configured = options.timeoutMs ?? Number(process.env['HYPATIA_TIMEOUT_MS'] ?? DEFAULT_TIMEOUT_MS)
    this.timeoutMs = Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_TIMEOUT_MS
  }

  private execute(args: readonly string[]): Promise<{ stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
      // shell: false — every argument below carries user data (names, JSE
      // payloads, predicates) and must never be re-parsed by a shell.
      const child = spawn(this.binary, [...args], {
        env: process.env,
        shell: false,
        stdio: ['ignore', 'pipe', 'pipe'],
      })
      let stdout = ''
      let stderr = ''
      let timedOut = false
      const timer = setTimeout(() => {
        timedOut = true
        child.kill('SIGTERM')
      }, this.timeoutMs)

      child.stdout.setEncoding('utf8')
      child.stderr.setEncoding('utf8')
      child.stdout.on('data', (chunk: string) => { stdout += chunk })
      child.stderr.on('data', (chunk: string) => { stderr += chunk })
      child.on('error', (error: Error) => {
        clearTimeout(timer)
        reject(new HypatiaCliError(`Unable to start Hypatia: ${error.message}`))
      })
      child.on('close', (code: number | null) => {
        clearTimeout(timer)
        if (timedOut) {
          reject(new HypatiaCliError('Hypatia did not respond before the request timeout.', code))
          return
        }
        if (code !== 0) {
          const detail = (stderr !== '' ? stderr : stdout).trim()
          reject(new HypatiaCliError(detail !== '' ? detail : 'No diagnostic output was returned.', code))
          return
        }
        resolve({ stdout, stderr })
      })
    })
  }

  /**
   * Run one CLI invocation behind every invocation already queued.
   * @param args - the complete argv after the executable.
   * @returns the captured streams.
   * @throws {HypatiaCliError} on a spawn failure, timeout, or non-zero exit.
   */
  run(args: readonly string[]): Promise<{ stdout: string; stderr: string }> {
    // Both settlement paths start the next run: a failed invocation releases
    // the store just as a successful one does, so a single error must not
    // wedge the queue.
    const started = this.commandTail.then(() => this.execute(args), () => this.execute(args))
    this.commandTail = started.then(() => undefined, () => undefined)
    return started
  }

  /**
   * Run one JSE query.
   * @param shelf - shelf name.
   * @param jse - the query value, serialized as one argv entry.
   * @returns the raw rows.
   */
  async query(shelf: string, jse: unknown): Promise<JsonRecord[]> {
    const result = await this.run(['query', JSON.stringify(jse), '--shelf', shelf])
    return parseCliRows(result.stdout)
  }

  /**
   * Read the CLI version (the health probe).
   * @returns the trimmed version line.
   */
  async version(): Promise<string> {
    const result = await this.run(['--version'])
    return result.stdout.trim()
  }

  /**
   * Read the shelf roster.
   * @returns every registered shelf with its connection state.
   */
  async shelves(): Promise<Shelf[]> {
    const result = await this.run(['list'])
    return parseShelves(result.stdout)
  }

  /**
   * Full-text search, returning matching record names in relevance order.
   * @param shelf - shelf name.
   * @param search - the search term.
   * @param limit - page size.
   * @param offset - page offset.
   * @returns the matching keys.
   */
  async searchKnowledgeKeys(shelf: string, search: string, limit: number, offset: number): Promise<string[]> {
    const result = await this.run([
      'search', search,
      '--catalog', 'knowledge',
      '--limit', String(limit),
      '--offset', String(offset),
      '--shelf', shelf,
    ])
    return parseCliRows(result.stdout)
      .map(row => asString(row['key']))
      .filter(key => key !== '')
  }

  /**
   * Read several records by name in one query.
   * @param shelf - shelf name.
   * @param names - record names; duplicates and empties are dropped.
   * @returns the records that exist, in the requested order.
   */
  async knowledgeByNames(shelf: string, names: readonly string[]): Promise<Knowledge[]> {
    const uniqueNames = [...new Set(names.filter(name => name !== ''))]
    if (uniqueNames.length === 0) return []

    const conditions: unknown[] = uniqueNames.map(name => ['$eq', 'name', name])
    const condition = conditions.length === 1 ? conditions[0] : ['$or', ...conditions]
    const rows = await this.query(shelf, { $knowledge: [condition], limit: uniqueNames.length, offset: 0 })
    const byName = new Map(rows.map(normalizeKnowledge).map(knowledge => [knowledge.name, knowledge]))
    return uniqueNames.flatMap(name => {
      const knowledge = byName.get(name)
      return knowledge === undefined ? [] : [knowledge]
    })
  }

  /**
   * Read one record.
   * @param shelf - shelf name.
   * @param name - record name.
   * @returns the record, or null when the shelf stores none by that name.
   */
  async knowledge(shelf: string, name: string): Promise<Knowledge | null> {
    const result = await this.run(['knowledge-get', name, '--shelf', shelf])
    const row = parseCliObject(result.stdout)
    return row === null ? null : normalizeKnowledge(row)
  }

  /**
   * Read every statement touching one entity, in both directions.
   * @param shelf - shelf name.
   * @param name - the entity at the center.
   * @param limit - per-direction cap; omit for no cap.
   * @returns one entry per distinct triple; a triple found in both directions
   *   is reported once with direction `both`.
   */
  async relationships(shelf: string, name: string, limit?: number): Promise<Relationship[]> {
    const [outgoingRows, incomingRows] = await Promise.all([
      this.query(shelf, buildStatementQuery(['$triple', name, '$*', '$*'], limit)),
      this.query(shelf, buildStatementQuery(['$triple', '$*', '$*', name], limit)),
    ])
    const relationships = new Map<string, Relationship>()

    for (const row of outgoingRows) {
      const statement = normalizeStatement(row)
      relationships.set(relationshipKey(statement), { ...statement, direction: 'outgoing' })
    }
    for (const row of incomingRows) {
      const statement = normalizeStatement(row)
      const key = relationshipKey(statement)
      relationships.set(key, { ...statement, direction: relationships.has(key) ? 'both' : 'incoming' })
    }

    return [...relationships.values()]
  }

  /**
   * Delete one statement.
   * @param shelf - shelf name.
   * @param statement - the exact triple to remove.
   */
  async deleteStatement(shelf: string, statement: Statement): Promise<void> {
    await this.run([
      'statement-delete',
      statement.subject, statement.predicate, statement.object,
      '--shelf', shelf,
    ])
  }

  /**
   * Delete one knowledge record. Hypatia does not cascade to statements; the
   * caller removes those first when the user asked for it.
   * @param shelf - shelf name.
   * @param name - record name.
   */
  async deleteKnowledge(shelf: string, name: string): Promise<void> {
    await this.run(['knowledge-delete', name, '--shelf', shelf])
  }
}
