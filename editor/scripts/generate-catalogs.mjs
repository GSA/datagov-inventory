#!/usr/bin/env node
// Writes generated DCAT-US 3.0 catalogs (fixtures/largeCatalog.ts) to files, to import by hand when checking the
// editor's speed in a browser (#29). The Playwright perf specs generate the same catalogs in memory.
//
//   npm run generate:catalogs                          # 300, 1,000, 3,000 and 6,000 datasets into generated-catalogs/
//   npm run generate:catalogs -- --out <dir> 500 10000 # other sizes, or another folder
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { parseArgs } from 'node:util'
// Node 24 strips the types of a .ts file on import.
import { largeCatalog } from '../fixtures/largeCatalog.ts'

const { values, positionals } = parseArgs({ options: { out: { type: 'string', default: 'generated-catalogs' } }, allowPositionals: true })
const sizes = positionals.length ? positionals.map(Number) : [300, 1_000, 3_000, 6_000]
if (sizes.some((n) => !Number.isInteger(n) || n < 1)) {
  console.error('Each size is a whole number of datasets, such as 3000.')
  process.exit(1)
}

const out = resolve(values.out)
mkdirSync(out, { recursive: true })
for (const datasets of sizes) {
  const file = resolve(out, `catalog-${datasets}-datasets.json`)
  const json = JSON.stringify(largeCatalog(datasets))
  writeFileSync(file, json)
  console.log(`${file} (${(Buffer.byteLength(json) / 2 ** 20).toFixed(1)} MB)`)
}
