import { useEffect, useState, useCallback } from 'react'
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
import { CatalogContext, type OpenCatalog, type RemovalRecord, removeLink, deleteObject, undoRemoval } from './session'
import type { CatalogObject } from './catalog/types'
import Landing from './Landing'
import ImportPage from './ImportPage'
import Editor from './Editor'
import { CatalogService } from './application/CatalogService'
import { CatalogOperationsProvider } from './application/CatalogOperationsProvider'
import { IndexedDbCatalogRepository } from './storage/IndexedDbCatalogRepository'

/** Application-scoped service over the current no-op persistence scaffold. */
const catalogRepository = new IndexedDbCatalogRepository()
const catalogService = new CatalogService(catalogRepository)

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
        ;((object && document.getElementById('detail-heading')) || document.querySelector('h1'))?.focus()
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
      <main id="main-content" className="grid-container padding-bottom-8">
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
    // Where to go once a catalog opens: an editor page the user bookmarked before the catalog was open.
    validateSearch: (search): { next?: string } => ({
      next: typeof search.next === 'string' && search.next.startsWith('/editor') ? search.next : undefined,
    }),
    component: ImportPage,
  }),
  // Non-root objects use readable class/title slugs plus an identity-bearing encoded UUID; the root is /editor.
  createRoute({
    getParentRoute: () => root,
    path: 'editor/$',
    component: Editor,
  }),
])

const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

export default function App() {
  const [open, setOpen] = useState<OpenCatalog | undefined>()
  const [removalHistory, setRemovalHistory] = useState<RemovalRecord | undefined>()

  const updateObject = useCallback((id: string, updates: Partial<CatalogObject>) => {
    if (!open) return

    const object = open.workspace.graph.objects.get(id)
    if (!object) return

    const updated = {
      ...object,
      ...updates,
      properties: { ...object.properties, ...updates.properties }
    }

    const newObjects = new Map(open.workspace.graph.objects)
    newObjects.set(id, updated)

    setOpen({
      ...open,
      workspace: {
        ...open.workspace,
        graph: { ...open.workspace.graph, objects: newObjects },
      }
    })
  }, [open])

  const handleRemoveLink = useCallback((parentId: string, property: string, childId: string) => {
    if (!open) return

    const { catalog: updatedCatalog, undoRecord } = removeLink(
      open.workspace.graph,
      parentId,
      property,
      childId
    )

    setOpen({
      ...open,
      workspace: { ...open.workspace, graph: updatedCatalog },
    })
    setRemovalHistory(undoRecord)
  }, [open])

  const handleDeleteObject = useCallback((id: string) => {
    if (!open) return

    const { catalog: updatedCatalog, undoRecord } = deleteObject(
      open.workspace.graph,
      id
    )

    setOpen({
      ...open,
      workspace: { ...open.workspace, graph: updatedCatalog },
    })
    setRemovalHistory(undoRecord)
  }, [open])

  const handleUndoRemoval = useCallback(() => {
    if (!open || !removalHistory) return

    const updatedCatalog = undoRemoval(open.workspace.graph, removalHistory)

    setOpen({
      ...open,
      workspace: { ...open.workspace, graph: updatedCatalog },
    })
    setRemovalHistory(undefined)
  }, [open, removalHistory])

  return (
    <CatalogOperationsProvider operations={catalogService}>
      <CatalogContext.Provider
        value={{
          open,
          setOpen,
          updateObject,
          removeLink: handleRemoveLink,
          deleteObject: handleDeleteObject,
          undoRemoval: handleUndoRemoval,
          canUndo: removalHistory !== undefined,
        }}
      >
        <RouterProvider router={router} />
      </CatalogContext.Provider>
    </CatalogOperationsProvider>
  )
}
