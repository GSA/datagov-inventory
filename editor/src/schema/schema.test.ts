import { describe, expect, it } from 'vitest'
import { classSchemas, getClassProperties, getClassSchema, rootSchema } from '.'

describe('getClassSchema', () => {
  it('returns the upstream schema for a class by name', () => {
    expect(getClassSchema('Dataset').required).toEqual(
      expect.arrayContaining(['title', 'description', 'contactPoint', 'identifier']),
    )
  })

  it('covers every class, each a 2020-12 schema whose $id matches its name', () => {
    expect(classSchemas.size).toBeGreaterThanOrEqual(26)
    for (const [name, schema] of classSchemas) {
      expect(schema.$schema).toBe('https://json-schema.org/draft/2020-12/schema')
      expect(schema.$id).toBe(`https://resources.data.gov/dcat-us/3.0.0/definitions/${name.toLowerCase()}`)
    }
  })

  it('throws for a name that is not a class', () => {
    expect(() => getClassSchema('toString')).toThrow('Unknown DCAT-US 3.0 class "toString"')
  })
})

describe('rootSchema', () => {
  it('is a 2020-12 schema that starts a document at the Catalog class', () => {
    expect(rootSchema.$schema).toBe('https://json-schema.org/draft/2020-12/schema')
    expect(rootSchema.$ref).toBe(getClassSchema('Catalog').$id)
  })
})

describe('getClassProperties', () => {
  it.each([
    ['Dataset', 'title', []],
    ['Dataset', 'distribution', ['Distribution']], // array items
    ['Dataset', 'contactPoint', ['Kind']], // one Kind or a list of them (anyOf)
    ['Dataset', 'spatial', ['Location']], // null, one Location or a list (nested anyOf)
    ['Dataset', 'theme', ['Concept']],
    ['Catalog', 'catalog', ['Catalog']], // "$ref": "#"
    ['Catalog', 'publisher', ['Agent']],
    ['Concept', 'inScheme', ['ConceptScheme']], // the object form of a string-or-object class
    ['Location', 'bbox', []], // an inline object schema is not a class
  ])('%s.%s holds %j', (className, property, classes) => {
    expect(getClassProperties(className).get(property)).toEqual(classes)
  })

  it('resolves every class it links to, for every class', () => {
    for (const name of classSchemas.keys()) {
      for (const classes of getClassProperties(name).values()) {
        for (const target of classes) expect(classSchemas.has(target)).toBe(true)
      }
    }
  })

  it('lists properties the schema defines and no others', () => {
    const dataset = getClassProperties('Dataset')
    expect(dataset.has('@type')).toBe(true)
    expect(dataset.has('constructor')).toBe(false)
    expect(dataset.size).toBe(Object.keys(getClassSchema('Dataset').properties as object).length)
  })

  it('throws for a name that is not a class', () => {
    expect(() => getClassProperties('__proto__')).toThrow('Unknown DCAT-US 3.0 class "__proto__"')
  })
})
