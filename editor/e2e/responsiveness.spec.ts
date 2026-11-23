/**
 * Measures the editor on generated catalogs of 300 to 6,000 datasets (#29): time to first view, JS heap, and how long
 * scrolling, filtering, selecting, editing, validating and exporting take. Opt-in, since timings vary by machine:
 *
 *   PERF=1 npx playwright test responsiveness   # CPU_THROTTLE=4 for a slower laptop, PERF_CHANNEL=msedge for Edge
 *
 * The @budget test fails if the 3,000-dataset catalog misses any of BUDGETS (run it with CPU_THROTTLE=4):
 *
 *   PERF=1 CPU_THROTTLE=4 npx playwright test responsiveness --grep @budget
 */
import { test, expect } from './fixtures'
import { BUDGETS } from './budgets'
import { CATALOG_SIZES } from '../fixtures/syntheticCatalogs'
import { formatMeasurements, measureCatalog, type Measurements } from './responsiveness'

test.skip(!process.env.PERF, 'set PERF=1 to measure')
test.use({ channel: process.env.PERF_CHANNEL })
test.setTimeout(600_000)

for (const datasets of CATALOG_SIZES) {
  test(`responsiveness with ${datasets.toLocaleString('en-US')} datasets`, async ({ page }) => {
    console.log(formatMeasurements(datasets, await measureCatalog(page, datasets)))
  })
}

test('3,000 datasets stay within budget', { tag: '@budget' }, async ({ page }) => {
  const measured = await measureCatalog(page, 3_000)
  console.log(formatMeasurements(3_000, measured))
  for (const [name, budget] of Object.entries(BUDGETS) as [keyof Measurements, number][]) {
    expect.soft(measured[name], `${name}: ${Math.round(measured[name])} (budget ${budget})`).toBeLessThanOrEqual(budget)
  }
})
