import type { Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { fileURLToPath } from 'node:url'
import { test, expect } from './fixtures'

const fixture = (name: string, folder = 'valid') =>
  fileURLToPath(new URL(`../fixtures/catalogs/${folder}/${name}`, import.meta.url))

test.beforeEach(async ({ page }) => {
  const response = await page.goto('/import')
  expect(response?.headers()['content-security-policy']).toContain("connect-src 'none'")
})

/** The catalog tree's rows, as shown. */
const tree = (page: Page) => page.getByRole('tree', { name: 'Catalog' })
const treeRows = (page: Page) => tree(page).getByRole('treeitem').allInnerTexts()
const chooseFile = (page: Page, file: Parameters<Page['setInputFiles']>[1]) =>
  page.getByLabel('Choose a DCAT-US 3.0 JSON file').setInputFiles(file)
const axe = (page: Page) => new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
/** Goes back to the import page the way a user would, keeping the open catalog (a reload would close it). */
const toImport = (page: Page) => page.getByRole('link', { name: 'Import', exact: true }).click()

/** The editor has opened `name`, with focus on the catalog's heading. */
async function expectOpened(page: Page, name: string) {
  await expect(page).toHaveURL(/\/editor/)
  await expect(page.getByText(`From ${name} ·`)).toBeVisible()
  await expect(page.getByRole('heading', { level: 1 })).toBeFocused()
}

async function paste(page: Page, text: string) {
  await page.getByLabel('Paste JSON').fill(text)
  await page.getByRole('button', { name: 'Load pasted JSON' }).click()
}

async function loadSample(page: Page, name: string, { replacing = false } = {}) {
  await page.getByLabel('Sample catalog').selectOption(name)
  await page.getByRole('button', { name: 'Load sample' }).click()
  if (replacing) await page.getByRole('button', { name: 'Replace', exact: true }).click()
  await expectOpened(page, name)
}

/** Holds the parse worker's script until the returned function is called, so a load stays in progress. */
async function holdWorker(page: Page) {
  let release!: () => void
  const released = new Promise<void>((resolve) => (release = resolve))
  await page.route('**/parse.worker-*.js', async (route) => {
    await released
    await route.continue()
  })
  return release
}

test('imports a sample and opens each object at its own address', async ({ page }) => {
  await loadSample(page, 'dataset-with-distributions.json')
  await expect(page).toHaveURL('/editor')
  await expect(page).toHaveTitle('Example Agency Catalog (Catalog) | Inventory Editor')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Example Agency Catalog')
  // The catalog is open on the right, and selected in the tree on the left.
  await expect(page.locator('#detail-heading')).toHaveText('Example Agency Catalog')
  await expect(tree(page).getByRole('treeitem', { selected: true })).toHaveText('Example Agency Catalog')

  await tree(page).getByRole('treeitem', { name: 'Air quality readings dataset · Dataset' }).click()
  await expect(page).toHaveURL('/editor/dataset/0')
  await expect(page).toHaveTitle('Air quality readings (Dataset) | Inventory Editor')
  const detail = page.getByRole('region', { name: 'Air quality readings' })
  await expect(tree(page).getByRole('treeitem', { selected: true })).toHaveText('Air quality readings dataset · Dataset')
  // The tree is on the left and the selected object on the right (#20, James's comment).
  const list = await page.getByRole('navigation', { name: 'Catalog contents' }).boundingBox()
  const pane = await detail.boundingBox()
  expect(list!.x + list!.width).toBeLessThanOrEqual(pane!.x)
  await expect(detail.getByRole('table', { name: 'Properties' })).toContainText('example-air-quality')
  await expect(detail.getByRole('region', { name: 'Links' }).getByRole('listitem')).toHaveText([
    'Air Quality Team (Kind)',
    'Example Agency (Organization)',
    'Untitled PeriodOfTime (PeriodOfTime)',
    'Readings as CSV (Distribution)',
    'Readings API (Distribution)',
  ])

  // Following a link opens that object, with the path to it in a breadcrumb, and shows it in the tree.
  await detail.getByRole('link', { name: 'Readings as CSV (Distribution)' }).click()
  await expect(page).toHaveURL('/editor/dataset/0/distribution/0')
  const distribution = page.getByRole('region', { name: 'Readings as CSV' })
  await expect(distribution.getByRole('heading', { level: 2 })).toBeFocused()
  await expect(distribution.getByRole('navigation', { name: 'Where this object is' })).toHaveText(
    /Example Agency Catalog\s*Air quality readings\s*Readings as CSV/,
  )
  await expect(tree(page).getByRole('treeitem', { selected: true })).toHaveText(
    'Readings as CSV distribution · Distribution',
  )
  await distribution.getByRole('link', { name: 'Untitled Checksum (Checksum)' }).click()
  await expect(page.getByRole('region', { name: 'Untitled Checksum' })).toContainText('SHA-256')
  expect((await axe(page).analyze()).violations).toEqual([])

  // Back and forward work like any site.
  await page.goBack()
  await expect(page).toHaveURL('/editor/dataset/0/distribution/0')
  await page
    .getByRole('navigation', { name: 'Where this object is' })
    .getByRole('link', { name: 'Air quality readings' })
    .click()
  await expect(page).toHaveURL('/editor/dataset/0')

  // A reload closes the catalog (it is not stored yet); importing it again returns to the same address.
  await page.reload()
  await expect(page.getByRole('heading', { level: 1, name: 'No catalog open' })).toBeVisible()
  await page.getByRole('link', { name: 'Import a catalog' }).click()
  await page.getByLabel('Sample catalog').selectOption('dataset-with-distributions.json')
  await page.getByRole('button', { name: 'Load sample' }).click()
  await expect(page).toHaveURL('/editor/dataset/0')
  await expect(page.getByRole('region', { name: 'Air quality readings' })).toBeVisible()
})

test('shows every object above the open one in the breadcrumb, through single links too', async ({ page }) => {
  await loadSample(page, 'dataset-with-distributions.json')
  const breadcrumb = page.getByRole('navigation', { name: 'Where this object is' })
  const open = async (path: string) => {
    await page.evaluate((url) => {
      history.pushState({}, '', url)
      dispatchEvent(new PopStateEvent('popstate'))
    }, path)
  }

  // The catalog has nothing above it.
  await expect(breadcrumb).toHaveCount(0)
  // Each case: the object's path, then the breadcrumb's links (label, path) and the object's own label.
  const cases: [string, [string, string][], string][] = [
    ['/editor/publisher', [['Example Agency Catalog', '/editor']], 'Example Agency'], // single link from the catalog
    ['/editor/dataset/0', [['Example Agency Catalog', '/editor']], 'Air quality readings'], // list item
    [
      '/editor/dataset/0/publisher', // single link from a list item
      [['Example Agency Catalog', '/editor'], ['Air quality readings', '/editor/dataset/0']],
      'Example Agency',
    ],
    [
      '/editor/dataset/0/distribution/0', // list item in a list item
      [['Example Agency Catalog', '/editor'], ['Air quality readings', '/editor/dataset/0']],
      'Readings as CSV',
    ],
    [
      '/editor/dataset/0/distribution/0/checksum', // single link, two levels down
      [
        ['Example Agency Catalog', '/editor'],
        ['Air quality readings', '/editor/dataset/0'],
        ['Readings as CSV', '/editor/dataset/0/distribution/0'],
      ],
      'Untitled Checksum',
    ],
  ]
  for (const [path, above, label] of cases) {
    await open(path)
    await expect(page.getByRole('heading', { level: 2, name: label, exact: true })).toBeVisible()
    const links = breadcrumb.getByRole('link')
    await expect(links, path).toHaveText(above.map(([name]) => name))
    for (const [i, [, href]] of above.entries()) await expect(links.nth(i), path).toHaveAttribute('href', href)
    await expect(breadcrumb.getByRole('listitem').last(), path).toHaveText(label)
  }
})

test('shows an address with nothing at it in the open catalog', async ({ page }) => {
  await loadSample(page, 'minimal-catalog.json')
  await page.evaluate(() => {
    history.pushState({}, '', '/editor/dataset/9')
    dispatchEvent(new PopStateEvent('popstate'))
  })
  await expect(page.getByRole('heading', { name: 'Nothing at this address' })).toBeVisible()
  await page.getByRole('link', { name: 'Open the catalog' }).click()
  await expect(page).toHaveURL('/editor')
})

test('loads a chosen file in the browser', async ({ page }) => {
  await chooseFile(page, fixture('minimal-catalog.json'))
  await expectOpened(page, 'minimal-catalog.json')
  expect(await treeRows(page)).toEqual(['Untitled Catalog', 'Minimal dataset dataset · Dataset'])
})

test('a newer load cancels a file still being read', async ({ page }) => {
  // Hold every file read for a second and count aborts, so the newer load starts while the file is still reading.
  await page.evaluate(() => {
    const counted = window as unknown as { aborts: number }
    counted.aborts = 0
    const read = FileReader.prototype.readAsArrayBuffer
    FileReader.prototype.readAsArrayBuffer = function (blob: Blob) {
      const timer = setTimeout(() => read.call(this, blob), 1_000)
      this.addEventListener('abort', () => clearTimeout(timer))
    }
    const abort = FileReader.prototype.abort
    FileReader.prototype.abort = function () {
      counted.aborts++
      abort.call(this)
      this.dispatchEvent(new ProgressEvent('abort')) // the held read has not started, so dispatch it ourselves
    }
  })
  await chooseFile(page, fixture('minimal-catalog.json'))
  await loadSample(page, 'dataset-with-distributions.json')
  expect(await page.evaluate(() => (window as unknown as { aborts: number }).aborts)).toBe(1)
  await page.waitForTimeout(1_500) // past the held read: the cancelled file must not replace the sample
  await expect(page.getByText('From dataset-with-distributions.json ·')).toBeVisible()
  await expect(page.getByRole('alert')).toHaveCount(0)
})

test('starts a blank catalog', async ({ page }) => {
  await page.getByRole('button', { name: 'Start a blank catalog' }).click()
  await expectOpened(page, 'Blank catalog')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Untitled Catalog')
  expect(await treeRows(page)).toEqual(['Untitled Catalog'])
  await expect(page.getByRole('region', { name: 'Untitled Catalog' })).toContainText('No links to other objects.')
})

test('loads a dropped file', async ({ page }) => {
  // A trusted drop from the browser itself, as when a user drags a file from their desktop onto the input.
  const target = await page.getByTestId('file-input-droptarget').boundingBox()
  const cdp = await page.context().newCDPSession(page)
  const data = { items: [], files: [fixture('minimal-catalog.json')], dragOperationsMask: 1 }
  for (const type of ['dragEnter', 'dragOver', 'drop']) {
    await cdp.send('Input.dispatchDragEvent', { type, x: target!.x + 10, y: target!.y + 10, data })
  }
  await expectOpened(page, 'minimal-catalog.json')
})

test('loads a catalog with schema errors', async ({ page }) => {
  await chooseFile(page, fixture('dataset-missing-title.json', 'invalid'))
  await expectOpened(page, 'dataset-missing-title.json')
  await expect(tree(page).getByRole('treeitem', { name: 'Untitled Dataset dataset · Dataset' })).toBeVisible()
})

test('asks before replacing a loaded catalog', async ({ page }) => {
  await loadSample(page, 'minimal-catalog.json')
  await toImport(page)
  await expect(page.getByText('minimal-catalog.json is open. Importing another catalog replaces it')).toBeVisible()
  const confirm = page.getByRole('heading', { name: 'Replace the open catalog?' })

  // Cancel keeps the open catalog.
  await page.getByRole('button', { name: 'Start a blank catalog' }).click()
  await expect(confirm).toBeFocused()
  await expect(page.getByText('Blank catalog is ready. Replace minimal-catalog.json with it')).toBeVisible()
  await page.getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(confirm).toHaveCount(0)
  await page.getByRole('link', { name: 'Back to the editor' }).click()
  await expectOpened(page, 'minimal-catalog.json')
  await toImport(page)

  // Input that fails is refused without asking.
  await paste(page, '{}')
  await expect(page.getByRole('alert')).toContainText('No DCAT-US 3.0 class found')
  await expect(confirm).toHaveCount(0)

  // A newer load drops a replacement still waiting to be confirmed.
  await chooseFile(page, fixture('minimal-catalog.json'))
  await expect(confirm).toBeFocused()
  await page.getByLabel('Sample catalog').selectOption('dataset-with-distributions.json')
  await page.getByRole('button', { name: 'Load sample' }).click()
  await expect(page.getByText('dataset-with-distributions.json is ready.')).toBeVisible()
  expect((await axe(page).analyze()).violations).toEqual([])
  await page.getByRole('button', { name: 'Replace', exact: true }).click()
  await expectOpened(page, 'dataset-with-distributions.json')
  expect(await treeRows(page)).toHaveLength(3)
})

test('shows progress while loading, and the load can be cancelled', async ({ page }) => {
  const release = await holdWorker(page)
  await page.getByRole('button', { name: 'Start a blank catalog' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Loading Blank catalog…' })).toBeVisible()
  await expect(page.getByRole('progressbar', { name: 'Loading Blank catalog…' })).toBeVisible()
  // The page stays usable while it loads.
  await page.getByLabel('Paste JSON').fill('{"@type": "Catalog"}')
  expect((await axe(page).analyze()).violations).toEqual([])

  await page.getByRole('button', { name: 'Cancel loading' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Import a catalog' })).toBeFocused()
  await expect(page.getByText('Loading Blank catalog…')).toHaveCount(0)
  release()
  await page.waitForTimeout(500) // the cancelled load must not finish later
  await expect(page).toHaveURL('/import')
  await expect(page.getByRole('alert')).toHaveCount(0)

  await page.getByRole('button', { name: 'Load pasted JSON' }).click()
  await expectOpened(page, 'Pasted JSON')
  await expect(page.getByRole('progressbar')).toHaveCount(0)
})

test('leaving the import page cancels a load in progress', async ({ page }) => {
  const release = await holdWorker(page)
  await page.getByRole('button', { name: 'Start a blank catalog' }).click()
  await expect(page.getByText('Loading Blank catalog…')).toBeVisible()
  await page.getByRole('link', { name: 'Editor', exact: true }).click()
  release()
  await page.waitForTimeout(500)
  await expect(page.getByRole('heading', { level: 1, name: 'No catalog open' })).toBeVisible()
})

test('a load that ends while "Cancel loading" has focus moves focus to the load heading', async ({ page }) => {
  const release = await holdWorker(page)
  await paste(page, '{}')
  await page.getByRole('button', { name: 'Cancel loading' }).focus()
  release()
  await expect(page.getByRole('alert')).toContainText('No DCAT-US 3.0 class found')
  await expect(page.getByRole('heading', { level: 1, name: 'Import a catalog' })).toBeFocused()
})

test('refuses bad input with an alert and keeps the loaded catalog', async ({ page }) => {
  // Counts file reads. The good load at the end proves the count sees the app's reads.
  await page.evaluate(() => {
    const counted = window as unknown as { fileReads: number }
    counted.fileReads = 0
    // Every read method, so the FileInput's own preview reads would count too.
    for (const method of ['readAsArrayBuffer', 'readAsText', 'readAsDataURL', 'readAsBinaryString'] as const) {
      const read = FileReader.prototype[method] as (this: FileReader, blob: Blob) => void
      FileReader.prototype[method] = function (blob: Blob) {
        counted.fileReads++
        return read.call(this, blob)
      }
    }
  })
  const fileReads = () => page.evaluate(() => (window as unknown as { fileReads: number }).fileReads)
  await loadSample(page, 'minimal-catalog.json')
  await toImport(page)
  const alert = page.getByRole('alert')

  await paste(page, '{"@type": "Catalog", "dataset": [')
  await expect(alert).toContainText('Pasted JSON could not be loaded')
  await expect(alert).toContainText('This is not valid JSON')
  await expect(alert).toContainText('The catalog already open (minimal-catalog.json) has not changed.')
  // role=alert announces it; focus stays where the user was, so they can fix the input and retry.
  await expect(page.getByRole('button', { name: 'Load pasted JSON' })).toBeFocused()

  // The same failure again is a new alert, so it is announced again.
  await alert.evaluate((element) => element.setAttribute('data-old', ''))
  await page.getByRole('button', { name: 'Load pasted JSON' }).click()
  await expect(alert).toContainText('This is not valid JSON')
  await expect(alert).not.toHaveAttribute('data-old')

  await paste(page, '{"name": "not a catalog"}')
  await expect(alert).toContainText('No DCAT-US 3.0 class found')

  await paste(page, '  ')
  await expect(alert).toContainText('This document is empty.')

  // Not JSON at all, so had it been parsed the error would be "not valid JSON": the size is checked first.
  await chooseFile(page, { name: 'huge.json', mimeType: 'application/json', buffer: Buffer.alloc(25_000_001, 'x') })
  await expect(alert).toContainText('huge.json could not be loaded')
  await expect(alert).toContainText('This document is over the size limit of 25 MB (it is 25,000,001 bytes).')
  expect(await fileReads()).toBe(0)

  await chooseFile(page, {
    name: 'latin-1.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{"@type": "Catalog", "title": "Caf\xe9", "dataset": []}', 'latin1'),
  })
  await expect(alert).toContainText('latin-1.json could not be loaded')
  await expect(alert).toContainText('This file is not UTF-8 text.')

  await expect(page).toHaveURL('/import')

  // A good load clears the alert, and asks before replacing the catalog.
  await chooseFile(page, fixture('minimal-catalog.json'))
  await expect(alert).toHaveCount(0)
  await page.getByRole('button', { name: 'Replace', exact: true }).click()
  await expectOpened(page, 'minimal-catalog.json')
  expect(await treeRows(page)).toHaveLength(2)
  expect(await fileReads()).toBeGreaterThan(0)
})

test('shows unknown properties as text only', async ({ page }) => {
  const payload = '<img src=x onerror="window.pwned=1"><script>window.pwned=1</script>'
  await paste(
    page,
    JSON.stringify({
      '@type': 'Catalog',
      dataset: [
        {
          '@type': 'Dataset',
          title: payload,
          'x-agency': payload,
          'x-long': 'a'.repeat(5_000),
          'x-values': [3, true, null, { a: 1 }],
          landingPage: 'javascript:window.pwned=1',
        },
      ],
    }),
  )
  await tree(page).getByRole('treeitem', { name: `${payload} dataset · Dataset` }).click()
  const detail = page.getByRole('region', { name: payload })
  await expect(detail.getByRole('table', { name: 'Other properties' })).toContainText('x-agency')
  await expect(detail.getByRole('table', { name: 'Other properties' })).toContainText(payload)
  await expect(detail.getByRole('row', { name: /^x-values/ })).toHaveText('x-values[3,true,null,{"a":1}]')
  await expect(detail.getByRole('row', { name: /^x-long/ })).toHaveText(/^x-longa{2000}… \(5,000 characters in all\)$/)
  await expect(detail.getByRole('table').locator('img, script, a')).toHaveCount(0)
  expect(await page.evaluate(() => (window as unknown as { pwned?: number }).pwned)).toBeUndefined()
})

test('pages long lists and isolates right-to-left text', async ({ page }) => {
  const datasets = Array.from({ length: 501 }, (_, i) => ({ '@type': 'Dataset', title: `Dataset ${i}` }))
  datasets[0].title = 'Evil \u202E(Catalog)'
  datasets[1].title = ' \u200B '
  datasets[2].title = 'L'.repeat(300)
  await paste(page, JSON.stringify({ '@type': 'Catalog', title: 'Big', dataset: datasets }))

  await expectOpened(page, 'Pasted JSON')
  await expect(page.getByText('From Pasted JSON ·').locator('bdi')).toHaveText('Pasted JSON')

  const rows = tree(page).getByRole('treeitem')
  await expect(rows).toHaveCount(502)
  await expect(rows.nth(1).locator('bdi')).toHaveText('Evil \u202E(Catalog)')
  await expect(rows.nth(2)).toHaveText('Untitled Dataset dataset · Dataset')
  await expect(rows.nth(3).locator('bdi')).toHaveText(`${'L'.repeat(200)}…`)

  // The catalog is open on the right, with its 501 dataset links paged.
  const detail = page.getByRole('region', { name: 'Big' })
  await expect(detail.getByRole('listitem')).toHaveCount(500)
  await detail.getByRole('button', { name: 'Show more dataset links (500 of 501 shown)' }).click()
  await expect(detail.getByRole('listitem')).toHaveCount(501)
  await expect(detail.getByRole('link', { name: 'Dataset 500 (Dataset)' })).toBeFocused()
  await expect(detail.getByRole('listitem').first().locator('bdi')).toHaveText('Evil \u202E(Catalog)')

  // Only the detail pane: axe over 1,000 rows is slow on a throttled runner.
  expect((await axe(page).include('section[aria-labelledby="detail-heading"]').analyze()).violations).toEqual([])

  await detail.getByRole('link', { name: /^Evil/ }).click()
  await expect(page).toHaveURL('/editor/dataset/0')
  await expect(page.locator('#detail-heading bdi')).toHaveText('Evil \u202E(Catalog)')
})
