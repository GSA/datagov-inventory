export type ValidationState = 'idle' | 'validating' | 'valid' | 'invalid' | 'stale'

export interface ValidationError {
  field: string
  message: string
  type: string
  severity: 'error' | 'warning'
  instancePath: string
  schemaPath: string
}

export interface ValidationResult {
  valid: boolean
  errors: ValidationError[]
  timestamp: number
  schemaVersion: string
}

export interface ObjectValidationResult extends ValidationResult {
  objectId: string
  objectType: string
}

export interface CatalogValidationResult {
  valid: boolean
  objectResults: ObjectValidationResult[]
  errorSummary: Record<string, number>
  totalErrors: number
  timestamp: number
  schemaVersion: string
}
