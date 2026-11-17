import { useState, useEffect, useRef, type ReactNode } from 'react'
import { Label, TextInput, Textarea, Button, Alert, AlertText } from '@trussworks/react-uswds'
import { Link, useRouterState } from '@tanstack/react-router'
import type { CatalogObject, DecomposedCatalog } from './catalog/decompose'
import { useCatalog, useEditCopy } from './session'
import { count, labelOf, pathOf } from './tree'
import { getFormModel, type FormModel, type FormField } from './schema'
import { rowId, usesOf, type Use } from './links'
import { LinkField } from './LinkField'

interface ObjectFormProps {
  object: CatalogObject
  model: FormModel
}

export function ObjectForm({ object, model }: ObjectFormProps) {
  const { updateObject, open } = useCatalog()
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

  // A class field can also hold strings (a Concept or Identifier given as text), which decompose keeps as properties.
  // An empty list ([]) in a class field holds no text: it shows as the field's (empty) objects instead.
  const emptyList = (value: unknown) => Array.isArray(value) && value.length === 0
  const holdsText = (f: FormField) =>
    f.type === 'string' || (!!f.allowedClasses && isText(object.properties[f.name]) && !emptyList(object.properties[f.name]))
  const textFields = model.fields.filter(f => !f.name.startsWith('@') && holdsText(f) && f.cardinality === 'single' && !f.allowedValues)
  const multiFields = model.fields.filter(f => !f.name.startsWith('@') && holdsText(f) && f.cardinality === 'multiple')
  const controlledFields = model.fields.filter(f => !f.name.startsWith('@') && f.type === 'string' && f.allowedValues)
  // A class field holding something else as written (text, null, a mixed list) shows that instead, above or below.
  const linkFields = model.fields.filter(f => !f.name.startsWith('@') && f.allowedClasses && f.allowedClasses.length > 0 && (object.properties[f.name] === undefined || emptyList(object.properties[f.name])))
  const unknownProperties = Object.entries(object.properties).filter(
    ([key]) => !model.fields.some(f => f.name === key)
  )

  return (
    <form aria-label={`Edit ${labelOf(object)}`} className="object-form">
      <h2 id="detail-heading" tabIndex={-1}>
        {labelOf(object)}
      </h2>
      <p className="text-base-dark">
        {object.dcatClass} <code className="font-mono-3xs">{object.id}</code>
      </p>
      {open && <UsedIn object={object} catalog={open.catalog} />}

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

function isText(value: unknown): boolean {
  return typeof value === 'string' || (Array.isArray(value) && value.every(item => typeof item === 'string'))
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

/** Places listed at most: a contact can be used by thousands of datasets. */
const USES_SHOWN = 50

const fieldLabel = (dcatClass: string, property: string) =>
  getFormModel(dcatClass)?.fields.find(f => f.name === property)?.label ?? property

/**
 * Where the object is used (#25): "Back to" the place the user came from, and every place that links to it, each
 * with "Edit a copy for this one" when there are several. The notice from Create new or a copy shows here too.
 */
function UsedIn({ object, catalog }: { object: CatalogObject; catalog: DecomposedCatalog }) {
  const editCopy = useEditCopy()
  const { from, notice } = useRouterState({ select: s => s.location.state })
  if (object.id === catalog.rootId) return null

  // The place the user came from first, so its "Edit a copy" is at hand among many.
  const all = usesOf(catalog).get(object.id) ?? []
  const uses = [...all.filter(use => use.parentId === from), ...all.filter(use => use.parentId !== from)]
  const back = uses.find(use => use.parentId === from) ?? uses[0]
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
        <Alert type="info" slim className="margin-y-1">
          <AlertText>{notice}</AlertText>
        </Alert>
      )}
      {uses.length === 0 && <p className="text-base-dark">Not linked anywhere.</p>}
      {uses.length === 1 && <p className="text-base-dark margin-y-1">Used in 1 place: {linkTo(uses[0], place(uses[0]))}</p>}
      {uses.length > 1 && (
        <section aria-labelledby="used-in-heading">
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
                  onClick={() => editCopy(parentOf(use), use.property, object)}
                  aria-label={`Edit a copy for this one: ${labelOf(parentOf(use))}`}
                >
                  Edit a copy for this one
                </Button>
              </li>
            ))}
          </ul>
          {uses.length > USES_SHOWN && <p className="text-base-dark">… and {count(uses.length - USES_SHOWN)} more.</p>}
        </section>
      )}
    </div>
  )
}
