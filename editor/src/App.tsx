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
import type { CatalogObject, DecomposedCatalog } from './catalog/decompose'
import { copyFor, createLinked, linkObject } from './links'
import Landing from './Landing'
import ImportPage from './ImportPage'
import Editor from './Editor'

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
  // An object's path is its id without the "#": `#/dataset/0` is /editor/dataset/0, and the catalog is /editor.
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
  const [open, setOpen] = useState<OpenCatalog | undefined>()
  const [removalHistory, setRemovalHistory] = useState<RemovalRecord | undefined>()

  const updateObject = useCallback((id: string, updates: Partial<CatalogObject>) => {
    if (!open) return

    const object = open.catalog.objects.get(id)
    if (!object) return

    const updated = {
      ...object,
      ...updates,
      properties: { ...object.properties, ...updates.properties }
    }

    const newObjects = new Map(open.catalog.objects)
    newObjects.set(id, updated)

    setOpen({
      ...open,
      catalog: {
        ...open.catalog,
        objects: newObjects
      }
    })
  }, [open])

  const handleRemoveLink = useCallback((parentId: string, property: string, childId: string) => {
    if (!open) return

    const { catalog: updatedCatalog, undoRecord } = removeLink(
      open.catalog,
      parentId,
      property,
      childId
    )

    setOpen({
      ...open,
      catalog: updatedCatalog,
    })
    setRemovalHistory(undoRecord)
  }, [open])

  const handleDeleteObject = useCallback((id: string) => {
    if (!open) return

    const { catalog: updatedCatalog, undoRecord } = deleteObject(
      open.catalog,
      id
    )

    setOpen({
      ...open,
      catalog: updatedCatalog,
    })
    setRemovalHistory(undoRecord)
  }, [open])

  const handleUndoRemoval = useCallback(() => {
    if (!open || !removalHistory) return

    const updatedCatalog = undoRemoval(open.catalog, removalHistory)

    setOpen({
      ...open,
      catalog: updatedCatalog,
    })
    setRemovalHistory(undefined)
  }, [open, removalHistory])

  /** Applies a change that returns the new catalog and an id, and returns the id. */
  const change = useCallback(
    (apply: (catalog: DecomposedCatalog) => { catalog: DecomposedCatalog; id: string }) => {
      if (!open) return undefined
      const { catalog, id } = apply(open.catalog)
      setOpen({ ...open, catalog })
      return id
    },
    [open],
  )
  const handleLinkObject = useCallback(
    (parentId: string, property: string, childId: string, single: boolean) =>
      void change((catalog) => ({ catalog: linkObject(catalog, parentId, property, childId, single), id: childId })),
    [change],
  )
  const handleCreateObject = useCallback(
    (parentId: string, property: string, dcatClass: string, single: boolean) =>
      change((catalog) => createLinked(catalog, parentId, property, dcatClass, single)),
    [change],
  )
  const handleCopyObject = useCallback(
    (parentId: string, property: string, targetId: string) =>
      change((catalog) => copyFor(catalog, parentId, property, targetId)),
    [change],
  )

  return (
    <CatalogContext.Provider
      value={{
        open,
        setOpen,
        updateObject,
        removeLink: handleRemoveLink,
        deleteObject: handleDeleteObject,
        undoRemoval: handleUndoRemoval,
        canUndo: removalHistory !== undefined,
        linkObject: handleLinkObject,
        createObject: handleCreateObject,
        copyObject: handleCopyObject,
      }}
    >
      <RouterProvider router={router} />
    </CatalogContext.Provider>
  )
}
