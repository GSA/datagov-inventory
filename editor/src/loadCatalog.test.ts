import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BATCH_SIZE, parse } from './catalog/parse'
import { loadCatalog } from './loadCatalog'

/** Runs the worker's `parse` a task later, cloning messages both ways as a real worker does. */
class FakeWorker {
  static created: FakeWorker[] = []
  static fail = false
  onmessage?: (event: { data: unknown }) => void
  onerror?: () => void
  terminated = false
  constructor() {
    FakeWorker.created.push(this)
  }
  postMessage(input: string | ArrayBuffer, transfer: Transferable[]) {
    const data = structuredClone(input, { transfer })
    if (FakeWorker.fail) setTimeout(() => this.onerror?.())
    else
      for (const message of parse(data))
        setTimeout(() => this.terminated || this.onmessage?.({ data: structuredClone(message) }))
  }
  terminate() {
    this.terminated = true
  }
}

beforeEach(() => {
  FakeWorker.created = []
  FakeWorker.fail = false
  vi.stubGlobal('Worker', FakeWorker)
})
afterEach(() => vi.unstubAllGlobals())

const load = (source: File | string) => loadCatalog(source, new AbortController().signal)
const file = (content: BlobPart, name = 'catalog.json') => new File([content], name, { type: 'application/json' })

describe('loadCatalog', () => {
  it('decomposes text in a worker, then stops the worker', async () => {
    const catalog = await load('{"@type": "Catalog", "dataset": [{"title": "A"}]}')
    expect([...catalog.objects.values()].map((o) => [o.id, o.dcatClass])).toEqual([
      ['#', 'Catalog'],
      ['#/dataset/0', 'Dataset'],
    ])
    expect(FakeWorker.created).toHaveLength(1)
    expect(FakeWorker.created[0].terminated).toBe(true)
  })

  it('takes a big catalog in batches, in document order', async () => {
    const datasets = Array.from({ length: 2 * BATCH_SIZE }, (_, i) => ({ title: `D${i}` }))
    const text = JSON.stringify({ '@type': 'Catalog', dataset: datasets })
    expect(parse(text).map((message) => ('objects' in message ? message.objects.length : message))).toEqual([
      BATCH_SIZE,
      BATCH_SIZE,
      1,
      { rootId: '#' },
    ])
    const catalog = await load(text)
    expect(catalog.rootId).toBe('#')
    expect([...catalog.objects.keys()]).toEqual(['#', ...datasets.map((_, i) => `#/dataset/${i}`)])
    expect(Object.getPrototypeOf(catalog.objects.get(`#/dataset/${2 * BATCH_SIZE - 1}`)!.properties)).toBeNull()
  })

  it('loads a blank catalog as one empty Catalog', async () => {
    const catalog = await load('{"@type": "Catalog"}')
    expect([...catalog.objects.values()]).toEqual([
      { id: '#', dcatClass: 'Catalog', properties: { '@type': 'Catalog' }, links: {}, singleLinks: [] },
    ])
  })

  it('restores the null prototypes that posting a message drops', async () => {
    const catalog = await load('{"@type": "Catalog", "__proto__": {"polluted": 1}, "dataset": [{"title": "A"}]}')
    const root = catalog.objects.get('#')!
    expect(Object.getPrototypeOf(root.properties)).toBeNull()
    expect(Object.getPrototypeOf(root.links)).toBeNull()
    expect(Object.keys(root.properties)).toEqual(['@type', '__proto__'])
    expect(({} as Record<string, unknown>).polluted).toBeUndefined()
  })

  it('reads a file as strict UTF-8', async () => {
    const catalog = await load(file('﻿{"@type": "Catalog", "title": "Café"}'))
    expect(catalog.objects.get('#')!.properties.title).toBe('Café')
    await expect(load(file(new Uint8Array([0x7b, 0xe9, 0x7d])))).rejects.toThrow(
      'This file is not UTF-8 text. Save it as UTF-8 JSON and try again.',
    )
  })

  it('refuses an oversize file before reading it or starting a worker', async () => {
    const read = vi.spyOn(FileReader.prototype, 'readAsArrayBuffer')
    const huge = file('{}')
    Object.defineProperty(huge, 'size', { value: 25_000_001 })
    await expect(load(huge)).rejects.toThrow('over the size limit of 25 MB (it is 25,000,001 bytes)')
    expect(read).not.toHaveBeenCalled()
    expect(FakeWorker.created).toHaveLength(0)
    read.mockRestore()
  })

  it.each([
    ['invalid JSON', '{"@type": "Catalog",', 'This is not valid JSON'],
    ['an empty object', '{}', 'No DCAT-US 3.0 class found'],
    ['no DCAT class', '{"foo": 1}', 'No DCAT-US 3.0 class found'],
    ['an empty document', ' ', 'This document is empty.'],
  ])('refuses %s with the reason', async (_, text, message) => {
    await expect(load(text)).rejects.toThrow(message)
  })

  it('loads a catalog with schema errors', async () => {
    const catalog = await load('{"@type": "Catalog", "dataset": [{"@type": "Dataset", "issued": "yesterday"}]}')
    expect(catalog.objects.get('#/dataset/0')!.properties.issued).toBe('yesterday')
  })

  it('stops the worker when aborted, rejecting with the abort reason', async () => {
    const controller = new AbortController()
    const loading = loadCatalog('{"@type": "Catalog"}', controller.signal)
    controller.abort()
    await expect(loading).rejects.toThrow(expect.objectContaining({ name: 'AbortError' }))
    expect(FakeWorker.created[0].terminated).toBe(true)
  })

  it('stops reading a file when aborted, before any worker starts', async () => {
    const controller = new AbortController()
    const loading = loadCatalog(file('{"@type": "Catalog"}'), controller.signal)
    controller.abort()
    await expect(loading).rejects.toThrow(expect.objectContaining({ name: 'AbortError' }))
    expect(FakeWorker.created).toHaveLength(0)
  })

  it('reports a worker that fails to run', async () => {
    FakeWorker.fail = true
    await expect(load('{"@type": "Catalog"}')).rejects.toThrow('The editor could not start reading this catalog.')
    expect(FakeWorker.created[0].terminated).toBe(true)
  })
})
