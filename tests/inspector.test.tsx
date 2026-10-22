/**
 * The inspector's embedding badge.
 *
 * Hypatia emits `content.embed` only for an entry that declared it stays out
 * of the vector index, so the badge must key off an explicit `false` — an
 * absent member is the indexed default and must stay quiet.
 */

import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Inspector } from '../src/client/Inspector.tsx'
import type { Impact, KnowledgeContent } from '../src/protocol.ts'

function impact(content: KnowledgeContent): Impact {
  return {
    knowledge: { name: 'entry', content, createdAt: '2026-01-02T03:04:05' },
    relationships: [],
  }
}

function render(content: KnowledgeContent): string {
  return renderToStaticMarkup(
    <Inspector impact={impact(content)} onDelete={() => {}} onOpenGraph={() => {}} />,
  )
}

const BASE: KnowledgeContent = { data: 'body', format: 'markdown', tags: [], scopes: [], figures: [] }

describe('Inspector embedding badge', () => {
  it('marks an entry that declared it stays out of the vector index', () => {
    const html = render({ ...BASE, embed: false })
    expect(html).toContain('dshhy-chip-embed')
    expect(html).toContain('embed.off')
  })

  it('stays quiet for the absent member, the indexed default', () => {
    expect(render(BASE)).not.toContain('dshhy-chip-embed')
  })
})
