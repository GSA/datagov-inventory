import type { ErrorObject } from 'ajv'
import type { ValidationError } from './types'

export function getFieldLabel(_property: string): string {
  throw new Error('Not implemented')
}

export function formatFieldPath(_instancePath: string): string {
  throw new Error('Not implemented')
}

export function humanizeError(_error: ErrorObject): ValidationError {
  throw new Error('Not implemented')
}
