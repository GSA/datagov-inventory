import { useEffect, useRef, useState } from 'react'
import {
  Alert,
  AlertHeading,
  AlertText,
  Button,
  FileInput,
  type FileInputRef,
  GovBanner,
  Header,
  Label,
  Select,
  Textarea,
  Title,
} from '@trussworks/react-uswds'
import { checkSize, decompose } from './catalog/decompose'
import CatalogBrowser, { type LoadedCatalog } from './CatalogBrowser'

/** The valid #18 fixtures, bundled as text so "Load sample" goes through the same path as a file. */
const samples = Object.entries(
  import.meta.glob<string>('../fixtures/catalogs/valid/*.json', { eager: true, query: '?raw', import: 'default' }),
).map(([path, text]) => ({ name: path.slice(path.lastIndexOf('/') + 1), text }))

/** Reads a file in the browser (it is never uploaded) as strict UTF-8, which JSON requires. */
function readFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        resolve(new TextDecoder('utf-8', { fatal: true }).decode(reader.result as ArrayBuffer))
      } catch {
        reject(new Error('This file is not UTF-8 text. Save it as UTF-8 JSON and try again.'))
      }
    }
    reader.onerror = () =>
      reject(
        new Error(
          'The browser could not read this file. It may have moved or changed since you chose it. Choose it again.',
        ),
      )
    reader.readAsArrayBuffer(file)
  })
}

function App() {
  const [loaded, setLoaded] = useState<LoadedCatalog & { loadId: number }>()
  const [error, setError] = useState<{ name: string; message: string; attempt: number }>()
  const [pasted, setPasted] = useState('')
  const [sample, setSample] = useState(samples[0].name)
  const attempt = useRef(0)
  const fileInput = useRef<FileInputRef>(null)
  // Move focus to a new error, so keyboard and screen reader users land on it.
  useEffect(() => document.getElementById('load-error')?.focus(), [error])

  /** Replaces the loaded catalog only if the new one decomposes; a failed load leaves it as it was. */
  async function load(name: string, read: () => string | Promise<string>) {
    const current = ++attempt.current
    setError(undefined)
    try {
      const catalog = decompose(await read())
      if (current !== attempt.current) return
      setLoaded({ name, catalog, loadId: current })
    } catch (e) {
      if (current !== attempt.current) return
      setError({ name, message: e instanceof Error ? e.message : String(e), attempt: current })
    }
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
            <h2 id="load-heading">Load a catalog</h2>
            <p>Files and pasted JSON are read in this browser. Nothing is uploaded.</p>
            <div className="grid-row grid-gap">
              <div className="tablet:grid-col-4">
                <Label htmlFor="catalog-file">Choose a DCAT-US 3.0 JSON file</Label>
                <FileInput
                  ref={fileInput}
                  id="catalog-file"
                  name="catalog-file"
                  accept=".json,application/json"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    // Clear the input so the same file can be chosen again; the summary names the loaded file.
                    fileInput.current?.clearFiles()
                    if (file) {
                      void load(file.name, () => {
                        checkSize(file.size) // before reading, so an oversize file is never read into memory
                        return readFile(file)
                      })
                    }
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
                <Button type="button" className="margin-top-1" onClick={() => void load('Pasted JSON', () => pasted)}>
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
                  onClick={() => void load(sample, () => samples.find(({ name }) => name === sample)!.text)}
                >
                  Load sample
                </Button>
              </div>
            </div>
          </section>

          {error && (
            // Keyed by attempt, so a repeated failure is a new alert and is announced again.
            <Alert key={error.attempt} type="error" role="alert" className="margin-top-4">
              <AlertHeading level="h2" id="load-error" tabIndex={-1} className="text-break">
                <bdi>{error.name}</bdi> could not be loaded
              </AlertHeading>
              <AlertText>
                {error.message}
                {loaded && (
                  <>
                    {' '}
                    The catalog already loaded (<bdi>{loaded.name}</bdi>) has not changed.
                  </>
                )}
              </AlertText>
            </Alert>
          )}

          {loaded && <CatalogBrowser key={loaded.loadId} name={loaded.name} catalog={loaded.catalog} />}
        </div>
      </main>
    </>
  )
}

export default App
