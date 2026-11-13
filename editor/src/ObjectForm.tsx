import { useState, useEffect } from 'react'
import { Label, TextInput, Textarea, Button } from '@trussworks/react-uswds'
import type { CatalogObject } from './catalog/decompose'
import type { FormModel, FormField } from './schema'
import { useCatalog } from './session'
import { labelOf } from './tree'

interface ObjectFormProps {
  object: CatalogObject
  model: FormModel
}

export function ObjectForm({ object, model }: ObjectFormProps) {
  const { updateObject } = useCatalog()
  const [formState, setFormState] = useState(object.properties)

  useEffect(() => {
    setFormState(object.properties)
  }, [object.id, object.properties])

  const handleFieldChange = (fieldName: string, value: unknown) => {
    setFormState(prev => ({ ...prev, [fieldName]: value }))
  }

  const handleFieldBlur = (fieldName: string) => {
    updateObject(object.id, { properties: { [fieldName]: formState[fieldName] } })
  }

  const textFields = model.fields.filter(f => !f.name.startsWith('@') && f.cardinality === 'single' && !f.allowedValues)
  const multiFields = model.fields.filter(f => !f.name.startsWith('@') && f.cardinality === 'multiple' && f.type !== 'object')
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

  const handleAdd = () => {
    onChange([...items, ''])
  }

  const handleRemove = (index: number) => {
    onChange(items.filter((_, i) => i !== index))
    onBlur()
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
      <ul className="usa-list usa-list--unstyled">
        {items.map((item, index) => (
          <li key={index} className="display-flex flex-align-center margin-top-1">
            <TextInput
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
