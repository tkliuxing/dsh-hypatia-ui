/**
 * The console's translate seat, carried down the component tree.
 *
 * Both slot registrations declare `locale`, so the framework hands the panel a
 * namespace-bound `t` prop and re-renders the entry when the language changes.
 * The panel republishes that function here instead of threading it through
 * every intermediate component.
 *
 * The context default returns the key rather than throwing: a component that
 * somehow renders outside the panel shows a raw key, which is a cosmetic
 * defect, where a throw inside a slot component would blank the entry.
 *
 * @module @tkliuxing/dsh-hypatia-ui/client/locale-context
 */

import { createContext, useContext, type ReactNode } from 'react'
import type { Translate } from './locales.ts'

const TranslateContext = createContext<Translate>((key => String(key)) as Translate)

/**
 * Publish the panel's translate function to its subtree.
 * @param props - the framework-injected `t` seat and the subtree it covers.
 * @returns the provider element.
 */
export function TranslateScope({ t, children }: { t: Translate; children: ReactNode }): React.JSX.Element {
  return <TranslateContext.Provider value={t}>{children}</TranslateContext.Provider>
}

/**
 * Read the panel's translate function.
 * @returns the namespace-bound `t` of the enclosing console.
 */
export function useTranslate(): Translate {
  return useContext(TranslateContext)
}
