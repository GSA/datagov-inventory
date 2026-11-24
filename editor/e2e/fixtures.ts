import { test as base, expect, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

/** Fails any test whose page reports a CSP violation, from the console or a `securitypolicyviolation` event. */
export const test = base.extend<{ cspViolations: string[] }>({
  cspViolations: [
    async ({ page }, use) => {
      const violations: string[] = []
      page.on('console', (message) => {
        if (/Content Security Policy/i.test(message.text())) violations.push(message.text())
      })
      await page.exposeFunction('reportCspViolation', (text: string) => violations.push(text))
      await page.addInitScript(() => {
        document.addEventListener('securitypolicyviolation', (event) =>
          (window as unknown as { reportCspViolation: (text: string) => void }).reportCspViolation(
            `${event.violatedDirective} ${event.blockedURI}`,
          ),
        )
      })
      await use(violations)
      // Let events from the test's last step arrive before checking.
      if (!page.isClosed()) await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 50)))
      expect(violations).toEqual([])
    },
    { auto: true },
  ],
})

export { expect }

/** Waits until the current catalog's latest edit has committed to browser storage. */
export async function expectCatalogSaved(page: Page) {
  await expect(page.getByText(/· Saved$/)).toBeVisible()
}

/** WCAG 2.1 A and AA (ADR 0002), the rules #30 makes blocking. */
export const wcag21aa = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']

/**
 * Fails with each axe violation on the page as it is now: rule, impact, and the elements that break it. `include`: a
 * selector to check only part of the page (axe takes minutes on a tree of thousands of rows).
 */
export async function expectNoAxeViolations(page: Page, include?: string) {
  const builder = new AxeBuilder({ page }).withTags(wcag21aa)
  const { violations } = await (include ? builder.include(include) : builder).analyze()
  expect(violations.map(({ id, impact, nodes }) => ({ id, impact, targets: nodes.map((node) => node.target) }))).toEqual([])
}
