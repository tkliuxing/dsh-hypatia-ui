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
 * Format a stored timestamp for display.
 * @param value - the ISO-8601 string, possibly empty.
 * @returns `YYYY-MM-DD HH:MM`, or an em dash when absent.
 */
export function dateLabel(value: string): string {
  return value === '' ? '—' : value.replace('T', ' ').slice(0, 16)
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
