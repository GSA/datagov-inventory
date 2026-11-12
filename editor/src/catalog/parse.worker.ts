// Parses and decomposes off the main thread, so a big file does not freeze the page (#21). See loadCatalog.ts.
import { parse } from './parse'

self.onmessage = (event: MessageEvent<string | ArrayBuffer>) => {
  for (const message of parse(event.data)) self.postMessage(message)
}
