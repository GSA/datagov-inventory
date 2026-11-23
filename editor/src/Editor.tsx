import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Alert, AlertHeading, AlertText, Button, ButtonGroup } from '@trussworks/react-uswds'
import { Link, useNavigate, useParams } from '@tanstack/react-router'
import type { CatalogGraph, CatalogObject, CatalogWorkspace } from './catalog/types'
import { getFormModel } from './schema'
import { useCatalog, usePageTitle } from './session'
import { findParentLinks } from './catalog/edit'
import { CatalogTree } from './CatalogTree'
import { ObjectForm } from './ObjectForm'
import { classLabel, fieldLabel } from './labels'
import { ancestorIds, count, labelOf, parentsOf } from './tree'
import { catalogPath, editorAddress, editorPath } from './objectRoute'
import { useValidation } from './validation/useValidation'
import { useValidationContext } from './validation/ValidationContext'
import { ValidationSummary } from './validation/ValidationSummary'
import { CatalogCheckStatus } from './validation/CatalogCheckStatus'
import { useDelayedFlag } from './validation/useDelayedFlag'
import { ExportWarningDialog } from './validation/ExportWarningDialog'

/** A link to an object. */
function ObjectLink({
  object,
  open,
  children,
  ...props
}: {
  object: CatalogObject
  open: CatalogWorkspace
  children: ReactNode
  className?: string
}) {
  return (
    <Link
      to="/editor/$"
      params={{ _splat: editorPath(open, object) }}
      activeOptions={{ exact: true }}
      data-paged-item
      {...props}
    >
      {children}
    </Link>
  )
}

/**
 * The objects above the open one, from the catalog down. Followed through links, never guessed from the opaque id.
 */
function Breadcrumb({
  object,
  open,
  parents,
}: {
  object: CatalogObject
  open: CatalogWorkspace
  parents: Map<string, string[]>
}) {
  const ancestors = ancestorIds(object.id, parents).map((id) => open.catalog.objects.get(id)!)
  if (ancestors.length === 0) return null
  return (
    // Hidden on phones, where USWDS shows only its last link, "← parent", beside the form's own "← Back to …".
    <nav className="usa-breadcrumb padding-top-0 display-none tablet:display-block" aria-label="Where this object is">
      <ol className="usa-breadcrumb__list">
        {ancestors.map((ancestor) => (
          <li key={ancestor.id} className="usa-breadcrumb__list-item">
            <ObjectLink object={ancestor} open={open} className="usa-breadcrumb__link">
              <bdi>{labelOf(ancestor)}</bdi>
            </ObjectLink>
          </li>
        ))}
        <li className="usa-breadcrumb__list-item usa-current" aria-current="page">
          <bdi>{labelOf(object)}</bdi>
        </li>
      </ol>
    </nav>
  )
}

/** Deletes the open object. One used in several places asks first, in place (no dialog), listing the places. */
function DeleteObject({ object, open }: { object: CatalogObject; open: CatalogWorkspace }) {
  const { deleteObject } = useCatalog()
  const catalog = open.catalog
  const navigate = useNavigate()
  const [places, setPlaces] = useState<{ key: string; parent: string; field: string }[]>()
  const deleteButton = useRef<HTMLButtonElement>(null)
  const confirming = places !== undefined
  // Focus follows the question: to its heading when it opens, and back to Delete when it is cancelled.
  const opened = useRef(false)
  useEffect(() => {
    if (confirming) document.getElementById('delete-heading')?.focus()
    else if (opened.current) deleteButton.current?.focus()
    opened.current = confirming
  }, [confirming])

  const handleDeleteClick = () => {
    const parentLinks = findParentLinks(catalog, object.id)

    if (parentLinks.length <= 1) {
      const firstParentId = parentLinks[0]?.parentId || catalog.rootId
      deleteObject(object.id)
      const firstParent = catalog.objects.get(firstParentId)
      navigate({
        to: '/editor/$',
        params: {
          _splat: editorPath(open, firstParent ?? open.catalog.objects.get(open.catalog.rootId)!),
        },
      })
    } else {
      setPlaces(
        parentLinks.map((link) => {
          const parent = catalog.objects.get(link.parentId)!
          return { key: `${link.parentId} ${link.property} ${link.position}`, parent: labelOf(parent), field: fieldLabel(link.property) }
        }),
      )
    }
  }

  const handleConfirmDelete = () => {
    deleteObject(object.id)
    setPlaces(undefined)
    navigate({ to: '/editor/$', params: { _splat: catalogPath(open.id) } })
  }

  return (
    <div className="maxw-tablet margin-top-5 padding-top-3 border-top-1px border-base-lighter">
      {confirming ? (
        <Alert type="warning" className="margin-top-0">
          <AlertHeading level="h3" id="delete-heading" tabIndex={-1}>
            Delete this shared object?
          </AlertHeading>
          <AlertText>
            <bdi>{labelOf(object)}</bdi> is used in {count(places.length)} places:
          </AlertText>
          <ul className="usa-list">
            {places.map((place) => (
              <li key={place.key}>
                <bdi>{place.parent}</bdi> › {place.field}
              </li>
            ))}
          </ul>
          <AlertText>Deleting it removes it from all of them. Undo, at the top of the page, puts it back.</AlertText>
          <ButtonGroup className="margin-top-2">
            <Button type="button" secondary onClick={handleConfirmDelete}>
              Delete from all {count(places.length)} places
            </Button>
            <Button type="button" outline onClick={() => setPlaces(undefined)}>
              Cancel
            </Button>
          </ButtonGroup>
        </Alert>
      ) : (
        <Button ref={deleteButton} type="button" onClick={handleDeleteClick} secondary>
          Delete object
        </Button>
      )}
    </div>
  )
}

function ObjectDetail({
  object,
  open,
  parents,
}: {
  object: CatalogObject
  open: CatalogWorkspace
  parents: Map<string, string[]>
}) {
  const model = getFormModel(object.dcatClass)

  if (!model) {
    return (
      <section aria-labelledby="detail-heading">
        <Breadcrumb object={object} open={open} parents={parents} />
        <h2 id="detail-heading" tabIndex={-1}>
          {labelOf(object)}
        </h2>
        <p>No form model available for {classLabel(object.dcatClass)}</p>
        <DeleteObject object={object} open={open} />
      </section>
    )
  }

  return (
    <>
      <Breadcrumb object={object} open={open} parents={parents} />
      <ObjectForm object={object} model={model} parentId={ancestorIds(object.id, parents).pop()} />
      <DeleteObject object={object} open={open} />
    </>
  )
}

/** The editor for the open catalog: what it holds on the left, the object at this address on the right. */
function CatalogView({ open, id }: { open: CatalogWorkspace; id: string }) {
  const { objects, rootId } = open.catalog
  const root = objects.get(rootId)!
  const object = objects.get(id)
  const parents = useMemo(() => parentsOf(open.catalog), [open.catalog])
  const { undoRemoval, canUndo } = useCatalog()
  const [exportStatus, setExportStatus] = useState<{ type: 'success' | 'error'; message: string }>()
  const [showExportWarning, setShowExportWarning] = useState(false)
  // The catalog as it was checked: any change (an edit, link, create, copy, delete or undo) makes a new one, so the
  // result is out of date when this is not the open catalog. Unset until a check in this view finishes.
  const [checkedCatalog, setCheckedCatalog] = useState<CatalogGraph>()
  const checkIsStale = checkedCatalog !== open.catalog
  const [showValidationSummary, setShowValidationSummary] = useState(true)
  const { validateCatalog, catalogSummary, isReady } = useValidation()
  const validationContext = useValidationContext()
  const [isValidatingCatalog, setIsValidatingCatalog] = useState(false)
  // Most checks finish before a person would notice (a 3,000-dataset catalog in about 0.2 s), so the button says
  // "Validating…" only if a check runs past 400 ms, and then for at least 500 ms, so it neither flashes nor blinks.
  const showValidating = useDelayedFlag(isValidatingCatalog, 400, 500)
  const [validationResult, setValidationResult] = useState('')
  const navigate = useNavigate()

  usePageTitle(object ? `${labelOf(object)} (${classLabel(object.dcatClass)})` : 'Not found')

  const handleValidateCatalog = async () => {
    // Ignores clicks while busy instead of disabling the button, which would take focus from it.
    if (isValidatingCatalog || showValidating) return
    setIsValidatingCatalog(true)
    setValidationResult('')
    const catalog = open.catalog
    try {
      const { totalErrors } = await validateCatalog()
      setCheckedCatalog(catalog)
      setShowValidationSummary(true)
      setValidationResult(
        `Validation finished: ${totalErrors ? `${count(totalErrors)} ${totalErrors === 1 ? 'error' : 'errors'}` : 'no errors'} found.`,
      )
    } catch (error) {
      console.error('Catalog validation failed:', error)
      setValidationResult('Validation could not finish. Try again.')
    } finally {
      setIsValidatingCatalog(false)
    }
  }

  function initiateExport() {
    if (catalogSummary && !catalogSummary.valid) {
      setShowExportWarning(true)
      return
    }
    performExport()
  }

  async function performExport() {
    setExportStatus(undefined)
    setShowExportWarning(false)

    try {
      const { assemble } = await import('./catalog/assemble')
      const result = assemble(open.catalog)
      const text = JSON.stringify(result.output, null, 2)
      const blob = new Blob([text], { type: 'application/json' })

      const output = result.output as Record<string, unknown>
      const title = typeof output.title === 'string' && output.title ? output.title : open.sourceName.replace(/\.json$/i, '')
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
      if (catalogSummary && !catalogSummary.valid) {
        message += ` (with ${catalogSummary.totalErrors} validation ${catalogSummary.totalErrors === 1 ? 'error' : 'errors'})`
      }
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
        From <bdi>{open.sourceName}</bdi> · {count(objects.size)} {objects.size === 1 ? 'object' : 'objects'} · Open in this
        tab only (nothing is uploaded)
      </p>
      {/* The actions, and the last check's status beside them (under them, on a phone). */}
      <div className="display-flex flex-wrap flex-align-center margin-top-105">
        {/* ButtonGroup wraps each child in an item, so the optional button is left out of the list rather than rendered as false. */}
        {/* In a row that wraps, even on phones, where USWDS would stack three full-width buttons above the tree. */}
        <ButtonGroup className="catalog-actions flex-row flex-wrap margin-right-2">
          {[
            <Button key="export" type="button" onClick={initiateExport}>
              Export catalog
            </Button>,
            ...(isReady
              ? [
                  <Button
                    key="validate"
                    type="button"
                    onClick={handleValidateCatalog}
                    aria-disabled={showValidating || undefined}
                    outline
                  >
                    {/* Both labels hold the space, so the button keeps its width and Undo stays put. */}
                    <span className="stacked-labels">
                      <span className={showValidating ? 'stacked-labels__off' : undefined}>Validate catalog</span>
                      <span className={showValidating ? undefined : 'stacked-labels__off'}>Validating…</span>
                    </span>
                  </Button>,
                ]
              : []),
            <Button key="undo" type="button" onClick={undoRemoval} disabled={!canUndo} outline>
              Undo
            </Button>,
          ]}
        </ButtonGroup>
        {checkedCatalog && catalogSummary && (
          <CatalogCheckStatus
            totalErrors={catalogSummary.totalErrors}
            timestamp={catalogSummary.timestamp}
            stale={checkIsStale}
            resultsShown={showValidationSummary}
            resultsId="validation-results"
            onToggleResults={() => setShowValidationSummary((shown) => !shown)}
          />
        )}
      </div>
      {/* One polite announcement when a slow check starts, and one when any check ends; never a progress bar in the page. */}
      <p role="status" className="usa-sr-only">
        {isValidatingCatalog && showValidating ? 'Validating catalog…' : validationResult}
      </p>
      {checkedCatalog && catalogSummary && !catalogSummary.valid && showValidationSummary && (
        <ValidationSummary
          id="validation-results"
          catalogSummary={catalogSummary}
          stale={checkIsStale}
          objectResults={Array.from(open.catalog.objects.values())
            .map((obj) => {
              const errors = validationContext.getObjectErrors(obj.id)
              return {
                objectId: obj.id,
                label: labelOf(obj),
                objectType: obj.dcatClass,
                valid: errors.length === 0,
                errors,
              }
            })
            .filter((r) => !r.valid)}
          onNavigateToObject={(objectId) => {
            const object = open.catalog.objects.get(objectId)!
            navigate({
              to: '/editor/$',
              params: { _splat: editorPath(open, object) },
            })
          }}
        />
      )}
      {catalogSummary && (
        <ExportWarningDialog
          isOpen={showExportWarning}
          catalogSummary={catalogSummary}
          onCancel={() => setShowExportWarning(false)}
          onExport={performExport}
        />
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
      <div className="grid-row grid-gap-lg margin-top-3">
        <nav aria-labelledby="tree-heading" className="editor-nav tablet:grid-col-5 desktop:grid-col-4">
          <h2 id="tree-heading" className="font-sans-md margin-top-0">
            Catalog contents
          </h2>
          <CatalogTree
            catalog={open.catalog}
            pathFor={(objectId) => editorPath(open, open.catalog.objects.get(objectId)!)}
            parents={parents}
            selectedId={id}
          />
        </nav>
        <div className="tablet:grid-col-7 desktop:grid-col-8 margin-top-4 tablet:margin-top-0 tablet:padding-top-2">
          {object ? (
            <ObjectDetail key={object.id} object={object} open={open} parents={parents} />
          ) : (
            <>
              <h2 id="detail-heading" tabIndex={-1} className="margin-top-0">
                Nothing at this address
              </h2>
              <p>This catalog has no object here. The link may be from another catalog.</p>
              <ObjectLink object={root} open={open} className="usa-link">
                Open the catalog
              </ObjectLink>
            </>
          )}
        </div>
      </div>
    </>
  )
}

/** The generic `/editor` entry point when this tab has no working catalog. */
function NoCatalog() {
  usePageTitle('No catalog open')
  return (
    <>
      <h1 tabIndex={-1}>No catalog open</h1>
      <p>
        The editor keeps your catalog in this browser tab only, so it closes when you reload or leave. Import it again
        to create a new working copy.
      </p>
      <Link to="/import" className="usa-button">
        Import a catalog
      </Link>
    </>
  )
}

/** A well-formed catalog address that this browser cannot currently restore. */
function CatalogNotFound() {
  usePageTitle('Catalog not found')
  return (
    <>
      <h1 tabIndex={-1}>Catalog not found in this browser</h1>
      <p>
        This address identifies a specific catalog, but it is not available in this browser. It may belong to another
        browser or device, or its site data may have been cleared.
      </p>
      <Link to="/import" className="usa-button">
        Import a catalog
      </Link>
    </>
  )
}

/** An `/editor/...` path that does not contain a valid catalog/object identity. */
function InvalidEditorAddress() {
  usePageTitle('Invalid editor address')
  return (
    <>
      <h1 tabIndex={-1}>Invalid editor address</h1>
      <p>This editor address is incomplete or malformed.</p>
      <Link to="/editor/$" params={{ _splat: '' }} className="usa-button">
        Open the editor
      </Link>
    </>
  )
}

/** Replaces the generic `/editor` entry point with the open catalog's canonical address. */
function CatalogRedirect({ catalogId }: { catalogId: string }) {
  const navigate = useNavigate()
  useEffect(() => {
    void navigate({ to: '/editor/$', params: { _splat: catalogPath(catalogId) }, replace: true })
  }, [catalogId, navigate])
  return null
}

export default function Editor() {
  const { open } = useCatalog()
  const { _splat } = useParams({ from: '/editor/$' })

  if (!_splat) return open ? <CatalogRedirect catalogId={open.id} /> : <NoCatalog />

  const address = editorAddress(_splat)
  if (!address) return <InvalidEditorAddress />

  // Until browser persistence exists, this tab can open only its in-memory catalog. Once #28 adds persistence, a
  // valid `/editor/<catalog-token>...` route should first restore that exact catalog by id (or report not found /
  // storage unavailable), then resolve the optional object id within it; it must not display a different open catalog.
  if (!open || address.catalogId !== open.id) return <CatalogNotFound />

  const object = address.objectId ? open.catalog.objects.get(address.objectId) : undefined
  if (object && address.objectType !== object.dcatClass.toLowerCase()) return <InvalidEditorAddress />

  return <CatalogView key={open.id} open={open} id={address.objectId ?? open.catalog.rootId} />
}
