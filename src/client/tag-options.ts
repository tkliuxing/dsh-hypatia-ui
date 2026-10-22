/**
 * The tag filter's suggestion list.
 *
 * The roster comes from `hypatia tag list`, which names every tag the shelf
 * uses — a large set on a real shelf (more than a thousand on the author's), so
 * the list is narrowed to what the typed fragment matches and capped before it
 * reaches the DOM. A CLI that predates that command leaves only the rows on the
 * current page to read tags from, so tags that appear only on other pages, or
 * that the active filters hide, cannot be suggested then.
 *
 * Suggestions are a convenience, not the filter: the filter itself stays a
 * case-insensitive substring match, so a fragment that matches no suggestion
 * still filters, and a picked suggestion is just a filled-in fragment.
 *
 * @module @tkliuxing/dsh-hypatia-ui/client/tag-options
 */

import type { Knowledge } from '../protocol.ts'

/** A tag roster and the shelf it was read for. */
export interface TagRoster {
  shelf: string
  /** Every tag the shelf uses, or null when the CLI could not list them. */
  tags: string[] | null
}

/** Most suggestions a single input render offers. */
export const TAG_SUGGESTION_LIMIT = 50

/**
 * Build the datalist suggestions for the current tag fragment.
 * @param roster - the last roster read, or null before the first one arrives.
 *   Only a roster read for `shelf` is used; one read for the shelf just left
 *   is never offered while the next one loads.
 * @param shelf - the shelf on screen.
 * @param items - the rows on the current page, read when there is no usable
 *   roster.
 * @param input - the fragment typed into the tag field.
 * @param limit - cap on the number of suggestions.
 * @returns matching tags, deduplicated and sorted; empty for an empty input.
 */
export function tagSuggestions(
  roster: TagRoster | null,
  shelf: string,
  items: readonly Knowledge[],
  input: string,
  limit: number = TAG_SUGGESTION_LIMIT,
): string[] {
  const fragment = input.trim().toLocaleLowerCase()
  if (fragment === '') return []

  const shelfTags = roster?.shelf === shelf ? roster.tags : null
  const source = shelfTags ?? items.flatMap(item => item.content.tags)
  const matches = new Set<string>()
  for (const tag of source) {
    if (tag.toLocaleLowerCase().includes(fragment)) matches.add(tag)
  }
  return [...matches].sort((left, right) => left.localeCompare(right)).slice(0, limit)
}
