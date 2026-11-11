import { useEffect, useRef, useState } from 'react'
import {
  Alert,
  AlertHeading,
  AlertText,
  Button,
  ButtonGroup,
  FileInput,
  type FileInputRef,
  Label,
  Select,
  Textarea,
} from '@trussworks/react-uswds'
import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import { loadCatalog } from './loadCatalog'
import { type OpenCatalog, useCatalog, usePageTitle } from './session'

/** The smallest document that decomposes: one Catalog for the user to fill in. */
const BLANK_CATALOG = '{"@type": "Catalog"}'

/** The valid #18 fixtures, bundled as text so "Load sample" goes through the same path as a file. */
const samples = Object.entries(
  import.meta.glob<string>('../fixtures/catalogs/valid/*.json', { eager: true, query: '?raw', import: 'default' }),
).map(([path, text]) => ({ name: path.slice(path.lastIndexOf('/') + 1), text }))

/** Counts loads across visits to this page, so each catalog gets its own `loadId`. */
let loads = 0

export default function ImportPage() {
  const { open, setOpen } = useCatalog()
  const { next } = useSearch({ from: '/import' })
  const navigate = useNavigate()
  usePageTitle('Import a catalog')
  /** A catalog that loaded while another was open, waiting for the user to confirm it replaces that one. */
  const [pending, setPending] = useState<OpenCatalog>()
  const [loading, setLoading] = useState<string>()
  const [error, setError] = useState<{ name: string; message: string; attempt: number }>()
  const [pasted, setPasted] = useState('')
  const [sample, setSample] = useState(samples[0].name)
  const active = useRef<AbortController>(null)
  const fileInput = useRef<FileInputRef>(null)
  const openNow = useRef(open)
  openNow.current = open
  // Leaving the page cancels a load in progress.
  useEffect(() => () => active.current?.abort(), [])
  useEffect(() => {
    if (pending) document.getElementById('replace-heading')?.focus()
  }, [pending])

  function show(catalog: OpenCatalog) {
    setOpen(catalog)
    void navigate({ href: next ?? '/editor' })
  }

  /**
   * Loads a catalog and opens it in the editor; if one is already open, it replaces it only once the user confirms.
   * Confirmation comes after parsing, so input that fails is refused without asking, and a failed or cancelled load
   * changes nothing. Starting a load cancels the one in progress (its file read or worker is stopped) and any
   * replacement waiting to be confirmed.
   */
  async function load(name: string, source: File | string) {
    active.current?.abort()
    const controller = (active.current = new AbortController())
    const current = ++loads
    setError(undefined)
    setPending(undefined)
    setLoading(name)
    try {
      const catalog = await loadCatalog(source, controller.signal)
      if (controller.signal.aborted) return
      const loaded = { name, catalog, loadId: current }
      if (openNow.current) setPending(loaded)
      else show(loaded)
    } catch (e) {
      if (controller.signal.aborted) return
      setError({ name, message: e instanceof Error ? e.message : String(e), attempt: current })
    } finally {
      if (!controller.signal.aborted) stopLoading()
    }
  }

  /** Hides the loading status. Focus in it ("Cancel loading") moves to the page heading rather than to the page. */
  function stopLoading() {
    if (document.getElementById('loading')?.contains(document.activeElement)) document.querySelector('h1')?.focus()
    setLoading(undefined)
  }

  return (
    <>
      <h1 tabIndex={-1}>Import a catalog</h1>
      <p className="usa-intro">
        Choose your organization&apos;s DCAT-US 3.0 catalog: one JSON file with all its datasets, even thousands. It is
        read in this browser. Nothing is uploaded.
      </p>
      {open && (
        <Alert type="info" slim>
          <AlertText>
            <bdi>{open.name}</bdi> is open. Importing another catalog replaces it, and you&apos;ll be asked first.{' '}
            <Link to="/editor/$" params={{ _splat: '' }} className="usa-link">
              Back to the editor
            </Link>
          </AlertText>
        </Alert>
      )}

      <div className="tablet:grid-col-8 margin-top-4">
        <Label htmlFor="catalog-file" className="text-bold">
          Choose a DCAT-US 3.0 JSON file
        </Label>
        <span id="catalog-file-hint" className="usa-hint">
          Or drag it here. It opens as soon as you choose it.
        </span>
        <FileInput
          ref={fileInput}
          id="catalog-file"
          name="catalog-file"
          aria-describedby="catalog-file-hint"
          accept=".json,application/json"
          onChange={(e) => {
            const file = e.target.files?.[0]
            // Clear the input so the same file can be chosen again; the editor names the loaded file.
            fileInput.current?.clearFiles()
            if (file) void load(file.name, file)
          }}
        />
      </div>

      <div id="loading" className={loading ? 'margin-top-4' : undefined}>
        {/* Always rendered, so screen readers announce the text when it appears. */}
        <p role="status" id="loading-status" className="margin-0">
          {loading && (
            <>
              Loading <bdi>{loading}</bdi>…
            </>
          )}
        </p>
        {loading && (
          <>
            <progress aria-labelledby="loading-status" className="display-block margin-top-1" />
            <Button
              type="button"
              outline
              className="margin-top-1"
              onClick={() => {
                active.current?.abort()
                stopLoading()
              }}
            >
              Cancel loading
            </Button>
          </>
        )}
      </div>

      {pending && open && (
        <Alert type="warning" className="margin-top-4">
          <AlertHeading
            level="h2"
            id="replace-heading"
            tabIndex={-1}
            aria-describedby="replace-text"
            className="text-break"
          >
            Replace the open catalog?
          </AlertHeading>
          <AlertText id="replace-text" className="text-break">
            <bdi>{pending.name}</bdi> is ready. Replace <bdi>{open.name}</bdi> with it, or cancel to keep{' '}
            <bdi>{open.name}</bdi> open.
          </AlertText>
          <ButtonGroup>
            <Button type="button" onClick={() => show(pending)}>
              Replace
            </Button>
            <Button type="button" outline onClick={() => setPending(undefined)}>
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
          {open && (
            <AlertText className="text-break">
              The catalog already open (<bdi>{open.name}</bdi>) has not changed.
            </AlertText>
          )}
        </Alert>
      )}

      <h2 className="margin-top-6">Other ways to start</h2>
      <div className="grid-row grid-gap">
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
          <Select id="catalog-sample" name="catalog-sample" value={sample} onChange={(e) => setSample(e.target.value)}>
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
        <div className="tablet:grid-col-4">
          <p className="usa-label margin-top-3">Start from scratch</p>
          <p className="margin-top-1">An empty catalog for you to fill in.</p>
          <Button type="button" outline onClick={() => void load('Blank catalog', BLANK_CATALOG)}>
            Start a blank catalog
          </Button>
        </div>
      </div>
    </>
  )
}
