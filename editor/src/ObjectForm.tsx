import { useState, useEffect, useRef, type ReactNode } from 'react'
import { Label, TextInput, Textarea, Button, Alert, AlertHeading, AlertText } from '@trussworks/react-uswds'
import { Link, useRouterState } from '@tanstack/react-router'
import type { CatalogObject, CatalogGraph } from './catalog/types'
import { useCatalog, useEditCopy } from './session'
import { count, labelOf, pathOf } from './tree'
import { getFormModel, type FormModel, type FormField } from './schema'
import { rowId, usesOf, type Use } from './links'
import { LinkField } from './LinkField'
import { useValidation } from './validation/useValidation'
import { ValidationStatusBadge } from './validation/ValidationStatusBadge'
import { useValidationContext } from './validation/ValidationContext'
import { ValidationDisclaimer } from './validation/ValidationDisclaimer'

interface ObjectFormProps {
  object: CatalogObject
  model: FormModel
}

export function ObjectForm({ object, model }: ObjectFormProps) {
  const { updateObject, open } = useCatalog()
  const notice = useRouterState({ select: s => s.location.state.notice })
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

  useEffect(() => {
    if (validationState === 'stale' && isReady) {
      const timer = setTimeout(() => {
        validateObject(object.id).catch((error) => {
          console.error('Auto-revalidation failed:', error)
        })
      }, 2000)

      return () => clearTimeout(timer)
    }
  }, [validationState, isReady, object.id, validateObject])

  // A class field can also hold strings (a Concept or Identifier given as text), which decompose keeps as properties.
  // An empty list ([]) in a class field holds no text: it shows as the field's (empty) objects instead.
  const emptyList = (value: unknown) => Array.isArray(value) && value.length === 0
  const holdsText = (f: FormField) =>
    f.type === 'string' || (!!f.allowedClasses && isText(object.properties[f.name]) && !emptyList(object.properties[f.name]))
  const textFields = model.fields.filter(f => !f.name.startsWith('@') && holdsText(f) && f.cardinality === 'single' && !f.allowedValues)
  const multiFields = model.fields.filter(f => !f.name.startsWith('@') && holdsText(f) && f.cardinality === 'multiple')
  const controlledFields = model.fields.filter(f => !f.name.startsWith('@') && f.type === 'string' && f.allowedValues)
  // A class field holding text shows as a text field above; anything else as written (null, a mixed list) is left
  // alone, with no pick or create.
  const linkFields = model.fields.filter(f => !f.name.startsWith('@') && f.allowedClasses && f.allowedClasses.length > 0 && (object.properties[f.name] === undefined || emptyList(object.properties[f.name])))
  const unknownProperties = Object.entries(object.properties).filter(
    ([key]) => !model.fields.some(f => f.name === key)
  )

  const getFieldError = (fieldName: string) => {
    return validationErrors.find(e =>
      e.instancePath === `/${fieldName}` ||
      e.field.toLowerCase() === fieldName.split(':')[1]?.toLowerCase()
    )
  }

  return (
    <form aria-label={`Edit ${labelOf(object)}`} className="object-form">
      {/* The note on a new object or a copy is read with the heading that focus moves to. */}
      <h2 id="detail-heading" tabIndex={-1} aria-describedby={notice ? 'object-notice' : undefined} className="margin-top-1 margin-bottom-0">
        {labelOf(object)}
      </h2>
      <p className="text-base-dark margin-top-05">
        {object.dcatClass} <code className="font-mono-3xs">{object.id}</code>
      </p>
      {open && <UsedIn object={object} catalog={open.catalog} />}

      {/* The badge and its button on one line, even on a phone, where USWDS buttons are otherwise full width. */}
      <div className="display-flex flex-wrap flex-align-center margin-y-2">
        <ValidationStatusBadge state={validationState} errorCount={validationErrors.length} />
        {isReady && (
          <Button
            type="button"
            onClick={handleValidate}
            outline
            disabled={isValidating}
            className="width-auto margin-y-0 margin-left-1"
            aria-label={`Validate ${labelOf(object)}`}
          >
            {isValidating ? 'Validating...' : 'Validate'}
          </Button>
        )}
      </div>

      {validationErrors.length > 0 && (
        <>
          <Alert type="error" role="alert" aria-live="polite">
            <AlertHeading level="h3">Validation errors</AlertHeading>
            <ul className="usa-list margin-y-1">
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

      {textFields.map(field => {
        const fieldError = getFieldError(field.name)
        return (
          <TextField
            key={field.name}
            field={field}
            value={formState[field.name]}
            error={fieldError?.message}
            onChange={value => handleFieldChange(field.name, value)}
            onBlur={() => handleFieldBlur(field.name)}
          />
        )
      })}

      {multiFields.map(field => {
        const fieldError = getFieldError(field.name)
        return (
          <div key={field.name}>
            <MultiValueField
              field={field}
              value={formState[field.name]}
              onChange={value => handleFieldChange(field.name, value)}
              onBlur={() => handleFieldBlur(field.name)}
            />
            {fieldError && (
              <div className="usa-error-message" role="alert">
                {fieldError.message}
              </div>
            )}
          </div>
        )
      })}

      {controlledFields.map(field => {
        const fieldError = getFieldError(field.name)
        return (
          <ControlledValueField
            key={field.name}
            field={field}
            value={formState[field.name]}
            error={fieldError?.message}
            onChange={value => {
              handleFieldChange(field.name, value)
              handleFieldBlur(field.name)
            }}
          />
        )
      })}

      {open && linkFields.map(field => (
        <LinkField key={field.name} field={field} object={object} catalog={open.catalog} />
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
              <div id={`unknown-${key}`} className="usa-input height-auto padding-1 text-base-darker bg-base-lightest">
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
  /** The schema check's message for this field, shown the USWDS way: between the hint and the input. */
  error?: string
  onChange: (value: unknown) => void
  onBlur: () => void
}

function isText(value: unknown): boolean {
  return typeof value === 'string' || (Array.isArray(value) && value.every(item => typeof item === 'string'))
}

/** The USWDS error pattern: a form group with a red bar, the message under the hint, and the input outlined in red. */
function FieldError({ id, error }: { id: string; error?: string }) {
  if (!error) return null
  return (
    <span id={id} className="usa-error-message" role="alert">
      {error}
    </span>
  )
}

const groupClass = (error?: string) => (error ? 'usa-form-group usa-form-group--error margin-top-3' : 'margin-top-3')
const describedBy = (...ids: (string | undefined)[]) => ids.filter(Boolean).join(' ') || undefined

function TextField({ field, value, error, onChange, onBlur }: TextFieldProps) {
  const inputId = `field-${field.name}`
  const helpId = field.helpText ? `${inputId}-help` : undefined
  const errorId = error ? `${inputId}-error` : undefined
  const isTextarea = typeof value === 'string' && value.length > 100

  return (
    <div className={groupClass(error)}>
      <Label htmlFor={inputId} error={!!error}>
        {field.label}
        {field.required && <abbr title="required" className="usa-hint usa-hint--required"> *</abbr>}
      </Label>
      {field.helpText && (
        <div id={helpId} className="usa-hint">
          {field.helpText}
        </div>
      )}

      <FieldError id={`${inputId}-error`} error={error} />
      {isTextarea ? (
        <Textarea
          id={inputId}
          name={field.name}
          value={typeof value === 'string' ? value : ''}
          onChange={e => onChange(e.target.value)}
          onBlur={onBlur}
          error={!!error}
          aria-describedby={describedBy(helpId, errorId)}
        />
      ) : (
        <TextInput
          id={inputId}
          name={field.name}
          type="text"
          value={typeof value === 'string' ? value : ''}
          onChange={e => onChange(e.target.value)}
          onBlur={onBlur}
          validationStatus={error ? 'error' : undefined}
          aria-describedby={describedBy(helpId, errorId)}
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
  // A string-or-list field (e.g. language) may hold one string.
  const items = Array.isArray(value) ? value : typeof value === 'string' ? [value] : []
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
    <section aria-labelledby={`field-${field.name}-heading`} className="margin-top-4 padding-top-3 border-top-1px border-base-lighter">
      <h3 id={`field-${field.name}-heading`} className="font-sans-md margin-y-0">
        {field.label}
        {field.required && <abbr title="required" className="usa-hint usa-hint--required"> *</abbr>}
      </h3>
      {field.helpText && (
        <p className="usa-hint margin-top-05 margin-bottom-0">{field.helpText}</p>
      )}
      {field.required && items.length === 0 && (
        <Alert type="warning" slim className="margin-top-1">
          This required field has no values
        </Alert>
      )}
      <ul className="usa-list usa-list--unstyled margin-top-1">
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
              className="flex-fill margin-top-0 margin-right-1"
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
      <Button type="button" onClick={handleAdd} outline className="margin-top-2">
        Add {field.label.toLowerCase()}
      </Button>
    </section>
  )
}

interface ControlledValueFieldProps {
  field: FormField
  value: unknown
  error?: string
  onChange: (value: unknown) => void
}

function ControlledValueField({ field, value, error, onChange }: ControlledValueFieldProps) {
  const inputId = `field-${field.name}`
  const helpId = field.helpText ? `${inputId}-help` : undefined
  const errorId = error ? `${inputId}-error` : undefined

  return (
    <div className={groupClass(error)}>
      <Label htmlFor={inputId} error={!!error}>
        {field.label}
        {field.required && <abbr title="required" className="usa-hint usa-hint--required"> *</abbr>}
      </Label>
      {field.helpText && (
        <div id={helpId} className="usa-hint">
          {field.helpText}
        </div>
      )}

      <FieldError id={`${inputId}-error`} error={error} />
      <select
        id={inputId}
        name={field.name}
        value={typeof value === 'string' ? value : ''}
        onChange={e => onChange(e.target.value)}
        aria-describedby={describedBy(helpId, errorId)}
        className={error ? 'usa-select usa-input--error' : 'usa-select'}
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

/** Places listed at most: a contact can be used by thousands of datasets. */
const USES_SHOWN = 50

const fieldLabel = (dcatClass: string, property: string) =>
  getFormModel(dcatClass)?.fields.find(f => f.name === property)?.label ?? property

/**
 * Where the object is used (#25): "Back to" the place the user came from, and every place that links to it, each
 * with "Edit a copy for this one" when there are several. The notice from Create new or a copy shows here too.
 */
function UsedIn({ object, catalog }: { object: CatalogObject; catalog: CatalogGraph }) {
  const editCopy = useEditCopy()
  const { from, notice } = useRouterState({ select: s => s.location.state })
  if (object.id === catalog.rootId) return null

  // The place the user came from first, so its "Edit a copy" is at hand among many.
  const all = usesOf(catalog).get(object.id) ?? []
  const uses = [...all.filter(use => use.parentId === from), ...all.filter(use => use.parentId !== from)]
  const back = uses[0]
  const parentOf = (use: Use) => catalog.objects.get(use.parentId)!
  const place = (use: Use) => (
    <>
      <bdi>{labelOf(parentOf(use))}</bdi> › {fieldLabel(parentOf(use).dcatClass, use.property)}
    </>
  )
  const linkTo = (use: Use, children: ReactNode, className = 'usa-link') => (
    <Link
      to="/editor/$"
      params={{ _splat: pathOf(use.parentId) }}
      state={{ focus: rowId(use.property, object.id) }}
      className={className}
    >
      {children}
    </Link>
  )
  return (
    <div className="margin-bottom-2">
      {back && (
        <p className="margin-y-1">
          {linkTo(back, <span>Back to <bdi>{labelOf(parentOf(back))}</bdi></span>, 'usa-button usa-button--outline usa-button--small')}
        </p>
      )}
      {notice && (
        <Alert id="object-notice" type="info" slim className="margin-y-1">
          <AlertText>{notice}</AlertText>
        </Alert>
      )}
      {uses.length === 0 && <p className="text-base-dark">Not linked anywhere.</p>}
      {uses.length === 1 && <p className="text-base-dark margin-y-1">Used in 1 place: {linkTo(uses[0], place(uses[0]))}</p>}
      {uses.length > 1 && (
        <div role="group" aria-labelledby="used-in-heading">
          <h3 id="used-in-heading" className="font-sans-sm margin-bottom-0">
            Used in {count(uses.length)} places
          </h3>
          <p className="text-base-dark margin-top-05">Changes apply to all of them. To change it for one place only, edit a copy there.</p>
          <ul className="usa-list">
            {uses.slice(0, USES_SHOWN).map(use => (
              <li key={`${use.parentId} ${use.property}`}>
                {linkTo(use, place(use))}{' '}
                <Button
                  type="button"
                  unstyled
                  className="margin-left-1"
                  onClick={() => editCopy(parentOf(use), use.property, object)}
                  aria-label={`Edit a copy for this one: ${labelOf(parentOf(use))} › ${fieldLabel(parentOf(use).dcatClass, use.property)}`}
                >
                  Edit a copy for this one
                </Button>
              </li>
            ))}
          </ul>
          {uses.length > USES_SHOWN && <p className="text-base-dark">… and {count(uses.length - USES_SHOWN)} more.</p>}
        </div>
      )}
    </div>
  )
}
