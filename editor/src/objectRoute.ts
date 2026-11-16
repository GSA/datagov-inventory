import type { CatalogObject } from './catalog/types'

/** RFC 9562 UUID text accepted for workspace object identity (versions 1–8, standard variant). */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-([1-8])[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
/** The identity-bearing suffix in `<class>/<label>--<token>`; 16 bytes encode to 22 unpadded base64url characters. */
const TOKEN = /--([A-Za-z0-9_-]{22})$/

/** Makes descriptive URL text only; it is never used to identify or look up an object. */
const slug = (value: string) =>
  value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80) || 'untitled'

/** Chooses the same human-facing property families used to label objects in the editor. */
const titleOf = (object: CatalogObject) => {
  const value = ['title', 'name', 'fn', 'prefLabel', 'label']
    .map((key) => object.properties[key])
    .find((candidate): candidate is string => typeof candidate === 'string' && candidate.trim().length > 0)
  return value ?? `untitled-${object.dcatClass}`
}

/** Encodes all 128 UUID bits as compact, URL-safe, reversible text without padding. */
function uuidToToken(uuid: string): string {
  if (!UUID.test(uuid)) throw new Error(`Object id is not a UUID: ${uuid}`)
  const bytes = new Uint8Array(uuid.replace(/-/g, '').match(/.{2}/g)!.map((byte: string) => Number.parseInt(byte, 16)))
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** Decodes and validates an untrusted route token; malformed paths do not throw into rendering. */
function tokenToUuid(token: string): string | undefined {
  try {
    const base64 = token.replace(/-/g, '+').replace(/_/g, '/') + '=='
    const binary = atob(base64)
    if (binary.length !== 16) return undefined
    const hex = [...binary].map((character) => character.charCodeAt(0).toString(16).padStart(2, '0')).join('')
    const uuid = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
    return UUID.test(uuid) ? uuid : undefined
  } catch {
    return undefined
  }
}

/**
 * Produces `<class>/<label>--<base64url UUID>`. Only the final token is identity-bearing,
 * so editing a title does not invalidate an existing URL and duplicate labels remain distinct.
 */
export const objectPath = (object: CatalogObject) =>
  `${slug(object.dcatClass)}/${slug(titleOf(object))}--${uuidToToken(object.id)}`

/**
 * Resolves the UUID from a readable path. Class and label slugs are deliberately ignored,
 * allowing links with stale descriptive text to keep identifying the same object.
 */
export const objectIdFromPath = (path: string): string | undefined => {
  const match = TOKEN.exec(path)
  return match ? tokenToUuid(match[1]) : undefined
}
