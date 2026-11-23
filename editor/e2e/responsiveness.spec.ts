/**
 * Measures the editor on generated catalogs of 300 to 6,000 datasets (#29): time to first view, JS heap, and how long
 * scrolling, filtering, selecting, editing, validating and exporting take. Opt-in, since timings vary by machine:
 *
 *   PERF=1 npx playwright test responsiveness   # CPU_THROTTLE=4 for a slower laptop, PERF_CHANNEL=msedge for Edge
 */
import { test } from './fixtures'
import { CATALOG_SIZES } from '../fixtures/syntheticCatalogs'
import { formatMeasurements, measureCatalog } from './responsiveness'

test.skip(!process.env.PERF, 'set PERF=1 to measure')
test.use({ channel: process.env.PERF_CHANNEL })
test.setTimeout(600_000)

for (const datasets of CATALOG_SIZES) {
  test(`responsiveness with ${datasets.toLocaleString('en-US')} datasets`, async ({ page }) => {
    console.log(formatMeasurements(datasets, await measureCatalog(page, datasets)))
  })
}
