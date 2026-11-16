import { useState, type ReactNode } from 'react'
import { Alert, AlertText, Button, Modal, ModalHeading, ModalFooter } from '@trussworks/react-uswds'
import { Link, useNavigate, useParams, useRouterState } from '@tanstack/react-router'
import type { CatalogObject, DecomposedCatalog } from './catalog/decompose'
import { getFormModel } from './schema'
import { type OpenCatalog, useCatalog, usePageTitle, findParentLinks } from './session'
import { CatalogTree } from './CatalogTree'
import { ObjectForm } from './ObjectForm'
import { count, labelOf, pathOf } from './tree'
import { useValidation } from './validation/useValidation'
import { ValidationSummary } from './validation/ValidationSummary'
import { ValidationProgress } from './validation/ValidationProgress'

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

function ObjectDetail({ object, catalog }: { object: CatalogObject; catalog: DecomposedCatalog }) {
  const { deleteObject } = useCatalog()
  const navigate = useNavigate()
  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    objectId: string
    parents: Array<{ id: string; label: string }>
  } | undefined>(undefined)

  const model = getFormModel(object.dcatClass)

  const handleDeleteClick = () => {
    const parentLinks = findParentLinks(catalog, object.id)

    if (parentLinks.length <= 1) {
      const firstParentId = parentLinks[0]?.parentId || catalog.rootId
      deleteObject(object.id)
      navigate({ to: '/editor/$', params: { _splat: firstParentId === catalog.rootId ? '' : pathOf(firstParentId) } })
    } else {
      const parents = parentLinks.map(link => {
        const parent = catalog.objects.get(link.parentId)!
        return { id: parent.id, label: labelOf(parent) }
      })
      setDeleteConfirmation({ objectId: object.id, parents })
    }
  }

  const handleConfirmDelete = () => {
    if (!deleteConfirmation) return
    deleteObject(deleteConfirmation.objectId)
    setDeleteConfirmation(undefined)
    navigate({ to: '/editor' })
  }

  const handleCancelDelete = () => {
    setDeleteConfirmation(undefined)
  }

  if (!model) {
    return (
      <section aria-labelledby="detail-heading">
        <h2 id="detail-heading" tabIndex={-1}>
          {labelOf(object)}
        </h2>
        <p>No form model available for {object.dcatClass}</p>
        <div className="margin-top-2">
          <Button type="button" onClick={handleDeleteClick} secondary>
            Delete object
          </Button>
        </div>
      </section>
    )
  }

  return (
    <>
      <ObjectForm object={object} model={model} />
      <div className="margin-top-3">
        <Button type="button" onClick={handleDeleteClick} secondary>
          Delete object
        </Button>
      </div>
      {deleteConfirmation && (
        <Modal
          forceAction
          aria-labelledby="delete-modal-heading"
          aria-describedby="delete-modal-description"
          id="delete-confirmation-modal"
        >
          <ModalHeading id="delete-modal-heading">
            Delete shared object?
          </ModalHeading>
          <div id="delete-modal-description">
            <p>
              This object is used in {deleteConfirmation.parents.length} places:
            </p>
            <ul>
              {deleteConfirmation.parents.map(parent => (
                <li key={parent.id}>
                  <bdi>{parent.label}</bdi>
                </li>
              ))}
            </ul>
            <p>
              Deleting it will remove it from all of these locations. This action can be undone.
            </p>
          </div>
          <ModalFooter>
            <Button type="button" onClick={handleConfirmDelete}>
              Delete
            </Button>
            <Button type="button" onClick={handleCancelDelete} unstyled>
              Cancel
            </Button>
          </ModalFooter>
        </Modal>
      )}
    </>
  )
}

/** The editor for the open catalog: what it holds on the left, the object at this address on the right. */
function CatalogView({ open, id }: { open: OpenCatalog; id: string }) {
  const { objects, rootId } = open.catalog
  const root = objects.get(rootId)!
  const object = objects.get(id)
  const { undoRemoval, canUndo } = useCatalog()
  const [exportStatus, setExportStatus] = useState<{ type: 'success' | 'error'; message: string }>()
  const [showValidationSummary, setShowValidationSummary] = useState(false)
  const { validateCatalog, catalogSummary, validationProgress, validationState, isReady } = useValidation()
  const [isValidatingCatalog, setIsValidatingCatalog] = useState(false)

  usePageTitle(object ? `${labelOf(object)} (${object.dcatClass})` : 'Not found')

  const handleValidateCatalog = async () => {
    setIsValidatingCatalog(true)
    setShowValidationSummary(true)
    try {
      await validateCatalog()
    } catch (error) {
      console.error('Catalog validation failed:', error)
    } finally {
      setIsValidatingCatalog(false)
    }
  }

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
      <div className="margin-top-2 display-flex flex-gap-1">
        <Button type="button" onClick={handleExport}>
          Export catalog
        </Button>
        {isReady && (
          <Button type="button" onClick={handleValidateCatalog} disabled={isValidatingCatalog} secondary>
            {isValidatingCatalog ? 'Validating...' : 'Validate catalog'}
          </Button>
        )}
        <Button type="button" onClick={undoRemoval} disabled={!canUndo} outline>
          Undo
        </Button>
      </div>
      {validationState === 'validating' && (
        <div className="margin-top-2">
          <ValidationProgress progress={validationProgress} total={objects.size} />
        </div>
      )}
      {showValidationSummary && catalogSummary && (
        <div className="margin-top-2">
          <ValidationSummary catalogSummary={catalogSummary} />
        </div>
      )}
      {exportStatus && (
        <Alert
          id="export-status"
          type={exportStatus.type === 'success' ? 'success' : 'error'}
          role="status"
          className="margin-top-2"
        >
          {/* In AlertText, not bare: USWDS leaves room for the icon only beside the alert body's child elements. */}
          <AlertText>{exportStatus.message}</AlertText>
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
            <ObjectDetail key={object.id} object={object} catalog={open.catalog} />
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
