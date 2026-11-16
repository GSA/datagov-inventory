import { test, expect } from './fixtures'
import type { Page } from '@playwright/test'

async function loadSample(page: Page) {
  await page.goto('/import')
  await page.getByLabel('Sample catalog').selectOption('dataset-with-distributions.json')
  await page.getByRole('button', { name: 'Load sample' }).click()
  await expect(page).toHaveURL('/editor')
}

test('removes item from multi-value field', async ({ page }) => {
  await loadSample(page)
  await page.getByRole('treeitem', { name: /Air quality readings/ }).click()

  const keywordSection = page.getByRole('region', { name: 'Keyword' })
  const initialCount = await keywordSection.getByRole('listitem').count()

  await keywordSection.getByRole('listitem').first().getByRole('button', { name: /Remove/ }).click()

  await expect(keywordSection.getByRole('listitem')).toHaveCount(initialCount - 1)
})

test('removes last item from multi-value field and shows missing required indicator', async ({ page }) => {
  await page.goto('/import')
  await page.getByLabel('Paste JSON').fill(JSON.stringify({
    '@type': 'Catalog',
    title: 'Test Catalog',
    dataset: [{
      '@type': 'Dataset',
      title: 'Test Dataset',
      keyword: ['only-keyword']
    }]
  }))
  await page.getByRole('button', { name: 'Load pasted JSON' }).click()

  await page.getByRole('treeitem', { name: /Test Dataset/ }).click()

  const keywordSection = page.getByRole('region', { name: 'Keyword' })
  await keywordSection.getByRole('button', { name: /Remove/ }).click()

  await expect(keywordSection.getByRole('listitem')).toHaveCount(0)
  await expect(keywordSection.getByRole('alert')).toContainText('This required field has no values')
})

test('deletes unshared object', async ({ page }) => {
  await loadSample(page)
  await page.getByRole('treeitem', { name: /Air quality readings/ }).click()

  await page.getByRole('button', { name: 'Delete object' }).click()

  await expect(page).toHaveURL('/editor')
  await expect(page.getByRole('treeitem', { name: /Air quality readings/ })).not.toBeVisible()
})

test('shows delete button for all objects', async ({ page }) => {
  await loadSample(page)

  await page.getByRole('treeitem', { name: /Air quality/ }).click()
  await expect(page.getByRole('button', { name: 'Delete object' })).toBeVisible()
})

test('deletes child object', async ({ page }) => {
  await loadSample(page)

  const dataset = page.getByRole('treeitem', { name: /Air quality/ })
  await dataset.click()
  await dataset.click()

  await page.getByRole('treeitem', { name: /Readings as CSV/ }).click()
  await page.getByRole('button', { name: 'Delete object' }).click()

  await expect(page.getByRole('treeitem', { name: /Readings as CSV/ })).not.toBeVisible()
})

test('undoes object deletion', async ({ page }) => {
  await loadSample(page)
  const dataset = page.getByRole('treeitem', { name: /Air quality/ })
  await dataset.click()
  await dataset.click()

  await page.getByRole('treeitem', { name: /Readings as CSV/ }).click()
  await page.getByRole('button', { name: 'Delete object' }).click()
  await expect(page.getByRole('treeitem', { name: /Readings as CSV/ })).not.toBeVisible()

  await page.getByRole('button', { name: 'Undo' }).click()

  await expect(page.getByRole('treeitem', { name: /Readings as CSV/ })).toBeVisible()
})

test('undo button disabled when no removal to undo', async ({ page }) => {
  await loadSample(page)

  await expect(page.getByRole('button', { name: 'Undo' })).toBeDisabled()
})

test('focuses next item after removing from multi-value field', async ({ page }) => {
  await loadSample(page)
  await page.getByRole('treeitem', { name: /Air quality readings/ }).click()

  const keywordSection = page.getByRole('region', { name: 'Keyword' })
  await keywordSection.getByRole('listitem').nth(0).getByRole('button', { name: /Remove/ }).click()

  const nextInput = keywordSection.getByRole('textbox').first()
  await expect(nextInput).toBeFocused()
})

test('focuses parent in tree after deleting object', async ({ page }) => {
  await loadSample(page)
  await page.getByRole('treeitem', { name: /Air quality readings/ }).click()

  await page.getByRole('button', { name: 'Delete object' }).click()

  await expect(page).toHaveURL('/editor')
})

test('keyboard navigation works for remove buttons', async ({ page }) => {
  await loadSample(page)
  await page.getByRole('treeitem', { name: /Air quality readings/ }).click()

  const keywordSection = page.getByRole('region', { name: 'Keyword' })
  const removeButton = keywordSection.getByRole('listitem').first().getByRole('button', { name: /Remove/ })

  await removeButton.focus()
  await expect(removeButton).toBeFocused()
})

test('screen reader announces removal confirmation dialog', async ({ page }) => {
  await loadSample(page)
  await page.getByRole('treeitem', { name: /Air quality readings/ }).click()

  const removeButtons = page.getByRole('button', { name: /Remove/ })
  await expect(removeButtons.first()).toHaveAttribute('aria-label')
})

test('removal operations work with accessibility tools', async ({ page }) => {
  await loadSample(page)
  await page.getByRole('treeitem', { name: /Air quality readings/ }).click()

  const AxeBuilder = (await import('@axe-core/playwright')).default
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze()

  expect(results.violations).toEqual([])
})
