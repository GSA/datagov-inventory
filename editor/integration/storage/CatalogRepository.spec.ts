import { test, expect } from '@playwright/test'

const harnessPort = Number(process.env.STORAGE_TEST_PORT ?? 4174)
const harness = `http://127.0.0.1:${harnessPort}/integration/storage/index.html`

test.beforeEach(async ({ page }) => {
  await page.goto(harness)
})

test('CatalogRepository creates and loads the same catalog using real IndexedDB', async ({ page }) => {
  const expected = await page.evaluate(() => catalogRepository.fixture())

  await page.evaluate((value) => catalogRepository.create(value), expected)
  const loaded = await page.evaluate((id) => catalogRepository.load(id), expected.id)

  expect(loaded).toEqual(expected)
})

test('CatalogRepository saves edits and loads the edited catalog using real IndexedDB', async ({ page }) => {
  const original = await page.evaluate(() => catalogRepository.fixture())
  await page.evaluate((value) => catalogRepository.create(value), original)
  const loaded = (await page.evaluate((id) => catalogRepository.load(id), original.id))!
  const root = loaded.objects.find((object) => object.id === loaded.rootId)!
  const dataset = loaded.objects.find((object) => object.properties.title === 'Air quality readings')!
  const api = loaded.objects.find((object) => object.properties.title === 'Readings API')!
  const csv = loaded.objects.find((object) => object.properties.title === 'Readings as CSV')!
  dataset.properties.title = 'Edited air quality readings'
  // Reversing two children proves save/load preserves link-array order, not merely membership.
  dataset.links.distribution = [api.id, csv.id]
  root.links.dataset = [dataset.id]

  await page.evaluate((value) => catalogRepository.save(value), loaded)
  const restored = await page.evaluate((id) => catalogRepository.load(id), original.id)

  expect(restored).toEqual(loaded)
  const restoredDataset = restored!.objects.find((object) => object.properties.title === 'Edited air quality readings')!
  expect(restoredDataset.links.distribution).toEqual([api.id, csv.id])
})
