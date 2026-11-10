/**
 * A JSON Schema 2020-12 validator for whole DCAT-US 3.0 documents, used by the fixture tests.
 * Formats and patterns follow upstream's Python checks closely but not exactly (e.g. in
 * patterns Python's `\w` also matches non-ASCII letters), so treat a result as advisory.
 * Test-only as built: Ajv compiles with `new Function`, which `vite preview`'s CSP
 * (`script-src 'self'`) blocks, so the browser check (#27) needs a precompiled validator.
 */
import Ajv2020 from 'ajv/dist/2020'
import addFormats from 'ajv-formats'
import { fullFormats } from 'ajv-formats/dist/formats'
import { classSchemas, rootSchema } from '.'

const { uri: isUri, 'date-time': dateTime } = fullFormats as {
  uri: (value: string) => boolean
  'date-time': { validate: (value: string) => boolean }
}

const ajv = new Ajv2020({
  allErrors: true,
  allowUnionTypes: true,
  // Upstream patterns escape characters that need no escape (e.g. `\_`, `\!` in
  // Kind.hasEmail), which the `u` flag rejects.
  unicodeRegExp: false,
})
// Upstream keywords that document properties rather than constrain them.
ajv.addVocabulary(['requirementLevel', '_oldDocs'])
addFormats(ajv, ['date'])
// Upstream's checker (RFC 3339) also needs an upper-case `T`, seconds below 60, and a `Z` or `±hh:mm` offset.
ajv.addFormat('date-time', (value: string) => /T\d\d:\d\d:[0-5]\d(\.\d+)?(Z|[+-]\d\d:\d\d)$/.test(value) && dateTime.validate(value))
// An IRI is a URI that may also hold non-ASCII characters: stand in an escape for each, then check as a URI.
ajv.addFormat('iri', (value: string) => isUri(value.replace(/\P{ASCII}/gu, '%80')))
ajv.addSchema([...classSchemas.values(), rootSchema])

/** Validates a whole document against the root schema; errors are on `validateDocument.errors`. */
export const validateDocument = ajv.getSchema(rootSchema.$id)!
