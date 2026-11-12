import { test, expect } from './fixtures'
import AxeBuilder from '@axe-core/playwright'

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

  test('goes from the start page to import, and the header reaches every page', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('main').getByRole('link', { name: 'Import a catalog' }).click()
    await expect(page).toHaveURL('/import')
    await expect(page).toHaveTitle('Import a catalog | Inventory Editor')
    await expect(page.getByRole('heading', { level: 1, name: 'Import a catalog' })).toBeFocused()
    await expect(page.getByRole('link', { name: 'Import', exact: true })).toHaveAttribute('aria-current', 'page')

    await page.getByRole('link', { name: 'Editor', exact: true }).click()
    await expect(page).toHaveURL('/editor')
    await expect(page.getByRole('heading', { level: 1, name: 'No catalog open' })).toBeFocused()
    await page.goBack()
    await expect(page).toHaveURL('/import')
    await page.getByRole('link', { name: 'Inventory Editor' }).click()
    await expect(page).toHaveURL('/')
  })

  test('serves every route from its address, as a bookmark would', async ({ page }) => {
    await page.goto('/editor/dataset/0?type=Dataset')
    await expect(page.getByRole('heading', { level: 1, name: 'No catalog open' })).toBeVisible()
    await page.goto('/no-such-page')
    await expect(page.getByRole('heading', { level: 1, name: 'Page not found' })).toBeVisible()
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
