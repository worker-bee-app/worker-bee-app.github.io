import { test, expect } from '@playwright/test';

const sampleHints = `Spelling Bee Grid

Center letter is in bold.

P A C E H K Y

WORDS: 30, POINTS: 107, PANGRAMS: 1, BINGO

         4    5    6    8    Σ
A:       -    1    -    -    1
C:       2    2    -    -    4
E:       1    -    -    -    1
H:       2    1    -    -    3
K:       1    1    -    -    2
P:       8    6    3    1   18
Y:       -    1    -    -    1
Σ:      14   12    3    1   30

Two letter list:

AP-1
CA-1 CH-3
EP-1
HA-1 HE-1 HY-1
KA-1 KE-1
PA-8 PE-10
YA-1`;

test.describe('Worker Bee Tests', () => {

  test('FOUC mitigation: .loaded class is applied after initial render', async ({ page }) => {
    await page.goto('/');
    // Check that body eventually gets the .loaded class
    await expect(page.locator('body')).toHaveClass(/loaded/);
  });

  test('Hints Parsing & Desktop Flow', async ({ page, isMobile }) => {
    await page.goto('/');
    
    // Paste hints
    await page.fill('#hints-input', sampleHints);
    await page.click('#btn-load-hints');
    
    // Ensure the orbit wrapper (grid view) becomes visible
    await expect(page.locator('#orbit-wrapper')).toBeVisible();
    
    if (!isMobile) {
      // Check Desktop stats
      await expect(page.locator('#words-count')).toHaveText('0');
      await expect(page.locator('#words-total')).toHaveText('30');
      await expect(page.locator('#bingo-label')).toContainText('P, A, C, E, H, K, Y');
    } else {
      // Check Mobile stats
      // Switch to words tab first on mobile if needed, but sticky stats are always visible
      await expect(page.locator('#words-count-mob')).toHaveText('0');
      await expect(page.locator('#words-total-mob')).toHaveText('30');
      await expect(page.locator('#bingo-label-mob')).toContainText('P, A, C, E, H, K, Y');
    }
  });

  test('Words found local storage retention on refresh', async ({ page, isMobile }) => {
    await page.goto('/');
    
    // Paste hints to get access to the Words found box
    await page.fill('#hints-input', sampleHints);
    await page.click('#btn-load-hints');
    await expect(page.locator('#orbit-wrapper')).toBeVisible();
    
    // Enter words
    const testWords = "pace pack peach";
    if (isMobile) {
      await page.fill('#mob-found-input', testWords);
      await page.keyboard.press('Enter');
      await expect(page.locator('#words-count-mob')).toHaveText('3');
    } else {
      await page.fill('#found-input', testWords);
      await expect(page.locator('#words-count')).toHaveText('3');
    }
    
    // Refresh the page
    await page.reload();
    
    // Check that the grid view is still visible (hints retained)
    await expect(page.locator('#orbit-wrapper')).toBeVisible();
    
    // Check that the words are still in the state (found-input holds it even when hidden)
    await expect(page.locator('#found-input')).toHaveValue(testWords);
    
    // Check that stats are still calculated correctly
    if (isMobile) {
      await expect(page.locator('#words-count-mob')).toHaveText('3');
    } else {
      await expect(page.locator('#words-count')).toHaveText('3');
    }
  });

});
