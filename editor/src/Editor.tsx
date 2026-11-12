import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Alert, Button, Table } from '@trussworks/react-uswds'
import { Link, useParams, useRouterState } from '@tanstack/react-router'
import type { CatalogObject, DecomposedCatalog } from './catalog/decompose'
import { getClassProperties } from './schema'
import { type OpenCatalog, useCatalog, usePageTitle } from './session'
import { CatalogTree } from './CatalogTree'
import { labelOf } from './tree'

/** Rows rendered at a time, so a big catalog or a huge object cannot freeze the tab. */
const PAGE_SIZE = 500
const VALUE_LENGTH = 2_000

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

/** An object's path under /editor is its id without the "#" (`#/dataset/0` → `dataset/0`). */
const pathOf = (id: string) => id.slice(2)

/** A link to an object. */
function ObjectLink({
  object,
  children,
  ...props
}: {
  object: CatalogObject
  children: ReactNode
  className?: string
  'aria-describedby'?: string
}) {
  return (
    <Link
      to="/editor/$"
      params={{ _splat: pathOf(object.id) }}
      activeOptions={{ exact: true }}
      data-paged-item
      {...props}
    >
      {children}
    </Link>
  )
}

/** The objects the open object sits inside, from the catalog down: its id's prefixes that are objects. */
function ancestorsOf(id: string, objects: DecomposedCatalog['objects']): CatalogObject[] {
  const parts = id.split('/')
  return parts
    .slice(1, -1)
    .map((_, i) => objects.get(parts.slice(0, i + 1).join('/')))
    .filter((object): object is CatalogObject => object !== undefined)
}

function ObjectDetail({ object, objects }: { object: CatalogObject; objects: DecomposedCatalog['objects'] }) {
  const known = getClassProperties(object.dcatClass)
  const entries = Object.entries(object.properties)
  const own = entries.filter(([key]) => known.has(key))
  const other = entries.filter(([key]) => !known.has(key))
  const links = Object.entries(object.links)
  const ancestors = ancestorsOf(object.id, objects)

  return (
    <section aria-labelledby="detail-heading">
      {ancestors.length > 0 && (
        <nav className="usa-breadcrumb padding-top-0" aria-label="Where this object is">
          <ol className="usa-breadcrumb__list">
            {ancestors.map((ancestor) => (
              <li key={ancestor.id} className="usa-breadcrumb__list-item">
                <ObjectLink object={ancestor} className="usa-breadcrumb__link">
                  <bdi>{labelOf(ancestor)}</bdi>
                </ObjectLink>
              </li>
            ))}
            <li className="usa-breadcrumb__list-item usa-current" aria-current="page">
              <bdi>{labelOf(object)}</bdi>
            </li>
          </ol>
        </nav>
      )}
      <h2 id="detail-heading" tabIndex={-1} aria-describedby="detail-class" className="margin-top-0 text-break">
        <bdi>{labelOf(object)}</bdi>
      </h2>
      <p id="detail-class">
        {object.dcatClass} <code className="font-mono-3xs">{object.id}</code>
      </p>
      {own.length > 0 ? <PropertyTable caption="Properties" entries={own} /> : <p>No DCAT-US 3.0 properties.</p>}

      <section aria-labelledby="links-heading">
        <h3 id="links-heading">Links</h3>
        {links.length === 0 && <p>No links to other objects.</p>}
        {links.map(([property, ids]) => (
          <div key={property}>
            <h4 className="margin-bottom-0">{property}</h4>
            <Paged items={ids.map((id) => objects.get(id)!)} noun={`${property} links`}>
              {(shown) => (
                <ol className="margin-top-05">
                  {shown.map((child) => (
                    <li key={child.id}>
                      <ObjectLink object={child} className="usa-link target-size text-break">
                        <bdi>{labelOf(child)}</bdi> ({child.dcatClass})
                      </ObjectLink>
                    </li>
                  ))}
                </ol>
              )}
            </Paged>
          </div>
        ))}
      </section>

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

/** The editor for the open catalog: what it holds on the left, the object at this address on the right. */
function CatalogView({ open, id }: { open: OpenCatalog; id: string }) {
  const { objects, rootId } = open.catalog
  const root = objects.get(rootId)!
  const object = objects.get(id)
  const [exportStatus, setExportStatus] = useState<{ type: 'success' | 'error'; message: string }>()
  usePageTitle(object ? `${labelOf(object)} (${object.dcatClass})` : 'Not found')

  async function handleExport() {
    setExportStatus(undefined)

    try {
      const { assemble } = await import('./catalog/assemble')
      const result = assemble(open.catalog)
      const text = JSON.stringify(result.output, null, 2)
      const blob = new Blob([text], { type: 'application/json' })

      const output = result.output as Record<string, unknown>
      const title = typeof output.title === 'string' && output.title ? output.title : open.name.replace(/\.json$/i, '')
      const catalogTitle = title
        .replace(/[/\\:*?"<>|]/g, '-')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .toLowerCase()
      const date = new Date().toISOString().slice(0, 10)
      const filename = `${catalogTitle}-${date}.json`

      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = filename
      anchor.click()
      URL.revokeObjectURL(url)

      let message = 'Catalog exported successfully'
      if (result.sharedObjects.length > 0) {
        message += `. Note: ${result.sharedObjects.length} shared ${result.sharedObjects.length === 1 ? 'object was' : 'objects were'} duplicated at each reference point (DCAT-US 3.0 has no reference format).`
      }

      setExportStatus({ type: 'success', message })
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      setExportStatus({
        type: 'error',
        message: `Export failed: ${message}`,
      })
    }
  }

  return (
    <>
      <h1 tabIndex={-1} className="text-break margin-bottom-0">
        <bdi>{labelOf(root)}</bdi>
      </h1>
      <p className="margin-top-1 text-base-dark">
        From <bdi>{open.name}</bdi> · {count(objects.size)} {objects.size === 1 ? 'object' : 'objects'} · Open in this
        tab only (nothing is uploaded)
      </p>
      <Button type="button" onClick={handleExport} className="margin-top-2">
        Export catalog
      </Button>
      {exportStatus && (
        <Alert
          id="export-status"
          type={exportStatus.type === 'success' ? 'success' : 'error'}
          role="status"
          className="margin-top-2"
        >
          {exportStatus.message}
        </Alert>
      )}
      <div className="grid-row grid-gap-lg margin-top-4">
        <nav aria-labelledby="tree-heading" className="tablet:grid-col-4">
          <h2 id="tree-heading" className="font-heading-md margin-top-0">
            Catalog contents
          </h2>
          <CatalogTree catalog={open.catalog} selectedId={id} />
        </nav>
        <div className="tablet:grid-col-8">
          {object ? (
            <ObjectDetail key={object.id} object={object} objects={objects} />
          ) : (
            <>
              <h2 id="detail-heading" tabIndex={-1} className="margin-top-0">
                Nothing at this address
              </h2>
              <p>This catalog has no object here. The link may be from another catalog.</p>
              <ObjectLink object={root} className="usa-link">
                Open the catalog
              </ObjectLink>
            </>
          )}
        </div>
      </div>
    </>
  )
}

/** Opened at an address with no catalog open: after a reload, or from a bookmark. */
function NoCatalog() {
  usePageTitle('No catalog open')
  const href = useRouterState({ select: (state) => state.location.href })
  return (
    <>
      <h1 tabIndex={-1}>No catalog open</h1>
      <p>
        The editor keeps your catalog in this browser tab only, so it closes when you reload or leave. Import it again
        and this page opens.
      </p>
      <Link to="/import" search={{ next: href }} className="usa-button">
        Import a catalog
      </Link>
    </>
  )
}

export default function Editor() {
  const { open } = useCatalog()
  const { _splat } = useParams({ from: '/editor/$' })
  if (!open) return <NoCatalog />
  return <CatalogView key={open.loadId} open={open} id={_splat ? `#/${_splat}` : open.catalog.rootId} />
}
