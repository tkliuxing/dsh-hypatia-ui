/**
 * Knowledge and statement body rendering.
 *
 * Markdown goes through DSH's own `MarkdownText`, not a bundled renderer:
 * it is a shared platform module (external, no bundle cost), it already
 * disables raw HTML and unsafe protocols — the same posture
 * `hypatia-archive`'s `skipHtml` takes toward stored content — and it carries
 * the shell's code, table, and math styling, so a record reads exactly like
 * assistant Markdown elsewhere in the GUI.
 *
 * Anything else renders as preformatted text.
 *
 * @module @tkliuxing/dsh-hypatia-ui/client/Content
 */

import { useMemo } from 'react'
import { MarkdownText } from '@deepseek-ai/dsh-client-ui-primitives'
import type { KnowledgeContent } from '../protocol.ts'
import { t } from './locales.ts'

/** Formats rendered as Markdown; everything else is shown verbatim. */
const MARKDOWN_FORMATS = new Set(['markdown', 'md'])

/**
 * Render one content envelope.
 * @param props - the envelope and the copy shown when it carries no body.
 * @returns the rendered body.
 */
export function Content({ content, emptyMessage }: {
  content: KnowledgeContent
  emptyMessage: string
}): React.JSX.Element {
  // MarkdownText caches its render against the labels identity, so a fresh
  // object each render would discard that cache. Keying the memo on the
  // translated strings themselves keeps one stable identity per locale: it
  // changes exactly when a Language switch changes the copy, and never
  // otherwise. (Empty deps would pin the mount-time language forever.)
  const copyLabel = t('inspector.copy')
  const copiedLabel = t('inspector.copied')
  const footnotes = t('inspector.footnotes')
  const labels = useMemo(
    () => ({ code: { copyLabel, copiedLabel }, footnotes }),
    [copyLabel, copiedLabel, footnotes],
  )

  if (content.data === '') return <div className="dshhy-content">{emptyMessage}</div>
  if (MARKDOWN_FORMATS.has(content.format.toLowerCase())) {
    return (
      <div className="dshhy-markdown">
        <MarkdownText text={content.data} labels={labels} />
      </div>
    )
  }
  return <div className="dshhy-content">{content.data}</div>
}
