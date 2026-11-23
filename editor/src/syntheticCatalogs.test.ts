import { afterEach, describe, expect, it } from 'vitest'
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { largeCatalog } from '../fixtures/largeCatalog'
import { CATALOG_SIZES, catalogFileName, writeCatalogs } from '../fixtures/syntheticCatalogs'
import { decompose } from './catalog/decompose'
import { validateDocument } from './generated/validateDocument'

describe('largeCatalog', () => {
  it('makes each dataset with a contact, a publisher and three distributions', () => {
    const catalog = largeCatalog(300)
    expect(catalog.dataset).toHaveLength(300)
    expect(decompose(JSON.stringify(catalog)).objects.size).toBe(1 + 300 * 6)
  })

  it('makes the same catalog every time', () => {
    expect(JSON.stringify(largeCatalog(300))).toBe(JSON.stringify(largeCatalog(300)))
  })

  it('makes a valid DCAT-US 3.0 catalog', () => {
    expect(validateDocument(largeCatalog(300)), JSON.stringify(validateDocument.errors)).toBe(true)
  })
})

describe('writeCatalogs', () => {
  let dir: string
  const tempDir = () => (dir = mkdtempSync(join(tmpdir(), 'catalogs-')))
  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true })
  })

  it('covers 300 to 6,000 datasets', () => {
    expect(CATALOG_SIZES).toEqual([300, 1_000, 3_000, 6_000])
  })

  it('names each file by its dataset count', () => {
    expect(catalogFileName(3_000)).toBe('catalog-3000-datasets.json')
  })

  it('writes one catalog file per size, and reports its path and size', () => {
    const written = writeCatalogs(tempDir(), [3, 10])
    expect(written.map((w) => w.datasets)).toEqual([3, 10])
    for (const { datasets, path, bytes } of written) {
      expect(path).toBe(join(dir, catalogFileName(datasets)))
      expect(statSync(path).size).toBe(bytes)
      expect(JSON.parse(readFileSync(path, 'utf8')).dataset).toHaveLength(datasets)
    }
  })

  it('creates the directory if it is missing', () => {
    const nested = join(tempDir(), 'a', 'b')
    writeCatalogs(nested, [1])
    expect(existsSync(join(nested, catalogFileName(1)))).toBe(true)
  })
})
