/**
 * The DCAT-US 3.0 JSON Schema definitions, read as data from the pinned GSA/dcat-us
 * submodule. Nothing from the submodule is executed. See schema/README.md.
 */
export { default as rootSchema } from '../../schema/dcat-us-document.schema.json'

export type JsonSchema = Record<string, unknown>

const files = import.meta.glob<JsonSchema>('../../schema/dcat-us/jsonschema/definitions/*.json', {
  eager: true,
  import: 'default',
})

/** Upstream definitions keyed by class name (the file name, e.g. `Dataset`). */
export const classSchemas: ReadonlyMap<string, JsonSchema> = new Map(
  Object.entries(files).map(([path, schema]) => [path.slice(path.lastIndexOf('/') + 1, -5), schema]),
)
if (classSchemas.size === 0) throw new Error('DCAT-US schema missing: run git submodule update --init')

/** Returns the upstream schema for a DCAT-US 3.0 class, e.g. `getClassSchema('Dataset')`. */
export function getClassSchema(name: string): JsonSchema {
  const schema = classSchemas.get(name)
  if (!schema) throw new Error(`Unknown DCAT-US 3.0 class "${name}"`)
  return schema
}
