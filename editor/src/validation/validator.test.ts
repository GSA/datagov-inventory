// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

describe('Validator', () => {
  let validator: { validate: (data: unknown) => boolean; errors: null | unknown[] }

  beforeAll(async () => {
    const { createValidator } = await import('./validator')
    const schemaPath = join(process.cwd(), 'schema/dcat-us-document.schema.json')
    const schema = JSON.parse(readFileSync(schemaPath, 'utf-8'))
    validator = createValidator(schema)
  })

  describe('createValidator', () => {
    it('should create validator instance', () => {
      expect(validator).toBeDefined()
      expect(typeof validator.validate).toBe('function')
    })

    it('should compile schema without errors', () => {
      expect(validator.errors).toBeNull()
    })
  })

  describe('validateObject', () => {
    it('should validate valid Dataset object', async () => {
      const { validateObject } = await import('./validator')

      const validDataset = {
        '@type': 'dcat:Dataset',
        'dct:title': 'Test Dataset',
        'dct:description': 'A test dataset',
        'dcat:distribution': []
      }

      const result = validateObject(validator, validDataset, 'Dataset')

      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should invalidate Dataset missing required title', async () => {
      const { validateObject } = await import('./validator')

      const invalidDataset = {
        '@type': 'dcat:Dataset',
        'dct:description': 'A test dataset',
        'dcat:distribution': []
      }

      const result = validateObject(validator, invalidDataset, 'Dataset')

      expect(result.valid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
      expect(result.errors.some((e) => e.field.includes('title'))).toBe(true)
    })

    it('should invalidate Dataset with wrong type for title', async () => {
      const { validateObject } = await import('./validator')

      const invalidDataset = {
        '@type': 'dcat:Dataset',
        'dct:title': 123,
        'dct:description': 'A test dataset',
        'dcat:distribution': []
      }

      const result = validateObject(validator, invalidDataset, 'Dataset')

      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.field.includes('title') && e.type === 'type')).toBe(true)
    })

    it('should validate valid Organization object', async () => {
      const { validateObject } = await import('./validator')

      const validOrg = {
        '@type': 'org:Organization',
        'foaf:name': 'Test Organization'
      }

      const result = validateObject(validator, validOrg, 'Organization')

      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should validate valid ContactPoint object', async () => {
      const { validateObject } = await import('./validator')

      const validContact = {
        '@type': 'vcard:Contact',
        'vcard:fn': 'John Doe',
        'vcard:hasEmail': 'mailto:john@example.gov'
      }

      const result = validateObject(validator, validContact, 'ContactPoint')

      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })
  })

  describe('validateCatalog', () => {
    it('should validate catalog with all valid objects', async () => {
      const { validateCatalog } = await import('./validator')

      const catalog = {
        datasets: [
          {
            '@id': 'ds1',
            '@type': 'dcat:Dataset',
            'dct:title': 'Dataset 1',
            'dct:description': 'Description 1',
            'dcat:distribution': []
          }
        ],
        publishers: [
          {
            '@id': 'pub1',
            '@type': 'org:Organization',
            'foaf:name': 'Publisher 1'
          }
        ],
        contactPoints: [
          {
            '@id': 'cp1',
            '@type': 'vcard:Contact',
            'vcard:fn': 'Contact 1',
            'vcard:hasEmail': 'mailto:contact@example.gov'
          }
        ]
      }

      const result = validateCatalog(validator, catalog)

      expect(result.valid).toBe(true)
      expect(result.objectResults).toHaveLength(3)
      expect(result.objectResults.every((r) => r.valid)).toBe(true)
    })

    it('should detect invalid objects in catalog', async () => {
      const { validateCatalog } = await import('./validator')

      const catalog = {
        datasets: [
          {
            '@id': 'ds1',
            '@type': 'dcat:Dataset',
            'dct:description': 'Missing title',
            'dcat:distribution': []
          }
        ],
        publishers: [],
        contactPoints: []
      }

      const result = validateCatalog(validator, catalog)

      expect(result.valid).toBe(false)
      expect(result.objectResults).toHaveLength(1)
      expect(result.objectResults[0].valid).toBe(false)
      expect(result.errorSummary.Dataset).toBeGreaterThan(0)
    })

    it('should group errors by class', async () => {
      const { validateCatalog } = await import('./validator')

      const catalog = {
        datasets: [
          {
            '@id': 'ds1',
            '@type': 'dcat:Dataset',
            'dcat:distribution': []
          },
          {
            '@id': 'ds2',
            '@type': 'dcat:Dataset',
            'dcat:distribution': []
          }
        ],
        publishers: [
          {
            '@id': 'pub1',
            '@type': 'org:Organization'
          }
        ],
        contactPoints: []
      }

      const result = validateCatalog(validator, catalog)

      expect(result.valid).toBe(false)
      expect(result.errorSummary.Dataset).toBe(2)
      expect(result.errorSummary.Organization).toBe(1)
    })
  })
})
