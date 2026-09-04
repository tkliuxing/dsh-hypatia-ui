/**
 * Center-column takeover.
 *
 * The `conversation` slot is single-occupant (ui-conversation owns it) and an
 * external plugin may not declare slots, so the console takes the column at
 * the DOM level: a container is appended as an extra trailing child React
 * never manages, and a stylesheet rule hides the conversation content while
 * the console is active. Visibility is one attribute on `<html>` — no React
 * involvement — so the conversation subtree underneath stays mounted and
 * keeps its scroll position, draft, and streaming state.
 *
 * The column holds one panel at a time, so opening evicts whichever sibling
 * panel is showing and announces the change on the shared
 * `dsh-panel-activate` event; a sibling announcing its own activation closes
 * this one. Both directions settle inside the dispatch, before paint.
 *
 * @module @tkliuxing/dsh-hypatia-ui/client/view-mount
 */

import { createRoot, type Root } from 'react-dom/client'
import type { PanelController } from './controller.ts'
import { HypatiaConsole } from './HypatiaConsole.tsx'
import type { LocaleRefreshSource } from './sidebar-entry.ts'
import { ACTIVE_ATTRIBUTE, VIEW_ATTRIBUTE, VIEW_SELECTOR } from './styles.ts'

/** Both center-column selectors: the current shell's class and the older pane attribute. */
const CONVERSATION_COLUMN_SELECTOR = '[data-pane="conversation"], [class*="centerCol"]'

/** Cross-plugin activation event; `detail` names the activating panel. */
const ACTIVATE_EVENT = 'dsh-panel-activate'

/** This panel's name on that event. */
const PANEL_NAME = 'hypatia'

/** Activation attributes of the sibling panels sharing the column. */
const SIBLING_ACTIVE_ATTRIBUTES = ['data-dsh-taskboard-active', 'data-dsh-ssh-active'] as const

/**
 * Sidebar controls that hand the column back to the conversation. Clicking a
 * session or workspace row means "show me that conversation" — including the
 * row already current, which fires no session-change event of its own.
 */
const SIDEBAR_ROW_SELECTOR = [
  '[class*="sessionRow"]', '[class*="projectRow"]',
  '[class*="searchResultRow"]', '[class*="searchResultWorkspace"]',
  '[class*="newSession"]',
].join(', ')

function conversationColumn(): HTMLElement | undefined {
  return document.querySelector<HTMLElement>(CONVERSATION_COLUMN_SELECTOR) ?? undefined
}

/**
 * Mount the console into the center column and bind its visibility to the
 * controller.
 * @param controller - the panel state driving the view.
 * @param locale - locale-change source; a mounted console re-renders on a
 *   Language switch.
 * @returns the disposer unmounting the tree and restoring the column.
 */
export function mountConsole(controller: PanelController, locale?: LocaleRefreshSource): () => void {
  if (typeof document === 'undefined' || document.querySelector(VIEW_SELECTOR) !== null) {
    return () => {}
  }

  let root: Root | undefined
  let container: HTMLDivElement | undefined

  const render = (): void => {
    root?.render(<HypatiaConsole controller={controller} />)
  }

  let unsubscribeLocale: (() => void) | undefined
  try {
    unsubscribeLocale = locale?.subscribe(render)
  } catch {
    // Locale service absent: the console follows its next natural re-render.
  }

  const ensure = (): void => {
    if (container !== undefined) {
      if (container.isConnected) return
      // The shell replaced the column; drop the orphaned tree before rebuilding.
      root?.unmount()
      root = undefined
      container.remove()
      container = undefined
    }
    const column = conversationColumn()
    if (column === undefined) return
    container = document.createElement('div')
    container.setAttribute(VIEW_ATTRIBUTE, '')
    container.setAttribute('data-dsh-plugin', 'hypatia-ui')
    column.appendChild(container)
    root = createRoot(container)
    render()
  }

  const applyActive = (): void => {
    if (controller.getSnapshot().open) {
      // Evict the sibling panels' attributes as well as announcing: their own
      // hide rules would otherwise blank this console for as long as both
      // attributes coexist.
      for (const attribute of SIBLING_ACTIVE_ATTRIBUTES) {
        document.documentElement.removeAttribute(attribute)
      }
      document.documentElement.setAttribute(ACTIVE_ATTRIBUTE, '')
      document.dispatchEvent(new CustomEvent(ACTIVATE_EVENT, { detail: PANEL_NAME }))
    } else {
      document.documentElement.removeAttribute(ACTIVE_ATTRIBUTE)
    }
  }

  const onSiblingActivate = (event: Event): void => {
    const detail = (event as CustomEvent<unknown>).detail
    if (detail !== PANEL_NAME && controller.getSnapshot().open) controller.close()
  }

  const onSidebarClick = (event: MouseEvent): void => {
    if (!controller.getSnapshot().open) return
    const target = event.target
    if (!(target instanceof Element)) return
    if (target.closest(SIDEBAR_ROW_SELECTOR) !== null) controller.close()
  }

  // The frame mounts after boot settles; watch for the column's arrival and
  // for the shell replacing it later.
  const waitObserver = new MutationObserver(() => { ensure() })
  waitObserver.observe(document.body, { childList: true, subtree: true })

  // Capture phase: the panel closes before the shell processes the click, so
  // the conversation is already visible when the session switch lands.
  document.addEventListener('click', onSidebarClick, true)
  document.addEventListener(ACTIVATE_EVENT, onSiblingActivate)
  const unsubscribe = controller.subscribe(applyActive)
  applyActive()
  ensure()

  return () => {
    document.removeEventListener('click', onSidebarClick, true)
    document.removeEventListener(ACTIVATE_EVENT, onSiblingActivate)
    waitObserver.disconnect()
    unsubscribe()
    unsubscribeLocale?.()
    document.documentElement.removeAttribute(ACTIVE_ATTRIBUTE)
    root?.unmount()
    root = undefined
    container?.remove()
    container = undefined
  }
}
