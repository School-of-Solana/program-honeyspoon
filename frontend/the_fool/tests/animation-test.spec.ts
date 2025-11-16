import { test, expect } from "@playwright/test";

test.describe("Animation System Tests", () => {
  let consoleLogs: string[] = [];
  let canvasLogs: string[] = [];

  test.beforeEach(async ({ page }) => {
    consoleLogs = [];
    canvasLogs = [];

    page.on("console", (msg) => {
      const text = msg.text();
      consoleLogs.push(text);

      if (text.includes("[CANVAS]")) {
        canvasLogs.push(text);
        console.log("🎨 CANVAS:", text);
      }

      if (text.includes("[GAME]")) {
        console.log("🎮 GAME:", text);
      }
    });

    await page.goto("/");
    await page.waitForLoadState("networkidle");
  });

  test("Canvas Initialization Test", async ({ page }) => {
    console.log("\n========== TEST: CANVAS INITIALIZATION ==========");

    await page.waitForTimeout(2000);

    // Check for initialization logs
    const hasInitLog = canvasLogs.some((log) =>
      log.includes("🎬 OceanScene useEffect triggered")
    );
    const hasKaplayInit = canvasLogs.some((log) =>
      log.includes("✅ Kaplay initialized")
    );
    const hasSceneCreated = canvasLogs.some((log) =>
      log.includes("🎮 Ocean scene created")
    );

    console.log("\nInitialization Check:");
    console.log("  UseEffect triggered:", hasInitLog ? "✅" : "❌");
    console.log("  Kaplay initialized:", hasKaplayInit ? "✅" : "❌");
    console.log("  Scene created:", hasSceneCreated ? "✅" : "❌");

    expect(hasInitLog).toBeTruthy();
    expect(hasKaplayInit).toBeTruthy();
    expect(hasSceneCreated).toBeTruthy();

    // Check for heartbeat (update loop running)
    await page.waitForTimeout(3000);
    const hasHeartbeat = canvasLogs.some((log) =>
      log.includes("💓 Update loop heartbeat")
    );
    console.log("  Update loop running:", hasHeartbeat ? "✅" : "❌");
    expect(hasHeartbeat).toBeTruthy();

    await page.screenshot({
      path: "tests/screenshots/anim-01-initialization.png",
      fullPage: true,
    });
  });

  test("Diving Animation Triggers", async ({ page }) => {
    console.log("\n========== TEST: DIVING ANIMATION ==========");

    // Start game
    await page.locator('input[type="number"]').fill("100");
    await page.locator('button:has-text("START DIVING")').click();
    await page.waitForTimeout(1500);

    // Clear logs to focus on dive
    canvasLogs = [];
    consoleLogs = [];

    console.log("\n📍 Clicking DIVE DEEPER button...");
    const diveButton = page.locator('button:has-text("DIVE DEEPER")').first();
    await diveButton.click();

    // Wait a bit for logs to populate
    await page.waitForTimeout(500);

    console.log("\n🔍 Checking for animation trigger logs...");

    // Check for prop update
    const hasPropUpdate = canvasLogs.some(
      (log) =>
        log.includes("[CANVAS PROPS UPDATE]") && log.includes("isDiving: true")
    );
    console.log(
      "  Props updated (isDiving: true):",
      hasPropUpdate ? "✅" : "❌"
    );

    // Check for state logging
    const hasStateLog = canvasLogs.some((log) =>
      log.includes("[CANVAS STATE]")
    );
    console.log("  State machine logging:", hasStateLog ? "✅" : "❌");

    // Check for conditions met
    const hasConditionsMet = canvasLogs.some((log) =>
      log.includes("✅ Conditions met for diving animation")
    );
    console.log("  Conditions met detected:", hasConditionsMet ? "✅" : "❌");

    // Check for animation trigger
    const hasAnimTrigger = canvasLogs.some((log) =>
      log.includes("Triggering diving animation")
    );
    console.log("  Animation triggered:", hasAnimTrigger ? "✅" : "❌");

    await page.screenshot({
      path: "tests/screenshots/anim-02-during-dive.png",
      fullPage: true,
    });

    // Wait for animation to complete
    await page.waitForTimeout(3000);

    // Check for completion log
    const hasCompletion = canvasLogs.some((log) =>
      log.includes("✅ Diving animation complete")
    );
    console.log("  Animation completed:", hasCompletion ? "✅" : "❌");

    await page.screenshot({
      path: "tests/screenshots/anim-03-after-dive.png",
      fullPage: true,
    });

    // Print all canvas logs for debugging
    console.log("\n📋 All Canvas Logs:");
    canvasLogs.forEach((log, i) => {
      console.log(`  ${i + 1}. ${log}`);
    });

    // Assertions
    expect(hasPropUpdate).toBeTruthy();
    expect(hasStateLog).toBeTruthy();
    expect(hasConditionsMet).toBeTruthy();
    expect(hasAnimTrigger).toBeTruthy();
  });

  test("Result Animation (Treasure or Death)", async ({ page }) => {
    console.log("\n========== TEST: RESULT ANIMATION ==========");

    // Start game
    await page.locator('input[type="number"]').fill("100");
    await page.locator('button:has-text("START DIVING")').click();
    await page.waitForTimeout(1500);

    // Dive
    await page.locator('button:has-text("DIVE DEEPER")').first().click();

    // Wait for full dive sequence
    await page.waitForTimeout(5000);

    console.log("\n🔍 Checking for result animation...");

    // Check if treasure or death animation triggered
    const hasTreasureAnim = canvasLogs.some((log) =>
      log.includes("Triggering treasure animation")
    );
    const hasDeathAnim = canvasLogs.some((log) =>
      log.includes("Triggering death animation")
    );

    console.log("  Treasure animation:", hasTreasureAnim ? "✅" : "❌");
    console.log("  Death animation:", hasDeathAnim ? "✅" : "❌");

    const hasResultAnim = hasTreasureAnim || hasDeathAnim;
    console.log("  Result animation triggered:", hasResultAnim ? "✅" : "❌");

    await page.screenshot({
      path: "tests/screenshots/anim-04-result.png",
      fullPage: true,
    });

    expect(hasResultAnim).toBeTruthy();
  });

  test("Multiple Dives Animation Flow", async ({ page }) => {
    console.log("\n========== TEST: MULTIPLE DIVES ==========");

    // Start game
    await page.locator('input[type="number"]').fill("100");
    await page.locator('button:has-text("START DIVING")').click();
    await page.waitForTimeout(1500);

    let diveCount = 0;
    const maxDives = 3;

    for (let i = 0; i < maxDives; i++) {
      diveCount++;
      console.log(`\n--- Dive #${diveCount} ---`);

      canvasLogs = [];

      const diveButton = page.locator('button:has-text("DIVE DEEPER")').first();

      if (!(await diveButton.isVisible())) {
        console.log("Dive button not visible, stopping");
        break;
      }

      await diveButton.click();
      console.log("  Clicked dive button");

      // Wait for animation sequence
      await page.waitForTimeout(5000);

      // Check animation triggered
      const hasAnimTrigger = canvasLogs.some((log) =>
        log.includes("Triggering diving animation")
      );
      console.log("  Diving animation:", hasAnimTrigger ? "✅" : "❌");

      // Check for drowned
      const isDrowned = await page
        .locator("text=DROWNED")
        .isVisible()
        .catch(() => false);

      if (isDrowned) {
        console.log("  Result: DROWNED 💀");

        const hasDeathAnim = canvasLogs.some((log) =>
          log.includes("Triggering death animation")
        );
        console.log("  Death animation:", hasDeathAnim ? "✅" : "❌");
        break;
      } else {
        console.log("  Result: SURVIVED ✅");

        const hasTreasureAnim = canvasLogs.some((log) =>
          log.includes("Triggering treasure animation")
        );
        console.log("  Treasure animation:", hasTreasureAnim ? "✅" : "❌");
      }

      await page.screenshot({
        path: `tests/screenshots/anim-05-dive-${diveCount}.png`,
        fullPage: true,
      });
    }

    console.log(`\n✅ Completed ${diveCount} dives`);
  });

  test("State Machine Logging", async ({ page }) => {
    console.log("\n========== TEST: STATE MACHINE LOGGING ==========");

    // Start game
    await page.locator('input[type="number"]').fill("100");
    await page.locator('button:has-text("START DIVING")').click();
    await page.waitForTimeout(1500);

    canvasLogs = [];

    // Dive
    await page.locator('button:has-text("DIVE DEEPER")').first().click();

    // Wait for state logs (logged every 2 seconds)
    await page.waitForTimeout(3000);

    console.log("\n🔍 Checking state machine logs...");

    const stateLogs = canvasLogs.filter((log) =>
      log.includes("[CANVAS STATE]")
    );
    console.log(`  Found ${stateLogs.length} state logs`);

    stateLogs.forEach((log, i) => {
      console.log(`  State ${i + 1}:`, log);
    });

    expect(stateLogs.length).toBeGreaterThan(0);
  });

  test.afterEach(async () => {
    console.log("\n========== TEST SUMMARY ==========");
    console.log(`Total console logs: ${consoleLogs.length}`);
    console.log(`Canvas logs: ${canvasLogs.length}`);

    if (canvasLogs.length === 0) {
      console.log("⚠️  WARNING: No canvas logs detected!");
    } else {
      console.log("✅ Canvas system is logging");
    }
  });
});
