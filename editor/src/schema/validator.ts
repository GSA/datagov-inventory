/**
 * A JSON Schema 2020-12 validator loaded with the pinned DCAT-US 3.0 definitions.
 * Used by tests to check fixtures; validation in the product goes through the
 * Data.gov validator API (ADR 0010).
 */
import Ajv2020 from 'ajv/dist/2020'
import addFormats from 'ajv-formats'
import { fullFormats } from 'ajv-formats/dist/formats'
import { classSchemas, getClassSchema, rootSchema } from '.'

const isUri = fullFormats.uri as (value: string) => boolean

/**
 * RFC 3987 IRI: a URI that may also hold non-ASCII characters. Percent-encoding
 * those characters turns a valid IRI into a valid URI.
 */
export function isIri(value: string): boolean {
  // eslint-disable-next-line no-control-regex
  return isUri(value.replace(/[^\x00-\x7f]+/g, encodeURIComponent))
}

export function createValidator(): Ajv2020 {
  const ajv = new Ajv2020({
    allErrors: true,
    allowUnionTypes: true,
    // Upstream patterns escape characters that need no escape (e.g. Kind.hasEmail's
    // `\_` and `\~`), which the `u` flag rejects.
    unicodeRegExp: false,
  })
  // Upstream annotations that carry documentation, not validation rules.
  ajv.addVocabulary(['requirementLevel', '_oldDocs'])
  // The formats the definitions use, checked as upstream's own tests check them.
  addFormats(ajv, ['date', 'date-time'])
  ajv.addFormat('iri', isIri)
  ajv.addSchema(Object.values(classSchemas))
  ajv.addSchema(rootSchema)
  return ajv
}

let shared: Ajv2020 | undefined

function validator(): Ajv2020 {
  shared ??= createValidator()
  return shared
}

/** Validates a whole DCAT-US 3.0 document against the root schema. */
export function validateDocument(document: unknown) {
  const validate = validator().getSchema(rootSchema.$id as string)!
  const valid = validate(document)
  return { valid, errors: validate.errors ?? [] }
}

/** Validates one object against the schema for its class. */
export function validateClass(name: string, value: unknown) {
  const validate = validator().getSchema(getClassSchema(name).$id as string)!
  const valid = validate(value)
  return { valid, errors: validate.errors ?? [] }
}
