/**
 * The sidebar entry row.
 *
 * DSH's sidebar shell declares no slot an external plugin may occupy —
 * `sidebar.workspaces` and `sidebar.settings` are single-occupant and already
 * taken, and only the declaring package may add children. So the row is
 * injected into the DOM between the shell's New Session control and the
 * workspace browser, exactly where the task-board and ssh plugins put theirs,
 * and it orders itself against them so the block stays stable however the
 * shell re-renders.
 *
 * The row is plain DOM, never a React tree: it lives inside a subtree React
 * owns, and a foreign root there would fight reconciliation. A
 * `MutationObserver` re-inserts it in the same frame whenever a re-render
 * displaces it, so the move never reaches paint.
 *
 * @module @tkliuxing/dsh-hypatia-ui/client/sidebar-entry
 */

import type { PanelController } from './controller.ts'
import { t } from './locales.ts'
import { css, ENTRY_ATTRIBUTE, ENTRY_SELECTOR } from './styles.ts'

/**
 * Sibling plugin rows this entry orders against, its own included. Every
 * family member positions relative to the same block, so their order cannot
 * depend on which observer callback runs first.
 */
const FAMILY_SELECTORS = [
  ENTRY_SELECTOR,
  '[data-dsh-taskboard-entry]',
  '[data-dsh-ssh-entry]',
  '[data-dsh-skill-explorer-entry]',
] as const

/** Book-stack glyph at the shell's 18px navigation size. */
const ICON = '<svg viewBox="0 0 16 16" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.5 3.2a1 1 0 0 1 1-1h2.2a1.6 1.6 0 0 1 1.6 1.6v9.4a1.3 1.3 0 0 0-1.3-1.3H2.5z"/><path d="M13.5 3.2a1 1 0 0 0-1-1h-2.2a1.6 1.6 0 0 0-1.6 1.6v9.4a1.3 1.3 0 0 1 1.3-1.3h3.5z"/><path d="M8 3.8v9.4"/></svg>'

/** A locale-change source (the shape `ctx.locale` exposes). */
export interface LocaleRefreshSource {
  subscribe(listener: () => void): () => void
}

/** Find the sidebar shell root, or undefined while it is not mounted. */
function sidebarRoot(): HTMLElement | undefined {
  const column = document.querySelector<HTMLElement>('[data-pane="sidebar"], [class*="sidebarCol"]')
  if (column === null) return undefined
  // Current shells nest the sidebar UI one wrapper deep: column > wrapper >
  // root (which owns the logo row). Prefer the logo row's owner — the real UI
  // root — and fall back to the column's first child for older shells.
  const logoOwner = column.querySelector<HTMLElement>('[class*="logoRow"]')?.parentElement
  return logoOwner ?? (column.firstElementChild as HTMLElement | null) ?? undefined
}

/** The New Session control: nested in the logo row, or a direct child on older shells. */
function newSessionButton(root: HTMLElement): HTMLButtonElement | undefined {
  const nested = root.querySelector<HTMLButtonElement>('button[class*="newSession"]')
  if (nested !== null) return nested
  for (const child of root.children) {
    if (child.tagName === 'BUTTON') return child as HTMLButtonElement
  }
  return undefined
}

function createEntry(onToggle: () => void): { entry: HTMLButtonElement; applyLabel: () => void } {
  const entry = document.createElement('button')
  entry.type = 'button'
  entry.setAttribute(ENTRY_ATTRIBUTE, '')
  entry.setAttribute('data-dsh-plugin', 'hypatia-ui')
  entry.setAttribute('data-dsh-part', 'sidebar-entry')
  entry.className = css.entry

  const iconSpan = document.createElement('span')
  iconSpan.className = css.entryIcon
  iconSpan.innerHTML = ICON
  const labelSpan = document.createElement('span')
  labelSpan.className = css.entryLabel
  entry.append(iconSpan, labelSpan)

  const applyLabel = (): void => {
    const label = t('entry.label')
    entry.setAttribute('aria-label', label)
    entry.setAttribute('title', t('entry.tooltip'))
    labelSpan.textContent = label
  }
  applyLabel()
  entry.addEventListener('click', onToggle)
  return { entry, applyLabel }
}

/** Insert the row after the New Session control, ahead of the family block. */
function placeEntry(root: HTMLElement, entry: HTMLButtonElement): boolean {
  const button = newSessionButton(root)
  if (button === undefined) return false
  if (entry.parentElement === root) return true

  // Position against the family block rather than transient logo-row geometry:
  // then every family plugin that self-heals during one re-render lands in the
  // same relative order regardless of callback order. There is deliberately no
  // append-to-end fallback — appending would shuffle the block on each render.
  const row = button.closest('[class*="logoRow"]')
  const base: Element = row !== null && row.parentElement === root ? row : button
  const family = Array.from(root.children).filter(
    (element): element is HTMLElement =>
      element instanceof HTMLElement && element.matches(FAMILY_SELECTORS.join(', ')),
  )
  const anchor = family.length > 0 ? family[0]! : base.nextElementSibling
  root.insertBefore(entry, anchor)
  return true
}

/**
 * Mount the sidebar row, waiting for the shell and self-healing afterwards.
 * @param controller - the panel state the row toggles and reflects.
 * @param locale - locale-change source; when given, the plain-DOM row
 *   re-labels itself on a Language switch instead of keeping its mount-time copy.
 * @returns the disposer removing the row and its observers.
 */
export function mountSidebarEntry(controller: PanelController, locale?: LocaleRefreshSource): () => void {
  // DOM-level idempotency: whatever mounted a row before this call (a repeated
  // apply, an HMR re-injection, a stale module still alive), never mount a
  // second one. The existing row keeps working.
  if (typeof document === 'undefined' || document.querySelector(ENTRY_SELECTOR) !== null) {
    return () => {}
  }

  const { entry, applyLabel } = createEntry(() => { controller.toggle() })
  let root: HTMLElement | undefined
  let placed = false

  let unsubscribeLocale: (() => void) | undefined
  try {
    unsubscribeLocale = locale?.subscribe(applyLabel)
  } catch {
    // A throwing subscription must not break the mount; the label stays at its
    // initial value and the next reload resolves it again.
  }

  const tryPlace = (): void => {
    if (root !== undefined && !root.isConnected) {
      // The shell rebuilt the whole sidebar pane, taking the root observer with
      // it; re-query from scratch. The body watcher notices the new pane.
      rootObserver.disconnect()
      root = undefined
      placed = false
    }
    if (placed) {
      if (document.body.contains(entry)) return
      rootObserver.disconnect()
      root = undefined
      placed = false
    }
    root ??= sidebarRoot()
    if (root === undefined) return
    placed = placeEntry(root, entry)
    if (placed) rootObserver.observe(root, { childList: true, subtree: true })
  }

  // The body watcher is the whole-rebuild fallback: when the shell tears down
  // the sidebar pane the root observer dies with it, and only this observation
  // can notice the replacement mounting. It stays connected, because the
  // placed-and-still-mounted case short-circuits on one `contains` check — so
  // unrelated churn (chat streaming) costs that check, not a re-query.
  const waitObserver = new MutationObserver(() => { tryPlace() })
  const rootObserver = new MutationObserver(() => {
    if (root === undefined || !root.isConnected) {
      placed = false
      tryPlace()
      return
    }
    if (!root.contains(entry)) placed = placeEntry(root, entry)
  })

  // Reflect the panel state on the row. Note: assigning undefined to a dataset
  // key writes the string "undefined" and would pin the highlight on — the
  // attribute has to be deleted.
  const syncActive = (): void => {
    if (controller.getSnapshot().open) entry.dataset['active'] = 'true'
    else delete entry.dataset['active']
  }
  const unsubscribeActive = controller.subscribe(syncActive)
  syncActive()

  waitObserver.observe(document.body, { childList: true, subtree: true })
  tryPlace()

  return () => {
    waitObserver.disconnect()
    rootObserver.disconnect()
    unsubscribeLocale?.()
    unsubscribeActive()
    entry.remove()
  }
}
