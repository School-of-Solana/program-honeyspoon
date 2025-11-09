import { test, expect } from '@playwright/test';

test.describe('Abyss Fortune Game Flow', () => {
  let consoleLogs: string[] = [];
  let consoleErrors: string[] = [];
  let diveCounter = 0;

  test.beforeEach(async ({ page }) => {
    // Reset dive counter for each test
    diveCounter = 0;

    // Capture console logs
    consoleLogs = [];
    consoleErrors = [];

    page.on('console', (msg) => {
      const text = msg.text();
      console.log(`[BROWSER ${msg.type().toUpperCase()}]:`, text);
      
      if (msg.type() === 'error') {
        consoleErrors.push(text);
      } else {
        consoleLogs.push(text);
      }
    });

    // Capture page errors
    page.on('pageerror', (error) => {
      console.error('[PAGE ERROR]:', error.message);
      consoleErrors.push(`Page Error: ${error.message}`);
    });

    // Set NODE_ENV to test via browser context
    await page.addInitScript(() => {
      (window as any).__TEST_MODE__ = true;
    });

    // Navigate to the game
    await page.goto('/');
    
    // Wait for the page to be fully loaded
    await page.waitForLoadState('networkidle');
  });

  test('Step 1: Initial Page Load - Betting Card Visible', async ({ page }) => {
    console.log('\n========== STEP 1: INITIAL LOAD ==========');
    
    // Check if betting card is visible
    const bettingCard = page.locator('text=ABYSS FORTUNE').first();
    await expect(bettingCard).toBeVisible({ timeout: 10000 });
    
    // Check if canvas exists
    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible();
    
    // Take screenshot
    await page.screenshot({ 
      path: 'tests/screenshots/01-initial-load.png',
      fullPage: true 
    });
    
    // Verify bet input
    const betInput = page.locator('input[type="number"]');
    await expect(betInput).toBeVisible();
    const defaultBet = await betInput.inputValue();
    console.log('Default bet value:', defaultBet);
    expect(Number(defaultBet)).toBe(100);
    
    // Verify chip buttons
    const chipButtons = page.locator('button:has-text("$")');
    const chipCount = await chipButtons.count();
    console.log('Number of chip buttons:', chipCount);
    expect(chipCount).toBeGreaterThanOrEqual(6);
    
    // Verify start button
    const startButton = page.locator('button:has-text("START DIVING")');
    await expect(startButton).toBeVisible();
    await expect(startButton).toBeEnabled();
    
    console.log('✅ Step 1 Complete: Initial page loaded successfully');
    console.log('Console Errors:', consoleErrors.length);
  });

  test('Step 2: Change Bet Amount with Chips', async ({ page }) => {
    console.log('\n========== STEP 2: CHANGE BET AMOUNT ==========');
    
    const betInput = page.locator('input[type="number"]');
    
    // Click $250 chip
    await page.locator('button:has-text("$250")').click();
    await page.waitForTimeout(500);
    
    let betValue = await betInput.inputValue();
    console.log('Bet after clicking $250:', betValue);
    expect(Number(betValue)).toBe(250);
    
    await page.screenshot({ 
      path: 'tests/screenshots/02-bet-250.png',
      fullPage: true 
    });
    
    // Click $50 chip (exact match to avoid confusion with $500)
    await page.locator('button', { hasText: '$50' }).first().click();
    await page.waitForTimeout(500);
    
    betValue = await betInput.inputValue();
    console.log('Bet after clicking $50:', betValue);
    expect(Number(betValue)).toBe(50);
    
    await page.screenshot({ 
      path: 'tests/screenshots/03-bet-50.png',
      fullPage: true 
    });
    
    console.log('✅ Step 2 Complete: Bet amount changes correctly');
  });

  test('Step 3: Start Game - Betting Card Disappears, HUD Appears', async ({ page }) => {
    console.log('\n========== STEP 3: START GAME ==========');
    
    // Set bet to $100
    const betInput = page.locator('input[type="number"]');
    await betInput.fill('100');
    
    // Click Start Diving
    const startButton = page.locator('button:has-text("START DIVING")');
    await startButton.click();
    
    console.log('Start button clicked, waiting for transitions...');
    
    // Validate console logs
    await page.waitForTimeout(1000);
    const hasStartLog = consoleLogs.some(log => log.includes('[GAME] Starting new game with bet: $100'));
    const hasHUDLog = consoleLogs.some(log => log.includes('[GAME] Game started, HUD visible'));
    expect(hasStartLog).toBeTruthy();
    expect(hasHUDLog).toBeTruthy();
    console.log('✅ Console logs validated: Game start logs present');
    
    await page.screenshot({ 
      path: 'tests/screenshots/04-game-starting.png',
      fullPage: true 
    });
    
    // Check if HUD elements appear
    const depthIndicator = page.locator('text=0m').first();
    await expect(depthIndicator).toBeVisible({ timeout: 5000 });
    
    // Check for treasure display in HUD
    const treasureDisplay = page.locator('text=$100').first();
    await expect(treasureDisplay).toBeVisible();
    
    // Check for oxygen display
    const oxygenDisplay = page.locator('text=100%').first();
    await expect(oxygenDisplay).toBeVisible();
    
    await page.screenshot({ 
      path: 'tests/screenshots/05-hud-visible.png',
      fullPage: true 
    });
    
    // Verify action buttons are visible
    const diveButton = page.locator('button:has-text("DIVE DEEPER")');
    await expect(diveButton).toBeVisible();
    
    const surfaceButton = page.locator('button:has-text("SURFACE NOW")');
    await expect(surfaceButton).toBeVisible();
    
    console.log('✅ Step 3 Complete: Game started, HUD visible');
    console.log('Current treasure: $100');
    console.log('Current depth: 0m');
    console.log('Current oxygen: 100%');
  });

  test('Step 4: First Dive - Animation and Result', async ({ page }) => {
    console.log('\n========== STEP 4: FIRST DIVE ==========');
    
    // Start game
    await page.locator('input[type="number"]').fill('100');
    await page.locator('button:has-text("START DIVING")').click();
    await page.waitForTimeout(1500);
    
    // Take screenshot before dive
    await page.screenshot({ 
      path: 'tests/screenshots/06-before-first-dive.png',
      fullPage: true 
    });
    
    // Click Dive Deeper
    console.log('Clicking DIVE DEEPER button...');
    const diveButton = page.locator('button:has-text("DIVE DEEPER")').first();
    await diveButton.click();
    
    // Validate dive initiation log
    await page.waitForTimeout(500);
    const hasDiveInitLog = consoleLogs.some(log => log.includes('[GAME] Dive initiated - Dive #1'));
    expect(hasDiveInitLog).toBeTruthy();
    console.log('✅ Console log validated: Dive initiation logged');
    
    // Wait for diving message
    const divingMessage = page.locator('text=Diving deeper');
    await expect(divingMessage).toBeVisible({ timeout: 2000 });
    
    await page.screenshot({ 
      path: 'tests/screenshots/07-diving-animation.png',
      fullPage: true 
    });
    
    console.log('Diving animation started, waiting for result...');
    
    // Wait for result (up to 5 seconds)
    await page.waitForTimeout(3000);
    
    // Validate server response log
    const hasServerLog = consoleLogs.some(log => log.includes('[GAME] Server response received'));
    expect(hasServerLog).toBeTruthy();
    console.log('✅ Console log validated: Server response received');
    
    await page.screenshot({ 
      path: 'tests/screenshots/08-after-first-dive.png',
      fullPage: true 
    });
    
    // Check if we survived or drowned
    const drownedMessage = page.locator('text=DROWNED');
    const survivedMessage = page.locator('text=Found');
    
    const isDrowned = await drownedMessage.isVisible().catch(() => false);
    const isSurvived = await survivedMessage.isVisible().catch(() => false);
    
    if (isDrowned) {
      console.log('❌ Result: DROWNED on first dive');
      console.log('This is possible but rare (30% chance on first dive)');
      
      // Validate drowned log
      const hasDrownedLog = consoleLogs.some(log => log.includes('[GAME] DROWNED'));
      expect(hasDrownedLog).toBeTruthy();
      console.log('✅ Console log validated: Drowned event logged');
      
      // Wait for reset
      await page.waitForTimeout(3000);
      
      // Check if betting card reappears
      const bettingCard = page.locator('text=ABYSS FORTUNE').first();
      await expect(bettingCard).toBeVisible({ timeout: 5000 });
      
      await page.screenshot({ 
        path: 'tests/screenshots/09-game-over-reset.png',
        fullPage: true 
      });
    } else if (isSurvived) {
      console.log('✅ Result: SURVIVED first dive!');
      
      // Validate survival log
      const hasSurvivalLog = consoleLogs.some(log => log.includes('[GAME] Dive successful'));
      expect(hasSurvivalLog).toBeTruthy();
      console.log('✅ Console log validated: Survival logged');
      
      // Check updated depth
      const depthText = await page.locator('div:has-text("m")').first().textContent();
      console.log('New depth:', depthText);
      
      // Check updated treasure (should be ~$121 with 1.21x multiplier)
      const treasureText = await page.locator('text=/\\$\\d+/').first().textContent();
      console.log('New treasure:', treasureText);
      
      // Check updated oxygen (should be 96%)
      const oxygenText = await page.locator('text=/%/').first().textContent();
      console.log('Oxygen level:', oxygenText);
    }
    
    console.log('✅ Step 4 Complete: First dive executed');
  });

  test('Step 5: Multiple Dives - Progression Test', async ({ page }) => {
    console.log('\n========== STEP 5: MULTIPLE DIVES ==========');
    
    // Start game with $100
    await page.locator('input[type="number"]').fill('100');
    await page.locator('button:has-text("START DIVING")').click();
    await page.waitForTimeout(1500);
    
    let diveCount = 0;
    const maxDives = 5;
    let gameOver = false;
    
    while (diveCount < maxDives && !gameOver) {
      diveCount++;
      console.log(`\n--- Dive #${diveCount} ---`);
      
      // Click dive button
      const diveButton = page.locator('button:has-text("DIVE DEEPER")').first();
      
      if (!(await diveButton.isVisible())) {
        console.log('Dive button not visible, game may be over');
        break;
      }
      
      await diveButton.click();
      console.log('Dive initiated...');
      
      // Wait for animation
      await page.waitForTimeout(3000);
      
      // Take screenshot
      await page.screenshot({ 
        path: `tests/screenshots/10-dive-${diveCount}.png`,
        fullPage: true 
      });
      
      // Check result
      const drownedMessage = page.locator('text=DROWNED');
      const isDrowned = await drownedMessage.isVisible().catch(() => false);
      
      if (isDrowned) {
        console.log(`💀 DROWNED on dive #${diveCount}`);
        gameOver = true;
        
        await page.waitForTimeout(3000);
        await page.screenshot({ 
          path: 'tests/screenshots/11-final-game-over.png',
          fullPage: true 
        });
        break;
      }
      
      // Log current state
      try {
        const depthText = await page.locator('div').filter({ hasText: /^\d+m$/ }).first().textContent({ timeout: 1000 });
        const treasureText = await page.locator('div').filter({ hasText: /^\$\d+$/ }).first().textContent({ timeout: 1000 });
        const oxygenText = await page.locator('div').filter({ hasText: /^\d+%$/ }).first().textContent({ timeout: 1000 });
        
        console.log(`Depth: ${depthText}`);
        console.log(`Treasure: ${treasureText}`);
        console.log(`Oxygen: ${oxygenText}`);
      } catch (e) {
        console.log('Could not read game state');
      }
      
      // Small delay between dives
      await page.waitForTimeout(1000);
    }
    
    if (!gameOver) {
      console.log(`\n🎉 Survived ${diveCount} dives!`);
      console.log('This is statistically rare - congratulations!');
    }
    
    console.log(`✅ Step 5 Complete: Tested ${diveCount} dives`);
  });

  test('Step 6: Surface Successfully', async ({ page }) => {
    console.log('\n========== STEP 6: SURFACE TEST ==========');
    
    // Start game
    await page.locator('input[type="number"]').fill('100');
    await page.locator('button:has-text("START DIVING")').click();
    await page.waitForTimeout(1500);
    
    // Do one successful dive
    await page.locator('button:has-text("DIVE DEEPER")').first().click();
    await page.waitForTimeout(3000);
    
    await page.screenshot({ 
      path: 'tests/screenshots/12-before-surface.png',
      fullPage: true 
    });
    
    // Check if we survived
    const drownedMessage = page.locator('text=DROWNED');
    const isDrowned = await drownedMessage.isVisible().catch(() => false);
    
    if (isDrowned) {
      console.log('Drowned on first dive, cannot test surface');
      return;
    }
    
    // Click Surface button
    console.log('Clicking SURFACE NOW button...');
    const surfaceButton = page.locator('button:has-text("SURFACE NOW")').first();
    await surfaceButton.click();
    
    // Validate surfacing log
    await page.waitForTimeout(500);
    const hasSurfaceLog = consoleLogs.some(log => log.includes('[GAME] Surfacing with'));
    expect(hasSurfaceLog).toBeTruthy();
    console.log('✅ Console log validated: Surfacing logged');
    
    await page.screenshot({ 
      path: 'tests/screenshots/13-surfacing.png',
      fullPage: true 
    });
    
    // Wait for success message
    await page.waitForTimeout(3000);
    
    const successMessage = page.locator('text=SUCCESS');
    await expect(successMessage).toBeVisible({ timeout: 5000 });
    
    // Validate success log
    const hasSuccessLog = consoleLogs.some(log => log.includes('[GAME] Surface successful'));
    expect(hasSuccessLog).toBeTruthy();
    console.log('✅ Console log validated: Surface success logged');
    
    await page.screenshot({ 
      path: 'tests/screenshots/14-surface-success.png',
      fullPage: true 
    });
    
    console.log('✅ Surfaced successfully!');
    
    // Wait for game reset
    await page.waitForTimeout(5000);
    
    // Check if betting card reappears
    const bettingCard = page.locator('text=ABYSS FORTUNE').first();
    await expect(bettingCard).toBeVisible({ timeout: 5000 });
    
    await page.screenshot({ 
      path: 'tests/screenshots/15-reset-after-surface.png',
      fullPage: true 
    });
    
    console.log('✅ Step 6 Complete: Surface and reset successful');
  });

  test('Step 7: Console Errors Check', async ({ page }) => {
    console.log('\n========== STEP 7: ERROR CHECK ==========');
    
    // Navigate and interact
    await page.goto('/');
    await page.waitForTimeout(2000);
    
    // Check for console errors
    console.log(`Total console logs captured: ${consoleLogs.length}`);
    console.log(`Total console errors captured: ${consoleErrors.length}`);
    
    if (consoleErrors.length > 0) {
      console.log('\n❌ Console Errors Found:');
      consoleErrors.forEach((error, index) => {
        console.log(`  ${index + 1}. ${error}`);
      });
    } else {
      console.log('✅ No console errors detected');
    }
    
    // Fail test if there are critical errors
    const criticalErrors = consoleErrors.filter(err => 
      !err.includes('404') && // Ignore 404s
      !err.includes('Permissions-Policy') && // Ignore browser policy warnings
      !err.includes('React DevTools') // Ignore devtools suggestion
    );
    
    expect(criticalErrors.length).toBe(0);
    
    console.log('✅ Step 7 Complete: No critical errors found');
  });

  test.afterEach(async ({ page }) => {
    // Final screenshot
    await page.screenshot({ 
      path: 'tests/screenshots/99-final-state.png',
      fullPage: true 
    });
    
    console.log('\n========== TEST SUMMARY ==========');
    console.log(`Total console messages: ${consoleLogs.length + consoleErrors.length}`);
    console.log(`Errors: ${consoleErrors.length}`);
    console.log('Screenshots saved in tests/screenshots/');
  });
});
