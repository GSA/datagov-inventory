import { describe, it, expect } from 'vitest'

describe('Validation Messages', () => {
  describe('formatFieldPath', () => {
    it('should format JSON pointer to readable path', async () => {
      const { formatFieldPath } = await import('./messages')

      expect(formatFieldPath('/dct:title')).toBe('Title')
      expect(formatFieldPath('/dct:description')).toBe('Description')
      expect(formatFieldPath('/dcat:distribution/0/dcat:accessURL')).toBe('Distribution 1 → Access URL')
    })

    it('should handle array indices', async () => {
      const { formatFieldPath } = await import('./messages')

      expect(formatFieldPath('/dcat:distribution/0')).toBe('Distribution 1')
      expect(formatFieldPath('/dcat:distribution/5/dcat:format')).toBe('Distribution 6 → Format')
    })

    it('should handle nested paths', async () => {
      const { formatFieldPath } = await import('./messages')

      expect(formatFieldPath('/dcat:contactPoint/vcard:hasEmail')).toBe('Contact Point → Email')
    })
  })

  describe('getFieldLabel', () => {
    it('should map DCAT property to readable label', async () => {
      const { getFieldLabel } = await import('./messages')

      expect(getFieldLabel('dct:title')).toBe('Title')
      expect(getFieldLabel('dct:description')).toBe('Description')
      expect(getFieldLabel('dcat:keyword')).toBe('Keywords')
      expect(getFieldLabel('dcat:theme')).toBe('Theme')
      expect(getFieldLabel('dct:spatial')).toBe('Spatial Coverage')
    })

    it('should label DCAT-US 3.0 property names, which have no prefix', async () => {
      const { getFieldLabel } = await import('./messages')

      expect(getFieldLabel('title')).toBe('Title')
      expect(getFieldLabel('contactPoint')).toBe('Contact Point')
      expect(getFieldLabel('downloadURL')).toBe('Download URL')
    })

    it('should handle unknown properties gracefully', async () => {
      const { getFieldLabel } = await import('./messages')

      expect(getFieldLabel('unknown:property')).toBe('Unknown Property')
    })
  })

  describe('humanizeError', () => {
    it('should humanize required field error', async () => {
      const { humanizeError } = await import('./messages')

      const error = {
        keyword: 'required',
        instancePath: '',
        schemaPath: '#/required',
        params: { missingProperty: 'dct:title' },
        message: "must have required property 'dct:title'"
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
        instancePath: '/dct:title',
        schemaPath: '#/properties/dct:title/type',
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
        instancePath: '/vcard:hasEmail',
        schemaPath: '#/properties/vcard:hasEmail/pattern',
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
