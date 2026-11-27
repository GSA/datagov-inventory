import { expect, expectNoAxeViolations, test } from './fixtures'

async function saveSample(page: import('@playwright/test').Page, sample = 'minimal-catalog.json') {
  await page.goto('/import')
  await page.getByLabel('Sample catalog').selectOption(sample)
  await page.getByRole('button', { name: 'Load sample' }).click()
  await expect(page).toHaveURL(/\/editor\/[A-Za-z0-9_-]{22}$/)
}

test('the empty catalog launcher shows first-run content', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1, name: 'Edit your DCAT-US 3.0 catalog in this browser' })).toBeVisible()
  await expect(page.getByText('No catalogs are saved in this browser.')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Add a catalog' })).toHaveAttribute('href', '/import')
})

test('the start page offers saved catalogs and opens one', async ({ page }) => {
  await saveSample(page)
  const editorUrl = page.url()

  await page.goto('/')

  await expect(page.getByRole('heading', { level: 1, name: 'Saved catalogs' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Add a catalog' })).toHaveAttribute('href', '/import')
  await expect(page.getByText(/not backed up and will be lost if site data is cleared/)).toBeVisible()
  await expect(page.getByText(/Created .* · Last saved/)).toBeVisible()
  await page.getByRole('link', { name: 'minimal-catalog' }).click()
  await expect(page).toHaveURL(editorUrl)
})

test('the import page links back when a catalog has been saved', async ({ page }) => {
  await saveSample(page)
  await page.goto('/import')
  await expect(page.getByRole('link', { name: 'Back to catalogs' })).toHaveAttribute('href', '/')
})

test('canonical catalog addresses restore after reload', async ({ page }) => {
  await saveSample(page)
  const editorUrl = page.url()
  await page.reload()
  await expect(page).toHaveURL(editorUrl)
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
})

test('deletes one catalog from the listing after inline confirmation', async ({ page }) => {
  await saveSample(page)
  await page.goto('/')

  await page.getByRole('button', { name: /Delete minimal-catalog/ }).click()
  const confirmation = page.getByRole('heading', { level: 3, name: /Delete minimal-catalog/ })
  await expect(confirmation).toBeFocused()
  await page.getByRole('button', { name: 'Delete catalog' }).last().click()

  await expect(page.getByRole('status')).toContainText('1 catalog was deleted from this browser.')
  await expect(page.getByText('No catalogs are saved in this browser.')).toBeVisible()
})

test('deletes the current catalog from the editor', async ({ page }) => {
  await saveSample(page)
  await page.getByRole('button', { name: 'Delete catalog' }).click()
  const confirmation = page.getByRole('heading', { level: 2, name: /Delete minimal-catalog/ })
  await expect(confirmation).toBeFocused()
  await page.getByRole('button', { name: 'Delete catalog' }).last().click()
  await expect(page).toHaveURL('/')
  await expect(page.getByText('No catalogs are saved in this browser.')).toBeVisible()
})

test('catalog management reflows and passes automated accessibility checks', async ({ page }) => {
  await saveSample(page, 'dataset-with-distributions.json')
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto('/')

  await expect(page.getByRole('heading', { level: 1, name: 'Saved catalogs' })).toBeVisible()
  await expect(page.getByText('Using a private or incognito window?')).toBeVisible()
  await expect(page.getByText(/deleted when that session closes/)).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
  await expectNoAxeViolations(page)
})
