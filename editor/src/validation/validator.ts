import Ajv, { type ValidateFunction } from 'ajv'
import addFormats from 'ajv-formats'
import { humanizeError } from './messages'
import type { ValidationResult, ObjectValidationResult, CatalogValidationResult } from './types'

export function createValidator(schema: object) {
  const ajv = new Ajv({
    allErrors: true,
    verbose: true,
    strict: false,
    validateFormats: true,
  })

  addFormats(ajv)

  const validate = ajv.compile(schema)

  return {
    validate,
    errors: ajv.errors,
  }
}

export function validateObject(
  validator: { validate: ValidateFunction },
  obj: unknown,
  _objectType: 'Dataset' | 'Organization' | 'ContactPoint'
): ValidationResult {
  const valid = validator.validate(obj)
  const errors = valid ? [] : (validator.validate.errors || []).map(humanizeError)

  return {
    valid,
    errors,
    timestamp: Date.now(),
    schemaVersion: '3.0.0',
  }
}

export function validateCatalog(
  validator: { validate: ValidateFunction },
  catalog: {
    datasets: unknown[]
    publishers: unknown[]
    contactPoints: unknown[]
  }
): CatalogValidationResult {
  const objectResults: ObjectValidationResult[] = []
  const errorSummary: Record<string, number> = {
    Dataset: 0,
    Organization: 0,
    ContactPoint: 0,
  }

  for (const dataset of catalog.datasets) {
    const result = validateObject(validator, dataset, 'Dataset')
    objectResults.push({
      ...result,
      objectId: (dataset as { '@id'?: string })['@id'] || 'unknown',
      objectType: 'Dataset',
    })
    if (!result.valid) {
      errorSummary.Dataset++
    }
  }

  for (const publisher of catalog.publishers) {
    const result = validateObject(validator, publisher, 'Organization')
    objectResults.push({
      ...result,
      objectId: (publisher as { '@id'?: string })['@id'] || 'unknown',
      objectType: 'Organization',
    })
    if (!result.valid) {
      errorSummary.Organization++
    }
  }

  for (const contact of catalog.contactPoints) {
    const result = validateObject(validator, contact, 'ContactPoint')
    objectResults.push({
      ...result,
      objectId: (contact as { '@id'?: string })['@id'] || 'unknown',
      objectType: 'ContactPoint',
    })
    if (!result.valid) {
      errorSummary.ContactPoint++
    }
  }

  const valid = objectResults.every((r) => r.valid)
  const totalErrors = objectResults.reduce((sum, r) => sum + r.errors.length, 0)

  return {
    valid,
    objectResults,
    errorSummary,
    totalErrors,
    timestamp: Date.now(),
    schemaVersion: '3.0.0',
  }
}
