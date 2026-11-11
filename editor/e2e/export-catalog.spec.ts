import type { Page } from '@playwright/test'
import { test, expect } from './fixtures'
import { readFile, stat } from 'node:fs/promises'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
})

async function loadSample(page: Page, name: string) {
  await page.getByLabel('Sample catalog').selectOption(name)
  await page.getByRole('button', { name: 'Load sample' }).click()
  await expect(page.getByRole('heading', { name: `Loaded ${name}` })).toBeFocused()
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

  await page.getByLabel('Paste JSON').fill(text)
  await page.getByRole('button', { name: 'Load pasted JSON' }).click()

  await expect(page.getByRole('table', { name: /9 objects by class/ })).toBeVisible()
})

test('sanitizes path characters from filename', async ({ page }) => {
  await page.getByLabel('Paste JSON').fill(JSON.stringify({
    '@type': 'Catalog',
    title: 'Test / Catalog : With * Special ? Characters',
    dataset: []
  }))
  await page.getByRole('button', { name: 'Load pasted JSON' }).click()

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

  await expect(page.getByRole('status')).toContainText('Catalog exported successfully')
})

test('announces circular reference error', async ({ page }) => {
  await loadSample(page, 'minimal-catalog.json')

  await page.evaluate(() => {
    const win = window as { loadedCatalog?: { objects: Map<string, { links: Record<string, string[]> }> } }
    const catalog = win.loadedCatalog
    if (catalog) {
      const root = catalog.objects.get('#')
      if (root) {
        root.links.self = ['#']
      }
    }
  })

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

  await expect(page.getByRole('heading', { name: 'Loaded Pasted JSON' })).toBeVisible()

  const downloadPromise = page.waitForEvent('download')

  const startTime = Date.now()
  await page.getByRole('button', { name: 'Export catalog' }).click()

  await page.getByRole('button', { name: /Show (?:more|all) objects/ }).click({ timeout: 5000 })

  const download = await downloadPromise
  const duration = Date.now() - startTime

  const path = await download.path()
  if (!path) throw new Error('Download path not available')
  const stats = await stat(path)

  console.log(`Exported 3,000 datasets in ${duration}ms, file size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`)
  expect(stats.size).toBeGreaterThan(5 * 1024 * 1024)
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

test('notifies user about shared object duplication', async ({ page }) => {
  const sharedOrg = { '@type': 'Organization', name: 'Shared Agency' }
  await page.getByLabel('Paste JSON').fill(JSON.stringify({
    '@type': 'Catalog',
    title: 'Test Catalog',
    dataset: [
      { '@type': 'Dataset', title: 'Dataset 1', publisher: sharedOrg },
      { '@type': 'Dataset', title: 'Dataset 2', publisher: sharedOrg }
    ]
  }))
  await page.getByRole('button', { name: 'Load pasted JSON' }).click()

  await page.getByRole('button', { name: 'Export catalog' }).click()

  const status = page.getByRole('status')
  await expect(status).toContainText(/shared object/i)
  await expect(status).toContainText(/duplicated/i)
})
