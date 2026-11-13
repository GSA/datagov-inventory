import { memo, useDeferredValue, useEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react'
import { Label, TextInput } from '@trussworks/react-uswds'
import { useNavigate } from '@tanstack/react-router'
import type { DecomposedCatalog } from './catalog/decompose'
import { FILTER_LIMIT, ancestorIds, count, filterTree, labelOf, parentsOf, pathOf, treeRows, type TreeRow } from './tree'

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
export function CatalogTree({ catalog, selectedId }: { catalog: DecomposedCatalog; selectedId: string }) {
  const navigate = useNavigate()
  const parents = useMemo(() => parentsOf(catalog), [catalog])
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
  if (expandedTo !== selectedId) {
    setExpandedTo(selectedId)
    setFocusKey(undefined)
    const above = ancestorIds(selectedId, parents)
    if (above.some((id) => !expanded.has(id))) setExpanded(new Set([...expanded, ...above]))
  }
  const [filter, setFilter] = useState('')
  // The input shows each key at once; the tree catches up when React has time.
  const needle = useDeferredValue(filter.trim().toLowerCase())
  const found = useMemo(() => (needle ? filterTree(catalog, parents, needle) : undefined), [catalog, parents, needle])
  const rows = useMemo(() => treeRows(catalog, expanded, found?.shown), [catalog, expanded, found])
  const tabStop =
    rows.find((row) => row.key === focusKey) ?? rows.find((row) => row.object.id === selectedId) ?? rows[0]
  const pane = useRef<HTMLDivElement>(null)

  // A filter's results start at the top; the whole tree, and a newly selected object, show the selected object.
  useEffect(() => {
    if (needle) pane.current?.scrollTo(0, 0)
    else revealSelected(pane.current)
  }, [needle])
  useEffect(() => {
    revealSelected(pane.current)
  }, [selectedId])

  const open = (row: TreeRow) => navigate({ to: '/editor/$', params: { _splat: pathOf(row.object.id) } })
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
            : `${count(found.matches)} ${found.matches === 1 ? 'object matches' : 'objects match'}.`)}
      </p>
      {found?.matches !== 0 && (
        <div className="catalog-tree" ref={pane}>
          <ul role="tree" aria-label="Catalog" onClick={onClick} onKeyDown={onKeyDown}>
            {rows.map(({ key, ...row }) => (
              <TreeItem key={key} {...row} selected={row.object.id === selectedId} tabStop={key === tabStop.key} />
            ))}
          </ul>
        </div>
      )}
    </>
  )
}

/** One row. Memoized, so selecting, moving or expanding re-renders only the rows that change. */
const TreeItem = memo(function TreeItem({
  object,
  property,
  level,
  position,
  siblings,
  expanded,
  selected,
  tabStop,
}: Omit<TreeRow, 'key'> & { selected: boolean; tabStop: boolean }) {
  return (
    <li
      role="treeitem"
      aria-level={level}
      aria-posinset={position}
      aria-setsize={siblings}
      aria-expanded={expanded}
      aria-selected={selected}
      tabIndex={tabStop ? 0 : -1}
      style={{ paddingLeft: `${level + 0.5}rem` }}
    >
      {expanded !== undefined && <span className="catalog-tree__toggle" aria-hidden="true" />}
      <bdi>{labelOf(object)}</bdi>
      {property && <span className="catalog-tree__class">{` ${property} · ${object.dcatClass}`}</span>}
    </li>
  )
})
