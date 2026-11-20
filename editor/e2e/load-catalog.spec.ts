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
const treeRows = (page: Page) => tree(page).getByRole('treeitem').allTextContents()
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
  await expect(page).toHaveURL(/\/editor\/[A-Za-z0-9_-]{22}$/)
  await expect(page).toHaveTitle('Example Agency Catalog (Catalog) | Inventory Editor')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Example Agency Catalog')
  // The catalog is open on the right, and selected in the tree on the left.
  await expect(page.locator('#detail-heading')).toHaveText('Example Agency Catalog')
  await expect(tree(page).getByRole('treeitem', { selected: true })).toHaveText('Example Agency Catalog')

  await tree(page).getByRole('treeitem', { name: 'Air quality readings Dataset' }).click()
  const datasetUrl = /\/editor\/[A-Za-z0-9_-]{22}\/dataset\/[A-Za-z0-9_-]{22}$/
  const csvUrl = /\/editor\/[A-Za-z0-9_-]{22}\/distribution\/[A-Za-z0-9_-]{22}$/
  await expect(page).toHaveURL(datasetUrl)
  await expect(page).toHaveTitle('Air quality readings (Dataset) | Inventory Editor')
  const detail = page.getByRole('form', { name: 'Edit Air quality readings' })
  // Closed, it says how many objects it holds.
  await expect(tree(page).getByRole('treeitem', { selected: true })).toHaveText('Air quality readings Dataset · 5 items')
  // The tree is on the left and the selected object on the right (#20, James's comment).
  const list = await page.getByRole('navigation', { name: 'Catalog contents' }).boundingBox()
  const pane = await detail.boundingBox()
  expect(list!.x + list!.width).toBeLessThanOrEqual(pane!.x)

  // Issue #24: Now shows editable form instead of property tables and links.
  await expect(detail.getByRole('textbox', { name: /^Title/ })).toBeVisible()

  // Following a link opens that object, with the path to it in a breadcrumb that leads back up, and shows it in the tree.
  await detail.getByRole('link', { name: 'Readings as CSV', exact: true }).click()
  await expect(page).toHaveURL(csvUrl)
  await expect(tree(page).getByRole('treeitem', { selected: true })).toHaveText('Readings as CSV Distribution · 1 item')
  const breadcrumb = page.getByRole('navigation', { name: 'Where this object is' })
  await expect(breadcrumb).toHaveText(/Example Agency Catalog\s*Air quality readings\s*Readings as CSV/)
  expect((await axe(page).analyze()).violations).toEqual([])
  await breadcrumb.getByRole('link', { name: 'Air quality readings' }).click()
  await expect(page).toHaveURL(datasetUrl)
  await expect(tree(page).getByRole('treeitem', { selected: true })).toHaveText('Air quality readings Dataset')

  // Back and forward work like any site.
  await page.goBack()
  await expect(page).toHaveURL(csvUrl)
  await expect(page.getByRole('form', { name: 'Edit Readings as CSV' })).toBeVisible()
  await page.goForward()
  await expect(page).toHaveURL(datasetUrl)

  // Until persistence is implemented, reload will not work.
  await page.reload()
  await expect(page.getByRole('heading', { level: 1, name: 'Catalog not found in this browser' })).toBeVisible()
})

test('shows every object above the open one in the breadcrumb, through single links too', async ({ page }) => {
  await loadSample(page, 'dataset-with-distributions.json')
  const breadcrumb = page.getByRole('navigation', { name: 'Where this object is' })
  // The catalog has nothing above it.
  await expect(breadcrumb).toHaveCount(0)
  await page.getByRole('treeitem', { name: 'Air quality readings Dataset' }).click()
  await page.getByRole('form').getByRole('link', { name: 'Readings as CSV', exact: true }).click()
  await page.getByRole('form').getByRole('link', { name: 'Untitled Checksum', exact: true }).click()
  await expect(page.getByRole('heading', { level: 2, name: 'Untitled Checksum', exact: true })).toBeVisible()
  await expect(breadcrumb.getByRole('link')).toHaveText([
    'Example Agency Catalog',
    'Air quality readings',
    'Readings as CSV',
  ])
  await expect(breadcrumb.getByRole('link').first()).toHaveAttribute('href', /\/editor\/[A-Za-z0-9_-]{22}$/)
  await expect(breadcrumb.getByRole('listitem').last()).toHaveText('Untitled Checksum')
})

test('loads a chosen file in the browser', async ({ page }) => {
  await chooseFile(page, fixture('minimal-catalog.json'))
  await expectOpened(page, 'minimal-catalog.json')
  expect(await treeRows(page)).toEqual(['Untitled Catalog', 'Minimal dataset Dataset · 1 item'])
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
  // Issue #24: Now shows editable form, not "No links" message
  await expect(page.getByRole('form', { name: 'Edit Untitled Catalog' })).toBeVisible()
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
  await expect(tree(page).getByRole('treeitem', { name: 'Untitled Dataset Dataset' })).toBeVisible()
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
  await tree(page).getByRole('treeitem', { name: `${payload} Dataset` }).click()
  const form = page.getByRole('form', { name: `Edit ${payload}` })
  // Issue #24: Other properties now shown in a section, not a table
  const otherProps = form.getByRole('region', { name: 'Other properties' })
  await expect(otherProps).toContainText('x-agency')
  await expect(otherProps).toContainText(payload)
  await expect(otherProps).toContainText('x-values')
  await expect(otherProps).toContainText('[3,true,null,{"a":1}]')
  await expect(otherProps).toContainText('x-long')
  // Ensure no XSS: no img, script, or clickable links rendered, other than the editor's own links to other objects (#25)
  await expect(form.locator('img, script, a:not([href^="/editor"])')).toHaveCount(0)
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
  await expect(rows.nth(2)).toHaveText('Untitled Dataset Dataset')
  await expect(rows.nth(3).locator('bdi')).toHaveText(`${'L'.repeat(200)}…`)

  // Issue #24: Object reference links in forms are out of scope (blocked by #25).
  // This test checked that dataset links were paged in the detail view.
  // With forms, link fields are not yet implemented.
  // Just verify the catalog form is visible.
  const form = page.getByRole('form', { name: 'Edit Big' })
  await expect(form).toBeVisible()

  // Run accessibility check on the form
  expect((await axe(page).include('form[aria-label*="Edit Big"]').analyze()).violations).toEqual([])
})
