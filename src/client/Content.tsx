/**
 * Knowledge and statement body rendering.
 *
 * Markdown goes through the plugin's own {@link Markdown} renderer, which
 * parses the same GFM grammar DSH uses and builds a React tree rather than an
 * HTML string — raw HTML stays inert and every destination passes a protocol
 * allowlist, the posture this console takes toward stored content.
 *
 * A body stored in any other format renders verbatim: the record says
 * `text`, so the console shows text.
 *
 * @module @tkliuxing/dsh-hypatia-ui/client/Content
 */

import type { KnowledgeContent } from '../protocol.ts'
import { useTranslate } from './locale-context.tsx'
import { Markdown } from './Markdown.tsx'

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
  const t = useTranslate()
  if (content.data === '') return <div className="dshhy-content">{emptyMessage}</div>
  if (MARKDOWN_FORMATS.has(content.format.toLowerCase())) {
    return (
      <div className="dshhy-markdown">
        <Markdown text={content.data} t={t} />
      </div>
    )
  }
  return <div className="dshhy-content">{content.data}</div>
}
