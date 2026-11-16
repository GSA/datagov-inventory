import { test, expect } from '@playwright/test'

test.describe('Validation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/import')
    await page.getByRole('button', { name: 'Start a blank catalog' }).click()
    await expect(page).toHaveURL(/\/editor/)
  })

  test('should validate object and show inline field errors', async ({ page }) => {
    await page.getByRole('treeitem', { name: /dataset/i }).first().click()

    const titleInput = page.getByLabel(/title/i)
    await titleInput.clear()
    await titleInput.blur()

    await page.getByRole('button', { name: /^validate/i }).click()

    await expect(page.getByRole('alert')).toContainText(/title.*required/i)

    const errorBadge = page.locator('.validation-badge--invalid')
    await expect(errorBadge).toBeVisible()
    await expect(errorBadge).toContainText(/error/i)
  })

  test('should show validation summary for catalog', async ({ page }) => {
    await page.getByRole('button', { name: /validate catalog/i }).click()

    await expect(page.getByRole('region', { name: /validation results/i })).toBeVisible()

    await expect(page.getByText(/advisory/i)).toBeVisible()
    await expect(page.getByText(/3\.0\.0/i)).toBeVisible()
  })

  test('should mark validation as stale after edit', async ({ page }) => {
    await page.getByRole('treeitem', { name: /dataset/i }).first().click()

    await page.getByRole('button', { name: /^validate/i }).click()

    await expect(page.locator('.validation-badge--valid')).toBeVisible()

    const titleInput = page.getByLabel(/title/i)
    await titleInput.fill('Updated Title')
    await titleInput.blur()

    await expect(page.locator('.validation-badge--stale')).toBeVisible()
  })

  test('should show export warning when errors exist', async ({ page }) => {
    await page.getByRole('treeitem', { name: /dataset/i }).first().click()

    const titleInput = page.getByLabel(/title/i)
    await titleInput.clear()
    await titleInput.blur()

    await page.getByRole('button', { name: /^validate/i }).click()

    await expect(page.getByRole('alert')).toContainText(/title.*required/i)

    await page.getByRole('button', { name: /export catalog/i }).click()

    await expect(page.getByRole('dialog')).toContainText(/validation errors/i)
    await expect(page.getByRole('dialog')).toContainText(/did not pass/i)

    const downloadBtn = page.getByRole('button', { name: /download anyway/i })
    await expect(downloadBtn).toBeVisible()
  })

  test('should announce validation errors to screen readers', async ({ page }) => {
    await page.getByRole('treeitem', { name: /dataset/i }).first().click()

    const titleInput = page.getByLabel(/title/i)
    await titleInput.clear()
    await titleInput.blur()

    await page.getByRole('button', { name: /^validate/i }).click()

    const alert = page.getByRole('alert').first()
    await expect(alert).toHaveAttribute('aria-live', 'polite')
    await expect(alert).toContainText(/required/i)
  })

  test('should not rely on color alone for errors', async ({ page }) => {
    await page.getByRole('treeitem', { name: /dataset/i }).first().click()

    const titleInput = page.getByLabel(/title/i)
    await titleInput.clear()
    await titleInput.blur()

    await page.getByRole('button', { name: /^validate/i }).click()

    const errorIcon = page.locator('.validation-badge--invalid .validation-badge__icon')
    await expect(errorIcon).toHaveText('✕')

    await expect(page.getByText(/error/i)).toBeVisible()
  })

  test('should navigate to objects with errors from summary', async ({ page }) => {
    await page.getByRole('button', { name: /validate catalog/i }).click()

    await expect(page.getByRole('region', { name: /validation results/i })).toBeVisible()

    const objectLink = page.locator('.validation-summary__object-link').first()
    if (await objectLink.isVisible()) {
      const objectId = await objectLink.textContent()
      await objectLink.click()

      await expect(page).toHaveURL(new RegExp(objectId?.split(' ')[0]?.replace('#/', '') || ''))
    }
  })
})
