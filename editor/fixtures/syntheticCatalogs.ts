import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { largeCatalog } from './largeCatalog.ts'

/** The catalog sizes measured for #29: from a small agency to twice v1's largest. */
export const CATALOG_SIZES = [300, 1_000, 3_000, 6_000]

export const catalogFileName = (datasets: number) => `catalog-${datasets}-datasets.json`

/** Writes one generated catalog per size into `dir`, creating it if needed. */
export function writeCatalogs(dir: string, sizes = CATALOG_SIZES) {
  mkdirSync(dir, { recursive: true })
  return sizes.map((datasets) => {
    const path = join(dir, catalogFileName(datasets))
    const text = JSON.stringify(largeCatalog(datasets))
    writeFileSync(path, text)
    return { datasets, path, bytes: Buffer.byteLength(text) }
  })
}
