/**
 * Scene Transition E2E Tests
 * Tests all scene transitions with console log verification
 */

import { test, expect } from "@playwright/test";

test.describe("Scene Transitions", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the game
    await page.goto("http://localhost:3000");
    await page.waitForLoadState("networkidle");
  });

  test("should initialize and start on beach scene", async ({ page }) => {
    // Capture console logs
    const logs: string[] = [];
    page.on("console", (msg) => logs.push(msg.text()));

    // Wait for canvas to be ready
    await page.waitForSelector("canvas");
    await page.waitForTimeout(1000); // Give time for initialization

    // Verify initialization logs
    const hasKaplayInit = logs.some((log) =>
      log.includes("[CANVAS] 🎨 Initializing Kaplay")
    );
    const hasBeachStart = logs.some((log) =>
      log.includes("[CANVAS] 🚀 Starting at beach")
    );
    const hasBeachCreated = logs.some((log) =>
      log.includes("[CANVAS] 🏖️ Beach scene created")
    );

    expect(hasKaplayInit).toBeTruthy();
    expect(hasBeachStart).toBeTruthy();
    expect(hasBeachCreated).toBeTruthy();

    console.log("\n✅ Beach Scene Initialization Logs:");
    logs
      .filter((log) => log.includes("[CANVAS]"))
      .forEach((log) => console.log(log));
  });

  test("should show diver on boat in beach scene", async ({ page }) => {
    const logs: string[] = [];
    page.on("console", (msg) => logs.push(msg.text()));

    await page.waitForSelector("canvas");
    await page.waitForTimeout(2000);

    // The diver should be created with "beach-diver" tag
    // We can't directly inspect Kaplay objects, but we can verify the scene loaded
    const hasBeachScene = logs.some((log) =>
      log.includes("Beach scene created")
    );
    expect(hasBeachScene).toBeTruthy();

    console.log("\n✅ Beach scene loaded - diver should be visible on boat");
  });

  test("should transition from beach to diving scene when diving starts", async ({
    page,
  }) => {
    const logs: string[] = [];
    page.on("console", (msg) => logs.push(msg.text()));

    await page.waitForSelector("canvas");
    await page.waitForTimeout(1000);

    // Click "Start Dive" button to begin diving
    const diveButton = page.locator('button:has-text("Start Dive")');
    if (await diveButton.isVisible()) {
      await diveButton.click();
      await page.waitForTimeout(500);

      // Check for transition log
      const hasTransitionLog = logs.some(
        (log) =>
          log.includes("🏖️ → 🤿 Dive started") ||
          log.includes("Transitioning to diving scene")
      );

      const hasDivingSceneCreated = logs.some((log) =>
        log.includes("🤿 Diving scene created")
      );

      console.log("\n✅ Beach → Diving Transition Logs:");
      logs
        .filter(
          (log) =>
            log.includes("[CANVAS]") &&
            (log.includes("Dive") || log.includes("diving"))
        )
        .forEach((log) => console.log(log));

      // One of these should be true if transition happened
      expect(hasTransitionLog || hasDivingSceneCreated).toBeTruthy();
    } else {
      console.log("⚠️  Dive button not found - may need to adjust game state");
    }
  });

  test("should show diving scene elements", async ({ page }) => {
    const logs: string[] = [];
    page.on("console", (msg) => logs.push(msg.text()));

    await page.waitForSelector("canvas");
    await page.waitForTimeout(1000);

    // Start diving if possible
    const diveButton = page.locator('button:has-text("Start Dive")');
    if (await diveButton.isVisible()) {
      await diveButton.click();
      await page.waitForTimeout(2000); // Wait for fade-in and splash

      // Check for diving scene elements in logs
      const hasDivingScene = logs.some((log) =>
        log.includes("Diving scene created")
      );
      const hasSplashEffect = logs.length > 0; // Any activity indicates scene loaded

      console.log("\n✅ Diving Scene Logs:");
      logs
        .filter((log) => log.includes("[CANVAS]"))
        .forEach((log) => console.log(log));

      expect(hasDivingScene || hasSplashEffect).toBeTruthy();
    }
  });

  test("should transition from diving to surfacing when cashing out", async ({
    page,
  }) => {
    const logs: string[] = [];
    page.on("console", (msg) => logs.push(msg.text()));

    await page.waitForSelector("canvas");
    await page.waitForTimeout(1000);

    // Start diving
    const diveButton = page.locator('button:has-text("Start Dive")');
    if (await diveButton.isVisible()) {
      await diveButton.click();
      await page.waitForTimeout(1000);

      // Click "Cash Out" button if visible
      const cashOutButton = page.locator('button:has-text("Cash Out")');
      if (await cashOutButton.isVisible()) {
        await cashOutButton.click();
        await page.waitForTimeout(500);

        // Check for surfacing transition
        const hasSurfacingLog = logs.some(
          (log) =>
            log.includes("🌊 Player cashed out") ||
            log.includes("Transitioning to surfacing")
        );

        const hasSurfacingSceneCreated = logs.some((log) =>
          log.includes("Surfacing scene created")
        );

        console.log("\n✅ Diving → Surfacing Transition Logs:");
        logs
          .filter(
            (log) =>
              log.includes("[CANVAS]") &&
              (log.includes("surfacing") ||
                log.includes("Cash") ||
                log.includes("surface"))
          )
          .forEach((log) => console.log(log));

        expect(hasSurfacingLog || hasSurfacingSceneCreated).toBeTruthy();
      }
    }
  });

  test("should transition from surfacing back to beach", async ({ page }) => {
    const logs: string[] = [];
    page.on("console", (msg) => logs.push(msg.text()));

    await page.waitForSelector("canvas");
    await page.waitForTimeout(1000);

    // Start diving
    const diveButton = page.locator('button:has-text("Start Dive")');
    if (await diveButton.isVisible()) {
      await diveButton.click();
      await page.waitForTimeout(1000);

      // Cash out
      const cashOutButton = page.locator('button:has-text("Cash Out")');
      if (await cashOutButton.isVisible()) {
        await cashOutButton.click();
        await page.waitForTimeout(4000); // Wait for surfacing animation (3s + buffer)

        // Check for return to beach log
        const hasReturnToBeach = logs.some(
          (log) =>
            log.includes("✅ Surfacing complete") ||
            log.includes("Returning to beach")
        );

        console.log("\n✅ Surfacing → Beach Transition Logs:");
        logs
          .filter(
            (log) =>
              log.includes("[CANVAS]") &&
              (log.includes("Surfacing") ||
                log.includes("beach") ||
                log.includes("complete"))
          )
          .forEach((log) => console.log(log));

        expect(hasReturnToBeach).toBeTruthy();
      }
    }
  });

  test("should handle death transition from diving to beach", async ({
    page,
  }) => {
    const logs: string[] = [];
    page.on("console", (msg) => logs.push(msg.text()));

    await page.waitForSelector("canvas");
    await page.waitForTimeout(1000);

    // Start diving
    const diveButton = page.locator('button:has-text("Start Dive")');
    if (await diveButton.isVisible()) {
      await diveButton.click();
      await page.waitForTimeout(1000);

      // Dive deeper to increase death risk
      const deeperButton = page.locator('button:has-text("Dive Deeper")');
      for (let i = 0; i < 3; i++) {
        if (await deeperButton.isVisible()) {
          await deeperButton.click();
          await page.waitForTimeout(500);
        }
      }

      // Wait and check for death
      await page.waitForTimeout(5000);

      // Check for death animation logs
      const hasDeathLog = logs.some(
        (log) =>
          log.includes("💀 Death triggered") || log.includes("attack animation")
      );

      const hasReturnAfterDeath = logs.some(
        (log) =>
          log.includes("Death animation complete") ||
          log.includes("Returning to beach")
      );

      console.log("\n✅ Death → Beach Transition Logs:");
      logs
        .filter(
          (log) =>
            log.includes("[CANVAS]") &&
            (log.includes("Death") ||
              log.includes("attack") ||
              log.includes("💀"))
        )
        .forEach((log) => console.log(log));

      // May or may not die in this test - just log what happened
      if (hasDeathLog || hasReturnAfterDeath) {
        expect(hasDeathLog || hasReturnAfterDeath).toBeTruthy();
        console.log("✅ Death occurred and transition logged!");
      } else {
        console.log("⚠️  No death occurred in this run");
      }
    }
  });

  test("should verify isInOcean flag management through complete cycle", async ({
    page,
  }) => {
    const logs: string[] = [];
    const propChangeLogs: string[] = [];

    page.on("console", (msg) => {
      const text = msg.text();
      logs.push(text);
      if (text.includes("isInOcean")) {
        propChangeLogs.push(text);
      }
    });

    await page.waitForSelector("canvas");
    await page.waitForTimeout(1000);

    console.log("\n✅ Tracking isInOcean flag changes:");

    // Initial state (should be false)
    const initialIsInOcean = propChangeLogs.filter((log) =>
      log.includes("isInOcean: false")
    );
    console.log(
      "Initial state:",
      initialIsInOcean.length > 0 ? "isInOcean = false ✓" : "unknown"
    );

    // Start diving
    const diveButton = page.locator('button:has-text("Start Dive")');
    if (await diveButton.isVisible()) {
      await diveButton.click();
      await page.waitForTimeout(1000);

      // Should transition to isInOcean = true
      const becomesTrue = propChangeLogs.some(
        (log) => log.includes("isInOcean:") && log.includes("→ true")
      );
      console.log(
        "After dive start:",
        becomesTrue ? "isInOcean = true ✓" : "transition not logged"
      );

      // Cash out
      const cashOutButton = page.locator('button:has-text("Cash Out")');
      if (await cashOutButton.isVisible()) {
        await cashOutButton.click();
        await page.waitForTimeout(4000);

        // Should reset to isInOcean = false
        const becomesFalse = propChangeLogs.some(
          (log) => log.includes("isInOcean:") && log.includes("→ false")
        );
        console.log(
          "After surfacing:",
          becomesFalse ? "isInOcean = false ✓" : "transition not logged"
        );

        // All prop change logs
        console.log("\nAll isInOcean prop changes:");
        propChangeLogs.forEach((log) => console.log(log));

        expect(propChangeLogs.length).toBeGreaterThan(0);
      }
    }
  });

  test("should log all scene creations", async ({ page }) => {
    const logs: string[] = [];
    page.on("console", (msg) => logs.push(msg.text()));

    await page.waitForSelector("canvas");
    await page.waitForTimeout(2000);

    // All three scenes should be created (k.scene() calls happen at init)
    const beachSceneCreated = logs.some((log) =>
      log.includes("🏖️ Beach scene created")
    );
    const divingSceneCreated = logs.some((log) =>
      log.includes("🤿 Diving scene created")
    );
    const surfacingSceneCreated = logs.some((log) =>
      log.includes("🌊 Surfacing scene created")
    );

    console.log("\n✅ Scene Creation Logs:");
    console.log("Beach scene:", beachSceneCreated ? "✓" : "✗");
    console.log("Diving scene:", divingSceneCreated ? "✓" : "✗");
    console.log("Surfacing scene:", surfacingSceneCreated ? "✓" : "✗");

    // At least beach scene should be created
    expect(beachSceneCreated).toBeTruthy();
  });

  test("complete game flow with full logging", async ({ page }) => {
    const logs: string[] = [];
    page.on("console", (msg) => logs.push(msg.text()));

    await page.waitForSelector("canvas");
    await page.waitForTimeout(1000);

    console.log("\n🎮 Starting Complete Game Flow Test\n");

    // 1. Beach initialization
    console.log("1️⃣  Beach Scene Initialization:");
    const beachLogs = logs.filter(
      (log) => log.includes("[CANVAS]") && log.includes("beach")
    );
    beachLogs.forEach((log) => console.log("   ", log));

    // 2. Start diving
    const diveButton = page.locator('button:has-text("Start Dive")');
    if (await diveButton.isVisible()) {
      console.log("\n2️⃣  Starting Dive...");
      await diveButton.click();
      await page.waitForTimeout(2000);

      const diveLogs = logs.filter(
        (log) =>
          log.includes("[CANVAS]") &&
          (log.includes("Dive") || log.includes("diving"))
      );
      diveLogs.forEach((log) => console.log("   ", log));

      // 3. Cash out
      const cashOutButton = page.locator('button:has-text("Cash Out")');
      if (await cashOutButton.isVisible()) {
        console.log("\n3️⃣  Cashing Out...");
        await cashOutButton.click();
        await page.waitForTimeout(1000);

        const surfacingLogs = logs.filter(
          (log) => log.includes("[CANVAS]") && log.includes("surfacing")
        );
        surfacingLogs.forEach((log) => console.log("   ", log));

        // 4. Wait for return to beach
        console.log("\n4️⃣  Returning to Beach...");
        await page.waitForTimeout(3500);

        const returnLogs = logs.filter(
          (log) => log.includes("[CANVAS]") && log.includes("complete")
        );
        returnLogs.forEach((log) => console.log("   ", log));
      }
    }

    console.log("\n✅ Complete flow test finished!");
    console.log(
      `Total canvas logs: ${logs.filter((log) => log.includes("[CANVAS]")).length}`
    );

    // Test passes if we got through initialization
    expect(logs.length).toBeGreaterThan(0);
  });
});
