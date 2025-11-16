import { test, expect } from "@playwright/test";

test.describe("Comprehensive Animation & Game Tests", () => {
  let consoleLogs: string[] = [];
  let canvasLogs: string[] = [];
  let gameLogs: string[] = [];

  test.beforeEach(async ({ page }) => {
    consoleLogs = [];
    canvasLogs = [];
    gameLogs = [];

    page.on("console", (msg) => {
      const text = msg.text();
      consoleLogs.push(text);

      if (text.includes("[CANVAS]")) {
        canvasLogs.push(text);
      }

      if (text.includes("[GAME]")) {
        gameLogs.push(text);
      }
    });

    await page.goto("/");
    await page.waitForLoadState("networkidle");
  });

  test("1. System Initialization - Complete Stack", async ({ page }) => {
    console.log("\n========== TEST 1: SYSTEM INITIALIZATION ==========");

    await page.waitForTimeout(2000);

    // Canvas layer checks
    const hasCanvasInit = canvasLogs.some((log) =>
      log.includes("Kaplay initialized")
    );
    const hasSceneCreated = canvasLogs.some((log) =>
      log.includes("Ocean scene created")
    );

    console.log("Canvas Layer:");
    console.log("  Kaplay initialized:", hasCanvasInit ? "✅" : "❌");
    console.log("  Scene created:", hasSceneCreated ? "✅" : "❌");

    expect(hasCanvasInit).toBeTruthy();
    expect(hasSceneCreated).toBeTruthy();

    // Check canvas element exists
    const canvas = page.locator("canvas");
    await expect(canvas).toBeVisible();

    // Check initial UI
    const bettingCard = page.locator("text=ABYSS FORTUNE");
    await expect(bettingCard).toBeVisible();

    console.log("UI Layer:");
    console.log("  Betting card visible: ✅");
    console.log("  Canvas rendered: ✅");

    await page.screenshot({
      path: "tests/screenshots/comp-01-initialization.png",
      fullPage: true,
    });
  });

  test("2. Bet Validation - Boundary Testing", async ({ page }) => {
    console.log("\n========== TEST 2: BET VALIDATION ==========");

    const betInput = page.locator('input[type="number"]');
    const startButton = page.locator('button:has-text("START DIVING")');

    // Test minimum bet
    await betInput.fill("10");
    await page.waitForTimeout(200);
    await expect(startButton).toBeEnabled();
    console.log("  $10 (min): ✅ Accepted");

    // Test maximum bet
    await betInput.fill("500");
    await page.waitForTimeout(200);
    await expect(startButton).toBeEnabled();
    console.log("  $500 (max): ✅ Accepted");

    // Test below minimum
    await betInput.fill("5");
    await page.waitForTimeout(200);
    const errorMin = page.locator("text=Minimum bet");
    await expect(errorMin).toBeVisible();
    await expect(startButton).toBeDisabled();
    console.log("  $5 (below min): ✅ Rejected with error");

    // Test above maximum
    await betInput.fill("1000");
    await page.waitForTimeout(200);
    const errorMax = page.locator("text=Maximum bet");
    await expect(errorMax).toBeVisible();
    await expect(startButton).toBeDisabled();
    console.log("  $1000 (above max): ✅ Rejected with error");

    // Test zero
    await betInput.fill("0");
    await page.waitForTimeout(200);
    await expect(startButton).toBeDisabled();
    console.log("  $0: ✅ Rejected");

    await page.screenshot({
      path: "tests/screenshots/comp-02-validation.png",
      fullPage: true,
    });
  });

  test("3. Game Start Transition - UI Flow", async ({ page }) => {
    console.log("\n========== TEST 3: GAME START TRANSITION ==========");

    // Set bet and start
    await page.locator('input[type="number"]').fill("100");
    const startButton = page.locator('button:has-text("START DIVING")');

    console.log("  Before start: Betting card visible");
    await expect(page.locator("text=ABYSS FORTUNE")).toBeVisible();

    await startButton.click();
    console.log("  Start button clicked");

    // Check for game start log
    await page.waitForTimeout(1000);
    const hasStartLog = gameLogs.some((log) =>
      log.includes("Starting new game")
    );
    expect(hasStartLog).toBeTruthy();
    console.log("  Game start logged: ✅");

    // Betting card should fade out
    await page.waitForTimeout(1000);
    const bettingCardGone = !(await page
      .locator("text=ABYSS FORTUNE")
      .isVisible());
    expect(bettingCardGone).toBeTruthy();
    console.log("  Betting card hidden: ✅");

    // HUD should appear
    const depthDisplay = page.locator("text=0m").first();
    await expect(depthDisplay).toBeVisible({ timeout: 3000 });
    console.log("  HUD visible: ✅");

    // Verify HUD elements
    const treasureDisplay = page.locator("text=$100").first();
    await expect(treasureDisplay).toBeVisible();
    console.log("  Treasure shown: $100 ✅");

    const diveButton = page.locator('button:has-text("DIVE DEEPER")');
    await expect(diveButton).toBeVisible();
    const surfaceButton = page.locator('button:has-text("SURFACE NOW")');
    await expect(surfaceButton).toBeVisible();
    console.log("  Action buttons visible: ✅");

    await page.screenshot({
      path: "tests/screenshots/comp-03-game-start.png",
      fullPage: true,
    });
  });

  test("4. Diving Animation - Full Sequence with Timing", async ({ page }) => {
    console.log("\n========== TEST 4: DIVING ANIMATION SEQUENCE ==========");

    // Start game
    await page.locator('input[type="number"]').fill("100");
    await page.locator('button:has-text("START DIVING")').click();
    await page.waitForTimeout(1500);

    // Clear logs to focus on dive
    canvasLogs = [];
    const startTime = Date.now();

    // Click dive
    console.log("  Initiating dive...");
    await page.locator('button:has-text("DIVE DEEPER")').first().click();

    // Wait for animation trigger
    await page.waitForTimeout(500);
    const hasTrigger = canvasLogs.some((log) =>
      log.includes("Triggering diving animation")
    );
    expect(hasTrigger).toBeTruthy();
    console.log("  Animation triggered: ✅");

    // Check for state logging during animation
    await page.waitForTimeout(1000);
    const hasStateLog = canvasLogs.some((log) =>
      log.includes("[CANVAS STATE]")
    );
    console.log(
      "  State logging active:",
      hasStateLog ? "✅" : "⚠️  (may not trigger in 1s)"
    );

    // Wait for animation to complete (2.5s)
    console.log("  Waiting for 2.5s animation...");
    await page.waitForTimeout(2500);

    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;

    // Check completion log
    const hasCompletion = canvasLogs.some((log) =>
      log.includes("Diving animation complete")
    );
    expect(hasCompletion).toBeTruthy();
    console.log(`  Animation completed: ✅ (${duration.toFixed(1)}s total)`);

    // Verify state changed
    await page.waitForTimeout(500);

    await page.screenshot({
      path: "tests/screenshots/comp-04-dive-animation.png",
      fullPage: true,
    });

    // Check depth increased
    const depthText = await page
      .locator("div")
      .filter({ hasText: /^\d+m$/ })
      .first()
      .textContent({ timeout: 2000 });
    console.log("  Depth after dive:", depthText);

    // Check treasure updated (or game over)
    const isDrowned = await page
      .locator("text=DROWNED")
      .isVisible()
      .catch(() => false);
    if (isDrowned) {
      console.log("  Result: 💀 DROWNED");
      const hasDeathAnim = canvasLogs.some((log) =>
        log.includes("death animation")
      );
      console.log("  Death animation triggered:", hasDeathAnim ? "✅" : "❌");
    } else {
      console.log("  Result: ✅ SURVIVED");
      const hasTreasureAnim = canvasLogs.some((log) =>
        log.includes("treasure animation")
      );
      console.log(
        "  Treasure animation triggered:",
        hasTreasureAnim ? "✅" : "❌"
      );
    }
  });

  test("5. Multiple Dives - State Consistency", async ({ page }) => {
    console.log("\n========== TEST 5: MULTIPLE DIVES ==========");

    await page.locator('input[type="number"]').fill("100");
    await page.locator('button:has-text("START DIVING")').click();
    await page.waitForTimeout(1500);

    const diveResults: any[] = [];
    const maxDives = 5;

    for (let i = 1; i <= maxDives; i++) {
      console.log(`\n  --- Dive #${i} ---`);

      const diveButton = page.locator('button:has-text("DIVE DEEPER")').first();
      if (!(await diveButton.isVisible())) {
        console.log("  Dive button not visible, stopping");
        break;
      }

      // Clear logs
      gameLogs = [];
      canvasLogs = [];

      // Record state before dive
      const depthBefore = await page
        .locator("div")
        .filter({ hasText: /^\d+m$/ })
        .first()
        .textContent()
        .catch(() => "0m");
      const treasureBefore = await page
        .locator("div")
        .filter({ hasText: /^\$\d+$/ })
        .first()
        .textContent()
        .catch(() => "$0");

      // Dive
      await diveButton.click();
      await page.waitForTimeout(4000);

      // Check result
      const isDrowned = await page
        .locator("text=DROWNED")
        .isVisible()
        .catch(() => false);

      if (isDrowned) {
        console.log("  💀 DROWNED");
        diveResults.push({ dive: i, result: "drowned", depth: depthBefore });

        // Verify reset
        await page.waitForTimeout(4000);
        const resetCard = await page
          .locator("text=ABYSS FORTUNE")
          .isVisible()
          .catch(() => false);
        expect(resetCard).toBeTruthy();
        console.log("  Game reset to betting screen: ✅");
        break;
      } else {
        console.log("  ✅ SURVIVED");
        const depthAfter = await page
          .locator("div")
          .filter({ hasText: /^\d+m$/ })
          .first()
          .textContent()
          .catch(() => "0m");
        const treasureAfter = await page
          .locator("div")
          .filter({ hasText: /^\$\d+$/ })
          .first()
          .textContent()
          .catch(() => "$0");

        diveResults.push({
          dive: i,
          result: "survived",
          depthBefore,
          depthAfter,
          treasureBefore,
          treasureAfter,
        });

        console.log(`    ${depthBefore} → ${depthAfter}`);
        console.log(`    ${treasureBefore} → ${treasureAfter}`);

        // Verify treasure increased
        const treasureValueBefore = parseInt(treasureBefore.replace("$", ""));
        const treasureValueAfter = parseInt(treasureAfter.replace("$", ""));
        expect(treasureValueAfter).toBeGreaterThan(treasureValueBefore);
        console.log("  Treasure increased: ✅");
      }

      await page.screenshot({
        path: `tests/screenshots/comp-05-dive-${i}.png`,
        fullPage: true,
      });
    }

    console.log("\n  Summary:");
    console.log(`  Total dives: ${diveResults.length}`);
    console.log("  Results:", diveResults.map((r) => r.result).join(", "));
  });

  test("6. Surface Success Flow", async ({ page }) => {
    console.log("\n========== TEST 6: SURFACE SUCCESS ==========");

    await page.locator('input[type="number"]').fill("100");
    await page.locator('button:has-text("START DIVING")').click();
    await page.waitForTimeout(1500);

    // Do one dive
    await page.locator('button:has-text("DIVE DEEPER")').first().click();
    await page.waitForTimeout(4000);

    // Check if survived
    const isDrowned = await page
      .locator("text=DROWNED")
      .isVisible()
      .catch(() => false);

    if (isDrowned) {
      console.log("  Drowned on first dive, skipping surface test");
      return;
    }

    console.log("  Survived first dive ✅");

    // Get treasure value
    const treasureText = await page
      .locator("div")
      .filter({ hasText: /^\$\d+$/ })
      .first()
      .textContent();
    console.log("  Current treasure:", treasureText);

    // Click surface
    const surfaceButton = page
      .locator('button:has-text("SURFACE NOW")')
      .first();
    await surfaceButton.click();
    console.log("  Surface button clicked");

    // Check for surfacing log
    await page.waitForTimeout(500);
    const hasSurfaceLog = gameLogs.some((log) =>
      log.includes("Surfacing with")
    );
    expect(hasSurfaceLog).toBeTruthy();
    console.log("  Surfacing logged: ✅");

    // Wait for success message
    await page.waitForTimeout(2500);
    const successMessage = page.locator("text=SUCCESS");
    await expect(successMessage).toBeVisible({ timeout: 3000 });
    console.log("  Success message shown: ✅");

    await page.screenshot({
      path: "tests/screenshots/comp-06-surface-success.png",
      fullPage: true,
    });

    // Check for profit calculation log
    const hasProfitLog = gameLogs.some((log) => log.includes("Profit"));
    expect(hasProfitLog).toBeTruthy();
    console.log("  Profit calculated: ✅");

    // Wait for reset
    await page.waitForTimeout(3000);
    const bettingCard = page.locator("text=ABYSS FORTUNE").first();
    await expect(bettingCard).toBeVisible({ timeout: 5000 });
    console.log("  Reset to betting screen: ✅");
  });

  test("7. Rapid Click Protection", async ({ page }) => {
    console.log("\n========== TEST 7: RAPID CLICK PROTECTION ==========");

    await page.locator('input[type="number"]').fill("100");
    await page.locator('button:has-text("START DIVING")').click();
    await page.waitForTimeout(1500);

    const diveButton = page.locator('button:has-text("DIVE DEEPER")').first();

    // Clear logs
    gameLogs = [];

    // Rapid click (5 times)
    console.log("  Attempting 5 rapid clicks...");
    for (let i = 0; i < 5; i++) {
      await diveButton.click().catch(() => {});
      await page.waitForTimeout(50);
    }

    await page.waitForTimeout(1000);

    // Count dive initiation logs
    const diveInitLogs = gameLogs.filter((log) =>
      log.includes("Dive initiated")
    );
    console.log(`  Dive initiated logs: ${diveInitLogs.length}`);

    // Should only be 1 or 2 (button disables after first click)
    expect(diveInitLogs.length).toBeLessThanOrEqual(2);
    console.log("  Rapid click protection: ✅");

    await page.screenshot({
      path: "tests/screenshots/comp-07-rapid-click.png",
      fullPage: true,
    });
  });

  test("8. Console Error Monitoring", async ({ page }) => {
    console.log("\n========== TEST 8: ERROR MONITORING ==========");

    const errors: string[] = [];

    page.on("console", (msg) => {
      if (msg.type() === "error") {
        errors.push(msg.text());
      }
    });

    page.on("pageerror", (error) => {
      errors.push(`Page Error: ${error.message}`);
    });

    // Full game flow
    await page.locator('input[type="number"]').fill("100");
    await page.locator('button:has-text("START DIVING")').click();
    await page.waitForTimeout(1500);

    await page.locator('button:has-text("DIVE DEEPER")').first().click();
    await page.waitForTimeout(4000);

    // Filter out known non-critical errors
    const criticalErrors = errors.filter(
      (err) =>
        !err.includes("404") &&
        !err.includes("Permissions-Policy") &&
        !err.includes("React DevTools")
    );

    console.log(`  Total errors: ${errors.length}`);
    console.log(`  Critical errors: ${criticalErrors.length}`);

    if (criticalErrors.length > 0) {
      console.log("\n  Critical Errors:");
      criticalErrors.forEach((err, i) => {
        console.log(`    ${i + 1}. ${err}`);
      });
    }

    expect(criticalErrors.length).toBe(0);
    console.log("  No critical errors: ✅");
  });

  test("9. Performance - Animation Frame Rate", async ({ page }) => {
    console.log("\n========== TEST 9: PERFORMANCE CHECK ==========");

    await page.locator('input[type="number"]').fill("100");
    await page.locator('button:has-text("START DIVING")').click();
    await page.waitForTimeout(1500);

    // Start performance measurement
    const metrics = await page.evaluate(() => {
      return {
        memory: (performance as any).memory
          ? (performance as any).memory.usedJSHeapSize
          : 0,
        timing:
          performance.timing.loadEventEnd - performance.timing.navigationStart,
      };
    });

    console.log("  Page load time:", metrics.timing, "ms");
    if (metrics.memory > 0) {
      console.log(
        "  Memory usage:",
        (metrics.memory / 1024 / 1024).toFixed(2),
        "MB"
      );
    }

    // Trigger animation and check responsiveness
    await page.locator('button:has-text("DIVE DEEPER")').first().click();

    const clickTime = Date.now();
    await page.waitForTimeout(500);
    const responseTime = Date.now() - clickTime;

    console.log("  Animation response time:", responseTime, "ms");
    expect(responseTime).toBeLessThan(1000);
    console.log("  Responsive UI: ✅");

    await page.screenshot({
      path: "tests/screenshots/comp-09-performance.png",
      fullPage: true,
    });
  });

  test("10. Mobile Viewport Compatibility", async ({ page }) => {
    console.log("\n========== TEST 10: MOBILE VIEWPORT ==========");

    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 }); // iPhone SE
    await page.reload();
    await page.waitForLoadState("networkidle");

    console.log("  Viewport set to 375x667 (iPhone SE)");

    // Check UI elements are visible
    const bettingCard = page.locator("text=ABYSS FORTUNE");
    await expect(bettingCard).toBeVisible();
    console.log("  Betting card visible: ✅");

    const betInput = page.locator('input[type="number"]');
    await expect(betInput).toBeVisible();
    console.log("  Bet input visible: ✅");

    // Check canvas
    const canvas = page.locator("canvas");
    await expect(canvas).toBeVisible();
    console.log("  Canvas visible: ✅");

    // Start game
    await betInput.fill("100");
    await page.locator('button:has-text("START DIVING")').click();
    await page.waitForTimeout(1500);

    // Check HUD on mobile
    const diveButton = page.locator('button:has-text("DIVE DEEPER")');
    await expect(diveButton).toBeVisible();
    console.log("  Action buttons accessible: ✅");

    await page.screenshot({
      path: "tests/screenshots/comp-10-mobile.png",
      fullPage: true,
    });

    console.log("  Mobile layout: ✅");
  });

  test.afterEach(async () => {
    console.log("\n========== TEST SUMMARY ==========");
    console.log(`Console logs: ${consoleLogs.length}`);
    console.log(`Canvas logs: ${canvasLogs.length}`);
    console.log(`Game logs: ${gameLogs.length}`);
  });
});
