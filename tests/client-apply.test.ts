/**
 * The browser half's slot wiring.
 *
 * A plugin's UI contribution is only as good as the two registrations behind
 * it, and a mistake there is invisible until the panel fails to appear in a
 * running GUI. This exercises `apply` against a recording stub of the four
 * services it declares: the slot names, the shared panel id, the locale
 * namespace, the inject face, and the theme seat.
 *
 * The registration option shapes themselves are checked at compile time
 * against the published `SlotMap` declarations — that is what the type-only
 * imports in `src/client/index.ts` are for — so this file asserts the values
 * and the callbacks, not the types.
 */

import type { Context } from '@deepseek-ai/cordis'
import { describe, expect, it, vi } from 'vitest'
import { apply, inject, PANEL_ID } from '../src/client/index.ts'
import { HypatiaPanel } from '../src/client/HypatiaPanel.tsx'
import { HypatiaPanelIcon } from '../src/client/SidebarIcon.tsx'
import { en, NS, zh, type HypatiaKey } from '../src/client/locales.ts'

/** One recorded registration: the option bag and the component it bound. */
interface Registration {
  options: Record<string, unknown>
  component: unknown
}

/** The recording stub context plus the handles a test inspects. */
interface Bench {
  ctx: Context
  registrations: Registration[]
  injections: Map<string, () => void>
  layout: { selectPanel: ReturnType<typeof vi.fn> }
  themeListeners: Set<() => void>
  localeRegister: ReturnType<typeof vi.fn>
}

/** Build the stub. */
function bench(): Bench {
  const registrations: Registration[] = []
  const injections = new Map<string, () => void>()
  const themeListeners = new Set<() => void>()
  const layout = { selectPanel: vi.fn() }
  const localeRegister = vi.fn(() => () => {})
  const ctx = {
    effect: (fn: () => (() => void) | void) => {
      const dispose = fn()
      return typeof dispose === 'function' ? dispose : () => {}
    },
    locale: {
      register: localeRegister,
      bind: () => (key: HypatiaKey) => en[key] ?? String(key),
    },
    slots: {
      inject: (slot: string, callback: () => unknown) => {
        const dispose = callback()
        if (typeof dispose === 'function') injections.set(slot, dispose as () => void)
        return dispose
      },
      register: (options: Record<string, unknown>, component: unknown) => {
        registrations.push({ options, component })
        return () => {}
      },
    },
    layout,
    on: (event: string, listener: () => void) => {
      if (event === 'theme/change') themeListeners.add(listener)
      return () => { themeListeners.delete(listener) }
    },
  } as unknown as Context
  return { ctx, registrations, injections, layout, themeListeners, localeRegister }
}

describe('client apply', () => {
  it('declares exactly the services its surfaces need', () => {
    expect(inject).toEqual(['slots', 'locale', 'layout', 'theme'])
  })

  it('shares one panel id between the sidebar row and the main panel', () => {
    const b = bench()
    apply(b.ctx)
    const main = b.registrations.find(entry => entry.options['name'] === 'main')
    const row = b.registrations.find(entry => entry.options['name'] === 'sidebar.panellist')
    expect(main?.options['key']).toBe(PANEL_ID)
    expect(row?.options['id']).toBe(PANEL_ID)
    expect(PANEL_ID).toBe('hypatia')
  })

  it('registers the console into the keyed main slot with the locale seat', () => {
    const b = bench()
    apply(b.ctx)
    const main = b.registrations.find(entry => entry.options['name'] === 'main')
    expect(main?.component).toBe(HypatiaPanel)
    expect(main?.options['locale']).toBe(NS)
    expect(typeof (main?.options['inject'] as () => unknown)).toBe('function')
  })

  it('registers the sidebar glyph as an ordered list row with a live label', () => {
    const b = bench()
    apply(b.ctx)
    const row = b.registrations.find(entry => entry.options['name'] === 'sidebar.panellist')
    expect(row?.component).toBe(HypatiaPanelIcon)
    expect(row?.options['order']).toBe(20)
    // The label is a thunk: the sidebar re-reads it on a Language switch, so it
    // must resolve through the bound translate rather than freeze at mount.
    expect((row?.options['label'] as () => string)()).toBe(en['panel.label'])
  })

  it('registers both dictionaries in the plugin namespace', () => {
    const b = bench()
    apply(b.ctx)
    expect(b.localeRegister).toHaveBeenCalledWith(NS, { zh, en })
  })

  it('leaves the panel through the layout service and follows theme changes', () => {
    const b = bench()
    apply(b.ctx)
    const main = b.registrations.find(entry => entry.options['name'] === 'main')
    const injected = (main?.options['inject'] as () => {
      close: () => void
      observeTheme: (listener: () => void) => () => void
    })()
    injected.close()
    expect(b.layout.selectPanel).toHaveBeenCalledWith(null)

    const listener = vi.fn()
    const unsubscribe = injected.observeTheme(listener)
    expect(b.themeListeners.has(listener)).toBe(true)
    unsubscribe()
    expect(b.themeListeners.has(listener)).toBe(false)
  })

  it('waits for the slots declaration before contributing', () => {
    const b = bench()
    apply(b.ctx)
    // Nothing registers until each owning declaration's lifetime starts; the
    // stub starts them eagerly, which is what the inject callbacks observe.
    expect([...b.injections.keys()]).toEqual(['main', 'sidebar.panellist'])
  })
})
