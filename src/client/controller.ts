/**
 * Open/closed state of the console panel.
 *
 * Deliberately tiny and framework-free: the sidebar row (plain DOM), the
 * center-column mount (a React root), and the cross-plugin panel protocol all
 * read the same observable, and none of them owns the state. Every published
 * snapshot is a fresh frozen identity so `useSyncExternalStore` consumers
 * re-render.
 *
 * @module @tkliuxing/dsh-hypatia-ui/client/controller
 */

/** The panel's visible state. */
export interface PanelSnapshot {
  /** True while the console occupies the center column. */
  readonly open: boolean
}

const CLOSED: PanelSnapshot = Object.freeze({ open: false })
const OPEN: PanelSnapshot = Object.freeze({ open: true })

/** Observable open/closed state with an explicit subscriber list. */
export class PanelController {
  private readonly listeners = new Set<() => void>()
  private snapshot: PanelSnapshot = CLOSED

  /**
   * Read the current snapshot.
   * @returns a frozen snapshot; the identity changes only when the state does.
   */
  getSnapshot = (): PanelSnapshot => this.snapshot

  /**
   * Subscribe to state changes.
   * @param listener - notified after every change.
   * @returns the unsubscriber.
   */
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  /** Open the panel. */
  open(): void { this.set(true) }

  /** Close the panel. */
  close(): void { this.set(false) }

  /** Toggle the panel. */
  toggle(): void { this.set(!this.snapshot.open) }

  private set(open: boolean): void {
    if (this.snapshot.open === open) return
    this.snapshot = open ? OPEN : CLOSED
    // Iterate a copy: a listener may unsubscribe itself while reacting.
    for (const listener of [...this.listeners]) {
      try {
        listener()
      } catch (error: unknown) {
        // One throwing subscriber must not skip the rest or break the caller.
        console.error('[dsh-hypatia-ui] panel subscriber threw:', error)
      }
    }
  }

  /** Drop every subscriber (plugin unload). */
  dispose(): void {
    this.listeners.clear()
  }
}
