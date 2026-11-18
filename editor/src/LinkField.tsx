import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { Alert, AlertText, Button, ButtonGroup, Label } from '@trussworks/react-uswds'
import { Link, useNavigate } from '@tanstack/react-router'
import type { CatalogGraph, CatalogObject, CatalogWorkspace } from './catalog/types'
import { usesOf } from './catalog/uses'
import { candidatesFor, classesFor, linkModeOf, rowId, search } from './links'
import type { FormField } from './schema'
import { useCatalog, useEditCopy } from './session'
import { useValidationContext } from './validation/ValidationContext'
import { classLabel, count, isolate, labelOf } from './tree'
import { editorPath } from './objectRoute'

const places = (n: number) => `${count(n)} ${n === 1 ? 'place' : 'places'}`
/** "Kind", "Agent or Organization": class names as the schema writes them. */
const classList = (classes: readonly string[]) => classes.map(classLabel).join(' or ')

/**
 * A class-valued field (#25): the objects it links to, then "Add an existing …" and "Create new …", as the field's
 * link mode allows. Create new opens the new object's form in place of this one (no dialog); its "Back to …"
 * returns here.
 */
export function LinkField({
  field,
  object,
  open,
  error,
}: {
  field: FormField
  object: CatalogObject
  open: CatalogWorkspace
  /** The schema check's message for this field, such as that a required one is empty. */
  error?: string
}) {
  const { removeLink, linkObject, createObject } = useCatalog()
  const catalog = open.catalog
  const editCopy = useEditCopy()
  // A changed field makes the object's schema check (#27) out of date.
  const { markStale } = useValidationContext()
  const navigate = useNavigate()
  const allowed = field.allowedClasses!
  const classes = classesFor(allowed)
  const ids = object.links[field.name] ?? []
  const uses = usesOf(catalog)
  const single = field.cardinality === 'single'
  const mode = linkModeOf(object.dcatClass, field.name, allowed)
  const headingId = `field-${field.name}-heading`
  const [status, setStatus] = useState('')
  const removeRefs = useRef<(HTMLButtonElement | null)[]>([])
  const section = useRef<HTMLDivElement>(null)
  /** The row to focus once it renders: the object just added. */
  const focusRow = useRef<string>(undefined)

  const handleRemove = (index: number, childId: string, label: string) => {
    removeLink(object.id, field.name, childId)
    markStale(object.id)
    setStatus(`Removed ${isolate(label)} from ${field.label}.`)
    // The next row's Remove, the previous one's if it was last, or, once the field is empty, its first input or button.
    setTimeout(() => {
      const next = ids.length > 1 ? removeRefs.current[Math.min(index, ids.length - 2)] : undefined
      ;(next ?? section.current?.querySelector<HTMLElement>('input, button'))?.focus()
    }, 50)
  }

  const handlePick = (picked: CatalogObject) => {
    linkObject(object.id, field.name, picked.id, single)
    markStale(object.id)
    focusRow.current = picked.id
    const n = (uses.get(picked.id)?.length ?? 0) + 1
    setStatus(`Added ${isolate(labelOf(picked))} to ${field.label}.${n > 1 ? ` It is now used in ${places(n)}.` : ''}`)
  }

  const handleCreate = (dcatClass: string) => {
    const id = createObject(object.id, field.name, dcatClass, single)
    markStale(object.id)
    if (id) {
      const notice = `New ${classLabel(dcatClass)}, linked to ${isolate(labelOf(object))} › ${field.label}. Everything else is blank. Each field saves when you leave it, and you can come back to this object later.`
      navigate({ to: '/editor/$', params: { _splat: editorPath(open, id) }, state: { from: object.id, notice } })
    }
  }

  const pool = useCallback(() => candidatesFor(catalog, object, field.name, allowed), [catalog, object, field.name, allowed])

  return (
    // A group, not a region: a form with 40 class-valued fields would fill the landmarks list.
    <div ref={section} role="group" aria-labelledby={headingId} className="margin-top-4 padding-top-3 border-top-1px border-base-lighter">
      <h3 id={headingId} className="font-sans-md margin-y-0">
        {field.label}
        {field.required && <abbr title="required" className="usa-hint usa-hint--required"> *</abbr>}
      </h3>
      {field.helpText && <p className="usa-hint margin-y-05">{field.helpText}</p>}
      <p className="usa-hint margin-top-05 margin-bottom-0">
        Holds {single ? 'one' : 'one or more'}: {classList(classes)}.
      </p>
      {error && (
        <span id={`field-${field.name}-error`} className="usa-error-message" role="alert">
          {error}
        </span>
      )}
      {field.required && ids.length === 0 && !error && (
        <Alert type="warning" slim className="margin-top-1">
          <AlertText>This required field has no values</AlertText>
        </Alert>
      )}
      {ids.length > 0 && (
        <ul className="usa-list usa-list--unstyled">
          {ids.map((childId, index) => {
            const child = catalog.objects.get(childId)
            const label = child ? labelOf(child) : childId
            const n = uses.get(childId)?.length ?? 0
            return (
              <li key={childId} className="link-row margin-top-1">
                {child ? (
                  <Link
                    id={rowId(field.name, childId)}
                    ref={(el) => {
                      if (el && focusRow.current === childId) {
                        focusRow.current = undefined
                        el.focus()
                      }
                    }}
                    to="/editor/$"
                    params={{ _splat: editorPath(open, child.id) }}
                    state={{ from: object.id }}
                    className="usa-link text-bold"
                  >
                    <bdi>{label}</bdi>
                  </Link>
                ) : (
                  <bdi>{label}</bdi>
                )}
                <span className="text-base-dark">
                  {child && ` ${classLabel(child.dcatClass)}`}
                  {n > 1 && ` · Used in ${places(n)}`}
                </span>
                <span className="link-row__actions">
                  {child && n > 1 && (
                    <Button
                      type="button"
                      unstyled
                      onClick={() => editCopy(object, field.name, child)}
                      aria-label={`Edit a copy for this one: ${label}`}
                    >
                      Edit a copy for this one
                    </Button>
                  )}
                  <Button
                    ref={(el) => {
                      removeRefs.current[index] = el
                    }}
                    type="button"
                    unstyled
                    onClick={() => handleRemove(index, childId, label)}
                    aria-label={`Remove ${label} from ${field.label}`}
                  >
                    Remove
                  </Button>
                </span>
              </li>
            )
          })}
        </ul>
      )}
      {single && ids.length > 0 ? (
        <p className="usa-hint">Holds one {classList(classes)}. To use a different one, remove this one first.</p>
      ) : (
        <div>
          {mode === 'select' && (
            <p className="usa-hint margin-top-05 margin-bottom-0">These belong to the catalog, so pick one that is already in it.</p>
          )}
          {mode !== 'create' && (
            <ObjectPicker
              id={`pick-${field.name}`}
              label={`Add an existing ${classList(classes)}`}
              fieldLabel={field.label}
              pool={pool}
              catalog={catalog}
              onPick={handlePick}
            />
          )}
          {mode !== 'select' && (
            <ButtonGroup className="margin-top-105">
              {classes.map((dcatClass) => (
                <Button key={dcatClass} type="button" outline onClick={() => handleCreate(dcatClass)}>
                  Create new {classLabel(dcatClass)}
                  <span className="usa-sr-only"> in {field.label}</span>
                </Button>
              ))}
            </ButtonGroup>
          )}
        </div>
      )}
      <div role="status" className="usa-sr-only">
        {status}
      </div>
    </div>
  )
}

interface ObjectPickerProps {
  id: string
  label: string
  /** The field's label, which tells apart the pickers for the same classes in one form. */
  fieldLabel: string
  /** The objects it can offer, A to Z; called when the list first opens, not on every render of the form. */
  pool: () => CatalogObject[]
  catalog: CatalogGraph
  onPick: (object: CatalogObject) => void
}

/**
 * Picks one of thousands of objects by typing part of its name: an APG combobox with a listbox popup
 * (https://www.w3.org/WAI/ARIA/apg/patterns/combobox/examples/combobox-autocomplete-list/). It shows the first
 * matches only, so the list stays short on a 3,000-dataset catalog. The USWDS combo box would render a `<select>` of
 * every option. Focus stays in the input; Down and Up move through the options, Enter picks, Escape closes or clears.
 */
function ObjectPicker({ id, label, fieldLabel, pool, catalog, onPick }: ObjectPickerProps) {
  const uses = usesOf(catalog)
  const [query, setQuery] = useState('')
  const [expanded, setExpanded] = useState(false)
  const [active, setActive] = useState(-1)
  const candidates = useMemo(() => (expanded ? pool() : undefined), [expanded, pool])
  const { items, total } = useMemo(() => (candidates ? search(candidates, query) : { items: [], total: 0 }), [candidates, query])
  const listId = `${id}-list`
  const statusId = `${id}-status`
  const optionId = (i: number) => `${id}-option-${i}`
  const showList = expanded && items.length > 0

  const close = () => {
    setExpanded(false)
    setActive(-1)
  }
  const pick = (object: CatalogObject) => {
    close()
    setQuery('')
    onPick(object)
  }

  // Opening with Up selects the last option, which is only known once the list is built.
  const current = Math.min(active, items.length - 1)

  // The active option scrolls into the list's view as the arrows move through it.
  useEffect(() => {
    if (current >= 0) document.getElementById(`${id}-option-${current}`)?.scrollIntoView({ block: 'nearest' })
  }, [id, current])

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    // Keys that compose text (an IME) are the input method's, not the list's.
    if (event.nativeEvent.isComposing) return
    const last = items.length - 1
    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowUp': {
        event.preventDefault()
        const down = event.key === 'ArrowDown'
        if (expanded && !down && event.altKey) close()
        else if (!expanded) {
          setExpanded(true)
          if (!event.altKey) setActive(down ? 0 : Number.MAX_SAFE_INTEGER)
        } else if (items.length > 0) {
          setActive(down ? (current >= last ? 0 : current + 1) : current <= 0 ? last : current - 1)
        }
        break
      }
      case 'Enter':
        if (showList && items[current]) {
          event.preventDefault()
          pick(items[current])
        }
        break
      case 'Escape':
        if (expanded) close()
        else setQuery('')
        break
      // Moving the caret returns focus from the options to the text, as the APG example does.
      case 'Home':
      case 'End':
      case 'ArrowLeft':
      case 'ArrowRight':
        setActive(-1)
        break
    }
  }
  return (
    <div>
      <Label htmlFor={id} className="margin-top-1">
        {label}
        <span className="usa-sr-only"> to {fieldLabel}</span>
      </Label>
      <div className="object-picker__box">
        <input
          id={id}
          className="usa-input"
          type="text"
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={showList && current >= 0 ? optionId(current) : undefined}
          aria-describedby={statusId}
          autoComplete="off"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value)
            setExpanded(true)
            setActive(-1)
          }}
          onClick={() => setExpanded(!expanded)}
          onKeyDown={onKeyDown}
          onBlur={close}
        />
        {/* The status sits under the options, so "Showing 25 of 3,000" is in view while they are. */}
        <div className="object-picker__popup">
          <ul
            id={listId}
            role="listbox"
            aria-label={`${label} to ${fieldLabel}`}
            className="object-picker__list"
            hidden={!showList}
            // Chrome makes a scrolling list a tab stop; Tab should leave the picker, not land in a list that closes.
            tabIndex={-1}
            // Pressing the list's scrollbar keeps focus in the input, so the list stays open.
            onMouseDown={(event) => event.preventDefault()}
          >
            {items.map((object, i) => {
              const objectUses = uses.get(object.id) ?? []
              const parent = objectUses.length === 1 ? catalog.objects.get(objectUses[0].parentId) : undefined
              return (
                <li
                  key={object.id}
                  id={optionId(i)}
                  role="option"
                  aria-selected={i === current}
                  className="object-picker__option"
                  // Picks on mousedown, before the input loses focus and closes the list.
                  onMouseDown={(event) => {
                    event.preventDefault()
                    pick(object)
                  }}
                >
                  <bdi className="text-bold">{labelOf(object)}</bdi>
                  <span className="display-block font-sans-3xs text-base-dark">
                    {/* Where it is used tells apart objects with the same name, such as a contact written out per dataset. */}
                    {classLabel(object.dcatClass)} ·{' '}
                    {parent ? (
                      <>
                        used in <bdi>{labelOf(parent)}</bdi>
                      </>
                    ) : objectUses.length > 0 ? (
                      `used in ${places(objectUses.length)}`
                    ) : (
                      'not linked anywhere'
                    )}
                  </span>
                </li>
              )
            })}
          </ul>
          <div id={statusId} className="object-picker__status" aria-live="polite">
            {expanded &&
              (total === 0
                ? 'No matches.'
                : total > items.length
                  ? `Showing ${items.length} of ${count(total)}. Keep typing to narrow down.`
                  : `${count(total)} ${total === 1 ? 'match' : 'matches'}.`)}
          </div>
        </div>
      </div>
    </div>
  )
}
