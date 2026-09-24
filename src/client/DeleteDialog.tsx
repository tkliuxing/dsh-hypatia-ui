/**
 * Deletion confirmation.
 *
 * Three guards stand between a click and a removed record, and all three are
 * load-bearing rather than decorative:
 *
 * 1. The impact is shown first — how many statements touch this record.
 * 2. The exact name must be retyped; the submit button stays disabled until
 *    it matches, and the Host re-checks the same equality, so a caller that
 *    bypasses this dialog is refused too.
 * 3. Cascading is opt-in. Left unchecked, the statements survive, which is
 *    Hypatia's own `knowledge-delete` behavior.
 *
 * The dialog renders inside the console's container, not a portal to `body`:
 * the console is one column of the shell, and a body-level overlay would
 * darken the sidebar and header the user can still reach.
 *
 * @module @tkliuxing/dsh-hypatia-ui/client/DeleteDialog
 */

import { useEffect, useRef, useState } from 'react'
import {
  IconBranchOutlineRegular, IconCloseOutlineRegular, IconLoadingOutlineRegular, IconTrashOutlineRegular,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { Impact } from '../protocol.ts'
import { t, type HypatiaKey } from './locales.ts'

/**
 * Render a template around one placeholder, wrapping the value in an element
 * instead of splicing it into the string. Reading the template uninterpolated
 * (no params) keeps the placeholder intact, so the emphasis lands wherever
 * each language puts the value — the zh and en sentences order it differently.
 * @param props - the message key, the value, the wrapper to emphasize it
 *   with, and the placeholder to replace (`{name}` unless given).
 * @returns the sentence with the value emphasized in place.
 */
export function Templated({ messageKey, value, as: Wrapper, placeholder = '{name}' }: {
  messageKey: HypatiaKey
  value: string
  as: 'strong' | 'code'
  placeholder?: string
}): React.JSX.Element {
  const [before = '', after = ''] = t(messageKey).split(placeholder)
  return <>{before}<Wrapper>{value}</Wrapper>{after}</>
}

/**
 * The deletion dialog.
 * @param props - the record and its impact, plus the console's outcome hooks.
 * @returns the dialog tree.
 */
export function DeleteDialog({ impact, onCancel, onConfirm, onFailed }: {
  impact: Impact
  onCancel: () => void
  /** Resolves once the deletion succeeded; rejects with the Host's message. */
  onConfirm: (deleteRelations: boolean, acknowledgedName: string) => Promise<void>
  onFailed: (message: string) => void
}): React.JSX.Element {
  const [deleteRelations, setDeleteRelations] = useState(false)
  const [acknowledgedName, setAcknowledgedName] = useState('')
  const [deleting, setDeleting] = useState(false)
  const confirmRef = useRef<HTMLInputElement>(null)

  const name = impact.knowledge.name
  const confirmed = acknowledgedName === name

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
      await onConfirm(deleteRelations, acknowledgedName)
    } catch (error: unknown) {
      // The dialog stays open on failure so the user can retry or cancel; the
      // console shows the Host's own diagnosis above the content.
      onFailed(error instanceof Error ? error.message : t('delete.failed'))
      setDeleting(false)
    }
  }

  return (
    <div className="dshhy-backdrop" role="presentation">
      <section className="dshhy-dialog" role="dialog" aria-modal="true" aria-labelledby="dshhy-delete-title">
        <header>
          <div>
            <p className="dshhy-eyebrow">{t('delete.kicker')}</p>
            <h2 id="dshhy-delete-title">{t('delete.title')}</h2>
          </div>
          <button
            type="button" className="dshhy-icon-button"
            onClick={onCancel} disabled={deleting}
            aria-label={t('delete.close')} title={t('delete.close')}
          >
            <IconCloseOutlineRegular size={15} />
          </button>
        </header>

        <p className="dshhy-dialog-copy">
          <Templated messageKey="delete.body" value={name} as="strong" />
        </p>
        <div className="dshhy-impact">
          <IconBranchOutlineRegular size={15} />
          <span>{t('delete.impact', { count: impact.relationships.length })}</span>
        </div>
        <label className="dshhy-check">
          <input
            type="checkbox" checked={deleteRelations} disabled={deleting}
            onChange={event => { setDeleteRelations(event.target.checked) }}
          />
          <span>{t('delete.cascade')}</span>
        </label>
        <label className="dshhy-confirm">
          <span><Templated messageKey="delete.confirm.label" value={name} as="code" /></span>
          <input
            ref={confirmRef}
            value={acknowledgedName}
            onChange={event => { setAcknowledgedName(event.target.value) }}
            onKeyDown={event => { if (event.key === 'Enter') void submit() }}
            autoComplete="off" spellCheck="false"
          />
        </label>

        <footer>
          <button type="button" className="dshhy-text-button" onClick={onCancel} disabled={deleting}>
            {t('delete.cancel')}
          </button>
          <button
            type="button" className="dshhy-button dshhy-danger"
            onClick={() => { void submit() }} disabled={deleting || !confirmed}
          >
            {deleting
              ? <IconLoadingOutlineRegular size={14} className="dshhy-spin" />
              : <IconTrashOutlineRegular size={14} />}
            {t('delete.submit')}
          </button>
        </footer>
      </section>
    </div>
  )
}
