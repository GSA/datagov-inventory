/** A JSON Schema 2020-12 validator for whole DCAT-US 3.0 documents, used by the fixture tests. */
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
// An IRI is a URI that may also hold non-ASCII characters: stand in an escape for each, then check as a URI.
ajv.addFormat('iri', (value: string) => isUri(value.replace(/\P{ASCII}/gu, '%80')))
ajv.addSchema([...classSchemas.values(), rootSchema])

/** Validates a whole document against the root schema; errors are on `validateDocument.errors`. */
export const validateDocument = ajv.getSchema(rootSchema.$id)!
