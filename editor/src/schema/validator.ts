/**
 * A JSON Schema 2020-12 validator for whole DCAT-US 3.0 documents, for tests.
 * Product validation goes through the Data.gov validator API (ADR 0010).
 */
import Ajv2020 from 'ajv/dist/2020'
import addFormats from 'ajv-formats'
import { fullFormats } from 'ajv-formats/dist/formats'
import { classSchemas, rootSchema } from '.'

const isUri = fullFormats.uri as (value: string) => boolean

const ajv = new Ajv2020({
  allErrors: true,
  allowUnionTypes: true,
  // Upstream patterns escape characters that need no escape (e.g. `\_` in
  // Kind.hasEmail), which the `u` flag rejects.
  unicodeRegExp: false,
})
// Upstream keywords that document properties rather than constrain them.
ajv.addVocabulary(['requirementLevel', '_oldDocs'])
addFormats(ajv, ['date', 'date-time'])
// An IRI is a URI that may hold non-ASCII characters; percent-encode them, then check as a URI.
// eslint-disable-next-line no-control-regex
ajv.addFormat('iri', (value: string) => isUri(value.replace(/[^\x00-\x7f]+/g, encodeURIComponent)))
ajv.addSchema([...classSchemas.values(), rootSchema])

/** Validates a whole document against the root schema; errors are on `validateDocument.errors`. */
export const validateDocument = ajv.getSchema(rootSchema.$id)!
