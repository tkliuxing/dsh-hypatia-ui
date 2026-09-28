/**
 * The console's Markdown renderer.
 *
 * Plugin-owned on purpose. DSH's own `MarkdownText` lives in
 * `@deepseek-ai/dsh-client-ui-primitives`, and the plugin development manual
 * forbids a plugin from requiring a Harness Client package as a module: those
 * packages change without notice, and a throwing component blanks the slot
 * entry it renders in. So the console parses stored Markdown itself — the same
 * micromark/GFM grammar DSH uses — and builds a React tree from the resulting
 * mdast.
 *
 * Rendering a React tree rather than an HTML string is what keeps stored
 * content inert: an HTML node is dropped instead of injected, so a record
 * cannot script the GUI, and every destination passes a protocol allowlist
 * before it reaches an `href` or `src` (an unsupported link is unwrapped to its
 * text, an unsupported image to its alt text). Both postures mirror the host
 * renderer's `skipHtml` and `sanitizeUrl`.
 *
 * Supported: headings, paragraphs, emphasis, strong, strikethrough, inline
 * code, fenced and indented code blocks (with a copy control), blockquotes,
 * ordered/unordered/task lists, tables, thematic breaks, hard breaks, links
 * (inline, reference, and autolink), images, and footnotes. Deliberately out of
 * scope against the host renderer: syntax highlighting, TeX math, and file or
 * path mentions — the console shows stored knowledge bodies, not transcripts.
 *
 * @module @tkliuxing/dsh-hypatia-ui/client/Markdown
 */

import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { fromMarkdown } from 'mdast-util-from-markdown'
import { gfmFromMarkdown } from 'mdast-util-gfm'
import { gfm } from 'micromark-extension-gfm'
import type {
  Definition, FootnoteDefinition, PhrasingContent, RootContent, Table, TableCell,
} from 'mdast'
import type { Translate } from './locales.ts'

/** One GFM column alignment; `null` means the default (left). */
type TableAlign = NonNullable<Table['align']>[number]

/** Destinations an authored link may carry (`mailto:` included, as the host allows). */
const LINK_PROTOCOLS: ReadonlySet<string> = new Set(['http:', 'https:', 'mailto:'])

/** Destinations an authored image may carry: remote media only, never `data:` or a local path. */
const IMAGE_PROTOCOLS: ReadonlySet<string> = new Set(['http:', 'https:'])

/** Milliseconds the copy control shows its confirmation. */
const COPIED_MS = 1600

/**
 * Admit one authored destination by protocol.
 * @param url - the destination written in the Markdown.
 * @param protocols - the allowlist for this kind of destination.
 * @returns the destination when it is absolute and admitted, else undefined.
 */
function safeUrl(url: string, protocols: ReadonlySet<string>): string | undefined {
  try {
    return protocols.has(new URL(url).protocol) ? url : undefined
  } catch {
    // Relative and otherwise unparsable destinations are refused alongside
    // disallowed protocols; `new URL()` has no other failure mode here.
    return undefined
  }
}

/** One render pass: the copy labels plus the footnote numbering this pass assigns. */
interface Context {
  readonly t: Translate
  /** Footnote identifiers in first-reference order. */
  readonly footnoteOrder: string[]
  /** Identifier → its 1-based number. */
  readonly footnoteNumbers: Map<string, number>
  /** Identifier → the definition that renders in the trailing section. */
  readonly definitions: Map<string, Definition>
  readonly footnotes: Map<string, FootnoteDefinition>
}

/**
 * Walk one subtree for the definitions and footnotes the pass needs.
 * @param nodes - block nodes to walk.
 * @param definitions - accumulator for link/image definitions.
 * @param footnotes - accumulator for footnote definitions.
 */
function collectTargets(
  nodes: readonly RootContent[],
  definitions: Map<string, Definition>,
  footnotes: Map<string, FootnoteDefinition>,
): void {
  for (const node of nodes) {
    if (node.type === 'definition') definitions.set(node.identifier, node)
    else if (node.type === 'footnoteDefinition') footnotes.set(node.identifier, node)
  }
}

/**
 * Render the reasoning text of an unsupported destination.
 * @param children - the authored link children.
 * @param context - the render pass.
 * @param key - React key.
 * @returns the children without an anchor around them.
 */
function unwrapped(children: ReactNode[], key: string): ReactNode {
  return <Fragment key={key}>{children}</Fragment>
}

/** The code block's own copy control, so a record's snippets are usable as stored. */
function CodeCopyButton({ text, context }: { text: string; context: Context }): React.JSX.Element {
  const [copied, setCopied] = useState(false)
  const timer = useRef<number | undefined>(undefined)
  useEffect(() => () => { window.clearTimeout(timer.current) }, [])
  const copy = useCallback((): void => {
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => { setCopied(false) }, COPIED_MS)
    }).catch(() => {
      // A refused clipboard write leaves the label alone: the text is still
      // selectable, and a failure notice would be noise on a read-only view.
    })
  }, [text])
  return (
    <button type="button" className="dshhy-code-copy" onClick={copy}>
      {copied ? context.t('inspector.copied') : context.t('inspector.copy')}
    </button>
  )
}

/**
 * Render inline nodes.
 * @param nodes - phrasing nodes.
 * @param context - the render pass.
 * @param base - React key prefix for this run.
 * @returns the rendered children.
 */
function inline(nodes: readonly PhrasingContent[], context: Context, base: string): ReactNode[] {
  return nodes.map((node, index) => phrasing(node, context, `${base}.${index}`))
}

/**
 * Render one inline node.
 * @param node - the phrasing node.
 * @param context - the render pass.
 * @param key - React key.
 * @returns the rendered node; an unsupported one renders nothing.
 */
function phrasing(node: PhrasingContent, context: Context, key: string): ReactNode {
  switch (node.type) {
    case 'text':
      return node.value
    case 'emphasis':
      return <em key={key}>{inline(node.children, context, key)}</em>
    case 'strong':
      return <strong key={key}>{inline(node.children, context, key)}</strong>
    case 'delete':
      return <del key={key}>{inline(node.children, context, key)}</del>
    case 'inlineCode':
      return <code key={key} className="dshhy-inline-code">{node.value}</code>
    case 'break':
      return <br key={key} />
    case 'link': {
      const { url, title } = node
      const href = safeUrl(url, LINK_PROTOCOLS)
      const children = inline(node.children, context, key)
      if (href === undefined) return unwrapped(children, key)
      return (
        <a
          key={key} href={href}
          {...(title === null || title === undefined ? {} : { title })}
          {...(href.startsWith('mailto:') ? {} : { target: '_blank', rel: 'noopener noreferrer' })}
        >
          {children}
        </a>
      )
    }
    case 'linkReference': {
      const definition = context.definitions.get(node.identifier)
      const children = inline(node.children, context, key)
      // An unresolved reference renders its own text, the way a browser shows
      // an unmatched reference: the label, not a broken anchor.
      if (definition === undefined) return unwrapped(children, key)
      const href = safeUrl(definition.url, LINK_PROTOCOLS)
      if (href === undefined) return unwrapped(children, key)
      return (
        <a
          key={key} href={href}
          {...(definition.title === null || definition.title === undefined ? {} : { title: definition.title })}
          {...(href.startsWith('mailto:') ? {} : { target: '_blank', rel: 'noopener noreferrer' })}
        >
          {children}
        </a>
      )
    }
    case 'image': {
      const { url, alt, title } = node
      const src = safeUrl(url, IMAGE_PROTOCOLS)
      if (src === undefined) return <span key={key}>{alt ?? ''}</span>
      return (
        <img
          key={key} className="dshhy-image" src={src} alt={alt ?? ''}
          loading="lazy" decoding="async" referrerPolicy="no-referrer"
          {...(title === null || title === undefined ? {} : { title })}
        />
      )
    }
    case 'imageReference': {
      const definition = context.definitions.get(node.identifier)
      const src = definition === undefined ? undefined : safeUrl(definition.url, IMAGE_PROTOCOLS)
      if (src === undefined) return <span key={key}>{node.alt ?? ''}</span>
      return (
        <img
          key={key} className="dshhy-image" src={src} alt={node.alt ?? ''}
          loading="lazy" decoding="async" referrerPolicy="no-referrer"
        />
      )
    }
    case 'footnoteReference': {
      let number = context.footnoteNumbers.get(node.identifier)
      if (number === undefined) {
        // First reference assigns the number; the section below renders in
        // reference order, and a repeated reference reuses the same number.
        number = context.footnoteOrder.push(node.identifier)
        context.footnoteNumbers.set(node.identifier, number)
      }
      return (
        <sup key={key} className="dshhy-footnote-ref">
          <a href={`#dshhy-footnote-${number}`}>{number}</a>
        </sup>
      )
    }
    case 'html':
      // Raw HTML stays inert: an HTML node never becomes markup here.
      return null
    default:
      return null
  }
}

/**
 * Render one table cell.
 * @param cell - the cell node.
 * @param context - the render pass.
 * @param key - React key.
 * @param header - whether this is a header cell.
 * @param align - the column's alignment, which GFM stores on the table.
 * @returns the rendered cell.
 */
function tableCell(
  cell: TableCell, context: Context, key: string, header: boolean, align: TableAlign | undefined,
): ReactNode {
  const style = align === null || align === undefined ? undefined : { textAlign: align }
  const children = inline(cell.children, context, key)
  return header
    ? <th key={key} style={style}>{children}</th>
    : <td key={key} style={style}>{children}</td>
}

/**
 * Render one block node.
 * @param node - the block node.
 * @param context - the render pass.
 * @param key - React key.
 * @returns the rendered block; a node without a rendering rule renders nothing.
 */
function block(node: RootContent, context: Context, key: string): ReactNode {
  switch (node.type) {
    case 'paragraph':
      return <p key={key}>{inline(node.children, context, key)}</p>
    case 'heading': {
      const children = inline(node.children, context, key)
      // Only h1..h4 appear in stored knowledge; h5/h6 fold onto h4 so a deep
      // outline cannot render smaller than the body copy.
      switch (node.depth) {
        case 1: return <h1 key={key}>{children}</h1>
        case 2: return <h2 key={key}>{children}</h2>
        case 3: return <h3 key={key}>{children}</h3>
        default: return <h4 key={key}>{children}</h4>
      }
    }
    case 'code': {
      const language = node.lang?.trim() ?? ''
      return (
        <div className="dshhy-code" key={key}>
          <div className="dshhy-code-bar">
            <span className="dshhy-code-lang">{language === '' ? context.t('inspector.code') : language}</span>
            <CodeCopyButton text={node.value} context={context} />
          </div>
          <pre><code {...(language === '' ? {} : { className: `language-${language}` })}>{node.value}</code></pre>
        </div>
      )
    }
    case 'blockquote':
      return <blockquote key={key}>{blocks(node.children, context, key)}</blockquote>
    case 'list': {
      // A tight item's single paragraph is unwrapped, the way a browser
      // renders `<li>one</li>` rather than `<li><p>one</p></li>`; a loose list
      // keeps the paragraph so its vertical rhythm survives.
      const tightList = node.spread !== true
      const items = node.children.map((item, index) => {
        const itemKey = `${key}.${index}`
        const checkbox = item.checked === null || item.checked === undefined
          ? null
          : <input type="checkbox" checked={item.checked} readOnly tabIndex={-1} aria-hidden="true" />
        const only = item.children.length === 1 ? item.children[0] : undefined
        const tightItem = tightList && item.spread !== true && only?.type === 'paragraph'
        return (
          <li key={itemKey} className={checkbox === null ? undefined : 'dshhy-task-item'}>
            {checkbox}
            {tightItem && only.type === 'paragraph'
              ? inline(only.children, context, itemKey)
              : blocks(item.children, context, itemKey)}
          </li>
        )
      })
      return node.ordered === true
        ? <ol key={key} {...(node.start === null || node.start === undefined || node.start === 1 ? {} : { start: node.start })}>{items}</ol>
        : <ul key={key}>{items}</ul>
    }
    case 'table': {
      const table = node
      const align = table.align
      return (
        <div className="dshhy-table-wrap" key={key}>
          <table>
            <thead>
              <tr>
                {table.children[0]?.children.map((cell, index) => tableCell(cell, context, `${key}.h${index}`, true, align?.[index] ?? null)) ?? null}
              </tr>
            </thead>
            <tbody>
              {table.children.slice(1).map((row, rowIndex) => (
                <tr key={`${key}.r${rowIndex}`}>
                  {row.children.map((cell, index) => tableCell(cell, context, `${key}.r${rowIndex}c${index}`, false, align?.[index] ?? null))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
    }
    case 'thematicBreak':
      return <hr key={key} />
    case 'html':
      // Raw HTML stays inert at block level too.
      return null
    case 'definition':
    case 'footnoteDefinition':
      // Targets render where they are referenced; footnote bodies render in
      // the trailing section this pass assembles.
      return null
    default:
      return null
  }
}

/**
 * Render a block run.
 * @param nodes - block nodes.
 * @param context - the render pass.
 * @param base - React key prefix.
 * @returns the rendered blocks.
 */
function blocks(nodes: readonly RootContent[], context: Context, base: string): ReactNode[] {
  return nodes.map((node, index) => block(node, context, `${base}.${index}`))
}

/** The trailing footnote section, or null when the body referenced none. */
function FootnoteSection({ context }: { context: Context }): React.JSX.Element | null {
  if (context.footnoteOrder.length === 0) return null
  return (
    <section className="dshhy-footnotes" aria-label={context.t('inspector.footnotes')}>
      <h4>{context.t('inspector.footnotes')}</h4>
      <ol>
        {context.footnoteOrder.map(identifier => {
          const definition = context.footnotes.get(identifier)
          const number = context.footnoteNumbers.get(identifier)
          return (
            <li key={identifier} id={`dshhy-footnote-${number}`}>
              {definition === undefined
                ? identifier
                : blocks(definition.children, context, `fn.${identifier}`)}
            </li>
          )
        })}
      </ol>
    </section>
  )
}

/**
 * Parse a run of Markdown and render it as React elements.
 * @param props - the stored Markdown source.
 * @returns the rendered document; nothing is injected as markup.
 */
export function Markdown({ text, t }: { text: string; t: Translate }): React.JSX.Element {
  return useMemo(() => {
    const root = fromMarkdown(text, { extensions: [gfm()], mdastExtensions: [gfmFromMarkdown()] })
    const definitions = new Map<string, Definition>()
    const footnotes = new Map<string, FootnoteDefinition>()
    collectTargets(root.children, definitions, footnotes)
    const context: Context = {
      t, footnoteOrder: [], footnoteNumbers: new Map(), definitions, footnotes,
    }
    // The footnote section needs every reference numbered first, so the body
    // renders into an array and the section is appended after it.
    const body = blocks(root.children, context, 'md')
    return <>{body}<FootnoteSection context={context} /></>
  }, [text, t])
}
