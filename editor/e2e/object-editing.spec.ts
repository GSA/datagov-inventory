import { test, expect } from './fixtures'
import type { Page } from '@playwright/test'

async function loadSample(page: Page) {
  await page.goto('/import')
  await page.getByLabel('Sample catalog').selectOption('dataset-with-distributions.json')
  await page.getByRole('button', { name: 'Load sample' }).click()
  await expect(page).toHaveURL('/editor')
}

test('opens object in editable form when clicked in tree', async ({ page }) => {
  await loadSample(page)

  await page.getByRole('treeitem', { name: 'Air quality readings dataset · Dataset' }).click()
  await expect(page).toHaveURL('/editor/dataset/0')

  await expect(page.getByRole('form', { name: 'Edit Air quality readings' })).toBeVisible()
  await expect(page.getByLabel('Title')).toBeVisible()
  await expect(page.getByLabel('Description')).toBeVisible()
})

test('edits text field and updates tree label', async ({ page }) => {
  await loadSample(page)

  await page.getByRole('treeitem', { name: 'Air quality readings dataset · Dataset' }).click()

  const titleInput = page.getByLabel('Title')
  await expect(titleInput).toHaveValue('Air quality readings')

  await titleInput.fill('Updated Air Quality Data')
  await titleInput.blur()

  await expect(page.getByRole('treeitem', { name: 'Updated Air Quality Data dataset · Dataset' })).toBeVisible()
})

test('shows required marker on required fields', async ({ page }) => {
  await loadSample(page)

  await page.getByRole('treeitem', { name: 'Air quality readings dataset · Dataset' }).click()

  const titleLabel = page.getByText('Title').locator('..')
  await expect(titleLabel).toContainText('*')
  await expect(titleLabel).toContainText('required')
})

test('shows help text below fields', async ({ page }) => {
  await loadSample(page)

  await page.getByRole('treeitem', { name: 'Air quality readings dataset · Dataset' }).click()

  const descriptionHelp = page.getByText(/human-readable description/i)
  await expect(descriptionHelp).toBeVisible()
})

test('adds and removes entries in multi-value field', async ({ page }) => {
  await loadSample(page)

  await page.getByRole('treeitem', { name: 'Air quality readings dataset · Dataset' }).click()

  const keywordSection = page.getByRole('region', { name: 'Keyword' })
  await expect(keywordSection.getByRole('listitem')).toHaveCount(3)

  await keywordSection.getByRole('button', { name: 'Add keyword' }).click()
  await keywordSection.getByLabel('Keyword 4').fill('new-keyword')
  await keywordSection.getByLabel('Keyword 4').blur()

  await expect(keywordSection.getByRole('listitem')).toHaveCount(4)

  await keywordSection.getByRole('listitem').nth(1).getByRole('button', { name: 'Remove' }).click()
  await expect(keywordSection.getByRole('listitem')).toHaveCount(3)
})

test('shows unknown properties as read-only', async ({ page }) => {
  await page.goto('/import')

  await page.getByLabel('Paste JSON').fill(JSON.stringify({
    '@type': 'Catalog',
    title: 'Test Catalog',
    'x-custom-field': 'preserved value',
    dataset: [{
      '@type': 'Dataset',
      title: 'Test Dataset',
      'x-agency-id': 'ABC123'
    }]
  }))
  await page.getByRole('button', { name: 'Load pasted JSON' }).click()

  await page.getByRole('treeitem', { name: 'Test Dataset dataset · Dataset' }).click()

  const otherProps = page.getByRole('region', { name: 'Other properties' })
  await expect(otherProps).toBeVisible()
  await expect(otherProps).toContainText('x-agency-id')
  await expect(otherProps).toContainText('ABC123')

  await expect(otherProps.getByRole('textbox')).toHaveCount(0)
})

test('form passes accessibility checks', async ({ page }) => {
  await loadSample(page)
  await page.getByRole('treeitem', { name: 'Air quality readings dataset · Dataset' }).click()

  const AxeBuilder = (await import('@axe-core/playwright')).default
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze()

  expect(results.violations).toEqual([])
})
