import { useState, useEffect, useRef } from 'react'
import { Label, TextInput, Textarea, Button, Alert } from '@trussworks/react-uswds'
import type { CatalogObject, DecomposedCatalog } from './catalog/decompose'
import { useCatalog } from './session'
import { labelOf } from './tree'
import type { FormModel, FormField } from './schema'
import { useValidation } from './validation/useValidation'
import { ValidationStatusBadge } from './validation/ValidationStatusBadge'
import { useValidationContext } from './validation/ValidationContext'
import { ValidationDisclaimer } from './validation/ValidationDisclaimer'

interface ObjectFormProps {
  object: CatalogObject
  model: FormModel
}

export function ObjectForm({ object, model }: ObjectFormProps) {
  const { updateObject, removeLink, open } = useCatalog()
  const [formState, setFormState] = useState(object.properties)
  const { validateObject, getObjectState, getObjectErrors, isReady } = useValidation()
  const { markStale } = useValidationContext()
  const [isValidating, setIsValidating] = useState(false)

  const validationState = getObjectState(object.id)
  const validationErrors = getObjectErrors(object.id)

  useEffect(() => {
    setFormState(object.properties)
  }, [object.id, object.properties])

  const handleValidate = async () => {
    setIsValidating(true)
    try {
      await validateObject(object.id)
    } catch (error) {
      console.error('Validation failed:', error)
    } finally {
      setIsValidating(false)
    }
  }

  const handleFieldChange = (fieldName: string, value: unknown) => {
    setFormState(prev => ({ ...prev, [fieldName]: value }))
  }

  const handleFieldBlur = (fieldName: string) => {
    updateObject(object.id, { properties: { [fieldName]: formState[fieldName] } })
    markStale(object.id)
  }

  const textFields = model.fields.filter(f => !f.name.startsWith('@') && f.type === 'string' && !f.allowedValues)
  const multiFields = model.fields.filter(f => !f.name.startsWith('@') && f.type === 'array')
  const controlledFields = model.fields.filter(f => !f.name.startsWith('@') && f.type === 'string' && f.allowedValues)
  const linkFields = model.fields.filter(f => !f.name.startsWith('@') && f.allowedClasses && f.allowedClasses.length > 0)
  const unknownProperties = Object.entries(object.properties).filter(
    ([key]) => !model.fields.some(f => f.name === key)
  )

  return (
    <form aria-label={`Edit ${labelOf(object)}`}>
      <h2 id="detail-heading" tabIndex={-1}>
        {labelOf(object)}
      </h2>
      <p className="text-base-dark">
        {object.dcatClass} <code className="font-mono-3xs">{object.id}</code>
      </p>

      <div className="margin-top-2 margin-bottom-2">
        <ValidationStatusBadge state={validationState} errorCount={validationErrors.length} />
        {isReady && (
          <Button
            type="button"
            onClick={handleValidate}
            secondary
            disabled={isValidating}
            className="margin-left-1"
            aria-label={`Validate ${labelOf(object)}`}
          >
            {isValidating ? 'Validating...' : 'Validate'}
          </Button>
        )}
      </div>

      {validationErrors.length > 0 && (
        <>
          <Alert type="error" headingLevel="h3" role="alert" aria-live="polite">
            <strong>Validation errors:</strong>
            <ul className="margin-top-1">
              {validationErrors.map((error, idx) => (
                <li key={idx}>
                  <strong>{error.field}:</strong> {error.message}
                </li>
              ))}
            </ul>
          </Alert>
          <ValidationDisclaimer />
        </>
      )}

      {textFields.map(field => (
        <TextField
          key={field.name}
          field={field}
          value={formState[field.name]}
          onChange={value => handleFieldChange(field.name, value)}
          onBlur={() => handleFieldBlur(field.name)}
        />
      ))}

      {multiFields.map(field => (
        <MultiValueField
          key={field.name}
          field={field}
          value={formState[field.name]}
          onChange={value => handleFieldChange(field.name, value)}
          onBlur={() => handleFieldBlur(field.name)}
        />
      ))}

      {controlledFields.map(field => (
        <ControlledValueField
          key={field.name}
          field={field}
          value={formState[field.name]}
          onChange={value => {
            handleFieldChange(field.name, value)
            handleFieldBlur(field.name)
          }}
        />
      ))}

      {linkFields.map(field => (
        <LinkField
          key={field.name}
          field={field}
          object={object}
          catalog={open?.catalog}
          onRemove={(childId) => removeLink(object.id, field.name, childId)}
        />
      ))}

      {unknownProperties.length > 0 && (
        <section aria-labelledby="other-props-heading" className="margin-top-4">
          <h3 id="other-props-heading">Other properties</h3>
          <p className="text-base-dark">
            The DCAT-US 3.0 schema does not define these for {object.dcatClass}. They are preserved as-is.
          </p>
          {unknownProperties.map(([key, value]) => (
            <div key={key} className="margin-top-2">
              <Label htmlFor={`unknown-${key}`}>{key}</Label>
              <div id={`unknown-${key}`} className="usa-input text-base-darker bg-base-lightest" style={{ padding: '0.5rem' }}>
                {typeof value === 'string' ? value : JSON.stringify(value)}
              </div>
            </div>
          ))}
        </section>
      )}
    </form>
  )
}

interface TextFieldProps {
  field: FormField
  value: unknown
  onChange: (value: unknown) => void
  onBlur: () => void
}

function TextField({ field, value, onChange, onBlur }: TextFieldProps) {
  const inputId = `field-${field.name}`
  const helpId = field.helpText ? `${inputId}-help` : undefined
  const isTextarea = typeof value === 'string' && value.length > 100

  return (
    <div className="margin-top-3">
      <Label htmlFor={inputId}>
        {field.label}
        {field.required && <abbr title="required" className="usa-hint usa-hint--required"> *</abbr>}
      </Label>
      {field.helpText && (
        <div id={helpId} className="usa-hint">
          {field.helpText}
        </div>
      )}

      {isTextarea ? (
        <Textarea
          id={inputId}
          name={field.name}
          value={typeof value === 'string' ? value : ''}
          onChange={e => onChange(e.target.value)}
          onBlur={onBlur}
          aria-describedby={helpId}
        />
      ) : (
        <TextInput
          id={inputId}
          name={field.name}
          type="text"
          value={typeof value === 'string' ? value : ''}
          onChange={e => onChange(e.target.value)}
          onBlur={onBlur}
          aria-describedby={helpId}
        />
      )}
    </div>
  )
}

interface MultiValueFieldProps {
  field: FormField
  value: unknown
  onChange: (value: unknown) => void
  onBlur: () => void
}

function MultiValueField({ field, value, onChange, onBlur }: MultiValueFieldProps) {
  const items = Array.isArray(value) ? value : []
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  const handleAdd = () => {
    onChange([...items, ''])
  }

  const handleRemove = (index: number) => {
    onChange(items.filter((_, i) => i !== index))
    onBlur()

    setTimeout(() => {
      const nextInput = inputRefs.current[Math.min(index, items.length - 2)]
      nextInput?.focus()
    }, 50)
  }

  const handleChange = (index: number, newValue: string) => {
    const updated = [...items]
    updated[index] = newValue
    onChange(updated)
  }

  return (
    <section aria-labelledby={`field-${field.name}-heading`} className="margin-top-3">
      <h3 id={`field-${field.name}-heading`} className="font-sans-md">
        {field.label}
        {field.required && <abbr title="required" className="usa-hint usa-hint--required"> *</abbr>}
      </h3>
      {field.helpText && (
        <p className="usa-hint">{field.helpText}</p>
      )}
      {field.required && items.length === 0 && (
        <Alert type="warning" slim className="margin-top-1">
          This required field has no values
        </Alert>
      )}
      <ul className="usa-list usa-list--unstyled">
        {items.map((item, index) => (
          <li key={index} className="display-flex flex-align-center margin-top-1">
            <TextInput
              ref={el => { inputRefs.current[index] = el }}
              id={`field-${field.name}-${index}`}
              name={`${field.name}-${index}`}
              type="text"
              value={typeof item === 'string' ? item : ''}
              onChange={e => handleChange(index, e.target.value)}
              onBlur={onBlur}
              className="flex-fill margin-right-1"
              aria-label={`${field.label} ${index + 1}`}
            />
            <Button
              type="button"
              onClick={() => handleRemove(index)}
              unstyled
              className="usa-button--secondary"
              aria-label={`Remove ${field.label} ${index + 1}`}
            >
              Remove
            </Button>
          </li>
        ))}
      </ul>
      <Button type="button" onClick={handleAdd} outline>
        Add {field.label.toLowerCase()}
      </Button>
    </section>
  )
}

interface ControlledValueFieldProps {
  field: FormField
  value: unknown
  onChange: (value: unknown) => void
}

function ControlledValueField({ field, value, onChange }: ControlledValueFieldProps) {
  const inputId = `field-${field.name}`
  const helpId = field.helpText ? `${inputId}-help` : undefined

  return (
    <div className="margin-top-3">
      <Label htmlFor={inputId}>
        {field.label}
        {field.required && <abbr title="required" className="usa-hint usa-hint--required"> *</abbr>}
      </Label>
      {field.helpText && (
        <div id={helpId} className="usa-hint">
          {field.helpText}
        </div>
      )}

      <select
        id={inputId}
        name={field.name}
        value={typeof value === 'string' ? value : ''}
        onChange={e => onChange(e.target.value)}
        aria-describedby={helpId}
        className="usa-select"
      >
        <option value="">- Select -</option>
        {field.allowedValues?.map(option => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  )
}

interface LinkFieldProps {
  field: FormField
  object: CatalogObject
  catalog: DecomposedCatalog | undefined
  onRemove: (childId: string) => void
}

function LinkField({ field, object, catalog, onRemove }: LinkFieldProps) {
  const linkedIds = object.links[field.name] || []
  const inputRefs = useRef<(HTMLButtonElement | null)[]>([])

  const handleRemove = (index: number, childId: string) => {
    onRemove(childId)

    setTimeout(() => {
      const nextButton = inputRefs.current[Math.min(index, linkedIds.length - 2)]
      nextButton?.focus()
    }, 50)
  }

  if (linkedIds.length === 0) {
    return null
  }

  return (
    <section aria-labelledby={`field-${field.name}-heading`} className="margin-top-3">
      <h3 id={`field-${field.name}-heading`} className="font-sans-md">
        {field.label}
        {field.required && <abbr title="required" className="usa-hint usa-hint--required"> *</abbr>}
      </h3>
      {field.helpText && (
        <p className="usa-hint">{field.helpText}</p>
      )}
      {field.required && linkedIds.length === 0 && (
        <Alert type="warning" slim className="margin-top-1">
          This required field has no values
        </Alert>
      )}
      <ul className="usa-list usa-list--unstyled">
        {linkedIds.map((childId, index) => {
          const childObject = catalog?.objects.get(childId)
          const displayLabel = childObject ? labelOf(childObject) : childId

          return (
            <li key={childId} className="display-flex flex-align-center margin-top-1">
              <div className="flex-fill margin-right-1 padding-1 bg-base-lightest">
                <bdi>{displayLabel}</bdi>
              </div>
              <Button
                ref={el => { inputRefs.current[index] = el }}
                type="button"
                onClick={() => handleRemove(index, childId)}
                unstyled
                className="usa-button--secondary"
                aria-label={`Remove ${field.label} ${index + 1}`}
              >
                Remove
              </Button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
