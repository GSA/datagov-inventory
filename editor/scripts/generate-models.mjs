import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const SCHEMA_DIR = join(__dirname, '..', 'schema', 'dcat-us', 'jsonschema', 'definitions')
const OUTPUT_DIR = join(__dirname, '..', 'src', 'generated', 'models')

function toTitleCase(str) {
  return str
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (s) => s.toUpperCase())
    .trim()
}

function extractClassNameFromRef(ref) {
  const match = ref.match(/\/([^/]+)$/)
  if (!match) return 'Unknown'
  return toTitleCase(match[1])
}

function extractAllowedClasses(propSchema) {
  if (propSchema.$ref && typeof propSchema.$ref === 'string') {
    return [extractClassNameFromRef(propSchema.$ref)]
  }

  if (Array.isArray(propSchema.anyOf)) {
    const classes = propSchema.anyOf
      .filter((item) => item && typeof item === 'object' && item.$ref)
      .map((item) => extractClassNameFromRef(item.$ref))
    return classes.length > 0 ? classes : undefined
  }

  return undefined
}

function extractFieldType(propSchema) {
  if (propSchema.type === 'array' && propSchema.items && typeof propSchema.items === 'object') {
    const items = propSchema.items
    const itemType = items.type

    if (itemType === 'string' || itemType === 'number' || itemType === 'boolean') {
      return { type: itemType, cardinality: 'multiple' }
    }

    if (items.$ref) {
      return { type: 'object', cardinality: 'multiple', allowedClasses: [extractClassNameFromRef(items.$ref)] }
    }
  }

  if (propSchema.$ref || propSchema.anyOf) {
    return { type: 'object', cardinality: 'single' }
  }

  let type = propSchema.type || 'string'
  if (Array.isArray(type)) {
    type = type.find((t) => t !== 'null') || 'string'
  }

  return {
    type: type === 'integer' ? 'number' : type,
    cardinality: 'single',
  }
}

function extractFormModel(className, schema) {
  const properties = schema.properties || {}
  const required = schema.required || []

  const fields = Object.entries(properties).map(([name, propSchema]) => {
    const fieldType = extractFieldType(propSchema)
    const { type, cardinality } = fieldType
    const allowedClasses = fieldType.allowedClasses || extractAllowedClasses(propSchema)
    const allowedValues = Array.isArray(propSchema.enum) ? propSchema.enum : undefined

    const field = {
      name,
      label: toTitleCase(name),
      type,
      required: required.includes(name),
      cardinality,
    }

    if (propSchema.description) {
      field.helpText = propSchema.description
    }

    if (allowedValues) {
      field.allowedValues = allowedValues
    }

    if (allowedClasses) {
      field.allowedClasses = allowedClasses
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
    return `'${value.replace(/'/g, "\\'")}'`
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
    const escapedHelp = field.helpText.replace(/'/g, "\\'").replace(/\n/g, ' ')
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

  const files = readdirSync(SCHEMA_DIR).filter((f) => f.endsWith('.json'))
  const modelNames = []

  for (const file of files) {
    const className = file.replace('.json', '')
    const schemaPath = join(SCHEMA_DIR, file)
    const schemaContent = readFileSync(schemaPath, 'utf-8')
    const schema = JSON.parse(schemaContent)

    const model = extractFormModel(className, schema)
    const code = generateModelFile(model)
    const outputPath = join(OUTPUT_DIR, `${className}.ts`)

    writeFileSync(outputPath, code, 'utf-8')
    modelNames.push(className)

    console.log(`Generated model: ${className}.ts`)
  }

  const indexContent =
    modelNames.map((name) => `export { ${name}Model } from './${name}'`).join('\n') + '\n'

  writeFileSync(join(OUTPUT_DIR, 'index.ts'), indexContent, 'utf-8')
  console.log('Generated index.ts')

  console.log(`\nGenerated ${modelNames.length} models in ${OUTPUT_DIR}`)
}

generateModels()
