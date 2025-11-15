# Sprite Audit & Usage Plan

## Available Sprites (15 total)

### ✅ Currently Used (6/15)

| Sprite | Frames | Usage | Location |
|--------|--------|-------|----------|
| **diver** | 28 (7×4, 32×32) | Main player character | OceanScene:318 |
| **shark** | 16 (8×2, 32×32) | Death animation (attack) | OceanScene:478 |
| **fish1** | 32 (8×4, 16×16) | Ambient swimming fish | OceanScene:398 |
| **seaweed** | 96 (12×8, 16×32) | Parallax layer 2 (vegetation) | OceanScene:201 |
| **corals** | 28 (4×7, 16×16) | Parallax layer 4 (foreground) | OceanScene:201 |
| **tiles** | 143 (11×13, 16×16) | Parallax layers 1 & 3 (rocks/background) | OceanScene:201 |

**Usage Summary:**
- ✓ Main character animation
- ✓ Ambient fish life
- ✓ Death sequence
- ✓ Parallax background layers

---

## ❌ Unused Sprites (9/15)

### 1. **fish2** - 32 frames (8×4, 32×16)
- **Size:** Larger than fish1 (32px wide vs 16px)
- **Potential Use:** Medium-sized fish for mid-depth zones

### 2. **fish3** - 32 frames (8×4, 32×16)
- **Size:** Same as fish2, different appearance
- **Potential Use:** Different species variety

### 3. **jellyfish** - 8 frames (4×2, 32×16)
- **Animation:** Float animation (6 fps)
- **Potential Use:** Passive floating creatures, obstacles, or ambient life

### 4. **sawshark** - 16 frames (8×2, 48×32)
- **Size:** Large predator (48px wide)
- **Animation:** Swim animation (8 fps)
- **Potential Use:** Rare dangerous creature, mini-boss

### 5. **seaangler** - 16 frames (8×2, 32×32)
- **Special:** Anglerfish (glowing lure!)
- **Animation:** Swim animation (6 fps, slower/creepier)
- **Potential Use:** Deep-zone predator with glowing light effect

### 6. **swordfish** - 8 frames (8×1, 48×32)
- **Size:** Large, fast (48px wide)
- **Animation:** Swim animation (10 fps, fastest!)
- **Potential Use:** Fast-moving danger, chase sequences

### 7. **bubble** - 10 frames (10×1, 8×8)
- **Animation:** Pop animation (15 fps)
- **Potential Use:** Replace simple bubble circles with animated sprites

### 8. **chest** - 12 frames (3×4, 16×16)
- **Animations:** closed, opening (0→2), open (frame 3)
- **Potential Use:** Treasure chest for successful dives

### 9. **coin** - 1 frame (1×1, 16×16)
- **Static sprite**
- **Potential Use:** Treasure particles, floating collectibles

---

## 🎯 Integration Plan

### Phase 1: Ambient Life Enhancement (EASY)

**Add fish variety to createFish() function**

Current: Only uses fish1
Improvement: Randomly spawn fish1, fish2, fish3

```typescript
function createFish() {
  const fishTypes = ["fish1", "fish2", "fish3"];
  const fishType = fishTypes[Math.floor(Math.random() * fishTypes.length)];
  const fishY = 100 + Math.random() * 400;
  const direction = Math.random() > 0.5 ? 1 : -1;
  const startX = direction > 0 ? -50 : k.width() + 50;
  
  const fish = k.add([
    k.sprite(fishType, { anim: "swim" }),
    k.pos(startX, fishY),
    k.anchor("center"),
    k.z(7),
    k.scale(direction > 0 ? 2 : -2, 2),
    k.opacity(lightLevel * 0.8),
  ]);
  
  // ... rest of logic
}
```

**Impact:**
- ✅ More visual variety
- ✅ Different fish sizes create depth
- ✅ Zero gameplay changes
- ⏱️ 5 minutes to implement

---

### Phase 2: Jellyfish Layer (EASY)

**Add jellyfish as slow-floating ambient creatures**

```typescript
// Add jellyfish layer in parallax or separate system
function createJellyfish() {
  const jellyfishY = 100 + Math.random() * 400;
  const jellyfishX = Math.random() * k.width();
  
  const jellyfish = k.add([
    k.sprite("jellyfish", { anim: "float" }),
    k.pos(jellyfishX, jellyfishY),
    k.anchor("center"),
    k.z(6),
    k.scale(2),
    k.opacity(0.7),
  ]);
  
  jellyfish.onUpdate(() => {
    // Slow vertical drift + sine wave horizontal
    jellyfish.pos.y -= 20 * k.dt();
    jellyfish.pos.x += Math.sin(k.time() * 2 + jellyfishY) * 30 * k.dt();
    
    // Wrap around
    if (jellyfish.pos.y < -50) {
      jellyfish.pos.y = k.height() + 50;
      jellyfish.pos.x = Math.random() * k.width();
    }
  });
}

// Spawn jellyfish periodically
k.loop(3, () => {
  if (Math.random() > 0.6) {
    createJellyfish();
  }
});
```

**Impact:**
- ✅ Adds graceful floating creatures
- ✅ Fills vertical space
- ✅ Unique movement pattern (float vs swim)
- ⏱️ 10 minutes to implement

---

### Phase 3: Bubble Sprite Replacement (EASY)

**Replace circle bubbles with animated bubble sprites**

Current: Simple circles
Improvement: Animated 10-frame bubble with pop animation

```typescript
function createBubble(x?: number, y?: number) {
  const bubbleX = x !== undefined ? x : diver.pos.x + (Math.random() - 0.5) * 30;
  const bubbleY = y !== undefined ? y : diver.pos.y - 10;
  
  const bubble = k.add([
    k.sprite("bubble", { anim: "pop" }), // Use animated sprite
    k.pos(bubbleX, bubbleY),
    k.anchor("center"),
    k.scale(2 + Math.random()),
    k.z(15),
    k.lifespan(3),
  ]);
  
  bubble.onUpdate(() => {
    bubble.pos.y -= (60 + divingSpeed) * k.dt();
    bubble.pos.x += Math.sin(k.time() * 3 + bubbleY) * 30 * k.dt();
  });
}
```

**Impact:**
- ✅ More polished look
- ✅ Bubble pop animation when destroyed
- ✅ Better visual feedback
- ⏱️ 5 minutes to implement

---

### Phase 4: Treasure Chest System (MEDIUM)

**Show treasure chest when finding shipwrecks**

When player survives a dive and discovers shipwreck:

```typescript
function showTreasureChest(x: number, y: number) {
  const chest = k.add([
    k.sprite("chest", { anim: "closed" }),
    k.pos(x, y),
    k.anchor("center"),
    k.scale(3),
    k.z(25),
  ]);
  
  // Opening sequence
  k.wait(0.5, () => {
    chest.play("opening");
    
    k.wait(0.4, () => {
      chest.play("open");
      
      // Spawn coin particles
      for (let i = 0; i < 10; i++) {
        createCoinParticle(x, y);
      }
    });
  });
  
  // Fade out after animation
  k.wait(2, () => {
    k.tween(
      chest.opacity,
      0,
      1,
      (val) => chest.opacity = val,
      k.easings.linear
    ).then(() => k.destroy(chest));
  });
}

function createCoinParticle(x: number, y: number) {
  const angle = Math.random() * Math.PI * 2;
  const speed = 100 + Math.random() * 100;
  
  const coin = k.add([
    k.sprite("coin"),
    k.pos(x, y),
    k.anchor("center"),
    k.scale(2),
    k.z(26),
    k.lifespan(1),
  ]);
  
  coin.onUpdate(() => {
    coin.pos.x += Math.cos(angle) * speed * k.dt();
    coin.pos.y += Math.sin(angle) * speed * k.dt();
    coin.opacity -= k.dt();
    coin.angle += 360 * k.dt(); // Spinning coin
  });
}

// Integrate into dive success
if (result.survived && result.shipwreck) {
  showTreasureChest(diver.pos.x, diver.pos.y);
}
```

**Impact:**
- ✅ Visual reward feedback
- ✅ Uses both chest and coin sprites
- ✅ Animated treasure collection
- ✅ Enhances shipwreck discovery moment
- ⏱️ 20 minutes to implement

---

### Phase 5: Depth-Based Predators (MEDIUM)

**Add dangerous creatures based on depth zones**

Different predators appear at different depths:

```typescript
function getDepthPredator(depth: number) {
  if (depth < 100) return null; // Safe zone
  if (depth < 200) return "shark"; // Shallow danger
  if (depth < 400) return "sawshark"; // Mid-depth menace
  if (depth < 600) return "swordfish"; // Deep hunter (fast!)
  return "seaangler"; // Abyss zone (glowing lure)
}

function createAmbientPredator() {
  const predator = getDepthPredator(depthRef.current);
  if (!predator) return;
  
  const direction = Math.random() > 0.5 ? 1 : -1;
  const startX = direction > 0 ? -100 : k.width() + 100;
  const predatorY = 100 + Math.random() * 400;
  
  const creature = k.add([
    k.sprite(predator, { anim: "swim" }),
    k.pos(startX, predatorY),
    k.anchor("center"),
    k.z(9),
    k.scale(direction * 3, 3),
    k.opacity(0.8),
  ]);
  
  // Add glowing light for seaangler
  if (predator === "seaangler") {
    const light = creature.add([
      k.circle(20),
      k.pos(direction > 0 ? 20 : -20, -10), // Lure position
      k.color(255, 255, 100),
      k.opacity(0.6),
    ]);
    
    // Pulsing glow
    light.onUpdate(() => {
      light.opacity = 0.4 + Math.sin(k.time() * 8) * 0.3;
    });
  }
  
  creature.onUpdate(() => {
    const speed = predator === "swordfish" ? 150 : 80;
    creature.pos.x += direction * speed * k.dt();
    creature.pos.y += Math.sin(k.time() * 2 + predatorY) * 20 * k.dt();
    
    if (
      (direction > 0 && creature.pos.x > k.width() + 100) ||
      (direction < 0 && creature.pos.x < -100)
    ) {
      k.destroy(creature);
    }
  });
}

// Spawn predators based on depth
k.loop(5, () => {
  if (depthRef.current > 100 && Math.random() > 0.5) {
    createAmbientPredator();
  }
});
```

**Depth Zone Predator Chart:**

| Depth Range | Zone | Predator | Behavior |
|-------------|------|----------|----------|
| 0-100m | Safe | None | Tutorial zone |
| 100-200m | Shallow | Shark | Normal speed patrol |
| 200-400m | Mid | Sawshark | Aggressive circling |
| 400-600m | Deep | Swordfish | Fast dash attacks |
| 600m+ | Abyss | Seaangler | Slow + glowing lure |

**Impact:**
- ✅ Visual depth progression
- ✅ Atmosphere: deeper = more dangerous
- ✅ Uses 4 unused predator sprites
- ✅ Glowing seaangler adds spooky effect
- ⏱️ 30 minutes to implement

---

### Phase 6: Death Variety (EASY)

**Randomize death animations with different creatures**

Current: Only shark attacks
Improvement: Different creature based on depth

```typescript
function triggerDeathAnimation() {
  console.log('[CANVAS] Triggering death animation!');
  isAnimating = true;
  animationType = 'death';
  divingSpeed = 0;
  
  // Choose predator based on current depth
  const predator = getDepthPredator(depthRef.current) || "shark";
  
  const direction = Math.random() > 0.5 ? 1 : -1;
  const startX = direction > 0 ? -100 : k.width() + 100;
  
  const creature = k.add([
    k.sprite(predator, { anim: "swim" }),
    k.pos(startX, diver.pos.y),
    k.anchor("center"),
    k.z(25),
    k.scale(direction * 3, 3),
  ]);
  
  // Custom message per predator
  const messages = {
    shark: "⚠️ SHARK ATTACK!",
    sawshark: "⚠️ SAWSHARK!",
    swordfish: "⚠️ IMPALED!",
    seaangler: "⚠️ LURED TO DEATH!",
  };
  
  messageDisplay.text = messages[predator as keyof typeof messages];
  messageDisplay.color = k.rgb(255, 50, 50);
  messageOpacity = 1;
  
  // ... rest of attack logic
}
```

**Impact:**
- ✅ Death variety prevents repetition
- ✅ Depth-appropriate creatures
- ✅ Themed death messages
- ⏱️ 10 minutes to implement

---

## 📊 Summary

### Sprite Usage After Implementation

| Category | Used | Unused | Usage % |
|----------|------|--------|---------|
| **Before** | 6 | 9 | 40% |
| **After** | 15 | 0 | **100%** 🎉 |

### Sprites Per Feature

**Ambient Life:**
- fish1, fish2, fish3 → Variety of swimming fish
- jellyfish → Floating creatures

**Parallax Layers:**
- tiles → Rock/background layers
- seaweed → Vegetation layer
- corals → Foreground layer

**Predators (Depth-based):**
- shark → 100-200m
- sawshark → 200-400m
- swordfish → 400-600m
- seaangler → 600m+

**Player & Effects:**
- diver → Player character
- bubble → Animated bubbles with pop

**Treasure System:**
- chest → Treasure discovery animation
- coin → Particle effects

### Implementation Priority

1. ✅ **Fish Variety** (5 min) - fish2, fish3
2. ✅ **Bubble Sprites** (5 min) - bubble
3. ✅ **Jellyfish** (10 min) - jellyfish
4. ✅ **Death Variety** (10 min) - sawshark, swordfish, seaangler
5. ✅ **Treasure Chest** (20 min) - chest, coin
6. ✅ **Depth Predators** (30 min) - sawshark, swordfish, seaangler (ambient)

**Total Time:** ~80 minutes for complete sprite integration

### Benefits

- ✅ **100% asset utilization** - No wasted sprites
- ✅ **Visual variety** - Prevents repetitive visuals
- ✅ **Depth progression** - Visual feedback for danger increase
- ✅ **Polished feel** - Animated sprites vs simple shapes
- ✅ **Thematic consistency** - All ocean-themed assets used
- ✅ **Replayability** - Randomized creatures keep it fresh

---

## 🎮 Bonus: Advanced Features (Optional)

### Rare "Boss" Encounters

Use large predators (sawshark, swordfish, seaangler) as rare mini-bosses:

```typescript
// 1% chance for boss encounter on deep dives
if (diveNumber > 5 && Math.random() < 0.01) {
  spawnBossEncounter();
}
```

**Boss behaviors:**
- Sawshark: Circles player before charging
- Swordfish: High-speed dash across screen
- Seaangler: Glowing lure hypnotic effect (screen flicker)

### Collectible Coins

Floating coins that add bonus treasure:

```typescript
function spawnFloatingCoin() {
  const coin = k.add([
    k.sprite("coin"),
    k.pos(Math.random() * k.width(), -50),
    k.anchor("center"),
    k.scale(2),
    k.z(15),
    k.area(),
    k.body(),
    "coin",
  ]);
  
  coin.onUpdate(() => {
    coin.pos.y += 50 * k.dt();
    coin.angle += 180 * k.dt(); // Spinning
    
    if (coin.pos.y > k.height() + 50) {
      k.destroy(coin);
    }
  });
  
  // Collision with diver
  coin.onCollide("diver", () => {
    // Add bonus treasure
    k.destroy(coin);
    createCoinParticle(coin.pos.x, coin.pos.y);
  });
}
```

### Bubble Trail

Use bubble sprites as persistent trail behind diver:

```typescript
// In diver update loop
if (isDiving && k.time() % 0.1 < k.dt()) {
  const trail = k.add([
    k.sprite("bubble", { frame: 0 }),
    k.pos(diver.pos.x, diver.pos.y + 20),
    k.anchor("center"),
    k.scale(1.5),
    k.z(19),
    k.lifespan(1),
  ]);
  
  trail.onUpdate(() => {
    trail.opacity -= k.dt();
    trail.scale -= k.dt();
  });
}
```

---

## Next Steps

1. Run `npm run dev`
2. Implement phases 1-6 in order
3. Test each phase before moving to next
4. Tweak spawn rates and behaviors
5. Enjoy 100% sprite utilization! 🎨

All sprites accounted for and purposefully integrated! 🐠🦈🫧💎
