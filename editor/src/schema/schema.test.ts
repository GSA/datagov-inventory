import { describe, expect, it } from 'vitest'
import { classNames, getClassSchema, isClassName, rootSchema, schemaPin } from '.'
import { validateClass, validateDocument } from './validator'

describe('schema pin', () => {
  it('records the upstream commit, date and licence', () => {
    expect(schemaPin.repository).toBe('https://github.com/GSA/dcat-us')
    expect(schemaPin.commit).toMatch(/^[0-9a-f]{40}$/)
    expect(Number.isNaN(Date.parse(schemaPin.date))).toBe(false)
    expect(schemaPin.licence).toBe('CC0-1.0')
  })
})

describe('class lookup', () => {
  it('finds every DCAT-US 3.0 class in the pinned definitions', () => {
    expect(classNames).toContain('Catalog')
    expect(classNames).toContain('Dataset')
    expect(classNames).toContain('Distribution')
    expect(classNames.length).toBeGreaterThanOrEqual(26)
  })

  it('returns the schema for a class by name', () => {
    const dataset = getClassSchema('Dataset')
    expect(dataset.$id).toBe('https://resources.data.gov/dcat-us/3.0.0/definitions/dataset')
    expect(dataset.required).toEqual(
      expect.arrayContaining(['title', 'description', 'contactPoint', 'identifier']),
    )
  })

  it('maps every class name to a 2020-12 schema whose $id matches the name', () => {
    for (const name of classNames) {
      const schema = getClassSchema(name)
      expect(schema.$schema).toBe('https://json-schema.org/draft/2020-12/schema')
      expect(schema.$id).toBe(`https://resources.data.gov/dcat-us/3.0.0/definitions/${name.toLowerCase()}`)
    }
  })

  it('rejects names that are not classes', () => {
    expect(isClassName('Dataset')).toBe(true)
    expect(isClassName('dataset')).toBe(false)
    expect(isClassName('toString')).toBe(false)
    expect(() => getClassSchema('Datasets')).toThrow(/Unknown DCAT-US 3.0 class "Datasets"/)
  })

  it('gives schemas that validate objects of that class', () => {
    expect(validateClass('Kind', { fn: 'Data Team', hasEmail: 'mailto:data@example.gov' }).valid).toBe(true)
    expect(validateClass('Kind', { fn: 'Data Team' }).valid).toBe(false)
  })
})

describe('root schema', () => {
  it('is a 2020-12 schema that starts a whole document at the Catalog class', () => {
    expect(rootSchema.$schema).toBe('https://json-schema.org/draft/2020-12/schema')
    expect(rootSchema.$ref).toBe(getClassSchema('Catalog').$id)
  })

  it('resolves references across every class definition', () => {
    const { valid, errors } = validateDocument({
      dataset: [
        {
          title: 'T',
          description: 'D',
          contactPoint: { fn: 'F', hasEmail: 'mailto:a@example.gov' },
          identifier: 'id',
          distribution: [{ checksum: { algorithm: 'sha256' } }],
        },
      ],
    })
    expect(valid).toBe(false)
    expect(errors).toContainEqual(
      expect.objectContaining({
        instancePath: '/dataset/0/distribution/0/checksum',
        keyword: 'required',
        params: { missingProperty: 'checksumValue' },
      }),
    )
  })

  it('rejects a document that is not an object', () => {
    expect(validateDocument([]).valid).toBe(false)
  })
})
