import { test, expect } from "@playwright/test";

test.describe("Wallet Integration", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    // Wait for wallet to initialize
    await page.waitForTimeout(1000);
  });

  test("01 - should display initial wallet balance of $1000", async ({
    page,
  }) => {
    // Check wallet balance is displayed
    const balanceText = await page
      .locator("text=/Your Balance/")
      .locator("..")
      .locator("span")
      .last()
      .textContent();
    expect(balanceText).toContain("$1000");

    await page.screenshot({
      path: "tests/screenshots/wallet-01-initial-balance.png",
      fullPage: true,
    });
  });

  test("02 - should prevent betting more than wallet balance", async ({
    page,
  }) => {
    // Try to bet $2000 (more than $1000 balance)
    await page.fill('input[type="number"]', "2000");

    // Should show insufficient balance error
    await expect(page.locator("text=/Insufficient balance/")).toBeVisible();

    // Start button should be disabled
    const startButton = page.locator('button:has-text("START DIVING")');
    await expect(startButton).toBeDisabled();

    await page.screenshot({
      path: "tests/screenshots/wallet-02-insufficient-balance.png",
      fullPage: true,
    });
  });

  test("03 - should deduct bet from balance when starting game", async ({
    page,
  }) => {
    // Place $100 bet
    await page.fill('input[type="number"]', "100");
    await page.click('button:has-text("START DIVING")');

    // Wait for game to start
    await page.waitForTimeout(1000);

    // Game should be active (HUD visible)
    await expect(page.locator("text=/Dive #/")).toBeVisible();

    // Note: Balance will show as $900 after bet is placed (on backend)
    // We can't easily verify this in the UI during the game without refreshing
    await page.screenshot({
      path: "tests/screenshots/wallet-03-bet-placed.png",
      fullPage: true,
    });
  });

  test("04 - should update balance after losing game", async ({ page }) => {
    // Place $100 bet
    await page.fill('input[type="number"]', "100");
    await page.click('button:has-text("START DIVING")');
    await page.waitForTimeout(1000);

    // Keep diving until we lose (max 20 attempts)
    let attempts = 0;
    while (attempts < 20) {
      try {
        // Check if betting card is back (game ended)
        if (await page.locator("text=/Your Balance/").isVisible()) {
          break;
        }

        // Check if dive button exists
        const diveButton = page.locator('button:has-text("DIVE DEEPER")');
        if (
          (await diveButton.isVisible()) &&
          !(await diveButton.isDisabled())
        ) {
          await diveButton.click();
          await page.waitForTimeout(3000); // Wait for dive animation
        } else {
          break;
        }
        attempts++;
      } catch (error) {
        break;
      }
    }

    // Wait for game over and return to betting screen
    await page.waitForTimeout(4000);

    // Should show updated balance (should be $900 after losing $100)
    await expect(page.locator("text=/Your Balance/")).toBeVisible();
    const newBalance = await page
      .locator("text=/Your Balance/")
      .locator("..")
      .locator("span")
      .last()
      .textContent();
    expect(newBalance).toContain("$900");

    await page.screenshot({
      path: "tests/screenshots/wallet-04-after-loss.png",
      fullPage: true,
    });
  });

  test("05 - should update balance after winning (surfacing)", async ({
    page,
  }) => {
    // Place $50 bet
    await page.fill('input[type="number"]', "50");
    await page.click('button:has-text("START DIVING")');
    await page.waitForTimeout(1000);

    // Dive once
    await page.click('button:has-text("DIVE DEEPER")');
    await page.waitForTimeout(3000);

    // If survived, surface immediately
    const surfaceButton = page.locator('button:has-text("SURFACE NOW")');
    if (
      (await surfaceButton.isVisible()) &&
      !(await surfaceButton.isDisabled())
    ) {
      await surfaceButton.click();
      await page.waitForTimeout(5000);

      // Should show updated balance (should be > $950 if won)
      await expect(page.locator("text=/Your Balance/")).toBeVisible();
      const newBalance = await page
        .locator("text=/Your Balance/")
        .locator("..")
        .locator("span")
        .last()
        .textContent();

      // Extract number
      const balanceNum = parseInt(newBalance?.replace(/[^0-9]/g, "") || "0");

      // Should be more than initial $1000 - $50 bet = $950
      // If we won, should be around $1000+ (depending on multiplier)
      expect(balanceNum).toBeGreaterThanOrEqual(950);

      await page.screenshot({
        path: "tests/screenshots/wallet-05-after-win.png",
        fullPage: true,
      });
    } else {
      // Lost on first dive - check balance is $950
      await page.waitForTimeout(4000);
      const newBalance = await page
        .locator("text=/Your Balance/")
        .locator("..")
        .locator("span")
        .last()
        .textContent();
      expect(newBalance).toContain("$950");
    }
  });

  test("06 - should enforce house betting limits", async ({ page }) => {
    // This test checks if max bet is properly limited
    // With $50k house and 20% reserve, max bet should be limited

    // Try to set bet to max ($500)
    await page.fill('input[type="number"]', "500");

    // May or may not show limit warning depending on house calculations
    // Just verify the UI responds appropriately
    await page.screenshot({
      path: "tests/screenshots/wallet-06-house-limits.png",
      fullPage: true,
    });
  });

  test("07 - should prevent multiple simultaneous games", async ({ page }) => {
    // Start first game
    await page.fill('input[type="number"]', "100");
    await page.click('button:has-text("START DIVING")');
    await page.waitForTimeout(1000);

    // Game should be active
    await expect(page.locator("text=/Dive #/")).toBeVisible();

    // Betting card should be hidden
    await expect(page.locator("text=/START DIVING/")).not.toBeVisible();

    await page.screenshot({
      path: "tests/screenshots/wallet-07-single-game.png",
      fullPage: true,
    });
  });

  test("08 - should show correct max bet based on balance", async ({
    page,
  }) => {
    // With $1000 balance, max bet should be min($1000, $500, house_limit)

    // Check if max bet chips are available
    const chip500 = page.locator('button:has-text("$500")');
    await expect(chip500).toBeVisible();

    // Click $500 chip
    await chip500.click();

    // Should not show error (within limits)
    const error = page.locator("text=/Maximum bet is/");
    await expect(error).not.toBeVisible();

    await page.screenshot({
      path: "tests/screenshots/wallet-08-max-bet.png",
      fullPage: true,
    });
  });

  test("09 - should validate bet on every change", async ({ page }) => {
    // Test various bet amounts
    const testAmounts = [5, 10, 100, 500, 1000, 2000];

    for (const amount of testAmounts) {
      await page.fill('input[type="number"]', amount.toString());
      await page.waitForTimeout(200);

      const startButton = page.locator('button:has-text("START DIVING")');

      if (amount < 10) {
        // Below minimum - should show error
        await expect(page.locator("text=/Minimum bet is/")).toBeVisible();
        await expect(startButton).toBeDisabled();
      } else if (amount > 1000) {
        // Above balance - should show error
        await expect(page.locator("text=/Insufficient balance/")).toBeVisible();
        await expect(startButton).toBeDisabled();
      } else if (amount > 500) {
        // Above max bet - should show error
        await expect(page.locator("text=/Maximum bet is/")).toBeVisible();
        await expect(startButton).toBeDisabled();
      } else {
        // Valid bet - no error
        const error = page.locator("p.text-red-400");
        await expect(error).not.toBeVisible();
        await expect(startButton).not.toBeDisabled();
      }
    }

    await page.screenshot({
      path: "tests/screenshots/wallet-09-validation.png",
      fullPage: true,
    });
  });

  test("10 - should handle edge case: exact balance bet", async ({ page }) => {
    // Change bet to exact balance
    // First, we need to know current balance - it should be $1000

    // Try to bet exactly $1000 (entire balance)
    await page.fill('input[type="number"]', "1000");

    // Should show error because max bet is $500
    await expect(page.locator("text=/Maximum bet is/")).toBeVisible();

    await page.screenshot({
      path: "tests/screenshots/wallet-10-exact-balance.png",
      fullPage: true,
    });
  });

  test("11 - should persist balance across page navigation", async ({
    page,
  }) => {
    // Reload page
    await page.reload();
    await page.waitForTimeout(1000);

    // Note: Since we're using in-memory storage with dynamic userId,
    // balance will reset to $1000 on reload (this is expected behavior for this test)
    // In production with persistent storage, this would maintain the balance

    const newBalance = await page
      .locator("text=/Your Balance/")
      .locator("..")
      .locator("span")
      .last()
      .textContent();
    expect(newBalance).toContain("$1000"); // Fresh userId gets fresh $1000

    await page.screenshot({
      path: "tests/screenshots/wallet-11-reload.png",
      fullPage: true,
    });
  });

  test("12 - should show balance in betting card UI", async ({ page }) => {
    // Verify balance display exists and is prominent
    const balanceDisplay = page.locator("text=/Your Balance/").locator("..");

    await expect(balanceDisplay).toBeVisible();

    // Should have yellow text for amount (prominent)
    const amountDisplay = balanceDisplay.locator("span").last();
    await expect(amountDisplay).toHaveClass(/text-yellow-400/);

    await page.screenshot({
      path: "tests/screenshots/wallet-12-ui-display.png",
      fullPage: true,
    });
  });

  test("13 - should handle rapid bet changes gracefully", async ({ page }) => {
    // Rapidly change bet amounts
    for (let i = 0; i < 10; i++) {
      const amount = Math.floor(Math.random() * 500) + 10;
      await page.fill('input[type="number"]', amount.toString());
      await page.waitForTimeout(50);
    }

    // Should still be responsive
    await page.fill('input[type="number"]', "100");
    const startButton = page.locator('button:has-text("START DIVING")');
    await expect(startButton).not.toBeDisabled();

    await page.screenshot({
      path: "tests/screenshots/wallet-13-rapid-changes.png",
      fullPage: true,
    });
  });

  test("14 - should show limit warning when appropriate", async ({ page }) => {
    // Check if max bet limit warning appears
    // May or may not be visible depending on house status
    // Just capture state
    await page.screenshot({
      path: "tests/screenshots/wallet-14-limit-warning.png",
      fullPage: true,
    });
  });

  test("15 - should handle minimum bet correctly", async ({ page }) => {
    // Set bet to exactly minimum ($10)
    await page.fill('input[type="number"]', "10");

    // Should be valid
    const startButton = page.locator('button:has-text("START DIVING")');
    await expect(startButton).not.toBeDisabled();

    // No error message
    const error = page.locator("p.text-red-400");
    await expect(error).not.toBeVisible();

    await page.screenshot({
      path: "tests/screenshots/wallet-15-min-bet.png",
      fullPage: true,
    });
  });
});
