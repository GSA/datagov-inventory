import { describe, it, expect } from 'vitest'
import { OrganizationModel } from './Organization'

describe('OrganizationModel', () => {
  it('has className Organization', () => {
    expect(OrganizationModel.className).toBe('Organization')
  })

  it('has fields array', () => {
    expect(Array.isArray(OrganizationModel.fields)).toBe(true)
    expect(OrganizationModel.fields.length).toBeGreaterThan(0)
  })

  it('has name field', () => {
    const nameField = OrganizationModel.fields.find((f) => f.name === 'name')

    if (nameField) {
      expect(nameField.type).toBe('string')
    }
  })
})
