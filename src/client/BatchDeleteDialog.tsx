/**
 * Bulk deletion confirmation.
 *
 * The single-record dialog guards a click three ways: it previews the impact,
 * demands the record name retyped, and keeps cascading opt-in. A batch keeps
 * the second and third guard and trades the first, deliberately:
 *
 * - **The names are the preview.** Reading the impact of every selected
 *   record would mean three CLI invocations per record, serialized behind one
 *   store lock, before the dialog could even be drawn. So the dialog lists
 *   exactly what will go instead of counting what it touches, and the receipt
 *   the console shows afterwards reports the statement counts that actually
 *   happened.
 * - **The count is the retyped confirmation.** There is no single name to
 *   retype; the number of selected records plays that part, and the Host
 *   re-checks it against the deduplicated name list, so a caller that skips
 *   this dialog is refused the same way.
 *
 * The copy says plainly that a batch is not a transaction — records are
 * removed one at a time and a failure part-way through leaves the earlier
 * removals standing.
 *
 * @module @tkliuxing/dsh-hypatia-ui/client/BatchDeleteDialog
 */

import { useEffect, useRef, useState } from 'react'
import {
  IconCloseOutlineRegular, IconDatabaseOutlineRegular, IconLoadingOutlineRegular, IconTrashOutlineRegular,
} from '@deepseek-ai/dsh-client-ui-primitives'
import { Templated } from './DeleteDialog.tsx'
import { t } from './locales.ts'

/**
 * The bulk deletion dialog.
 * @param props - the selected record names, plus the console's outcome hooks.
 * @returns the dialog tree.
 */
export function BatchDeleteDialog({ names, onCancel, onConfirm, onFailed }: {
  names: string[]
  onCancel: () => void
  /** Resolves once the batch ran; rejects with the Host's message. */
  onConfirm: (deleteRelations: boolean, acknowledgedCount: number) => Promise<void>
  onFailed: (message: string) => void
}): React.JSX.Element {
  const [deleteRelations, setDeleteRelations] = useState(false)
  const [acknowledgedCount, setAcknowledgedCount] = useState('')
  const [deleting, setDeleting] = useState(false)
  const confirmRef = useRef<HTMLInputElement>(null)

  const total = names.length
  const confirmed = acknowledgedCount.trim() === String(total)

  useEffect(() => { confirmRef.current?.focus() }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape' && !deleting) onCancel()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => { document.removeEventListener('keydown', onKeyDown) }
  }, [deleting, onCancel])

  async function submit(): Promise<void> {
    if (!confirmed || deleting) return
    setDeleting(true)
    try {
      await onConfirm(deleteRelations, total)
    } catch (error: unknown) {
      // The dialog stays open on failure so the user can retry or cancel; a
      // batch that ran and merely lost some records resolves instead, and the
      // console reports those by name.
      onFailed(error instanceof Error ? error.message : t('batch.failed'))
      setDeleting(false)
    }
  }

  return (
    <div className="dshhy-backdrop" role="presentation">
      <section className="dshhy-dialog" role="dialog" aria-modal="true" aria-labelledby="dshhy-batch-title">
        <header>
          <div>
            <p className="dshhy-eyebrow">{t('batch.kicker')}</p>
            <h2 id="dshhy-batch-title">{t('batch.title')}</h2>
          </div>
          <button
            type="button" className="dshhy-icon-button"
            onClick={onCancel} disabled={deleting}
            aria-label={t('batch.close')} title={t('batch.close')}
          >
            <IconCloseOutlineRegular size={15} />
          </button>
        </header>

        <p className="dshhy-dialog-copy">
          <Templated messageKey="batch.body" value={String(total)} as="strong" placeholder="{count}" />
        </p>
        <div className="dshhy-impact">
          <IconDatabaseOutlineRegular size={15} />
          <span>{t('batch.list')}</span>
        </div>
        <ul className="dshhy-name-list">
          {names.map(name => <li key={name}>{name}</li>)}
        </ul>
        <label className="dshhy-check">
          <input
            type="checkbox" checked={deleteRelations} disabled={deleting}
            onChange={event => { setDeleteRelations(event.target.checked) }}
          />
          <span>{t('batch.cascade')}</span>
        </label>
        <label className="dshhy-confirm">
          <span>
            <Templated messageKey="batch.confirm.label" value={String(total)} as="code" placeholder="{count}" />
          </span>
          <input
            ref={confirmRef}
            value={acknowledgedCount}
            onChange={event => { setAcknowledgedCount(event.target.value) }}
            onKeyDown={event => { if (event.key === 'Enter') void submit() }}
            inputMode="numeric" autoComplete="off" spellCheck="false"
          />
        </label>

        <footer>
          <button type="button" className="dshhy-text-button" onClick={onCancel} disabled={deleting}>
            {t('batch.cancel')}
          </button>
          <button
            type="button" className="dshhy-button dshhy-danger"
            onClick={() => { void submit() }} disabled={deleting || !confirmed}
          >
            {deleting
              ? <IconLoadingOutlineRegular size={14} className="dshhy-spin" />
              : <IconTrashOutlineRegular size={14} />}
            {t('batch.submit')}
          </button>
        </footer>
      </section>
    </div>
  )
}
