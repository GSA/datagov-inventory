import { describe, expect, it } from 'vitest'
import { CatalogStorageError } from './storage/CatalogRepository'
import { storageErrorHelp } from './storageErrorHelp'

describe('storageErrorHelp', () => {
  it('tells the user what to do about an upgrade problem', () => {
    expect(storageErrorHelp(new CatalogStorageError('blocked', 'Blocked.'))).toEqual({
      heading: 'Close other Inventory editor tabs',
      guidance: expect.stringMatching(/another tab.*close or reload/is),
    })
    expect(storageErrorHelp(new CatalogStorageError('outdated', 'Outdated.'))).toEqual({
      heading: 'Reload to use the newer editor',
      guidance: expect.stringMatching(/newer version.*export/is),
    })
    expect(storageErrorHelp(new CatalogStorageError('upgrade-failed', 'Failed.'))).toEqual({
      heading: "Keep this site's data while the upgrade is fixed",
      guidance: expect.stringMatching(/could not be upgraded.*don't clear this site's data/s),
    })
  })

  it('has no help for other errors', () => {
    expect(storageErrorHelp(new CatalogStorageError('quota', 'Browser storage is full.'))).toBeUndefined()
    expect(storageErrorHelp(new Error('Something else'))).toBeUndefined()
  })
})
