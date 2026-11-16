import type { Locator, Page } from '@playwright/test'
import { test, expect } from './fixtures'

// Every USWDS alert the editor shows keeps its icon clear of its text. USWDS draws the icon as the body's
// absolutely placed ::before and makes room for it with a margin on the body's child elements, so text that is not
// inside an element (an <Alert> given a bare string, not <AlertText>) runs under the icon.

type Box = { left: number; top: number; right: number; bottom: number }

/** The alert's icon box and the box of each line of its text, in page coordinates. */
async function iconAndText(alert: Locator) {
  return alert.evaluate((element) => {
    const body = element.querySelector('.usa-alert__body')
    if (!body) throw new Error('The alert has no .usa-alert__body')
    const before = getComputedStyle(body, '::before')
    const origin = body.getBoundingClientRect()
    const left = origin.left + parseFloat(before.left)
    const top = origin.top + parseFloat(before.top)
    const icon =
      before.content === 'none' || before.display === 'none'
        ? null
        : { left, top, right: left + parseFloat(before.width), bottom: top + parseFloat(before.height) }
    const text: (Box & { text: string })[] = []
    const walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT)
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (!node.textContent?.trim()) continue
      const range = document.createRange()
      range.selectNodeContents(node)
      for (const rect of range.getClientRects()) {
        if (rect.width && rect.height) text.push({ left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, text: node.textContent.trim() })
      }
    }
    return { icon, text }
  })
}

/** The alert shows its icon, and no line of its text overlaps it, wide and on a narrow phone screen. */
async function expectIconClearOfText(page: Page, alert: Locator) {
  const viewport = page.viewportSize()
  for (const width of [viewport?.width ?? 1280, 320]) {
    await page.setViewportSize({ width, height: viewport?.height ?? 720 })
    await expect(alert).toBeVisible()
    const { icon, text } = await iconAndText(alert)
    expect(icon, 'the alert shows its icon').not.toBeNull()
    expect(icon!.right - icon!.left, 'the icon has a size').toBeGreaterThan(0)
    expect(text.length, 'the alert has text').toBeGreaterThan(0)
    const overlapping = text.filter(
      (line) => line.left < icon!.right && line.right > icon!.left && line.top < icon!.bottom && line.bottom > icon!.top,
    )
    expect(overlapping.map((line) => line.text), `text under the icon at ${width}px`).toEqual([])
  }
  if (viewport) await page.setViewportSize(viewport)
}

async function loadSample(page: Page, name: string) {
  await page.getByLabel('Sample catalog').selectOption(name)
  await page.getByRole('button', { name: 'Load sample' }).click()
  await expect(page).toHaveURL(/\/editor/)
}

test.beforeEach(async ({ page }) => {
  await page.goto('/import')
})

test('export success and failure alerts keep the icon clear of the text', async ({ page }) => {
  await loadSample(page, 'minimal-catalog.json')
  const status = page.locator('#export-status')

  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export catalog' }).click()
  await download
  await expect(status).toHaveClass(/usa-alert--success/)
  await expect(status).toContainText('Catalog exported successfully')
  await expectIconClearOfText(page, status)

  // Making the download fail is the one way to reach the error alert from the page.
  await page.evaluate(() => {
    URL.createObjectURL = () => {
      throw new Error('Downloads are blocked')
    }
  })
  await page.getByRole('button', { name: 'Export catalog' }).click()
  await expect(status).toHaveClass(/usa-alert--error/)
  await expect(status).toContainText('Export failed: Downloads are blocked')
  await expectIconClearOfText(page, status)
})

test('import page alerts keep the icon clear of the text', async ({ page }) => {
  await loadSample(page, 'minimal-catalog.json')
  await page.getByRole('link', { name: 'Import', exact: true }).click()

  // Info, slim: a catalog is already open.
  await expectIconClearOfText(page, page.locator('.usa-alert--info'))

  // Warning: the prompt before replacing the open catalog.
  await page.getByLabel('Sample catalog').selectOption('dataset-with-distributions.json')
  await page.getByRole('button', { name: 'Load sample' }).click()
  await expectIconClearOfText(page, page.locator('.usa-alert--warning'))
  await page.getByRole('button', { name: 'Cancel' }).click()

  // Error: input that cannot be loaded.
  await page.getByLabel('Paste JSON').fill('{"@type": "Catalog", "dataset": [')
  await page.getByRole('button', { name: 'Load pasted JSON' }).click()
  await expectIconClearOfText(page, page.getByRole('alert'))
})
