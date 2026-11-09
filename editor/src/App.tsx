import { GovBanner, Header, Title } from '@trussworks/react-uswds'

function App() {
  return (
    <>
      <GovBanner />
      <Header basic>
        <div className="usa-nav-container">
          <div className="usa-navbar">
            <Title>Inventory Editor</Title>
          </div>
        </div>
      </Header>
      <main id="main-content">
        <div className="grid-container">
          <h1>DCAT-US 3.0 Catalog Editor</h1>
          <p>
            This is the browser-only editor for authoring federal metadata catalogs.
          </p>
        </div>
      </main>
    </>
  )
}

export default App
