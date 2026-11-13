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

/** WCAG 2.1 A and AA (ADR 0002), the rules #30 makes blocking. */
export const wcag21aa = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']

/** Fails with each axe violation on the page as it is now: rule, impact, and the elements that break it. */
export async function expectNoAxeViolations(page: Page) {
  const { violations } = await new AxeBuilder({ page }).withTags(wcag21aa).analyze()
  expect(violations.map(({ id, impact, nodes }) => ({ id, impact, targets: nodes.map((node) => node.target) }))).toEqual([])
}
