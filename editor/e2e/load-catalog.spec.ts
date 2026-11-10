import { test, expect, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { fileURLToPath } from 'node:url'

const fixture = (name: string) => fileURLToPath(new URL(`../fixtures/catalogs/valid/${name}`, import.meta.url))

/** Every CSP violation, from the console and from `securitypolicyviolation` events. */
let cspViolations: string[]

test.beforeEach(async ({ page }) => {
  cspViolations = []
  page.on('console', (message) => {
    if (/Content Security Policy/i.test(message.text())) cspViolations.push(message.text())
  })
  await page.exposeFunction('reportCspViolation', (text: string) => cspViolations.push(text))
  await page.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', (event) =>
      (window as unknown as { reportCspViolation: (text: string) => void }).reportCspViolation(
        `${event.violatedDirective} ${event.blockedURI}`,
      ),
    )
  })
  const response = await page.goto('/')
  expect(response?.headers()['content-security-policy']).toContain("connect-src 'none'")
})

test.afterEach(() => {
  expect(cspViolations).toEqual([])
})

const summaryRows = (page: Page) =>
  page.getByRole('table', { name: /objects by class/ }).getByRole('row').allInnerTexts()

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

  const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
  expect(axe.violations).toEqual([])
})

test('loads a chosen file in the browser', async ({ page }) => {
  await page.getByLabel('Choose a DCAT-US 3.0 JSON file').setInputFiles(fixture('minimal-catalog.json'))
  await expect(page.getByRole('heading', { name: 'Loaded minimal-catalog.json' })).toBeFocused()
  expect(await summaryRows(page)).toEqual(['Class\tObjects', 'Catalog\t1', 'Dataset\t1', 'Kind\t1'])
})

test('refuses bad input with an alert and keeps the loaded catalog', async ({ page }) => {
  await page.evaluate(() => {
    const counted = window as unknown as { fileReads: number }
    counted.fileReads = 0
    const readAsText = FileReader.prototype.readAsText
    FileReader.prototype.readAsText = function (...args) {
      counted.fileReads++
      return readAsText.apply(this, args)
    }
  })
  await loadSample(page, 'minimal-catalog.json')
  const alert = page.getByRole('alert')

  await page.getByLabel('Paste JSON').fill('{"@type": "Catalog", "dataset": [')
  await page.getByRole('button', { name: 'Load pasted JSON' }).click()
  await expect(alert).toContainText('Pasted JSON could not be loaded')
  await expect(alert).toContainText('This is not valid JSON')
  await expect(alert).toContainText('The catalog already loaded (minimal-catalog.json) has not changed.')

  await page.getByLabel('Paste JSON').fill('{"name": "not a catalog"}')
  await page.getByRole('button', { name: 'Load pasted JSON' }).click()
  await expect(alert).toContainText('No DCAT-US 3.0 class found')

  // Not JSON at all, so had it been parsed the error would be "not valid JSON": the size is checked first.
  await page.getByLabel('Choose a DCAT-US 3.0 JSON file').setInputFiles({
    name: 'huge.json',
    mimeType: 'application/json',
    buffer: Buffer.alloc(25_000_001, 'x'),
  })
  await expect(alert).toContainText('huge.json could not be loaded')
  await expect(alert).toContainText('This document is 25,000,001 bytes, over the 25 MB size limit.')
  expect(await page.evaluate(() => (window as unknown as { fileReads: number }).fileReads)).toBe(0)

  await expect(page.getByRole('heading', { name: 'Loaded minimal-catalog.json' })).toBeVisible()
  expect(await summaryRows(page)).toEqual(['Class\tObjects', 'Catalog\t1', 'Dataset\t1', 'Kind\t1'])

  // A good load clears the alert.
  await page.getByLabel('Choose a DCAT-US 3.0 JSON file').setInputFiles(fixture('minimal-catalog.json'))
  await expect(page.getByRole('heading', { name: 'Loaded minimal-catalog.json' })).toBeFocused()
  await expect(alert).toHaveCount(0)
})

test('shows unknown properties as text only', async ({ page }) => {
  const payload = '<img src=x onerror="window.pwned=1"><script>window.pwned=1</script>'
  await page.getByLabel('Paste JSON').fill(
    JSON.stringify({
      '@type': 'Catalog',
      dataset: [{ '@type': 'Dataset', title: payload, 'x-agency': payload, landingPage: 'javascript:window.pwned=1' }],
    }),
  )
  await page.getByRole('button', { name: 'Load pasted JSON' }).click()
  await page.getByRole('button', { name: payload }).click()
  const detail = page.getByRole('region', { name: payload })
  await expect(detail.getByRole('table', { name: 'Other properties' })).toContainText('x-agency')
  await expect(detail.getByRole('table', { name: 'Other properties' })).toContainText(payload)
  await expect(detail.locator('img, script, a')).toHaveCount(0)
  expect(await page.evaluate(() => (window as unknown as { pwned?: number }).pwned)).toBeUndefined()
})
