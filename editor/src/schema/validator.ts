/**
 * A JSON Schema 2020-12 validator for whole DCAT-US 3.0 documents, used by the fixture tests.
 * Ajv compiles with `new Function`, which the CSP (`script-src 'self'`) blocks, so the
 * browser uses the precompiled src/generated/validateDocument.js built from `createAjv`.
 */
import Ajv2020, { type Options } from 'ajv/dist/2020'
import { classSchemas, rootSchema } from '.'
import { formats } from './formats'

export function createAjv(options: Options = {}) {
  const ajv = new Ajv2020({
    allErrors: true,
    allowUnionTypes: true,
    // Upstream patterns escape characters that need no escape (e.g. `\_`, `\!` in
    // Kind.hasEmail), which the `u` flag rejects.
    unicodeRegExp: false,
    ...options,
  })
  // Upstream keywords that document properties rather than constrain them.
  ajv.addVocabulary(['requirementLevel', '_oldDocs'])
  for (const [name, format] of Object.entries(formats)) ajv.addFormat(name, format)
  ajv.addSchema([...classSchemas.values(), rootSchema])
  return ajv
}

/** Validates a whole document against the root schema; errors are on `validateDocument.errors`. */
export const validateDocument = createAjv().getSchema(rootSchema.$id)!
