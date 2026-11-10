import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Button, Table } from '@trussworks/react-uswds'
import type { CatalogObject, DecomposedCatalog } from './catalog/decompose'
import { getClassProperties } from './schema'

export interface LoadedCatalog {
  name: string
  catalog: DecomposedCatalog
}

/** Rows rendered at a time, so a big catalog or a huge object cannot freeze the tab. */
const PAGE_SIZE = 500
const LABEL_LENGTH = 200

/**
 * A short name for an object: its title, name, contact name or label, if one has visible
 * characters, cut to 200 characters. Render it in <bdi> so right-to-left overrides in it
 * cannot reorder the text around it.
 */
function labelOf({ properties, dcatClass }: CatalogObject): string {
  for (const key of ['title', 'name', 'fn', 'prefLabel', 'label']) {
    const value = properties[key]
    if (typeof value === 'string' && /[^\p{Cf}\p{Z}\s]/u.test(value)) {
      return value.length > LABEL_LENGTH ? `${value.slice(0, LABEL_LENGTH).replace(/[\uD800-\uDBFF]$/, '')}…` : value
    }
  }
  return `Untitled ${dcatClass}`
}

/** Shows the first PAGE_SIZE items, and more on request. */
function Paged<T>({ items, noun, children }: { items: T[]; noun: string; children: (shown: T[]) => ReactNode }) {
  const [shown, setShown] = useState(PAGE_SIZE)
  return (
    <>
      {children(items.slice(0, shown))}
      {shown < items.length && (
        <Button type="button" outline onClick={() => setShown(shown + PAGE_SIZE)}>
          Show more {noun} ({shown.toLocaleString('en-US')} of {items.length.toLocaleString('en-US')} shown)
        </Button>
      )}
    </>
  )
}

/** Values are untrusted: they are only ever rendered as React text. */
const textOf = (value: unknown) => (typeof value === 'string' ? value : JSON.stringify(value))

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
                <th scope="row" className="text-break">
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
}: {
  object: CatalogObject
  objects: DecomposedCatalog['objects']
  onSelect: (id: string) => void
}) {
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => heading.current?.focus(), [object])
  const known = getClassProperties(object.dcatClass)
  const entries = Object.entries(object.properties)
  const own = entries.filter(([key]) => known.has(key))
  const other = entries.filter(([key]) => !known.has(key))
  const links = Object.entries(object.links)

  return (
    <section aria-labelledby="detail-heading">
      <h2 id="detail-heading" ref={heading} tabIndex={-1} className="margin-top-0">
        <bdi>{labelOf(object)}</bdi>
      </h2>
      <p>
        {object.dcatClass} <code className="font-mono-3xs">{object.id}</code>
      </p>
      {own.length > 0 ? <PropertyTable caption="Properties" entries={own} /> : <p>No DCAT-US 3.0 properties.</p>}

      <h3>Links</h3>
      {links.length === 0 && <p>No links to other objects.</p>}
      {links.map(([property, ids]) => (
        <div key={property}>
          <h4 className="margin-bottom-0">{property}</h4>
          <Paged items={ids} noun={`${property} links`}>
            {(shown) => (
              <ol className="margin-top-05">
                {shown.map((id) => (
                  <li key={id}>
                    <Button type="button" unstyled onClick={() => onSelect(id)}>
                      <bdi>{labelOf(objects.get(id)!)}</bdi> ({objects.get(id)!.dcatClass})
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

export default function CatalogBrowser({ name, catalog }: LoadedCatalog) {
  const { objects } = catalog
  const [selectedId, setSelectedId] = useState<string>()
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => heading.current?.focus(), [])

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
        <Table
          caption={`${objects.size.toLocaleString('en-US')} ${objects.size === 1 ? 'object' : 'objects'} by class`}
          compact
        >
          <thead>
            <tr>
              <th scope="col">Class</th>
              <th scope="col">Objects</th>
            </tr>
          </thead>
          <tbody>
            {counts.map(([dcatClass, count]) => (
              <tr key={dcatClass}>
                <th scope="row">{dcatClass}</th>
                <td>{count.toLocaleString('en-US')}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      </section>

      <div className="grid-row grid-gap margin-top-4">
        <section aria-labelledby="objects-heading" className="tablet:grid-col-5">
          <h2 id="objects-heading" className="margin-top-0">
            Objects
          </h2>
          <Paged items={all} noun="objects">
            {(shown) => (
              <Table fullWidth compact>
                <thead>
                  <tr>
                    <th scope="col">Title or name</th>
                    <th scope="col">Class</th>
                    <th scope="col">Id</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((object) => (
                    <tr key={object.id}>
                      <td className="text-break">
                        <Button
                          type="button"
                          unstyled
                          aria-current={object.id === selectedId ? 'true' : undefined}
                          className={object.id === selectedId ? 'text-bold' : undefined}
                          onClick={() => setSelectedId(object.id)}
                        >
                          <bdi>{labelOf(object)}</bdi>
                        </Button>
                      </td>
                      <td>{object.dcatClass}</td>
                      <td className="text-break">
                        <code className="font-mono-3xs">{object.id}</code>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Paged>
        </section>

        <div className="tablet:grid-col-7">
          {selected ? (
            <ObjectDetail key={selected.id} object={selected} objects={objects} onSelect={setSelectedId} />
          ) : (
            <p className="margin-top-0">Select an object to see its properties and links.</p>
          )}
        </div>
      </div>
    </>
  )
}
