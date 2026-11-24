import { describe, expect, it } from 'vitest'
import { CatalogStorageError } from './storage/CatalogRepository'
import { storageErrorGuidance } from './storageErrorGuidance'

describe('storageErrorGuidance', () => {
  it('tells the user what to do about an upgrade problem', () => {
    expect(storageErrorGuidance(new CatalogStorageError('blocked', 'Blocked.'))).toMatch(/another tab.*close or reload/is)
    expect(storageErrorGuidance(new CatalogStorageError('outdated', 'Outdated.'))).toMatch(/newer version.*export/is)
    expect(storageErrorGuidance(new CatalogStorageError('upgrade-failed', 'Failed.'))).toMatch(
      /could not be upgraded.*don't clear this site's data/s,
    )
  })

  it('has no guidance for other errors', () => {
    expect(storageErrorGuidance(new CatalogStorageError('quota', 'Browser storage is full.'))).toBeUndefined()
    expect(storageErrorGuidance(new Error('Something else'))).toBeUndefined()
  })
})
