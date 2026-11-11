import { useEffect, useRef, useState } from 'react'
import {
  Alert,
  AlertHeading,
  AlertText,
  Button,
  ButtonGroup,
  FileInput,
  type FileInputRef,
  GovBanner,
  Header,
  Label,
  Select,
  Textarea,
  Title,
} from '@trussworks/react-uswds'
import CatalogBrowser, { type LoadedCatalog } from './CatalogBrowser'
import { loadCatalog } from './loadCatalog'

/** The smallest document that decomposes: one Catalog for the user to fill in. */
const BLANK_CATALOG = '{"@type": "Catalog"}'

/** The valid #18 fixtures, bundled as text so "Load sample" goes through the same path as a file. */
const samples = Object.entries(
  import.meta.glob<string>('../fixtures/catalogs/valid/*.json', { eager: true, query: '?raw', import: 'default' }),
).map(([path, text]) => ({ name: path.slice(path.lastIndexOf('/') + 1), text }))

type Load = LoadedCatalog & { loadId: number }
const keepOpen = ({ loaded }: { loaded?: Load }) => ({ loaded })

function App() {
  /** The open catalog, and one that loaded while it was open, waiting for the user to confirm it replaces it. */
  const [{ loaded, pending }, setCatalogs] = useState<{ loaded?: Load; pending?: Load }>({})
  const [loading, setLoading] = useState<string>()
  const [error, setError] = useState<{ name: string; message: string; attempt: number }>()
  const [pasted, setPasted] = useState('')
  const [sample, setSample] = useState(samples[0].name)
  const attempt = useRef(0)
  const active = useRef<AbortController>(null)
  const fileInput = useRef<FileInputRef>(null)
  useEffect(() => {
    if (pending) document.getElementById('replace-heading')?.focus()
  }, [pending])

  /**
   * Loads a catalog; if one is already open, it replaces it only once the user confirms. Confirmation comes after
   * parsing, so input that fails is refused without asking, and a failed or cancelled load changes nothing. Starting
   * a load cancels the one in progress (its file read or worker is stopped) and any replacement waiting to be confirmed.
   */
  async function load(name: string, source: File | string) {
    active.current?.abort()
    const controller = (active.current = new AbortController())
    const current = ++attempt.current
    setError(undefined)
    setCatalogs(keepOpen)
    setLoading(name)
    try {
      const next = { name, catalog: await loadCatalog(source, controller.signal), loadId: current }
      setCatalogs(({ loaded }) => (loaded ? { loaded, pending: next } : { loaded: next }))
    } catch (e) {
      if (controller.signal.aborted) return
      setError({ name, message: e instanceof Error ? e.message : String(e), attempt: current })
    } finally {
      if (!controller.signal.aborted) setLoading(undefined)
    }
  }

  function cancelLoading() {
    active.current?.abort()
    setLoading(undefined)
    document.getElementById('load-heading')?.focus()
  }

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
        <div className="grid-container padding-bottom-8">
          <h1>DCAT-US 3.0 Catalog Editor</h1>
          <p>This is the browser-only editor for authoring federal metadata catalogs.</p>

          <section aria-labelledby="load-heading">
            <h2 id="load-heading" tabIndex={-1}>
              Load a catalog
            </h2>
            <p>Files and pasted JSON are read in this browser. Nothing is uploaded.</p>
            <div className="grid-row grid-gap">
              <div className="tablet:grid-col-4">
                <Label htmlFor="catalog-file">Choose a DCAT-US 3.0 JSON file</Label>
                <span id="catalog-file-hint" className="usa-hint">
                  It loads as soon as you choose it.
                </span>
                <FileInput
                  ref={fileInput}
                  id="catalog-file"
                  name="catalog-file"
                  aria-describedby="catalog-file-hint"
                  accept=".json,application/json"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    // Clear the input so the same file can be chosen again; the summary names the loaded file.
                    fileInput.current?.clearFiles()
                    if (file) void load(file.name, file)
                  }}
                />
              </div>
              <div className="tablet:grid-col-4">
                <Label htmlFor="catalog-json">Paste JSON</Label>
                <Textarea
                  id="catalog-json"
                  name="catalog-json"
                  spellCheck={false}
                  value={pasted}
                  onChange={(e) => setPasted(e.target.value)}
                />
                <Button type="button" className="margin-top-1" onClick={() => void load('Pasted JSON', pasted)}>
                  Load pasted JSON
                </Button>
              </div>
              <div className="tablet:grid-col-4">
                <Label htmlFor="catalog-sample">Sample catalog</Label>
                <Select
                  id="catalog-sample"
                  name="catalog-sample"
                  value={sample}
                  onChange={(e) => setSample(e.target.value)}
                >
                  {samples.map(({ name }) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </Select>
                <Button
                  type="button"
                  className="margin-top-1"
                  onClick={() => void load(sample, samples.find(({ name }) => name === sample)!.text)}
                >
                  Load sample
                </Button>
              </div>
            </div>
            <Button
              type="button"
              outline
              className="margin-top-3"
              onClick={() => void load('Blank catalog', BLANK_CATALOG)}
            >
              Start a blank catalog
            </Button>
          </section>

          {loading && (
            <div className="margin-top-4">
              <p role="status" id="loading-status" className="margin-bottom-1">
                Loading <bdi>{loading}</bdi>…
              </p>
              <progress aria-labelledby="loading-status" className="display-block" />
              <Button type="button" outline className="margin-top-1" onClick={cancelLoading}>
                Cancel loading
              </Button>
            </div>
          )}

          {pending && loaded && (
            <Alert type="warning" className="margin-top-4">
              <AlertHeading level="h2" id="replace-heading" tabIndex={-1} className="text-break">
                Replace the open catalog?
              </AlertHeading>
              <AlertText className="text-break">
                <bdi>{pending.name}</bdi> is ready. Replace <bdi>{loaded.name}</bdi> with it, or cancel to keep{' '}
                <bdi>{loaded.name}</bdi> open.
              </AlertText>
              <ButtonGroup>
                <Button type="button" onClick={() => setCatalogs(({ pending }) => ({ loaded: pending }))}>
                  Replace
                </Button>
                <Button
                  type="button"
                  outline
                  onClick={() => {
                    setCatalogs(keepOpen)
                    document.getElementById('summary-heading')?.focus()
                  }}
                >
                  Cancel
                </Button>
              </ButtonGroup>
            </Alert>
          )}

          {error && (
            // Keyed by attempt, so a repeated failure is a new alert and is announced again.
            <Alert key={error.attempt} type="error" role="alert" className="margin-top-4">
              <AlertHeading level="h2" className="text-break">
                <bdi>{error.name}</bdi> could not be loaded
              </AlertHeading>
              <AlertText className="text-break">{error.message}</AlertText>
              {loaded && (
                <AlertText className="text-break">
                  The catalog already loaded (<bdi>{loaded.name}</bdi>) has not changed.
                </AlertText>
              )}
            </Alert>
          )}

          {loaded && <CatalogBrowser key={loaded.loadId} name={loaded.name} catalog={loaded.catalog} />}
        </div>
      </main>
    </>
  )
}

export default App
