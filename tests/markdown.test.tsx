/**
 * The plugin-owned Markdown renderer.
 *
 * What matters is the security posture the README claims: stored content never
 * becomes markup, and a destination only reaches an `href`/`src` after passing
 * the protocol allowlist. The rendering vocabulary (headings, tables, task
 * lists, footnotes, code cards) is covered beside it, because a silent parse
 * regression would be invisible until a knowledge body rendered wrong.
 */

import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Markdown } from '../src/client/Markdown.tsx'
import { en, type HypatiaKey, type Translate } from '../src/client/locales.ts'

const t: Translate = (key => en[key as HypatiaKey] ?? String(key))

function render(text: string): string {
  return renderToStaticMarkup(<Markdown text={text} t={t} />)
}

describe('Markdown', () => {
  it('renders block and inline structure', () => {
    const html = render('# Title\n\nA **bold** and *em* word.\n\n- one\n- two\n')
    expect(html).toContain('<h1>Title</h1>')
    expect(html).toContain('<strong>bold</strong>')
    expect(html).toContain('<em>em</em>')
    expect(html).toContain('<ul><li>one</li><li>two</li></ul>')
  })

  it('decodes character references to text', () => {
    expect(render('A &amp; B &#65;')).toContain('<p>A &amp; B A</p>')
  })

  it('drops raw HTML instead of injecting it', () => {
    const html = render('<div onclick="steal()">block</div>\n\ninline <img src=x onerror="steal()"> tail')
    expect(html).not.toContain('<div')
    expect(html).not.toContain('onclick')
    expect(html).not.toContain('<img')
    expect(html).not.toContain('onerror')
    // The inline case keeps the visible text on either side of the dropped tag.
    expect(html).toContain('inline')
    expect(html).toContain('tail')
  })

  it('never turns a code block into markup', () => {
    const html = render('```html\n<svg onload="steal()">\n```')
    expect(html).not.toContain('<svg')
    expect(html).toContain('&lt;svg onload=&quot;steal()&quot;&gt;')
  })

  it('unwraps a link whose protocol is not allowed', () => {
    const html = render('[click](javascript:steal())')
    expect(html).not.toContain('<a')
    expect(html).not.toContain('javascript:')
    expect(html).toContain('click')
  })

  it('opens an allowed link in a new tab and refuses a relative one', () => {
    expect(render('[docs](https://e.test/x)'))
      .toContain('<a href="https://e.test/x" target="_blank" rel="noopener noreferrer">docs</a>')
    expect(render('[local](./notes.md)')).not.toContain('<a')
    expect(render('[mail](mailto:a@b.test)')).toContain('<a href="mailto:a@b.test">mail</a>')
  })

  it('renders a remote image and falls back to alt text otherwise', () => {
    expect(render('![diagram](https://e.test/d.png)'))
      .toContain('<img class="dshhy-image" src="https://e.test/d.png" alt="diagram"')
    const local = render('![diagram](./d.png)')
    expect(local).not.toContain('<img')
    expect(local).toContain('diagram')
  })

  it('resolves a reference link through its definition', () => {
    const html = render('[docs][d]\n\n[d]: https://e.test/x "Title"')
    expect(html).toContain('href="https://e.test/x"')
    expect(html).toContain('title="Title"')
  })

  it('renders a table with the column alignment GFM carries', () => {
    const html = render('| a | b |\n|:--|--:|\n| 1 | 2 |')
    expect(html).toContain('<th style="text-align:left">a</th>')
    expect(html).toContain('<td style="text-align:right">2</td>')
  })

  it('renders a task list item as a disabled checkbox', () => {
    const html = render('- [x] done\n- [ ] todo')
    expect(html).toContain('type="checkbox"')
    expect(html).toContain('checked=""')
  })

  it('numbers footnotes in reference order and lists them once', () => {
    const html = render('one[^a] two[^b] one again[^a]\n\n[^a]: first note\n[^b]: second note')
    expect(html).toContain('href="#dshhy-footnote-1"')
    expect(html).toContain('href="#dshhy-footnote-2"')
    expect(html).toContain('id="dshhy-footnote-1"')
    expect(html).toContain('first note')
    // The repeated reference reuses its number rather than appending a third.
    expect(html).not.toContain('href="#dshhy-footnote-3"')
  })

  it('gives a fenced block a copy control labelled from the locale seat', () => {
    const html = render('```js\nconst x = 1\n```')
    expect(html).toContain('class="dshhy-code-lang">js<')
    expect(html).toContain(en['inspector.copy'])
  })
})
