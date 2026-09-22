/**
 * The scope dropdown's options.
 *
 * What matters is where they come from: the whole-shelf roster when the CLI
 * can list it, the rows on screen when it cannot or has not answered yet,
 * never the roster of the shelf just left, and never a dropdown whose value
 * has quietly dropped out of its own options.
 */

import { describe, expect, it } from 'vitest'
import { scopeOptions } from '../src/client/scope-options.ts'
import { GLOBAL_SCOPE_TOKEN, type Knowledge } from '../src/protocol.ts'

function record(name: string, scopes: string[]): Knowledge {
  return { name, content: { data: '', format: 'markdown', tags: [], scopes, figures: [] }, createdAt: '' }
}

const PAGE = [record('one', ['page-b', '']), record('two', ['page-a', 'page-b'])]
const FROM_PAGE = { values: ['page-a', 'page-b'], hasGlobal: true }

describe('scopeOptions', () => {
  it('offers the shelf roster, not the page, when the CLI can list scopes', () => {
    expect(scopeOptions({ shelf: 'a', scopes: ['zeta', 'alpha'] }, 'a', PAGE, ''))
      .toEqual({ values: ['alpha', 'zeta'], hasGlobal: false })
  })

  it('offers the global scope when the roster carries the empty string', () => {
    expect(scopeOptions({ shelf: 'a', scopes: ['', 'alpha'] }, 'a', PAGE, ''))
      .toEqual({ values: ['alpha'], hasGlobal: true })
  })

  it('falls back to the scopes on the page when the CLI cannot list them', () => {
    expect(scopeOptions({ shelf: 'a', scopes: null }, 'a', PAGE, '')).toEqual(FROM_PAGE)
  })

  it('falls back to the page before the first roster arrives', () => {
    expect(scopeOptions(null, 'a', PAGE, '')).toEqual(FROM_PAGE)
  })

  it('never offers the roster of another shelf', () => {
    expect(scopeOptions({ shelf: 'a', scopes: ['alpha'] }, 'b', PAGE, '')).toEqual(FROM_PAGE)
  })

  it('treats an empty roster as an empty shelf, not as a missing roster', () => {
    expect(scopeOptions({ shelf: 'a', scopes: [] }, 'a', PAGE, '')).toEqual({ values: [], hasGlobal: false })
  })

  it('keeps the selected scope selectable when the source does not name it', () => {
    expect(scopeOptions({ shelf: 'a', scopes: ['alpha'] }, 'a', [], 'gone'))
      .toEqual({ values: ['alpha', 'gone'], hasGlobal: false })
    expect(scopeOptions({ shelf: 'a', scopes: ['alpha'] }, 'a', [], GLOBAL_SCOPE_TOKEN))
      .toEqual({ values: ['alpha'], hasGlobal: true })
    expect(scopeOptions(null, 'a', PAGE, 'gone'))
      .toEqual({ values: ['gone', 'page-a', 'page-b'], hasGlobal: true })
  })
})
