import { describe, expect, it } from 'vitest'
import type { CatalogObject } from './catalog/types'
import { objectIdFromPath, objectPath } from './objectRoute'

const object = (title: string): CatalogObject => ({
  id: '6f2343ef-75d4-43a7-87b1-43fa92ce0aa2',
  dcatClass: 'Dataset',
  properties: { title },
  links: {},
  singleLinks: [],
})

describe('object routes', () => {
  it('combines readable class and title slugs with reversible UUID identity', () => {
    const path = objectPath(object('Air Quality Measurements'))
    expect(path).toBe('dataset/air-quality-measurements--byND73XUQ6eHsUP6ks4Kog')
    expect(objectIdFromPath(path)).toBe(object('ignored').id)
  })

  it('resolves identity even when the descriptive slug is stale', () => {
    expect(objectIdFromPath('dataset/old-title--byND73XUQ6eHsUP6ks4Kog')).toBe(object('ignored').id)
  })

  it('rejects malformed or truncated identity tokens', () => {
    expect(objectIdFromPath('dataset/air-quality--not-a-token')).toBeUndefined()
    expect(objectIdFromPath('dataset/air-quality--byND73XUQ6eHsUP6ks4Ko')).toBeUndefined()
  })

  it('gives duplicate labels distinct routes', () => {
    const other = { ...object('Air Quality'), id: '19fa249a-84de-4fdb-89eb-c841aa9574af' }
    expect(objectPath(object('Air Quality'))).not.toBe(objectPath(other))
  })
})
