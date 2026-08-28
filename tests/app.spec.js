import { test, expect } from '@playwright/test';

const sampleHints = `Puzzle Grid

Center letter is in bold.

A B C D E F G

WORDS: 18, POINTS: 75, PANGRAMS: 0

       4  5  6  7  TOT
A:     2  -  -  -   2
B:     3  1  -  1   5
C:     2  -  -  1   3
D:     3  -  1  -   4
F:     2  -  1  -   3
G:     1  -  -  -   1
TOT:  13  1  2  2  18

Two letter list:

AB-1 AG-1
BA-2 BE-3
CA-3
DE-4
FA-3
GA-1`;

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
      await expect(page.locator('#words-total')).toHaveText('18');
      await expect(page.locator('#bingo-label')).toContainText('N/A');
    } else {
      // Check Mobile stats
      await expect(page.locator('#words-count-mob')).toHaveText('0');
      await expect(page.locator('#words-total-mob')).toHaveText('18');
      await expect(page.locator('#bingo-label-mob')).toContainText('N/A');
    }
  });

  test('Words found local storage retention on refresh', async ({ page, isMobile }) => {
    await page.goto('/');
    
    // Paste hints to get access to the Words found box
    await page.fill('#hints-input', sampleHints);
    await page.click('#btn-load-hints');
    await expect(page.locator('#orbit-wrapper')).toBeVisible();
    
    // Enter words
    const testWords = "face fade cafe";
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
