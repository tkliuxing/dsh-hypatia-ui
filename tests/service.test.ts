/**
 * Service-level behavior over a stubbed CLI.
 *
 * The cases here are the ones where getting it wrong is invisible rather than
 * loud: a cursor that silently pages through a different query, a filtered
 * page that stops early, a dangling graph reference dropped from the map, a
 * deletion that cascades when it was told not to, and a batch that abandons
 * the records behind the one that failed.
 */

import { describe, expect, it, vi } from 'vitest'
import type { HypatiaCli } from '../src/host/hypatia-cli.ts'
import { decodeCursor, encodeCursor, HypatiaService, RequestValidationError } from '../src/host/service.ts'
import type { Knowledge, Relationship } from '../src/protocol.ts'

const QUERY = { shelf: 'default', q: '', tag: '', scope: '' }

function record(name: string, tags: string[] = [], scopes: string[] = []): Knowledge {
  return { name, content: { data: name, format: 'markdown', tags, scopes, figures: [] }, createdAt: '' }
}

function relationship(subject: string, predicate: string, object: string): Relationship {
  return {
    subject, predicate, object,
    createdAt: '',
    content: { data: '', format: 'markdown', tags: [], scopes: [], figures: [] },
    direction: 'outgoing',
  }
}

/** A CLI stub: only the members the service actually reaches are provided. */
function stubCli(overrides: Partial<HypatiaCli>): HypatiaCli {
  return {
    version: vi.fn(),
    shelves: vi.fn(),
    scopes: vi.fn(),
    run: vi.fn(),
    query: vi.fn(),
    searchKnowledgeKeys: vi.fn(),
    knowledgeByNames: vi.fn(),
    knowledge: vi.fn(),
    relationships: vi.fn(),
    deleteStatement: vi.fn(),
    deleteKnowledge: vi.fn(),
    ...overrides,
  } as unknown as HypatiaCli
}

describe('cursors', () => {
  it('round-trips an offset', () => {
    expect(decodeCursor(encodeCursor({ ...QUERY, offset: 42 }), QUERY)).toBe(42)
  })

  it('treats the empty token as the first page', () => {
    expect(decodeCursor('', QUERY)).toBe(0)
  })

  it('refuses a cursor issued for a different query', () => {
    const cursor = encodeCursor({ ...QUERY, offset: 42 })
    expect(() => decodeCursor(cursor, { ...QUERY, shelf: 'other' })).toThrow(RequestValidationError)
    expect(() => decodeCursor(cursor, { ...QUERY, q: 'rust' })).toThrow(RequestValidationError)
    expect(() => decodeCursor(cursor, { ...QUERY, tag: 'x' })).toThrow(RequestValidationError)
    expect(() => decodeCursor(cursor, { ...QUERY, scope: 'x' })).toThrow(RequestValidationError)
  })

  it('refuses a malformed or negative token', () => {
    expect(() => decodeCursor('not-base64url!!', QUERY)).toThrow(RequestValidationError)
    expect(() => decodeCursor(encodeCursor({ ...QUERY, offset: -1 }), QUERY)).toThrow(RequestValidationError)
  })
})

describe('scopes', () => {
  it('reports the roster as supported when the CLI can list it', async () => {
    const service = new HypatiaService(stubCli({ scopes: vi.fn().mockResolvedValue(['', 'hypatia']) }))
    await expect(service.scopes('default')).resolves.toEqual({ supported: true, scopes: ['', 'hypatia'] })
  })

  it('reports an empty, unsupported roster when the CLI predates `scope list`', async () => {
    const service = new HypatiaService(stubCli({ scopes: vi.fn().mockResolvedValue(null) }))
    await expect(service.scopes('default')).resolves.toEqual({ supported: false, scopes: [] })
  })
})

describe('knowledgePage', () => {
  it('returns a short page with no continuation cursor', async () => {
    const cli = stubCli({ query: vi.fn().mockResolvedValue([{ name: 'a' }, { name: 'b' }]) })
    const page = await new HypatiaService(cli).knowledgePage('default', '', '', '', 10, 0)
    expect(page.items.map(item => item.name)).toEqual(['a', 'b'])
    expect(page.nextCursor).toBeNull()
  })

  it('caps a full page and hands back a cursor resuming past its last row', async () => {
    // limit 2 requests 3 source rows; the third proves a next page exists.
    const cli = stubCli({ query: vi.fn().mockResolvedValue([{ name: 'a' }, { name: 'b' }, { name: 'c' }]) })
    const page = await new HypatiaService(cli).knowledgePage('default', '', '', '', 2, 0)
    expect(page.items.map(item => item.name)).toEqual(['a', 'b'])
    expect(page.nextCursor).not.toBeNull()
    expect(decodeCursor(page.nextCursor!, QUERY)).toBe(2)
  })

  it('keeps scanning source batches until a filtered page fills', async () => {
    // Only the last row of the second batch matches, so a single-batch
    // implementation would answer an empty page and stop.
    const query = vi.fn()
      .mockResolvedValueOnce(Array.from({ length: 200 }, (_, index) => ({ name: `n${index}` })))
      .mockResolvedValueOnce([{ name: 'target', content: { tags: ['keep'] } }])
    const page = await new HypatiaService(stubCli({ query })).knowledgePage('default', '', 'keep', '', 10, 0)
    expect(page.items.map(item => item.name)).toEqual(['target'])
    expect(page.nextCursor).toBeNull()
    expect(query).toHaveBeenCalledTimes(2)
  })

  it('drops a search hit whose record is gone but still consumes its offset', async () => {
    const cli = stubCli({
      searchKnowledgeKeys: vi.fn().mockResolvedValue(['alive', 'deleted']),
      knowledgeByNames: vi.fn().mockResolvedValue([record('alive')]),
    })
    const page = await new HypatiaService(cli).knowledgePage('default', 'term', '', '', 10, 0)
    expect(page.items.map(item => item.name)).toEqual(['alive'])
  })
})

describe('graphNode', () => {
  it('keeps a dangling reference as a node with no record', async () => {
    const cli = stubCli({
      relationships: vi.fn().mockResolvedValue([relationship('focus', 'mentions', 'ghost')]),
      knowledgeByNames: vi.fn().mockResolvedValue([record('focus')]),
    })
    const graph = await new HypatiaService(cli).graphNode('default', 'focus')
    expect(graph?.nodes.map(node => [node.name, node.knowledge === null])).toEqual([
      ['focus', false],
      ['ghost', true],
    ])
    expect(graph?.edges).toHaveLength(1)
  })

  it('answers null when the shelf knows neither a record nor a statement', async () => {
    const cli = stubCli({
      relationships: vi.fn().mockResolvedValue([]),
      knowledgeByNames: vi.fn().mockResolvedValue([]),
    })
    expect(await new HypatiaService(cli).graphNode('default', 'absent')).toBeNull()
  })

  it('escapes every edge-id component so a predicate cannot forge an id', async () => {
    const cli = stubCli({
      relationships: vi.fn().mockResolvedValue([relationship('a', 'x%00y', 'b')]),
      knowledgeByNames: vi.fn().mockResolvedValue([record('a'), record('b')]),
    })
    const graph = await new HypatiaService(cli).graphNode('default', 'a')
    expect(graph?.edges[0]?.id).toBe('a%00x%2500y%00b')
  })
})

describe('deleteKnowledge', () => {
  it('leaves related statements in place by default', async () => {
    const deleteStatement = vi.fn()
    const cli = stubCli({
      knowledge: vi.fn().mockResolvedValue(record('target')),
      relationships: vi.fn().mockResolvedValue([relationship('target', 'r', 'other')]),
      deleteStatement,
      deleteKnowledge: vi.fn(),
    })
    const result = await new HypatiaService(cli).deleteKnowledge('default', 'target', false)
    expect(result).toEqual({ deletedRelations: 0, retainedRelations: 1 })
    expect(deleteStatement).not.toHaveBeenCalled()
  })

  it('removes the statements first when cascading was requested', async () => {
    const calls: string[] = []
    const cli = stubCli({
      knowledge: vi.fn().mockResolvedValue(record('target')),
      relationships: vi.fn().mockResolvedValue([
        relationship('target', 'r', 'x'),
        relationship('y', 'r', 'target'),
      ]),
      deleteStatement: vi.fn(async () => { calls.push('statement') }),
      deleteKnowledge: vi.fn(async () => { calls.push('knowledge') }),
    })
    const result = await new HypatiaService(cli).deleteKnowledge('default', 'target', true)
    expect(result).toEqual({ deletedRelations: 2, retainedRelations: 0 })
    expect(calls).toEqual(['statement', 'statement', 'knowledge'])
  })

  it('answers null without deleting anything when the record is absent', async () => {
    const deleteKnowledge = vi.fn()
    const cli = stubCli({
      knowledge: vi.fn().mockResolvedValue(null),
      relationships: vi.fn().mockResolvedValue([]),
      deleteKnowledge,
    })
    expect(await new HypatiaService(cli).deleteKnowledge('default', 'absent', true)).toBeNull()
    expect(deleteKnowledge).not.toHaveBeenCalled()
  })

  it('serializes two concurrent deletions instead of interleaving them', async () => {
    const order: string[] = []
    const cli = stubCli({
      knowledge: vi.fn(async (_shelf: string, name: string) => {
        order.push(`read:${name}`)
        await new Promise(resolve => { setTimeout(resolve, 5) })
        return record(name)
      }),
      relationships: vi.fn().mockResolvedValue([]),
      deleteKnowledge: vi.fn(async (_shelf: string, name: string) => { order.push(`delete:${name}`) }),
    })
    const service = new HypatiaService(cli)
    await Promise.all([
      service.deleteKnowledge('default', 'first', false),
      service.deleteKnowledge('default', 'second', false),
    ])
    expect(order).toEqual(['read:first', 'delete:first', 'read:second', 'delete:second'])
  })
})

describe('batch deletion', () => {
  it('reports every record separately and steps over an absent one', async () => {
    const deleted: string[] = []
    const cli = stubCli({
      knowledge: vi.fn(async (_shelf: string, name: string) => (name === 'gone' ? null : record(name))),
      relationships: vi.fn().mockResolvedValue([]),
      deleteKnowledge: vi.fn(async (_shelf: string, name: string) => { deleted.push(name) }),
    })

    const result = await new HypatiaService(cli).deleteKnowledgeBatch('default', ['a', 'gone', 'b'], false)

    expect(deleted).toEqual(['a', 'b'])
    expect(result.deletedCount).toBe(2)
    expect(result.missingCount).toBe(1)
    expect(result.failedCount).toBe(0)
    expect(result.outcomes.map(outcome => outcome.status)).toEqual(['deleted', 'missing', 'deleted'])
  })

  it('keeps going past a record whose removal failed, and names it', async () => {
    const deleted: string[] = []
    const cli = stubCli({
      knowledge: vi.fn(async (_shelf: string, name: string) => record(name)),
      relationships: vi.fn().mockResolvedValue([]),
      deleteKnowledge: vi.fn(async (_shelf: string, name: string) => {
        if (name === 'locked') throw new Error('shelf is read-only')
        deleted.push(name)
      }),
    })

    const result = await new HypatiaService(cli).deleteKnowledgeBatch('default', ['a', 'locked', 'b'], false)

    expect(deleted).toEqual(['a', 'b'])
    expect(result.deletedCount).toBe(2)
    expect(result.failedCount).toBe(1)
    expect(result.outcomes[1]).toEqual({
      name: 'locked', status: 'failed', deletedRelations: 0, retainedRelations: 0, error: 'shelf is read-only',
    })
  })

  it('counts a statement joining two deleted records once', async () => {
    const shared = relationship('a', 'r', 'b')
    const removed = new Set<string>()
    const cli = stubCli({
      knowledge: vi.fn(async (_shelf: string, name: string) => record(name)),
      // The impact is re-read per record, so the statement taken out with `a`
      // is already gone by the time `b` is looked at.
      relationships: vi.fn(async () => (removed.has('a r b') ? [] : [shared])),
      deleteStatement: vi.fn(async () => { removed.add('a r b') }),
      deleteKnowledge: vi.fn(),
    })

    const result = await new HypatiaService(cli).deleteKnowledgeBatch('default', ['a', 'b'], true)

    expect(result.deletedRelations).toBe(1)
    expect(cli.deleteStatement).toHaveBeenCalledTimes(1)
  })

  it('counts a retained statement between two deleted records once', async () => {
    const cli = stubCli({
      knowledge: vi.fn(async (_shelf: string, name: string) => record(name)),
      relationships: vi.fn().mockResolvedValue([relationship('a', 'r', 'b')]),
      deleteStatement: vi.fn(),
      deleteKnowledge: vi.fn(),
    })

    const result = await new HypatiaService(cli).deleteKnowledgeBatch('default', ['a', 'b'], false)

    expect(result.retainedRelations).toBe(1)
    expect(result.outcomes.map(outcome => outcome.retainedRelations)).toEqual([1, 1])
    expect(cli.deleteStatement).not.toHaveBeenCalled()
  })

  it('holds the mutation queue for the whole run', async () => {
    const order: string[] = []
    const cli = stubCli({
      knowledge: vi.fn(async (_shelf: string, name: string) => {
        order.push(`read:${name}`)
        await new Promise(resolve => { setTimeout(resolve, 5) })
        return record(name)
      }),
      relationships: vi.fn().mockResolvedValue([]),
      deleteKnowledge: vi.fn(async (_shelf: string, name: string) => { order.push(`delete:${name}`) }),
    })
    const service = new HypatiaService(cli)

    await Promise.all([
      service.deleteKnowledgeBatch('default', ['a', 'b'], false),
      service.deleteKnowledge('default', 'single', false),
    ])

    expect(order).toEqual(['read:a', 'delete:a', 'read:b', 'delete:b', 'read:single', 'delete:single'])
  })
})
