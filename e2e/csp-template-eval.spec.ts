import { test, expect } from '@playwright/test';

/**
 * Integration hosts send this policy. It allows remote and inline scripts
 * and rejects eval / new Function.
 */
const integrationCsp = "script-src * 'unsafe-inline'";

test('given the demo under the integration CSP, should evaluate templates without unsafe-eval', async ({ page }) => {
  const consoleText: string[] = [];
  page.on('console', (message) => {
    consoleText.push(message.text());
  });
  page.on('pageerror', (error) => {
    consoleText.push(error.message);
  });

  await page.route('**/*', async (route) => {
    if (route.request().resourceType() !== 'document') {
      await route.continue();
      return;
    }

    const response = await route.fetch();
    const headers = response.headers();
    delete headers['content-length'];
    const html = await response.text();
    const probe = '<script>try{new Function("return 1")();window.__cspEval="allowed"}catch(e){window.__cspEval=String(e&&e.message||e)}</script>';
    const body = html.includes('<head>') ? html.replace('<head>', `<head>${probe}`) : `${probe}${html}`;
    await route.fulfill({
      response,
      body,
      headers: {
        ...headers,
        'content-security-policy': integrationCsp,
      },
    });
  });

  const documentResponse = await page.goto('/demo');
  const cspHeader = documentResponse?.headers()['content-security-policy'] ?? '';
  expect(cspHeader, 'document response is missing the integration CSP').toContain("script-src * 'unsafe-inline'");
  expect(cspHeader).not.toContain('unsafe-eval');

  const evalMessage = await page.evaluate(() => (window as Window & { __cspEval?: string }).__cspEval ?? '');
  expect(evalMessage, 'browser CSP did not block new Function').toContain('unsafe-eval');

  const templateErrors = () =>
    consoleText.filter((line) => line.includes('Error evaluating template'));

  const jurisdiction = page.getByTestId('block-jurisdiction');
  await expect(jurisdiction.getByTestId('dropdown-field-country')).toBeVisible();
  await expect(
    jurisdiction.getByTestId('dropdown-field-state'),
    `State/Province should stay hidden until country is US or CA.\n${templateErrors().join('\n')}`
  ).toHaveCount(0);

  await jurisdiction.locator('#country').selectOption('US');

  await expect(jurisdiction.getByTestId('dropdown-field-state')).toBeVisible();
  await expect(jurisdiction.locator('#state option', { hasText: 'California' })).toHaveCount(1);
  expect(templateErrors(), templateErrors().join('\n')).toEqual([]);
});
