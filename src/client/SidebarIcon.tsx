/**
 * The sidebar's Hypatia panel glyph.
 *
 * The sidebar owns the row, its label, and its selected state; a
 * `sidebar.panellist` registrant supplies only the glyph, drawn at the edge the
 * row asks for. Registration on the same panel id as this plugin's `main`
 * entry is what makes the row select the console — the shell wires the click,
 * so this component holds no navigation state.
 *
 * @module @tkliuxing/dsh-hypatia-ui/client/SidebarIcon
 */

import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
// Type-only: pulls the `sidebar.panellist` SlotMap entry and owner props.
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import { ShelfIcon } from './icons.tsx'

/**
 * Render the console glyph at the size the sidebar asks for.
 * @param props - the sidebar's icon share: the requested edge and whether the
 *   panel is selected. Selection styling belongs to the row, so only the edge
 *   is consumed.
 * @returns the icon element.
 */
export function HypatiaPanelIcon({ size }: PropsRuntime<'sidebar.panellist'>): React.JSX.Element {
  return <ShelfIcon size={size} />
}
