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
      background: [135, 206, 235], // Sky blue
      debug: true,
    });

    // Game state
    let balloonSize = 40;
    const maxSize = 200;
    const minSize = 40;
    let isPumping = false;
    let pumpY = 0;
    let isGameOver = false;

    // Create the main scene
    k.scene("main", () => {
      // Title
      k.add([
        k.text("Balloon Pump Game", { size: 32 }),
        k.pos(k.width() / 2, 30),
        k.anchor("center"),
        k.color(50, 50, 50),
      ]);

      // Instructions
      k.add([
        k.text("Click the pump to inflate!", { size: 20 }),
        k.pos(k.width() / 2, 70),
        k.anchor("center"),
        k.color(80, 80, 80),
      ]);

      // Size display
      const sizeText = k.add([
        k.text(`Size: ${balloonSize}/${maxSize}`, { size: 18 }),
        k.pos(k.width() / 2, 100),
        k.anchor("center"),
        k.color(100, 100, 100),
      ]);

      // Tube connecting balloon to pump
      const tube = k.add([
        k.rect(8, 200),
        k.pos(k.width() / 2 - 4, 250),
        k.color(100, 100, 100),
        k.z(0),
      ]);

      // Balloon (circle that grows)
      const balloon = k.add([
        k.circle(balloonSize),
        k.pos(k.width() / 2, 200),
        k.anchor("center"),
        k.color(255, 100, 150),
        k.outline(3, k.rgb(200, 50, 100)),
        k.z(10),
      ]);

      // Balloon tie (small triangle at bottom)
      const balloonTie = k.add([
        k.polygon([k.vec2(0, 0), k.vec2(-8, 15), k.vec2(8, 15)]),
        k.pos(k.width() / 2, 200 + balloonSize),
        k.anchor("center"),
        k.color(200, 50, 100),
        k.z(10),
      ]);

      // Pump base
      const pumpBase = k.add([
        k.rect(100, 40),
        k.pos(k.width() / 2 - 50, 500),
        k.color(150, 150, 150),
        k.outline(3, k.rgb(100, 100, 100)),
        k.z(5),
      ]);

      // Pump body
      const pumpBody = k.add([
        k.rect(60, 80),
        k.pos(k.width() / 2 - 30, 420),
        k.color(200, 50, 50),
        k.outline(3, k.rgb(150, 30, 30)),
        k.z(5),
      ]);

      // Pump handle
      const pumpHandle = k.add([
        k.rect(80, 20),
        k.pos(k.width() / 2 - 40, 400),
        k.color(100, 100, 100),
        k.outline(2, k.rgb(70, 70, 70)),
        k.area(),
        k.z(15),
        "pump",
      ]);

      // Pump handle grip
      k.add([
        k.circle(12),
        k.pos(k.width() / 2 - 40 + 40, 400 + 10),
        k.anchor("center"),
        k.color(80, 80, 80),
        k.z(16),
      ]);

      // Function to inflate balloon
      function inflateBalloon() {
        if (isGameOver) return;

        balloonSize += 8;
        sizeText.text = `Size: ${balloonSize}/${maxSize}`;

        // Animate pump
        isPumping = true;
        pumpY = 20;

        // Check if balloon pops
        if (balloonSize >= maxSize) {
          popBalloon();
        }
      }

      // Function to pop balloon
      function popBalloon() {
        isGameOver = true;
        k.destroy(balloon);
        k.destroy(balloonTie);

        // Create explosion particles
        for (let i = 0; i < 20; i++) {
          const angle = Math.random() * Math.PI * 2;
          const speed = 100 + Math.random() * 200;
          const velocityVec = k.Vec2.fromAngle(angle).scale(speed);

          const particle = k.add([
            k.circle(4),
            k.pos(k.width() / 2, 200),
            k.color(255, Math.random() * 155 + 100, Math.random() * 155 + 100),
            k.opacity(1),
            k.z(50),
          ]);

          // Manually animate particle
          particle.onUpdate(() => {
            particle.pos = particle.pos.add(velocityVec.scale(k.dt()));
            particle.opacity -= k.dt();
            if (particle.opacity <= 0) {
              k.destroy(particle);
            }
          });
        }

        // Game over text with animation
        const popText = k.add([
          k.text("POP! 🎈", { size: 48 }),
          k.pos(k.width() / 2, k.height() / 2),
          k.anchor("center"),
          k.color(255, 0, 0),
          k.scale(1),
          k.z(100),
        ]);

        // Animate pop text
        let scaleTimer = 0;
        popText.onUpdate(() => {
          scaleTimer += k.dt();
          const waveScale = k.wave(0.8, 1.2, scaleTimer * 4);
          popText.scale = k.vec2(waveScale, waveScale);
        });

        // Restart text
        k.wait(1.5, () => {
          k.add([
            k.text("Click anywhere to restart", { size: 24 }),
            k.pos(k.width() / 2, k.height() / 2 + 60),
            k.anchor("center"),
            k.color(80, 80, 80),
            k.z(100),
          ]);
        });
      }

      // Update loop
      k.onUpdate(() => {
        if (!isGameOver) {
          // Update balloon size
          balloon.radius = balloonSize;
          balloonTie.pos.y = 200 + balloonSize;

          // Animate pump compression
          if (isPumping) {
            pumpY = k.lerp(pumpY, 0, 0.2);
            if (pumpY < 0.5) {
              isPumping = false;
            }
          }

          // Update pump position
          pumpHandle.pos.y = 400 + pumpY;
          pumpBody.pos.y = 420 + pumpY / 2;

          // Balloon wobble effect
          balloon.pos.x =
            k.width() / 2 + Math.sin(k.time() * 2) * (balloonSize / 20);
          balloonTie.pos.x = balloon.pos.x;

          // Slow deflation over time
          if (balloonSize > minSize) {
            balloonSize -= 0.1;
            sizeText.text = `Size: ${Math.floor(balloonSize)}/${maxSize}`;
          }
        }
      });

      // Click on pump
      pumpHandle.onClick(() => {
        inflateBalloon();
      });

      // Click anywhere to restart when game over
      k.onClick(() => {
        if (isGameOver) {
          balloonSize = 40;
          isGameOver = false;
          k.go("main");
        }
      });
    });

    // Start the scene
    k.go("main");

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
        cursor: "pointer",
      }}
    />
  );
}
