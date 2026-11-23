// Identical objects merge on import (ADR 0008, GSA/data.gov#6546): the sample's catalog and dataset name the same
// publisher, so it loads as one shared object, and an edit to it shows in both places.
import { test, expect } from './fixtures'

test('merges an identical publisher on import, and an edit to it shows in every place', async ({ page }) => {
  await page.goto('/import')
  await page.getByLabel('Sample catalog').selectOption('dataset-with-distributions.json')
  await page.getByRole('button', { name: 'Load sample' }).click()
  await expect(page.getByText('From dataset-with-distributions.json ·')).toHaveText(
    /· 8 objects · 1 identical copy merged · Open in this tab only/,
  )

  const tree = page.getByRole('tree', { name: 'Catalog' })
  await tree.getByRole('treeitem', { name: /^Example Agency Publisher/ }).click()
  const form = page.getByRole('form', { name: 'Edit Example Agency' })
  await expect(form.getByRole('heading', { name: 'Used in 2 places' })).toBeVisible()

  const name = form.getByRole('textbox', { name: /^Name/ })
  await name.fill('Social Security Administration')
  await name.blur()

  await tree.getByRole('treeitem', { name: /^Air quality readings Dataset/ }).press('ArrowRight')
  await expect(tree.getByRole('treeitem', { name: /^Social Security Administration Publisher/ })).toHaveCount(2)
  await expect(tree.getByRole('treeitem', { name: /^Example Agency Publisher/ })).toHaveCount(0)
})
