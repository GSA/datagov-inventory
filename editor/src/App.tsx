import {
  GovBanner,
  Header,
  Title,
  PrimaryNav,
  NavMenuButton,
} from '@trussworks/react-uswds'

function App() {
  return (
    <>
      <GovBanner />
      <Header basic>
        <div className="usa-nav-container">
          <div className="usa-navbar">
            <Title>Inventory Editor</Title>
            <NavMenuButton label="Menu" />
          </div>
          <PrimaryNav items={[]} />
        </div>
      </Header>
      <main id="main-content">
        <div className="grid-container">
          <h1>DCAT-US 3.0 Catalog Editor</h1>
          <p>
            This is the browser-only editor for authoring federal metadata catalogs.
            Catalog editing features will be added in subsequent issues.
          </p>
        </div>
      </main>
    </>
  )
}

export default App
