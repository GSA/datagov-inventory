import { test, expect } from '@playwright/test'

const harnessPort = Number(process.env.STORAGE_TEST_PORT ?? 4174)
const harness = `http://127.0.0.1:${harnessPort}/integration/storage/index.html`

test.beforeEach(async ({ page }) => {
  await page.goto(harness)
})

test('IndexedDbCatalogRepository creates and loads the same catalog using real IndexedDB', async ({ page }) => {
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

test('IndexedDbCatalogRepository saves edits and loads the edited catalog using real IndexedDB', async ({ page }) => {
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

test('IndexedDbCatalogRepository returns undefined for an unknown catalog', async ({ page }) => {
  const loaded = await page.evaluate(() => catalogRepository.load('00000000-0000-4000-8000-000000000000'))

  expect(loaded).toBeUndefined()
})

test('IndexedDbCatalogRepository saves a new object and reference', async ({ page }) => {
  const original = await page.evaluate(() => catalogRepository.fixture())
  await page.evaluate((value) => catalogRepository.create(value), original)
  const loaded = (await page.evaluate((id) => catalogRepository.load(id), original.id))!
  const dataset = loaded.objects.find((object) => object.properties.title === 'Air quality readings')!
  const added = {
    id: '00000000-0000-4000-8000-999999999998',
    dcatClass: 'Distribution',
    properties: { '@type': 'Distribution', title: 'Added distribution' },
    links: {},
    singleLinks: [],
  }
  loaded.objects.push(added)
  dataset.links.distribution.push(added.id)

  await page.evaluate((value) => catalogRepository.save(value), loaded)
  const restored = await page.evaluate((id) => catalogRepository.load(id), loaded.id)

  expect(restored).toEqual(loaded)
  expect(restored!.objects.at(-1)).toEqual(added)
  expect(restored!.objects.find((object) => object.id === dataset.id)!.links.distribution.at(-1)).toBe(added.id)
})

test('IndexedDbCatalogRepository deletes objects and references during save', async ({ page }) => {
  const original = await page.evaluate(() => catalogRepository.fixture())
  await page.evaluate((value) => catalogRepository.create(value), original)
  const loaded = (await page.evaluate((id) => catalogRepository.load(id), original.id))!
  const dataset = loaded.objects.find((object) => object.properties.title === 'Air quality readings')!
  const csv = loaded.objects.find((object) => object.properties.title === 'Readings as CSV')!
  const checksumId = csv.links.checksum[0]
  dataset.links.distribution = dataset.links.distribution.filter((id) => id !== csv.id)
  loaded.objects = loaded.objects.filter((object) => object.id !== csv.id && object.id !== checksumId)

  await page.evaluate((value) => catalogRepository.save(value), loaded)
  const restored = await page.evaluate((id) => catalogRepository.load(id), loaded.id)

  expect(restored).toEqual(loaded)
  expect(restored!.objects.some((object) => object.id === csv.id || object.id === checksumId)).toBe(false)
  expect(restored!.objects.find((object) => object.id === dataset.id)!.links.distribution).toHaveLength(1)
})

test('lists saved catalogs by most recent save without loading their graphs', async ({ page }) => {
  const first = await page.evaluate(() => catalogRepository.fixture())
  const second = structuredClone(first)
  second.id = '00000000-0000-4000-8000-999999999997'
  second.sourceName = 'second.json'
  second.objects.find((object) => object.id === second.rootId)!.properties.title = 'Second catalog'

  await page.evaluate((value) => catalogRepository.create(value), first)
  await page.waitForTimeout(5)
  await page.evaluate((value) => catalogRepository.create(value), second)

  const catalogs = await page.evaluate(() => catalogRepository.list())
  expect(catalogs.map(({ id }) => id)).toEqual([second.id, first.id])
  expect(catalogs[0]).toMatchObject({ title: 'Second catalog', sourceName: 'second.json' })
  expect(catalogs[0].objectCount).toBe(second.objects.length)
  expect(catalogs[0].createdAt).toBeGreaterThan(0)
})

test('deletes selected catalogs and all of their scoped records', async ({ page }) => {
  const first = await page.evaluate(() => catalogRepository.fixture())
  const second = structuredClone(first)
  second.id = '00000000-0000-4000-8000-999999999997'
  await page.evaluate((values) => Promise.all(values.map((value) => catalogRepository.create(value))), [first, second])

  await page.evaluate((id) => catalogRepository.delete([id]), first.id)

  expect(await page.evaluate((id) => catalogRepository.load(id), first.id)).toBeUndefined()
  expect(await page.evaluate((id) => catalogRepository.load(id), second.id)).toEqual(second)
  expect(await page.evaluate(() => catalogRepository.list())).toHaveLength(1)
})

test('deletes every saved catalog', async ({ page }) => {
  const first = await page.evaluate(() => catalogRepository.fixture())
  const second = structuredClone(first)
  second.id = '00000000-0000-4000-8000-999999999997'
  await page.evaluate((values) => Promise.all(values.map((value) => catalogRepository.create(value))), [first, second])

  await page.evaluate(() => catalogRepository.deleteAll())
  expect(await page.evaluate(() => catalogRepository.list())).toEqual([])
  expect(await page.evaluate((id) => catalogRepository.load(id), first.id)).toBeUndefined()
  expect(await page.evaluate((id) => catalogRepository.load(id), second.id)).toBeUndefined()
})
