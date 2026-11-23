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
  // Check ordering was preserved
  expect(loaded!.objects.map((object) => object.id)).toEqual(expected.objects.map((object) => object.id))
  for (const [index, object] of expected.objects.entries()) {
    expect(Object.keys(loaded!.objects[index].properties)).toEqual(Object.keys(object.properties))
    expect(Object.keys(loaded!.objects[index].links)).toEqual(Object.keys(object.links))
    expect(loaded!.objects[index].singleLinks).toEqual(object.singleLinks)
  }
})

test('CatalogRepository saves edits and loads the edited catalog using real IndexedDB', async ({ page }) => {
  // Load a catalog into memory from the db
  const original = await page.evaluate(() => catalogRepository.fixture())
  await page.evaluate((value) => catalogRepository.create(value), original)
  const loaded = (await page.evaluate((id) => catalogRepository.load(id), original.id))!

  // Edit the in-memory catalog
  const root = loaded.objects.find((object) => object.id === loaded.rootId)!
  const dataset = loaded.objects.find((object) => object.properties.title === 'Air quality readings')!
  const api = loaded.objects.find((object) => object.properties.title === 'Readings API')!
  const csv = loaded.objects.find((object) => object.properties.title === 'Readings as CSV')!
  dataset.properties.title = 'Edited air quality readings'
  // Reversing two children proves save/load preserves link-array order, not merely membership.
  dataset.links.distribution = [api.id, csv.id]
  // An empty link has no reference records, so its position proves link-property order is stored on the object.
  dataset.links.relation = []
  root.links.dataset = [dataset.id]

  // Save the edited catalog and reload from the db
  await page.evaluate((value) => catalogRepository.save(value), loaded)
  const restored = await page.evaluate((id) => catalogRepository.load(id), original.id)

  // Confirm that the db copy received the edits
  expect(restored).toEqual(loaded)
  const restoredDataset = restored!.objects.find((object) => object.properties.title === 'Edited air quality readings')!
  expect(restoredDataset.links.distribution).toEqual([api.id, csv.id])
  expect(Object.keys(restoredDataset.links)).toEqual(Object.keys(dataset.links))
  expect(restoredDataset.links.relation).toEqual([])
})
