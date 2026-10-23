/**
 * Small display formatters shared by the console's views.
 *
 * They take the translate function instead of importing one: copy reaches a
 * component as a prop (the slot registration's `locale` seat), so a formatter
 * that needs words cannot own a module-level translate of its own.
 *
 * @module @tkliuxing/dsh-hypatia-ui/client/format
 */

import type { Translate } from './locales.ts'

/**
 * A stamp that names no zone: the shelf writes `YYYY-MM-DD HH:MM:SS.ffffff`.
 */
const BARE_STAMP = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?(?:\.(\d{1,9}))?$/

/** A stamp that names its own zone: `Z`, `+08:00`, or `+0800`. */
const ZONE_SUFFIX = /(?:Z|[+-]\d{2}:?\d{2})$/i

/**
 * Read a stored stamp as the instant it names.
 *
 * The shelf keeps `created_at` in **UTC and appends no marker**, so a bare
 * stamp means UTC. Handing such a string straight to `new Date()` would let
 * the engine read it as local time instead — which is exactly how the console
 * ended up one zone offset (8 hours here) behind the reader's clock.
 *
 * @param value - the stored timestamp, possibly padded or empty.
 * @returns the instant, or `null` when the text is not a date.
 */
export function stampInstant(value: string): Date | null {
  const text = value.trim()
  const parts = BARE_STAMP.exec(text)
  if (parts !== null) {
    // Regex groups are `string | undefined` under noUncheckedIndexedAccess;
    // a match guarantees 1–5, the rest may be absent.
    const seconds = parts[6] ?? '0'
    const millis = (parts[7] ?? '').padEnd(3, '0').slice(0, 3)
    return new Date(Date.UTC(
      Number(parts[1]), Number(parts[2]) - 1, Number(parts[3]),
      Number(parts[4]), Number(parts[5]), Number(seconds), Number(millis),
    ))
  }
  if (!ZONE_SUFFIX.test(text)) return null
  // `Date.parse` covers the ISO-8601 forms exactly, but not the space
  // separator or a fraction finer than milliseconds, so normalize both first.
  const parsed = new Date(text.replace(' ', 'T').replace(/\.(\d{3})\d+/, '.$1'))
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

/**
 * Format a stored timestamp as the reader's own clock shows it.
 * @param value - the stored timestamp, possibly empty.
 * @returns `YYYY-MM-DD HH:MM` in the browser's zone, or an em dash when absent.
 */
export function dateLabel(value: string): string {
  if (value === '') return '—'
  const moment = stampInstant(value)
  // A stamp nothing can parse still names a record, so show it verbatim rather
  // than claiming the time is unknown.
  if (moment === null) return value.replace('T', ' ').slice(0, 16)
  const pad = (part: number): string => String(part).padStart(2, '0')
  return `${String(moment.getFullYear()).padStart(4, '0')}-${pad(moment.getMonth() + 1)}`
    + `-${pad(moment.getDate())} ${pad(moment.getHours())}:${pad(moment.getMinutes())}`
}

/**
 * Render a stored timestamp as the machine-readable `<time datetime>` value.
 *
 * The stored stamp is UTC with no marker, so it has to say so here too: an
 * attribute without a zone is read as local time by the HTML consumer, which
 * would put the machine-readable surface an offset away from the visible one.
 *
 * @param value - the stored timestamp, possibly empty.
 * @returns an ISO-8601 instant, or the empty string when there is no stamp.
 */
export function stampAttribute(value: string): string {
  const moment = stampInstant(value)
  return moment === null ? '' : moment.toISOString()
}

/**
 * Collapse a body to one line for the list row.
 * @param value - the stored body.
 * @param t - the panel's translate function.
 * @param maximum - character budget.
 * @returns the collapsed excerpt, or the empty-content copy.
 */
export function excerpt(value: string, t: Translate, maximum = 160): string {
  const compact = value.replace(/\s+/g, ' ').trim()
  if (compact === '') return t('list.excerpt.empty')
  return compact.length > maximum ? `${compact.slice(0, maximum)}…` : compact
}

/**
 * Label the empty scope.
 * @param scope - a scope name.
 * @param t - the panel's translate function.
 * @returns the localized global label for the empty scope, else the name.
 */
export function scopeLabel(scope: string, t: Translate): string {
  return scope === '' ? t('search.scope.global') : scope
}
