import { describe, it, expect } from 'vitest'
import { classSchemas, getClassProperties } from '../../schema'
import * as models from './index'

const modelsByClass = new Map(Object.values(models).map((model) => [model.className, model]))

describe('generated form models', () => {
  it('has a model for every DCAT-US 3.0 class', () => {
    expect([...modelsByClass.keys()].sort()).toEqual([...classSchemas.keys()].sort())
  })

  it.each([...classSchemas.keys()])('%s has the properties and classes getClassProperties finds', (name) => {
    const fields = modelsByClass.get(name)?.fields ?? []

    expect(fields.map((f) => [f.name, f.allowedClasses ?? []])).toEqual([...getClassProperties(name)])
  })

  it('gives Concept the fields of its object form, where prefLabel is required', () => {
    const prefLabel = models.ConceptModel.fields.find((f) => f.name === 'prefLabel')

    expect(prefLabel?.type).toBe('string')
    expect(prefLabel?.required).toBe(true)
  })

  it('keeps a string-or-object value (Location.bbox) as a single object', () => {
    const bbox = models.LocationModel.fields.find((f) => f.name === 'bbox')

    expect(bbox?.type).toBe('object')
    expect(bbox?.cardinality).toBe('single')
    expect(bbox?.allowedClasses).toBeUndefined()
  })

  it('gives every field that holds a class the object type', () => {
    for (const { fields } of modelsByClass.values()) {
      for (const field of fields.filter((f) => f.allowedClasses)) expect(field.type, field.name).toBe('object')
    }
  })
})
