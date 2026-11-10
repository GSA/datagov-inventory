/**
 * The DCAT-US 3.0 JSON Schema definitions, read as data from the pinned GSA/dcat-us
 * submodule. Nothing from the submodule is executed. See schema/README.md.
 * Loads through Vite or Vitest only (`import.meta.glob`), not plain Node.
 */
export { default as rootSchema } from '../../schema/dcat-us-document.schema.json'

export type JsonSchema = Record<string, unknown>

const files = import.meta.glob<JsonSchema>('../../schema/dcat-us/jsonschema/definitions/*.json', {
  eager: true,
  import: 'default',
})

/** Upstream definitions keyed by class name (the file name, e.g. `Dataset`). */
export const classSchemas: ReadonlyMap<string, JsonSchema> = new Map(
  Object.entries(files).map(([path, schema]) => [path.replace(/^.*\/|\.json$/g, ''), schema]),
)
if (classSchemas.size === 0) throw new Error('DCAT-US schema missing: run git submodule update --init')

/** Returns the upstream schema for a DCAT-US 3.0 class, e.g. `getClassSchema('Dataset')`. */
export function getClassSchema(name: string): JsonSchema {
  const schema = classSchemas.get(name)
  if (!schema) throw new Error(`Unknown DCAT-US 3.0 class "${name}"`)
  return schema
}

const classNameByRef = new Map([...classSchemas].map(([name]) => [name.toLowerCase(), name]))
const classPropertiesCache = new Map<string, ReadonlyMap<string, readonly string[]>>()

/**
 * The properties the schema defines for a class, each mapped to the classes its value can
 * hold, in schema order (`[]` for a property that holds only scalars). A property holds a
 * class when its schema `$ref`s one, directly or through `items`/`anyOf`/`oneOf`/`allOf`;
 * `"$ref": "#"` is the class itself. Properties of `anyOf`/`oneOf`/`allOf` branches are
 * included, so Concept and Identifier, which may be a plain string or an object, get their
 * object form's properties.
 * Decompose (#20) uses this to tell links from scalars; form models (#19) should reuse it.
 */
export function getClassProperties(name: string): ReadonlyMap<string, readonly string[]> {
  let result = classPropertiesCache.get(name)
  if (result) return result
  const schema = getClassSchema(name)
  const branches = [schema, ...(['anyOf', 'oneOf', 'allOf'] as const).flatMap((k) => (schema[k] ?? []) as JsonSchema[])]
  const map = new Map<string, readonly string[]>()
  for (const branch of branches) {
    for (const [prop, propSchema] of Object.entries((branch.properties ?? {}) as Record<string, JsonSchema>)) {
      const classes = new Set(map.get(prop))
      collectClassRefs(propSchema, name, classes)
      map.set(prop, [...classes])
    }
  }
  result = map
  classPropertiesCache.set(name, result)
  return result
}

function collectClassRefs(schema: unknown, self: string, into: Set<string>): void {
  if (typeof schema !== 'object' || schema === null) return
  const { $ref, items, anyOf, oneOf, allOf } = schema as JsonSchema
  if ($ref === '#') into.add(self)
  else if (typeof $ref === 'string') {
    const target = classNameByRef.get($ref.slice($ref.lastIndexOf('/') + 1))
    if (!target) throw new Error(`Unresolved $ref "${$ref}" in class "${self}"`)
    into.add(target)
  }
  for (const sub of [items, ...[anyOf, oneOf, allOf].flatMap((list) => (Array.isArray(list) ? list : []))]) {
    collectClassRefs(sub, self, into)
  }
}
