import { decompose, type CatalogObject } from './decompose'

/** What the parse worker posts: the objects in batches, then the root's id; or else one error. */
export type ParseMessage = { objects: CatalogObject[] } | { rootId: string } | { error: string }

/**
 * Objects per message. The page deserializes each message in one task, so a whole 25 MB catalog in one message
 * would block it for about 100 ms (400 ms on a slow CPU); a batch takes a few milliseconds.
 */
export const BATCH_SIZE = 5_000

/**
 * What the parse worker does with a load: decodes a file's bytes as strict UTF-8, which JSON requires, decomposes the
 * text, and returns the messages to post. An error becomes a message rather than being thrown.
 */
export function parse(input: string | ArrayBuffer): ParseMessage[] {
  try {
    const catalog = decompose(typeof input === 'string' ? input : decodeUtf8(input))
    const objects = [...catalog.objects.values()]
    const messages: ParseMessage[] = []
    for (let i = 0; i < objects.length; i += BATCH_SIZE) messages.push({ objects: objects.slice(i, i + BATCH_SIZE) })
    return [...messages, { rootId: catalog.rootId }]
  } catch (error) {
    return [{ error: error instanceof Error ? error.message : String(error) }]
  }
}

function decodeUtf8(bytes: ArrayBuffer): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    throw new Error('This file is not UTF-8 text. Save it as UTF-8 JSON and try again.')
  }
}
