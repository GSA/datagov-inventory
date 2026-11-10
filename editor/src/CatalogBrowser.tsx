import { useEffect, useMemo, useRef, useState } from 'react'
import { Button, Table } from '@trussworks/react-uswds'
import type { CatalogObject, DecomposedCatalog } from './catalog/decompose'
import { getClassProperties } from './schema'

export interface LoadedCatalog {
  name: string
  catalog: DecomposedCatalog
}

/** Rows rendered at a time, so a 3,000-dataset catalog does not render 20,000 rows at once. */
const PAGE_SIZE = 500

/** A short name for an object: its title, name, contact name or label, if it has one. */
function labelOf({ properties, dcatClass }: CatalogObject): string {
  for (const key of ['title', 'name', 'fn', 'prefLabel', 'label']) {
    const value = properties[key]
    if (typeof value === 'string' && value.trim()) return value
  }
  return `Untitled ${dcatClass}`
}

/** Values are untrusted: they are only ever rendered as React text. */
const textOf = (value: unknown) => (typeof value === 'string' ? value : JSON.stringify(value))

function PropertyTable({ caption, entries }: { caption: string; entries: [string, unknown][] }) {
  return (
    <Table caption={caption} fullWidth compact>
      <thead>
        <tr>
          <th scope="col">Property</th>
          <th scope="col">Value</th>
        </tr>
      </thead>
      <tbody>
        {entries.map(([key, value]) => (
          <tr key={key}>
            <th scope="row">{key}</th>
            <td className="text-break">{textOf(value)}</td>
          </tr>
        ))}
      </tbody>
    </Table>
  )
}

function ObjectDetail({ object, objects, onSelect }: {
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
        {labelOf(object)}
      </h2>
      <p>
        {object.dcatClass} <code className="font-mono-3xs">{object.id}</code>
      </p>
      {own.length > 0 ? <PropertyTable caption="Properties" entries={own} /> : <p>No properties.</p>}

      <h3>Links</h3>
      {links.length === 0 && <p>No links to other objects.</p>}
      {links.map(([property, ids]) => (
        <div key={property}>
          <h4 className="margin-bottom-0">{property}</h4>
          <ol className="margin-top-05">
            {ids.map((id) => (
              <li key={id}>
                <Button type="button" unstyled onClick={() => onSelect(id)}>
                  {labelOf(objects.get(id)!)} ({objects.get(id)!.dcatClass})
                </Button>
              </li>
            ))}
          </ol>
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
  const [shown, setShown] = useState(PAGE_SIZE)
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
        <h2 id="summary-heading" ref={heading} tabIndex={-1}>
          Loaded {name}
        </h2>
        <Table caption={`${objects.size.toLocaleString('en-US')} objects by class`} compact>
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
          <h2 id="objects-heading" className="margin-top-0">Objects</h2>
          <Table fullWidth compact>
            <thead>
              <tr>
                <th scope="col">Title or name</th>
                <th scope="col">Class</th>
                <th scope="col">Id</th>
              </tr>
            </thead>
            <tbody>
              {all.slice(0, shown).map((object) => (
                <tr key={object.id}>
                  <td className="text-break">
                    <Button
                      type="button"
                      unstyled
                      aria-current={object.id === selectedId ? 'true' : undefined}
                      className={object.id === selectedId ? 'text-bold' : undefined}
                      onClick={() => setSelectedId(object.id)}
                    >
                      {labelOf(object)}
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
          {shown < all.length && (
            <Button type="button" outline onClick={() => setShown(shown + PAGE_SIZE)}>
              Show more objects ({shown.toLocaleString('en-US')} of {all.length.toLocaleString('en-US')} shown)
            </Button>
          )}
        </section>

        <div className="tablet:grid-col-7">
          {selected ? (
            <ObjectDetail object={selected} objects={objects} onSelect={setSelectedId} />
          ) : (
            <p className="margin-top-0">Select an object to see its properties and links.</p>
          )}
        </div>
      </div>
    </>
  )
}
