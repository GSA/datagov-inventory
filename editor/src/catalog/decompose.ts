/**
 * Breaks a nested DCAT-US 3.0 document into objects and ordered links (#20), in the shape
 * of ADR 0005: each object has an id, its DCAT class and its own scalar properties
 * (`metadata_object`); each class-valued property is an ordered list of child ids
 * (`object_reference`, where the ordinal is the list index).
 *
 * Pure TypeScript with no React or DOM imports, so it runs in a worker and in tests.
 * The input is untrusted: its size, depth and object count are bounded (SI-10), and
 * property names are copied into null-prototype records so `__proto__` cannot pollute.
 */
import { classSchemas, getClassProperties } from '../schema'

export interface CatalogObject {
  /**
   * Synthetic and deterministic: the object's JSON Pointer in the source document, as a
   * URI fragment (`#` is the root, `#/dataset/0/distribution/1` a distribution). Its
   * `@id`, if any, stays in `properties`, because input `@id`s can repeat. Treat it as
   * opaque: it names where the object was loaded from, not where it is after edits.
   */
  id: string
  /**
   * The DCAT-US 3.0 class the schema allows where the object sits. Its `@type` only
   * chooses among several, or names a subclass (an Organization where an Agent is
   * allowed). The top level's class comes from its `@type`.
   */
  dcatClass: string
  /** Every property that is not a link, unknown ones included, with values exactly as read. */
  properties: Record<string, unknown>
  /** Class-valued properties: property name → child ids, in source order. */
  links: Record<string, string[]>
  /** Link properties whose source value was one object rather than an array, so export can write them back the same way. */
  singleLinks: string[]
}

export interface DecomposedCatalog {
  rootId: string
  /** Every object by id, in document order (each parent before its children). */
  objects: Map<string, CatalogObject>
}

export interface DecomposeLimits {
  /** Largest input accepted, in UTF-8 bytes. */
  maxBytes: number
  /** Deepest nesting of JSON objects and arrays accepted (the top-level object is depth 1). */
  maxDepth: number
  /** Most JSON objects (`{...}`) a document may contain, counted before it is parsed; DCAT objects are a subset. */
  maxObjects: number
}

/**
 * Sized for #29's 3,000+ datasets with room to spare. The DOJ catalog is about 1,800
 * datasets in 2.4 MB (DCAT-US 1.1). A generated 3.0 catalog of 3,000 datasets, each with a
 * publisher, contact points, 2-4 distributions, temporal and spatial coverage, measured
 * 7.4 MB minified and 10.3 MB pretty-printed, with 37,000 JSON objects. So 25 MB is about
 * 2.5-3.5 times that (6,000 pretty-printed datasets still fit), and 250,000 objects about
 * 7 times. At those limits decompose took 0.2 s and kept 140 MB at most (review round 7),
 * well short of exhausting a tab. Real documents nest under about 15 levels (catalog →
 * dataset → attribution → agent → sub-organization ...); 64 bounds the walk with headroom.
 */
export const DEFAULT_LIMITS: DecomposeLimits = { maxBytes: 25_000_000, maxDepth: 64, maxObjects: 250_000 }

export type DecomposeErrorCode = 'too-large' | 'too-deep' | 'too-many-objects' | 'invalid-json' | 'no-dcat-class'

export class DecomposeError extends Error {
  name = 'DecomposeError'
  constructor(readonly code: DecomposeErrorCode, message: string) {
    super(message)
  }
}

/** `25 MB`, or `900 bytes` under a megabyte. */
export const formatBytes = (bytes: number) =>
  bytes >= 1_000_000 ? `${Number((bytes / 1_000_000).toFixed(1))} MB` : `${bytes.toLocaleString('en-US')} bytes`

/** Refuses an input of `bytes` UTF-8 bytes over the limit; call it on a file's size before reading it. */
export function checkSize(bytes: number, limits: Partial<DecomposeLimits> = {}): void {
  const { maxBytes } = { ...DEFAULT_LIMITS, ...limits }
  if (bytes > maxBytes) throw tooLarge(maxBytes, bytes)
}

const tooLarge = (maxBytes: number, bytes?: number) =>
  new DecomposeError(
    'too-large',
    `This document is ${bytes === undefined ? '' : `${bytes.toLocaleString('en-US')} bytes, `}over the ${formatBytes(maxBytes)} size limit.`,
  )

/** Parses and decomposes a DCAT-US 3.0 JSON document. Throws a {@link DecomposeError}; schema errors alone do not. */
export function decompose(text: string, limits: Partial<DecomposeLimits> = {}): DecomposedCatalog {
  const { maxBytes, maxDepth, maxObjects } = { ...DEFAULT_LIMITS, ...limits }
  // UTF-8 never takes fewer bytes than UTF-16 code units, so the length alone refuses most oversize
  // text without encoding it, and only text near the limit is counted exactly.
  if (text.length > maxBytes) throw tooLarge(maxBytes)
  checkSize(text.length * 3 > maxBytes ? new TextEncoder().encode(text).byteLength : text.length, { maxBytes })
  scan(text, maxDepth, maxObjects)
  if (!text.trim()) throw new DecomposeError('invalid-json', 'This document is empty.')

  let root: unknown
  try {
    root = JSON.parse(text.replace(/^\uFEFF/, ''))
  } catch (error) {
    throw new DecomposeError('invalid-json', `This is not valid JSON: ${(error as Error).message}`)
  }
  const rootClass = isObject(root) ? classOfRoot(root) : undefined
  if (!isObject(root) || !rootClass) {
    throw new DecomposeError(
      'no-dcat-class',
      isObject(root) && root['@type'] === 'dcat:Catalog'
        ? 'No DCAT-US 3.0 class found: this looks like a DCAT-US 1.1 data.json file. The editor reads DCAT-US 3.0 only.'
        : 'No DCAT-US 3.0 class found: the top level must be a JSON object with "@type": "Catalog" (or another DCAT-US 3.0 class).',
    )
  }

  const objects = new Map<string, CatalogObject>()
  const add = (node: Record<string, unknown>, dcatClass: string, id: string): string => {
    const object: CatalogObject = {
      id,
      dcatClass,
      properties: Object.create(null),
      links: Object.create(null),
      singleLinks: [],
    }
    objects.set(id, object)
    const schemaProperties = getClassProperties(dcatClass)
    for (const key of Object.keys(node)) {
      const value = node[key]
      const allowed = schemaProperties.get(key) ?? []
      const children = allowed.length > 0 ? asObjects(value) : undefined
      if (!children) {
        object.properties[key] = value
        continue
      }
      const base = `${id}/${key}` // a schema property name: no "/" or "~" to escape
      object.links[key] = children.map((child, i) =>
        add(child, classIn(child, allowed), Array.isArray(value) ? `${base}/${i}` : base),
      )
      if (!Array.isArray(value)) object.singleLinks.push(key)
    }
    return id
  }
  return { rootId: add(root, rootClass, '#'), objects }
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** In FOAF, which DCAT-US 3.0 uses, an Organization is an Agent: the only subclass pair among its classes. */
const subclasses = new Map([['Agent', ['Organization']]])

/** The class for an object where `allowed` classes may stand: its `@type` if that fits, else the first allowed. */
function classIn(node: Record<string, unknown>, allowed: readonly string[]): string {
  const type = node['@type']
  const fits = (name: string) => name === type || (subclasses.get(name) ?? []).some((sub) => sub === type)
  return typeof type === 'string' && allowed.some(fits) ? type : allowed[0]
}

/** `@type` names the class; without one, Catalog is the schema's default if any Catalog property is present. */
function classOfRoot(root: Record<string, unknown>): string | undefined {
  const type = root['@type']
  if (type !== undefined) return typeof type === 'string' && classSchemas.has(type) ? type : undefined
  const catalogProperties = getClassProperties('Catalog')
  return Object.keys(root).some((key) => key !== '@id' && catalogProperties.has(key)) ? 'Catalog' : undefined
}

/** A class-valued property becomes links only when it holds an object or a non-empty array of objects; anything else (a Concept given as a string, null, a mixed array) stays a property as written. */
function asObjects(value: unknown): Record<string, unknown>[] | undefined {
  if (isObject(value)) return [value]
  if (Array.isArray(value) && value.length > 0 && value.every(isObject)) return value
  return undefined
}

/** Measures nesting and counts objects on the raw text, so depth and object bombs are refused before parsing. */
function scan(text: string, maxDepth: number, maxObjects: number): void {
  let depth = 0
  let objectCount = 0
  let inString = false
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i)
    if (inString) {
      if (c === 0x5c) i++ // backslash: skip the escaped character
      else if (c === 0x22) inString = false
    } else if (c === 0x22) inString = true
    else if (c === 0x7b || c === 0x5b) {
      if (c === 0x7b && ++objectCount > maxObjects) {
        throw new DecomposeError(
          'too-many-objects',
          `This document has more than ${maxObjects.toLocaleString('en-US')} JSON objects, the limit.`,
        )
      }
      if (++depth > maxDepth) {
        throw new DecomposeError('too-deep', `This document is nested more than ${maxDepth} levels deep, the limit.`)
      }
    } else if (c === 0x7d || c === 0x5d) depth--
  }
}
