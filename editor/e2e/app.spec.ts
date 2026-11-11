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
    await expect(heading).toContainText('DCAT-US 3.0 Catalog Editor')
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
