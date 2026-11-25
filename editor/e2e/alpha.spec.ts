import { readFileSync } from 'node:fs'
import type { Page } from '@playwright/test'
import { test, expect, expectNoAxeViolations } from './fixtures'

// #32: the alpha banner on every page, the notice on where the catalog is kept, the help page, and the feedback link.

const banner = (page: Page) => page.getByRole('region', { name: 'Alpha' })
const notice = (page: Page) => page.locator('.usa-alert').filter({ hasText: 'Where your catalog is kept:' })
const FEEDBACK_URL = 'https://github.com/GSA/datagov-inventory/issues/new?template=alpha-feedback.yml'

async function expectBanner(page: Page) {
  await expect(banner(page)).toBeVisible()
  await expect(banner(page)).toHaveText('Alpha: an early test version. Limits and feedback')
  await expect(banner(page).getByRole('link', { name: 'Limits and feedback' })).toHaveAttribute(
    'href',
    '/help',
  )
}

test('every page says it is an alpha, and links to the help page', async ({ page }) => {
  for (const [path, heading] of [
    ['/', 'Edit your DCAT-US 3.0 catalog in this browser'],
    ['/import', 'Import a catalog'],
    ['/editor', 'No catalog open'],
    ['/editor/byND73XUQ6eHsUP6ks4Kog', 'Catalog not found in this browser'],
    ['/editor/not-a-catalog-token', 'Invalid editor address'],
    ['/help', 'Help'],
    ['/no-such-page', 'Page not found'],
  ]) {
    await test.step(path, async () => {
      await page.goto(path)
      await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible()
      await expectBanner(page)
    })
  }

  await test.step('the editor on a loaded catalog', async () => {
    await page.goto('/import')
    await page.getByLabel('Sample catalog').selectOption('minimal-catalog.json')
    await page.getByRole('button', { name: 'Load sample' }).click()
    await expect(page).toHaveURL(/\/editor\/[A-Za-z0-9_-]{22}$/)
    await expectBanner(page)
  })

  await test.step("the banner's link opens the help page", async () => {
    await banner(page).getByRole('link', { name: 'Limits and feedback' }).click()
    await expect(page).toHaveURL('/help')
    await expect(page.getByRole('heading', { level: 1, name: 'Help' })).toBeFocused()
  })
})

test('a first visit is told where the catalog is kept, before importing', async ({ page }) => {
  // Each test starts in a new browser context, with nothing stored: a first visit.
  for (const path of ['/', '/import']) {
    await test.step(path, async () => {
      await page.goto(path)
      await expect(notice(page)).toHaveText(
        'Where your catalog is kept: in this browser, on this device. It is not sent anywhere or backed up, so ' +
          "export it to keep a copy. To remove it, clear this site's data in your browser settings. " +
          'More about where your catalog is kept',
      )
      await expect(notice(page).getByRole('link', { name: 'More about where your catalog is kept' })).toHaveAttribute(
        'href',
        '/help',
      )
      await expectNoAxeViolations(page)
    })
  }
})

test('the help page explains how to give feedback, storage, the check, and the known limits', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('link', { name: 'Help', exact: true }).click()
  await expect(page).toHaveURL('/help')
  await expect(page).toHaveTitle('Help | Inventory Editor')
  await expect(page.getByRole('heading', { level: 1, name: 'Help' })).toBeFocused()
  await expect(page.getByRole('link', { name: 'Help', exact: true })).toHaveAttribute('aria-current', 'page')
  const main = page.getByRole('main')
  await expect(main.getByRole('heading', { level: 2 })).toHaveText([
    'Give feedback',
    'Where your catalog is kept',
    'What “Validate catalog” checks',
    'Known limits',
  ])

  await test.step('where the catalog is kept', async () => {
    await expect(main).toContainText('Each catalog you import stays in this browser, on this device')
    await expect(main).toContainText('It is not uploaded or sent anywhere.')
    await expect(main).toContainText('It is not backed up.')
    await expect(main).toContainText("To remove it, clear this site's data in your browser settings.")
  })

  await test.step('the check: advisory, the schema version, not the official validator', async () => {
    const pin = JSON.parse(readFileSync(new URL('../schema/dcat-us.pin.json', import.meta.url), 'utf8'))
    const check = main.locator('h2:has-text("Validate catalog") + p')
    await expect(check).toContainText('The check is advisory.')
    await expect(check).toContainText('DCAT-US 3.0 schema as of')
    await expect(check).toContainText(`GSA/dcat-us commit ${pin.commit.slice(0, 7)}`)
    await expect(check).toContainText('It is not the official Data.gov validator')
  })

  await test.step('known limits and the browsers tested', async () => {
    await expect(main.locator('h2:has-text("Known limits") + ul > li')).toHaveText([
      'DCAT-US 3.0 JSON only. It does not open data.json (DCAT-US 1.1) or JSON-LD files.',
      'One catalog open at a time. Importing another opens it in place of the open one, and the earlier one stays ' +
        'in this browser at its own address.',
      'Tested with catalogs of up to 3,000 datasets.',
      'Automated tests run in Chromium, the engine in Chrome and Edge. Firefox and Safari are not tested yet.',
    ])
  })

  await test.step('the feedback link opens the GitHub issue form, with a warning and nothing attached', async () => {
    await expect(main).toContainText(
      'Do not paste catalog content, personal information or anything that is not public. Nothing from your ' +
        'catalog is attached.',
    )
    // Exactly the form, with no prefilled fields that could carry catalog content.
    await expect(main.getByRole('link', { name: 'Give feedback on GitHub (external site)' })).toHaveAttribute(
      'href',
      FEEDBACK_URL,
    )
  })

  await expectNoAxeViolations(page)
})

test('the feedback form the link opens exists, and warns against sensitive data', () => {
  const template = new URL(FEEDBACK_URL).searchParams.get('template')
  const form = readFileSync(new URL(`../../.github/ISSUE_TEMPLATE/${template}`, import.meta.url), 'utf8')
  expect(form).toContain('**This issue is public.** Do not paste catalog content, personal information')
  expect(form).toContain('I have not included catalog content, personal information, or anything that is not public.')
})
