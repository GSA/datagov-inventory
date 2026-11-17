import type { Page } from '@playwright/test'
import { test, expect } from './fixtures'

const DATASET = 'Air quality readings'

async function openDataset(page: Page) {
  await page.goto('/import')
  await page.getByLabel('Sample catalog').selectOption('dataset-with-distributions.json')
  await page.getByRole('button', { name: 'Load sample' }).click()
  await expect(page).toHaveURL('/editor')
  await page.getByRole('treeitem', { name: `${DATASET} dataset · Dataset` }).click()
  return page.getByRole('form', { name: `Edit ${DATASET}` })
}

async function enterInvalidIssuedDate(page: Page) {
  const form = await openDataset(page)
  const issued = form.getByRole('textbox', { name: /^Issued/ })
  await issued.fill('not a date')
  await issued.blur()
  return form
}

test.describe('Validation', () => {
  test('validates an object and shows inline field errors', async ({ page }) => {
    const form = await enterInvalidIssuedDate(page)

    await form.getByRole('button', { name: `Validate ${DATASET}` }).click()

    await expect(form.getByRole('alert').filter({ hasText: 'Validation errors' })).toContainText('Issued')
    await expect(form.locator('.usa-error-message')).toHaveText('is not in an accepted form')
    await expect(form.locator('.validation-badge--invalid')).toContainText(/error/i)
  })

  test('shows a validation summary for the catalog', async ({ page }) => {
    await openDataset(page)

    await page.getByRole('button', { name: 'Validate catalog' }).click()

    const results = page.getByRole('region', { name: 'Validation results' })
    await expect(results).toContainText('No errors found')
    await expect(results).toContainText(/advisory.*3\.0\.0/i)
  })

  test('marks validation as stale after an edit', async ({ page }) => {
    const form = await openDataset(page)

    await form.getByRole('button', { name: `Validate ${DATASET}` }).click()
    await expect(form.locator('.validation-badge--valid')).toBeVisible()

    const title = form.getByRole('textbox', { name: /^Title/ })
    await title.fill('Updated Title')
    await title.blur()

    await expect(page.locator('.validation-badge--stale')).toBeVisible()
  })

  test('warns before exporting a catalog with errors', async ({ page }) => {
    await enterInvalidIssuedDate(page)

    await page.getByRole('button', { name: 'Validate catalog' }).click()
    await expect(page.getByRole('region', { name: 'Validation results' })).toContainText(/errors? found/)

    await page.getByRole('button', { name: 'Export catalog' }).click()

    const dialog = page.getByRole('dialog')
    await expect(dialog).toContainText('Validation Errors Detected')
    await expect(dialog).toContainText('did not pass')
    await expect(dialog.getByRole('button', { name: 'Download Anyway' })).toBeVisible()
  })

  test('announces validation errors to screen readers', async ({ page }) => {
    const form = await enterInvalidIssuedDate(page)

    await form.getByRole('button', { name: `Validate ${DATASET}` }).click()

    const alert = form.getByRole('alert').filter({ hasText: 'Validation errors' })
    await expect(alert).toHaveAttribute('aria-live', 'polite')
    await expect(alert).toContainText('Issued')
  })

  test('does not rely on color alone for errors', async ({ page }) => {
    const form = await enterInvalidIssuedDate(page)

    await form.getByRole('button', { name: `Validate ${DATASET}` }).click()

    const badge = form.locator('.validation-badge--invalid')
    await expect(badge.locator('.validation-badge__icon')).toHaveText('✕')
    await expect(badge).toContainText(/\d+ errors?/)
  })

  test('navigates to an object with errors from the summary', async ({ page }) => {
    await enterInvalidIssuedDate(page)
    await page.getByRole('treeitem', { name: 'Example Agency Catalog', exact: true }).click()

    await page.getByRole('button', { name: 'Validate catalog' }).click()
    await page.getByRole('button', { name: /^Air quality readings #\/dataset\/0 \(\d+ errors?\)$/ }).click()

    await expect(page).toHaveURL('/editor/dataset/0')
    await expect(page.getByRole('form', { name: `Edit ${DATASET}` })).toBeVisible()
  })
})
