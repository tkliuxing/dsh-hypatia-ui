/**
 * Surface copy for the console, in the two locales DSH ships.
 *
 * The zh dictionary is the key-set source of truth; `en` is checked complete
 * against it at compile time, so a key added in one language and forgotten in
 * the other fails the build instead of rendering a raw key at runtime.
 *
 * Plain-DOM callers (the sidebar row) read through {@link t}, which resolves
 * against the live locale service once {@link setRuntimeTranslate} has wired
 * it — so a Language switch re-labels the row without a reload. Before the
 * service arrives, and in tests, the document language decides.
 *
 * @module @tkliuxing/dsh-hypatia-ui/client/locales
 */

/** Locale namespace this plugin owns. */
export const NS = 'dsh-hypatia-ui'

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh = {
  'entry.label': 'Hypatia 知识库',
  'entry.tooltip': 'Hypatia 知识库控制台',

  'title': '知识库维护',
  'subtitle': 'Shelf / {shelf}',
  'close': '关闭知识库',
  'refresh': '重新载入',

  'shelves.title': '书架',
  'shelves.empty': '没有已连接的书架',
  'shelves.live': '在线',
  'shelves.offline': '离线',
  'shelves.unavailable': '无法读取书架列表：{reason}',

  'view.records': '条目',
  'view.graph': '图谱',

  'search.placeholder': '搜索名称、内容、标签与同义词',
  'search.aria': '搜索知识条目',
  'search.submit': '搜索',
  'search.reset': '重置',
  'search.tag': '标签',
  'search.tag.any': '任意标签',
  'search.scope': '作用域',
  'search.scope.any': '任意作用域',
  'search.scope.global': '全局',

  'list.column.entry': '条目',
  'list.column.context': '上下文',
  'list.column.created': '创建时间',
  'list.loading': '正在载入知识条目',
  'list.empty': '当前视图没有匹配的知识条目',
  'list.excerpt.empty': '无内容',
  'list.page': '第 {page} 页',
  'list.page.loading': '正在载入',
  'list.count': '{count} 条',
  'list.previous': '上一页',
  'list.next': '下一页',
  'list.failed': '无法载入知识条目。',

  'inspector.empty.title': '查看知识条目',
  'inspector.empty.body': '选择一个条目即可阅读完整内容，并在清理前确认它的每一条直接关系。',
  'inspector.loading': '正在读取条目与关系',
  'inspector.kicker': '知识条目',
  'inspector.openGraph': '在图谱中打开',
  'inspector.delete': '删除该知识条目',
  'inspector.tags': '标签',
  'inspector.scopes': '作用域',
  'inspector.tags.none': '无',
  'inspector.scopes.none': '未设置作用域',
  'inspector.relationships': '直接关系',
  'inspector.relationships.none': '没有任何进入或发出的 statement。',
  'inspector.content.empty': '没有存储内容。',
  'inspector.copy': '复制',
  'inspector.copied': '已复制',
  'inspector.footnotes': '脚注',
  'inspector.failed': '无法读取该条目。',

  'direction.incoming': '进入',
  'direction.outgoing': '发出',
  'direction.both': '双向',

  'graph.kicker.knowledge': '知识条目',
  'graph.kicker.reference': '图谱引用',
  'graph.statement': '图谱 statement',
  'graph.nodes': '{count} 个节点',
  'graph.edges': '{count} 条边',
  'graph.fit': '缩放至完整图谱',
  'graph.reload': '重新载入焦点节点',
  'graph.blank': '选择一个知识条目以展开它的直接关系。',
  'graph.loading': '正在载入图谱关系',
  'graph.limit': '已达到图谱显示上限。聚焦某个节点以继续探索。',
  'graph.focusBadge': '焦点',
  'graph.back': '返回上一个焦点',
  'graph.focus': '聚焦此节点',
  'graph.expand': '载入关系',
  'graph.expanded': '关系已载入',
  'graph.reference.body': '仍有 statement 引用这个实体，但当前书架里没有对应的知识条目。',
  'graph.inspector.empty.title': '查看图谱',
  'graph.inspector.empty.body': '选择一个节点或一条关系即可查看详情。',
  'graph.content.empty': '没有 statement 内容。',
  'graph.failed': '无法载入图谱关系。',

  'delete.kicker': '破坏性操作',
  'delete.title': '删除知识条目',
  'delete.close': '关闭删除对话框',
  'delete.body': '这会把 {name} 从当前书架移除。Hypatia 不会级联删除图谱 statement。',
  'delete.impact': '找到 {count} 条直接关系',
  'delete.cascade': '同时删除这些相关 statement',
  'delete.confirm.label': '键入 {name} 以确认',
  'delete.cancel': '取消',
  'delete.submit': '删除条目',
  'delete.done.cascade': '已删除 {name} 及 {count} 条相关 statement。',
  'delete.done.retained': '已删除 {name}，保留 {count} 条相关 statement。',
  'delete.failed': '删除失败。',

  'notice.dismiss': '关闭提示',
} satisfies Record<string, string>

/** The namespace key union. */
export type HypatiaKey = keyof typeof zh

/** English dictionary, checked complete against the zh key set. */
export const en = {
  'entry.label': 'Hypatia Knowledge',
  'entry.tooltip': 'Hypatia knowledge console',

  'title': 'Knowledge maintenance',
  'subtitle': 'Shelf / {shelf}',
  'close': 'Close the knowledge console',
  'refresh': 'Reload',

  'shelves.title': 'Shelves',
  'shelves.empty': 'No connected shelves',
  'shelves.live': 'live',
  'shelves.offline': 'offline',
  'shelves.unavailable': 'Unable to load shelves: {reason}',

  'view.records': 'Records',
  'view.graph': 'Graph',

  'search.placeholder': 'Search names, content, tags, and synonyms',
  'search.aria': 'Search knowledge',
  'search.submit': 'Search',
  'search.reset': 'Reset',
  'search.tag': 'Tag',
  'search.tag.any': 'Any tag',
  'search.scope': 'Scope',
  'search.scope.any': 'Any scope',
  'search.scope.global': 'global',

  'list.column.entry': 'Entry',
  'list.column.context': 'Context',
  'list.column.created': 'Created',
  'list.loading': 'Loading knowledge records',
  'list.empty': 'No knowledge matches this view',
  'list.excerpt.empty': 'No content',
  'list.page': 'Page {page}',
  'list.page.loading': 'Loading page',
  'list.count': '{count} records',
  'list.previous': 'Previous page',
  'list.next': 'Next page',
  'list.failed': 'Unable to load knowledge.',

  'inspector.empty.title': 'Inspect the graph',
  'inspector.empty.body': 'Select a knowledge entry to read its full content and check every direct relationship before cleaning it.',
  'inspector.loading': 'Reading entry and relations',
  'inspector.kicker': 'KNOWLEDGE RECORD',
  'inspector.openGraph': 'Open in graph',
  'inspector.delete': 'Delete this knowledge entry',
  'inspector.tags': 'Tags',
  'inspector.scopes': 'Scopes',
  'inspector.tags.none': 'None',
  'inspector.scopes.none': 'Unscoped',
  'inspector.relationships': 'Direct relationships',
  'inspector.relationships.none': 'No direct incoming or outgoing statements.',
  'inspector.content.empty': 'No stored content.',
  'inspector.copy': 'Copy',
  'inspector.copied': 'Copied',
  'inspector.footnotes': 'Footnotes',
  'inspector.failed': 'Unable to inspect this entry.',

  'direction.incoming': 'incoming',
  'direction.outgoing': 'outgoing',
  'direction.both': 'self-referential',

  'graph.kicker.knowledge': 'KNOWLEDGE RECORD',
  'graph.kicker.reference': 'GRAPH REFERENCE',
  'graph.statement': 'GRAPH STATEMENT',
  'graph.nodes': '{count} nodes',
  'graph.edges': '{count} edges',
  'graph.fit': 'Fit graph to view',
  'graph.reload': 'Reload focused node',
  'graph.blank': 'Select a knowledge record to map its direct relationships.',
  'graph.loading': 'Loading graph relationships',
  'graph.limit': 'Graph display limit reached. Focus a node to continue exploring.',
  'graph.focusBadge': 'focus',
  'graph.back': 'Back to the previous focus',
  'graph.focus': 'Focus map',
  'graph.expand': 'Load relations',
  'graph.expanded': 'Relations loaded',
  'graph.reference.body': 'This entity is still referenced by a statement, but does not have a knowledge record in this shelf.',
  'graph.inspector.empty.title': 'Inspect the graph',
  'graph.inspector.empty.body': 'Select a node or relationship to inspect it.',
  'graph.content.empty': 'No statement content.',
  'graph.failed': 'Unable to load graph relationships.',

  'delete.kicker': 'DESTRUCTIVE ACTION',
  'delete.title': 'Delete knowledge entry',
  'delete.close': 'Close delete dialog',
  'delete.body': 'This removes {name} from the selected shelf. Hypatia does not cascade-delete graph statements.',
  'delete.impact': '{count} direct relationship(s) found',
  'delete.cascade': 'Also delete these related statements',
  'delete.confirm.label': 'Type {name} to confirm',
  'delete.cancel': 'Cancel',
  'delete.submit': 'Delete entry',
  'delete.done.cascade': 'Deleted {name} and {count} related statement(s).',
  'delete.done.retained': 'Deleted {name}. {count} related statement(s) remain.',
  'delete.failed': 'Delete operation failed.',

  'notice.dismiss': 'Dismiss message',
} satisfies Record<HypatiaKey, string>

/** The translate shape the locale service hands back from `bind`. */
type TranslateFn = (key: HypatiaKey, params?: Record<string, string | number>) => string

let runtimeTranslate: TranslateFn | undefined

/**
 * Wire the live locale service into {@link t}.
 * @param translate - the bound translate function for this namespace.
 */
export function setRuntimeTranslate(translate: TranslateFn): void {
  runtimeTranslate = translate
}

/** Drop the live translate (plugin unload), returning {@link t} to fallback. */
export function clearRuntimeTranslate(): void {
  runtimeTranslate = undefined
}

function interpolate(text: string, params?: Record<string, string | number>): string {
  if (params === undefined) return text
  return text.replace(/\{(\w+)\}/g, (match, key: string) => {
    const value = params[key]
    return value === undefined ? match : String(value)
  })
}

/**
 * Translate one key.
 * @param key - a key of this namespace.
 * @param params - `{name}`-style substitutions.
 * @returns the live translation when the locale service is wired; otherwise
 *   the document-language fallback (zh for a `zh*` document, else English).
 */
export function t(key: HypatiaKey, params?: Record<string, string | number>): string {
  if (runtimeTranslate !== undefined) return runtimeTranslate(key, params)
  const documentLanguage = typeof document === 'undefined' ? '' : document.documentElement.lang
  const dictionary = documentLanguage.toLowerCase().startsWith('zh') ? zh : en
  return interpolate(dictionary[key], params)
}
