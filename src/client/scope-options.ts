/**
 * The scope filter's option list.
 *
 * The options come from `hypatia scope list`, which names every scope the
 * shelf uses. A CLI that predates that command leaves only the rows on the
 * current page to read them from, so scopes that appear only on other pages,
 * or that the active filters hide, cannot be offered then.
 *
 * `scope list` counts statements as well as records, so a scope that only
 * statements carry is offered too, and filters the record list to nothing.
 *
 * @module @tkliuxing/dsh-hypatia-ui/client/scope-options
 */

import { GLOBAL_SCOPE_TOKEN, type Knowledge } from '../protocol.ts'

/** A scope roster and the shelf it was read for. */
export interface ScopeRoster {
  shelf: string
  /** Every scope the shelf uses, or null when the CLI could not list them. */
  scopes: string[] | null
}

/** What the scope dropdown offers besides "any scope". */
export interface ScopeOptions {
  /** Named scopes, sorted. */
  values: string[]
  /** Whether to offer the global (empty) scope, as `GLOBAL_SCOPE_TOKEN`. */
  hasGlobal: boolean
}

/**
 * Build the scope filter's options.
 * @param roster - the last roster read, or null before the first one arrives.
 *   Only a roster read for `shelf` is used; one read for the shelf just left
 *   is never offered while the next one loads.
 * @param shelf - the shelf on screen.
 * @param items - the rows on the current page, read when there is no usable
 *   roster; the empty string among their scopes is the global scope.
 * @param selected - the dropdown's current value. It stays among the options
 *   even when the source does not name it, so the controlled select never
 *   holds a value missing from its own options.
 * @returns the named scopes and whether the global scope is offered.
 */
export function scopeOptions(
  roster: ScopeRoster | null, shelf: string, items: readonly Knowledge[], selected: string,
): ScopeOptions {
  const shelfScopes = roster?.shelf === shelf ? roster.scopes : null
  const source = shelfScopes ?? items.flatMap(item => item.content.scopes)
  const values = new Set<string>()
  let hasGlobal = selected === GLOBAL_SCOPE_TOKEN
  for (const scope of source) {
    if (scope === '') hasGlobal = true
    else values.add(scope)
  }
  if (selected !== '' && selected !== GLOBAL_SCOPE_TOKEN) values.add(selected)
  return { values: [...values].sort((left, right) => left.localeCompare(right)), hasGlobal }
}
