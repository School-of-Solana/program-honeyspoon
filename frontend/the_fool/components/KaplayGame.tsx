"use client";

import { useEffect, useRef } from "react";
import kaplay from "kaplay";

export default function KaplayGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    // Initialize Kaplay
    const k = kaplay({
      canvas: canvasRef.current,
      width: 800,
      height: 600,
      background: [20, 20, 40],
      debug: true,
    });

    // Create a simple scene
    k.scene("main", () => {
      // Add player (simple colored rectangle)
      const player = k.add([
        k.rect(32, 32),
        k.pos(k.center()),
        k.anchor("center"),
        k.area(),
        k.body(),
        k.color(100, 255, 100),
        k.outline(4, k.rgb(0, 255, 0)),
        "player",
      ]);

      // Add some text
      k.add([
        k.text("Press SPACE to jump!", { size: 24 }),
        k.pos(k.width() / 2, 50),
        k.anchor("center"),
        k.color(255, 255, 255),
      ]);

      // Add instructions
      k.add([
        k.text("Use ← → arrows to move", { size: 18 }),
        k.pos(k.width() / 2, 80),
        k.anchor("center"),
        k.color(200, 200, 200),
      ]);

      // Movement controls
      k.onKeyDown("left", () => {
        player.move(-240, 0);
      });

      k.onKeyDown("right", () => {
        player.move(240, 0);
      });

      // Jump
      k.onKeyPress("space", () => {
        if (player.isGrounded()) {
          player.jump();
        }
      });

      // Add floor
      k.add([
        k.rect(k.width(), 48),
        k.pos(0, k.height()),
        k.anchor("botleft"),
        k.area(),
        k.body({ isStatic: true }),
        k.color(127, 200, 255),
      ]);

      // Add some platforms
      k.add([
        k.rect(200, 32),
        k.pos(150, 400),
        k.area(),
        k.body({ isStatic: true }),
        k.color(255, 100, 100),
        k.outline(3, k.rgb(200, 50, 50)),
      ]);

      k.add([
        k.rect(200, 32),
        k.pos(450, 300),
        k.area(),
        k.body({ isStatic: true }),
        k.color(255, 200, 100),
        k.outline(3, k.rgb(200, 150, 50)),
      ]);

      // Add a collectible
      k.add([
        k.circle(16),
        k.pos(550, 250),
        k.anchor("center"),
        k.area(),
        k.color(255, 255, 0),
        k.outline(3, k.rgb(200, 200, 0)),
        "coin",
      ]);

      // Collect coin
      player.onCollide("coin", (coin) => {
        k.destroy(coin);
        k.debug.log("Coin collected!");
      });
    });

    // Start the scene
    k.go("main");

    // Set gravity
    k.setGravity(1600);

    // Cleanup
    return () => {
      k.quit();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        border: "2px solid #333",
        borderRadius: "8px",
      }}
    />
  );
}
