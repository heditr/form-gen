import { test, expect } from '@playwright/test';
import path from 'path';
import { writeFileSync, mkdirSync } from 'fs';

test.describe('Autocomplete Transparency Issue', () => {
  test('should identify transparency issue when country selection changes', async ({ page }) => {
    // Navigate to demo page
    await page.goto('http://localhost:3001/demo');
    
    // Wait for page to load - wait for the form container or country field
    await page.waitForSelector('[data-testid*="dropdown-field-country"], select[id="country"]', { timeout: 15000 });
    
    // Create screenshots directory
    const screenshotsDir = path.join(process.cwd(), 'test-results', 'screenshots');
    mkdirSync(screenshotsDir, { recursive: true });
    
    // Step 1: Take initial screenshot
    await page.screenshot({ 
      path: path.join(screenshotsDir, '01-initial-state.png'),
      fullPage: true 
    });
    
    // Step 2: Open city autocomplete before country change
    const cityField = page.locator('input[id="city"]').first();
    await cityField.click();
    await page.waitForTimeout(500); // Wait for dropdown to appear
    
    // Check if dropdown is visible and take screenshot
    const dropdownBefore = page.locator('[role="listbox"]').first();
    const isVisibleBefore = await dropdownBefore.isVisible();
    
    await page.screenshot({ 
      path: path.join(screenshotsDir, '02-autocomplete-before-country-change.png'),
      fullPage: true 
    });
    
    // Get computed styles before country change
    const stylesBefore = await dropdownBefore.evaluate((el) => {
      const computed = window.getComputedStyle(el);
      return {
        backgroundColor: computed.backgroundColor,
        opacity: computed.opacity,
        visibility: computed.visibility,
        zIndex: computed.zIndex,
        display: computed.display,
      };
    });
    
    console.log('Styles before country change:', stylesBefore);
    
    // Step 3: Change country selection
    const countryField = page.locator('select[id="country"]').first();
    await countryField.selectOption('US');
    await page.waitForTimeout(1000); // Wait for re-hydration
    
    // Step 4: Close and reopen city autocomplete after country change
    // Click outside to close
    await page.click('body', { position: { x: 10, y: 10 } });
    await page.waitForTimeout(500);
    
    // Reopen city autocomplete
    await cityField.click();
    await page.waitForTimeout(500);
    
    // Check dropdown visibility and styles after country change
    const dropdownAfter = page.locator('[role="listbox"]').first();
    const isVisibleAfter = await dropdownAfter.isVisible();
    
    await page.screenshot({ 
      path: path.join(screenshotsDir, '03-autocomplete-after-country-change.png'),
      fullPage: true 
    });
    
    // Get computed styles after country change
    const stylesAfter = await dropdownAfter.evaluate((el) => {
      const computed = window.getComputedStyle(el);
      return {
        backgroundColor: computed.backgroundColor,
        opacity: computed.opacity,
        visibility: computed.visibility,
        zIndex: computed.zIndex,
        display: computed.display,
        popoverBg: getComputedStyle(document.documentElement).getPropertyValue('--popover'),
        popoverFg: getComputedStyle(document.documentElement).getPropertyValue('--popover-foreground'),
      };
    });
    
    console.log('Styles after country change:', stylesAfter);
    
    // Step 5: Test multiple country changes
    await countryField.selectOption('CA');
    await page.waitForTimeout(1000);
    await page.click('body', { position: { x: 10, y: 10 } });
    await page.waitForTimeout(500);
    await cityField.click();
    await page.waitForTimeout(500);
    
    await page.screenshot({ 
      path: path.join(screenshotsDir, '04-autocomplete-after-ca-change.png'),
      fullPage: true 
    });
    
    const stylesAfterCA = await dropdownAfter.evaluate((el) => {
      const computed = window.getComputedStyle(el);
      return {
        backgroundColor: computed.backgroundColor,
        opacity: computed.opacity,
        visibility: computed.visibility,
      };
    });
    
    console.log('Styles after CA change:', stylesAfterCA);
    
    // Assertions and findings
    const findings = {
      isVisibleBefore,
      isVisibleAfter,
      stylesBefore,
      stylesAfter,
      stylesAfterCA,
      transparencyIssue: stylesAfter.opacity !== stylesBefore.opacity || 
                        stylesAfter.backgroundColor === 'rgba(0, 0, 0, 0)' ||
                        stylesAfter.backgroundColor === 'transparent',
    };
    
    console.log('Findings:', JSON.stringify(findings, null, 2));
    
    // Write findings to file
    const findingsPath = path.join(screenshotsDir, 'findings.json');
    writeFileSync(findingsPath, JSON.stringify(findings, null, 2));
  });
});
