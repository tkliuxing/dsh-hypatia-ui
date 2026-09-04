/**
 * Browser plugin entry.
 *
 * It wires three things and owns nothing else: the locale dictionaries, the
 * sidebar row, and the console mounted into the center column. All authority
 * lives on the Host — this half reads its routes and renders the answers.
 *
 * Failure policy: a DOM mounting problem is logged, never thrown. The web
 * shell fails the entire boot when a plugin's `apply` throws, and an
 * out-of-tree plugin must never be able to take the GUI down with it.
 *
 * @module @tkliuxing/dsh-hypatia-ui/client
 */

import type { Context } from '@deepseek-ai/cordis'
// Type-only: pulls the locale plugin's Context merge (ctx.locale).
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import { PanelController } from './controller.ts'
import { clearRuntimeTranslate, en, NS, setRuntimeTranslate, zh, type HypatiaKey } from './locales.ts'
import { mountSidebarEntry } from './sidebar-entry.ts'
import { injectStyles } from './styles.ts'
import { mountConsole } from './view-mount.tsx'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Hypatia console copy. */
    'dsh-hypatia-ui': HypatiaKey
  }
}

/**
 * Guard against a duplicated client injection: the module factory can run
 * twice in one page lifetime (a repeated apply, an HMR re-injection), and a
 * second run would mount a second sidebar row and a second console. First
 * application wins; the claim is released on unload so a rebuilt bundle can
 * claim again without a page reload.
 */
const APPLY_CLAIM = '__dshHypatiaUiApplied'

function claimApply(): boolean {
  const scope = globalThis as Record<string, unknown>
  if (scope[APPLY_CLAIM] === true) return false
  scope[APPLY_CLAIM] = true
  return true
}

function releaseApply(): void {
  delete (globalThis as Record<string, unknown>)[APPLY_CLAIM]
}

/** Required services (fiber inject waiting — the runtime must be up first). */
export const inject = ['locale']

/**
 * Mount the browser half.
 * @param ctx - client root context.
 */
export function apply(ctx: Context): void {
  if (!claimApply()) return
  ctx.effect(() => releaseApply, 'dsh-hypatia-ui: apply claim')

  ctx.effect(() => {
    try {
      return ctx.locale.register(NS, { zh, en })
    } catch (error: unknown) {
      console.error('[dsh-hypatia-ui] locale registration failed:', error)
      return () => {}
    }
  }, 'dsh-hypatia-ui: dictionaries')

  // Wire the SDK translate seat into the module-level `t`, so plain-DOM
  // callers (the sidebar row) read the active locale at call time. The effect
  // above guarantees the dictionaries exist before the first read.
  try {
    setRuntimeTranslate(ctx.locale.bind(NS))
    ctx.effect(() => clearRuntimeTranslate, 'dsh-hypatia-ui: translate seat')
  } catch {
    // Locale service unavailable: the document-language fallback stays.
  }

  ctx.effect(() => injectStyles(), 'dsh-hypatia-ui: stylesheet')

  ctx.effect(() => {
    const controller = new PanelController()
    const disposers: Array<() => void> = []
    try {
      disposers.push(mountSidebarEntry(controller, ctx.locale))
      disposers.push(mountConsole(controller, ctx.locale))
    } catch (error: unknown) {
      // A DOM failure degrades the console, never the GUI.
      console.error('[dsh-hypatia-ui] mount failed:', error)
    }
    return () => {
      for (const dispose of disposers.splice(0)) dispose()
      controller.dispose()
    }
  }, 'dsh-hypatia-ui: surfaces')
}
