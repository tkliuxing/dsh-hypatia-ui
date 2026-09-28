/**
 * The record inspector: full content, metadata, and every direct statement.
 *
 * This is the surface a user reads *before* deleting, so it shows the whole
 * relationship set rather than a summary — the count in the header is the same
 * number the deletion dialog will quote.
 *
 * @module @tkliuxing/dsh-hypatia-ui/client/Inspector
 */

import type { Impact, Relationship } from '../protocol.ts'
import { Content } from './Content.tsx'
import { dateLabel, scopeLabel } from './format.ts'
import { ArrowUpRightIcon, BranchIcon, DatabaseIcon, TagIcon, TrashIcon } from './icons.tsx'
import { useTranslate } from './locale-context.tsx'

/**
 * Render one relationship as the triple it is, read from the inspected
 * entity's side.
 * @param relationship - the statement.
 * @returns the one-line label.
 */
export function directionLabel(relationship: Relationship): string {
  if (relationship.direction === 'outgoing') return `${relationship.predicate} → ${relationship.object}`
  if (relationship.direction === 'incoming') return `${relationship.subject} → ${relationship.predicate}`
  return `${relationship.subject} ↔ ${relationship.object}`
}

/**
 * The record inspector.
 * @param props - the record with its relationships, plus the two actions the
 *   console owns (open in graph, start deletion).
 * @returns the inspector tree.
 */
export function Inspector({ impact, onDelete, onOpenGraph }: {
  impact: Impact
  onDelete: () => void
  onOpenGraph: () => void
}): React.JSX.Element {
  const t = useTranslate()
  const { knowledge, relationships } = impact
  return (
    <>
      <div className="dshhy-inspector-head">
        <div>
          <p className="dshhy-eyebrow">{t('inspector.kicker')}</p>
          <h3>{knowledge.name}</h3>
        </div>
        <div className="dshhy-inspector-actions">
          <button
            type="button" className="dshhy-icon-button"
            onClick={onOpenGraph} title={t('inspector.openGraph')} aria-label={t('inspector.openGraph')}
          >
            <BranchIcon size={15} />
          </button>
          <button
            type="button" className="dshhy-icon-button dshhy-danger"
            onClick={onDelete} title={t('inspector.delete')} aria-label={t('inspector.delete')}
          >
            <TrashIcon size={15} />
          </button>
        </div>
      </div>

      <div className="dshhy-meta">
        <span>{knowledge.content.format}</span>
        <span>{dateLabel(knowledge.createdAt)}</span>
      </div>

      <Content content={knowledge.content} emptyMessage={t('inspector.content.empty')} />

      <div className="dshhy-meta-groups">
        <div>
          <p><TagIcon size={13} /> {t('inspector.tags')}</p>
          <div className="dshhy-chip-wrap">
            {knowledge.content.tags.length > 0
              ? knowledge.content.tags.map(tag => (
                <span className="dshhy-chip dshhy-chip-tag" key={tag}>{tag}</span>
              ))
              : <span className="dshhy-muted">{t('inspector.tags.none')}</span>}
          </div>
        </div>
        <div>
          <p><DatabaseIcon size={13} /> {t('inspector.scopes')}</p>
          <div className="dshhy-chip-wrap">
            {knowledge.content.scopes.length > 0
              ? knowledge.content.scopes.map(scope => (
                <span className="dshhy-chip dshhy-chip-scope" key={scope === '' ? '__global__' : scope}>
                  {scopeLabel(scope, t)}
                </span>
              ))
              : <span className="dshhy-muted">{t('inspector.scopes.none')}</span>}
          </div>
        </div>
      </div>

      <div className="dshhy-relations-head">
        <span><BranchIcon size={14} /> {t('inspector.relationships')}</span>
        <b>{relationships.length}</b>
      </div>
      <div className="dshhy-relations">
        {relationships.length === 0
          ? <p className="dshhy-muted">{t('inspector.relationships.none')}</p>
          : relationships.map(relationship => (
            <div
              className="dshhy-relation"
              key={`${relationship.subject}\u0000${relationship.predicate}\u0000${relationship.object}`}
            >
              <span className="dshhy-relation-dir" data-direction={relationship.direction}>
                {relationship.direction === 'incoming'
                  ? <ArrowUpRightIcon size={13} className="dshhy-flip" />
                  : relationship.direction === 'outgoing'
                    ? <ArrowUpRightIcon size={13} />
                    : <BranchIcon size={13} />}
              </span>
              <div>
                <strong>{directionLabel(relationship)}</strong>
                <small>{t(`direction.${relationship.direction}`)}</small>
              </div>
            </div>
          ))}
      </div>
    </>
  )
}
