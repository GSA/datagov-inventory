import type { Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { fileURLToPath } from 'node:url'
import { test, expect } from './fixtures'

const fixture = (name: string) => fileURLToPath(new URL(`../fixtures/catalogs/valid/${name}`, import.meta.url))

test.beforeEach(async ({ page }) => {
  const response = await page.goto('/')
  expect(response?.headers()['content-security-policy']).toContain("connect-src 'none'")
})

const summaryRows = (page: Page) =>
  page
    .getByRole('table', { name: /objects by class/ })
    .getByRole('row')
    .allInnerTexts()
const chooseFile = (page: Page, file: Parameters<Page['setInputFiles']>[1]) =>
  page.getByLabel('Choose a DCAT-US 3.0 JSON file').setInputFiles(file)
const axe = (page: Page) => new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])

async function paste(page: Page, text: string) {
  await page.getByLabel('Paste JSON').fill(text)
  await page.getByRole('button', { name: 'Load pasted JSON' }).click()
}

async function loadSample(page: Page, name: string) {
  await page.getByLabel('Sample catalog').selectOption(name)
  await page.getByRole('button', { name: 'Load sample' }).click()
  await expect(page.getByRole('heading', { name: `Loaded ${name}` })).toBeFocused()
}

test('loads a sample, shows counts by class, opens a dataset and follows its links', async ({ page }) => {
  await loadSample(page, 'dataset-with-distributions.json')
  await expect(page.getByRole('table', { name: '9 objects by class' })).toBeVisible()
  expect(await summaryRows(page)).toEqual([
    'Class\tObjects',
    'Catalog\t1',
    'Checksum\t1',
    'Dataset\t1',
    'Distribution\t2',
    'Kind\t1',
    'Organization\t2',
    'PeriodOfTime\t1',
  ])

  await expect(page.getByRole('row', { name: /^Air quality readings/ })).toHaveText(
    /^Air quality readings\s*Dataset\s*#\/dataset\/0$/,
  )
  await page.getByRole('button', { name: 'Air quality readings' }).click()
  const detail = page.getByRole('region', { name: 'Air quality readings' })
  // The list is on the left and the selected object on the right (#20, James's comment).
  const list = await page.getByRole('region', { name: 'Objects' }).boundingBox()
  const pane = await detail.boundingBox()
  expect(list!.x + list!.width).toBeLessThanOrEqual(pane!.x)
  await expect(detail.getByRole('heading', { level: 2 })).toBeFocused()
  await expect(detail.getByRole('table', { name: 'Properties' })).toContainText('example-air-quality')
  await expect(detail.getByRole('listitem')).toHaveText([
    'Air Quality Team (Kind)',
    'Example Agency (Organization)',
    'Untitled PeriodOfTime (PeriodOfTime)',
    'Readings as CSV (Distribution)',
    'Readings API (Distribution)',
  ])

  await detail.getByRole('button', { name: 'Readings as CSV (Distribution)' }).click()
  const distribution = page.getByRole('region', { name: 'Readings as CSV' })
  await expect(distribution.getByRole('heading', { level: 2 })).toBeFocused()
  await expect(distribution).toContainText('#/dataset/0/distribution/0')
  await distribution.getByRole('button', { name: 'Untitled Checksum (Checksum)' }).click()
  await expect(page.getByRole('region', { name: 'Untitled Checksum' })).toContainText('SHA-256')

  expect((await axe(page).analyze()).violations).toEqual([])
})

test('loads a chosen file in the browser', async ({ page }) => {
  await chooseFile(page, fixture('minimal-catalog.json'))
  await expect(page.getByRole('heading', { name: 'Loaded minimal-catalog.json' })).toBeFocused()
  expect(await summaryRows(page)).toEqual(['Class\tObjects', 'Catalog\t1', 'Dataset\t1', 'Kind\t1'])
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
  await expect(page.getByRole('heading', { name: 'Loaded dataset-with-distributions.json' })).toBeVisible()
  await expect(page.getByRole('alert')).toHaveCount(0)
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
  const alert = page.getByRole('alert')

  await paste(page, '{"@type": "Catalog", "dataset": [')
  await expect(alert).toContainText('Pasted JSON could not be loaded')
  await expect(alert).toContainText('This is not valid JSON')
  await expect(alert).toContainText('The catalog already loaded (minimal-catalog.json) has not changed.')
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

  await expect(page.getByRole('heading', { name: 'Loaded minimal-catalog.json' })).toBeVisible()
  expect(await summaryRows(page)).toEqual(['Class\tObjects', 'Catalog\t1', 'Dataset\t1', 'Kind\t1'])

  // A good load clears the alert.
  await chooseFile(page, fixture('minimal-catalog.json'))
  await expect(page.getByRole('heading', { name: 'Loaded minimal-catalog.json' })).toBeFocused()
  await expect(alert).toHaveCount(0)
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
  await page.getByRole('button', { name: payload }).click()
  const detail = page.getByRole('region', { name: payload })
  await expect(detail.getByRole('table', { name: 'Other properties' })).toContainText('x-agency')
  await expect(detail.getByRole('table', { name: 'Other properties' })).toContainText(payload)
  await expect(detail.getByRole('row', { name: /^x-values/ })).toHaveText('x-values[3,true,null,{"a":1}]')
  await expect(detail.getByRole('row', { name: /^x-long/ })).toHaveText(/^x-longa{2000}… \(5,000 characters in all\)$/)
  await expect(detail.locator('img, script, a')).toHaveCount(0)
  expect(await page.evaluate(() => (window as unknown as { pwned?: number }).pwned)).toBeUndefined()
})

test('pages long lists and isolates right-to-left text', async ({ page }) => {
  const datasets = Array.from({ length: 501 }, (_, i) => ({ '@type': 'Dataset', title: `Dataset ${i}` }))
  datasets[0].title = 'Evil \u202E(Catalog)'
  datasets[1].title = ' \u200B '
  datasets[2].title = 'L'.repeat(300)
  await paste(page, JSON.stringify({ '@type': 'Catalog', title: 'Big', dataset: datasets }))

  const list = page.getByRole('region', { name: 'Objects' })
  await expect(list.getByRole('row')).toHaveCount(501) // a header and 500 rows
  await expect(page.getByRole('heading', { name: 'Loaded Pasted JSON' }).locator('bdi')).toHaveText('Pasted JSON')
  await expect(list.getByRole('row').nth(2).getByRole('button').locator('bdi')).toHaveText('Evil \u202E(Catalog)')
  await expect(list.getByRole('row').nth(3).getByRole('button')).toHaveText('Untitled Dataset')
  await expect(list.getByRole('row').nth(4).getByRole('button')).toHaveText(`${'L'.repeat(200)}…`)
  await list.getByRole('button', { name: 'Show more objects (500 of 502 shown)' }).click()
  await expect(list.getByRole('row')).toHaveCount(503)
  await expect(list.getByRole('button', { name: 'Dataset 499', exact: true })).toBeFocused() // the first new row
  await expect(list.getByRole('status')).toHaveText('Showing 502 of 502 objects.')

  await list.getByRole('button', { name: 'Big' }).click()
  const detail = page.getByRole('region', { name: 'Big' })
  await expect(detail.getByRole('listitem')).toHaveCount(500)
  await detail.getByRole('button', { name: 'Show more dataset links (500 of 501 shown)' }).click()
  await expect(detail.getByRole('listitem')).toHaveCount(501)
  await expect(detail.getByRole('button', { name: 'Dataset 500 (Dataset)' })).toBeFocused()
  await expect(detail.getByRole('listitem').first().locator('bdi')).toHaveText('Evil \u202E(Catalog)')

  // Only the detail pane: axe over 1,000 rows is slow on a throttled runner.
  expect((await axe(page).include('section[aria-labelledby="detail-heading"]').analyze()).violations).toEqual([])

  await detail.getByRole('button', { name: 'Back to the list' }).click()
  await expect(list.getByRole('button', { name: 'Big' })).toBeFocused()
  // Choosing the open object again moves focus back to it.
  await list.getByRole('button', { name: 'Big' }).click()
  await expect(detail.getByRole('heading', { level: 2 })).toBeFocused()

  await detail.getByRole('button', { name: /^Evil/ }).click()
  await expect(page.locator('#detail-heading bdi')).toHaveText('Evil \u202E(Catalog)')
})
