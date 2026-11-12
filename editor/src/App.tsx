import { useEffect, useState } from 'react'
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
import { CatalogContext, type OpenCatalog } from './session'
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
  // An object's path is its id without the "#": `#/dataset/0` is /editor/dataset/0, and the catalog is /editor.
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
  const [open, setOpen] = useState<OpenCatalog>()
  return (
    <CatalogContext.Provider value={{ open, setOpen }}>
      <RouterProvider router={router} />
    </CatalogContext.Provider>
  )
}
