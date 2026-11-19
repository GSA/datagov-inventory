import type { CatalogObject, CatalogWorkspace } from './catalog/types'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const TOKEN = /^[A-Za-z0-9_-]{22}$/
const OBJECT_TYPE = /^[a-z][a-z0-9]*$/

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

/** `<catalog token>/<lowercase class>/<object token>`; only the tokens are identity-bearing. */
export const objectPath = (catalogId: string, object: Pick<CatalogObject, 'id' | 'dcatClass'>) =>
  `${catalogPath(catalogId)}/${object.dcatClass.toLowerCase()}/${uuidToToken(object.id)}`

/** Canonical path for an object identity; the root is addressed by catalog identity alone. */
export const editorPath = (workspace: CatalogWorkspace, object: Pick<CatalogObject, 'id' | 'dcatClass'>) =>
  object.id === workspace.catalog.rootId ? catalogPath(workspace.id) : objectPath(workspace.id, object)

export interface EditorAddress {
  catalogId: string
  objectId?: string
  objectType?: string
}

/** Resolves a catalog root or an exact `<catalog token>/<type>/<object token>` address. */
export const editorAddress = (path: string): EditorAddress | undefined => {
  const parts = path.split('/')
  const [catalogToken] = parts
  if (!TOKEN.test(catalogToken)) return undefined
  const catalogId = tokenToUuid(catalogToken)
  if (!catalogId) return undefined
  if (parts.length === 1) return { catalogId }
  if (parts.length !== 3) return undefined
  const [, objectType, objectToken] = parts
  if (!OBJECT_TYPE.test(objectType) || !TOKEN.test(objectToken)) return undefined
  const objectId = tokenToUuid(objectToken)
  return objectId ? { catalogId, objectId, objectType } : undefined
}
