/**
 * Scene Transition Bug Fixes Verification
 * Tests for:
 * 1. Second dive animations work (parallax scrolling)
 * 2. Surfacing returns to beach correctly
 */

import { test, expect } from "@playwright/test";

test.describe("Scene Transition Bug Fixes", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("http://localhost:3000");
    await page.waitForLoadState("networkidle");
    await page.waitForSelector("canvas");
    await page.waitForTimeout(1500);
  });

  test("Bug Fix #1: Second dive should have parallax animations", async ({
    page,
  }) => {
    const logs: string[] = [];
    page.on("console", (msg) => logs.push(msg.text()));

    console.log("\n🔍 Testing: Second dive animations...\n");

    // Start the game
    const startButton = page.locator('button:has-text("START GAME")');
    if (await startButton.isVisible()) {
      await startButton.click();
      await page.waitForTimeout(1000);
      console.log("✓ Game started");

      // First dive
      const diveButton = page.locator('button:has-text("DIVE DEEPER")');
      if (await diveButton.isVisible()) {
        console.log("\n1️⃣  FIRST DIVE:");
        await diveButton.click();
        await page.waitForTimeout(3500); // Wait for animation

        const firstDiveAnimationStarted = logs.some((log) =>
          log.includes("Starting dive animation")
        );
        const firstDiveComplete = logs.some((log) =>
          log.includes("Diving animation complete")
        );

        console.log(
          `   Animation started: ${firstDiveAnimationStarted ? "✓" : "✗"}`
        );
        console.log(`   Animation completed: ${firstDiveComplete ? "✓" : "✗"}`);

        // Second dive (this should also have animations!)
        if (await diveButton.isVisible()) {
          console.log("\n2️⃣  SECOND DIVE:");
          const logsBeforeSecond = logs.length;

          await diveButton.click();
          await page.waitForTimeout(3500); // Wait for animation

          // Check for new animation logs
          const newLogs = logs.slice(logsBeforeSecond);
          const secondDiveAnimationStarted = newLogs.some((log) =>
            log.includes("Starting dive animation")
          );
          const secondDiveComplete = newLogs.some((log) =>
            log.includes("Diving animation complete")
          );

          console.log(
            `   Animation started: ${secondDiveAnimationStarted ? "✓" : "✗"}`
          );
          console.log(
            `   Animation completed: ${secondDiveComplete ? "✓" : "✗"}`
          );

          // Test assertions
          expect(secondDiveAnimationStarted).toBeTruthy();
          console.log("\n✅ Bug Fix #1 VERIFIED: Second dive has animations!");

          // Print relevant logs
          console.log("\n📋 Animation Logs:");
          newLogs
            .filter(
              (log) =>
                log.includes("dive animation") || log.includes("isDiving")
            )
            .forEach((log) => console.log(`   ${log}`));
        }
      }
    }
  });

  test("Bug Fix #2: Surfacing should return to beach", async ({ page }) => {
    const logs: string[] = [];
    page.on("console", (msg) => logs.push(msg.text()));

    console.log("\n🔍 Testing: Surfacing returns to beach...\n");

    // Start the game
    const startButton = page.locator('button:has-text("START GAME")');
    if (await startButton.isVisible()) {
      await startButton.click();
      await page.waitForTimeout(1000);
      console.log("✓ Game started");

      // Dive once
      const diveButton = page.locator('button:has-text("DIVE DEEPER")');
      if (await diveButton.isVisible()) {
        console.log("\n1️⃣  DIVING:");
        await diveButton.click();
        await page.waitForTimeout(3500);
        console.log("   ✓ Dive completed");

        // Surface (cash out)
        const surfaceButton = page.locator('button:has-text("SURFACE")');
        if (await surfaceButton.isVisible()) {
          console.log("\n2️⃣  SURFACING:");
          const logsBeforeSurface = logs.length;

          await surfaceButton.click();
          await page.waitForTimeout(4000); // Wait for surfacing animation (3s + buffer)

          // Check for surfacing logs
          const newLogs = logs.slice(logsBeforeSurface);
          const surfacingTriggered = newLogs.some((log) =>
            log.includes("Transitioning to surfacing")
          );
          const surfacingComplete = newLogs.some((log) =>
            log.includes("Surfacing complete")
          );
          const returnedToBeach = newLogs.some(
            (log) =>
              log.includes("Returning to beach") ||
              log.includes("Beach scene created")
          );

          console.log(
            `   Surfacing triggered: ${surfacingTriggered ? "✓" : "✗"}`
          );
          console.log(
            `   Surfacing complete: ${surfacingComplete ? "✓" : "✗"}`
          );
          console.log(`   Returned to beach: ${returnedToBeach ? "✓" : "✗"}`);

          // Test assertions
          expect(surfacingTriggered || surfacingComplete).toBeTruthy();
          expect(returnedToBeach).toBeTruthy();
          console.log("\n✅ Bug Fix #2 VERIFIED: Surfacing returns to beach!");

          // Print relevant logs
          console.log("\n📋 Surfacing Logs:");
          newLogs
            .filter(
              (log) =>
                log.includes("surfacing") ||
                log.includes("beach") ||
                log.includes("SURFACE")
            )
            .forEach((log) => console.log(`   ${log}`));

          // Verify we can dive again
          await page.waitForTimeout(1000);
          if (await startButton.isVisible()) {
            console.log("\n3️⃣  VERIFYING: Can start new game from beach");
            console.log("   ✓ Betting card visible - back at beach!");
          }
        }
      }
    }
  });

  test("Complete flow: Multiple dives + surfacing", async ({ page }) => {
    const logs: string[] = [];
    page.on("console", (msg) => logs.push(msg.text()));

    console.log("\n🎮 Testing: Complete multi-dive flow...\n");

    // Start game
    const startButton = page.locator('button:has-text("START GAME")');
    await startButton.click();
    await page.waitForTimeout(1000);
    console.log("✓ Game started");

    const diveButton = page.locator('button:has-text("DIVE DEEPER")');
    const surfaceButton = page.locator('button:has-text("SURFACE")');

    // Perform 3 dives
    for (let i = 1; i <= 3; i++) {
      if (await diveButton.isVisible()) {
        console.log(`\n${i}️⃣  DIVE ${i}:`);
        const logsBeforeDive = logs.length;

        await diveButton.click();
        await page.waitForTimeout(3500);

        const newLogs = logs.slice(logsBeforeDive);
        const hadAnimation = newLogs.some((log) =>
          log.includes("dive animation")
        );
        console.log(`   Animation: ${hadAnimation ? "✓" : "✗"}`);

        if (!hadAnimation) {
          console.log(`   ⚠️  No animation on dive ${i}!`);
          // Print debug logs
          console.log("   Debug logs:");
          newLogs
            .filter(
              (log) => log.includes("[CANVAS]") || log.includes("[STORE]")
            )
            .forEach((log) => console.log(`     ${log}`));
        }
      }
    }

    // Surface
    if (await surfaceButton.isVisible()) {
      console.log("\n🏄 SURFACING:");
      await surfaceButton.click();
      await page.waitForTimeout(4000);

      const returnedToBeach = logs.some(
        (log) =>
          log.includes("Returning to beach") ||
          log.includes("Surfacing complete")
      );
      console.log(`   Returned to beach: ${returnedToBeach ? "✓" : "✗"}`);

      // Verify back at beach
      await page.waitForTimeout(1000);
      if (await startButton.isVisible()) {
        console.log("   ✓ Betting card visible - successfully returned!");
      }
    }

    console.log("\n✅ Complete flow test finished!");
  });
});
