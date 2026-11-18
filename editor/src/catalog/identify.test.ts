import { describe, expect, it } from 'vitest'
import { decompose } from './decompose'
import { identifyGraph } from './identify'

const ids = () => {
  let next = 0
  return () => `00000000-0000-4000-8000-${String(++next).padStart(12, '0')}`
}

describe('identifyGraph', () => {
  it('replaces every object id, root id, and link without changing metadata', () => {
    const source = decompose('{"@type":"Catalog","dataset":[{"@type":"Dataset","title":"Air"}]}')

    const identified = identifyGraph(source, ids())
    const root = identified.objects.get(identified.rootId)!
    const dataset = identified.objects.get(root.links.dataset[0])!

    expect(identified.rootId).toBe('00000000-0000-4000-8000-000000000001')
    expect(dataset.id).toBe('00000000-0000-4000-8000-000000000002')
    expect(dataset.properties.title).toBe('Air')
    expect(source.rootId).toBe('#')
  })

  it('refuses a missing linked object', () => {
    const source = decompose('{"@type":"Catalog"}')
    source.objects.get('#')!.links.dataset = ['#/missing']
    expect(() => identifyGraph(source, ids())).toThrow('Catalog object #/missing does not exist.')
  })
})
