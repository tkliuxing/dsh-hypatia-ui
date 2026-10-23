/**
 * Stored timestamps are UTC and say so to nobody.
 *
 * The shelf writes `created_at` as `YYYY-MM-DD HH:MM:SS.ffffff` with no zone
 * marker. Rendering that text verbatim put every row a whole zone offset behind
 * the reader's clock (8 hours in CST), so these cases pin the interpretation:
 * a bare stamp is UTC, and the label is that instant on the reader's clock.
 */

import { describe, expect, it } from 'vitest'
import { dateLabel, stampAttribute, stampInstant } from '../src/client/format.ts'

/** The instant a bare shelf stamp names, spelled out in UTC. */
const STORED = '2026-10-23 03:22:37.639059'
const INSTANT = Date.UTC(2026, 9, 23, 3, 22, 37, 639)

/** What the reader's own clock shows for an instant, built independently. */
function localWallClock(instant: number): string {
  const at = new Date(instant)
  const part = (value: number, width = 2): string => String(value).padStart(width, '0')
  return `${part(at.getFullYear(), 4)}-${part(at.getMonth() + 1)}-${part(at.getDate())}`
    + ` ${part(at.getHours())}:${part(at.getMinutes())}`
}

describe('stampInstant', () => {
  it('reads a marker-free shelf stamp as UTC, not as local time', () => {
    expect(stampInstant(STORED)?.getTime()).toBe(INSTANT)
  })

  it('keeps declarations that name their own zone', () => {
    expect(stampInstant('2026-10-23T03:22:37.639Z')?.getTime()).toBe(INSTANT)
    expect(stampInstant('2026-10-23T11:22:37.639+08:00')?.getTime()).toBe(INSTANT)
  })

  it('accepts a stamp with no fraction and no seconds', () => {
    expect(stampInstant('2026-10-23 03:22')?.getTime()).toBe(Date.UTC(2026, 9, 23, 3, 22))
    expect(stampInstant('2026-10-23T03:22:37')?.getTime()).toBe(Date.UTC(2026, 9, 23, 3, 22, 37))
  })

  it('refuses text that is not a date', () => {
    expect(stampInstant('')).toBeNull()
    expect(stampInstant('not a date')).toBeNull()
    expect(stampInstant('2026-10-23')).toBeNull()
  })
})

describe('dateLabel', () => {
  it('shows the shelf stamp on the reader clock', () => {
    expect(dateLabel(STORED)).toBe(localWallClock(INSTANT))
  })

  it('agrees with itself however the same instant is spelled', () => {
    const viaBare = dateLabel(STORED)
    expect(dateLabel('2026-10-23T03:22:37.639Z')).toBe(viaBare)
    expect(dateLabel('2026-10-23 11:22:37+08:00')).toBe(viaBare)
  })

  it('keeps the em dash for an absent stamp', () => {
    expect(dateLabel('')).toBe('—')
  })

  it('shows an unreadable stamp rather than inventing a time', () => {
    expect(dateLabel('sometime in June')).toBe('sometime in June')
  })
})

describe('stampAttribute', () => {
  it('marks the stored instant with its zone so the attribute matches the label', () => {
    expect(stampAttribute(STORED)).toBe('2026-10-23T03:22:37.639Z')
    expect(new Date(stampAttribute(STORED)).getTime()).toBe(INSTANT)
  })

  it('omits the attribute when there is nothing to say', () => {
    expect(stampAttribute('')).toBe('')
    expect(stampAttribute('not a date')).toBe('')
  })
})
