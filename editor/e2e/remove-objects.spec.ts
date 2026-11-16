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
  await expect(keywordSection).toContainText('required')
})

test('deletes unshared object', async ({ page }) => {
  await loadSample(page)
  await page.getByRole('treeitem', { name: /Air quality readings/ }).click()

  await page.getByRole('button', { name: 'Delete object' }).click()

  await expect(page).toHaveURL('/editor')
  await expect(page.getByRole('treeitem', { name: /Air quality readings/ })).not.toBeVisible()
})

test('shows confirmation dialog when deleting shared object', async ({ page }) => {
  await page.goto('/import')
  await page.getByLabel('Paste JSON').fill(JSON.stringify({
    '@type': 'Catalog',
    title: 'Test Catalog',
    dataset: [
      {
        '@type': 'Dataset',
        title: 'Dataset 1',
        contactPoint: { '@type': 'Kind', fn: 'Shared Contact' }
      },
      {
        '@type': 'Dataset',
        title: 'Dataset 2',
        contactPoint: { '@type': 'Kind', fn: 'Shared Contact' }
      }
    ]
  }))
  await page.getByRole('button', { name: 'Load pasted JSON' }).click()

  await page.getByRole('treeitem', { name: /Shared Contact/ }).first().click()
  await page.getByRole('button', { name: 'Delete object' }).click()

  const dialog = page.getByRole('dialog', { name: /Delete shared object/ })
  await expect(dialog).toBeVisible()
  await expect(dialog).toContainText('This object is used in 2 places')
  await expect(dialog).toContainText('Dataset 1')
  await expect(dialog).toContainText('Dataset 2')
})

test('cancels shared object deletion', async ({ page }) => {
  await page.goto('/import')
  await page.getByLabel('Paste JSON').fill(JSON.stringify({
    '@type': 'Catalog',
    title: 'Test Catalog',
    dataset: [
      {
        '@type': 'Dataset',
        title: 'Dataset 1',
        contactPoint: { '@type': 'Kind', fn: 'Shared Contact' }
      },
      {
        '@type': 'Dataset',
        title: 'Dataset 2',
        contactPoint: { '@type': 'Kind', fn: 'Shared Contact' }
      }
    ]
  }))
  await page.getByRole('button', { name: 'Load pasted JSON' }).click()

  await page.getByRole('treeitem', { name: /Shared Contact/ }).first().click()
  await page.getByRole('button', { name: 'Delete object' }).click()

  const dialog = page.getByRole('dialog')
  await dialog.getByRole('button', { name: 'Cancel' }).click()

  await expect(dialog).not.toBeVisible()
  await expect(page.getByRole('treeitem', { name: /Shared Contact/ }).first()).toBeVisible()
})

test('confirms and completes shared object deletion', async ({ page }) => {
  await page.goto('/import')
  await page.getByLabel('Paste JSON').fill(JSON.stringify({
    '@type': 'Catalog',
    title: 'Test Catalog',
    dataset: [
      {
        '@type': 'Dataset',
        title: 'Dataset 1',
        contactPoint: { '@type': 'Kind', fn: 'Shared Contact' }
      },
      {
        '@type': 'Dataset',
        title: 'Dataset 2',
        contactPoint: { '@type': 'Kind', fn: 'Shared Contact' }
      }
    ]
  }))
  await page.getByRole('button', { name: 'Load pasted JSON' }).click()

  await page.getByRole('treeitem', { name: /Shared Contact/ }).first().click()
  await page.getByRole('button', { name: 'Delete object' }).click()

  const dialog = page.getByRole('dialog')
  await dialog.getByRole('button', { name: 'Delete' }).click()

  await expect(dialog).not.toBeVisible()
  await expect(page.getByRole('treeitem', { name: /Shared Contact/ })).not.toBeVisible()
  await expect(page).toHaveURL('/editor')
})

test('undoes link removal', async ({ page }) => {
  await loadSample(page)
  await page.getByRole('treeitem', { name: /Air quality readings/ }).click()

  const keywordSection = page.getByRole('region', { name: 'Keyword' })
  const firstInput = keywordSection.getByRole('textbox').first()
  const firstKeyword = await firstInput.inputValue()

  await keywordSection.getByRole('listitem').first().getByRole('button', { name: /Remove/ }).click()
  await expect(keywordSection.getByRole('textbox', { name: firstKeyword })).not.toBeVisible()

  await page.getByRole('button', { name: 'Undo' }).click()

  await expect(keywordSection.getByRole('textbox').first()).toHaveValue(firstKeyword)
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

  const catalog = page.getByRole('treeitem', { name: /Catalog/ }).first()
  await expect(catalog).toBeFocused()
})

test('keyboard navigation works for remove buttons', async ({ page }) => {
  await loadSample(page)
  await page.getByRole('treeitem', { name: /Air quality readings/ }).click()

  const keywordSection = page.getByRole('region', { name: 'Keyword' })
  const removeButton = keywordSection.getByRole('listitem').first().getByRole('button', { name: /Remove/ })

  await removeButton.focus()
  await page.keyboard.press('Enter')

  await expect(keywordSection.getByRole('listitem')).toHaveCount(1)
})

test('screen reader announces removal confirmation dialog', async ({ page }) => {
  await page.goto('/import')
  await page.getByLabel('Paste JSON').fill(JSON.stringify({
    '@type': 'Catalog',
    title: 'Test Catalog',
    dataset: [
      {
        '@type': 'Dataset',
        title: 'Dataset 1',
        contactPoint: { '@type': 'Kind', fn: 'Shared Contact' }
      },
      {
        '@type': 'Dataset',
        title: 'Dataset 2',
        contactPoint: { '@type': 'Kind', fn: 'Shared Contact' }
      }
    ]
  }))
  await page.getByRole('button', { name: 'Load pasted JSON' }).click()

  await page.getByRole('treeitem', { name: /Shared Contact/ }).first().click()
  await page.getByRole('button', { name: 'Delete object' }).click()

  const dialog = page.getByRole('dialog')
  await expect(dialog).toHaveAttribute('aria-modal', 'true')
  await expect(dialog).toHaveAttribute('aria-labelledby')

  const focusedElement = page.locator(':focus')
  await expect(focusedElement).toBeVisible()
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
