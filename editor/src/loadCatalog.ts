import { checkSize, DecomposeError, type CatalogObject, type DecomposedCatalog } from './catalog/decompose'
import type { ParseMessage } from './catalog/parse'

/**
 * Loads a catalog from a file (read in this browser, never uploaded) or from text, such as pasted JSON or a copy
 * restored from browser storage (#28). A file's size is checked before it is read. The text is parsed and decomposed
 * in a worker, so a big file does not freeze the page. Aborting `signal` stops the read or the worker and rejects with
 * the abort reason. Any other failure rejects with a message for the user: a {@link DecomposeError} if the input is
 * refused.
 */
export async function loadCatalog(source: File | string, signal: AbortSignal): Promise<DecomposedCatalog> {
  if (typeof source !== 'string') checkSize(source.size) // so an oversize file is never read into memory
  return parseInWorker(typeof source === 'string' ? source : await readFile(source, signal), signal)
}

/** Reads a file's bytes; the worker decodes them. The handlers are detached once it settles, so nothing keeps the reader or its buffer alive. */
function readFile(file: File, signal: AbortSignal): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    const abort = () => reader.abort()
    const settle = (finish: () => void) => {
      reader.onload = reader.onerror = reader.onabort = null
      signal.removeEventListener('abort', abort)
      finish()
    }
    reader.onload = () => settle(() => resolve(reader.result as ArrayBuffer))
    reader.onerror = () =>
      settle(() =>
        reject(
          new Error(
            'The browser could not read this file. It may have moved or changed since you chose it. Choose it again.',
          ),
        ),
      )
    reader.onabort = () => settle(() => reject(signal.reason))
    signal.addEventListener('abort', abort)
    reader.readAsArrayBuffer(file)
  })
}

/**
 * One worker per load, terminated when it is done or the load is aborted, so a cancelled parse stops at once. It posts
 * the objects in batches (see parse.ts), so the page takes in a big catalog a little at a time.
 */
function parseInWorker(input: string | ArrayBuffer, signal: AbortSignal): Promise<DecomposedCatalog> {
  signal.throwIfAborted()
  return new Promise((resolve, reject) => {
    // A same-origin file, which the CSP's script-src 'self' allows; blob: and inline workers it would block.
    const worker = new Worker(new URL('./catalog/parse.worker.ts', import.meta.url), { type: 'module' })
    const settle = (finish: () => void) => {
      worker.terminate()
      signal.removeEventListener('abort', abort)
      finish()
    }
    const abort = () => settle(() => reject(signal.reason))
    signal.addEventListener('abort', abort)
    const objects = new Map<string, CatalogObject>()
    worker.onmessage = ({ data }: MessageEvent<ParseMessage>) => {
      if ('objects' in data) {
        for (const object of data.objects) {
          // Posting a message drops the null prototypes decompose gives these records; put them back (#20).
          Object.setPrototypeOf(object.properties, null)
          Object.setPrototypeOf(object.links, null)
          objects.set(object.id, object)
        }
      } else if ('rootId' in data) settle(() => resolve({ rootId: data.rootId, objects }))
      else settle(() => reject(data.code ? new DecomposeError(data.code, data.error) : new Error(data.error)))
    }
    worker.onerror = worker.onmessageerror = () =>
      settle(() => reject(new Error('Something went wrong while reading this catalog. Reload the page and try again.')))
    // The file's bytes are moved to the worker, not copied.
    worker.postMessage(input, typeof input === 'string' ? [] : [input])
  })
}
