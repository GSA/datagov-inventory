import { test, expect, expectCatalogSaved } from './fixtures'
import type { Page } from '@playwright/test'

async function loadSample(page: Page) {
  await page.goto('/import')
  await page.getByLabel('Sample catalog').selectOption('dataset-with-distributions.json')
  await page.getByRole('button', { name: 'Load sample' }).click()
  await expect(page).toHaveURL(/\/editor\/[A-Za-z0-9_-]{22}$/)
}

test('opens object in editable form when clicked in tree', async ({ page }) => {
  await loadSample(page)

  await page.getByRole('treeitem', { name: 'Air quality readings Dataset' }).click()
  await expect(page).toHaveURL(/\/editor\/[A-Za-z0-9_-]{22}\/dataset\/[A-Za-z0-9_-]{22}$/)

  const form = page.getByRole('form', { name: 'Edit Air quality readings' })
  await expect(form).toBeVisible()
  await expect(form.getByRole('textbox', { name: /^Title/ })).toBeVisible()
  await expect(form.getByRole('textbox', { name: /^Description/ })).toBeVisible()
})

test('edits text field and updates tree label', async ({ page }) => {
  await loadSample(page)

  await page.getByRole('treeitem', { name: 'Air quality readings Dataset' }).click()

  const form = page.getByRole('form', { name: 'Edit Air quality readings' })
  const titleInput = form.getByRole('textbox', { name: /^Title/ })
  await expect(titleInput).toHaveValue('Air quality readings')

  await titleInput.fill('Updated Air Quality Data')
  await titleInput.blur()

  await expect(page.getByRole('treeitem', { name: 'Updated Air Quality Data Dataset' })).toBeVisible()
})

test('autosaves an edit and restores it from the object URL after reload', async ({ page }) => {
  await loadSample(page)
  await page.getByRole('treeitem', { name: /^Air quality readings Dataset/ }).click()
  const title = page.getByRole('form').getByRole('textbox', { name: /^Title/ })
  await title.fill('Persisted Air Quality Data')
  await title.blur()
  await expectCatalogSaved(page)

  await page.reload()

  await expect(page.getByRole('form', { name: 'Edit Persisted Air Quality Data' })).toBeVisible()
  await expect(page.getByRole('treeitem', { name: /^Persisted Air Quality Data Dataset/ })).toBeVisible()
})

test('shows required marker on required fields', async ({ page }) => {
  await loadSample(page)

  await page.getByRole('treeitem', { name: 'Air quality readings Dataset' }).click()

  const form = page.getByRole('form', { name: 'Edit Air quality readings' })
  const titleField = form.getByRole('textbox', { name: /Title.*\*/ })
  await expect(titleField).toBeVisible()
  const label = form.locator('label[for="field-title"]')
  await expect(label).toContainText('*')
  await expect(label.locator('abbr')).toHaveAttribute('title', 'required')
})

test('shows help text below fields', async ({ page }) => {
  await loadSample(page)

  await page.getByRole('treeitem', { name: 'Air quality readings Dataset' }).click()

  const form = page.getByRole('form', { name: 'Edit Air quality readings' })
  const descriptionField = form.getByRole('textbox', { name: /^Description/ })
  const helpId = await descriptionField.getAttribute('aria-describedby')
  if (helpId) {
    const helpText = page.locator(`#${helpId}`)
    await expect(helpText).toBeVisible()
    await expect(helpText).not.toBeEmpty()
  }
})

test('adds and removes entries in multi-value field', async ({ page }) => {
  await loadSample(page)

  await page.getByRole('treeitem', { name: 'Air quality readings Dataset' }).click()

  const keywordSection = page.getByRole('region', { name: 'Keyword' })
  await expect(keywordSection.getByRole('listitem')).toHaveCount(2)

  await keywordSection.getByRole('button', { name: 'Add keyword' }).click()
  const newInput = keywordSection.getByRole('textbox').last()
  await newInput.fill('new-keyword')
  await newInput.blur()

  await expect(keywordSection.getByRole('listitem')).toHaveCount(3)

  await keywordSection.getByRole('listitem').nth(0).getByRole('button', { name: /Remove/ }).click()
  await expect(keywordSection.getByRole('listitem')).toHaveCount(2)

  // The removal is saved, not only shown: it is still gone after opening another object and coming back.
  await page.getByRole('treeitem', { name: 'Example Agency Catalog', exact: true }).click()
  await page.getByRole('treeitem', { name: 'Air quality readings Dataset' }).click()
  await expect(keywordSection.getByRole('textbox').nth(0)).toHaveValue('monitoring')
  await expect(keywordSection.getByRole('textbox').nth(1)).toHaveValue('new-keyword')
})

test('edits class fields given as text and string-only fields', async ({ page }) => {
  await loadSample(page)
  await page.getByRole('treeitem', { name: 'Air quality readings Dataset' }).click()
  const form = page.getByRole('form', { name: 'Edit Air quality readings' })

  // theme holds Concepts; the sample gives one as a string, which stays editable.
  await expect(form.getByRole('region', { name: 'Theme' }).getByRole('textbox')).toHaveValue('Environment')
  await expect(form.getByRole('region', { name: 'Language' }).getByRole('textbox')).toHaveValue('en')
  await expect(form.getByRole('textbox', { name: /^Identifier/ })).toHaveValue('example-air-quality')
  await expect(form.getByRole('textbox', { name: /^Issued/ })).toHaveValue('2024-01-15')
  // Distributions are linked objects, not text.
  const distributions = form.getByRole('group', { name: 'Distribution', exact: true })
  await expect(distributions).toBeVisible()
  await expect(distributions.getByRole('textbox')).toHaveCount(0)
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

  await page.getByRole('treeitem', { name: 'Test Dataset Dataset' }).click()

  const otherProps = page.getByRole('region', { name: 'Other properties' })
  await expect(otherProps).toBeVisible()
  await expect(otherProps).toContainText('x-agency-id')
  await expect(otherProps).toContainText('ABC123')

  await expect(otherProps.getByRole('textbox')).toHaveCount(0)
})

test('form passes accessibility checks', async ({ page }) => {
  await loadSample(page)
  await page.getByRole('treeitem', { name: 'Air quality readings Dataset' }).click()

  const AxeBuilder = (await import('@axe-core/playwright')).default
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze()

  expect(results.violations).toEqual([])
})

test('opens on the required fields, and long text keeps its box while typing', async ({ page }) => {
  await loadSample(page)
  await page.getByRole('treeitem', { name: 'Air quality readings Dataset' }).click()
  const form = page.getByRole('form', { name: 'Edit Air quality readings' })

  // Required fields first, whatever their kind: the three text fields, then Contact point.
  const labels = form.locator('label.usa-label, h3')
  await expect(labels.nth(0)).toHaveText(/^Title/)
  await expect(labels.nth(1)).toHaveText(/^Description/)
  await expect(labels.nth(2)).toHaveText(/^Identifier/)
  await expect(labels.nth(3)).toHaveText(/^Contact point/)

  // Description is a multi-line box even when short; a short text field stays one line past 100 characters, with focus.
  await expect(form.locator('textarea#field-description')).toBeVisible()
  const identifier = form.getByRole('textbox', { name: /^Identifier/ })
  await identifier.fill('x'.repeat(120))
  await expect(identifier).toBeFocused()
  await expect(form.locator('input#field-identifier')).toHaveValue('x'.repeat(120))
})
