/**
 * Reassembles a decomposed DCAT-US 3.0 catalog into nested JSON format.
 *
 * This is the inverse of decompose: it converts the flat object graph back into
 * the nested structure that DCAT-US 3.0 requires. Shared objects are duplicated at each
 * reference point. Circular references and excessive depth are detected before export
 * to prevent infinite recursion.
 *
 * Pure TypeScript with no React or DOM imports, so it runs in a worker and in tests.
 */
import type { DecomposedCatalog } from './decompose'

const MAX_DEPTH = 64

export type AssembleErrorCode = 'circular-reference' | 'max-depth-exceeded' | 'missing-object'

export class AssembleError extends Error {
  name = 'AssembleError'
  constructor(readonly code: AssembleErrorCode, message: string) {
    super(message)
  }
}

export interface AssembleResult {
  output: unknown
  sharedObjects: string[]
}

function detectSharedObjects(catalog: DecomposedCatalog): Set<string> {
  const refCounts = new Map<string, number>()

  for (const object of catalog.objects.values()) {
    for (const childIds of Object.values(object.links)) {
      for (const childId of childIds) {
        refCounts.set(childId, (refCounts.get(childId) || 0) + 1)
      }
    }
  }

  const shared = new Set<string>()
  for (const [id, count] of refCounts) {
    if (count > 1) {
      shared.add(id)
    }
  }

  return shared
}

export function assemble(catalog: DecomposedCatalog): AssembleResult {
  const { rootId, objects } = catalog

  function assembleObject(id: string, path: string[]): Record<string, unknown> {
    if (path.includes(id)) {
      throw new AssembleError(
        'circular-reference',
        `Circular reference detected: ${[...path, id].join(' → ')}`
      )
    }

    if (path.length >= MAX_DEPTH) {
      throw new AssembleError(
        'max-depth-exceeded',
        `Object graph exceeds maximum depth of ${MAX_DEPTH} levels: ${path.join(' → ')}`
      )
    }

    const object = objects.get(id)
    if (!object) {
      throw new AssembleError(
        'missing-object',
        `Object not found in catalog: ${id}`
      )
    }

    const result: Record<string, unknown> = Object.create(null)

    for (const [key, value] of Object.entries(object.properties)) {
      result[key] = value
    }

    const newPath = [...path, id]

    for (const [property, childIds] of Object.entries(object.links)) {
      const children = childIds.map(childId => assembleObject(childId, newPath))

      if (object.singleLinks.includes(property)) {
        result[property] = children[0]
      } else {
        result[property] = children
      }
    }

    return result
  }

  const sharedObjects = detectSharedObjects(catalog)
  const output = assembleObject(rootId, [])

  return {
    output,
    sharedObjects: [...sharedObjects]
  }
}
