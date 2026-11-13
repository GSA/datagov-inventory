import { writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { runnerImport } from 'vite'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUTPUT_DIR = join(__dirname, '..', 'src', 'generated', 'models')

// The schema module loads definitions with import.meta.glob, so it runs through Vite
// (runnerImport is marked experimental in Vite 6; the lockfile pins the version).
const { module: schemaModule } = await runnerImport(join(__dirname, '..', 'src', 'schema', 'index.ts'), {
  configFile: false,
  logLevel: 'error',
})
const { classSchemas, getClassSchema, getClassProperties } = schemaModule

function toTitleCase(str) {
  return str
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (s) => s.toUpperCase())
    .trim()
}

/**
 * What a property's value can be, across `type` lists and `anyOf`/`oneOf`/`allOf` branches:
 * whether any form is a list, and the scalar types of its single values and list items.
 */
function describeValue(propSchema, into = { list: false, scalars: [] }) {
  if (!propSchema || typeof propSchema !== 'object') return into
  const types = [propSchema.type].flat().filter((t) => t && t !== 'null')
  for (const type of types) {
    if (type === 'array') {
      into.list = true
      describeValue(propSchema.items, into)
    } else {
      into.scalars.push(type === 'integer' ? 'number' : type)
    }
  }
  for (const key of ['anyOf', 'oneOf', 'allOf']) {
    for (const branch of propSchema[key] ?? []) describeValue(branch, into)
  }
  return into
}

/**
 * The class's own properties and those of its `anyOf`/`oneOf`/`allOf` branches, with their
 * `required` lists. A property defined in two branches would need its schemas merged, as
 * getClassProperties merges their classes; none is today, so that fails instead.
 */
function propertySchemas(className) {
  const schema = getClassSchema(className)
  const found = new Map()
  for (const branch of [schema, ...(schema.anyOf ?? []), ...(schema.oneOf ?? []), ...(schema.allOf ?? [])]) {
    for (const [name, propSchema] of Object.entries(branch.properties ?? {})) {
      if (found.has(name)) throw new Error(`${className}.${name} is defined in two branches`)
      found.set(name, { propSchema, required: (branch.required ?? []).includes(name) })
    }
  }
  return found
}

function extractFormModel(className) {
  const schemas = propertySchemas(className)

  // getClassProperties decides which properties exist and which hold classes, as for decompose.
  const fields = [...getClassProperties(className)].map(([name, classes]) => {
    const { propSchema, required } = schemas.get(name)
    const { list, scalars } = describeValue(propSchema)

    // A value that may be an inline object (e.g. Location.bbox: a string or a GeoJSON object)
    // stays 'object', so a form can hold either form.
    const scalarType = scalars.includes('object') ? 'object' : scalars[0]

    const field = {
      name,
      label: toTitleCase(name),
      type: classes.length > 0 ? 'object' : (scalarType ?? (list ? 'array' : 'string')),
      required,
      cardinality: list ? 'multiple' : 'single',
    }

    if (propSchema.description) {
      field.helpText = propSchema.description
    }

    if (Array.isArray(propSchema.enum)) {
      field.allowedValues = propSchema.enum
    }

    if (classes.length > 0) {
      field.allowedClasses = classes
    }

    return field
  })

  return {
    className,
    fields,
  }
}

function formatFieldValue(value) {
  if (typeof value === 'string') {
    return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`
  }
  if (typeof value === 'boolean' || typeof value === 'number') {
    return String(value)
  }
  if (Array.isArray(value)) {
    return `[${value.map(formatFieldValue).join(', ')}]`
  }
  return 'undefined'
}

function generateField(field, indent) {
  const lines = ['{']

  lines.push(`${indent}  name: '${field.name}',`)
  lines.push(`${indent}  label: '${field.label}',`)
  lines.push(`${indent}  type: '${field.type}',`)
  lines.push(`${indent}  required: ${field.required},`)
  lines.push(`${indent}  cardinality: '${field.cardinality}',`)

  if (field.helpText !== undefined) {
    const escapedHelp = field.helpText.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, ' ')
    lines.push(`${indent}  helpText: '${escapedHelp}',`)
  }

  if (field.allowedValues !== undefined) {
    lines.push(`${indent}  allowedValues: ${formatFieldValue(field.allowedValues)},`)
  }

  if (field.allowedClasses !== undefined) {
    lines.push(`${indent}  allowedClasses: ${formatFieldValue(field.allowedClasses)},`)
  }

  lines.push(`${indent}}`)

  return lines.join('\n')
}

function generateModelFile(model) {
  const lines = []

  lines.push("import type { FormModel } from '../types'")
  lines.push('')
  lines.push(`export const ${model.className}Model: FormModel = {`)
  lines.push(`  className: '${model.className}',`)
  lines.push('  fields: [')

  model.fields.forEach((field, index) => {
    lines.push(generateField(field, '    '))
    if (index < model.fields.length - 1) {
      lines[lines.length - 1] += ','
    }
  })

  lines.push('  ],')
  lines.push('}')
  lines.push('')

  return lines.join('\n')
}

function generateModels() {
  mkdirSync(OUTPUT_DIR, { recursive: true })

  const modelNames = [...classSchemas.keys()].sort()

  for (const className of modelNames) {
    const code = generateModelFile(extractFormModel(className))
    writeFileSync(join(OUTPUT_DIR, `${className}.ts`), code, 'utf-8')
    console.log(`Generated model: ${className}.ts`)
  }

  const indexContent =
    modelNames.map((name) => `export { ${name}Model } from './${name}'`).join('\n') + '\n'

  writeFileSync(join(OUTPUT_DIR, 'index.ts'), indexContent, 'utf-8')
  console.log('Generated index.ts')

  console.log(`\nGenerated ${modelNames.length} models in ${OUTPUT_DIR}`)
}

generateModels()
