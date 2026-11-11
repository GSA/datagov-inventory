import { memo, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Button, Table } from '@trussworks/react-uswds'
import type { CatalogObject, DecomposedCatalog } from './catalog/decompose'
import { getClassProperties } from './schema'

export interface LoadedCatalog {
  /** The file name, sample name or "Pasted JSON", shown in the summary. */
  name: string
  /** The decomposed catalog (#20). */
  catalog: DecomposedCatalog
  /** Optional export handler from parent. */
  onExport?: () => void
  /** Optional export status from parent. */
  exportStatus?: { type: 'success' | 'error'; message: string }
}

/** Rows rendered at a time, so a big catalog or a huge object cannot freeze the tab. */
const PAGE_SIZE = 500
const LABEL_LENGTH = 200
const VALUE_LENGTH = 2_000

/** Labels by object, computed once: objects don't change after loading, and rows re-render. */
const labels = new WeakMap<CatalogObject, string>()

/**
 * A short name for an object: its title, name, contact name or label, if one has visible
 * characters, cut to 200 characters. Render it in <bdi> so right-to-left overrides in it
 * cannot reorder the text around it.
 */
function labelOf(object: CatalogObject): string {
  let label = labels.get(object)
  if (label === undefined) {
    const value = ['title', 'name', 'fn', 'prefLabel', 'label']
      .map((key) => object.properties[key])
      .find((value): value is string => typeof value === 'string' && /[^\p{Cf}\p{Z}\s]/u.test(value))
    label =
      value === undefined
        ? `Untitled ${object.dcatClass}`
        : value.length > LABEL_LENGTH
          ? `${value.slice(0, LABEL_LENGTH).replace(/[\uD800-\uDBFF]$/, '')}…`
          : value
    labels.set(object, label)
  }
  return label
}

const count = (n: number) => n.toLocaleString('en-US')

/**
 * Shows the first PAGE_SIZE items, and more on request. After "Show more", focus moves to
 * the first new item (the element children mark `data-paged-item`) and the new total is announced.
 */
function Paged<T>({ items, noun, children }: { items: T[]; noun: string; children: (shown: T[]) => ReactNode }) {
  const [shown, setShown] = useState(PAGE_SIZE)
  const container = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (shown > PAGE_SIZE) {
      container.current?.querySelectorAll<HTMLElement>('[data-paged-item]')[shown - PAGE_SIZE]?.focus()
    }
  }, [shown])
  return (
    <div ref={container}>
      {children(items.slice(0, shown))}
      <p className="usa-sr-only" role="status">
        {shown > PAGE_SIZE && `Showing ${count(Math.min(shown, items.length))} of ${count(items.length)} ${noun}.`}
      </p>
      {shown < items.length && (
        <Button type="button" outline onClick={() => setShown(shown + PAGE_SIZE)}>
          Show more {noun} ({count(shown)} of {count(items.length)} shown)
        </Button>
      )}
    </div>
  )
}

/** Values are untrusted: they are only ever rendered as React text, cut to 2,000 characters so a huge one cannot stall the page. */
function textOf(value: unknown): string {
  const text = typeof value === 'string' ? value : JSON.stringify(value)
  return text.length > VALUE_LENGTH ? `${text.slice(0, VALUE_LENGTH)}… (${count(text.length)} characters in all)` : text
}

interface RowProps {
  /** The object this row lists. */
  object: CatalogObject
  /** Its position in the list, used to give its id cell a unique DOM id. */
  index: number
  /** Whether it is the object open in the detail pane. */
  selected: boolean
  /** Opens an object by id; stable across renders, so unchanged rows are not re-rendered. */
  onSelect: (id: string) => void
}

/** A row of the object list; memoized so selecting an object re-renders two rows, not all of them. */
const ObjectRow = memo(function ObjectRow({ object, index, selected, onSelect }: RowProps) {
  return (
    <tr>
      <td className="text-break">
        <Button
          type="button"
          unstyled
          data-paged-item
          aria-current={selected ? 'true' : undefined}
          aria-describedby={`object-id-${index}`}
          className={selected ? 'text-bold' : undefined}
          onClick={() => onSelect(object.id)}
        >
          <bdi>{labelOf(object)}</bdi>
        </Button>
      </td>
      <td>{object.dcatClass}</td>
      <td className="text-break">
        <code id={`object-id-${index}`} className="font-mono-3xs">
          {object.id}
        </code>
      </td>
    </tr>
  )
})

function PropertyTable({ caption, entries }: { caption: string; entries: [string, unknown][] }) {
  return (
    <Paged items={entries} noun="properties">
      {(shown) => (
        <Table caption={caption} fullWidth compact>
          <thead>
            <tr>
              <th scope="col">Property</th>
              <th scope="col">Value</th>
            </tr>
          </thead>
          <tbody>
            {shown.map(([key, value]) => (
              <tr key={key}>
                <th scope="row" className="text-break" tabIndex={-1} data-paged-item>
                  {key}
                </th>
                <td className="text-break">{textOf(value)}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </Paged>
  )
}

function ObjectDetail({
  object,
  objects,
  onSelect,
  onBack,
}: {
  object: CatalogObject
  objects: DecomposedCatalog['objects']
  onSelect: (id: string) => void
  onBack: () => void
}) {
  useEffect(() => document.getElementById('detail-heading')?.focus(), [])
  const known = getClassProperties(object.dcatClass)
  const entries = Object.entries(object.properties)
  const own = entries.filter(([key]) => known.has(key))
  const other = entries.filter(([key]) => !known.has(key))
  const links = Object.entries(object.links)

  return (
    <section aria-labelledby="detail-heading">
      <h2 id="detail-heading" tabIndex={-1} aria-describedby="detail-class" className="margin-top-0 text-break">
        <bdi>{labelOf(object)}</bdi>
      </h2>
      <p id="detail-class">
        {object.dcatClass} <code className="font-mono-3xs">{object.id}</code>
      </p>
      <Button type="button" unstyled className="target-size" onClick={onBack}>
        Back to the list
      </Button>
      {own.length > 0 ? <PropertyTable caption="Properties" entries={own} /> : <p>No DCAT-US 3.0 properties.</p>}

      <h3>Links</h3>
      {links.length === 0 && <p>No links to other objects.</p>}
      {links.map(([property, ids]) => (
        <div key={property}>
          <h4 className="margin-bottom-0">{property}</h4>
          <Paged items={ids.map((id) => objects.get(id)!)} noun={`${property} links`}>
            {(shown) => (
              <ol className="margin-top-05">
                {shown.map((child) => (
                  <li key={child.id}>
                    <Button
                      type="button"
                      unstyled
                      className="target-size text-break"
                      data-paged-item
                      onClick={() => onSelect(child.id)}
                    >
                      <bdi>{labelOf(child)}</bdi> ({child.dcatClass})
                    </Button>
                  </li>
                ))}
              </ol>
            )}
          </Paged>
        </div>
      ))}

      {other.length > 0 && (
        <>
          <h3>Other properties</h3>
          <p>The DCAT-US 3.0 schema does not define these for {object.dcatClass}. They are kept as they are.</p>
          <PropertyTable caption="Other properties" entries={other} />
        </>
      )}
    </section>
  )
}

/** Memoized, so typing in the load form does not re-render the catalog. */
export default memo(function CatalogBrowser({ name, catalog, onExport, exportStatus }: LoadedCatalog) {
  const { objects } = catalog
  const [selectedId, setSelectedId] = useState<string>()
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => heading.current?.focus(), [])
  // Choosing the open object again still moves focus to it; a new one focuses its heading as it mounts.
  const selectedRef = useRef(selectedId)
  selectedRef.current = selectedId
  const select = useCallback(
    (id: string) =>
      id === selectedRef.current ? document.getElementById('detail-heading')?.focus() : setSelectedId(id),
    [],
  )
  // The selected row if it is shown, else the list's heading.
  const backToList = () =>
    (
      document.querySelector<HTMLElement>('#objects [aria-current="true"]') ??
      document.getElementById('objects-heading')
    )?.focus()

  const all = useMemo(() => [...objects.values()], [objects])
  const counts = useMemo(() => {
    const byClass = new Map<string, number>()
    for (const { dcatClass } of all) byClass.set(dcatClass, (byClass.get(dcatClass) ?? 0) + 1)
    return [...byClass].sort(([a], [b]) => a.localeCompare(b))
  }, [all])
  const selected = selectedId === undefined ? undefined : objects.get(selectedId)

  return (
    <>
      <section aria-labelledby="summary-heading" className="margin-top-4">
        <h2 id="summary-heading" ref={heading} tabIndex={-1} className="text-break">
          Loaded <bdi>{name}</bdi>
        </h2>

        {onExport && (
          <Button type="button" onClick={onExport} className="margin-top-2">
            Export catalog
          </Button>
        )}

        {exportStatus && (
          <div
            id="export-status"
            role={exportStatus.type === 'error' ? 'alert' : 'status'}
            className={`margin-top-2 ${exportStatus.type === 'error' ? 'text-secondary-dark' : ''}`}
          >
            {exportStatus.message}
          </div>
        )}

        <Table
          caption={`${count(objects.size)} ${objects.size === 1 ? 'object' : 'objects'} by class`}
          compact
          className="margin-top-2"
        >
          <thead>
            <tr>
              <th scope="col">Class</th>
              <th scope="col">Objects</th>
            </tr>
          </thead>
          <tbody>
            {counts.map(([dcatClass, n]) => (
              <tr key={dcatClass}>
                <th scope="row">{dcatClass}</th>
                <td>{count(n)}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      </section>

      <div className="grid-row grid-gap margin-top-4">
        <section id="objects" aria-labelledby="objects-heading" className="tablet:grid-col-5">
          <h2 id="objects-heading" tabIndex={-1} className="margin-top-0">
            Objects
          </h2>
          <Paged items={all} noun="objects">
            {(shown) => (
              <Table caption={<span className="usa-sr-only">Objects</span>} className="table-fixed" fullWidth compact>
                <thead>
                  <tr>
                    <th scope="col" className="width-card">
                      Title or name
                    </th>
                    <th scope="col">Class</th>
                    <th scope="col">Id</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((object, i) => (
                    <ObjectRow
                      key={object.id}
                      object={object}
                      index={i}
                      selected={object.id === selectedId}
                      onSelect={select}
                    />
                  ))}
                </tbody>
              </Table>
            )}
          </Paged>
        </section>

        <div className="tablet:grid-col-7">
          {selected ? (
            <ObjectDetail key={selected.id} object={selected} objects={objects} onSelect={select} onBack={backToList} />
          ) : (
            <p className="margin-top-0">Select an object to see its properties and links.</p>
          )}
        </div>
      </div>
    </>
  )
})
