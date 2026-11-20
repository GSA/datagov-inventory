/**
 * Names as people read them: a class (`classLabel`) and a field (`fieldLabel`). The tree, the form, validation messages
 * and the model generator (scripts/generate-models.mjs, which writes each field's label with `fieldLabel`) share them,
 * so a field reads the same everywhere. No imports, so the generator and the validation worker can load it alone.
 */

/** Short words that stay lower case inside a class name: PeriodOfTime is "Period of Time". */
const MINOR_WORDS = new Set(['of', 'and', 'or', 'in', 'to'])

/** Display names for classes whose schema name means little to people: vCard's `Kind` is a contact. */
const CLASS_NAMES: Record<string, string> = { Kind: 'Contact' }

/** Words in a name: `CUIRestriction` is CUI, Restriction (a run of capitals stays one word); `family-name` is family, name. */
const words = (name: string) =>
  name.split(/[-_\s]+/).flatMap((part) => part.match(/[A-Z]+(?![a-z])|[A-Z]?[a-z0-9]+/g) ?? [])

const classLabels = new Map<string, string>()

/**
 * A DCAT class as people read it: `PeriodOfTime` is "Period of Time", `CUIRestriction` is "CUI Restriction", `Kind` is
 * "Contact". The schema's own name stays the object's class; this is for display only. Cached, since every tree row
 * asks.
 */
export function classLabel(dcatClass: string): string {
  let label = classLabels.get(dcatClass)
  if (label === undefined) {
    label =
      CLASS_NAMES[dcatClass] ??
      (words(dcatClass)
        .map((word, i) => (i > 0 && MINOR_WORDS.has(word.toLowerCase()) ? word.toLowerCase() : word))
        .join(' ') ||
        dcatClass)
    classLabels.set(dcatClass, label)
  }
  return label
}

/** Labels the property name can't give: vCard's terse names and abbreviations. */
const FIELD_NAMES: Record<string, string> = {
  fn: 'Full name',
  tel: 'Telephone',
  hasEmail: 'Email',
  bbox: 'Bounding box',
  altLabel: 'Alternative label',
  prefLabel: 'Preferred label',
}
/** Words written in capitals, whatever the property name's case. */
const ACRONYMS = new Set(['cui', 'url', 'iri', 'id'])

const fieldLabels = new Map<string, string>()

/**
 * A field's label, in sentence case as USWDS writes form labels: `contactPoint` is "Contact point", `accessURL` is
 * "Access URL", `legacyIdField` is "Legacy ID field", `fn` is "Full name". It depends on the property's name alone, so
 * a property reads the same in every class. JSON-LD keys (`@id`) stay as written. Cached, since every tree row asks.
 */
export function fieldLabel(property: string): string {
  let label = fieldLabels.get(property)
  if (label === undefined) {
    label = property.startsWith('@')
      ? property
      : (FIELD_NAMES[property] ??
        (words(property)
          .map((word, i) =>
            ACRONYMS.has(word.toLowerCase()) || /^[A-Z]{2,}$/.test(word)
              ? word.toUpperCase()
              : i === 0
                ? word[0].toUpperCase() + word.slice(1)
                : word.toLowerCase(),
          )
          .join(' ') ||
          property))
    fieldLabels.set(property, label)
  }
  return label
}

/**
 * A tree row's field and, when it says more, class: "Publisher · Organization", "Contact point · Contact", but just
 * "Dataset" for a dataset listed under Dataset.
 */
export function fieldAndClass(property: string, dcatClass: string): string {
  const field = fieldLabel(property)
  const type = classLabel(dcatClass)
  return field.toLowerCase() === type.toLowerCase() ? field : `${field} · ${type}`
}
