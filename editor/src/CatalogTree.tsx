import { memo, useDeferredValue, useEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react'
import { Label, TextInput } from '@trussworks/react-uswds'
import { useNavigate, useRouterState } from '@tanstack/react-router'
import type { CatalogGraph } from './catalog/types'
import { usesOf } from './catalog/uses'
import { fieldAndClass } from './labels'
import { FILTER_LIMIT, ancestorIds, count, filterTree, labelOf, treeRows, type TreeRow } from './tree'

/** Scrolls the selected row into the pane's view when none of it shows. */
function revealSelected(pane: HTMLElement | null) {
  const item = pane?.querySelector<HTMLElement>('[aria-selected="true"]')
  if (!pane || !item) return
  if (item.offsetTop + item.offsetHeight <= pane.scrollTop || item.offsetTop >= pane.scrollTop + pane.clientHeight) {
    pane.scrollTop = item.offsetTop - item.offsetHeight
  }
}

/**
 * The catalog as a tree, filtered by title or name. USWDS has no tree view, so this is a custom WAI-ARIA treeview
 * (https://www.w3.org/WAI/ARIA/apg/patterns/treeview/): one tab stop; arrow keys move, open and close; Home and End
 * move; Enter, Space or a click opens the object. Selection does not follow focus, and focus stays in the tree.
 */
export function CatalogTree({
  catalog,
  pathFor,
  parents,
  selectedId,
}: {
  catalog: CatalogGraph
  /** Canonical editor path for an object id in this catalog. */
  pathFor: (objectId: string) => string
  /** `parentsOf(catalog)`, built once by the editor and shared with the breadcrumb. */
  parents: Map<string, string[]>
  selectedId: string
}) {
  const navigate = useNavigate()
  // Open at first down to the selected object, so the first render needs no adjusting.
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(
    () => new Set([catalog.rootId, ...ancestorIds(selectedId, parents)]),
  )
  // Opening another object (from a link, Back or the tree) expands the objects above it, and makes it the tab stop, as
  // the APG asks of a tree that has a selection. This adjusts state while rendering, as
  // React advises over an effect (https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes):
  // the first commit already holds the expanded rows, so the scroll effect below finds the selected row.
  const [expandedTo, setExpandedTo] = useState(selectedId)
  const [focusKey, setFocusKey] = useState<string>()
  // The row last opened from the tree (a click, Enter or Space): which place a shared object was selected in.
  const [openedKey, setOpenedKey] = useState<string>()
  if (expandedTo !== selectedId) {
    setExpandedTo(selectedId)
    setFocusKey(undefined)
    if (openedKey !== undefined && !openedKey.endsWith(selectedId)) setOpenedKey(undefined)
    const above = ancestorIds(selectedId, parents)
    if (above.some((id) => !expanded.has(id))) setExpanded(new Set([...expanded, ...above]))
  }
  const [filter, setFilter] = useState('')
  // The input shows each key at once; the tree catches up when React has time.
  const needle = useDeferredValue(filter.trim().toLowerCase())
  const found = useMemo(() => (needle ? filterTree(catalog, parents, needle) : undefined), [catalog, parents, needle])
  const rows = useMemo(() => treeRows(catalog, expanded, found?.shown), [catalog, expanded, found])
  // A shared object has a row in each place. The selected one is the row the user opened, else the one under the
  // object they came from (a link in its form), else the first; the others show as the same object.
  const from = useRouterState({ select: (s) => s.location.state.from })
  const selectedRow =
    rows.find((row) => row.key === openedKey && row.object.id === selectedId) ??
    (from !== undefined ? rows.find((row) => row.key.endsWith(`${from} ${selectedId}`)) : undefined) ??
    rows.find((row) => row.object.id === selectedId)
  const tabStop = rows.find((row) => row.key === focusKey) ?? selectedRow ?? rows[0]
  const uses = usesOf(catalog)
  const pane = useRef<HTMLDivElement>(null)

  // A filter's results start at the top; the whole tree, and a newly selected object, show the selected object.
  useEffect(() => {
    if (needle) pane.current?.scrollTo(0, 0)
    else revealSelected(pane.current)
  }, [needle])
  useEffect(() => {
    revealSelected(pane.current)
  }, [selectedId])

  const open = (row: TreeRow) => {
    setOpenedKey(row.key)
    return navigate({
      to: '/editor/$',
      params: {
        _splat: pathFor(row.object.id),
      },
    })
  }
  // Callers don't toggle while filtering: the objects above the matches stay expanded.
  const toggle = (row: TreeRow) => {
    if (row.expanded === undefined) return
    const next = new Set(expanded)
    if (row.expanded) next.delete(row.object.id)
    else next.add(row.object.id)
    setExpanded(next)
  }
  // The row an event on the tree (its currentTarget) came from; the rows are the tree's children, in order.
  const indexOf = (event: MouseEvent | KeyboardEvent) =>
    Array.prototype.indexOf.call(
      event.currentTarget.children,
      (event.target as HTMLElement).closest('[role="treeitem"]'),
    )

  function onClick(event: MouseEvent) {
    const row = rows[indexOf(event)]
    if (!row) return
    setFocusKey(row.key)
    // While filtering the arrows are fixed open, so a click anywhere on the row opens the object.
    if (!found && (event.target as HTMLElement).closest('.catalog-tree__toggle')) toggle(row)
    else open(row)
  }

  function onKeyDown(event: KeyboardEvent) {
    // Leave Alt+Left (Back) and other shortcuts to the browser.
    if (event.altKey || event.ctrlKey || event.metaKey) return
    const i = indexOf(event)
    const row = rows[i]
    if (!row) return
    const items = event.currentTarget.children
    const move = (j: number) => {
      if (!rows[j]) return
      setFocusKey(rows[j].key)
      ;(items[j] as HTMLElement).focus()
    }
    switch (event.key) {
      case 'ArrowDown':
        move(i + 1)
        break
      case 'ArrowUp':
        move(i - 1)
        break
      case 'Home':
        move(0)
        break
      case 'End':
        move(rows.length - 1)
        break
      case 'ArrowRight':
        if (row.expanded) move(i + 1)
        else toggle(row)
        break
      case 'ArrowLeft':
        if (row.expanded && !found) toggle(row)
        else {
          let parent = i - 1
          while (parent >= 0 && rows[parent].level >= row.level) parent--
          move(parent)
        }
        break
      case 'Enter':
      case ' ':
        open(row)
        break
      default:
        return
    }
    event.preventDefault()
  }

  return (
    <>
      <Label htmlFor="tree-filter" className="margin-top-0">
        Filter by title or name
      </Label>
      {/* Not type="search": USWDS floats those, and a float before the tree makes every change lay out all its rows. */}
      <TextInput id="tree-filter" name="tree-filter" type="text" value={filter} onChange={(e) => setFilter(e.target.value)} />
      <p role="status" className="margin-y-1">
        {found &&
          (found.matches > FILTER_LIMIT
            ? `${count(found.matches)} objects match. Showing the first ${FILTER_LIMIT}: type more to narrow them down.`
            : found.matches === 0
              ? 'No objects match. Try part of a title or name.'
              : `${count(found.matches)} ${found.matches === 1 ? 'object matches' : 'objects match'}.`)}
      </p>
      {found?.matches !== 0 && (
        <div className="catalog-tree" ref={pane}>
          <ul role="tree" aria-label="Catalog" onClick={onClick} onKeyDown={onKeyDown}>
            {rows.map(({ key, ...row }) => (
              <TreeItem
                key={key}
                {...row}
                selected={key === selectedRow?.key}
                same={key !== selectedRow?.key && row.object.id === selectedId}
                places={uses.get(row.object.id)?.length ?? 0}
                tabStop={key === tabStop.key}
              />
            ))}
          </ul>
        </div>
      )}
    </>
  )
}

/**
 * One row: the toggle's place (kept on leaves too, so each level lines up), the label, the field and class, the
 * number of children while collapsed, and how many places use a shared object. Text that doesn't fit ends in an
 * ellipsis; the whole label stays in the row's name and shows on hover. Memoized, so selecting, moving or expanding
 * re-renders only the rows that change.
 */
const TreeItem = memo(function TreeItem({
  object,
  property,
  level,
  position,
  siblings,
  expanded,
  childCount,
  selected,
  same,
  places,
  tabStop,
}: Omit<TreeRow, 'key'> & { selected: boolean; same: boolean; places: number; tabStop: boolean }) {
  const label = labelOf(object)
  return (
    <li
      role="treeitem"
      aria-level={level}
      aria-posinset={position}
      aria-setsize={siblings}
      aria-expanded={expanded}
      aria-selected={selected}
      tabIndex={tabStop ? 0 : -1}
      className={same ? 'catalog-tree__same' : undefined}
      style={{ paddingLeft: `${level - 1}rem` }}
    >
      <span className="catalog-tree__toggle" aria-hidden="true" />
      <bdi className="catalog-tree__label" title={label}>
        {label}
      </bdi>
      {property && <span className="catalog-tree__class">{` ${fieldAndClass(property, object.dcatClass)}`}</span>}
      {expanded === false && (
        <span className="catalog-tree__count">{` · ${count(childCount)} ${childCount === 1 ? 'item' : 'items'}`}</span>
      )}
      {places > 1 && <span className="catalog-tree__shared">{` Shared · ${count(places)} places`}</span>}
    </li>
  )
})
