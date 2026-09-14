/**
 * The console's stylesheet, injected once as a plugin-owned `<style>` tag.
 *
 * Why a string rather than a CSS module: the repo-internal client build turns
 * `*.module.css` into a hashed class map through its own lightningcss virtual
 * loader, which an out-of-tree package cannot reproduce without copying that
 * pipeline. A hand-prefixed sheet needs no build machinery, and the `dshhy-`
 * prefix plus the `[data-dsh-hypatia-view]` root scope keep it from touching
 * anything else in the GUI.
 *
 * Every color rides a `--dsw-alias-*` theme token, so the console follows the
 * active DSH theme — light, dark, and installed skins alike — with no palette
 * of its own. Only the graph canvas grid and the cytoscape node colors are
 * literal, and those are read from the computed theme at paint time (see
 * `GraphView.tsx`).
 *
 * @module @tkliuxing/dsh-hypatia-ui/client/styles
 */

/** Attribute marking the injected sidebar row. */
export const ENTRY_ATTRIBUTE = 'data-dsh-hypatia-entry'

/** Selector matching the injected sidebar row. */
export const ENTRY_SELECTOR = `[${ENTRY_ATTRIBUTE}]`

/** Attribute marking the center-column container. */
export const VIEW_ATTRIBUTE = 'data-dsh-hypatia-view'

/** Selector matching the center-column container. */
export const VIEW_SELECTOR = `[${VIEW_ATTRIBUTE}]`

/** Attribute set on `<html>` while the console occupies the center column. */
export const ACTIVE_ATTRIBUTE = 'data-dsh-hypatia-active'

/** Identifier of this plugin's injected style tag. */
const STYLE_TAG_ID = 'dsh-hypatia-ui'

/** Class names the components spell; kept beside the sheet that defines them. */
export const css = {
  entry: 'dshhy-entry',
  entryIcon: 'dshhy-entry-icon',
  entryLabel: 'dshhy-entry-label',
} as const

const STYLESHEET = `
/* ── center-column takeover ─────────────────────────────────────────────── */

/* The container rides inside the center column as an extra trailing child
   React never manages. Hidden unless the console is active. */
[data-pane='conversation'],
[class*='centerCol'] { position: relative; }

[${VIEW_ATTRIBUTE}] {
  position: absolute;
  inset: 0;
  display: none;
  z-index: 60;
  overflow: hidden;
  /* Anchors the @container queries at the bottom of this sheet, so the
     console reflows with the center column rather than the window. */
  container-name: dshhy-view;
  container-type: inline-size;
  /* Opaque backdrop: the conversation subtree stays mounted underneath, so a
     sticky element of the host's (code-block banners sit at z-index 6) must
     not show through even if the hide rule below were ever defeated. */
  background: var(--dsw-alias-bg-base);
  color: var(--dsw-alias-label-primary);
  font-size: 13px;
}

/* The :not() guards keep sibling center-column panels (task board, ssh) from
   fighting over visibility during the frame in which two activation
   attributes coexist. */
html[${ACTIVE_ATTRIBUTE}]:not([data-dsh-taskboard-active]):not([data-dsh-ssh-active]) [${VIEW_ATTRIBUTE}] {
  display: block;
}

/* While the console is active the conversation content underneath is hidden;
   it stays mounted and keeps its state. !important is required: the shell
   wraps the conversation view in a node carrying an inline display, and an
   inline style beats a plain stylesheet rule. */
html[${ACTIVE_ATTRIBUTE}]:not([data-dsh-taskboard-active]):not([data-dsh-ssh-active]) [data-pane='conversation'] > :not([${VIEW_ATTRIBUTE}]),
html[${ACTIVE_ATTRIBUTE}]:not([data-dsh-taskboard-active]):not([data-dsh-ssh-active]) [class*='centerCol'] > :not([${VIEW_ATTRIBUTE}]) {
  display: none !important;
}

/* ── sidebar entry row ──────────────────────────────────────────────────── */

.${css.entry} {
  box-sizing: border-box;
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  height: 36px;
  padding: 0 10px;
  background: transparent;
  border: none;
  border-radius: 8px;
  color: var(--dsw-alias-label-secondary);
  cursor: pointer;
  font: inherit;
  font-size: 13px;
  white-space: nowrap;
}
.${css.entry}:hover {
  background: var(--dsw-alias-interactive-bg-hover);
  color: var(--dsw-alias-label-primary);
}
.${css.entry}[data-active] {
  background: var(--dsw-alias-interactive-bg-active);
  color: var(--dsw-alias-label-primary);
  font-weight: 600;
}
.${css.entryIcon} {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  flex: none;
}
.${css.entryIcon} svg { display: block; }
.${css.entryLabel} { overflow: hidden; text-overflow: ellipsis; }

/* Collapsed sidebar: the shell keeps a 56px rail, so the row becomes its icon. */
[data-dsh-frame][data-sidebar-collapsed] .${css.entry},
[data-sidebar-collapsed] .${css.entry} {
  justify-content: center;
  padding: 0;
}
[data-dsh-frame][data-sidebar-collapsed] .${css.entryLabel},
[data-sidebar-collapsed] .${css.entryLabel} { display: none; }

/* ── console shell ──────────────────────────────────────────────────────── */

/* The element reset is wrapped in :where() so it contributes zero
   specificity. Written plainly, "[data-dsh-hypatia-view] button" (0-1-1)
   outranks every component class (0-1-0) and its "color: inherit" silently
   defeats each button's own color — which paints the primary button's label
   white on a white fill. */
:where([${VIEW_ATTRIBUTE}]) *,
:where([${VIEW_ATTRIBUTE}]) *::before,
:where([${VIEW_ATTRIBUTE}]) *::after { box-sizing: border-box; }

:where([${VIEW_ATTRIBUTE}]) :where(button, input, select) { font: inherit; color: inherit; }
:where([${VIEW_ATTRIBUTE}]) :where(button) { cursor: pointer; }
:where([${VIEW_ATTRIBUTE}]) :where(button:disabled) { cursor: not-allowed; opacity: 0.52; }

.dshhy-shell {
  display: grid;
  grid-template-columns: 208px minmax(0, 1fr);
  height: 100%;
  min-height: 0;
}

.dshhy-shelves {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-height: 0;
  padding: 18px 12px;
  border-right: 1px solid var(--dsw-alias-border-l1);
  background: var(--dsw-alias-bg-layer-1);
  overflow-y: auto;
}
.dshhy-kicker {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  padding: 0 6px;
  color: var(--dsw-alias-label-tertiary);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}
.dshhy-shelf-list { display: grid; gap: 2px; }
.dshhy-shelf {
  display: grid;
  grid-template-columns: 7px minmax(0, 1fr) auto;
  gap: 8px;
  align-items: center;
  width: 100%;
  padding: 8px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  text-align: left;
}
.dshhy-shelf:hover:not(:disabled) { background: var(--dsw-alias-interactive-bg-hover); }
.dshhy-shelf[aria-pressed='true'] {
  background: var(--dsw-alias-interactive-bg-active);
  color: var(--dsw-alias-label-primary);
  font-weight: 600;
}
.dshhy-shelf-dot {
  width: 7px; height: 7px; border-radius: 999px;
  background: var(--dsw-alias-state-success-primary);
}
.dshhy-shelf:disabled .dshhy-shelf-dot { background: var(--dsw-alias-label-dimmed); }
.dshhy-shelf-name { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13px; }
.dshhy-shelf-state { color: var(--dsw-alias-label-tertiary); font-size: 10px; }
.dshhy-sidebar-empty { padding: 0 6px; color: var(--dsw-alias-label-tertiary); font-size: 12px; }

.dshhy-workspace {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  padding: 16px 20px 18px;
  gap: 12px;
}

.dshhy-header { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.dshhy-eyebrow {
  margin: 0 0 3px;
  color: var(--dsw-alias-label-tertiary);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}
.dshhy-header h2 { margin: 0; color: var(--dsw-alias-label-primary); font-size: 20px; line-height: 1.2; }
.dshhy-header-actions { display: flex; align-items: center; gap: 8px; }

.dshhy-icon-button {
  width: 30px; height: 30px;
  display: inline-grid; place-items: center;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 6px;
  color: var(--dsw-alias-label-secondary);
  background: var(--dsw-alias-bg-layer-1);
}
.dshhy-icon-button:hover:not(:disabled) {
  color: var(--dsw-alias-label-primary);
  background: var(--dsw-alias-interactive-bg-hover);
}
.dshhy-icon-button.dshhy-danger { color: var(--dsw-alias-state-error-primary); }
.dshhy-icon-button.dshhy-danger:hover:not(:disabled) { background: var(--dsw-alias-interactive-bg-hover-danger); }

.dshhy-tabs {
  display: inline-flex; align-items: center; gap: 2px;
  padding: 2px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 7px;
  background: var(--dsw-alias-bg-layer-1);
}
.dshhy-tab {
  display: inline-flex; align-items: center; gap: 5px;
  min-height: 24px; padding: 0 10px;
  border: 0; border-radius: 5px;
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  font-size: 12px; font-weight: 600;
}
.dshhy-tab:hover { background: var(--dsw-alias-interactive-bg-hover); color: var(--dsw-alias-label-primary); }
.dshhy-tab[aria-selected='true'] {
  background: var(--dsw-alias-button-primary-fill);
  color: var(--dsw-alias-label-primary-inverted);
}

/* ── search band ────────────────────────────────────────────────────────── */

.dshhy-search {
  padding: 10px;
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 8px;
  background: var(--dsw-alias-bg-layer-1);
}
.dshhy-search form {
  display: grid;
  grid-template-columns: minmax(200px, 1fr) minmax(110px, 0.28fr) minmax(126px, 0.28fr) auto auto;
  gap: 8px;
}
.dshhy-field, .dshhy-compact {
  display: flex; align-items: center; gap: 8px;
  min-width: 0; min-height: 32px; padding: 0 10px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 6px;
  background: var(--dsw-alias-bg-base);
  color: var(--dsw-alias-label-tertiary);
}
.dshhy-field:focus-within, .dshhy-compact:focus-within { border-color: var(--dsw-alias-brand-primary); }
.dshhy-field input, .dshhy-compact input, .dshhy-compact select {
  min-width: 0; width: 100%;
  border: 0; outline: 0;
  background: transparent;
  color: var(--dsw-alias-label-primary);
  font-size: 13px;
}
.dshhy-compact > span { flex: none; color: var(--dsw-alias-label-tertiary); font-size: 11px; font-weight: 600; }

.dshhy-button {
  display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  min-height: 32px; padding: 0 13px;
  border: 1px solid transparent; border-radius: 6px;
  background: var(--dsw-alias-button-primary-fill);
  color: var(--dsw-alias-label-primary-inverted);
  font-size: 13px; font-weight: 600; white-space: nowrap;
}
.dshhy-button:hover:not(:disabled) { background: var(--dsw-alias-button-primary-hover); }
.dshhy-button.dshhy-danger { background: var(--dsw-alias-state-error-primary); }
.dshhy-button.dshhy-danger:hover:not(:disabled) { filter: brightness(0.92); }
.dshhy-text-button {
  display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  min-height: 32px; padding: 0 10px;
  border: 1px solid transparent; border-radius: 6px;
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  font-size: 13px; font-weight: 600; white-space: nowrap;
}
.dshhy-text-button:hover:not(:disabled) {
  background: var(--dsw-alias-interactive-bg-hover);
  color: var(--dsw-alias-label-primary);
}
.dshhy-outline-button { border-color: var(--dsw-alias-border-l2); background: var(--dsw-alias-bg-layer-1); }

.dshhy-summary {
  display: flex; align-items: center; gap: 12px;
  margin-top: 9px;
  color: var(--dsw-alias-label-tertiary);
  font-size: 11px;
}
.dshhy-pager { display: flex; align-items: center; gap: 5px; }
.dshhy-page-count { min-width: 66px; text-align: right; font-variant-numeric: tabular-nums; }
.dshhy-pager .dshhy-icon-button { width: 26px; height: 26px; }

/* ── notice ─────────────────────────────────────────────────────────────── */

.dshhy-notice {
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
  padding: 8px 11px;
  border: 1px solid transparent; border-radius: 6px;
  font-size: 12px;
}
.dshhy-notice-success {
  color: var(--dsw-alias-state-success-primary);
  background: var(--dsw-alias-state-success-tertiary);
  border-color: var(--dsw-alias-state-success-secondary);
}
.dshhy-notice-error {
  color: var(--dsw-alias-state-error-primary);
  background: var(--dsw-alias-interactive-bg-hover-danger);
  border-color: var(--dsw-alias-state-error-secondary);
}
.dshhy-notice button { border: 0; background: transparent; display: grid; place-items: center; padding: 0; }

/* ── selection band ─────────────────────────────────────────────────────── */

.dshhy-selection {
  display: flex; align-items: center; gap: 10px;
  padding: 7px 11px;
  border: 1px solid var(--dsw-alias-state-error-secondary); border-radius: 6px;
  background: var(--dsw-alias-interactive-bg-hover-danger);
}
.dshhy-selection-count {
  flex: 1; min-width: 0;
  color: var(--dsw-alias-label-secondary); font-size: 12px; font-variant-numeric: tabular-nums;
}
.dshhy-selection .dshhy-button { min-height: 28px; }

/* ── records ────────────────────────────────────────────────────────────── */

.dshhy-records {
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) minmax(300px, 0.78fr);
  align-items: stretch;
  gap: 12px;
  flex: 1;
  min-height: 0;
}
.dshhy-list, .dshhy-inspector {
  min-width: 0; min-height: 0;
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 8px;
  background: var(--dsw-alias-bg-layer-1);
  overflow-y: auto;
  scrollbar-gutter: stable;
}
.dshhy-thead {
  position: sticky; top: 0; z-index: 1;
  display: flex; align-items: center;
  padding: 9px 14px 9px 0;
  border-bottom: 1px solid var(--dsw-alias-border-l1);
  background: var(--dsw-alias-bg-layer-2);
  color: var(--dsw-alias-label-tertiary);
  font-size: 10px; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase;
}
/* The header cells sit behind the same 44px gutter and 14px row padding the
   rows use, so the columns line up although the row is a flex pair rather
   than one grid. */
.dshhy-thead-cells {
  flex: 1; min-width: 0;
  display: grid; grid-template-columns: minmax(0, 1fr) 156px 112px; gap: 12px;
  padding: 0 14px;
}
/* The checkbox is a sibling of the row button, never a child: a checkbox
   inside a <button> is invalid and unreachable by keyboard. */
.dshhy-select {
  flex: none; box-sizing: border-box;
  width: 44px; padding-left: 14px;
  display: flex; align-items: center;
}
.dshhy-select input {
  width: 15px; height: 15px; margin: 0;
  accent-color: var(--dsw-alias-brand-primary);
}
.dshhy-row-wrap {
  display: flex; align-items: center;
  border-bottom: 1px solid var(--dsw-alias-border-l1);
}
.dshhy-row-wrap:hover,
.dshhy-row-wrap[data-current='true'],
.dshhy-row-wrap[data-selected='true'] { background: var(--dsw-alias-interactive-bg-hover); }
.dshhy-row-wrap[data-current='true'] { box-shadow: inset 3px 0 0 var(--dsw-alias-brand-primary); }
.dshhy-row {
  display: grid; grid-template-columns: minmax(0, 1fr) 156px 112px; gap: 12px;
  align-items: center;
  flex: 1; min-width: 0; padding: 11px 14px;
  border: 0;
  background: transparent;
  color: var(--dsw-alias-label-primary);
  text-align: left;
}
.dshhy-row-primary { min-width: 0; display: grid; gap: 4px; }
.dshhy-row-primary strong {
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  color: var(--dsw-alias-label-primary); font-size: 14px; font-weight: 600;
}
.dshhy-row-primary small {
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  color: var(--dsw-alias-label-tertiary); font-size: 12px; line-height: 1.3;
}
.dshhy-row-context { display: grid; gap: 4px; min-width: 0; }
.dshhy-chips-inline { display: flex; gap: 4px; overflow: hidden; white-space: nowrap; }
.dshhy-row time { color: var(--dsw-alias-label-tertiary); font-size: 11px; white-space: nowrap; }

.dshhy-chip {
  display: inline-block;
  max-width: 108px; overflow: hidden; text-overflow: ellipsis;
  padding: 2px 5px; border-radius: 4px;
  font-style: normal; font-size: 10px; line-height: 1.3;
}
.dshhy-chip-tag { color: var(--dsw-alias-state-business-primary); background: var(--dsw-alias-state-business-tertiary); }
.dshhy-chip-scope { color: var(--dsw-alias-state-warn-label); background: var(--dsw-alias-state-warn-tertiary); }

.dshhy-blank {
  display: grid; place-items: center; align-content: center; gap: 10px;
  min-height: 220px; padding: 32px;
  color: var(--dsw-alias-label-tertiary); text-align: center;
}
.dshhy-blank p { max-width: 300px; margin: 0; font-size: 13px; line-height: 1.55; }
.dshhy-blank h3 { margin: 0; color: var(--dsw-alias-label-secondary); font-size: 15px; }
.dshhy-error { color: var(--dsw-alias-state-error-primary); }
.dshhy-inline-error {
  margin: 0; padding: 10px 14px;
  border-bottom: 1px solid var(--dsw-alias-border-l1);
  color: var(--dsw-alias-state-error-primary); font-size: 12px;
}

/* ── inspector ──────────────────────────────────────────────────────────── */

.dshhy-inspector { padding: 16px; }
.dshhy-inspector-head {
  display: flex; justify-content: space-between; align-items: flex-start; gap: 14px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--dsw-alias-border-l1);
}
.dshhy-inspector-head h3 {
  max-width: 240px; margin: 0;
  color: var(--dsw-alias-label-primary);
  font-size: 17px; line-height: 1.25; overflow-wrap: anywhere;
}
.dshhy-inspector-actions { display: flex; gap: 6px; flex: none; }
.dshhy-meta {
  display: flex; justify-content: space-between; gap: 8px;
  padding: 9px 0;
  color: var(--dsw-alias-label-tertiary);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 10px;
}
.dshhy-content {
  white-space: pre-wrap; overflow-wrap: anywhere;
  color: var(--dsw-alias-label-secondary); font-size: 13px; line-height: 1.62;
}
.dshhy-markdown { min-width: 0; overflow-wrap: anywhere; font-size: 13px; }

.dshhy-meta-groups {
  display: grid; gap: 12px;
  padding: 14px 0;
  border-bottom: 1px solid var(--dsw-alias-border-l1);
}
.dshhy-meta-groups p, .dshhy-relations-head {
  display: flex; align-items: center; gap: 6px; margin: 0 0 6px;
  color: var(--dsw-alias-label-tertiary);
  font-size: 11px; font-weight: 600; letter-spacing: 0.03em; text-transform: uppercase;
}
.dshhy-chip-wrap { display: flex; flex-wrap: wrap; gap: 4px; }
.dshhy-chip-wrap .dshhy-chip { max-width: none; font-size: 11px; }
.dshhy-muted { color: var(--dsw-alias-label-tertiary); font-size: 12px; }

.dshhy-relations-head { justify-content: space-between; margin: 14px 0 8px; }
.dshhy-relations-head > span { display: flex; align-items: center; gap: 6px; }
.dshhy-relations-head b {
  display: grid; place-items: center;
  min-width: 21px; height: 21px; border-radius: 999px;
  color: var(--dsw-alias-label-secondary); background: var(--dsw-alias-bg-layer-3);
  font-size: 11px;
}
.dshhy-relations { display: grid; gap: 5px; }
.dshhy-relation {
  display: grid; grid-template-columns: 24px minmax(0, 1fr); gap: 8px; align-items: center;
  padding: 7px 8px;
  border-left: 2px solid var(--dsw-alias-border-l2);
  border-radius: 0 5px 5px 0;
  background: var(--dsw-alias-bg-layer-2);
}
.dshhy-relation-dir {
  display: grid; place-items: center; width: 22px; height: 22px; border-radius: 5px;
  color: var(--dsw-alias-state-success-primary); background: var(--dsw-alias-state-success-tertiary);
}
.dshhy-relation-dir[data-direction='incoming'] {
  color: var(--dsw-alias-state-warn-label); background: var(--dsw-alias-state-warn-tertiary);
}
.dshhy-relation-dir[data-direction='both'] {
  color: var(--dsw-alias-state-business-primary); background: var(--dsw-alias-state-business-tertiary);
}
.dshhy-relation strong {
  display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  color: var(--dsw-alias-label-primary); font-size: 12px; font-weight: 600;
}
.dshhy-relation small { display: block; margin-top: 2px; color: var(--dsw-alias-label-tertiary); font-size: 10px; }

/* ── graph ──────────────────────────────────────────────────────────────── */

.dshhy-graph { display: flex; flex-direction: column; flex: 1; min-height: 0; }
.dshhy-graph-toolbar {
  display: flex; align-items: center; justify-content: space-between; gap: 16px;
  min-height: 40px; padding: 4px 6px 4px 12px;
  border: 1px solid var(--dsw-alias-border-l1); border-bottom: 0; border-radius: 8px 8px 0 0;
  background: var(--dsw-alias-bg-layer-1);
}
.dshhy-graph-summary { display: flex; align-items: center; gap: 9px; color: var(--dsw-alias-label-tertiary); font-size: 11px; font-variant-numeric: tabular-nums; }
.dshhy-graph-summary span + span { padding-left: 9px; border-left: 1px solid var(--dsw-alias-border-l1); }
.dshhy-graph-layout {
  display: grid; grid-template-columns: minmax(0, 1.6fr) minmax(290px, 0.62fr);
  flex: 1; min-height: 0;
  border: 1px solid var(--dsw-alias-border-l1); border-radius: 0 0 8px 8px;
  background: var(--dsw-alias-bg-layer-1);
  overflow: hidden;
}
.dshhy-canvas-frame {
  position: relative; min-width: 0; min-height: 0; overflow: hidden;
  background-color: var(--dsw-alias-bg-base);
  background-image:
    linear-gradient(var(--dsw-alias-border-l1) 1px, transparent 1px),
    linear-gradient(90deg, var(--dsw-alias-border-l1) 1px, transparent 1px);
  background-size: 24px 24px;
}
.dshhy-canvas { width: 100%; height: 100%; touch-action: none; }
.dshhy-canvas-overlay {
  position: absolute; inset: 0; pointer-events: none;
  display: grid; place-items: center; align-content: center; gap: 10px;
  padding: 30px; text-align: center;
  color: var(--dsw-alias-label-tertiary);
  background: var(--dsw-alias-bg-mask-1);
}
.dshhy-canvas-overlay p { max-width: 280px; margin: 0; font-size: 13px; line-height: 1.55; }
.dshhy-graph-banner {
  position: absolute; left: 12px; right: 12px; z-index: 2;
  padding: 7px 10px; border: 1px solid transparent; border-radius: 6px;
  font-size: 12px; line-height: 1.35;
}
.dshhy-graph-banner-error {
  bottom: 12px;
  color: var(--dsw-alias-state-error-primary);
  background: var(--dsw-alias-interactive-bg-hover-danger);
  border-color: var(--dsw-alias-state-error-secondary);
}
.dshhy-graph-banner-limit {
  top: 12px;
  color: var(--dsw-alias-state-warn-label);
  background: var(--dsw-alias-state-warn-tertiary);
  border-color: var(--dsw-alias-state-warn-secondary);
}
.dshhy-graph-inspector {
  min-width: 0; padding: 16px;
  border-left: 1px solid var(--dsw-alias-border-l1);
  overflow-y: auto;
}
.dshhy-focus-badge {
  display: inline-flex; align-items: center; flex: none;
  min-height: 20px; padding: 0 6px; border-radius: 5px;
  color: var(--dsw-alias-state-warn-label); background: var(--dsw-alias-state-warn-tertiary);
  font-size: 10px; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase;
}
.dshhy-graph-actions {
  display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 8px;
  padding-top: 14px; margin-top: 14px;
  border-top: 1px solid var(--dsw-alias-border-l1);
}
.dshhy-statement-path {
  display: grid; grid-template-columns: minmax(0, 1fr) auto minmax(0, auto) auto minmax(0, 1fr);
  gap: 6px; align-items: center;
  margin: 14px 0; padding: 10px;
  border-left: 3px solid var(--dsw-alias-border-l2); border-radius: 0 6px 6px 0;
  background: var(--dsw-alias-bg-layer-2);
  color: var(--dsw-alias-label-secondary); font-size: 12px;
}
.dshhy-statement-path span { min-width: 0; overflow-wrap: anywhere; }
.dshhy-statement-path strong { color: var(--dsw-alias-label-primary); font-size: 11px; }
.dshhy-reference-copy { margin: 14px 0; color: var(--dsw-alias-label-secondary); font-size: 13px; line-height: 1.58; }

/* ── delete dialog ──────────────────────────────────────────────────────── */

.dshhy-backdrop {
  position: absolute; inset: 0; z-index: 10;
  display: grid; place-items: center; padding: 18px;
  background: var(--dsw-alias-bg-mask-2);
}
.dshhy-dialog {
  width: min(100%, 480px); max-height: 100%; overflow-y: auto;
  border: 1px solid var(--dsw-alias-border-l2);
  border-top: 3px solid var(--dsw-alias-state-error-primary);
  border-radius: 8px;
  background: var(--dsw-alias-bg-layer-1);
  box-shadow: 0 20px 60px var(--dsw-alias-bg-mask-drop);
}
.dshhy-dialog header, .dshhy-dialog footer {
  display: flex; align-items: center; justify-content: space-between; gap: 14px;
  padding: 14px 16px;
}
.dshhy-dialog header { border-bottom: 1px solid var(--dsw-alias-border-l1); }
.dshhy-dialog footer { border-top: 1px solid var(--dsw-alias-border-l1); }
.dshhy-dialog h2 { margin: 0; color: var(--dsw-alias-label-primary); font-size: 18px; line-height: 1.2; }
.dshhy-dialog-copy { margin: 14px 16px 10px; color: var(--dsw-alias-label-secondary); font-size: 13px; line-height: 1.55; }
.dshhy-dialog-copy strong, .dshhy-confirm code {
  color: var(--dsw-alias-state-error-primary); overflow-wrap: anywhere;
}
.dshhy-impact {
  display: flex; align-items: center; gap: 7px; margin: 0 16px;
  padding: 8px 10px; border-radius: 6px;
  color: var(--dsw-alias-state-warn-label); background: var(--dsw-alias-state-warn-tertiary);
  font-size: 12px;
}
.dshhy-name-list {
  max-height: 168px; overflow-y: auto;
  margin: 8px 16px 0; padding: 6px 8px;
  border: 1px solid var(--dsw-alias-border-l1); border-radius: 6px;
  background: var(--dsw-alias-bg-base);
  list-style: none;
  color: var(--dsw-alias-label-secondary); font-size: 12px; line-height: 1.6;
}
.dshhy-name-list li { overflow-wrap: anywhere; }
.dshhy-check { display: flex; align-items: center; gap: 8px; margin: 14px 16px; color: var(--dsw-alias-label-secondary); font-size: 13px; }
.dshhy-check input { width: 15px; height: 15px; accent-color: var(--dsw-alias-state-error-primary); }
.dshhy-confirm { display: grid; gap: 6px; margin: 0 16px 14px; color: var(--dsw-alias-label-tertiary); font-size: 12px; }
.dshhy-confirm input {
  min-height: 34px; padding: 7px 9px;
  border: 1px solid var(--dsw-alias-border-l2); border-radius: 6px; outline: 0;
  color: var(--dsw-alias-label-primary); background: var(--dsw-alias-bg-base);
}
.dshhy-confirm input:focus { border-color: var(--dsw-alias-state-error-primary); }

/* ── motion ─────────────────────────────────────────────────────────────── */

.dshhy-flip { transform: rotate(180deg); }
.dshhy-spin { animation: dshhy-spin 0.9s linear infinite; }
@keyframes dshhy-spin { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) { .dshhy-spin { animation: none; } }

/* ── narrow layouts ─────────────────────────────────────────────────────── */

@container (max-width: 1080px) {
  .dshhy-shell { grid-template-columns: 1fr; }
  .dshhy-shelves {
    flex-direction: row; align-items: center; gap: 8px;
    padding: 10px 12px; border-right: 0; border-bottom: 1px solid var(--dsw-alias-border-l1);
    overflow-x: auto; overflow-y: hidden;
  }
  .dshhy-shelf-list { grid-auto-flow: column; grid-auto-columns: minmax(130px, auto); }
  .dshhy-records, .dshhy-graph-layout { grid-template-columns: minmax(0, 1fr); }
  .dshhy-records { grid-template-rows: minmax(220px, 1fr) minmax(200px, 1fr); }
  .dshhy-graph-inspector { border-left: 0; border-top: 1px solid var(--dsw-alias-border-l1); }
  .dshhy-search form { grid-template-columns: 1fr 1fr; }
  .dshhy-field { grid-column: 1 / -1; }
  /* The header keeps only its select-all: a narrow column has no room for the
     column labels, but losing select-all would leave no way to check a page. */
  .dshhy-thead-cells > span:not(:first-child) { display: none; }
  .dshhy-thead-cells { grid-template-columns: minmax(0, 1fr); }
  .dshhy-row { grid-template-columns: minmax(0, 1fr) auto; gap: 6px 12px; }
  .dshhy-row-primary { grid-column: 1 / -1; }
  .dshhy-row time { text-align: right; }
}
`

/**
 * Inject the stylesheet once per document.
 * @returns a disposer removing the tag; a repeat call while a tag is present
 *   leaves the existing one alone and disposes to a no-op.
 */
export function injectStyles(): () => void {
  if (typeof document === 'undefined') return () => {}
  const existing = document.querySelector(`style[data-plugin-css='${STYLE_TAG_ID}']`)
  if (existing !== null) return () => {}
  const tag = document.createElement('style')
  tag.dataset['plugin'] = STYLE_TAG_ID
  tag.dataset['pluginCss'] = STYLE_TAG_ID
  tag.textContent = STYLESHEET
  document.head.appendChild(tag)
  return () => { tag.remove() }
}
