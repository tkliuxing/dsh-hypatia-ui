/**
 * The console's icon set.
 *
 * Copied from DSH's own product icons (`@deepseek-ai/dsh-client-ui-primitives`,
 * `src/icons/index.tsx` in a DSH checkout) rather than imported from it. The
 * plugin development manual forbids requiring a Harness Client package as a
 * module: those packages change without notice — DSH 0.1.7 renamed this very
 * set — and a throwing component blanks the slot entry it renders in. Copying
 * keeps the console's glyphs identical to the host's while leaving
 * `--dsw-alias-*` tokens as the only shared styling dependency.
 *
 * Every path draws with `currentColor`, so a glyph inherits the token-derived
 * colour of the control around it.
 *
 * @module @tkliuxing/dsh-hypatia-ui/client/icons
 */

/** Shared props for the console's glyph components. */
export interface IconProps {
  /** Square edge in px; defaults to the glyph's own drawn size. */
  size?: number | undefined
  /** Extra class for layout placement; color rides currentColor. */
  className?: string | undefined
}

/**
 * The sidebar entry's glyph: a shelf of paired spines, drawn at the size the
 * sidebar's panel row asks for.
 * @param props - the requested edge and any extra class.
 * @returns the icon element.
 */
export function ShelfIcon({ size = 18 }: IconProps): React.JSX.Element {
  return (
    <svg
      viewBox="0 0 16 16" width={size} height={size} fill="none"
      stroke="currentColor" strokeWidth={1.3} strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2.5 3.2a1 1 0 0 1 1-1h2.2a1.6 1.6 0 0 1 1.6 1.6v9.4a1.3 1.3 0 0 0-1.3-1.3H2.5z" />
      <path d="M13.5 3.2a1 1 0 0 0-1-1h-2.2a1.6 1.6 0 0 0-1.6 1.6v9.4a1.3 1.3 0 0 1 1.3-1.3h3.5z" />
      <path d="M8 3.8v9.4" />
    </svg>
  )
}

/**
 * The archive box drawn beside the Records tab.
 * @param props - the requested edge and any extra class.
 * @returns the icon element.
 */
export function ArchiveIcon({ size = 20, className }: IconProps): React.JSX.Element {
  return (
  <svg width={size} height={size} className={className} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" strokeWidth={1}>
    <path d="M13.5 2.5H2.5C1.94772 2.5 1.5 2.94772 1.5 3.5V4.5C1.5 5.05228 1.94772 5.5 2.5 5.5H13.5C14.0523 5.5 14.5 5.05228 14.5 4.5V3.5C14.5 2.94772 14.0523 2.5 13.5 2.5Z" stroke="currentColor" />
    <path d="M2.5 5.5V13.5C2.5 13.7652 2.60536 14.0196 2.79289 14.2071C2.98043 14.3946 3.23478 14.5 3.5 14.5H12.5C12.7652 14.5 13.0196 14.3946 13.2071 14.2071C13.3946 14.0196 13.5 13.7652 13.5 13.5V5.5" stroke="currentColor" />
    <path d="M6.5 9.5H9.5" stroke="currentColor" />
  </svg>
  )
}

/**
 * A fork in the graph: the console mark, the graph tab, and every relationship heading.
 * @param props - the requested edge and any extra class.
 * @returns the icon element.
 */
export function BranchIcon({ size = 16, className }: IconProps): React.JSX.Element {
  return (
  <svg width={size} height={size} className={className} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" strokeWidth={1}>
    <path d="M1.01503 8.0001L5.6964 8.0001C6.41913 8.0001 6.78049 8.0001 7.12115 7.91951C7.4232 7.84804 7.71233 7.73014 7.97821 7.57C8.27809 7.38939 8.5364 7.13669 9.05303 6.63129L11.3281 4.40564" stroke="currentColor" />
    <path d="M1.01221 7.9999L5.6964 7.9999C6.41913 7.9999 6.78049 7.9999 7.12115 8.08049C7.4232 8.15196 7.71233 8.26986 7.97821 8.43C8.27809 8.61061 8.5364 8.86331 9.05303 9.36871L11.3281 11.5944" stroke="currentColor" />
    <circle cx="12.4502" cy="3.3079" r="1.56962" stroke="currentColor" />
    <circle cx="12.4502" cy="12.6921" r="1.56962" stroke="currentColor" />
  </svg>
  )
}

/**
 * Previous page, and Back in the graph focus stack.
 * @param props - the requested edge and any extra class.
 * @returns the icon element.
 */
export function ChevronLeftIcon({ size = 14, className }: IconProps): React.JSX.Element {
  return (
  <svg width={size} height={size} className={className} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" strokeWidth={1}>
    <path d="M10 4L6.70711 7.29289C6.31658 7.68342 6.31658 8.31658 6.70711 8.70711L10 12" stroke="currentColor" />
  </svg>
  )
}

/**
 * Next page.
 * @param props - the requested edge and any extra class.
 * @returns the icon element.
 */
export function ChevronRightIcon({ size = 14, className }: IconProps): React.JSX.Element {
  return (
  <svg width={size} height={size} className={className} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" strokeWidth={1}>
    <path d="M6 12L9.29289 8.70711C9.68342 8.31658 9.68342 7.68342 9.29289 7.29289L6 4" stroke="currentColor" />
  </svg>
  )
}

/**
 * Dismiss a notice, close a dialog, leave the console.
 * @param props - the requested edge and any extra class.
 * @returns the icon element.
 */
export function CloseIcon({ size = 16, className }: IconProps): React.JSX.Element {
  return (
  <svg width={size} height={size} className={className} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" strokeWidth={1}>
    <path d="M2.5 2.5L13.5 13.5" stroke="currentColor" />
    <path d="M13.5 2.5L2.5 13.5" stroke="currentColor" />
  </svg>
  )
}

/**
 * A shelf store: the empty-list glyph, and the scopes group in the inspector.
 * @param props - the requested edge and any extra class.
 * @returns the icon element.
 */
export function DatabaseIcon({ size = 16, className }: IconProps): React.JSX.Element {
  return (
  <svg width={size} height={size} className={className} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" strokeWidth={1}>
    <path d="M13.1967 5.1869C13.7232 4.77378 14.0003 4.30517 14.0001 3.82819C14.0003 3.3512 13.7232 2.88259 13.1967 2.46947C12.6702 2.05635 11.9128 1.71328 11.0006 1.47475C10.0885 1.23621 9.05371 1.11062 8.00039 1.1106C6.94707 1.11057 5.9123 1.23612 5.00009 1.47461C4.08742 1.71301 3.32948 2.05604 2.80249 2.46919C2.2755 2.88235 1.99805 3.35106 1.99805 3.82819C1.99805 4.30531 2.2755 4.77402 2.80249 5.18718C3.32948 5.60033 4.08742 5.94336 5.00009 6.18176C5.9123 6.42025 6.94707 6.5458 8.00039 6.54578C9.05371 6.54575 10.0885 6.42016 11.0006 6.18163C11.9128 5.94309 12.6702 5.60002 13.1967 5.1869Z" stroke="currentColor" />
    <path d="M2 3.80371V11.7848" stroke="currentColor" />
    <path d="M14 3.80371V11.7848" stroke="currentColor" />
    <path d="M2 7.81396C2 8.60524 2.63214 9.36411 3.75736 9.92363C4.88258 10.4832 6.4087 10.7975 8 10.7975C9.5913 10.7975 11.1174 10.4832 12.2426 9.92363C13.3679 9.36411 14 8.60524 14 7.81396" stroke="currentColor" />
    <path d="M2 11.7847C2 12.6081 2.63214 13.3977 3.75736 13.98C4.88258 14.5622 6.4087 14.8893 8 14.8893C9.5913 14.8893 11.1174 14.5622 12.2426 13.98C13.3679 13.3977 14 12.6081 14 11.7847" stroke="currentColor" />
  </svg>
  )
}

/**
 * Fit the whole graph into the canvas.
 * @param props - the requested edge and any extra class.
 * @returns the icon element.
 */
export function FitIcon({ size = 16, className }: IconProps): React.JSX.Element {
  return (
  <svg width={size} height={size} className={className} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" strokeWidth={1}>
    <path d="M2.33154 9.40576V13.1685C2.3318 13.4444 2.55556 13.6685 2.83154 13.6685H6.49463V14.6685H2.83154C2.00328 14.6685 1.3318 13.9967 1.33154 13.1685V9.40576H2.33154ZM13.1685 1.33154C13.9964 1.33199 14.6683 2.00352 14.6685 2.83154V6.40576H13.6685V2.83154C13.6683 2.5558 13.4441 2.33199 13.1685 2.33154H9.49463V1.33154H13.1685Z" fill="currentColor" />
    <path d="M9.4292 6.57077L13.914 2.08594" stroke="currentColor" />
    <path d="M6.57077 9.4292L2.08594 13.914" stroke="currentColor" />
  </svg>
  )
}

/**
 * The tags group in the inspector.
 * @param props - the requested edge and any extra class.
 * @returns the icon element.
 */
export function TagIcon({ size = 16, className }: IconProps): React.JSX.Element {
  return (
  <svg width={size} height={size} className={className} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" strokeWidth={1}>
    <path d="M6.59961 9.40051C6.82779 9.6334 7.10015 9.81842 7.40074 9.94472C7.70132 10.071 8.02409 10.1361 8.35013 10.1361C8.67618 10.1361 8.99894 10.071 9.29953 9.94472C9.60011 9.81842 9.87247 9.6334 10.1007 9.40051L12.9015 6.59967C13.3658 6.13541 13.6266 5.50572 13.6266 4.84915C13.6266 4.19258 13.3658 3.56289 12.9015 3.09863C12.4372 2.63436 11.8075 2.37354 11.151 2.37354C10.4944 2.37354 9.86472 2.63436 9.40045 3.09863L9.05034 3.44873" stroke="currentColor" />
    <path d="M9.40051 6.59959C9.17233 6.3667 8.89997 6.18169 8.59939 6.05538C8.2988 5.92907 7.97603 5.86401 7.64999 5.86401C7.32395 5.86401 7.00118 5.92907 6.70059 6.05538C6.40001 6.18169 6.12765 6.3667 5.89946 6.59959L3.09863 9.40043C2.63436 9.8647 2.37354 10.4944 2.37354 11.151C2.37354 11.8075 2.63436 12.4372 3.09863 12.9015C3.56289 13.3657 4.19258 13.6266 4.84915 13.6266C5.50572 13.6266 6.13541 13.3657 6.59967 12.9015L6.94978 12.5514" stroke="currentColor" />
  </svg>
  )
}

/**
 * The busy glyph; callers spin it with the `dshhy-spin` class.
 * @param props - the requested edge and any extra class.
 * @returns the icon element.
 */
export function SpinnerIcon({ size = 16, className }: IconProps): React.JSX.Element {
  return (
  <svg width={size} height={size} className={className} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" strokeWidth={1}>
    <path d="M12.596 12.596C11.687 13.5049 10.5288 14.1239 9.26798 14.3747C8.00716 14.6255 6.70028 14.4968 5.51261 14.0048C4.32494 13.5129 3.30981 12.6798 2.59557 11.611C1.88134 10.5421 1.50008 9.2855 1.5 7.99998C1.50008 6.71446 1.88134 5.45783 2.59557 4.38898C3.30981 3.32013 4.32494 2.48707 5.51261 1.99513C6.70028 1.50319 8.00716 1.37447 9.26798 1.62524C10.5288 1.87602 11.687 2.49502 12.596 3.40398" stroke="currentColor" />
  </svg>
  )
}

/**
 * Reload the page, the graph focus, or one node’s relationships.
 * @param props - the requested edge and any extra class.
 * @returns the icon element.
 */
export function RefreshIcon({ size = 16, className }: IconProps): React.JSX.Element {
  return (
  <svg width={size} height={size} className={className} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" strokeWidth={1}>
    <path d="M14.5001 8C14.5 9.28552 14.1188 10.5422 13.4045 11.611C12.6903 12.6799 11.6752 13.5129 10.4875 14.0049C9.29982 14.4968 7.99295 14.6255 6.73212 14.3747C5.4713 14.124 4.31314 13.505 3.4041 12.596C2.49514 11.687 1.87614 10.5288 1.62537 9.26798C1.37459 8.00716 1.50331 6.70028 1.99525 5.51261C2.48719 4.32494 3.32025 3.30981 4.3891 2.59557C5.45795 1.88134 6.71458 1.50008 8.0001 1.5C9.9001 1.5 11.7001 2.3 13.0001 3.6L14.5001 5.1" stroke="currentColor" />
    <path d="M14.4999 1.5V5.1H10.8999" stroke="currentColor" />
  </svg>
  )
}

/**
 * The direction badge on one relationship.
 * @param props - the requested edge and any extra class.
 * @returns the icon element.
 */
export function ArrowUpRightIcon({ size = 16, className }: IconProps): React.JSX.Element {
  return (
  <svg width={size} height={size} className={className} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" strokeWidth={1}>
    <path d="M11.7256 2.77441C12.5538 2.77469 13.2256 3.44616 13.2256 4.27441V10.1416H12.2256V4.27441C12.2256 3.99844 12.0015 3.77469 11.7256 3.77441H5.7207V2.77441H11.7256Z" fill="currentColor" />
    <path d="M2.77441 13.2255L12.3756 3.62427" stroke="currentColor" />
  </svg>
  )
}

/**
 * The search field and the Search submit button.
 * @param props - the requested edge and any extra class.
 * @returns the icon element.
 */
export function SearchIcon({ size = 16, className }: IconProps): React.JSX.Element {
  return (
  <svg width={size} height={size} className={className} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" strokeWidth={1}>
    <path d="M6.58727 11.8586C9.55061 11.8586 11.9529 9.45637 11.9529 6.49304C11.9529 3.5297 9.55061 1.12744 6.58727 1.12744C3.62394 1.12744 1.22168 3.5297 1.22168 6.49304C1.22168 9.45637 3.62394 11.8586 6.58727 11.8586Z" stroke="currentColor" />
    <path d="M10.2991 10.3933L14.7783 14.8725" stroke="currentColor" />
  </svg>
  )
}

/**
 * Every destructive action.
 * @param props - the requested edge and any extra class.
 * @returns the icon element.
 */
export function TrashIcon({ size = 16, className }: IconProps): React.JSX.Element {
  return (
  <svg width={size} height={size} className={className} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" strokeWidth={1}>
    <path d="M1.28149 3.88831H14.7187" stroke="currentColor" />
    <path d="M5.41602 3.88833V2.47962C5.41602 2.29282 5.52492 2.11366 5.71876 1.98157C5.9126 1.84948 6.17551 1.77527 6.44964 1.77527H9.55053C9.82466 1.77527 10.0876 1.84948 10.2814 1.98157C10.4753 2.11366 10.5842 2.29282 10.5842 2.47962V3.88833" stroke="currentColor" />
    <path d="M2.57349 3.88831L3.19366 13.2943C3.21937 13.5502 3.33952 13.7872 3.53065 13.9593C3.72178 14.1313 3.97016 14.2259 4.22729 14.2246H11.7728C12.0299 14.2259 12.2783 14.1313 12.4694 13.9593C12.6605 13.7872 12.7807 13.5502 12.8064 13.2943L13.4266 3.88831" stroke="currentColor" />
    <path d="M6.44946 6.98926V11.1238" stroke="currentColor" />
    <path d="M9.55054 6.98926V11.1238" stroke="currentColor" />
  </svg>
  )
}
