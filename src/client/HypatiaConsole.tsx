/**
 * The console's root component: shelf rail, search band, record list,
 * inspector, graph workspace, and the deletion dialog.
 *
 * Ported from `hypatia-archive`'s `App.tsx` with two deliberate departures,
 * both forced by living inside DSH rather than owning the page:
 *
 * - **No address-bar state.** The standalone console wrote `view`, `shelf`,
 *   and `focus` into the query string and restored them on `popstate`. Here
 *   the shell owns the URL and the history stack; writing to either would
 *   break session navigation. Graph focus history is kept in component state
 *   instead, with an in-console Back control.
 * - **No `window`-sized breakpoints.** The console occupies one column, so
 *   its responsive rules are container queries (see `styles.ts`), and the
 *   inspector never scroll-jacks the page.
 *
 * Multi-select is scoped to the page on screen: the checkbox column selects
 * rows of the page being shown, and paging, filtering, refreshing, or
 * switching shelves drops the selection rather than carrying an invisible one
 * along into a deletion.
 *
 * @module @tkliuxing/dsh-hypatia-ui/client/HypatiaConsole
 */

import {
  useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore,
  type FormEvent,
} from 'react'
import {
  IconArchiveOutline20, IconBranchOutline16, IconChevronLeftOutline14,
  IconChevronRightOutline14, IconCloseOutline16, IconDatabaseOutline16,
  IconLoadingOutline16, IconRefreshOutline16, IconSearchOutline16, IconTrashOutline16,
} from '@deepseek-ai/dsh-client-ui-primitives'
import { DEFAULT_SHELF, GLOBAL_SCOPE_TOKEN, type Impact, type Knowledge, type Shelf } from '../protocol.ts'
import { deleteKnowledge, deleteKnowledgeBatch, getImpact, getKnowledgePage, getShelves } from './api.ts'
import { BatchDeleteDialog } from './BatchDeleteDialog.tsx'
import type { PanelController } from './controller.ts'
import { DeleteDialog } from './DeleteDialog.tsx'
import { GraphWorkspace } from './GraphView.tsx'
import { Inspector } from './Inspector.tsx'
import { t } from './locales.ts'

/** Records per page. */
const PAGE_LIMIT = 50

/** A transient message shown above the content. */
type Notice = { tone: 'success' | 'error'; text: string } | null

/** Which workspace the console shows. */
type WorkspaceView = 'records' | 'graph'

/** The three filters one page request carries. */
interface Filters { q: string; tag: string; scope: string }

const NO_FILTERS: Filters = { q: '', tag: '', scope: '' }

/**
 * Format a stored timestamp for display.
 * @param value - the ISO-8601 string, possibly empty.
 * @returns `YYYY-MM-DD HH:MM`, or an em dash when absent.
 */
export function dateLabel(value: string): string {
  return value === '' ? '—' : value.replace('T', ' ').slice(0, 16)
}

/**
 * Collapse a body to one line for the list row.
 * @param value - the stored body.
 * @param maximum - character budget.
 * @returns the collapsed excerpt, or the empty-content copy.
 */
export function excerpt(value: string, maximum = 160): string {
  const compact = value.replace(/\s+/g, ' ').trim()
  if (compact === '') return t('list.excerpt.empty')
  return compact.length > maximum ? `${compact.slice(0, maximum)}…` : compact
}

/**
 * Label the empty scope.
 * @param scope - a scope name.
 * @returns the localized global label for the empty scope, else the name.
 */
export function scopeLabel(scope: string): string {
  return scope === '' ? t('search.scope.global') : scope
}

/**
 * The console root.
 * @param props - the panel controller owning open/closed state.
 * @returns the console tree; it renders even while hidden, so its state
 *   survives closing and reopening the panel.
 */
export function HypatiaConsole({ controller }: { controller: PanelController }): React.JSX.Element {
  const panel = useSyncExternalStore(controller.subscribe, controller.getSnapshot)

  const [shelves, setShelves] = useState<Shelf[]>([])
  const [shelfError, setShelfError] = useState('')
  const [shelf, setShelf] = useState(DEFAULT_SHELF)
  const [view, setView] = useState<WorkspaceView>('records')

  const [queryInput, setQueryInput] = useState('')
  const [tagInput, setTagInput] = useState('')
  const [scopeInput, setScopeInput] = useState('')
  const [filters, setFilters] = useState<Filters>(NO_FILTERS)

  const [items, setItems] = useState<Knowledge[]>([])
  const [currentCursor, setCurrentCursor] = useState<string | null>(null)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [cursorHistory, setCursorHistory] = useState<Array<string | null>>([])
  const [pageNumber, setPageNumber] = useState(1)
  const [listLoading, setListLoading] = useState(false)
  const [listError, setListError] = useState('')

  const [selectedName, setSelectedName] = useState<string | null>(null)
  const [impact, setImpact] = useState<Impact | null>(null)
  const [impactLoading, setImpactLoading] = useState(false)

  /** Graph focus stack; the console's own Back, since the URL is the shell's. */
  const [focusHistory, setFocusHistory] = useState<string[]>([])
  const [graphFocus, setGraphFocus] = useState<string | null>(null)

  /** Names checked on the current page; never outlives the page showing them. */
  const [selection, setSelection] = useState<ReadonlySet<string>>(() => new Set())

  const [deleteTarget, setDeleteTarget] = useState<Impact | null>(null)
  /** The frozen name list a bulk deletion is confirming, or null. */
  const [batchTarget, setBatchTarget] = useState<string[] | null>(null)
  const [notice, setNotice] = useState<Notice>(null)

  const inspectRequest = useRef(0)
  const listRequest = useRef(0)
  const listController = useRef<AbortController | null>(null)
  const listPanelRef = useRef<HTMLDivElement>(null)
  /** False until the panel has been opened once: nothing loads while hidden. */
  const activated = useRef(false)
  if (panel.open) activated.current = true

  const loadPage = useCallback(async (
    cursor: string | null, nextHistory: Array<string | null>, nextPageNumber: number,
  ): Promise<void> => {
    listController.current?.abort()
    const abort = new AbortController()
    const requestId = ++listRequest.current
    listController.current = abort
    setListLoading(true)
    setListError('')
    setItems([])
    setSelection(new Set())
    setCurrentCursor(cursor)
    setNextCursor(null)
    setCursorHistory(nextHistory)
    setPageNumber(nextPageNumber)
    listPanelRef.current?.scrollTo({ top: 0, behavior: 'auto' })
    try {
      const page = await getKnowledgePage({
        shelf, ...filters, cursor: cursor ?? undefined, limit: PAGE_LIMIT, signal: abort.signal,
      })
      // A superseded request must not publish its rows over the newer ones.
      if (requestId !== listRequest.current) return
      setItems(page.items)
      setNextCursor(page.nextCursor)
    } catch (error: unknown) {
      if (abort.signal.aborted || requestId !== listRequest.current) return
      setListError(error instanceof Error ? error.message : t('list.failed'))
      setItems([])
      setNextCursor(null)
    } finally {
      if (requestId === listRequest.current) setListLoading(false)
    }
  }, [filters, shelf])

  const refresh = useCallback((): void => { void loadPage(null, [], 1) }, [loadPage])

  const previousPage = useCallback((): void => {
    if (listLoading || cursorHistory.length === 0) return
    void loadPage(cursorHistory.at(-1) ?? null, cursorHistory.slice(0, -1), pageNumber - 1)
  }, [cursorHistory, listLoading, loadPage, pageNumber])

  const nextPage = useCallback((): void => {
    if (listLoading || nextCursor === null) return
    void loadPage(nextCursor, [...cursorHistory, currentCursor], pageNumber + 1)
  }, [currentCursor, cursorHistory, listLoading, loadPage, nextCursor, pageNumber])

  // Shelf roster: read once the panel is first opened, never while hidden — a
  // console the user has not looked at must not spawn CLI processes.
  useEffect(() => {
    if (!panel.open) return
    const abort = new AbortController()
    void getShelves(abort.signal)
      .then(({ shelves: roster }) => {
        if (abort.signal.aborted) return
        setShelves(roster)
        setShelfError('')
        // Prefer a connected default, then any connected shelf; a roster with
        // none connected leaves the current selection alone.
        const preferred = roster.find(entry => entry.name === DEFAULT_SHELF && entry.connected)
          ?? roster.find(entry => entry.connected)
        if (preferred !== undefined) setShelf(preferred.name)
      })
      .catch((error: unknown) => {
        if (abort.signal.aborted) return
        setShelfError(t('shelves.unavailable', { reason: error instanceof Error ? error.message : '' }))
      })
    return () => { abort.abort() }
  }, [panel.open])

  useEffect(() => {
    if (!activated.current) return
    refresh()
  }, [refresh, panel.open])

  useEffect(() => () => { listController.current?.abort() }, [])

  const availableScopes = useMemo(() => {
    const values = new Set<string>()
    let hasGlobal = false
    for (const item of items) {
      for (const itemScope of item.content.scopes) {
        if (itemScope === '') hasGlobal = true
        else values.add(itemScope)
      }
    }
    return { values: [...values].sort((left, right) => left.localeCompare(right)), hasGlobal }
  }, [items])

  // Read in page order and filtered through the rows actually on screen, so
  // a name the page no longer carries cannot reach the delete request.
  const selectedNames = useMemo(
    () => items.filter(item => selection.has(item.name)).map(item => item.name),
    [items, selection],
  )
  const allSelected = items.length > 0 && selectedNames.length === items.length

  const toggleRow = useCallback((name: string): void => {
    setSelection(current => {
      const next = new Set(current)
      if (!next.delete(name)) next.add(name)
      return next
    })
  }, [])

  const toggleAll = useCallback((): void => {
    setSelection(current => (
      current.size === items.length && items.length > 0 ? new Set() : new Set(items.map(item => item.name))
    ))
  }, [items])

  const openImpact = useCallback(async (name: string): Promise<void> => {
    setSelectedName(name)
    setImpactLoading(true)
    setNotice(null)
    const requestId = ++inspectRequest.current
    try {
      const next = await getImpact(shelf, name)
      if (requestId === inspectRequest.current) setImpact(next)
    } catch (error: unknown) {
      if (requestId !== inspectRequest.current) return
      setImpact(null)
      setNotice({ tone: 'error', text: error instanceof Error ? error.message : t('inspector.failed') })
    } finally {
      if (requestId === inspectRequest.current) setImpactLoading(false)
    }
  }, [shelf])

  const openGraph = useCallback((name: string): void => {
    setView('graph')
    setSelectedName(name)
    setImpact(null)
    setGraphFocus(current => {
      // Only a real change pushes history, so repeatedly focusing the node
      // already centered cannot stack duplicate Back steps.
      if (current !== null && current !== name) setFocusHistory(history => [...history, current])
      return name
    })
  }, [])

  const goBackFocus = useCallback((): void => {
    setFocusHistory(history => {
      const previous = history.at(-1)
      if (previous === undefined) return history
      setGraphFocus(previous)
      setSelectedName(previous)
      return history.slice(0, -1)
    })
  }, [])

  const selectShelf = useCallback((name: string): void => {
    setShelf(name)
    setSelection(new Set())
    setSelectedName(null)
    setImpact(null)
    setGraphFocus(null)
    setFocusHistory([])
  }, [])

  function submitSearch(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault()
    setSelectedName(null)
    setImpact(null)
    setFilters({ q: queryInput.trim(), tag: tagInput.trim(), scope: scopeInput })
  }

  function resetSearch(): void {
    setQueryInput('')
    setTagInput('')
    setScopeInput('')
    setFilters(NO_FILTERS)
    setSelectedName(null)
    setImpact(null)
  }

  async function confirmDelete(deleteRelations: boolean, acknowledgedName: string): Promise<void> {
    if (deleteTarget === null) return
    const result = await deleteKnowledge(shelf, deleteTarget.knowledge.name, deleteRelations, acknowledgedName)
    setDeleteTarget(null)
    setSelectedName(null)
    setImpact(null)
    setNotice({
      tone: 'success',
      text: result.deletedRelations > 0
        ? t('delete.done.cascade', { name: result.name, count: result.deletedRelations })
        : t('delete.done.retained', { name: result.name, count: result.retainedRelations }),
    })
    refresh()
  }

  async function confirmBatchDelete(deleteRelations: boolean, acknowledgedCount: number): Promise<void> {
    if (batchTarget === null) return
    const result = await deleteKnowledgeBatch(shelf, batchTarget, deleteRelations, acknowledgedCount)
    setBatchTarget(null)
    setSelectedName(null)
    setImpact(null)
    // A batch that ran is reported even when parts of it did not: the counts
    // are what happened, and a failure turns the notice into an error one.
    const summary = t('batch.done', {
      count: result.deletedCount,
      deleted: result.deletedRelations,
      retained: result.retainedRelations,
    })
    const issues = result.missingCount + result.failedCount > 0
      ? ` ${t('batch.done.issues', { missing: result.missingCount, failed: result.failedCount })}`
      : ''
    setNotice({ tone: result.failedCount > 0 ? 'error' : 'success', text: summary + issues })
    refresh()
  }

  const connectedCount = shelves.filter(entry => entry.connected).length

  return (
    <div className="dshhy-shell">
      <aside className="dshhy-shelves" aria-label={t('shelves.title')}>
        <div className="dshhy-kicker"><span>{t('shelves.title')}</span><span>{connectedCount}</span></div>
        <div className="dshhy-shelf-list">
          {shelves.length === 0
            ? <p className="dshhy-sidebar-empty">{shelfError !== '' ? shelfError : t('shelves.empty')}</p>
            : shelves.map(entry => (
              <button
                key={entry.name}
                className="dshhy-shelf"
                type="button"
                aria-pressed={entry.name === shelf}
                disabled={!entry.connected}
                onClick={() => { selectShelf(entry.name) }}
              >
                <span className="dshhy-shelf-dot" aria-hidden="true" />
                <span className="dshhy-shelf-name">{entry.name}</span>
                <span className="dshhy-shelf-state">
                  {entry.connected ? t('shelves.live') : t('shelves.offline')}
                </span>
              </button>
            ))}
        </div>
      </aside>

      <main className="dshhy-workspace">
        <header className="dshhy-header">
          <div>
            <p className="dshhy-eyebrow">{t('subtitle', { shelf })}</p>
            <h2>{t('title')}</h2>
          </div>
          <div className="dshhy-header-actions">
            <div className="dshhy-tabs" role="tablist" aria-label={t('title')}>
              <button
                className="dshhy-tab" type="button" role="tab"
                aria-selected={view === 'records'}
                onClick={() => { setView('records') }}
              >
                <IconArchiveOutline20 size={14} /> {t('view.records')}
              </button>
              <button
                className="dshhy-tab" type="button" role="tab"
                aria-selected={view === 'graph'}
                onClick={() => { setView('graph') }}
              >
                <IconBranchOutline16 size={14} /> {t('view.graph')}
              </button>
            </div>
            <button
              className="dshhy-icon-button" type="button"
              title={t('refresh')} aria-label={t('refresh')}
              onClick={refresh} disabled={listLoading}
            >
              <IconRefreshOutline16 size={16} className={listLoading ? 'dshhy-spin' : ''} />
            </button>
            <button
              className="dshhy-icon-button" type="button"
              title={t('close')} aria-label={t('close')}
              onClick={() => { controller.close() }}
            >
              <IconCloseOutline16 size={16} />
            </button>
          </div>
        </header>

        <section className="dshhy-search" aria-label={t('search.aria')}>
          <form onSubmit={submitSearch}>
            <label className="dshhy-field">
              <IconSearchOutline16 size={16} />
              <input
                value={queryInput}
                onChange={event => { setQueryInput(event.target.value) }}
                placeholder={t('search.placeholder')}
                aria-label={t('search.aria')}
              />
            </label>
            <label className="dshhy-compact">
              <span>{t('search.tag')}</span>
              <input
                value={tagInput}
                onChange={event => { setTagInput(event.target.value) }}
                placeholder={t('search.tag.any')}
              />
            </label>
            <label className="dshhy-compact">
              <span>{t('search.scope')}</span>
              <select value={scopeInput} onChange={event => { setScopeInput(event.target.value) }}>
                <option value="">{t('search.scope.any')}</option>
                {availableScopes.hasGlobal
                  ? <option value={GLOBAL_SCOPE_TOKEN}>{t('search.scope.global')}</option>
                  : null}
                {availableScopes.values.map(value => <option key={value} value={value}>{value}</option>)}
              </select>
            </label>
            <button className="dshhy-button" type="submit">
              <IconSearchOutline16 size={14} /> {t('search.submit')}
            </button>
            <button className="dshhy-text-button" type="button" onClick={resetSearch}>{t('search.reset')}</button>
          </form>
          <div className="dshhy-summary">
            <span>{listLoading && items.length === 0 ? t('list.page.loading') : t('list.page', { page: pageNumber })}</span>
            <div className="dshhy-pager">
              <span className="dshhy-page-count" aria-live="polite">{t('list.count', { count: items.length })}</span>
              <button
                className="dshhy-icon-button" type="button"
                title={t('list.previous')} aria-label={t('list.previous')}
                onClick={previousPage} disabled={listLoading || cursorHistory.length === 0}
              >
                <IconChevronLeftOutline14 size={14} />
              </button>
              <button
                className="dshhy-icon-button" type="button"
                title={t('list.next')} aria-label={t('list.next')}
                onClick={nextPage} disabled={listLoading || nextCursor === null}
              >
                <IconChevronRightOutline14 size={14} />
              </button>
            </div>
          </div>
        </section>

        {notice !== null ? (
          <div className={`dshhy-notice dshhy-notice-${notice.tone}`} role="status">
            <span>{notice.text}</span>
            <button type="button" onClick={() => { setNotice(null) }} aria-label={t('notice.dismiss')}>
              <IconCloseOutline16 size={14} />
            </button>
          </div>
        ) : null}

        {view === 'records' && selectedNames.length > 0 ? (
          <div className="dshhy-selection" role="group" aria-label={t('select.count', { count: selectedNames.length })}>
            <span className="dshhy-selection-count">{t('select.count', { count: selectedNames.length })}</span>
            <button
              type="button" className="dshhy-text-button"
              onClick={() => { setSelection(new Set()) }}
            >
              {t('select.clear')}
            </button>
            <button
              type="button" className="dshhy-button dshhy-danger"
              onClick={() => { setBatchTarget(selectedNames) }}
            >
              <IconTrashOutline16 size={14} /> {t('select.delete')}
            </button>
          </div>
        ) : null}

        {view === 'records' ? (
          <section className="dshhy-records">
            <div ref={listPanelRef} className="dshhy-list">
              <div className="dshhy-thead">
                <label className="dshhy-select">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    disabled={items.length === 0}
                    // Partially selected pages read as such to assistive tech;
                    // `indeterminate` is a property, not an attribute.
                    ref={node => {
                      if (node !== null) node.indeterminate = selectedNames.length > 0 && !allSelected
                    }}
                    onChange={toggleAll}
                    aria-label={t('select.all')}
                    title={t('select.all')}
                  />
                </label>
                <span className="dshhy-thead-cells">
                  <span>{t('list.column.entry')}</span>
                  <span>{t('list.column.context')}</span>
                  <span>{t('list.column.created')}</span>
                </span>
              </div>
              {listError !== '' && items.length === 0 ? (
                <div className="dshhy-blank dshhy-error">
                  <IconDatabaseOutline16 size={22} /><p>{listError}</p>
                </div>
              ) : null}
              {listError === '' && listLoading && items.length === 0 ? (
                <div className="dshhy-blank">
                  <IconLoadingOutline16 size={22} className="dshhy-spin" /><p>{t('list.loading')}</p>
                </div>
              ) : null}
              {listError === '' && !listLoading && items.length === 0 ? (
                <div className="dshhy-blank">
                  <IconDatabaseOutline16 size={22} /><p>{t('list.empty')}</p>
                </div>
              ) : null}
              {items.map(item => (
                <div
                  key={item.name} className="dshhy-row-wrap"
                  data-current={selectedName === item.name}
                  data-selected={selection.has(item.name)}
                >
                  <label className="dshhy-select">
                    <input
                      type="checkbox"
                      checked={selection.has(item.name)}
                      onChange={() => { toggleRow(item.name) }}
                      aria-label={t('select.row', { name: item.name })}
                    />
                  </label>
                  <button
                    type="button" className="dshhy-row"
                    aria-current={selectedName === item.name}
                    onClick={() => { void openImpact(item.name) }}
                  >
                    <span className="dshhy-row-primary">
                      <strong>{item.name}</strong>
                      <small>{excerpt(item.content.data)}</small>
                    </span>
                    <span className="dshhy-row-context">
                      <span className="dshhy-chips-inline">
                        {item.content.tags.slice(0, 3).map(tag => (
                          <em key={tag} className="dshhy-chip dshhy-chip-tag">{tag}</em>
                        ))}
                      </span>
                      <span className="dshhy-chips-inline">
                        {item.content.scopes.slice(0, 2).map(itemScope => (
                          <i key={itemScope === '' ? '__global__' : itemScope} className="dshhy-chip dshhy-chip-scope">
                            {scopeLabel(itemScope)}
                          </i>
                        ))}
                      </span>
                    </span>
                    <time dateTime={item.createdAt}>{dateLabel(item.createdAt)}</time>
                  </button>
                </div>
              ))}
              {listError !== '' && items.length > 0 ? <p className="dshhy-inline-error">{listError}</p> : null}
            </div>

            <aside className="dshhy-inspector" aria-label={t('inspector.kicker')}>
              {impactLoading ? (
                <div className="dshhy-blank">
                  <IconLoadingOutline16 size={22} className="dshhy-spin" /><p>{t('inspector.loading')}</p>
                </div>
              ) : null}
              {!impactLoading && impact === null ? (
                <div className="dshhy-blank">
                  <IconBranchOutline16 size={26} />
                  <h3>{t('inspector.empty.title')}</h3>
                  <p>{t('inspector.empty.body')}</p>
                </div>
              ) : null}
              {!impactLoading && impact !== null ? (
                <Inspector
                  impact={impact}
                  onDelete={() => { setDeleteTarget(impact) }}
                  onOpenGraph={() => { openGraph(impact.knowledge.name) }}
                />
              ) : null}
            </aside>
          </section>
        ) : (
          <GraphWorkspace
            shelf={shelf}
            focusName={graphFocus ?? selectedName ?? items[0]?.name ?? null}
            canGoBack={focusHistory.length > 0}
            onGoBack={goBackFocus}
            onFocusChange={openGraph}
          />
        )}
      </main>

      {batchTarget !== null ? (
        <BatchDeleteDialog
          names={batchTarget}
          onCancel={() => { setBatchTarget(null) }}
          onConfirm={confirmBatchDelete}
          onFailed={message => { setNotice({ tone: 'error', text: message }) }}
        />
      ) : null}

      {deleteTarget !== null ? (
        <DeleteDialog
          impact={deleteTarget}
          onCancel={() => { setDeleteTarget(null) }}
          onConfirm={confirmDelete}
          onFailed={message => { setNotice({ tone: 'error', text: message }) }}
        />
      ) : null}
    </div>
  )
}
