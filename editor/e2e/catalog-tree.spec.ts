import type { Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { test, expect } from './fixtures'
import { largeCatalog } from '../fixtures/largeCatalog'

const tree = (page: Page) => page.getByRole('tree', { name: 'Catalog' })
const item = (page: Page, name: string) => tree(page).getByRole('treeitem', { name, exact: true })
const filter = (page: Page) => page.getByLabel('Filter by title or name')

async function loadSample(page: Page) {
  await page.goto('/import')
  await page.getByLabel('Sample catalog').selectOption('dataset-with-distributions.json')
  await page.getByRole('button', { name: 'Load sample' }).click()
  await expect(page).toHaveURL('/editor')
}

test('browses the catalog tree with the mouse and the keyboard', async ({ page }) => {
  await loadSample(page)
  const catalog = item(page, 'Example Agency Catalog')
  const dataset = item(page, 'Air quality readings dataset · Dataset')
  const csv = item(page, 'Readings as CSV distribution · Distribution')

  // The catalog is open, and lists its own objects; the dataset is closed.
  await expect(tree(page).getByRole('treeitem')).toHaveText([
    'Example Agency Catalog',
    'Example Agency publisher · Organization',
    'Air quality readings dataset · Dataset',
  ])
  await expect(catalog).toHaveAttribute('aria-level', '1')
  await expect(catalog).toHaveAttribute('aria-expanded', 'true')
  await expect(catalog).toHaveAttribute('aria-selected', 'true')
  await expect(dataset).toHaveAttribute('aria-level', '2')
  await expect(dataset).toHaveAttribute('aria-posinset', '2')
  await expect(dataset).toHaveAttribute('aria-setsize', '2')
  await expect(dataset).toHaveAttribute('aria-expanded', 'false')

  // One tab stop: the selected object.
  await filter(page).focus()
  await page.keyboard.press('Tab')
  await expect(catalog).toBeFocused()
  await expect(tree(page).locator('[tabindex="0"]')).toHaveCount(1)

  // Down moves; Right opens a closed object, then moves into it.
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('ArrowDown')
  await expect(dataset).toBeFocused()
  await page.keyboard.press('ArrowRight')
  await expect(dataset).toHaveAttribute('aria-expanded', 'true')
  await expect(dataset).toBeFocused()
  await page.keyboard.press('ArrowRight')
  await expect(item(page, 'Air Quality Team contactPoint · Kind')).toBeFocused()
  await expect(item(page, 'Air Quality Team contactPoint · Kind')).toHaveAttribute('aria-level', '3')
  for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowDown')
  await expect(csv).toBeFocused()

  // Enter opens the object on the right, and focus stays in the tree.
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL('/editor/dataset/0/distribution/0')
  await expect(page.getByRole('heading', { level: 2, name: 'Readings as CSV' })).toBeVisible()
  await expect(csv).toHaveAttribute('aria-selected', 'true')
  await expect(catalog).toHaveAttribute('aria-selected', 'false')
  await expect(csv).toBeFocused()

  // Left closes an open object, then moves to the object above; Home and End go to the first and last row.
  await page.keyboard.press('ArrowRight')
  await expect(item(page, 'Untitled Checksum checksum · Checksum')).toBeVisible()
  await page.keyboard.press('ArrowLeft')
  await expect(csv).toHaveAttribute('aria-expanded', 'false')
  await expect(item(page, 'Untitled Checksum checksum · Checksum')).toHaveCount(0)
  await page.keyboard.press('ArrowLeft')
  await expect(dataset).toBeFocused()
  await page.keyboard.press('End')
  await expect(item(page, 'Readings API distribution · Distribution')).toBeFocused()
  await page.keyboard.press('Home')
  await expect(catalog).toBeFocused()
  await page.keyboard.press(' ')
  await expect(page).toHaveURL('/editor')
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze()).violations).toEqual([])

  // A click on the arrow opens or closes; a click on the row opens the object.
  await dataset.locator('.catalog-tree__toggle').click()
  await expect(dataset).toHaveAttribute('aria-expanded', 'false')
  await expect(csv).toHaveCount(0)
  await item(page, 'Example Agency publisher · Organization').click()
  await expect(page).toHaveURL('/editor/publisher')

  // Opening an object from a link elsewhere opens the tree down to it.
  await item(page, 'Air quality readings dataset · Dataset').click()
  await page.getByRole('region', { name: 'Air quality readings' }).getByRole('link', { name: /^Readings API/ }).click()
  await expect(item(page, 'Readings API distribution · Distribution')).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('heading', { level: 2, name: 'Readings API' })).toBeFocused()
})

test('filters the tree by title or name', async ({ page }) => {
  await loadSample(page)
  await filter(page).fill('READINGS')
  await expect(page.getByRole('status').filter({ hasText: 'match' })).toHaveText('3 objects match.')
  // Each match, with the objects above it, open.
  await expect(tree(page).getByRole('treeitem')).toHaveText([
    'Example Agency Catalog',
    'Air quality readings dataset · Dataset',
    'Readings as CSV distribution · Distribution',
    'Readings API distribution · Distribution',
  ])
  await item(page, 'Readings API distribution · Distribution').click()
  await expect(page).toHaveURL('/editor/dataset/0/distribution/1')

  await filter(page).fill('nothing like this')
  await expect(page.getByRole('status').filter({ hasText: 'match' })).toHaveText('0 objects match.')
  await expect(tree(page)).toHaveCount(0)

  await filter(page).fill('')
  // As before filtering, but with the dataset of the object opened while filtering open too.
  await expect(tree(page).getByRole('treeitem')).toHaveText([
    'Example Agency Catalog',
    'Example Agency publisher · Organization',
    'Air quality readings dataset · Dataset',
    'Air Quality Team contactPoint · Kind',
    'Example Agency publisher · Organization',
    'Untitled PeriodOfTime temporal · PeriodOfTime',
    'Readings as CSV distribution · Distribution',
    'Readings API distribution · Distribution',
  ])
})

test('opens a 3,000-dataset catalog at an object, and limits a filter that matches thousands', async ({ page }) => {
  // Imported from a bookmark of the object, so the editor opens there.
  await page.goto(`/import?next=${encodeURIComponent('/editor/dataset/2999/distribution/1')}`)
  await page.getByLabel('Choose a DCAT-US 3.0 JSON file').setInputFiles({
    name: 'large.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(largeCatalog())),
  })
  await expect(page).toHaveURL('/editor/dataset/2999/distribution/1')
  const selected = tree(page).getByRole('treeitem', { selected: true })
  await expect(selected).toHaveText('JSON download distribution · Distribution')
  // Scrolled into the tree's view (the tree scrolls on its own).
  const [row, pane] = await Promise.all([selected.boundingBox(), page.locator('.catalog-tree').boundingBox()])
  expect(row!.y).toBeGreaterThanOrEqual(pane!.y)
  expect(row!.y + row!.height).toBeLessThanOrEqual(pane!.y + pane!.height)
  await expect(tree(page).getByRole('treeitem')).toHaveCount(1 + 3_000 + 5)

  await filter(page).fill('json download')
  await expect(page.getByRole('status').filter({ hasText: 'match' })).toHaveText(
    '3,000 objects match. Showing the first 200: type more to narrow them down.',
  )
  await expect(tree(page).getByRole('treeitem')).toHaveCount(1 + 200 * 2)
  await filter(page).fill('water use 2995')
  await expect(tree(page).getByRole('treeitem')).toHaveText([
    'Generated catalog of 3,000 datasets',
    'Water use 2995 dataset · Dataset',
  ])
})
