import { test, expect } from './fixtures'
import type { Page } from '@playwright/test'

async function loadSample(page: Page) {
  await page.goto('/import')
  await page.getByLabel('Sample catalog').selectOption('dataset-with-distributions.json')
  await page.getByRole('button', { name: 'Load sample' }).click()
  await expect(page).toHaveURL('/editor')
}

test('shows remove buttons on multi-value fields', async ({ page }) => {
  await loadSample(page)
  await page.getByRole('treeitem', { name: /Air quality readings/ }).click()

  const keywordSection = page.getByRole('region', { name: 'Keyword' })
  const removeButtons = keywordSection.getByRole('button', { name: /Remove/ })

  await expect(removeButtons.first()).toBeVisible()
})

test('shows delete button for objects', async ({ page }) => {
  await loadSample(page)

  await page.getByRole('treeitem', { name: /Air quality/ }).click()
  await expect(page.getByRole('button', { name: 'Delete object' })).toBeVisible()
})

test('deletes object', async ({ page }) => {
  await loadSample(page)
  await page.getByRole('treeitem', { name: /Air quality readings/ }).click()

  await page.getByRole('button', { name: 'Delete object' }).click()

  await expect(page).toHaveURL('/editor')
  await expect(page.getByRole('treeitem', { name: /Air quality readings/ })).not.toBeVisible()
})

test('undoes object deletion', async ({ page }) => {
  await loadSample(page)
  await page.getByRole('treeitem', { name: /Air quality readings/ }).click()

  await page.getByRole('button', { name: 'Delete object' }).click()
  await expect(page.getByRole('treeitem', { name: /Air quality readings/ })).not.toBeVisible()

  await page.getByRole('button', { name: 'Undo' }).click()

  await expect(page.getByRole('treeitem', { name: /Air quality readings/ })).toBeVisible()
})

test('undo button disabled when no removal to undo', async ({ page }) => {
  await loadSample(page)

  await expect(page.getByRole('button', { name: 'Undo' })).toBeDisabled()
})

test('undo button enabled after deletion', async ({ page }) => {
  await loadSample(page)
  await page.getByRole('treeitem', { name: /Air quality readings/ }).click()

  await expect(page.getByRole('button', { name: 'Undo' })).toBeDisabled()

  await page.getByRole('button', { name: 'Delete object' }).click()

  await expect(page.getByRole('button', { name: 'Undo' })).toBeEnabled()
})

test('remove buttons have aria labels', async ({ page }) => {
  await loadSample(page)
  await page.getByRole('treeitem', { name: /Air quality readings/ }).click()

  const removeButtons = page.getByRole('button', { name: /Remove/ })
  await expect(removeButtons.first()).toHaveAttribute('aria-label')
})

test('delete object button has accessible label', async ({ page }) => {
  await loadSample(page)
  await page.getByRole('treeitem', { name: /Air quality/ }).click()

  const deleteButton = page.getByRole('button', { name: 'Delete object' })
  await expect(deleteButton).toBeVisible()
  await expect(deleteButton).toHaveAccessibleName('Delete object')
})

test('passes accessibility checks', async ({ page }) => {
  await loadSample(page)
  await page.getByRole('treeitem', { name: /Air quality readings/ }).click()

  const AxeBuilder = (await import('@axe-core/playwright')).default
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze()

  expect(results.violations).toEqual([])
})

test('asks in place, with no dialog, before deleting an object used in several places', async ({ page }) => {
  await loadSample(page)
  // The catalog and the dataset share the dataset's contact.
  const contacts = page.getByRole('group', { name: 'Contact Point' })
  await contacts.getByRole('combobox').fill('air')
  await page.getByRole('option', { name: /Air Quality Team/ }).click()
  await contacts.getByRole('link', { name: 'Air Quality Team' }).click()

  await page.getByRole('button', { name: 'Delete object' }).click()
  const question = page.getByRole('heading', { name: 'Delete this shared object?' })
  await expect(question).toBeFocused()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.locator('.usa-alert--warning .usa-list > li')).toHaveText([
    'Example Agency Catalog › Contact Point',
    'Air quality readings › Contact Point',
  ])
  const AxeBuilder = (await import('@axe-core/playwright')).default
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze()
  expect(results.violations).toEqual([])

  // Cancel keeps it, and focus returns to Delete.
  await page.getByRole('button', { name: 'Cancel' }).click()
  await expect(question).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Delete object' })).toBeFocused()

  await page.getByRole('button', { name: 'Delete object' }).click()
  await page.getByRole('button', { name: 'Delete from all 2 places' }).click()
  await expect(page).toHaveURL('/editor')
  await expect(page.getByRole('treeitem', { name: /^Air Quality Team/ })).toHaveCount(0)

  await page.getByRole('button', { name: 'Undo' }).click()
  await expect(contacts.getByRole('link', { name: 'Air Quality Team' })).toBeVisible()
})
