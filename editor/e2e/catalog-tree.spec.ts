import type { Locator, Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { test, expect } from './fixtures'
import { largeCatalog } from '../fixtures/largeCatalog'

const tree = (page: Page) => page.getByRole('tree', { name: 'Catalog' })
/** A row by its label, field and class; a closed row's name also ends with how many items it holds. */
const item = (page: Page, name: string) =>
  tree(page).getByRole('treeitem', { name: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}( · [\\d,]+ items?)?$`) })
const filter = (page: Page) => page.getByLabel('Filter by title or name')

async function loadSample(page: Page) {
  await page.goto('/import')
  await page.getByLabel('Sample catalog').selectOption('dataset-with-distributions.json')
  await page.getByRole('button', { name: 'Load sample' }).click()
  await expect(page).toHaveURL(/\/editor\/[A-Za-z0-9_-]{22}$/)
}

test('browses the catalog tree with the mouse and the keyboard', async ({ page }) => {
  await loadSample(page)
  const catalog = item(page, 'Example Agency Catalog')
  const dataset = item(page, 'Air quality readings Dataset')
  const csv = item(page, 'Readings as CSV Distribution')

  // The catalog is open, and lists its own objects; the dataset is closed.
  await expect(tree(page).getByRole('treeitem')).toHaveText([
    'Example Agency Catalog',
    'Example Agency Publisher · Organization',
    'Air quality readings Dataset · 5 items',
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
  await expect(item(page, 'Air Quality Team Contact point · Contact')).toBeFocused()
  await expect(item(page, 'Air Quality Team Contact point · Contact')).toHaveAttribute('aria-level', '3')
  for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowDown')
  await expect(csv).toBeFocused()

  // Enter opens the object on the right, and focus stays in the tree.
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/\/editor\/[A-Za-z0-9_-]{22}\/distribution\/[A-Za-z0-9_-]{22}$/)
  await expect(page.getByRole('heading', { level: 2, name: 'Readings as CSV' })).toBeVisible()
  await expect(csv).toHaveAttribute('aria-selected', 'true')
  await expect(catalog).toHaveAttribute('aria-selected', 'false')
  await expect(csv).toBeFocused()

  // Left closes an open object, then moves to the object above; Home and End go to the first and last row.
  await page.keyboard.press('ArrowRight')
  await expect(item(page, 'Untitled Checksum Checksum')).toBeVisible()
  await page.keyboard.press('ArrowLeft')
  await expect(csv).toHaveAttribute('aria-expanded', 'false')
  await expect(item(page, 'Untitled Checksum Checksum')).toHaveCount(0)
  await page.keyboard.press('ArrowLeft')
  await expect(dataset).toBeFocused()
  await page.keyboard.press('End')
  await expect(item(page, 'Readings API Distribution')).toBeFocused()
  await page.keyboard.press('Home')
  await expect(catalog).toBeFocused()
  await page.keyboard.press(' ')
  await expect(page).toHaveURL(/\/editor\/[A-Za-z0-9_-]{22}$/)
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze()).violations).toEqual([])

  // A click on the arrow opens or closes; a click on the row opens the object.
  await dataset.locator('.catalog-tree__toggle').click()
  await expect(dataset).toHaveAttribute('aria-expanded', 'false')
  await expect(csv).toHaveCount(0)
  await item(page, 'Example Agency Publisher · Organization').click()
  await expect(page).toHaveURL(/\/editor\/[A-Za-z0-9_-]{22}\/organization\/[A-Za-z0-9_-]{22}$/)

  // Issue #24: Object reference links in forms are out of scope (blocked by #25).
  // This test would check that clicking a link in the detail pane opens the tree to that object.
  // Skipping until object references are implemented.
})

test('filters the tree by title or name', async ({ page }) => {
  await loadSample(page)
  await filter(page).fill('READINGS')
  await expect(page.getByRole('status').filter({ hasText: 'match' })).toHaveText('3 objects match.')
  // Each match, with the objects above it, open.
  await expect(tree(page).getByRole('treeitem')).toHaveText([
    'Example Agency Catalog',
    'Air quality readings Dataset',
    'Readings as CSV Distribution',
    'Readings API Distribution',
  ])
  await item(page, 'Readings API Distribution').click()
  await expect(page).toHaveURL(/\/editor\/[A-Za-z0-9_-]{22}\/distribution\/[A-Za-z0-9_-]{22}$/)

  await filter(page).fill('nothing like this')
  await expect(page.getByRole('status').filter({ hasText: 'match' })).toHaveText('No objects match. Try part of a title or name.')
  await expect(tree(page)).toHaveCount(0)

  await filter(page).fill('')
  // As before filtering, but with the dataset of the object opened while filtering open too.
  await expect(tree(page).getByRole('treeitem')).toHaveText([
    'Example Agency Catalog',
    'Example Agency Publisher · Organization',
    'Air quality readings Dataset',
    'Air Quality Team Contact point · Contact',
    'Example Agency Publisher · Organization',
    'Untitled Period of Time Temporal · Period of Time',
    'Readings as CSV Distribution · 1 item',
    'Readings API Distribution',
  ])
})

test('marks the place a shared object was opened in, and outlines its other places', async ({ page }) => {
  await loadSample(page)
  // Share the dataset's contact with the catalog.
  await page.getByRole('group', { name: /^Contact point( \*)?$/ }).getByRole('combobox').fill('air')
  await page.getByRole('option', { name: /Air Quality Team/ }).click()
  await item(page, 'Air quality readings Dataset').locator('.catalog-tree__toggle').click()
  const places = tree(page).getByRole('treeitem', { name: 'Air Quality Team Contact point · Contact Shared · 2 places' })
  await expect(places).toHaveCount(2)
  const [inDataset, inCatalog] = [places.first(), places.last()]
  await expect(inDataset).toHaveAttribute('aria-level', '3')
  await expect(inCatalog).toHaveAttribute('aria-level', '2')
  await expect(tree(page).locator('.catalog-tree__shared')).toHaveCount(2)

  // A click selects that row only; the other place is outlined as the same object, and is not selected.
  await inCatalog.click()
  await expect(inCatalog).toHaveAttribute('aria-selected', 'true')
  await expect(inDataset).toHaveAttribute('aria-selected', 'false')
  await expect(inDataset).toHaveClass('catalog-tree__same')
  await expect(inCatalog).not.toHaveClass('catalog-tree__same')
  await expect(tree(page).getByRole('treeitem', { selected: true })).toHaveCount(1)
  await expect(inCatalog).toHaveAttribute('tabindex', '0')

  // Enter on the other place moves the selection there.
  await inDataset.focus()
  await page.keyboard.press('Enter')
  await expect(inDataset).toHaveAttribute('aria-selected', 'true')
  await expect(inCatalog).toHaveAttribute('aria-selected', 'false')
  await expect(inCatalog).toHaveClass('catalog-tree__same')

  // Opened from a parent's form, the place under that parent is the selected one.
  await item(page, 'Example Agency Catalog').click()
  await page.getByRole('group', { name: /^Contact point( \*)?$/ }).getByRole('link', { name: 'Air Quality Team' }).click()
  await expect(inCatalog).toHaveAttribute('aria-selected', 'true')
  await expect(inDataset).toHaveClass('catalog-tree__same')
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze()).violations).toEqual([])
})

test('counts the items in a closed row, and lines up each level', async ({ page }) => {
  await loadSample(page)
  const dataset = item(page, 'Air quality readings Dataset')
  await expect(dataset.locator('.catalog-tree__count')).toHaveText('· 5 items')
  await dataset.locator('.catalog-tree__toggle').click()
  await expect(dataset).toHaveAttribute('aria-expanded', 'true')
  await expect(dataset.locator('.catalog-tree__count')).toHaveCount(0)
  await expect(item(page, 'Readings as CSV Distribution').locator('.catalog-tree__count')).toHaveText('· 1 item')

  // Leaves keep the arrow's place, so their labels start where their expandable siblings' do.
  const left = (name: string) => item(page, name).first().locator('bdi').evaluate((bdi) => bdi.getBoundingClientRect().left)
  expect(await left('Example Agency Publisher · Organization')).toBe(await left('Air quality readings Dataset'))
  expect(await left('Readings API Distribution')).toBe(await left('Readings as CSV Distribution'))
  expect(await left('Air Quality Team Contact point · Contact')).toBeGreaterThan(await left('Air quality readings Dataset'))
})

test('cuts a long label to one line, and keeps all of it in the name and on hover', async ({ page }) => {
  await loadSample(page)
  const long = 'Hourly ambient air quality readings from every monitoring station in the region, 2010 to present'
  await item(page, 'Air quality readings Dataset').click()
  const title = page.getByRole('textbox', { name: /^Title/ })
  await title.fill(long)
  await title.blur()
  const row = item(page, `${long} Dataset`)
  await expect(row).toBeVisible()
  const label = row.locator('bdi')
  await expect(label).toHaveAttribute('title', long)
  await expect(label).toHaveCSS('text-overflow', 'ellipsis')
  expect(await label.evaluate((bdi) => bdi.scrollWidth > bdi.clientWidth)).toBe(true)
  // One line: as tall as a short row.
  const height = (name: string) => item(page, name).evaluate((li) => li.getBoundingClientRect().height)
  expect(await height(`${long} Dataset`)).toBe(await height('Example Agency Publisher · Organization'))
})

test('opens an object in a 3,000-dataset catalog and limits a filter that matches thousands', async ({ page }) => {
  await page.goto('/import')
  await page.getByLabel('Choose a DCAT-US 3.0 JSON file').setInputFiles({
    name: 'large.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(largeCatalog())),
  })
  await expect(page).toHaveURL(/\/editor\/[A-Za-z0-9_-]{22}$/)
  await expect(tree(page).getByRole('treeitem')).toHaveCount(1 + 3_000)

  await filter(page).fill('json download')
  await expect(page.getByRole('status').filter({ hasText: 'match' })).toHaveText(
    '3,000 objects match. Showing the first 200: type more to narrow them down.',
  )
  await expect(tree(page).getByRole('treeitem')).toHaveCount(1 + 200 * 2)
  await filter(page).fill('water use 2995')
  await expect(tree(page).getByRole('treeitem')).toHaveText([
    'Generated catalog of 3,000 datasets',
    'Water use 2995 Dataset',
  ])
  // Opened while filtering, it is still in view once the filter is cleared.
  await item(page, 'Water use 2995 Dataset').click()
  await expect(page).toHaveURL(/\/editor\/[A-Za-z0-9_-]{22}\/dataset\/[A-Za-z0-9_-]{22}$/)
  await filter(page).fill('')
  const dataset = item(page, 'Water use 2995 Dataset')
  await dataset.locator('.catalog-tree__toggle').click()
  await item(page, 'JSON download Distribution').click()
  await expect(page).toHaveURL(/\/editor\/[A-Za-z0-9_-]{22}\/distribution\/[A-Za-z0-9_-]{22}$/)
  const selected = tree(page).getByRole('treeitem', { selected: true })
  await expect(tree(page).getByRole('treeitem')).toHaveCount(1 + 3_000 + 5)
  await expect(selected).toHaveText('JSON download Distribution')
  await expectInTreeView(page, selected)
})

/** The row is within the tree's visible area (the tree scrolls on its own). */
async function expectInTreeView(page: Page, row: Locator) {
  await expect(async () => {
    const [box, pane] = await Promise.all([row.boundingBox(), page.locator('.catalog-tree').boundingBox()])
    expect(box!.y).toBeGreaterThanOrEqual(pane!.y)
    expect(box!.y + box!.height).toBeLessThanOrEqual(pane!.y + pane!.height)
  }).toPass()
}
