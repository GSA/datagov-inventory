import type { CatalogObject, CatalogWorkspace } from './catalog/types'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const OBJECT_TOKEN = /--([A-Za-z0-9_-]{22})$/
const CATALOG_TOKEN = /^[A-Za-z0-9_-]{22}$/

/** Descriptive route text only; it never determines object identity. */
const slug = (value: string) =>
  value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80) || 'untitled'

const titleOf = (object: CatalogObject) =>
  ['title', 'name', 'fn', 'prefLabel', 'label']
    .map((key) => object.properties[key])
    .find((value): value is string => typeof value === 'string' && value.trim().length > 0) ??
  `untitled-${object.dcatClass}`

/** Encodes all 128 UUID bits as 22 unpadded, URL-safe base64 characters. */
function uuidToToken(uuid: string): string {
  if (!UUID.test(uuid)) throw new Error(`Object id is not a UUID: ${uuid}`)
  const bytes = uuid.replace(/-/g, '').match(/.{2}/g)!.map((byte) => String.fromCharCode(Number.parseInt(byte, 16)))
  return btoa(bytes.join('')).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function tokenToUuid(token: string): string | undefined {
  try {
    const binary = atob(token.replace(/-/g, '+').replace(/_/g, '/') + '==')
    if (binary.length !== 16) return undefined
    const hex = [...binary].map((character) => character.charCodeAt(0).toString(16).padStart(2, '0')).join('')
    const uuid = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
    return UUID.test(uuid) ? uuid : undefined
  } catch {
    return undefined
  }
}

/** The canonical editor path segment for a catalog root. */
export const catalogPath = (catalogId: string) => uuidToToken(catalogId)

/** `<catalog token>/<class>/<label>--<object token>`; only the tokens are identity-bearing. */
export const objectPath = (catalogId: string, object: CatalogObject) =>
  `${catalogPath(catalogId)}/${slug(object.dcatClass)}/${slug(titleOf(object))}--${uuidToToken(object.id)}`

/** Canonical path for an object in a catalog; the root is addressed by catalog identity alone. */
export function editorPath(workspace: CatalogWorkspace, objectId: string): string {
  const object = workspace.catalog.objects.get(objectId)
  if (!object) throw new Error(`Object ${objectId} is not in the catalog.`)
  return objectId === workspace.catalog.rootId ? catalogPath(workspace.id) : objectPath(workspace.id, object)
}

export interface EditorAddress {
  catalogId: string
  objectId?: string
}

/** Resolves the UUID while deliberately accepting stale descriptive slugs. */
export const editorAddress = (path: string): EditorAddress | undefined => {
  const [catalogToken, ...objectParts] = path.split('/')
  if (!CATALOG_TOKEN.test(catalogToken)) return undefined
  const catalogId = tokenToUuid(catalogToken)
  if (!catalogId) return undefined
  if (objectParts.length === 0) return { catalogId }
  const match = OBJECT_TOKEN.exec(objectParts.join('/'))
  const objectId = match ? tokenToUuid(match[1]) : undefined
  return objectId ? { catalogId, objectId } : undefined
}
