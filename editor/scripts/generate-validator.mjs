import { writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { runnerImport } from 'vite'
import { _ } from 'ajv'
import standaloneCode from 'ajv/dist/standalone/index.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUTPUT_DIR = join(__dirname, '..', 'src', 'generated')

// Precompiled because the CSP blocks the `new Function` Ajv compiles with at runtime.
// The schema module loads definitions with import.meta.glob, so it runs through Vite.
let validatorModule, schemaModule
try {
  const load = (path) => runnerImport(join(__dirname, '..', 'src', 'schema', path), { configFile: false, logLevel: 'error' })
  ;[{ module: validatorModule }, { module: schemaModule }] = await Promise.all([load('validator.ts'), load('index.ts')])
} catch (error) {
  console.error('Could not load src/schema. Is the schema submodule checked out (git submodule update --init)?')
  console.error(error)
  process.exit(1)
}

const ajv = validatorModule.createAjv({ code: { source: true, esm: true, formats: _`formats` } })
const source = standaloneCode(ajv, { validateDocument: schemaModule.rootSchema.$id })
  .replace(/^"use strict";/, '')
  .replaceAll('require("ajv/dist/runtime/ucs2length").default', 'ucs2length')

if (/require\(/.test(source)) {
  console.error('Generated validator has an unhandled require(); add an import for it in generate-validator.mjs')
  process.exit(1)
}

mkdirSync(OUTPUT_DIR, { recursive: true })
writeFileSync(
  join(OUTPUT_DIR, 'validateDocument.js'),
  `import ucs2length from 'ajv/dist/runtime/ucs2length'\nimport { formats } from '../schema/formats'\n${source}\n`,
  'utf-8',
)
writeFileSync(
  join(OUTPUT_DIR, 'validateDocument.d.ts'),
  `import type { ValidateFunction } from 'ajv'\n\nexport declare const validateDocument: ValidateFunction\n`,
  'utf-8',
)
console.log(`Generated validateDocument.js in ${OUTPUT_DIR}`)
