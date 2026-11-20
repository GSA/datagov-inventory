import { describe, it, expect } from 'vitest'

describe('Validation Messages', () => {
  describe('formatFieldPath', () => {
    it('should format JSON pointer to readable path', async () => {
      const { formatFieldPath } = await import('./messages')

      expect(formatFieldPath('/title')).toBe('Title')
      expect(formatFieldPath('/description')).toBe('Description')
      expect(formatFieldPath('/distribution/0/accessURL')).toBe('Distribution 1 → Access URL')
    })

    it('should handle array indices', async () => {
      const { formatFieldPath } = await import('./messages')

      expect(formatFieldPath('/distribution/0')).toBe('Distribution 1')
      expect(formatFieldPath('/distribution/5/format')).toBe('Distribution 6 → Format')
    })

    it('should handle nested paths', async () => {
      const { formatFieldPath } = await import('./messages')

      expect(formatFieldPath('/contactPoint/hasEmail')).toBe('Contact point → Email')
    })
  })

  describe('getFieldLabel', () => {
    it('should label a property as its field in the form does', async () => {
      const { getFieldLabel } = await import('./messages')

      expect(getFieldLabel('title')).toBe('Title')
      expect(getFieldLabel('description')).toBe('Description')
      expect(getFieldLabel('keyword')).toBe('Keyword')
      expect(getFieldLabel('fn')).toBe('Full name')
      expect(getFieldLabel('spatialResolutionInMeters')).toBe('Spatial resolution in meters')
    })

    it('should label DCAT-US 3.0 property names, which have no prefix', async () => {
      const { getFieldLabel } = await import('./messages')

      expect(getFieldLabel('title')).toBe('Title')
      expect(getFieldLabel('contactPoint')).toBe('Contact point')
      expect(getFieldLabel('downloadURL')).toBe('Download URL')
    })

    it('should handle unknown properties gracefully', async () => {
      const { getFieldLabel } = await import('./messages')

      expect(getFieldLabel('someUnknownProperty')).toBe('Some unknown property')
      expect(getFieldLabel('legacyURLField')).toBe('Legacy URL field')
    })
  })

  describe('humanizeError', () => {
    it('should humanize required field error', async () => {
      const { humanizeError } = await import('./messages')

      const error = {
        keyword: 'required',
        instancePath: '',
        schemaPath: '#/required',
        params: { missingProperty: 'title' },
        message: "must have required property 'title'"
      }

      const humanized = humanizeError(error)

      expect(humanized.field).toBe('Title')
      expect(humanized.message).toContain('required')
      expect(humanized.severity).toBe('error')
    })

    it('should humanize type error', async () => {
      const { humanizeError } = await import('./messages')

      const error = {
        keyword: 'type',
        instancePath: '/title',
        schemaPath: '#/properties/title/type',
        params: { type: 'string' },
        message: 'must be string'
      }

      const humanized = humanizeError(error)

      expect(humanized.field).toBe('Title')
      expect(humanized.message).toContain('must be text')
      expect(humanized.type).toBe('type')
    })

    it('should humanize pattern error', async () => {
      const { humanizeError } = await import('./messages')

      const error = {
        keyword: 'pattern',
        instancePath: '/hasEmail',
        schemaPath: '#/properties/hasEmail/pattern',
        params: { pattern: '^mailto:' },
        message: 'must match pattern "^mailto:"'
      }

      const humanized = humanizeError(error)

      expect(humanized.field).toBe('Email')
      expect(humanized.message).toContain('format')
    })

    it('should leave messages as plain text for React to escape', async () => {
      const { humanizeError } = await import('./messages')

      const error = {
        keyword: 'const',
        instancePath: '/title',
        schemaPath: '#/properties/title/const',
        params: { allowedValue: 'Fish & Chips' },
        message: 'must be equal to constant'
      }

      expect(humanizeError(error).message).toBe('must be equal to constant: Fish & Chips')
    })
  })
})
