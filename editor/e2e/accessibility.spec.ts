import type { Page } from '@playwright/test'
import { test, expect, expectNoAxeViolations } from './fixtures'

// Groundwork for #30: axe scans every page and state the editor has so far, under the production CSP (the fixture
// fails the test on any CSP violation, axe's included). #30 adds the form, dialogs, check results and restore prompt.

const tree = (page: Page) => page.getByRole('tree', { name: 'Catalog' })
const item = (page: Page, name: string) => tree(page).getByRole('treeitem', { name, exact: true })

async function loadSample(page: Page, name: string) {
  await page.getByLabel('Sample catalog').selectOption(name)
  await page.getByRole('button', { name: 'Load sample' }).click()
}

test('every page and state has no WCAG 2.1 AA violations axe can find', async ({ page }) => {
  await test.step('start page', async () => {
    await page.goto('/')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expectNoAxeViolations(page)
  })

  await test.step('page not found', async () => {
    await page.goto('/no-such-page')
    await expect(page.getByRole('heading', { level: 1, name: 'Page not found' })).toBeVisible()
    await expectNoAxeViolations(page)
  })

  await test.step('editor with no catalog open', async () => {
    await page.goto('/editor')
    await expect(page.getByRole('heading', { level: 1, name: 'No catalog open' })).toBeVisible()
    await expectNoAxeViolations(page)
  })

  await test.step('import page', async () => {
    await page.goto('/import')
    await expect(page.getByRole('heading', { level: 1, name: 'Import a catalog' })).toBeVisible()
    await expectNoAxeViolations(page)
  })

  await test.step('import page with a load error alert', async () => {
    await page.getByLabel('Paste JSON').fill('{"@type": "Catalog", "dataset": [')
    await page.getByRole('button', { name: 'Load pasted JSON' }).click()
    await expect(page.getByRole('alert')).toContainText('This is not valid JSON')
    await expectNoAxeViolations(page)
  })

  await test.step('editor on a loaded catalog, with the tree and detail pane', async () => {
    await loadSample(page, 'dataset-with-distributions.json')
    await expect(page).toHaveURL('/editor')
    await expect(page.locator('#detail-heading')).toHaveText('Example Agency Catalog')
    await expectNoAxeViolations(page)
  })

  await test.step('editor with the tree expanded and a nested object open', async () => {
    await item(page, 'Air quality readings dataset · Dataset').locator('.catalog-tree__toggle').click()
    await item(page, 'Readings as CSV distribution · Distribution').locator('.catalog-tree__toggle').click()
    await item(page, 'Untitled Checksum checksum · Checksum').click()
    await expect(page.getByRole('navigation', { name: 'Where this object is' })).toBeVisible()
    await expectNoAxeViolations(page)
  })

  await test.step('editor with the tree filtered', async () => {
    const filter = page.getByLabel('Filter by title or name')
    await filter.fill('readings')
    await expect(page.getByRole('status').filter({ hasText: 'match' })).toHaveText('3 objects match.')
    await expectNoAxeViolations(page)
    await filter.fill('nothing like this')
    await expect(tree(page)).toHaveCount(0)
    await expectNoAxeViolations(page)
  })

  await test.step('import page with a catalog open, and the replace prompt', async () => {
    await page.getByRole('link', { name: 'Import', exact: true }).click()
    await expect(page.getByText('dataset-with-distributions.json is open.')).toBeVisible()
    await expectNoAxeViolations(page)
    await loadSample(page, 'minimal-catalog.json')
    await expect(page.getByRole('heading', { name: 'Replace the open catalog?' })).toBeFocused()
    await expectNoAxeViolations(page)
  })
})
