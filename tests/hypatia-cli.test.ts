/**
 * CLI-adapter parsing and query construction.
 *
 * These are the functions that stand between Hypatia's output and everything
 * the console shows, so the cases here are the ones that would silently
 * corrupt the view rather than fail loudly: the two statement response shapes,
 * the no-results markers, the filter semantics of the empty scope, and telling
 * a CLI that predates `scope list` apart from one that failed.
 */

import { describe, expect, it, vi } from 'vitest'
import {
  buildKnowledgeQuery, buildStatementQuery, filterKnowledge, HypatiaCli, HypatiaCliError,
  isUnrecognizedSubcommand, normalizeContent, normalizeKnowledge, normalizeStatement,
  parseCliObject, parseCliRows, parseShelves, parseValueList,
} from '../src/host/hypatia-cli.ts'
import type { Knowledge } from '../src/protocol.ts'

function knowledge(name: string, tags: string[], scopes: string[]): Knowledge {
  return {
    name,
    content: { data: '', format: 'markdown', tags, scopes, figures: [] },
    createdAt: '',
  }
}

describe('normalizeContent', () => {
  it('defaults an absent format to markdown and drops non-string members', () => {
    expect(normalizeContent({ data: 'x', tags: ['a', 7], scopes: null })).toEqual({
      data: 'x', format: 'markdown', tags: ['a'], scopes: [], figures: [],
    })
  })

  it('tolerates a non-object content member', () => {
    expect(normalizeContent('nope')).toEqual({
      data: '', format: 'markdown', tags: [], scopes: [], figures: [],
    })
  })
})

describe('normalizeStatement', () => {
  it('reads the Hypatia 0.3.0 head/relation/tail shape', () => {
    const statement = normalizeStatement({ head: 'a', relation: 'knows', tail: 'b', created_at: '2026-01-01T00:00:00' })
    expect([statement.subject, statement.predicate, statement.object]).toEqual(['a', 'knows', 'b'])
    expect(statement.createdAt).toBe('2026-01-01T00:00:00')
  })

  it('still reads the older subject/predicate/object shape', () => {
    const statement = normalizeStatement({ subject: 'a', predicate: 'knows', object: 'b' })
    expect([statement.subject, statement.predicate, statement.object]).toEqual(['a', 'knows', 'b'])
  })

  it('prefers the 0.3.0 spelling when a row carries both', () => {
    const statement = normalizeStatement({ head: 'new', subject: 'old', relation: 'r', tail: 't' })
    expect(statement.subject).toBe('new')
  })
})

describe('normalizeKnowledge', () => {
  it('maps created_at onto createdAt', () => {
    expect(normalizeKnowledge({ name: 'n', created_at: '2026-02-03T04:05:06' })).toEqual({
      name: 'n',
      content: { data: '', format: 'markdown', tags: [], scopes: [], figures: [] },
      createdAt: '2026-02-03T04:05:06',
    })
  })
})

describe('parseCliRows', () => {
  it('reads a JSON array', () => {
    expect(parseCliRows('[{"name":"a"}]')).toEqual([{ name: 'a' }])
  })

  it('treats the no-results marker and empty output as an empty set', () => {
    expect(parseCliRows('No results found.\n')).toEqual([])
    expect(parseCliRows('   ')).toEqual([])
  })

  it('refuses a payload that is not an array of objects', () => {
    expect(() => parseCliRows('{"name":"a"}')).toThrow(HypatiaCliError)
    expect(() => parseCliRows('[1,2]')).toThrow(HypatiaCliError)
  })
})

describe('parseCliObject', () => {
  it('reads a JSON object', () => {
    expect(parseCliObject('{"name":"a"}')).toEqual({ name: 'a' })
  })

  it('answers null for both absence markers', () => {
    expect(parseCliObject('No results found.')).toBeNull()
    expect(parseCliObject('Knowledge "x" not found.')).toBeNull()
    expect(parseCliObject('')).toBeNull()
  })

  it('refuses a non-object payload', () => {
    expect(() => parseCliObject('[1]')).toThrow(HypatiaCliError)
  })
})

describe('parseShelves', () => {
  it('reads the three-column table and drops unparseable lines', () => {
    const stdout = [
      'default   /home/u/.hypatia/default   [connected]',
      'archive   /mnt/archive              [disconnected]',
      'a banner line that is not a row',
      '',
    ].join('\n')
    expect(parseShelves(stdout)).toEqual([
      { name: 'default', path: '/home/u/.hypatia/default', connected: true },
      { name: 'archive', path: '/mnt/archive', connected: false },
    ])
  })

  it('keeps a path containing single spaces intact', () => {
    expect(parseShelves('my shelf   /home/u/My Notes   [connected]')).toEqual([
      { name: 'my shelf', path: '/home/u/My Notes', connected: true },
    ])
  })
})

describe('buildKnowledgeQuery', () => {
  it('selects everything when no term is given', () => {
    expect(buildKnowledgeQuery('')).toEqual(['$knowledge'])
    expect(buildKnowledgeQuery('   ')).toEqual(['$knowledge'])
  })

  it('adds a $search condition for a term', () => {
    expect(buildKnowledgeQuery(' rust ')).toEqual(['$knowledge', ['$search', 'rust']])
  })

  it('uses the object form when a paging window is given', () => {
    expect(buildKnowledgeQuery('rust', { limit: 10, offset: 20 })).toEqual({
      $knowledge: [['$search', 'rust']], limit: 10, offset: 20,
    })
  })
})

describe('buildStatementQuery', () => {
  it('uses the array form without a limit', () => {
    expect(buildStatementQuery(['$triple', 'a', '$*', '$*'])).toEqual(['$statement', ['$triple', 'a', '$*', '$*']])
  })

  it('uses the object form with a limit', () => {
    expect(buildStatementQuery(['$triple', 'a', '$*', '$*'], 60)).toEqual({
      $statement: [['$triple', 'a', '$*', '$*']], limit: 60, offset: 0,
    })
  })
})

describe('filterKnowledge', () => {
  const items = [
    knowledge('one', ['Rust', 'lang'], ['project-a']),
    knowledge('two', ['python'], ['']),
    knowledge('three', [], ['project-a', 'project-b']),
  ]

  it('matches a tag case-insensitively by substring', () => {
    expect(filterKnowledge(items, 'rus', '').map(item => item.name)).toEqual(['one'])
  })

  it('matches a scope exactly', () => {
    expect(filterKnowledge(items, '', 'project-a').map(item => item.name)).toEqual(['one', 'three'])
    expect(filterKnowledge(items, '', 'project').map(item => item.name)).toEqual([])
  })

  it('maps the global token onto the empty scope', () => {
    expect(filterKnowledge(items, '', '__global__').map(item => item.name)).toEqual(['two'])
  })

  it('requires both filters to pass', () => {
    expect(filterKnowledge(items, 'lang', 'project-b')).toEqual([])
  })

  it('passes everything through when neither filter is set', () => {
    expect(filterKnowledge(items, '  ', '  ')).toHaveLength(3)
  })
})

describe('parseValueList', () => {
  it('reads the values of `scope list --json`, keeping the global scope as the empty string', () => {
    const stdout = '[\n  { "entries": 12, "value": "" },\n  { "entries": 8, "value": "hypatia" }\n]\n'
    expect(parseValueList(stdout)).toEqual(['', 'hypatia'])
  })

  it('reads an empty shelf as no values', () => {
    expect(parseValueList('[]\n')).toEqual([])
  })

  it('drops a row without a string value instead of reading it as the global scope', () => {
    expect(parseValueList('[{"entries":1},{"value":null},{"value":"a"}]')).toEqual(['a'])
  })

  it('refuses a payload that is not an array of objects', () => {
    expect(() => parseValueList('["a"]')).toThrow(HypatiaCliError)
  })
})

describe('isUnrecognizedSubcommand', () => {
  const refusal = new HypatiaCliError(
    "error: unrecognized subcommand 'scope'\n\nUsage: hypatia [COMMAND]\n\nFor more information, try '--help'.", 2,
  )

  it("recognizes the argument parser's refusal of that subcommand", () => {
    expect(isUnrecognizedSubcommand(refusal, 'scope')).toBe(true)
  })

  it('does not match another subcommand, another failure, or a non-CLI error', () => {
    expect(isUnrecognizedSubcommand(refusal, 'tag')).toBe(false)
    expect(isUnrecognizedSubcommand(new HypatiaCliError("Error: shelf error: shelf 'x' is not connected", 1), 'scope'))
      .toBe(false)
    expect(isUnrecognizedSubcommand(new Error("unrecognized subcommand 'scope'"), 'scope')).toBe(false)
  })
})

describe('HypatiaCli.scopes', () => {
  it('runs `scope list --json` against the shelf and returns the values', async () => {
    const cli = new HypatiaCli({ binary: 'hypatia' })
    const run = vi.spyOn(cli, 'run').mockResolvedValue({ stdout: '[{"value":"","entries":1}]', stderr: '' })
    await expect(cli.scopes('work')).resolves.toEqual([''])
    expect(run).toHaveBeenCalledWith(['scope', 'list', '--json', '--shelf', 'work'])
  })

  it('answers null when the CLI predates the scope subcommand', async () => {
    const cli = new HypatiaCli({ binary: 'hypatia' })
    vi.spyOn(cli, 'run').mockRejectedValue(new HypatiaCliError("error: unrecognized subcommand 'scope'", 2))
    await expect(cli.scopes('default')).resolves.toBeNull()
  })

  it('passes any other failure through', async () => {
    const cli = new HypatiaCli({ binary: 'hypatia' })
    vi.spyOn(cli, 'run').mockRejectedValue(new HypatiaCliError("Error: shelf error: shelf 'x' is not connected", 1))
    await expect(cli.scopes('x')).rejects.toThrow(/not connected/)
  })
})
