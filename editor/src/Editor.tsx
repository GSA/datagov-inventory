import { useState, type ReactNode } from 'react'
import { Alert, Button } from '@trussworks/react-uswds'
import { Link, useParams, useRouterState } from '@tanstack/react-router'
import type { CatalogObject, DecomposedCatalog } from './catalog/decompose'
import { getFormModel } from './schema'
import { type OpenCatalog, useCatalog, usePageTitle } from './session'
import { CatalogTree } from './CatalogTree'
import { ObjectForm } from './ObjectForm'
import { count, labelOf, pathOf } from './tree'

/** A link to an object. */
function ObjectLink({
  object,
  children,
  ...props
}: {
  object: CatalogObject
  children: ReactNode
  className?: string
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

function ObjectDetail({ object }: { object: CatalogObject; objects: DecomposedCatalog['objects'] }) {
  const model = getFormModel(object.dcatClass)

  if (!model) {
    return (
      <section aria-labelledby="detail-heading">
        <h2 id="detail-heading" tabIndex={-1}>
          {labelOf(object)}
        </h2>
        <p>No form model available for {object.dcatClass}</p>
      </section>
    )
  }

  return <ObjectForm object={object} model={model} />
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
