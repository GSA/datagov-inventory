import type { ErrorObject } from 'ajv'
import { assemble } from '../catalog/assemble'
import type { DecomposedCatalog } from '../catalog/decompose'
import { validateDocument } from '../generated/validateDocument'
import { humanizeError } from './messages'
import type { CatalogValidationResult, ObjectValidationResult, ValidationError } from './types'

export const SCHEMA_VERSION = '3.0.0'

/** Each object's JSON Pointer in the assembled document, nested as `assemble` nests links. A shared object has several. */
export function pointersOf(catalog: DecomposedCatalog): Map<string, string> {
  const owners = new Map<string, string>()
  const visit = (id: string, pointer: string) => {
    owners.set(pointer, id)
    const object = catalog.objects.get(id)
    if (!object) return
    for (const [property, childIds] of Object.entries(object.links)) {
      const single = object.singleLinks.includes(property)
      childIds.forEach((childId, i) => visit(childId, single ? `${pointer}/${property}` : `${pointer}/${property}/${i}`))
    }
  }
  visit(catalog.rootId, '')
  return owners
}

/** The pointer of the deepest object holding `instancePath`. */
function ownerOf(instancePath: string, owners: Map<string, string>): string {
  let pointer = instancePath
  while (!owners.has(pointer)) pointer = pointer.slice(0, pointer.lastIndexOf('/'))
  return pointer
}

/** Ajv reports a failed anyOf/oneOf once per branch as well; at the same path only the anyOf/oneOf error says what went wrong. */
function withoutBranchErrors(errors: ErrorObject[]): ErrorObject[] {
  const composites = errors.filter((e) => e.keyword === 'anyOf' || e.keyword === 'oneOf')
  return errors.filter(
    (e) =>
      !composites.some(
        (c) => c !== e && e.instancePath === c.instancePath && e.schemaPath.startsWith(`${c.schemaPath}/`),
      ),
  )
}

/** Validates the catalog as it would export, and gives each error to the object it is in, with a path relative to that object. */
export function validateCatalog(catalog: DecomposedCatalog): CatalogValidationResult {
  const owners = pointersOf(catalog)
  const errorsByObject = new Map<string, ValidationError[]>()

  if (!validateDocument(assemble(catalog).output)) {
    for (const error of withoutBranchErrors(validateDocument.errors ?? [])) {
      const pointer = ownerOf(error.instancePath, owners)
      const objectId = owners.get(pointer)!
      const humanized = humanizeError({ ...error, instancePath: error.instancePath.slice(pointer.length) })
      errorsByObject.set(objectId, [...(errorsByObject.get(objectId) ?? []), humanized])
    }
  }

  const timestamp = Date.now()
  const objectResults: ObjectValidationResult[] = Array.from(catalog.objects.values(), (object) => {
    const errors = errorsByObject.get(object.id) ?? []
    return {
      objectId: object.id,
      objectType: object.dcatClass,
      valid: errors.length === 0,
      errors,
      timestamp,
      schemaVersion: SCHEMA_VERSION,
    }
  })

  const errorSummary: Record<string, number> = {}
  for (const { objectType, errors } of objectResults) {
    if (errors.length > 0) errorSummary[objectType] = (errorSummary[objectType] ?? 0) + errors.length
  }

  return {
    valid: errorsByObject.size === 0,
    objectResults,
    errorSummary,
    totalErrors: objectResults.reduce((sum, result) => sum + result.errors.length, 0),
    timestamp,
    schemaVersion: SCHEMA_VERSION,
  }
}
