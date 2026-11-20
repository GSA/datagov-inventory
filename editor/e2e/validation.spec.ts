import type { Page } from '@playwright/test'
import { test, expect, expectNoAxeViolations } from './fixtures'
import { largeCatalog } from '../fixtures/largeCatalog'

const DATASET = 'Air quality readings'

async function openDataset(page: Page) {
  await page.goto('/import')
  await page.getByLabel('Sample catalog').selectOption('dataset-with-distributions.json')
  await page.getByRole('button', { name: 'Load sample' }).click()
  await expect(page).toHaveURL(/\/editor\/[A-Za-z0-9_-]{22}$/)
  await page.getByRole('treeitem', { name: `${DATASET} dataset · Dataset` }).click()
  return page.getByRole('form', { name: `Edit ${DATASET}` })
}

async function enterInvalidIssuedDate(page: Page) {
  const form = await openDataset(page)
  const issued = form.getByRole('textbox', { name: /^Issued/ })
  await issued.fill('not a date')
  await issued.blur()
  return form
}

test.describe('Validation', () => {
  test('validates an object and shows inline field errors', async ({ page }) => {
    const form = await enterInvalidIssuedDate(page)

    await form.getByRole('button', { name: `Validate ${DATASET}` }).click()

    await expect(form.getByRole('alert').filter({ hasText: 'Validation errors' })).toContainText('Issued')
    await expect(form.locator('.usa-error-message')).toHaveText('is not in an accepted form')
    await expect(form.locator('.validation-badge--invalid')).toContainText(/error/i)
  })

  test('shows a validation summary for the catalog', async ({ page }) => {
    await openDataset(page)

    await page.getByRole('button', { name: 'Validate catalog' }).click()

    const results = page.getByRole('region', { name: 'Validation results' })
    await expect(results).toContainText('No errors found')
    await expect(results).toContainText(/advisory.*3\.0\.0/i)
  })

  test('marks validation as stale after an edit', async ({ page }) => {
    const form = await openDataset(page)

    await form.getByRole('button', { name: `Validate ${DATASET}` }).click()
    await expect(form.locator('.validation-badge--valid')).toBeVisible()

    const title = form.getByRole('textbox', { name: /^Title/ })
    await title.fill('Updated Title')
    await title.blur()

    await expect(page.locator('.validation-badge--stale')).toBeVisible()
  })

  test('warns before exporting a catalog with errors', async ({ page }) => {
    await enterInvalidIssuedDate(page)

    await page.getByRole('button', { name: 'Validate catalog' }).click()
    await expect(page.getByRole('region', { name: 'Validation results' })).toContainText(/errors? found/)

    await page.getByRole('button', { name: 'Export catalog' }).click()

    const dialog = page.getByRole('dialog')
    await expect(dialog).toContainText('Validation Errors Detected')
    await expect(dialog).toContainText('did not pass')
    await expect(dialog.getByRole('button', { name: 'Download Anyway' })).toBeVisible()
  })

  test('announces validation errors to screen readers', async ({ page }) => {
    const form = await enterInvalidIssuedDate(page)

    await form.getByRole('button', { name: `Validate ${DATASET}` }).click()

    const alert = form.getByRole('alert').filter({ hasText: 'Validation errors' })
    await expect(alert).toHaveAttribute('aria-live', 'polite')
    await expect(alert).toContainText('Issued')
  })

  test('does not rely on color alone for errors', async ({ page }) => {
    const form = await enterInvalidIssuedDate(page)

    await form.getByRole('button', { name: `Validate ${DATASET}` }).click()

    const badge = form.locator('.validation-badge--invalid')
    await expect(badge.locator('.validation-badge__icon')).toHaveText('✕')
    await expect(badge).toContainText(/\d+ errors?/)
  })

  test('navigates to an object with errors from the summary', async ({ page }) => {
    await enterInvalidIssuedDate(page)
    await page.getByRole('treeitem', { name: 'Example Agency Catalog', exact: true }).click()

    await page.getByRole('button', { name: 'Validate catalog' }).click()
    await page.getByRole('button', { name: /^Air quality readings \(\d+ errors?\)$/ }).click()

    await expect(page).toHaveURL(/\/editor\/[A-Za-z0-9_-]{22}\/dataset\/[A-Za-z0-9_-]{22}$/)
    await expect(page.getByRole('form', { name: `Edit ${DATASET}` })).toBeVisible()
  })
})

test('marks an empty required link field in the field itself', async ({ page }) => {
  const form = await openDataset(page)
  // An empty required link field.
  const contacts = form.getByRole('group', { name: /^Contact Point/ })
  await contacts.getByRole('button', { name: /^Remove Air Quality Team/ }).click()
  await form.getByRole('button', { name: `Validate ${DATASET}` }).click()
  await expect(contacts.locator('.usa-error-message')).toHaveText('Contact Point is required')
  await expect(contacts.getByText('This required field has no values')).toHaveCount(0)
})

/** Holds the validation worker's results until `releaseValidation()`, so a check runs as long as a test needs. */
function holdValidationResults() {
  const w = window as unknown as { holdValidation: boolean; releaseValidation: () => void; held: (() => void)[] }
  Object.assign(w, { holdValidation: false, held: [] })
  w.releaseValidation = () => {
    w.holdValidation = false
    w.held.splice(0).forEach((deliver) => deliver())
  }
  window.Worker = class extends window.Worker {
    addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions) {
      const deliver = (event: Event) =>
        typeof listener === 'function' ? listener.call(this, event) : listener.handleEvent(event)
      super.addEventListener(
        type,
        (event) => {
          if (w.holdValidation && (event as MessageEvent).data?.type === 'result') w.held.push(() => deliver(event))
          else deliver(event)
        },
        options,
      )
    }
  }
}

/**
 * Records, after every change to the page, where the heading, the catalog's actions, the tree and the object form are,
 * whether there is a progress bar, whether the Validate button is busy, and whether the results are shown. Returns a
 * check that nothing above the results moved, and nothing below them either until they appeared.
 */
async function recordLayout(page: Page) {
  await page.evaluate(() => {
    const box = (element: Element | null) => {
      const r = element!.getBoundingClientRect()
      return [r.x, r.y, r.width, r.height].map(Math.round).join(',')
    }
    // Where it starts: its contents (the form's status badge, say) may change its height without moving anything.
    const position = (element: Element | null) => box(element).split(',').slice(0, 2).join(',')
    const snapshot = () => ({
      above: [box(document.querySelector('h1')), ...[...document.querySelectorAll('.catalog-actions .usa-button')].map(box)],
      below: [position(document.querySelector('.editor-nav')), position(document.querySelector('form.object-form'))],
      progressBars: document.querySelectorAll('[role="progressbar"], progress').length,
      busy: !!document.querySelector('.catalog-actions [aria-disabled="true"]'),
      results: !!document.querySelector('.validation-summary'),
    })
    const w = window as unknown as { layouts: ReturnType<typeof snapshot>[] }
    w.layouts = [snapshot()]
    new MutationObserver(() => w.layouts.push(snapshot())).observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      characterData: true,
    })
  })
  return async () => {
    const [before, ...after] = await page.evaluate(
      () =>
        (window as unknown as { layouts: { above: string[]; below: string[]; progressBars: number; busy: boolean; results: boolean }[] })
          .layouts,
    )
    expect(after.length).toBeGreaterThan(0)
    for (const layout of after) {
      expect(layout.progressBars).toBe(0)
      // Nothing above the results ever moves; what is below moves only once the results are there to push it.
      expect(layout.above).toEqual(before.above)
      if (!layout.results || before.results) expect(layout.below).toEqual(before.below)
    }
    return after
  }
}

test.describe('Validate catalog feedback', () => {
  test('a quick check shows no progress bar and moves nothing but the results', async ({ page }) => {
    await openDataset(page)
    const button = page.getByRole('button', { name: 'Validate catalog' })
    const status = page.getByRole('status').filter({ hasText: /^Validat/ })

    let check = await recordLayout(page)
    await button.click()
    await expect(page.getByRole('region', { name: 'Validation results' })).toContainText('No errors found')
    // The button never changed: a quick check is over before "Validating…" would show.
    expect((await check()).some((layout) => layout.busy)).toBe(false)
    await expect(status).toHaveText('Validation finished: no errors found.')
    await expect(button).toBeFocused()

    // Checking again, with the results already shown, moves nothing at all.
    check = await recordLayout(page)
    await button.click()
    await expect(status).toHaveText('Validation finished: no errors found.')
    expect((await check()).some((layout) => layout.busy)).toBe(false)
    await expectNoAxeViolations(page)
  })

  test('a long check on 3,000 datasets says so in the button, without moving the page', async ({ page }) => {
    await page.addInitScript(holdValidationResults)
    await page.goto('/import')
    await page.getByLabel('Choose a DCAT-US 3.0 JSON file').setInputFiles({
      name: 'large.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(largeCatalog())),
    })
    await expect(page.getByRole('tree').getByRole('treeitem')).toHaveCount(1 + 3_000)
    const button = page.locator('.catalog-actions .usa-button').nth(1)
    await expect(button).toHaveAccessibleName('Validate catalog')
    const status = page.getByRole('status').filter({ hasText: /^Validat/ })

    const check = await recordLayout(page)
    await page.evaluate(() => Object.assign(window, { holdValidation: true }))
    await button.click()
    // Past the delay, the button says it is busy, a click on it does nothing, and focus stays on it.
    await expect(button).toHaveAccessibleName('Validating…')
    await expect(button).toHaveAttribute('aria-disabled', 'true')
    await expect(button).toBeFocused()
    await expect(status).toHaveText('Validating catalog…')
    await page.keyboard.press('Enter')
    expect(await page.evaluate(() => (window as unknown as { held: unknown[] }).held.length)).toBe(1)
    await expectNoAxeViolations(page, '.catalog-actions')

    await page.evaluate(() => (window as unknown as { releaseValidation: () => void }).releaseValidation())
    await expect(status).toHaveText(/^Validation finished: (no errors|[\d,]+ errors?) found\.$/)
    await expect(page.getByRole('region', { name: 'Validation results' })).toBeVisible()
    await expect(button).toHaveAccessibleName('Validate catalog')
    await expect(button).not.toHaveAttribute('aria-disabled')
    await expect(button).toBeFocused()
    expect((await check()).some((layout) => layout.busy)).toBe(true)
  })
})
