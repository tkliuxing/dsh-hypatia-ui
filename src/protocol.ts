/**
 * Wire vocabulary shared by both halves.
 *
 * The Host spells these shapes when it answers a route; the browser spells
 * them when it reads one. Keeping the file free of Node and DOM imports lets
 * the browser bundle inline it (the client bundle may not import a Host
 * package) without dragging anything platform-specific across.
 *
 * The field names mirror `hypatia-archive`'s own API so a reader who knows
 * that console recognizes every payload; only the route prefix differs.
 *
 * @module @tkliuxing/dsh-hypatia-ui/protocol
 */

/** Route prefix this plugin claims on the DSH web server. */
export const HYPATIA_API_PREFIX = '/api/dsh-hypatia'

/** Shelf whose name the browser uses when the user picked none. */
export const DEFAULT_SHELF = 'default'

/** Largest page the list route serves, whatever the request asks for. */
export const MAX_PAGE_LIMIT = 100

/** Page size the list route serves when the request names none. */
export const DEFAULT_PAGE_LIMIT = 50

/** The scope filter value standing for the empty (global) scope. */
export const GLOBAL_SCOPE_TOKEN = '__global__'

/** The content envelope every knowledge record and statement carries. */
export interface KnowledgeContent {
  /** Stored body; rendered as Markdown when `format` says so. */
  data: string
  /** Storage format hint, e.g. `markdown`, `md`, `text`. */
  format: string
  /** Free-form labels attached to the record. */
  tags: string[]
  /** Scope names; the empty string is the global scope. */
  scopes: string[]
  /** Figure references carried alongside the body. */
  figures: string[]
}

/** One knowledge record as a shelf stores it. */
export interface Knowledge {
  /** Primary key within the shelf. */
  name: string
  content: KnowledgeContent
  /** ISO-8601 creation timestamp, or the empty string when absent. */
  createdAt: string
}

/** One RDF-style statement (triple) between two entities. */
export interface Statement {
  subject: string
  predicate: string
  object: string
  createdAt: string
  content: KnowledgeContent
}

/** A statement seen from one entity's point of view. */
export interface Relationship extends Statement {
  /** Which side of the triple the inspected entity occupies. */
  direction: 'incoming' | 'outgoing' | 'both'
}

/** One registered shelf. */
export interface Shelf {
  name: string
  path: string
  connected: boolean
}

/** One page of knowledge records plus its continuation token. */
export interface KnowledgePage {
  items: Knowledge[]
  /** Opaque cursor for the next page, or null at the end of the result set. */
  nextCursor: string | null
}

/** A record together with every statement that touches it. */
export interface Impact {
  knowledge: Knowledge
  relationships: Relationship[]
}

/** One node of the local graph map. */
export interface GraphNode {
  id: string
  name: string
  /** null for a dangling reference: a statement names it, no record stores it. */
  knowledge: Knowledge | null
}

/** One directed edge of the local graph map. */
export interface GraphEdge {
  id: string
  source: string
  target: string
  predicate: string
  createdAt: string
  content: KnowledgeContent
}

/** The local neighborhood around one focused entity. */
export interface GraphNodeResponse {
  focus: string
  nodes: GraphNode[]
  edges: GraphEdge[]
}

/** Health probe answer: the plugin is wired and the CLI responded. */
export interface HealthResponse {
  status: 'ready'
  /** `hypatia --version` output, trimmed. */
  version: string
}

/** Shelf-roster answer. */
export interface ShelvesResponse {
  shelves: Shelf[]
}

/** Largest number of records one batch deletion may carry. */
export const MAX_BATCH_DELETE = 50

/** Deletion receipt: what went, and what deliberately stayed. */
export interface DeleteResponse {
  name: string
  deletedRelations: number
  retainedRelations: number
}

/** The body a deletion request must carry. */
export interface DeleteRequest {
  /** Retyped record name; the Host refuses a mismatch. */
  acknowledgedName: string
  /** When true, the related statements go with the record. */
  deleteRelations: boolean
}

/** How one record fared inside a batch deletion. */
export type BatchDeleteStatus = 'deleted' | 'missing' | 'failed'

/** One record's line in a batch receipt. */
export interface BatchDeleteOutcome {
  name: string
  status: BatchDeleteStatus
  deletedRelations: number
  retainedRelations: number
  /** The Host's diagnosis when `status` is `failed`; the empty string otherwise. */
  error: string
}

/**
 * Batch receipt. A batch is reported per record rather than as one verdict:
 * a name that had already gone, and a name whose removal failed, each leave
 * the rest of the batch alone and show up here by name.
 */
export interface BatchDeleteResponse {
  outcomes: BatchDeleteOutcome[]
  deletedCount: number
  missingCount: number
  failedCount: number
  /** Distinct statements removed across the whole batch. */
  deletedRelations: number
  /** Distinct statements deliberately left behind across the whole batch. */
  retainedRelations: number
}

/** The body a batch deletion request must carry. */
export interface BatchDeleteRequest {
  /** Record names to remove; duplicates and empty names are dropped. */
  names: string[]
  /**
   * Retyped record count; the Host refuses a mismatch, the way the
   * single-record route refuses a mismatched name.
   */
  acknowledgedCount: number
  /** When true, the related statements go with the records. */
  deleteRelations: boolean
}

/** Error envelope every non-2xx answer carries. */
export interface ErrorResponse {
  error: string
}
