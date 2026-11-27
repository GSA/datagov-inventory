import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import { Alert, AlertHeading, AlertText, Button, ButtonGroup, Icon } from '@trussworks/react-uswds'
import { Link } from '@tanstack/react-router'
import { useCatalog, usePageTitle } from './session'
import { catalogPath } from './objectRoute'
import type { SavedCatalogSummary } from './storage/CatalogRepository'
import StartPage from './StartPage'

type CatalogsState =
  | { status: 'loading' }
  | { status: 'error'; error: Error }
  | { status: 'ready'; catalogs: SavedCatalogSummary[] }

const count = (value: number, noun: string) => `${value.toLocaleString('en-US')} ${value === 1 ? noun : `${noun}s`}`

export function CatalogSummary({ catalog, compact, confirming, deleting, onRequestDelete, onCancelDelete, onConfirmDelete, confirmationHeading }: {
  catalog: SavedCatalogSummary
  compact?: boolean
  confirming?: boolean
  deleting?: boolean
  onRequestDelete?: () => void
  onCancelDelete?: () => void
  onConfirmDelete?: () => void
  confirmationHeading?: RefObject<HTMLHeadingElement | null>
}) {
  return (
    <li className={`saved-catalog ${compact ? 'saved-catalog--compact' : ''} padding-y-2 border-top-1px border-base-lighter`}>
      <div className="saved-catalog__row">
        <div className="flex-1 minw-0">
          <div className="saved-catalog__heading">
            <h2 className={`${compact ? 'font-heading-md' : 'font-heading-lg'} margin-y-0 text-break`}>
              <Link to="/editor/$" params={{ _splat: catalogPath(catalog.id) }} className="usa-link">
                <bdi>{catalog.title}</bdi>
              </Link>
            </h2>
          </div>
          <p className="saved-catalog__metadata margin-y-05 text-base-dark text-break">
            From <bdi>{catalog.sourceName}</bdi> · {count(catalog.objectCount, 'object')}
            {' · '}Created {new Date(catalog.createdAt).toLocaleString()}
            {' · '}Last saved {new Date(catalog.updatedAt).toLocaleString()}
          </p>
        </div>
        {onRequestDelete && !confirming && (
          <Button
            type="button"
            secondary
            className="saved-catalog__action"
            title={`Delete ${catalog.title}`}
            aria-label={`Delete ${catalog.title}`}
            onClick={onRequestDelete}
          >
            <Icon.Delete aria-hidden="true" focusable={false} size={3} />
          </Button>
        )}
      </div>
      {confirming && (
            <Alert type="warning" className="margin-top-2">
              <h3 ref={confirmationHeading} tabIndex={-1} className="usa-alert__heading">
                Delete <bdi>{catalog.title}</bdi>?
              </h3>
              <AlertText>This removes the working data from this browser. This cannot be undone.</AlertText>
              <ButtonGroup className="catalog-actions margin-top-2">
                {[
                  <Button key="keep" type="button" outline onClick={onCancelDelete}>Keep catalog</Button>,
                  <Button key="delete" type="button" secondary aria-disabled={deleting || undefined} onClick={() => { if (!deleting) onConfirmDelete?.() }}>
                    {deleting ? 'Deleting…' : 'Delete catalog'}
                  </Button>,
                ]}
              </ButtonGroup>
            </Alert>
      )}
    </li>
  )
}

function StorageNotice() {
  return (
    <p className="margin-top-1 margin-bottom-2 text-base-dark">
      Catalogs are saved only in this browser on this device. They are not backed up and will be lost if site data is cleared.
    </p>
  )
}

export default function CatalogsPage() {
  usePageTitle('Saved catalogs')
  const { listCatalogs, deleteCatalogs, deleteAllCatalogs } = useCatalog()
  const [state, setState] = useState<CatalogsState>({ status: 'loading' })
  const [confirm, setConfirm] = useState<{ type: 'catalog'; id: string } | { type: 'all' }>()
  const [result, setResult] = useState<string>()
  const [actionError, setActionError] = useState<Error>()
  const [deleting, setDeleting] = useState(false)
  const confirmationHeading = useRef<HTMLHeadingElement>(null)

  const load = useCallback(() => {
     setState({ status: 'loading' })
     void listCatalogs().then(
       (catalogs) => setState({ status: 'ready', catalogs }),
       (error) => setState({ status: 'error', error: error instanceof Error ? error : new Error(String(error)) }),
     )
  }, [listCatalogs])

  useEffect(load, [load])

  useEffect(() => confirmationHeading.current?.focus(), [confirm])

  const remove = async () => {
    const ids = confirm?.type === 'all' && state.status === 'ready'
      ? state.catalogs.map(({ id }) => id)
      : confirm?.type === 'catalog' ? [confirm.id] : []
    if (!confirm || ids.length === 0) return
    setDeleting(true)
    setActionError(undefined)
    try {
      if (confirm.type === 'all') await deleteAllCatalogs()
      else await deleteCatalogs(ids)
      setResult(`${count(ids.length, 'catalog')} ${ids.length === 1 ? 'was' : 'were'} deleted from this browser.`)
      setConfirm(undefined)
      load()
    } catch (error) {
      setActionError(error instanceof Error ? error : new Error(String(error)))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      {state.status === 'ready' && state.catalogs.length === 0 ? <StartPage /> : (
        <>
          <div className="catalog-page-heading">
            <h1 tabIndex={-1} className="margin-y-0">Saved catalogs</h1>
            {state.status === 'ready' && state.catalogs.length > 0 && (
              <Link to="/import" className="usa-button margin-0">Add a catalog</Link>
            )}
          </div>
          <StorageNotice />
        </>
      )}
      {result && <Alert type="success" slim role="status"><AlertText>{result}</AlertText></Alert>}
      {actionError && <Alert type="error" slim role="alert"><AlertText>Catalogs could not be deleted. {actionError.message}</AlertText></Alert>}

      {state.status === 'loading' && <p role="status">Checking this browser for saved catalogs…</p>}
      {state.status === 'error' && (
        <Alert type="error" role="alert">
          <AlertHeading level="h2">Saved catalogs are unavailable</AlertHeading>
          <AlertText>The editor could not read browser storage. {state.error.message}</AlertText>
          <Button type="button" outline onClick={load}>Try again</Button>
        </Alert>
      )}
      {state.status === 'ready' && state.catalogs.length > 0 && (
        <>
          <section className="margin-top-2" aria-label="Saved catalogs">
            <div className="catalog-list-toolbar">
              <span className="catalog-list-toolbar__count text-bold font-sans-md">{count(state.catalogs.length, 'catalog')}</span>
              <div className="catalog-list-toolbar__summary">
                {!confirm && <Button type="button" secondary onClick={() => setConfirm({ type: 'all' })}>Delete all catalogs</Button>}
              </div>
            </div>
            {confirm?.type === 'all' && (
              <Alert type="warning" className="margin-y-2">
                <h2 ref={confirmationHeading} tabIndex={-1} className="usa-alert__heading">
                  Delete all {state.catalogs.length} catalogs?
                </h2>
                <AlertText>This removes the working data from this browser. This cannot be undone.</AlertText>
                <ButtonGroup className="catalog-actions margin-top-2">
                  {[
                    <Button key="keep" type="button" outline onClick={() => setConfirm(undefined)}>Keep catalogs</Button>,
                    <Button key="delete" type="button" secondary aria-disabled={deleting || undefined} onClick={() => { if (!deleting) void remove() }}>
                      {deleting ? 'Deleting…' : 'Delete all catalogs'}
                    </Button>,
                  ]}
                </ButtonGroup>
              </Alert>
            )}
            <ul className="add-list-reset border-bottom-1px border-base-lighter">
              {state.catalogs.map((catalog) => (
                <CatalogSummary
                  key={catalog.id}
                  catalog={catalog}
                  compact
                  confirming={confirm?.type === 'catalog' && confirm.id === catalog.id}
                  deleting={deleting}
                  confirmationHeading={confirmationHeading}
                  onRequestDelete={() => setConfirm({ type: 'catalog', id: catalog.id })}
                  onCancelDelete={() => setConfirm(undefined)}
                  onConfirmDelete={() => void remove()}
                />
              ))}
            </ul>
          </section>
        </>
      )}
    </>
  )
}
