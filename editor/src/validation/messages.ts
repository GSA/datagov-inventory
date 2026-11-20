import type { ErrorObject } from 'ajv'
import { fieldLabel } from '../labels'
import type { ValidationError } from './types'

/** A property's label, as its field in the form shows it: "Contact point", "Access URL". */
export const getFieldLabel = fieldLabel

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
    case 'anyOf':
    case 'oneOf':
      message = 'is not in an accepted form'
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
      const allowed = error.params.allowedValues?.map(String).join(', ')
      message = `must be one of: ${allowed}`
      break
    }
    case 'const': {
      const value = error.params.allowedValue
      message = `must be equal to constant: ${String(value)}`
      break
    }
  }

  return {
    field,
    message,
    type,
    severity: 'error',
    instancePath: error.instancePath,
    schemaPath: error.schemaPath,
  }
}
