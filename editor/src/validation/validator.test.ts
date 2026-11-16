// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { createValidator, validateObject, validateCatalog } from './validator'

const mockSchema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    '@type': { type: 'string' },
    'dct:title': { type: 'string' },
    'dct:description': { type: 'string' },
    'dcat:distribution': { type: 'array' },
    'foaf:name': { type: 'string' },
    'vcard:fn': { type: 'string' },
    'vcard:hasEmail': { type: 'string', pattern: '^mailto:' },
  },
  required: ['dct:title'],
}

describe('Validator', () => {
  describe('createValidator', () => {
    it('should create validator instance', () => {
      const validator = createValidator(mockSchema)

      expect(validator).toBeDefined()
      expect(typeof validator.validate).toBe('function')
    })

    it('should compile schema without errors', () => {
      const validator = createValidator(mockSchema)

      expect(validator.errors).toBeNull()
    })
  })

  describe('validateObject', () => {
    it('should validate valid Dataset object', () => {
      const validator = createValidator(mockSchema)

      const validDataset = {
        '@type': 'dcat:Dataset',
        'dct:title': 'Test Dataset',
        'dct:description': 'A test dataset',
        'dcat:distribution': [],
      }

      const result = validateObject(validator, validDataset, 'Dataset')

      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should invalidate Dataset missing required title', () => {
      const validator = createValidator(mockSchema)

      const invalidDataset = {
        '@type': 'dcat:Dataset',
        'dct:description': 'A test dataset',
        'dcat:distribution': [],
      }

      const result = validateObject(validator, invalidDataset, 'Dataset')

      expect(result.valid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
      expect(result.errors.some((e) => e.field.includes('Title'))).toBe(true)
    })

    it('should invalidate Dataset with wrong type for title', () => {
      const validator = createValidator(mockSchema)

      const invalidDataset = {
        '@type': 'dcat:Dataset',
        'dct:title': 123,
        'dct:description': 'A test dataset',
        'dcat:distribution': [],
      }

      const result = validateObject(validator, invalidDataset, 'Dataset')

      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.field.includes('Title') && e.type === 'type')).toBe(true)
    })

    it('should validate valid Organization object', () => {
      const validator = createValidator(mockSchema)

      const validOrg = {
        '@type': 'org:Organization',
        'dct:title': 'Required title',
        'foaf:name': 'Test Organization',
      }

      const result = validateObject(validator, validOrg, 'Organization')

      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should validate valid ContactPoint object', () => {
      const validator = createValidator(mockSchema)

      const validContact = {
        '@type': 'vcard:Contact',
        'dct:title': 'Required title',
        'vcard:fn': 'John Doe',
        'vcard:hasEmail': 'mailto:john@example.gov',
      }

      const result = validateObject(validator, validContact, 'ContactPoint')

      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })
  })

  describe('validateCatalog', () => {
    it('should validate catalog with all valid objects', () => {
      const validator = createValidator(mockSchema)

      const catalog = {
        datasets: [
          {
            '@id': 'ds1',
            '@type': 'dcat:Dataset',
            'dct:title': 'Dataset 1',
            'dct:description': 'Description 1',
            'dcat:distribution': [],
          },
        ],
        publishers: [
          {
            '@id': 'pub1',
            '@type': 'org:Organization',
            'dct:title': 'Required title',
            'foaf:name': 'Publisher 1',
          },
        ],
        contactPoints: [
          {
            '@id': 'cp1',
            '@type': 'vcard:Contact',
            'dct:title': 'Required title',
            'vcard:fn': 'Contact 1',
            'vcard:hasEmail': 'mailto:contact@example.gov',
          },
        ],
      }

      const result = validateCatalog(validator, catalog)

      expect(result.valid).toBe(true)
      expect(result.objectResults).toHaveLength(3)
      expect(result.objectResults.every((r) => r.valid)).toBe(true)
    })

    it('should detect invalid objects in catalog', () => {
      const validator = createValidator(mockSchema)

      const catalog = {
        datasets: [
          {
            '@id': 'ds1',
            '@type': 'dcat:Dataset',
            'dct:description': 'Missing title',
            'dcat:distribution': [],
          },
        ],
        publishers: [],
        contactPoints: [],
      }

      const result = validateCatalog(validator, catalog)

      expect(result.valid).toBe(false)
      expect(result.objectResults).toHaveLength(1)
      expect(result.objectResults[0].valid).toBe(false)
      expect(result.errorSummary.Dataset).toBeGreaterThan(0)
    })

    it('should group errors by class', () => {
      const validator = createValidator(mockSchema)

      const catalog = {
        datasets: [
          {
            '@id': 'ds1',
            '@type': 'dcat:Dataset',
            'dcat:distribution': [],
          },
          {
            '@id': 'ds2',
            '@type': 'dcat:Dataset',
            'dcat:distribution': [],
          },
        ],
        publishers: [
          {
            '@id': 'pub1',
            '@type': 'org:Organization',
          },
        ],
        contactPoints: [],
      }

      const result = validateCatalog(validator, catalog)

      expect(result.valid).toBe(false)
      expect(result.errorSummary.Dataset).toBe(2)
      expect(result.errorSummary.Organization).toBe(1)
    })
  })
})
