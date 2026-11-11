export type FieldType = 'string' | 'number' | 'boolean' | 'object' | 'array'

export type Cardinality = 'single' | 'multiple'

export interface FormField {
  name: string
  label: string
  type: FieldType
  required: boolean
  cardinality: Cardinality
  helpText?: string
  allowedValues?: readonly string[]
  allowedClasses?: readonly string[]
}

export interface FormModel {
  className: string
  fields: readonly FormField[]
}
