/**
 * Browser plugin entry.
 *
 * It wires four things and owns nothing else: the locale dictionaries, the
 * console's stylesheet, the sidebar panel row, and the console the row opens in
 * the main column. All authority lives on the Host — this half reads its routes
 * and renders the answers.
 *
 * Both surfaces are ordinary slot contributions, as the plugin development
 * manual requires: the glyph registers into the sidebar's `sidebar.panellist`
 * list under the panel id, and the console registers into the layout's keyed
 * `main` slot under the same id. The sidebar owns the row, its label, and its
 * selected state; the layout owns which panel the column shows. Nothing here
 * reads or writes the shell's DOM, and leaving the panel is
 * `ctx.layout.selectPanel(null)` rather than a stylesheet trick.
 *
 * Every registration is a Cordis effect on this context, so unloading the
 * plugin removes both surfaces, the style tag, and the dictionaries. A
 * mis-declared slot is left to fail loudly: unlike the DOM mounting this
 * replaced, a registration error means the composition is wrong and silently
 * swallowing it would hide a broken bundle behind a missing row.
 *
 * @module @tkliuxing/dsh-hypatia-ui/client
 */

import type { Context } from '@deepseek-ai/cordis'
// Type-only: pulls the locale plugin's Context merge (ctx.locale).
import type {} from '@deepseek-ai/dsh-client-locale/client'
// Type-only: the main-slot key brand, the ctx.layout merge, and the
// `main` SlotMap entry this plugin contributes into.
import type { MainPanelId } from '@deepseek-ai/dsh-client-ui-layout/client'
// Type-only: the SlotRegistry service merge (ctx.slots).
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
// Type-only: the `sidebar.panellist` SlotMap entry the glyph contributes into.
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
// Type-only: ctx.theme and the `theme/change` event the graph palette follows.
import type {} from '@deepseek-ai/dsh-client-ui-theme/client'
import { HypatiaPanel, type PanelInjected } from './HypatiaPanel.tsx'
import { en, NS, zh } from './locales.ts'
import { HypatiaPanelIcon } from './SidebarIcon.tsx'
import { injectStyles } from './styles.ts'

/** The id shared by the sidebar row and the main panel it opens. */
export const PANEL_ID = 'hypatia' as MainPanelId

/**
 * Row order inside the sidebar's panel list. The shipped Plugins row is 0 and
 * the shipped Tasks row is 10; a plugin-installed console sits after both.
 */
const PANEL_ORDER = 20

/**
 * Required services (fiber inject waiting — the runtime must be up first).
 * `layout` supplies `selectPanel` and owns the `main` slot; `theme` publishes
 * the palette the graph canvas reads; `slots` and `locale` carry the two
 * registrations.
 */
export const inject = ['slots', 'locale', 'layout', 'theme']

/**
 * Mount the browser half.
 * @param ctx - client root context.
 */
export function apply(ctx: Context): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-hypatia-ui: dictionaries')
  ctx.effect(() => injectStyles(), 'dsh-hypatia-ui: stylesheet')

  // The sidebar resolves the list label through this thunk on every read, so a
  // Language switch re-labels the row without re-registering anything.
  const t = ctx.locale.bind(NS)

  ctx.slots.inject('main', () => ctx.slots.register({
    name: 'main',
    key: PANEL_ID,
    locale: NS,
    inject: (): PanelInjected => ({
      close: () => { ctx.layout.selectPanel(null) },
      // The canvas bakes its colors in, so the graph needs the change signal;
      // the host's presenter has already written the new tokens by the time
      // this listener runs (ui-layout registers its presenter first).
      observeTheme: listener => ctx.on('theme/change', listener),
    }),
  }, HypatiaPanel))

  ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
    name: 'sidebar.panellist',
    id: PANEL_ID,
    order: PANEL_ORDER,
    label: () => t('panel.label'),
  }, HypatiaPanelIcon))
}
