import { useCallback, useEffect, useRef, useState } from 'react'
import { GovBanner, Header, NavMenuButton, PrimaryNav, Title } from '@trussworks/react-uswds'
import {
  createRootRoute,
  createRoute,
  createRouter,
  Link,
  Outlet,
  RouterProvider,
  useRouter,
} from '@tanstack/react-router'
import { CatalogContext, RestoreResult, SaveStatus } from './session'
import { AutosaveQueue } from './storage/AutosaveQueue'
import type { CatalogObject, CatalogWorkspace } from './catalog/types'
import { keepIndex } from './catalog/uses'
import {
  copyFor,
  createLinked,
  deleteObject,
  linkObject,
  removeLink,
  undoRemoval,
  updateObject as updateCatalogObject,
  type RemovalRecord,
} from './catalog/edit'
import { ValidationProvider } from './validation/ValidationContext'
import Landing from './Landing'
import ImportPage from './ImportPage'
import Editor from './Editor'
import { IndexedDbCatalogRepository } from './storage/IndexedDbCatalogRepository'

const catalogStorage = new IndexedDbCatalogRepository()

/**
 * The page frame. When the path changes, focus moves to the new page's main heading, or within the editor to the
 * object's heading, so keyboard and screen-reader users land on what changed (#30). An object opened from the
 * catalog tree keeps focus in the tree, so the user can keep moving through it (#23).
 */
function Layout() {
  const [menuOpen, setMenuOpen] = useState(false)
  const router = useRouter()
  useEffect(
    () =>
      router.subscribe('onRendered', ({ fromLocation, toLocation, pathChanged }) => {
        if (!fromLocation || !pathChanged || document.activeElement?.closest('[role="tree"]')) return
        const inEditor = (path: string) => path.startsWith('/editor')
        const object = inEditor(fromLocation.pathname) && inEditor(toLocation.pathname)
        const { focus } = toLocation.state
        ;((focus && document.getElementById(focus)) ||
          (object && document.getElementById('detail-heading')) ||
          document.querySelector('h1'))?.focus()
      }),
    [router],
  )
  const close = () => setMenuOpen(false)

  return (
    <>
      <GovBanner />
      <Header basic showMobileOverlay={menuOpen}>
        <div className="usa-nav-container">
          <div className="usa-navbar">
            <Title>
              <Link to="/" onClick={close}>
                Inventory Editor
              </Link>
            </Title>
            <NavMenuButton label="Menu" onClick={() => setMenuOpen(!menuOpen)} />
          </div>
          <PrimaryNav
            aria-label="Primary"
            mobileExpanded={menuOpen}
            onToggleMobileNav={close}
            items={[
              <Link
                key="import"
                to="/import"
                className="usa-nav__link"
                activeProps={{ className: 'usa-current' }}
                onClick={close}
              >
                <span>Import</span>
              </Link>,
              <Link
                key="editor"
                to="/editor/$"
                params={{ _splat: '' }}
                className="usa-nav__link"
                activeProps={{ className: 'usa-current' }}
                onClick={close}
              >
                <span>Editor</span>
              </Link>,
            ]}
          />
        </div>
      </Header>
      <main id="main-content" className="grid-container-widescreen padding-bottom-8">
        <Outlet />
      </main>
    </>
  )
}

function NotFound() {
  return (
    <>
      <h1 tabIndex={-1}>Page not found</h1>
      <p>
        <Link to="/">Go to the start page</Link>
      </p>
    </>
  )
}

const root = createRootRoute({ component: Layout, notFoundComponent: NotFound })
const routeTree = root.addChildren([
  createRoute({ getParentRoute: () => root, path: '/', component: Landing }),
  createRoute({
    getParentRoute: () => root,
    path: 'import',
    component: ImportPage,
  }),
  // Canonical roots and objects begin with an identity-bearing catalog UUID token; /editor is a convenience route.
  createRoute({
    getParentRoute: () => root,
    path: 'editor/$',
    component: Editor,
  }),
])

const router = createRouter({ routeTree })

/** What a link can pass to the page it opens, without putting it in the address (#25). */
declare module '@tanstack/history' {
  interface HistoryState {
    /** The object the user came from, so "Back to …" returns there when the object is used in several places. */
    from?: string
    /** The id of the element to focus instead of the heading: the row "Back to …" returns to. */
    focus?: string
    /** A note to show on the page that opens: that the object was just created or copied. */
    notice?: string
  }
}

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

export default function App() {
  const [open, setOpen] = useState<CatalogWorkspace>()
  const [removalHistory, setRemovalHistory] = useState<RemovalRecord>()
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved')
  const [saveError, setSaveError] = useState<Error>()
  const autosaveQueue = useRef(new AutosaveQueue<CatalogWorkspace>((catalog) => catalogStorage.saveCatalog(catalog)))
  const catalogGeneration = useRef(0)

  const installDurableCatalog = useCallback((catalog: CatalogWorkspace) => {
    catalogGeneration.current++
    setOpen(catalog)
    setRemovalHistory(undefined)
    setSaveError(undefined)
    setSaveStatus('saved')
  }, [])

  /**
   * Waits until the current catalog's latest snapshot is durable before switching catalogs.
   * A failed final save rejects the switch so the in-memory unsaved catalog is not discarded.
   */
  const flushAutosave = useCallback(() => autosaveQueue.current.flush(), [])

  const createAndOpen = useCallback(async (catalog: CatalogWorkspace) => {
    await flushAutosave()
    await catalogStorage.createCatalog(catalog)
    installDurableCatalog(catalog)
  }, [flushAutosave, installDurableCatalog])

  const restoreAndOpen = useCallback(async (id: string): Promise<RestoreResult> => {
    await flushAutosave()
    const catalog = await catalogStorage.loadCatalog(id)
    if (!catalog) return 'not-found'
    installDurableCatalog(catalog)
    return 'opened'
  }, [flushAutosave, installDurableCatalog])

  const autosave = useCallback((catalog: CatalogWorkspace) => {
    const generation = catalogGeneration.current
    setSaveStatus('saving')
    setSaveError(undefined)
    autosaveQueue.current.enqueue(catalog)
    void autosaveQueue.current.flush().then(
      () => {
        if (catalogGeneration.current === generation) setSaveStatus('saved')
      },
      (error) => {
        if (catalogGeneration.current === generation) {
          setSaveError(error instanceof Error ? error : new Error(String(error)))
          setSaveStatus('not-saved')
        }
      },
    )
  }, [])

  /**
   * All in-memory edits must use this path so the changed workspace is queued for autosave.
   * Property edits preserve Undo; remove/delete replace it; undo and add/link/copy explicitly clear it.
   */
  const installEdit = useCallback((
    catalog: CatalogWorkspace,
    history: RemovalRecord | 'preserve' | 'clear' = 'preserve',
  ) => {
    setOpen(catalog)
    if (history !== 'preserve') setRemovalHistory(history === 'clear' ? undefined : history)
    autosave(catalog)
  }, [autosave])

  const updateObject = useCallback((id: string, updates: Partial<CatalogObject>) => {
    if (!open) return
    const catalog = updateCatalogObject(open.catalog, id, updates)
    // Nothing changed, so the catalog keeps its identity, and a catalog check stays current.
    if (catalog === open.catalog) return
    // Saving a field's text leaves every link as it was, so the usage index stays valid.
    if (!updates.links) keepIndex(open.catalog.objects, catalog.objects)
    installEdit({ ...open, catalog })
  }, [installEdit, open])

  const handleRemoveLink = useCallback((parentId: string, property: string, childId: string) => {
    if (!open) return

    const { catalog: updatedCatalog, undoRecord } = removeLink(
      open.catalog,
      parentId,
      property,
      childId
    )

    installEdit({
      ...open,
      catalog: updatedCatalog
      },
      undoRecord
    )
  }, [installEdit, open])

  const handleDeleteObject = useCallback((id: string) => {
    if (!open) return

    const { catalog: updatedCatalog, undoRecord } = deleteObject(
      open.catalog,
      id
    )
    installEdit({
      ...open,
      catalog: updatedCatalog
      },
      undoRecord
    )
  }, [installEdit, open])

  const handleUndoRemoval = useCallback(() => {
    if (!open || !removalHistory) return
    const catalog = undoRemoval(open.catalog, removalHistory)
    installEdit({ ...open, catalog }, 'clear')
  }, [installEdit, open, removalHistory])

  const handleLinkObject = useCallback((parentId: string, property: string, childId: string, single: boolean) => {
    if (!open) return
    const catalog = linkObject(open.catalog, parentId, property, childId, single)
    installEdit({ ...open, catalog }, 'clear')
  }, [installEdit, open])

  const handleCreateObject = useCallback((parentId: string, property: string, dcatClass: string, single: boolean) => {
    if (!open) return undefined
    const { catalog, id } = createLinked(open.catalog, parentId, property, dcatClass, single)
    installEdit({ ...open, catalog }, 'clear')
    return id
  }, [installEdit, open])

  const handleCopyObject = useCallback((parentId: string, property: string, targetId: string) => {
    if (!open) return undefined
    const { catalog, id } = copyFor(open.catalog, parentId, property, targetId)
    installEdit({ ...open, catalog }, 'clear')
    return id
  }, [installEdit, open])

  return (
    <CatalogContext.Provider value={{
      open,
      createAndOpen,
      restoreAndOpen,
      updateObject,
      removeLink: handleRemoveLink,
      deleteObject: handleDeleteObject,
      undoRemoval: handleUndoRemoval,
      canUndo: removalHistory !== undefined,
      linkObject: handleLinkObject,
      createObject: handleCreateObject,
      copyObject: handleCopyObject,
      saveStatus,
      saveError,
    }}>
      <ValidationProvider>
        <RouterProvider router={router} />
      </ValidationProvider>
    </CatalogContext.Provider>
  )
}
