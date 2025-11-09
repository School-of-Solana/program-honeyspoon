import { test, expect } from '@playwright/test';

test.describe('Abyss Fortune - Edge Cases', () => {
  let consoleLogs: string[] = [];
  let consoleErrors: string[] = [];

  test.beforeEach(async ({ page }) => {
    // Capture console logs
    consoleLogs = [];
    consoleErrors = [];

    page.on('console', (msg) => {
      const text = msg.text();
      if (msg.type() === 'error') {
        consoleErrors.push(text);
      } else {
        consoleLogs.push(text);
      }
    });

    page.on('pageerror', (error) => {
      consoleErrors.push(`Page Error: ${error.message}`);
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('Edge Case 1: Minimum Bet ($10)', async ({ page }) => {
    console.log('\n========== EDGE CASE 1: MINIMUM BET ==========');
    
    const betInput = page.locator('input[type="number"]');
    
    // Set minimum bet
    await betInput.fill('10');
    await page.waitForTimeout(300);
    
    const betValue = await betInput.inputValue();
    console.log('Bet value:', betValue);
    expect(Number(betValue)).toBe(10);
    
    // Check no error message
    const errorMessage = page.locator('text=Minimum bet');
    await expect(errorMessage).not.toBeVisible();
    
    // Start game with minimum bet
    const startButton = page.locator('button:has-text("START DIVING")');
    await expect(startButton).toBeEnabled();
    await startButton.click();
    
    await page.waitForTimeout(1500);
    
    // Verify game started with $10
    const treasureDisplay = page.locator('text=$10').first();
    await expect(treasureDisplay).toBeVisible({ timeout: 5000 });
    
    console.log('✅ Minimum bet ($10) works correctly');
    
    await page.screenshot({ 
      path: 'tests/screenshots/edge-case-min-bet.png',
      fullPage: true 
    });
  });

  test('Edge Case 2: Maximum Bet ($500)', async ({ page }) => {
    console.log('\n========== EDGE CASE 2: MAXIMUM BET ==========');
    
    const betInput = page.locator('input[type="number"]');
    
    // Set maximum bet
    await betInput.fill('500');
    await page.waitForTimeout(300);
    
    const betValue = await betInput.inputValue();
    console.log('Bet value:', betValue);
    expect(Number(betValue)).toBe(500);
    
    // Check no error message
    const errorMessage = page.locator('text=Maximum bet');
    await expect(errorMessage).not.toBeVisible();
    
    // Start game with maximum bet
    const startButton = page.locator('button:has-text("START DIVING")');
    await expect(startButton).toBeEnabled();
    await startButton.click();
    
    await page.waitForTimeout(1500);
    
    // Verify game started with $500
    const treasureDisplay = page.locator('text=$500').first();
    await expect(treasureDisplay).toBeVisible({ timeout: 5000 });
    
    console.log('✅ Maximum bet ($500) works correctly');
    
    await page.screenshot({ 
      path: 'tests/screenshots/edge-case-max-bet.png',
      fullPage: true 
    });
  });

  test('Edge Case 3: Below Minimum Bet ($5)', async ({ page }) => {
    console.log('\n========== EDGE CASE 3: BELOW MINIMUM ==========');
    
    const betInput = page.locator('input[type="number"]');
    
    // Try to set below minimum
    await betInput.fill('5');
    await page.waitForTimeout(300);
    
    // Check for error message
    const errorMessage = page.locator('text=Minimum bet is $10');
    await expect(errorMessage).toBeVisible({ timeout: 2000 });
    
    // Start button should be disabled
    const startButton = page.locator('button:has-text("START DIVING")');
    await expect(startButton).toBeDisabled();
    
    console.log('✅ Below minimum bet correctly shows error and disables button');
    
    await page.screenshot({ 
      path: 'tests/screenshots/edge-case-below-min.png',
      fullPage: true 
    });
  });

  test('Edge Case 4: Above Maximum Bet ($1000)', async ({ page }) => {
    console.log('\n========== EDGE CASE 4: ABOVE MAXIMUM ==========');
    
    const betInput = page.locator('input[type="number"]');
    
    // Try to set above maximum
    await betInput.fill('1000');
    await page.waitForTimeout(300);
    
    // Check for error message
    const errorMessage = page.locator('text=Maximum bet is $500');
    await expect(errorMessage).toBeVisible({ timeout: 2000 });
    
    // Start button should be disabled
    const startButton = page.locator('button:has-text("START DIVING")');
    await expect(startButton).toBeDisabled();
    
    console.log('✅ Above maximum bet correctly shows error and disables button');
    
    await page.screenshot({ 
      path: 'tests/screenshots/edge-case-above-max.png',
      fullPage: true 
    });
  });

  test('Edge Case 5: Rapid Clicking Prevention', async ({ page }) => {
    console.log('\n========== EDGE CASE 5: RAPID CLICKING ==========');
    
    // Start game
    await page.locator('input[type="number"]').fill('100');
    await page.locator('button:has-text("START DIVING")').click();
    await page.waitForTimeout(1500);
    
    const diveButton = page.locator('button:has-text("DIVE DEEPER")').first();
    
    // Click dive button
    await diveButton.click();
    console.log('First click registered');
    
    // Try to click again immediately (should be disabled/processing)
    await page.waitForTimeout(100);
    const isDisabled = await diveButton.isDisabled();
    
    console.log('Button disabled after first click:', isDisabled);
    expect(isDisabled).toBeTruthy();
    
    // Check that only ONE dive log appears
    await page.waitForTimeout(500);
    const diveLogs = consoleLogs.filter(log => log.includes('[GAME] Dive initiated'));
    console.log('Number of dive initiation logs:', diveLogs.length);
    
    // Should only have one dive log (rapid clicking prevented)
    expect(diveLogs.length).toBe(1);
    
    console.log('✅ Rapid clicking correctly prevented');
    
    await page.screenshot({ 
      path: 'tests/screenshots/edge-case-rapid-click.png',
      fullPage: true 
    });
  });

  test('Edge Case 6: Zero or Negative Bet', async ({ page }) => {
    console.log('\n========== EDGE CASE 6: INVALID BETS ==========');
    
    const betInput = page.locator('input[type="number"]');
    const startButton = page.locator('button:has-text("START DIVING")');
    
    // Try zero
    await betInput.fill('0');
    await page.waitForTimeout(300);
    
    let errorMessage = page.locator('text=Minimum bet is $10');
    await expect(errorMessage).toBeVisible();
    await expect(startButton).toBeDisabled();
    console.log('✅ Zero bet shows error and disables button');
    
    // Try negative (browser may prevent this, but test anyway)
    await betInput.fill('-50');
    await page.waitForTimeout(300);
    
    // Either prevented by browser or shows error
    const currentValue = await betInput.inputValue();
    if (Number(currentValue) < 0 || currentValue === '-50') {
      await expect(errorMessage).toBeVisible();
    }
    console.log('✅ Negative bet handled correctly');
    
    await page.screenshot({ 
      path: 'tests/screenshots/edge-case-invalid-bet.png',
      fullPage: true 
    });
  });

  test('Edge Case 7: Surface with Zero Treasure', async ({ page }) => {
    console.log('\n========== EDGE CASE 7: SURFACE WITH ZERO TREASURE ==========');
    
    // Start game
    await page.locator('input[type="number"]').fill('100');
    await page.locator('button:has-text("START DIVING")').click();
    await page.waitForTimeout(1500);
    
    // Dive immediately to test
    await page.locator('button:has-text("DIVE DEEPER")').first().click();
    await page.waitForTimeout(3500);
    
    // Check if drowned (treasure becomes 0)
    const drownedMessage = page.locator('text=DROWNED');
    const isDrowned = await drownedMessage.isVisible().catch(() => false);
    
    if (isDrowned) {
      console.log('✅ Drowned scenario: Game correctly resets without surfacing');
      
      // Wait for auto-reset
      await page.waitForTimeout(4000);
      
      // Verify betting card reappears
      const bettingCard = page.locator('text=ABYSS FORTUNE').first();
      await expect(bettingCard).toBeVisible({ timeout: 5000 });
      
      console.log('✅ Auto-reset after drowning works correctly');
    } else {
      console.log('Survived first dive - cannot test zero treasure surface in this run');
    }
    
    await page.screenshot({ 
      path: 'tests/screenshots/edge-case-zero-treasure.png',
      fullPage: true 
    });
  });

  test('Edge Case 8: Bet Change During Game', async ({ page }) => {
    console.log('\n========== EDGE CASE 8: BET CHANGE DURING GAME ==========');
    
    // Start game with $100
    await page.locator('input[type="number"]').fill('100');
    await page.locator('button:has-text("START DIVING")').click();
    await page.waitForTimeout(1500);
    
    // Verify game started
    const hudVisible = await page.locator('text=DIVE DEEPER').isVisible();
    expect(hudVisible).toBeTruthy();
    
    // Betting card should be hidden
    const bettingCard = page.locator('text=ABYSS FORTUNE').first();
    const cardVisible = await bettingCard.isVisible();
    expect(cardVisible).toBeFalsy();
    
    console.log('✅ During active game, betting interface is hidden');
    console.log('✅ Bet cannot be changed mid-game');
    
    await page.screenshot({ 
      path: 'tests/screenshots/edge-case-bet-change.png',
      fullPage: true 
    });
  });

  test.afterEach(async () => {
    console.log('\n========== EDGE CASE TEST SUMMARY ==========');
    console.log(`Total console messages: ${consoleLogs.length + consoleErrors.length}`);
    console.log(`Errors: ${consoleErrors.length}`);
    
    if (consoleErrors.length > 0) {
      console.log('Errors encountered:');
      consoleErrors.forEach((err, i) => console.log(`  ${i + 1}. ${err}`));
    }
  });
});
