/**
 * Measures how long the catalog tree takes to respond on a generated catalog of 3,000 datasets (18,001 objects),
 * as INP does: from each input to the next paint, with the Event Timing API. Target (#23): 100 ms, the limit for a
 * response to feel immediate (https://web.dev/articles/rail). Opt-in, since timings vary by machine:
 *
 *   PERF=1 npx playwright test tree-performance          # CPU_THROTTLE=4 to emulate a slower laptop
 */
import type { Page } from '@playwright/test'
import { test } from './fixtures'
import { largeCatalog } from '../fixtures/largeCatalog'

test.skip(!process.env.PERF, 'set PERF=1 to measure')
test.setTimeout(300_000)

/** Records Event Timing entries (only those over 16 ms are reported) and when the tree's DOM last changed. */
function observe() {
  const w = window as unknown as { durations: number[]; treeChanged?: number; inputAt: number }
  w.durations = []
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries() as PerformanceEventTiming[]) {
      if (entry.interactionId) w.durations.push(entry.duration)
    }
  }).observe({ type: 'event', durationThreshold: 16, buffered: false } as PerformanceObserverInit)
  addEventListener('input', () => (w.inputAt = performance.now()), true)
  // About when the last change to the page was painted: the next frame after it.
  new MutationObserver(() => requestAnimationFrame(() => setTimeout(() => (w.treeChanged = performance.now())))).observe(document, { subtree: true, childList: true, characterData: true })
}

/** Runs `action`, waits until the page is idle, and returns the longest interaction (under 16 ms counts as 16). */
async function measure(page: Page, action: () => Promise<unknown>) {
  await page.evaluate(() => Object.assign(window, { durations: [], treeChanged: undefined }))
  await action()
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 1_000))))
  return page.evaluate(() => Math.max(16, ...(window as unknown as { durations: number[] }).durations))
}

test('tree interactions on 3,000 datasets', async ({ page }) => {
  const throttle = Number(process.env.CPU_THROTTLE ?? 1)
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: throttle })
  await page.addInitScript(observe)
  await page.goto('/import')
  await page.getByLabel('Choose a DCAT-US 3.0 JSON file').setInputFiles({
    name: 'large.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(largeCatalog())),
  })
  const tree = page.getByRole('tree')
  await tree.getByRole('treeitem').nth(3000).waitFor()

  const results: Record<string, number[]> = {}
  const record = (name: string, ms: number) => (results[name] ??= []).push(ms)
  const item = (label: string) => tree.getByRole('treeitem').filter({ has: page.getByText(label, { exact: true }) })

  for (let i = 0; i < 5; i++) {
    const dataset = item(`Water use ${i * 600 + 1}`)
    record('select (click a dataset)', await measure(page, () => dataset.click()))
    record('expand (Right arrow)', await measure(page, () => page.keyboard.press('ArrowRight')))
    record('move (Down arrow)', await measure(page, () => page.keyboard.press('ArrowDown')))
    record('select (Enter)', await measure(page, () => page.keyboard.press('Enter')))
    record('move (Up arrow)', await measure(page, () => page.keyboard.press('ArrowUp')))
    record('collapse (Left arrow)', await measure(page, () => page.keyboard.press('ArrowLeft')))
  }
  for (let i = 0; i < 3; i++) {
    await item('Generated catalog of 3,000 datasets').click()
    record('collapse the catalog (3,000 rows)', await measure(page, () => page.keyboard.press('ArrowLeft')))
    record('expand the catalog (3,000 rows)', await measure(page, () => page.keyboard.press('ArrowRight')))
  }

  const filter = page.getByLabel('Filter by title or name')
  for (const text of ['water', 'data team']) {
    await filter.click()
    for (const key of text) {
      record(`filter: type a key ("${text}")`, await measure(page, () => page.keyboard.press(key)))
      const shown = await page.evaluate(() => {
        const w = window as unknown as { treeChanged?: number; inputAt: number }
        return w.treeChanged && w.treeChanged - w.inputAt
      })
      if (shown) record(`filter: key to tree painted ("${text}")`, shown)
    }
    record('filter: clear (back to 3,000 rows)', await measure(page, () => filter.fill('')))
  }

  // Typing at about 8 keys a second: the slowest key, and the time from the last key until the tree is painted.
  for (const text of ['water use 2', 'data team 4', 'json download']) {
    await filter.fill('')
    await page.waitForTimeout(1_000)
    const slowest = await measure(page, () => filter.pressSequentially(text, { delay: 120 }))
    record(`filter: type "${text}" at 8 keys/s, slowest key`, slowest)
    const shown = await page.evaluate(() => {
      const w = window as unknown as { treeChanged?: number; inputAt: number }
      return Math.max(0, (w.treeChanged ?? 0) - w.inputAt)
    })
    record(`filter: type "${text}", last key to tree painted`, shown)
  }

  const summary = Object.entries(results).map(
    ([name, ms]) => `${name.padEnd(56)} max ${Math.round(Math.max(...ms))} ms, median ${Math.round(ms.sort((a, b) => a - b)[ms.length >> 1])} ms (n=${ms.length})`,
  )
  console.log(`CPU throttle ${throttle}×\n${summary.join('\n')}`)
})
