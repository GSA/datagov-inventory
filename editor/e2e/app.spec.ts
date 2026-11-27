import { test, expect } from './fixtures'
import AxeBuilder from '@axe-core/playwright'
import type { Page } from '@playwright/test'

async function importSample(page: Page, name: string) {
  await page.goto('/import')
  await page.getByLabel('Sample catalog').selectOption(name)
  await page.getByRole('button', { name: 'Load sample' }).click()
  await expect(page).toHaveURL(/\/editor\/[A-Za-z0-9_-]{22}$/)
}

test.describe('App page frame', () => {
  test('has title', async ({ page }) => {
    await page.goto('/')

    await expect(page).toHaveTitle(/Inventory Editor/)
  })

  test('displays government banner', async ({ page }) => {
    await page.goto('/')

    const banner = page.locator('.usa-banner')
    await expect(banner).toBeVisible()
  })

  test('displays header with title', async ({ page }) => {
    await page.goto('/')

    const header = page.locator('header.usa-header')
    await expect(header).toBeVisible()

    const title = header.locator('text=Inventory Editor')
    await expect(title).toBeVisible()
  })

  test('displays main content area', async ({ page }) => {
    await page.goto('/')

    const main = page.locator('main#main-content')
    await expect(main).toBeVisible()

    const heading = main.locator('h1')
    await expect(heading).toContainText('Edit your DCAT-US 3.0 catalog in this browser')
  })

  test('uses contextual navigation between catalogs, import, and editor', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('main').getByRole('link', { name: 'Add a catalog' }).click()
    await expect(page).toHaveURL('/import')
    await expect(page).toHaveTitle('Import a catalog | Inventory Editor')
    await expect(page.getByRole('heading', { level: 1, name: 'Import a catalog' })).toBeFocused()
    await expect(page.getByRole('link', { name: 'Back to catalogs' })).toHaveCount(0)
    await page.getByRole('link', { name: 'Inventory Editor' }).click()
    await expect(page).toHaveURL('/')
  })

  test('serves every route from its address, as a bookmark would', async ({ page }) => {
    await page.goto('/editor/byND73XUQ6eHsUP6ks4Kog')
    await expect(page.getByRole('heading', { level: 1, name: 'Catalog not found in this browser' })).toBeVisible()
    await page.goto('/editor/not-a-catalog-token')
    await expect(page.getByRole('heading', { level: 1, name: 'Invalid editor address' })).toBeVisible()
    await page.goto('/no-such-page')
    await expect(page.getByRole('heading', { level: 1, name: 'Page not found' })).toBeVisible()
  })

  test('returns from the editor to its catalog in the listing', async ({ page }) => {
    await importSample(page, 'dataset-with-distributions.json')
    const catalogUrl = page.url()

    await page.getByRole('link', { name: 'All catalogs' }).click()
    await page.getByRole('link', { name: 'Example Agency Catalog' }).click()

    await expect(page).toHaveURL(catalogUrl)
    await expect(page.getByRole('heading', { level: 1, name: 'Example Agency Catalog' })).toBeVisible()
  })

  test('should not have automatically detectable accessibility issues', async ({ page }) => {
    await page.goto('/')

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze()

    expect(accessibilityScanResults.violations).toEqual([])
  })
})

// Proves the CSP fixture can fail: a blocked request must fail the test.
test.fail('a CSP violation fails the test', async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => fetch('/blocked').catch(() => undefined))
})
