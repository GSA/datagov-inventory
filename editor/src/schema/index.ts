/**
 * The DCAT-US 3.0 JSON Schema definitions, read from the pinned GSA/dcat-us
 * submodule at build time. Only the definition files are read; nothing from
 * the submodule is executed. See schema/README.md.
 */
import documentSchema from '../../schema/dcat-us-document.schema.json'
import pin from '../../schema/dcat-us.pin.json'

/** A JSON Schema object, as stored in the upstream definition files. */
export type JsonSchema = Record<string, unknown> & { $id?: string }

const definitionFiles = import.meta.glob<JsonSchema>(
  '../../schema/dcat-us/jsonschema/definitions/*.json',
  { eager: true, import: 'default' },
)

/** Upstream definitions keyed by class name (the file name, e.g. `Dataset`). */
export const classSchemas: Readonly<Record<string, JsonSchema>> = Object.freeze(
  Object.fromEntries(
    Object.entries(definitionFiles).map(([path, schema]) => [
      path.slice(path.lastIndexOf('/') + 1, -'.json'.length),
      schema,
    ]),
  ),
)

/** Every DCAT-US 3.0 class name, sorted. */
export const classNames: readonly string[] = Object.freeze(Object.keys(classSchemas).sort())

/** The root schema for a whole DCAT-US 3.0 document (a top-level Catalog). */
export const rootSchema: JsonSchema = documentSchema

/** The upstream commit, date and licence the definitions were copied from. */
export const schemaPin = pin

export function isClassName(name: string): boolean {
  return Object.prototype.hasOwnProperty.call(classSchemas, name)
}

/** Returns the upstream schema for a DCAT-US 3.0 class, e.g. `getClassSchema('Dataset')`. */
export function getClassSchema(name: string): JsonSchema {
  if (!isClassName(name)) {
    throw new Error(`Unknown DCAT-US 3.0 class "${name}". Known classes: ${classNames.join(', ')}`)
  }
  return classSchemas[name]
}
