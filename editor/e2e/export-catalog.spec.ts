import type { Page } from '@playwright/test'
import { test, expect } from './fixtures'
import { readFile, stat } from 'node:fs/promises'

test.beforeEach(async ({ page }) => {
  await page.goto('/import')
})

async function loadSample(page: Page, name: string) {
  await page.getByLabel('Sample catalog').selectOption(name)
  await page.getByRole('button', { name: 'Load sample' }).click()
  // Wait for navigation to editor page
  await page.waitForURL(/\/editor/)
}

test('exports loaded catalog with sanitized filename', async ({ page }) => {
  await loadSample(page, 'minimal-catalog.json')

  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export catalog' }).click()
  const download = await downloadPromise

  const filename = download.suggestedFilename()
  expect(filename).toMatch(/^minimal-catalog-\d{4}-\d{2}-\d{2}\.json$/)

  const path = await download.path()
  if (!path) throw new Error('Download path not available')
  const text = await readFile(path, 'utf-8')
  const exported = JSON.parse(text)

  expect(exported['@type']).toBe('Catalog')
  expect(exported.dataset).toBeDefined()
  expect(Array.isArray(exported.dataset)).toBe(true)
})

test('exported file round-trips identically', async ({ page }) => {
  await loadSample(page, 'dataset-with-distributions.json')

  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export catalog' }).click()
  const download = await downloadPromise

  const path = await download.path()
  if (!path) throw new Error('Download path not available')
  const text = await readFile(path, 'utf-8')

  await page.goto('/import')
  await page.getByLabel('Paste JSON').fill(text)
  await page.getByRole('button', { name: 'Load pasted JSON' }).click()

  await page.waitForURL(/\/editor/)
  await expect(page.getByRole('heading', { name: /Dataset/ })).toBeVisible()
})

test('sanitizes path characters from filename', async ({ page }) => {
  await page.getByLabel('Paste JSON').fill(JSON.stringify({
    '@type': 'Catalog',
    title: 'Test / Catalog : With * Special ? Characters',
    dataset: []
  }))
  await page.getByRole('button', { name: 'Load pasted JSON' }).click()

  await page.waitForURL(/\/editor/)

  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export catalog' }).click()
  const download = await downloadPromise

  const filename = download.suggestedFilename()
  expect(filename).not.toContain('/')
  expect(filename).not.toContain(':')
  expect(filename).not.toContain('*')
  expect(filename).not.toContain('?')
  expect(filename).toMatch(/^test-catalog-with-special-characters-\d{4}-\d{2}-\d{2}\.json$/)
})

test('announces export success to screen readers', async ({ page }) => {
  await loadSample(page, 'minimal-catalog.json')

  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export catalog' }).click()
  await downloadPromise

  await expect(page.locator('#export-status')).toContainText('Catalog exported successfully')
})

test.skip('announces circular reference error', async ({ page }) => {
  // TODO: This test requires manipulating the decomposed catalog structure directly
  // which is not easily accessible in the new architecture. We need to expose
  // the catalog for testing or find another way to create circular references.
  await loadSample(page, 'minimal-catalog.json')

  // Would need to manipulate the catalog structure here

  await page.getByRole('button', { name: 'Export catalog' }).click()

  const alert = page.getByRole('alert')
  await expect(alert).toContainText('Export failed')
  await expect(alert).toContainText(/circular reference/i)
})

test('handles large catalog export without freezing UI', async ({ page }) => {
  const datasets = Array.from({ length: 3000 }, (_, i) => ({
    '@type': 'Dataset',
    title: `Dataset ${i}`,
    description: `Description ${i}`.repeat(10)
  }))

  await page.getByLabel('Paste JSON').fill(JSON.stringify({
    '@type': 'Catalog',
    title: 'Large Catalog',
    dataset: datasets
  }))
  await page.getByRole('button', { name: 'Load pasted JSON' }).click()

  await page.waitForURL(/\/editor/)
  await expect(page.getByRole('heading', { level: 1, name: 'Large Catalog' })).toBeVisible()

  const downloadPromise = page.waitForEvent('download')

  const startTime = Date.now()
  await page.getByRole('button', { name: 'Export catalog' }).click()

  await page.getByRole('button', { name: /Show more objects/ }).click({ timeout: 5000 })

  const download = await downloadPromise
  const duration = Date.now() - startTime

  const path = await download.path()
  if (!path) throw new Error('Download path not available')
  const stats = await stat(path)

  console.log(`Exported 3,000 datasets in ${duration}ms, file size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`)
  expect(stats.size).toBeGreaterThan(0.5 * 1024 * 1024)
})

test('preserves unknown properties in export', async ({ page }) => {
  await page.getByLabel('Paste JSON').fill(JSON.stringify({
    '@type': 'Catalog',
    title: 'Test Catalog',
    'x-custom': 'preserved',
    dataset: [{
      '@type': 'Dataset',
      title: 'Test Dataset',
      'x-agency': { nested: true }
    }]
  }))
  await page.getByRole('button', { name: 'Load pasted JSON' }).click()

  await page.waitForURL(/\/editor/)

  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export catalog' }).click()
  const download = await downloadPromise

  const path = await download.path()
  if (!path) throw new Error('Download path not available')
  const text = await readFile(path, 'utf-8')
  const exported = JSON.parse(text)

  expect(exported['x-custom']).toBe('preserved')
  expect(exported.dataset[0]['x-agency']).toEqual({ nested: true })
})

test.skip('notifies user about shared object duplication', async ({ page }) => {
  // TODO: This test requires creating a catalog structure where the same object
  // is referenced from multiple places, which results in shared objects in the
  // decomposed structure. JSON.stringify creates independent copies, so we can't
  // easily create this scenario from JavaScript objects. This would need either:
  // 1. A fixture file with genuine shared objects
  // 2. A way to manipulate the decomposed catalog structure directly
  const sharedContact = { '@type': 'vcard:Contact', fn: 'Shared Contact', hasEmail: 'mailto:shared@example.gov' }
  await page.getByLabel('Paste JSON').fill(JSON.stringify({
    '@type': 'Catalog',
    title: 'Test Catalog',
    dataset: [
      { '@type': 'Dataset', title: 'Dataset 1', contactPoint: [sharedContact] },
      { '@type': 'Dataset', title: 'Dataset 2', contactPoint: [sharedContact] }
    ]
  }))
  await page.getByRole('button', { name: 'Load pasted JSON' }).click()

  await page.waitForURL(/\/editor/)

  await page.getByRole('button', { name: 'Export catalog' }).click()

  const status = page.locator('#export-status')
  await expect(status).toContainText(/shared object/i)
  await expect(status).toContainText(/duplicated/i)
})

test.skip('loads fixture, edits value, exports, and verifies edited content', async ({ page }) => {
  // TODO: This test requires editing the catalog in the UI, which is not yet implemented.
  // The editor currently only displays catalog data but doesn't allow editing.
  // This test should be re-enabled once editing functionality is added.
  await loadSample(page, 'minimal-catalog.json')

  // TODO: Use UI to edit title and properties

  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export catalog' }).click()
  const download = await downloadPromise

  const path = await download.path()
  if (!path) throw new Error('Download path not available')
  const text = await readFile(path, 'utf-8')
  const exported = JSON.parse(text)

  expect(exported.title).toBe('Edited Catalog Title')
  expect(exported['x-edited']).toBe(true)
  expect(exported.dataset[0].title).toBe('Edited Dataset Title')
})
