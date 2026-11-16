import type { ValidateFunction } from 'ajv'
import type { ValidationResult, CatalogValidationResult } from './types'

export function createValidator(_schema: object) {
  throw new Error('Not implemented')
}

export function validateObject(
  _validator: { validate: ValidateFunction },
  _obj: unknown,
  _objectType: 'Dataset' | 'Organization' | 'ContactPoint'
): ValidationResult {
  throw new Error('Not implemented')
}

export function validateCatalog(
  _validator: { validate: ValidateFunction },
  _catalog: {
    datasets: unknown[]
    publishers: unknown[]
    contactPoints: unknown[]
  }
): CatalogValidationResult {
  throw new Error('Not implemented')
}
