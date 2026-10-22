/**
 * The tag filter's suggestion list.
 *
 * Two properties matter: a roster read for the shelf just left must not leak
 * into the next one, and the list has to stay small — a real shelf carries more
 * than a thousand tags, and the browser should only ever receive the fragment's
 * matches, not the whole vocabulary.
 */

import { describe, expect, it } from 'vitest'
import { tagSuggestions, TAG_SUGGESTION_LIMIT } from '../src/client/tag-options.ts'
import type { Knowledge } from '../src/protocol.ts'

function record(name: string, tags: string[]): Knowledge {
  return { name, content: { data: '', format: 'markdown', tags, scopes: [], figures: [] }, createdAt: '' }
}

describe('tagSuggestions', () => {
  it('offers nothing for an empty fragment, so the whole roster never drops down', () => {
    expect(tagSuggestions({ shelf: 'default', tags: ['system', 'hypatia'] }, 'default', [], '   ')).toEqual([])
  })

  it('matches the fragment case-insensitively and keeps the shelf spelling', () => {
    const roster = { shelf: 'default', tags: ['Hypatia', 'system', 'hypatia-auto-memory'] }
    expect(tagSuggestions(roster, 'default', [], 'HYPAT')).toEqual(['Hypatia', 'hypatia-auto-memory'])
  })

  it('deduplicates repeated tags', () => {
    const roster = { shelf: 'default', tags: ['system', 'system'] }
    expect(tagSuggestions(roster, 'default', [], 'sys')).toEqual(['system'])
  })

  it('caps a fragment that matches a large roster', () => {
    const tags = Array.from({ length: TAG_SUGGESTION_LIMIT + 20 }, (_, index) => `tag-${index}`)
    expect(tagSuggestions({ shelf: 'default', tags }, 'default', [], 'tag-')).toHaveLength(TAG_SUGGESTION_LIMIT)
  })

  it('ignores a roster read for another shelf and falls back to the page rows', () => {
    const rows = [record('a', ['system']), record('b', ['system', 'hypatia'])]
    expect(tagSuggestions({ shelf: 'other', tags: ['elsewhere'] }, 'default', rows, 's')).toEqual(['system'])
  })

  it('reads the page rows when the CLI cannot list tags', () => {
    const rows = [record('a', ['system']), record('b', ['hypatia'])]
    expect(tagSuggestions({ shelf: 'default', tags: null }, 'default', rows, 'hyp')).toEqual(['hypatia'])
  })

  it('answers nothing before the first roster arrives and the page is empty', () => {
    expect(tagSuggestions(null, 'default', [], 'sys')).toEqual([])
  })
})
