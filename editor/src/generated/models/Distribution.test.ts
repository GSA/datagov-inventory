import { describe, it, expect } from 'vitest'
import { DistributionModel } from './Distribution'

describe('DistributionModel', () => {
  it('has className Distribution', () => {
    expect(DistributionModel.className).toBe('Distribution')
  })

  it('has fields array', () => {
    expect(Array.isArray(DistributionModel.fields)).toBe(true)
    expect(DistributionModel.fields.length).toBeGreaterThan(0)
  })

  it('has accessURL or downloadURL field', () => {
    const hasAccessURL = DistributionModel.fields.some(
      (f) => f.name === 'accessURL',
    )
    const hasDownloadURL = DistributionModel.fields.some(
      (f) => f.name === 'downloadURL',
    )

    expect(hasAccessURL || hasDownloadURL).toBe(true)
  })
})
