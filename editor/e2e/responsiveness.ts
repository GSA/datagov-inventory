/**
 * Measures the editor on a generated catalog (#29): time to first view, JS heap, and how long each action takes, from
 * the input to the next paint. Used by responsiveness.spec.ts.
 */
import type { CDPSession, Page } from '@playwright/test'
import { expect } from './fixtures'
import { largeCatalog } from '../fixtures/largeCatalog'

/** Milliseconds, or MB for the heap. */
export interface Measurements {
  firstView: number
  heapAfterLoad: number
  scroll: number
  filterKey: number
  select: number
  edit: number
  validate: number
  export: number
  heapAfterActions: number
}

type Window_ = Window & { durations: number[]; longFrames: number[] }

/** Records Event Timing entries of interactions (over 16 ms) and long animation frames (over 50 ms). */
function observe() {
  const w = window as Window_
  w.durations = []
  w.longFrames = []
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries() as PerformanceEventTiming[]) {
      if (entry.interactionId) w.durations.push(entry.duration)
    }
  }).observe({ type: 'event', durationThreshold: 16, buffered: false } as PerformanceObserverInit)
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) w.longFrames.push(entry.duration)
  }).observe({ type: 'long-animation-frame', buffered: false })
}

const idle = (page: Page) =>
  page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 500))))

/** Runs `action`, waits until the page is idle, and returns the longest interaction (under 16 ms counts as 16). */
async function inputToNextPaint(page: Page, action: () => Promise<unknown>) {
  await page.evaluate(() => ((window as Window_).durations = []))
  await action()
  await idle(page)
  return page.evaluate(() => Math.max(16, ...(window as Window_).durations))
}

/**
 * The time from the first `event` (captured on the page) after `action` starts until `selector` matches an element
 * whose text starts with `text`, and the next frame is painted. Waits in the page, since Playwright's polling of a
 * large tree would block the main thread.
 */
async function untilPainted(page: Page, event: string, selector: string, text: string, action: () => Promise<unknown>) {
  await page.evaluate(
    ([event, selector, text]) => {
      const w = window as Window & { startedAt?: number; done?: Promise<number> }
      w.startedAt = undefined
      addEventListener(event, () => (w.startedAt ??= performance.now()), { capture: true, once: true })
      const shown = () => [...document.querySelectorAll(selector)].some((e) => e.textContent?.startsWith(text))
      w.done = new Promise((resolve) => {
        new MutationObserver((_, observer) => {
          if (w.startedAt === undefined || !shown()) return
          observer.disconnect()
          requestAnimationFrame(() => setTimeout(() => resolve(performance.now())))
        }).observe(document, { subtree: true, childList: true, characterData: true })
      })
    },
    [event, selector, text],
  )
  await action()
  return page.evaluate(async () => {
    const w = window as Window & { startedAt: number; done: Promise<number> }
    return (await w.done) - w.startedAt
  })
}

async function heapMB(cdp: CDPSession) {
  await cdp.send('HeapProfiler.collectGarbage')
  const { metrics } = await cdp.send('Performance.getMetrics')
  return metrics.find((m) => m.name === 'JSHeapUsedSize')!.value / 1e6
}

/** Scrolls the tree from top to bottom with the mouse wheel; returns the longest animation frame (at least 16 ms). */
async function scrollTree(page: Page) {
  const pane = page.locator('.catalog-tree')
  const box = (await pane.boundingBox())!
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.evaluate(() => ((window as Window_).longFrames = []))
  for (let i = 0; i < 500; i++) {
    await page.mouse.wheel(0, 2_000)
    const atEnd = await pane.evaluate((e) => e.scrollTop + e.clientHeight >= e.scrollHeight - 1)
    if (atEnd) break
  }
  await idle(page)
  return page.evaluate(() => Math.max(16, ...(window as Window_).longFrames))
}

export async function measureCatalog(page: Page, datasets: number): Promise<Measurements> {
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: Number(process.env.CPU_THROTTLE ?? 1) })
  await cdp.send('Performance.enable')
  await page.addInitScript(observe)
  await page.goto('/import')

  const catalog = largeCatalog(datasets)
  const firstView = await untilPainted(page, 'change', '[role="treeitem"]', catalog.dataset.at(-1)!.title, () =>
    page.getByLabel('Choose a DCAT-US 3.0 JSON file').setInputFiles({
      name: `catalog-${datasets}-datasets.json`,
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(catalog)),
    }),
  )
  await idle(page)
  const heapAfterLoad = await heapMB(cdp)

  const scroll = await scrollTree(page)

  const filter = page.getByLabel('Filter by title or name')
  await filter.click()
  const filterKey = await inputToNextPaint(page, () => filter.pressSequentially('water use 1', { delay: 120 }))
  await filter.fill('')
  await idle(page)

  const tree = page.getByRole('tree')
  const name = catalog.dataset[datasets >> 1].title
  const select = await inputToNextPaint(page, () => tree.getByRole('treeitem', { name: `${name} Dataset` }).click())

  const title = page.getByRole('form', { name: `Edit ${name}` }).getByRole('textbox', { name: /^Title/ })
  await title.fill(`${name} edited`)
  const edit = await untilPainted(page, 'focusout', '.catalog-tree__label', `${name} edited`, () => title.blur())

  const validateButton = page.getByRole('button', { name: 'Validate catalog' })
  await expect(validateButton).toBeEnabled({ timeout: 120_000 })
  const validate = await untilPainted(page, 'pointerdown', '[role="status"]', 'Validation finished', () =>
    validateButton.click(),
  )
  await idle(page)

  const exportButton = page.getByRole('button', { name: 'Export catalog' })
  const download = page.waitForEvent('download', { timeout: 120_000 })
  const exportStarted = Date.now()
  await exportButton.click()
  await download
  const exported = Date.now() - exportStarted
  await idle(page)

  return { firstView, heapAfterLoad, scroll, filterKey, select, edit, validate, export: exported, heapAfterActions: await heapMB(cdp) }
}

export function formatMeasurements(datasets: number, m: Measurements) {
  const rows = Object.entries(m).map(
    ([name, value]) => `  ${name.padEnd(18)} ${Math.round(value).toLocaleString('en-US').padStart(7)} ${name.startsWith('heap') ? 'MB' : 'ms'}`,
  )
  return [`${datasets.toLocaleString('en-US')} datasets, CPU throttle ${process.env.CPU_THROTTLE ?? 1}×`, ...rows].join('\n')
}
