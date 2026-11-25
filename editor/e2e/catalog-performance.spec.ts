/**
 * Measures the whole loop of #29 on generated catalogs of 300, 1,000, 3,000 and 6,000 datasets: load (choose the file
 * to the tree painted), memory, scroll, filter, edit, autosave to browser storage, restore on reload, check and export.
 * Each action runs 3 times; the table shows the slowest. Interactions are timed from input to the next paint with the
 * Event Timing API, as INP is (target: 100 ms, https://web.dev/articles/rail); longer jobs from the input until their
 * result is painted. tree-performance and validation-performance time more tree, picker and check actions at 3,000.
 * Opt-in, since timings vary by machine:
 *
 *   PERF=1 npx playwright test catalog-performance       # CPU_THROTTLE=4 to emulate a slower laptop
 *   CHANNEL=msedge PERF=1 npx playwright test catalog-performance   # in installed Edge (or chrome), with a new profile
 *
 * The 3,000-dataset run at CPU_THROTTLE=1 fails if a measurement misses its budget (BUDGETS). These are the budgets
 * proposed in #29, not agreed targets; the measurements behind them are in docs/performance.md.
 *
 * Nothing here waits with a locator or expect(): their polling runs on the page's main thread and would slow what it
 * times. Each wait is a MutationObserver in the page, and clicks are page.mouse clicks.
 */
import { devices, type CDPSession, type Page } from '@playwright/test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test, expect } from './fixtures'
import { largeCatalog } from '../fixtures/largeCatalog'

test.skip(!process.env.PERF, 'set PERF=1 to measure')
test.setTimeout(900_000)

const RUNS = 3

/**
 * The slowest run allowed of each action on 3,000 datasets at full CPU speed, in ms (#29, proposed). Input to next
 * paint is held to 100 ms (https://web.dev/articles/rail); longer jobs to what a person waits for without losing track.
 */
const BUDGETS: Record<string, number> = {
  'load: choose the file to the tree painted': 3_000,
  'scroll: longest frame': 100,
  'filter: type a key': 100,
  'edit: type a key in a field': 100,
  'save: leave the field to "Saved" painted': 1_000,
  'save: leave the field (Tab)': 100,
  'restore: reload to the tree painted': 2_000,
  'check: click to result painted': 1_000,
  'check: click': 100,
  'export: click to file offered and painted': 1_000,
  'export: click': 100,
}
const HEAP_BUDGET_MB = 150

type PerfWindow = Window & {
  durations: number[]
  longFrames: number[]
  inputAt: number
  untilPainted: (done: () => boolean, what?: string) => Promise<number>
  after: (type: string, done: () => boolean, what?: string) => Promise<number>
  pending?: Promise<number>
}

/**
 * Records Event Timing entries (only those over 16 ms are reported), long animation frames (over 50 ms), and the time
 * of the last input. `untilPainted` resolves, with the time, at the next frame after `done()` first holds (failing
 * after a minute, with `what` it waited for). `after` waits for the next event of `type`, then until `done()` holds, and
 * resolves with the time from the event to that paint. Its listener is added at once, before the test acts.
 */
function observe() {
  const w = window as unknown as PerfWindow
  w.durations = []
  w.longFrames = []
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries() as PerformanceEventTiming[]) if (entry.interactionId) w.durations.push(entry.duration)
  }).observe({ type: 'event', durationThreshold: 16, buffered: false } as PerformanceObserverInit)
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) w.longFrames.push(entry.duration)
  }).observe({ type: 'long-animation-frame', buffered: false })
  for (const type of ['keydown', 'pointerdown', 'change']) addEventListener(type, () => (w.inputAt = performance.now()), true)
  w.untilPainted = (done, what = 'the page') =>
    new Promise((resolve, reject) => {
      const timeout = setTimeout(() => (observer.disconnect(), reject(new Error(`Timed out waiting for ${what}`))), 60_000)
      const finish = () => (clearTimeout(timeout), requestAnimationFrame(() => setTimeout(() => resolve(performance.now()))))
      const observer = new MutationObserver(() => done() && (observer.disconnect(), finish()))
      if (done()) return finish()
      observer.observe(document, { subtree: true, childList: true, characterData: true, attributes: true })
    })
  w.after = (type, done, what) =>
    new Promise<number>((resolve) => addEventListener(type, () => resolve(performance.now()), { capture: true, once: true })).then(
      async (at) => (await w.untilPainted(done, what)) - at,
    )
}

/** Waits for the promise `after` armed in the page, and returns its time. */
const pending = (page: Page) => page.evaluate(() => (window as unknown as PerfWindow).pending!)

/** Clears the recorded interactions and frames. */
const reset = (page: Page) => page.evaluate(() => Object.assign(window, { durations: [], longFrames: [] }))

/** Waits until the page is idle, then returns the longest interaction since `reset` (under 16 ms counts as 16). */
async function slowestInteraction(page: Page) {
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 500))))
  return page.evaluate(() => Math.max(16, ...(window as unknown as PerfWindow).durations))
}

/** Clicks the centre of the first element matching `selector` whose text is `text`, scrolling it into view first. */
async function click(page: Page, selector: string, text?: string) {
  const box = await page.evaluate(
    ([selector, text]) => {
      const element = [...document.querySelectorAll(selector)].find((e) => text === undefined || e.textContent?.trim() === text)!
      element.scrollIntoView({ block: 'center' })
      const { x, y, width, height } = element.getBoundingClientRect()
      return { x: x + width / 2, y: y + height / 2 }
    },
    [selector, text] as const,
  )
  await page.mouse.click(box.x, box.y)
}

/** JS heap in use after a garbage collection, and the number of DOM nodes, of the page (not its workers). */
async function memory(cdp: CDPSession) {
  await cdp.send('HeapProfiler.collectGarbage')
  const { usedSize } = await cdp.send('Runtime.getHeapUsage')
  const { nodes } = await cdp.send('Memory.getDOMCounters')
  return { heapMB: usedSize / 2 ** 20, nodes }
}

for (const datasets of [300, 1_000, 3_000, 6_000]) {
  const size = datasets.toLocaleString('en-US')
  test(`load, scroll, filter, edit, save, restore, check and export ${size} datasets`, async ({ playwright }, testInfo) => {
    // A browser profile on disk, as people have. Playwright's usual contexts keep IndexedDB in memory, where storing a
    // catalog of 3,000 datasets took 7 times as long (10 s rather than 1.5 s for its 33,000 records, on an M3 Pro).
    const profile = await mkdtemp(join(tmpdir(), 'inventory-perf-'))
    const context = await playwright.chromium.launchPersistentContext(profile, {
      viewport: devices['Desktop Chrome'].viewport,
      channel: process.env.CHANNEL,
      baseURL: testInfo.project.use.baseURL,
    })
    const page = context.pages()[0] ?? (await context.newPage())
    try {
      await measureAll(page, datasets)
    } finally {
      await context.close()
      await rm(profile, { recursive: true, force: true })
    }
  })
}

/** Runs each action on a generated catalog of `datasets` datasets and logs the slowest run of each. */
async function measureAll(page: Page, datasets: number) {
  const size = datasets.toLocaleString('en-US')
  const throttle = Number(process.env.CPU_THROTTLE ?? 1)
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: throttle })
  await page.addInitScript(observe)
  const results: [string, number[]][] = []
  const record = (name: string, value: number) => {
    const row = results.find(([n]) => n === name) ?? results[results.push([name, []]) - 1]
    row[1].push(value)
  }
  const json = JSON.stringify(largeCatalog(datasets))

  // Load: from the file input's change to the catalog's datasets painted in the tree (the worker reads, parses and
  // decomposes; the page stores the catalog in IndexedDB, then renders). One file per page, so one run per test.
  await page.goto('/import')
  await page.getByLabel('Choose a DCAT-US 3.0 JSON file').setInputFiles({ name: 'large.json', mimeType: 'application/json', buffer: Buffer.from(json) })
  const loaded = await page.evaluate(async (datasets) => {
    const w = window as unknown as PerfWindow
    const shown = () => document.querySelectorAll('[role="treeitem"]').length > datasets
    return (await w.untilPainted(shown)) - w.inputAt
  }, datasets)
  record('load: choose the file to the tree painted', loaded)
  const { heapMB, nodes } = await memory(cdp)

  // Scroll: the tree from top to bottom with the mouse wheel; the longest animation frame while it scrolls.
  for (let i = 0; i < RUNS; i++) {
    // The tree at the top of its pane, and the page scrolled so the pane is pinned to the top of the window.
    await page.evaluate(() => {
      document.querySelector('.catalog-tree')!.scrollTop = 0
      document.querySelector('.editor-nav')!.scrollIntoView()
    })
    const box = (await page.locator('.catalog-tree').boundingBox())!
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await reset(page)
    for (let step = 0; step < 20; step++) await page.mouse.wheel(0, (datasets * 24) / 20)
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 500))))
    if (!(await page.evaluate(() => document.querySelector('.catalog-tree')!.scrollTop))) throw new Error('The tree did not scroll')
    record('scroll: longest frame', await page.evaluate(() => Math.max(16, ...(window as unknown as PerfWindow).longFrames)))
  }

  // Filter: a key typed in the filter box, from input to the next paint and to the tree painted.
  for (let i = 0; i < RUNS; i++) {
    await click(page, '#tree-filter')
    await page.keyboard.press('ControlOrMeta+A')
    await page.keyboard.press('Backspace')
    await page.evaluate((datasets) => (window as unknown as PerfWindow).untilPainted(() => document.querySelectorAll('[role="treeitem"]').length > datasets), datasets)
    await reset(page)
    await page.evaluate(() => {
      const w = window as unknown as PerfWindow
      const status = document.querySelector('#tree-filter ~ [role="status"]')!
      w.pending = w.after('keydown', () => /objects? match/.test(status.textContent ?? ''), 'the filtered tree')
    })
    await page.keyboard.press('w')
    const shown = await pending(page)
    record('filter: type a key', await slowestInteraction(page))
    record('filter: key to tree painted', shown)
  }
  await page.keyboard.press('Backspace')
  await page.evaluate((datasets) => (window as unknown as PerfWindow).untilPainted(() => document.querySelectorAll('[role="treeitem"]').length > datasets), datasets)

  // Edit and autosave: type in a dataset's title, then Tab out, which saves the field and stores the catalog.
  for (let i = 0; i < RUNS; i++) {
    const title = `Water use ${i * Math.floor(datasets / RUNS / 6) * 6 + 1}`
    await click(page, '.catalog-tree__label', title)
    await page.evaluate((title) => (window as unknown as PerfWindow).untilPainted(() => document.querySelector<HTMLInputElement>('#field-title')?.value === title, title), title)
    // Focused, not clicked: the page may still be scrolling to the dataset's form.
    await page.evaluate(() => {
      const input = document.querySelector<HTMLInputElement>('#field-title')!
      input.focus()
      input.setSelectionRange(input.value.length, input.value.length)
    })
    await reset(page)
    for (const key of ' edited') await page.keyboard.press(key === ' ' ? 'Space' : key)
    record('edit: type a key in a field', await slowestInteraction(page))
    await reset(page)
    await page.evaluate(() => {
      const w = window as unknown as PerfWindow
      const status = [...document.querySelectorAll('p')].find((p) => /· (Saved|Saving…|Not saved)$/.test(p.textContent ?? ''))!
      let saving = false
      w.pending = w.after(
        'keydown',
        () => {
          if (status.textContent!.endsWith('Saving…')) saving = true
          return saving && status.textContent!.endsWith('· Saved')
        },
        '"Saved"',
      )
    })
    await page.keyboard.press('Tab')
    record('save: leave the field to "Saved" painted', await pending(page))
    record('save: leave the field (Tab)', await slowestInteraction(page))
  }

  // Restore: reload the editor's address; from navigation start to the tree painted from browser storage.
  for (let i = 0; i < RUNS; i++) {
    await page.reload()
    const restored = await page.evaluate((datasets) => (window as unknown as PerfWindow).untilPainted(() => document.querySelectorAll('[role="treeitem"]').length > datasets), datasets)
    record('restore: reload to the tree painted', restored)
  }
  const edited = await page.evaluate(() => [...document.querySelectorAll('.catalog-tree__label')].filter((e) => e.textContent?.endsWith(' edited')).length)
  if (edited !== RUNS) throw new Error(`Expected ${RUNS} edited titles after reload, found ${edited}`)

  // Check: Validate catalog, from the click until the result is announced and painted. The button shows once the
  // validator has loaded.
  await page.evaluate(() =>
    (window as unknown as PerfWindow).untilPainted(() =>
      [...document.querySelectorAll('.catalog-actions button')].some((b) => b.textContent?.startsWith('Validate catalog')),
    ),
  )
  for (let i = 0; i < RUNS; i++) {
    await reset(page)
    await page.evaluate(() => {
      const w = window as unknown as PerfWindow
      const status = [...document.querySelectorAll('[role="status"]')].find((s) => s.matches('.usa-sr-only'))!
      // The click clears the last result first, so a result after that is this check's.
      let cleared = false
      w.pending = w.after(
        'pointerdown',
        () => {
          if (!status.textContent) cleared = true
          return cleared && !!status.textContent?.startsWith('Validation finished')
        },
        'the check',
      )
    })
    await click(page, '.catalog-actions button', 'Validate catalogValidating…')
    record('check: click to result painted', await pending(page))
    record('check: click', await slowestInteraction(page))
  }

  // Export: from the click until the file is offered (the download link's click) and the next frame is painted.
  for (let i = 0; i < RUNS; i++) {
    await reset(page)
    const download = page.waitForEvent('download')
    await page.evaluate(() => {
      const w = window as unknown as PerfWindow
      let offered = false
      const click = HTMLAnchorElement.prototype.click
      HTMLAnchorElement.prototype.click = function (this: HTMLAnchorElement) {
        HTMLAnchorElement.prototype.click = click
        click.call(this)
        offered = !!this.download
      }
      // The status is set in the same task as the download link's click, so it changes the page then.
      w.pending = w.after('pointerdown', () => offered, 'the export')
    })
    await click(page, '.catalog-actions button', 'Export catalog')
    record('export: click to file offered and painted', await pending(page))
    record('export: click', await slowestInteraction(page))
    await download
  }

  const mb = (Buffer.byteLength(json) / 2 ** 20).toFixed(1)
  const browser = await page.evaluate(() => {
    const { brands } = (navigator as Navigator & { userAgentData: { brands: { brand: string; version: string }[] } }).userAgentData
    const { brand, version } = brands.find((b) => !/Not.A.Brand|^Chromium$/.test(b.brand)) ?? brands[0]
    return `${brand} ${version}`
  })
  console.log(
    [
      `${size} datasets (${mb} MB), ${browser}, CPU throttle ${throttle}×; after load: ${heapMB.toFixed(0)} MB JS heap, ${nodes.toLocaleString('en-US')} DOM nodes`,
      ...results.map(([name, ms]) => `  ${name.padEnd(44)} worst ${Math.round(Math.max(...ms))} ms  (${ms.map(Math.round).join(' / ')})`),
    ].join('\n'),
  )
  if (datasets !== 3_000 || throttle !== 1) return
  for (const [name, ms] of results) {
    if (name in BUDGETS) expect.soft(Math.round(Math.max(...ms)), `${name} (budget ${BUDGETS[name]} ms)`).toBeLessThanOrEqual(BUDGETS[name])
  }
  expect.soft(Math.round(heapMB), `JS heap after load, MB (budget ${HEAP_BUDGET_MB})`).toBeLessThanOrEqual(HEAP_BUDGET_MB)
}
