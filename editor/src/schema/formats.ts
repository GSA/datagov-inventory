/**
 * The string formats DCAT-US 3.0 uses, shared by the Ajv instance and the precompiled
 * validator (scripts/generate-validator.mjs), which imports this module at runtime.
 * Formats follow upstream's Python checks closely but not exactly (e.g. in patterns
 * Python's `\w` also matches non-ASCII letters), so treat a result as advisory.
 */
import { fullFormats } from 'ajv-formats/dist/formats'

const { uri: isUri, date, 'date-time': dateTime } = fullFormats as {
  uri: (value: string) => boolean
  date: { validate: (value: string) => boolean; compare: (a: string, b: string) => number | undefined }
  'date-time': { validate: (value: string) => boolean }
}

export const formats = {
  date,
  // Upstream's checker (RFC 3339) also needs an upper-case `T`, seconds below 60, and a `Z` or `±hh:mm` offset.
  'date-time': (value: string) =>
    /T\d\d:\d\d:[0-5]\d(\.\d+)?(Z|[+-]\d\d:\d\d)$/.test(value) && dateTime.validate(value),
  // An IRI is a URI that may also hold non-ASCII characters: stand in an escape for each, then check as a URI.
  iri: (value: string) => isUri(value.replace(/\P{ASCII}/gu, '%80')),
}
