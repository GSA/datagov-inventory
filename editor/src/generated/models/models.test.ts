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

  it('gives every field that holds a class the object type', () => {
    for (const { fields } of modelsByClass.values()) {
      for (const field of fields.filter((f) => f.allowedClasses)) expect(field.type, field.name).toBe('object')
    }
  })
})
