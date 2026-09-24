/**
 * The graph workspace: one focused entity, its direct relationships, and
 * whatever the user expands from there.
 *
 * The map is deliberately *local*. A shelf can hold far more than a browser
 * can lay out, so a focus read returns at most 60 relationships per direction
 * and the merged map is capped at 90 nodes / 160 edges; past that the user
 * refocuses instead of the canvas degrading. Expanding a node adds its
 * relations to the current map; focusing one starts a fresh map centered
 * there.
 *
 * Cytoscape is the one bundled third-party dependency. Its palette is read
 * from the live DSH theme tokens at mount and re-read on a theme change, so
 * the canvas — the only surface CSS cannot reach — still follows light, dark,
 * and installed skins.
 *
 * @module @tkliuxing/dsh-hypatia-ui/client/GraphView
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import cytoscape, { type Core, type ElementDefinition, type EventObject } from 'cytoscape'
import {
  IconBranchOutlineRegular, IconChevronLeftOutlineRegular, IconFullscreenOutlineRegular,
  IconLoadingOutlineRegular, IconRefreshOutlineRegular,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { GraphEdge, GraphNode, GraphNodeResponse } from '../protocol.ts'
import { getGraphNode } from './api.ts'
import { Content } from './Content.tsx'
import { dateLabel, scopeLabel } from './HypatiaConsole.tsx'
import { t } from './locales.ts'

/** Merged-map caps; past either, expansion stops and the user refocuses. */
const MAX_NODES = 90
const MAX_EDGES = 160

/** Two taps on one node within this window mean "focus here". */
const DOUBLE_TAP_WINDOW_MS = 450

/** The map currently drawn. */
interface GraphState {
  focus: string
  nodes: GraphNode[]
  edges: GraphEdge[]
}

/** What the inspector is showing. */
type Selection = { kind: 'node'; id: string } | { kind: 'edge'; id: string } | null

function emptyGraph(): GraphState {
  return { focus: '', nodes: [], edges: [] }
}

function shortLabel(value: string, maximum = 26): string {
  return value.length > maximum ? `${value.slice(0, maximum - 1)}…` : value
}

/**
 * Fold one focus read into the current map.
 * @param current - the map drawn so far.
 * @param response - the newly read neighborhood.
 * @param reset - true for a new focus (replace), false for an expansion (merge).
 * @returns the next map, capped at {@link MAX_NODES} / {@link MAX_EDGES}.
 */
export function mergeGraph(current: GraphState, response: GraphNodeResponse, reset: boolean): GraphState {
  const nodeById = new Map((reset ? [] : current.nodes).map(node => [node.id, node]))
  for (const node of response.nodes) {
    const existing = nodeById.get(node.id)
    if (existing === undefined && nodeById.size >= MAX_NODES) continue
    // A node already carrying a record must not be downgraded to a dangling
    // reference by a later read that only saw it named in a statement.
    nodeById.set(node.id, existing?.knowledge != null && node.knowledge === null ? existing : node)
  }

  const edgeById = new Map((reset ? [] : current.edges).map(edge => [edge.id, edge]))
  for (const edge of response.edges) {
    if (edgeById.size >= MAX_EDGES && !edgeById.has(edge.id)) continue
    // An edge whose other end was dropped by the node cap would render as a
    // dangling line, so it waits until that node is admitted.
    if (nodeById.has(edge.source) && nodeById.has(edge.target)) edgeById.set(edge.id, edge)
  }

  return {
    focus: reset ? response.focus : (current.focus !== '' ? current.focus : response.focus),
    nodes: [...nodeById.values()],
    edges: [...edgeById.values()],
  }
}

function graphElements(graph: GraphState): ElementDefinition[] {
  return [
    ...graph.nodes.map(node => ({
      group: 'nodes' as const,
      data: { id: node.id, label: shortLabel(node.name) },
      classes: [
        node.id === graph.focus ? 'focus' : '',
        node.knowledge !== null ? 'knowledge' : 'reference',
      ].filter(part => part !== '').join(' '),
    })),
    ...graph.edges.map(edge => ({
      group: 'edges' as const,
      data: {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        label: shortLabel(edge.predicate, 20),
      },
    })),
  ]
}

/** The canvas palette, read from the page's live theme tokens. */
interface GraphPalette {
  node: string
  nodeBorder: string
  focus: string
  focusBorder: string
  reference: string
  referenceBorder: string
  label: string
  edge: string
  edgeLabel: string
  edgeLabelBackground: string
  selected: string
}

/**
 * Read the canvas palette from the resolved theme.
 * @param element - any element inside the console, used as the token scope.
 * @returns the palette; a token the theme does not define falls back to a
 *   neutral literal so the canvas never renders with empty colors.
 */
function readPalette(element: HTMLElement): GraphPalette {
  const styles = getComputedStyle(element)
  const token = (name: string, fallback: string): string => {
    const value = styles.getPropertyValue(name).trim()
    return value === '' ? fallback : value
  }
  return {
    node: token('--dsw-alias-brand-primary', '#4d6bfe'),
    nodeBorder: token('--dsw-alias-border-l3', '#2c3e8f'),
    focus: token('--dsw-alias-state-warn-primary', '#e0a73f'),
    focusBorder: token('--dsw-alias-state-warn-label', '#6d4b11'),
    reference: token('--dsw-alias-bg-layer-3', '#f0f0f0'),
    referenceBorder: token('--dsw-alias-label-dimmed', '#9a9a9a'),
    label: token('--dsw-alias-label-primary', '#1a1a1a'),
    edge: token('--dsw-alias-border-l3', '#8ba99f'),
    edgeLabel: token('--dsw-alias-label-tertiary', '#48645b'),
    edgeLabelBackground: token('--dsw-alias-bg-base', '#ffffff'),
    // Deliberately not the brand token: DSH's brand is monochrome, so a brand
    // overlay over a brand-filled node is invisible. The business accent is
    // distinct from both the node fill and the amber focus, and flips with the
    // theme like everything else here.
    selected: token('--dsw-alias-state-business-primary', '#679efe'),
  }
}

function cytoscapeStyle(palette: GraphPalette): cytoscape.StylesheetStyle[] {
  return [
    {
      selector: 'node',
      style: {
        'background-color': palette.node,
        'border-color': palette.nodeBorder,
        'border-width': 2,
        color: palette.label,
        label: 'data(label)',
        'font-size': 11,
        'font-weight': 600,
        'text-wrap': 'wrap',
        'text-max-width': '92px',
        'text-valign': 'bottom',
        'text-margin-y': 7,
        width: 30,
        height: 30,
      },
    },
    {
      selector: 'node.focus',
      style: {
        'background-color': palette.focus,
        'border-color': palette.focusBorder,
        width: 38,
        height: 38,
      },
    },
    {
      selector: 'node.reference',
      style: {
        'background-color': palette.reference,
        'border-color': palette.referenceBorder,
        'border-style': 'dashed',
      },
    },
    {
      selector: 'edge',
      style: {
        width: 1.5,
        'curve-style': 'bezier',
        'line-color': palette.edge,
        'target-arrow-color': palette.edge,
        'target-arrow-shape': 'triangle',
        label: 'data(label)',
        color: palette.edgeLabel,
        'font-size': 9,
        'font-weight': 600,
        'text-background-color': palette.edgeLabelBackground,
        'text-background-opacity': 0.94,
        'text-background-padding': '2px',
        'text-rotation': 'autorotate',
      },
    },
    {
      selector: 'node.is-selected',
      style: {
        'overlay-color': palette.selected,
        'overlay-opacity': 0.18,
        'overlay-padding': 9,
        'border-color': palette.selected,
      },
    },
    {
      selector: 'edge.is-selected',
      style: {
        'line-color': palette.selected,
        'target-arrow-color': palette.selected,
        width: 3,
      },
    },
  ]
}

function applySelection(cy: Core, selection: Selection): void {
  cy.elements().removeClass('is-selected')
  if (selection !== null) cy.getElementById(selection.id).addClass('is-selected')
}

/**
 * The graph workspace.
 * @param props - the shelf, the entity to center, and the console's focus
 *   navigation (its own Back stack, since the URL belongs to the shell).
 * @returns the toolbar, canvas, and graph inspector.
 */
export function GraphWorkspace({ shelf, focusName, canGoBack, onGoBack, onFocusChange }: {
  shelf: string
  focusName: string | null
  canGoBack: boolean
  onGoBack: () => void
  onFocusChange: (name: string) => void
}): React.JSX.Element {
  const canvasRef = useRef<HTMLDivElement>(null)
  const cyRef = useRef<Core | null>(null)
  const onFocusChangeRef = useRef(onFocusChange)
  const lastNodeTap = useRef<{ name: string; timestamp: number } | null>(null)
  const expandedNodes = useRef(new Set<string>())
  const requestId = useRef(0)

  const [graph, setGraph] = useState<GraphState>(emptyGraph)
  const [selection, setSelection] = useState<Selection>(null)
  const [loadingNode, setLoadingNode] = useState('')
  const [error, setError] = useState('')

  const selectedNode = useMemo(
    () => (selection?.kind === 'node' ? graph.nodes.find(node => node.id === selection.id) ?? null : null),
    [graph.nodes, selection],
  )
  const selectedEdge = useMemo(
    () => (selection?.kind === 'edge' ? graph.edges.find(edge => edge.id === selection.id) ?? null : null),
    [graph.edges, selection],
  )

  const loadNode = useCallback(async (name: string, reset: boolean): Promise<void> => {
    const id = ++requestId.current
    setLoadingNode(name)
    setError('')
    try {
      const response = await getGraphNode(shelf, name)
      if (id !== requestId.current) return
      expandedNodes.current.add(name)
      setGraph(current => mergeGraph(current, response, reset))
      if (reset) setSelection({ kind: 'node', id: name })
    } catch (reason: unknown) {
      if (id !== requestId.current) return
      setError(reason instanceof Error ? reason.message : t('graph.failed'))
      if (reset) setGraph(emptyGraph())
    } finally {
      if (id === requestId.current) setLoadingNode('')
    }
  }, [shelf])

  useEffect(() => { onFocusChangeRef.current = onFocusChange }, [onFocusChange])

  useEffect(() => {
    expandedNodes.current.clear()
    setSelection(null)
    setGraph(emptyGraph())
    setError('')
    if (focusName !== null) void loadNode(focusName, true)
  }, [focusName, loadNode])

  // One cytoscape instance for the component's lifetime. The palette is bound
  // at construction and refreshed by the theme observer below, so a theme
  // switch never tears the graph down and loses the map.
  useEffect(() => {
    const container = canvasRef.current
    if (container === null) return
    const cy = cytoscape({ container, elements: [], style: cytoscapeStyle(readPalette(container)) })

    cy.on('tap', 'node', (event: EventObject) => {
      const name = String(event.target.id())
      const now = Date.now()
      const previous = lastNodeTap.current
      setSelection({ kind: 'node', id: name })
      if (previous !== null && previous.name === name && now - previous.timestamp <= DOUBLE_TAP_WINDOW_MS) {
        lastNodeTap.current = null
        onFocusChangeRef.current(name)
      } else {
        lastNodeTap.current = { name, timestamp: now }
      }
    })
    cy.on('tap', 'edge', (event: EventObject) => { setSelection({ kind: 'edge', id: String(event.target.id()) }) })
    cy.on('tap', (event: EventObject) => { if (event.target === cy) setSelection(null) })
    cyRef.current = cy

    // The shell writes the resolved theme onto body attributes and variables;
    // re-read the palette whenever it does, since canvas colors are baked in
    // rather than inherited from CSS.
    const themeObserver = new MutationObserver(() => {
      cy.style(cytoscapeStyle(readPalette(container)))
    })
    themeObserver.observe(document.body, { attributes: true, attributeFilter: ['style', 'data-ds-dark-theme'] })

    return () => {
      themeObserver.disconnect()
      cy.destroy()
      cyRef.current = null
    }
  }, [])

  useEffect(() => {
    const cy = cyRef.current
    if (cy === null) return
    cy.elements().remove()
    const elements = graphElements(graph)
    if (elements.length === 0) return
    cy.add(elements)
    cy.layout({
      name: 'cose',
      animate: false,
      fit: true,
      padding: 48,
      nodeRepulsion: () => 280_000,
      idealEdgeLength: () => 130,
      gravity: 0.22,
    }).run()
  }, [graph])

  useEffect(() => {
    const cy = cyRef.current
    if (cy !== null) applySelection(cy, selection)
  }, [graph, selection])

  const fitGraph = useCallback((): void => { cyRef.current?.fit(undefined, 48) }, [])

  const reloadFocus = useCallback((): void => {
    if (graph.focus === '') return
    expandedNodes.current.clear()
    void loadNode(graph.focus, true)
  }, [graph.focus, loadNode])

  const hasReachedLimit = graph.nodes.length >= MAX_NODES || graph.edges.length >= MAX_EDGES

  const expandSelected = useCallback((): void => {
    if (selectedNode === null || loadingNode !== '' || expandedNodes.current.has(selectedNode.name)) return
    void loadNode(selectedNode.name, false)
  }, [loadNode, loadingNode, selectedNode])

  return (
    <section className="dshhy-graph" aria-label={t('view.graph')}>
      <div className="dshhy-graph-toolbar">
        <div className="dshhy-graph-summary">
          <IconBranchOutlineRegular size={14} aria-hidden="true" />
          <span>{t('graph.nodes', { count: graph.nodes.length })}</span>
          <span>{t('graph.edges', { count: graph.edges.length })}</span>
        </div>
        <div className="dshhy-header-actions">
          <button
            className="dshhy-icon-button" type="button" onClick={onGoBack} disabled={!canGoBack}
            title={t('graph.back')} aria-label={t('graph.back')}
          >
            <IconChevronLeftOutlineRegular size={14} />
          </button>
          <button
            className="dshhy-icon-button" type="button" onClick={fitGraph} disabled={graph.nodes.length === 0}
            title={t('graph.fit')} aria-label={t('graph.fit')}
          >
            <IconFullscreenOutlineRegular size={15} />
          </button>
          <button
            className="dshhy-icon-button" type="button" onClick={reloadFocus}
            disabled={graph.focus === '' || loadingNode !== ''}
            title={t('graph.reload')} aria-label={t('graph.reload')}
          >
            <IconRefreshOutlineRegular size={15} className={loadingNode !== '' ? 'dshhy-spin' : ''} />
          </button>
        </div>
      </div>

      <div className="dshhy-graph-layout">
        <div className="dshhy-canvas-frame">
          <div ref={canvasRef} className="dshhy-canvas" aria-label={t('view.graph')} />
          {focusName === null && loadingNode === '' ? (
            <div className="dshhy-canvas-overlay">
              <IconBranchOutlineRegular size={26} /><p>{t('graph.blank')}</p>
            </div>
          ) : null}
          {loadingNode !== '' && graph.nodes.length === 0 ? (
            <div className="dshhy-canvas-overlay">
              <IconLoadingOutlineRegular size={24} className="dshhy-spin" /><p>{t('graph.loading')}</p>
            </div>
          ) : null}
          {error !== '' ? (
            <div className="dshhy-graph-banner dshhy-graph-banner-error" role="alert">{error}</div>
          ) : null}
          {hasReachedLimit ? (
            <div className="dshhy-graph-banner dshhy-graph-banner-limit" role="status">{t('graph.limit')}</div>
          ) : null}
        </div>

        <aside className="dshhy-graph-inspector" aria-label={t('graph.inspector.empty.title')}>
          {selectedNode !== null ? (
            <NodeInspector
              node={selectedNode}
              isFocus={selectedNode.id === graph.focus}
              loading={loadingNode === selectedNode.name}
              expanded={expandedNodes.current.has(selectedNode.name)}
              canExpand={!hasReachedLimit}
              onExpand={expandSelected}
              onFocus={() => { onFocusChange(selectedNode.name) }}
            />
          ) : null}
          {selectedEdge !== null ? <EdgeInspector edge={selectedEdge} /> : null}
          {selectedNode === null && selectedEdge === null ? (
            <div className="dshhy-blank">
              <IconBranchOutlineRegular size={24} />
              <h3>{t('graph.inspector.empty.title')}</h3>
              <p>{t('graph.inspector.empty.body')}</p>
            </div>
          ) : null}
        </aside>
      </div>
    </section>
  )
}

function NodeInspector({ node, isFocus, loading, expanded, canExpand, onExpand, onFocus }: {
  node: GraphNode
  isFocus: boolean
  loading: boolean
  expanded: boolean
  canExpand: boolean
  onExpand: () => void
  onFocus: () => void
}): React.JSX.Element {
  const knowledge = node.knowledge
  return (
    <>
      <div className="dshhy-inspector-head">
        <div>
          <p className="dshhy-eyebrow">
            {knowledge !== null ? t('graph.kicker.knowledge') : t('graph.kicker.reference')}
          </p>
          <h3>{node.name}</h3>
        </div>
        {isFocus ? <span className="dshhy-focus-badge">{t('graph.focusBadge')}</span> : null}
      </div>

      {knowledge !== null ? (
        <>
          <div className="dshhy-meta">
            <span>{knowledge.content.format}</span>
            <span>{dateLabel(knowledge.createdAt)}</span>
          </div>
          <Content content={knowledge.content} emptyMessage={t('inspector.content.empty')} />
          <div className="dshhy-meta-groups">
            <div>
              <p>{t('inspector.tags')}</p>
              <div className="dshhy-chip-wrap">
                {knowledge.content.tags.length > 0
                  ? knowledge.content.tags.map(tag => (
                    <span className="dshhy-chip dshhy-chip-tag" key={tag}>{tag}</span>
                  ))
                  : <span className="dshhy-muted">{t('inspector.tags.none')}</span>}
              </div>
            </div>
            <div>
              <p>{t('inspector.scopes')}</p>
              <div className="dshhy-chip-wrap">
                {knowledge.content.scopes.length > 0
                  ? knowledge.content.scopes.map(scope => (
                    <span className="dshhy-chip dshhy-chip-scope" key={scope === '' ? '__global__' : scope}>
                      {scopeLabel(scope)}
                    </span>
                  ))
                  : <span className="dshhy-muted">{t('inspector.scopes.none')}</span>}
              </div>
            </div>
          </div>
        </>
      ) : (
        <p className="dshhy-reference-copy">{t('graph.reference.body')}</p>
      )}

      <div className="dshhy-graph-actions">
        <button className="dshhy-button" type="button" onClick={onFocus} disabled={isFocus}>
          <IconBranchOutlineRegular size={14} /> {t('graph.focus')}
        </button>
        <button
          className="dshhy-text-button dshhy-outline-button" type="button"
          onClick={onExpand} disabled={expanded || loading || !canExpand}
        >
          {loading
            ? <IconLoadingOutlineRegular size={13} className="dshhy-spin" />
            : <IconRefreshOutlineRegular size={13} />}
          {expanded ? t('graph.expanded') : t('graph.expand')}
        </button>
      </div>
    </>
  )
}

function EdgeInspector({ edge }: { edge: GraphEdge }): React.JSX.Element {
  return (
    <>
      <div className="dshhy-inspector-head">
        <div>
          <p className="dshhy-eyebrow">{t('graph.statement')}</p>
          <h3>{edge.predicate}</h3>
        </div>
        <IconBranchOutlineRegular size={18} aria-hidden="true" />
      </div>
      <div className="dshhy-statement-path">
        <span>{edge.source}</span>
        <span aria-hidden="true">→</span>
        <strong>{edge.predicate}</strong>
        <span aria-hidden="true">→</span>
        <span>{edge.target}</span>
      </div>
      <div className="dshhy-meta">
        <span>{edge.content.format}</span>
        <span>{dateLabel(edge.createdAt)}</span>
      </div>
      <Content content={edge.content} emptyMessage={t('graph.content.empty')} />
    </>
  )
}
