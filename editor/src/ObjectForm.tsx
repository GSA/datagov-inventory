import { useState, useEffect, useRef, type ReactNode } from 'react'
import { Accordion, Label, TextInput, Textarea, Button, Alert, AlertHeading, AlertText } from '@trussworks/react-uswds'
import { Link, useRouterState } from '@tanstack/react-router'
import type { CatalogObject, CatalogWorkspace } from './catalog/types'
import { useCatalog, useEditCopy } from './session'
import { classLabel, fieldLabel } from './labels'
import { count, labelOf } from './tree'
import { editorPath } from './objectRoute'
import type { FormModel, FormField } from './schema'
import { usesOf, type Use } from './catalog/uses'
import { rowId } from './links'
import { LinkField } from './LinkField'
import { useValidation } from './validation/useValidation'
import { ValidationStatusBadge } from './validation/ValidationStatusBadge'
import { useValidationContext } from './validation/ValidationContext'
import { ValidationDisclaimer } from './validation/ValidationDisclaimer'
import { getFieldLabel } from './validation/messages'

interface ObjectFormProps {
  object: CatalogObject
  model: FormModel
  /** The object the breadcrumb leads up to, if any: "Back to …" the same object is shown on phones only. */
  parentId?: string
}

export function ObjectForm({ object, model, parentId }: ObjectFormProps) {
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

  /**
   * Saves a field. A change that saves at once (a removed value, a chosen option) passes the new value: formState in
   * this render still holds the old one, which would put the removed or replaced value back.
   */
  const handleFieldBlur = (fieldName: string, value: unknown = formState[fieldName]) => {
    updateObject(object.id, { properties: { [fieldName]: value } })
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
  const fields = byImportance(model.fields)
  const textFields = fields.filter(f => !f.name.startsWith('@') && holdsText(f) && f.cardinality === 'single' && !f.allowedValues)
  const multiFields = fields.filter(f => !f.name.startsWith('@') && holdsText(f) && f.cardinality === 'multiple')
  const controlledFields = fields.filter(f => !f.name.startsWith('@') && f.type === 'string' && f.allowedValues)
  // A class field holding text shows as a text field above; anything else as written (null, a mixed list) is left
  // alone, with no pick or create.
  const linkFields = fields.filter(f => !f.name.startsWith('@') && f.allowedClasses && f.allowedClasses.length > 0 && (object.properties[f.name] === undefined || emptyList(object.properties[f.name])))
  // Required fields first, whatever their kind, so a form opens on what it must have; then the rest by kind.
  const kinds = [
    ...textFields.map(field => ({ kind: 'text' as const, field })),
    ...multiFields.map(field => ({ kind: 'multi' as const, field })),
    ...controlledFields.map(field => ({ kind: 'controlled' as const, field })),
    ...linkFields.map(field => ({ kind: 'link' as const, field })),
  ]
  const ordered = [...kinds.filter(({ field }) => field.required), ...kinds.filter(({ field }) => !field.required)]
  const unknownProperties = Object.entries(object.properties).filter(
    ([key]) => !model.fields.some(f => f.name === key)
  )

  /** One field, as its kind shows it. */
  const renderField = (kind: (typeof ordered)[number]['kind'], field: FormField, fieldError?: { message: string }) => {
    switch (kind) {
      case 'text':
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
      case 'multi':
        return (
          <MultiValueField
            key={field.name}
            field={field}
            value={formState[field.name]}
            error={fieldError?.message}
            onChange={value => handleFieldChange(field.name, value)}
            onBlur={value => handleFieldBlur(field.name, value)}
          />
        )
      case 'controlled':
        return (
          <ControlledValueField
            key={field.name}
            field={field}
            value={formState[field.name]}
            error={fieldError?.message}
            onChange={value => {
              handleFieldChange(field.name, value)
              handleFieldBlur(field.name, value)
            }}
          />
        )
      case 'link':
        return open && <LinkField key={field.name} field={field} object={object} open={open} error={fieldError?.message} />
    }
  }

  /** The schema check's first message about a field: its value, a value in its list, or the field missing. */
  const getFieldError = (fieldName: string) => {
    return validationErrors.find(e =>
      e.instancePath === `/${fieldName}` ||
      e.instancePath.startsWith(`/${fieldName}/`) ||
      (e.type === 'required' && e.instancePath === '' && e.field === getFieldLabel(fieldName)) ||
      e.field.toLowerCase() === fieldName.split(':')[1]?.toLowerCase()
    )
  }

  // One width (a USWDS tablet, 40rem) for fields, hints, rows and rules, so lines stay readable on a wide screen.
  return (
    <form aria-label={`Edit ${labelOf(object)}`} className="object-form maxw-tablet">
      {/*
        The header, one block under a rule: what this is, the way back, whether it is valid, and where else it is used
        when it is shared. Only what changes the edit shows; the breadcrumb above already says where it is.
      */}
      <div className="padding-bottom-2 border-bottom-1px border-base-lighter">
        {/* The class beside the title, outside the heading, so the heading is the object's name alone. */}
        <div className="display-flex flex-wrap flex-align-baseline">
          {/* The note on a new object or a copy is read with the heading that focus moves to. */}
          <h2 id="detail-heading" tabIndex={-1} aria-describedby={notice ? 'object-notice' : undefined} className="margin-top-1 margin-bottom-0 margin-right-1">
            {labelOf(object)}
          </h2>
          <span className="text-base-dark">{classLabel(object.dcatClass)}</span>
        </div>
        {open && <BackTo object={object} open={open} parentId={parentId} />}

        {/* The badge and its button on one line, even on a phone, where USWDS buttons are otherwise full width. */}
        <div className="display-flex flex-wrap flex-align-center margin-top-2">
          <ValidationStatusBadge state={validationState} errorCount={validationErrors.length} />
          {isReady && (
            <Button
              type="button"
              onClick={handleValidate}
              outline
              disabled={isValidating}
              className="width-auto margin-y-0"
              aria-label={`Validate ${labelOf(object)}`}
            >
              {isValidating ? 'Validating...' : 'Validate'}
            </Button>
          )}
        </div>

        {validationErrors.length > 0 && (
          <Alert type="error" role="alert" aria-live="polite" className="margin-top-2">
            <AlertHeading level="h3">
              {validationErrors.length === 1 ? 'Fix this error' : `Fix these ${count(validationErrors.length)} errors`}
            </AlertHeading>
            <ul className="usa-list margin-y-1">
              {validationErrors.map((error, idx) => (
                <li key={idx}>
                  <strong>{error.field}:</strong> {error.message}
                </li>
              ))}
            </ul>
            {/* In the alert's own ink, not the hint's grey, which is too faint on its background. */}
            <ValidationDisclaimer className="font-sans-2xs margin-top-1 margin-bottom-0" />
          </Alert>
        )}
        {open && <UsedIn object={object} open={open} />}
      </div>

      {fields.some(f => f.required) && (
        <p className="usa-hint margin-top-2 margin-bottom-0">
          Required fields are marked with an asterisk (<abbr title="required" className="usa-hint--required">*</abbr>).
        </p>
      )}
      {ordered.map(({ kind, field }, index) => {
        const fieldError = getFieldError(field.name)
        const rendered = renderField(kind, field, fieldError)
        // A rule between the required fields and the rest.
        return index > 0 && !field.required && ordered[index - 1].field.required ? (
          <div key={field.name} className="margin-top-4 padding-top-1 border-top-1px border-base-lighter">
            {rendered}
          </div>
        ) : (
          rendered
        )
      })}

      {unknownProperties.length > 0 && (
        <section aria-labelledby="other-props-heading" className="margin-top-4">
          <h3 id="other-props-heading">Other properties</h3>
          <p className="text-base-dark">
            The DCAT-US 3.0 schema does not define these for {classLabel(object.dcatClass)}. They are preserved as-is.
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

/** Fields people look for first: an object's name and description, ahead of the rest in schema order. */
const LEAD_FIELDS = ['title', 'name', 'fn', 'prefLabel', 'label', 'description']

/** Required fields first, then within each the lead fields, then the schema's order (the sort is stable). */
function byImportance(fields: readonly FormField[]): FormField[] {
  const lead = (f: FormField) => (LEAD_FIELDS.includes(f.name) ? LEAD_FIELDS.indexOf(f.name) : LEAD_FIELDS.length)
  return [...fields].sort((a, b) => Number(b.required) - Number(a.required) || lead(a) - lead(b))
}

/** Free-text properties that hold sentences or paragraphs, so they get a multi-line box even when empty. */
const LONG_TEXT = new Set([
  'description',
  'abstract',
  'scopeNote',
  'versionNotes',
  'liabilityStatement',
  'purpose',
  'definition',
  'restrictionNote',
  'bibliographicCitation',
])

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
  // Decided once: switching from an input to a textarea while typing past 100 characters would lose focus.
  const [isTextarea] = useState(() => LONG_TEXT.has(field.name) || (typeof value === 'string' && value.length > 100))

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
          className="height-15"
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
  error?: string
  onChange: (value: unknown) => void
  /** Saves the field: the values typed so far, or `value` when a change saves at once. */
  onBlur: (value?: unknown) => void
}

function MultiValueField({ field, value, error, onChange, onBlur }: MultiValueFieldProps) {
  // A string-or-list field (e.g. language) may hold one string.
  const items = Array.isArray(value) ? value : typeof value === 'string' ? [value] : []
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  const handleAdd = () => {
    onChange([...items, ''])
  }

  const handleRemove = (index: number) => {
    const remaining = items.filter((_, i) => i !== index)
    onChange(remaining)
    onBlur(remaining)

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
      <FieldError id={`field-${field.name}-error`} error={error} />
      {field.required && items.length === 0 && !error && (
        <Alert type="warning" slim className="margin-top-1">
          <AlertText>This required field has no values</AlertText>
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
              onBlur={() => onBlur()}
              validationStatus={error ? 'error' : undefined}
              className="flex-fill margin-top-0 margin-right-1"
              aria-label={`${field.label} ${index + 1}`}
              aria-describedby={error ? `field-${field.name}-error` : undefined}
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

/**
 * The places that link to an object (#25), the one the user came from first, so its "Back to …" and "Edit a copy"
 * are at hand among many; and a link to each, which returns focus to the object's row there.
 */
function placesOf(object: CatalogObject, open: CatalogWorkspace, from: string | undefined) {
  const catalog = open.catalog
  const all = usesOf(catalog).get(object.id) ?? []
  const uses = [...all.filter(use => use.parentId === from), ...all.filter(use => use.parentId !== from)]
  const parentOf = (use: Use) => catalog.objects.get(use.parentId)!
  const place = (use: Use) => (
    <>
      <bdi>{labelOf(parentOf(use))}</bdi> › {fieldLabel(use.property)}
    </>
  )
  const linkTo = (use: Use, children: ReactNode, className = 'usa-link') => (
    <Link
      to="/editor/$"
      params={{
        _splat: editorPath(open, parentOf(use)),
      }}
      state={{ focus: rowId(use.property, object.id) }}
      className={className}
    >
      {children}
    </Link>
  )
  return { uses, parentOf, place, linkTo }
}

/**
 * The notice from Create new or a copy, then "Back to" the place the user came from. Back is the one way back on a
 * phone, where the breadcrumb is hidden. On wider screens it shows only where the breadcrumb doesn't lead the same
 * way: right after Create new or a copy, or for a shared object opened from another place than the breadcrumb's.
 */
function BackTo({ object, open, parentId }: { object: CatalogObject; open: CatalogWorkspace; parentId?: string }) {
  const { from, notice } = useRouterState({ select: s => s.location.state })
  if (object.id === open.catalog.rootId) return null
  const { uses, parentOf, linkTo } = placesOf(object, open, from)
  const back = uses[0]
  const sameAsBreadcrumb = !notice && back?.parentId === parentId
  return (
    <>
      {notice && (
        <Alert id="object-notice" type="info" slim className="margin-top-1 margin-bottom-0">
          <AlertText>{notice}</AlertText>
        </Alert>
      )}
      {back && (
        <p className={`margin-top-1 margin-bottom-0${sameAsBreadcrumb ? ' tablet:display-none' : ''}`}>
          {linkTo(
            back,
            <>
              <span aria-hidden="true">← </span>Back to <bdi>{labelOf(parentOf(back))}</bdi>
            </>,
          )}
        </p>
      )}
    </>
  )
}

/**
 * Where a shared object is used: the count and what it means are always in view; the places, each with "Edit a copy
 * for this one", fold away, since a contact can be used by hundreds of datasets. An object used in one place says
 * nothing here (the breadcrumb and Back show that place), and one used nowhere says so.
 */
function UsedIn({ object, open }: { object: CatalogObject; open: CatalogWorkspace }) {
  const editCopy = useEditCopy()
  const from = useRouterState({ select: s => s.location.state.from })
  if (object.id === open.catalog.rootId) return null

  const { uses, parentOf, place, linkTo } = placesOf(object, open, from)
  if (uses.length === 0) return <p className="text-base-dark margin-top-2 margin-bottom-0">Not used anywhere in this catalog.</p>
  if (uses.length === 1) return null
  return (
    <div role="group" aria-labelledby="used-in-heading" className="margin-top-2">
      <h3 id="used-in-heading" className="font-sans-sm margin-y-0">
        Used in {count(uses.length)} places
      </h3>
      <p className="text-base-dark margin-top-05 margin-bottom-1">
        Changes here apply to every place. To change one place only, edit a copy for it.
      </p>
      <Accordion
        bordered={false}
        items={[
          {
            id: 'used-in-places',
            title: 'Places and copy options',
            headingLevel: 'h4',
            expanded: false,
            content: (
              <>
                <ul className="usa-list usa-list--unstyled">
                  {uses.slice(0, USES_SHOWN).map(use => (
                    <li key={`${use.parentId} ${use.property}`} className="margin-bottom-1">
                      {linkTo(use, place(use))}{' '}
                      <Button
                        type="button"
                        unstyled
                        className="margin-left-1"
                        onClick={() => editCopy(parentOf(use), use.property, object)}
                        aria-label={`Edit a copy for this one: ${labelOf(parentOf(use))} › ${fieldLabel(use.property)}`}
                      >
                        Edit a copy for this one
                      </Button>
                    </li>
                  ))}
                </ul>
                {uses.length > USES_SHOWN && <p className="text-base-dark">… and {count(uses.length - USES_SHOWN)} more.</p>}
              </>
            ),
          },
        ]}
      />
    </div>
  )
}
