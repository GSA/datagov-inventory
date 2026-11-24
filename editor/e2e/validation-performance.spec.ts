/**
 * Measures "Validate catalog" (#27) on the sample catalog and on generated catalogs of 3,000 and 10,000 datasets
 * (15,002 and 50,002 objects once their shared publisher merges on import): from the click until the button is back,
 * the main thread's long tasks in that time (the check itself runs in a worker), and the click's input-to-next-paint.
 * Opt-in, since timings vary by machine:
 *
 *   PERF=1 npx playwright test validation-performance   # CPU_THROTTLE=4 to emulate a slower laptop
 */
import type { Page } from '@playwright/test'
import { test, expect } from './fixtures'
import { largeCatalog } from '../fixtures/largeCatalog'

test.skip(!process.env.PERF, 'set PERF=1 to measure')
test.setTimeout(600_000)

type Window_ = Window & { longTasks: { start: number; duration: number }[]; clickDurations: number[] }

/** Records long tasks (over 50 ms) and the duration of each click, from input to the next paint. */
function observe() {
  const w = window as Window_
  w.longTasks = []
  w.clickDurations = []
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) w.longTasks.push({ start: entry.startTime, duration: entry.duration })
  }).observe({ type: 'longtask', buffered: false })
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries() as PerformanceEventTiming[]) {
      if (entry.name === 'click') w.clickDurations.push(entry.duration)
    }
  }).observe({ type: 'event', durationThreshold: 16, buffered: false } as PerformanceObserverInit)
}

async function open(page: Page, datasets?: number) {
  const throttle = Number(process.env.CPU_THROTTLE ?? 1)
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: throttle })
  await page.addInitScript(observe)
  await page.goto('/import')
  if (datasets === undefined) {
    await page.getByLabel('Sample catalog').selectOption('dataset-with-distributions.json')
    await page.getByRole('button', { name: 'Load sample' }).click()
  } else {
    await page.getByLabel('Choose a DCAT-US 3.0 JSON file').setInputFiles({
      name: 'large.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(largeCatalog(datasets))),
    })
  }
  await page.getByRole('tree').getByRole('treeitem').nth(datasets ?? 1).waitFor({ timeout: 300_000 })
  await expect(page.getByRole('button', { name: 'Validate catalog' })).toBeEnabled({ timeout: 120_000 })
  return throttle
}

/**
 * Clicks Validate catalog with a real mouse click and waits, in the page, until the result is announced and painted.
 * Playwright's own polling (a role query walks the 60,000-element tree) would block the main thread for over a second,
 * so nothing polls while the check runs. Returns the timings, in ms.
 */
async function validate(page: Page) {
  const box = (await page.locator('.catalog-actions button', { hasText: /^Validat/ }).boundingBox())!
  await page.evaluate(() => {
    const status = [...document.querySelectorAll('[role="status"]')].find((s) => s.matches('.usa-sr-only'))!
    const w = window as Window_ & { startedAt?: number; done?: Promise<number> }
    Object.assign(w, { longTasks: [], clickDurations: [], startedAt: undefined })
    addEventListener('pointerdown', () => (w.startedAt = performance.now()), { capture: true, once: true })
    w.done = new Promise((resolve) => {
      new MutationObserver((_, observer) => {
        if (!status.textContent?.startsWith('Validation finished')) return
        observer.disconnect()
        // The next frame after the result is rendered: about when it is painted.
        requestAnimationFrame(() => setTimeout(() => resolve(performance.now())))
      }).observe(status, { subtree: true, childList: true, characterData: true })
    })
  })
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
  return page.evaluate(async () => {
    const w = window as Window_ & { startedAt: number; done: Promise<number> }
    const doneAt = await w.done
    // Let any trailing long task land.
    await new Promise((resolve) => setTimeout(resolve, 500))
    const tasks = w.longTasks.filter((t) => t.start >= w.startedAt - 5)
    return {
      total: doneAt - w.startedAt,
      longestTask: Math.max(0, ...tasks.map((t) => t.duration)),
      blocked: tasks.reduce((sum, t) => sum + t.duration, 0),
      click: Math.max(16, ...w.clickDurations),
    }
  })
}

for (const datasets of [undefined, 3_000, 10_000]) {
  const name = datasets === undefined ? 'sample catalog' : `${datasets.toLocaleString('en-US')} datasets`
  test(`validate the ${name}`, async ({ page }) => {
    const throttle = await open(page, datasets)
    const runs = []
    for (let i = 0; i < 3; i++) runs.push(await validate(page))
    await expect(page.locator('.catalog-check')).toBeVisible()
    const fmt = (key: keyof (typeof runs)[number]) => runs.map((r) => Math.round(r[key])).join(' / ')
    console.log(
      [
        `${name}, CPU throttle ${throttle}× (3 runs)`,
        `  click to result painted:   ${fmt('total')} ms`,
        `  main thread blocked:       ${fmt('blocked')} ms (longest task ${fmt('longestTask')} ms)`,
        `  click input-to-next-paint: ${fmt('click')} ms`,
      ].join('\n'),
    )
  })
}
