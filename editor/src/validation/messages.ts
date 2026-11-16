import type { ErrorObject } from 'ajv'
import type { ValidationError } from './types'

const FIELD_LABELS: Record<string, string> = {
  'dct:title': 'Title',
  'dct:description': 'Description',
  'dcat:keyword': 'Keywords',
  'dcat:theme': 'Theme',
  'dct:spatial': 'Spatial Coverage',
  'dct:temporal': 'Temporal Coverage',
  'dcat:distribution': 'Distribution',
  'dcat:accessURL': 'Access URL',
  'dcat:downloadURL': 'Download URL',
  'dcat:format': 'Format',
  'dcat:mediaType': 'Media Type',
  'dcat:contactPoint': 'Contact Point',
  'dct:publisher': 'Publisher',
  'foaf:name': 'Name',
  'vcard:fn': 'Name',
  'vcard:hasEmail': 'Email',
  'dct:identifier': 'Identifier',
  'dct:issued': 'Issued Date',
  'dct:modified': 'Modified Date',
  'dct:accrualPeriodicity': 'Update Frequency',
  'dcat:landingPage': 'Landing Page',
}

export function getFieldLabel(property: string): string {
  if (FIELD_LABELS[property]) {
    return FIELD_LABELS[property]
  }

  const parts = property.split(':')
  if (parts.length === 2 && parts[0] === 'unknown') {
    return 'Unknown Property'
  }

  const afterColon = parts[1]
  if (afterColon) {
    return afterColon.replace(/([A-Z])/g, ' $1').replace(/^./, (str) => str.toUpperCase())
  }

  return 'Unknown Property'
}

export function formatFieldPath(instancePath: string): string {
  if (!instancePath || instancePath === '/') {
    return 'Object'
  }

  const parts = instancePath.split('/').filter(Boolean)
  const formatted: string[] = []

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i]

    if (/^\d+$/.test(part)) {
      const index = parseInt(part, 10) + 1
      const prevPart = parts[i - 1]
      if (prevPart) {
        formatted[formatted.length - 1] = `${getFieldLabel(prevPart)} ${index}`
      }
    } else {
      formatted.push(getFieldLabel(part))
    }
  }

  return formatted.join(' → ')
}

function escapeHtml(text: string): string {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

export function humanizeError(error: ErrorObject): ValidationError {
  let field = formatFieldPath(error.instancePath)
  let message = error.message || 'Validation error'
  const type = error.keyword

  switch (error.keyword) {
    case 'required': {
      const missingField = getFieldLabel(error.params.missingProperty)
      field = missingField
      message = `${missingField} is required`
      break
    }
    case 'type':
      message = `must be ${error.params.type === 'string' ? 'text' : error.params.type}`
      break
    case 'pattern':
      message = `must match the expected format`
      break
    case 'format':
      message = `must be a valid ${error.params.format}`
      break
    case 'minLength':
      message = `must be at least ${error.params.limit} characters`
      break
    case 'maxLength':
      message = `must be no more than ${error.params.limit} characters`
      break
    case 'enum': {
      const allowed = error.params.allowedValues?.map((v: string) => escapeHtml(String(v))).join(', ')
      message = `must be one of: ${allowed}`
      break
    }
    case 'const': {
      const value = error.params.allowedValue
      message = `must be equal to constant: ${String(value)}`
      break
    }
  }

  message = escapeHtml(message)

  return {
    field,
    message,
    type,
    severity: 'error',
    instancePath: error.instancePath,
    schemaPath: error.schemaPath,
  }
}
