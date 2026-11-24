import { test, expect, type Page } from '@playwright/test'
import type { SerializableCatalogWorkspace } from './harness'

const harnessPort = Number(process.env.STORAGE_TEST_PORT ?? 4174)
const harness = `http://127.0.0.1:${harnessPort}/integration/storage/index.html`

/** Reopens the harness with the app's migrations plus these test ones, closing this page's older connection. */
const upgradeTo = (page: Page, migrations: string[]) => page.goto(`${harness}?migrations=${migrations.join(',')}`)

/** The same graph, with objects, property keys, link keys and single links in the same order. */
function expectSameGraph(actual: SerializableCatalogWorkspace | undefined, expected: SerializableCatalogWorkspace) {
  expect(actual).toEqual(expected)
  expect(actual!.objects.map((object) => object.id)).toEqual(expected.objects.map((object) => object.id))
  for (const [index, object] of expected.objects.entries()) {
    expect(Object.keys(actual!.objects[index].properties)).toEqual(Object.keys(object.properties))
    expect(Object.keys(actual!.objects[index].links)).toEqual(Object.keys(object.links))
    expect(actual!.objects[index].singleLinks).toEqual(object.singleLinks)
  }
}

test.beforeEach(async ({ page }) => {
  await page.goto(harness)
})

test('IndexedDbCatalogRepository creates and loads the same catalog using real IndexedDB', async ({ page }) => {
  const expected = await page.evaluate(() => catalogRepository.fixture())

  await page.evaluate((value) => catalogRepository.create(value), expected)
  const loaded = await page.evaluate((id) => catalogRepository.load(id), expected.id)

  expectSameGraph(loaded, expected)
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

test('IndexedDbCatalogRepository upgrades a catalog saved under an older schema, running each migration in order', async ({ page }) => {
  const saved = await page.evaluate(() => catalogRepository.fixture())
  await page.evaluate((value) => catalogRepository.create(value), saved)

  await upgradeTo(page, ['indexObjectsByClass', 'stampCatalogs'])
  const loaded = await page.evaluate((id) => catalogRepository.load(id), saved.id)

  expect(await page.evaluate(() => catalogRepository.migrationLog)).toEqual(['indexObjectsByClass', 'stampCatalogs'])
  expect(await page.evaluate(() => catalogRepository.databaseSchema())).toEqual({
    version: 3,
    objectIndexes: ['catalogId', 'dcatClass'],
  })
  expect(await page.evaluate((id) => catalogRepository.storedCatalogRecord(id), saved.id)).toMatchObject({ migrated: true })
  expectSameGraph(loaded, saved)
})

test('IndexedDbCatalogRepository runs only the migrations newer than the saved schema', async ({ page }) => {
  await upgradeTo(page, ['indexObjectsByClass'])
  const saved = await page.evaluate(() => catalogRepository.fixture())
  await page.evaluate((value) => catalogRepository.create(value), saved)

  await upgradeTo(page, ['indexObjectsByClass', 'stampCatalogs'])
  await page.evaluate((id) => catalogRepository.load(id), saved.id)

  expect(await page.evaluate(() => catalogRepository.migrationLog)).toEqual(['stampCatalogs'])
})

test('IndexedDbCatalogRepository saves edits to a catalog after upgrading it', async ({ page }) => {
  const saved = await page.evaluate(() => catalogRepository.fixture())
  await page.evaluate((value) => catalogRepository.create(value), saved)
  await upgradeTo(page, ['indexObjectsByClass', 'stampCatalogs'])
  const loaded = (await page.evaluate((id) => catalogRepository.load(id), saved.id))!

  const dataset = loaded.objects.find((object) => object.properties.title === 'Air quality readings')!
  dataset.properties.title = 'Edited after upgrade'
  dataset.links.distribution.reverse()
  await page.evaluate((value) => catalogRepository.save(value), loaded)
  await page.reload()

  expectSameGraph(await page.evaluate((id) => catalogRepository.load(id), saved.id), loaded)
})

test('IndexedDbCatalogRepository aborts an upgrade that cannot migrate a saved record, keeping the database as it was', async ({
  page,
}) => {
  const logs: string[] = []
  page.on('console', (message) => logs.push(message.text()))
  const saved = await page.evaluate(() => catalogRepository.fixture())
  await page.evaluate((value) => catalogRepository.create(value), saved)
  const stored = await page.evaluate((id) => catalogRepository.storedCatalogRecord(id), saved.id)
  const corrupt = { ...(stored as object), rootId: 42 }
  await page.evaluate((record) => catalogRepository.putStoredCatalogRecord(record), corrupt)

  await upgradeTo(page, ['indexObjectsByClass', 'requireRootIds'])
  const error = await page.evaluate((id) => catalogRepository.loadError(id), saved.id)

  expect(error).toEqual({
    code: 'upgrade-failed',
    message: expect.stringMatching(/could not be upgraded.*not been changed or deleted/s),
  })
  expect(await page.evaluate(() => catalogRepository.databaseSchema())).toEqual({ version: 1, objectIndexes: ['catalogId'] })
  expect(await page.evaluate((id) => catalogRepository.storedCatalogRecord(id), saved.id)).toEqual(corrupt)
  expect(logs.join('\n')).not.toContain(saved.sourceName)
})

test('IndexedDbCatalogRepository reports an upgrade blocked by another tab, and upgrades once that tab closes', async ({
  page,
  context,
}) => {
  const saved = await page.evaluate(() => catalogRepository.fixture())
  await page.evaluate((value) => catalogRepository.create(value), saved)
  await page.evaluate(() => catalogRepository.holdOlderConnection())
  const stored = await page.evaluate((id) => catalogRepository.storedCatalogRecord(id), saved.id)

  const newer = await context.newPage()
  await upgradeTo(newer, ['indexObjectsByClass'])
  const error = await newer.evaluate((id) => catalogRepository.loadError(id), saved.id)

  expect(error).toEqual({ code: 'blocked', message: expect.stringMatching(/another tab.*close or reload/is) })
  expect(await page.evaluate((id) => catalogRepository.readOlderConnection(id), saved.id)).toEqual({
    version: 1,
    catalog: stored,
  })

  await page.close()
  expectSameGraph(await newer.evaluate((id) => catalogRepository.load(id), saved.id), saved)
})
