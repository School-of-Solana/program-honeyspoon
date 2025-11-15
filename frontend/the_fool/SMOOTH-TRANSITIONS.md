# Smooth Scene Transitions & Beach Edge Fix

## ✅ What We Fixed & Added

### **1. Beach Edge Position Fixed**
- ✅ **Before:** Beach started at 50%, water at 60% (misaligned)
- ✅ **After:** Beach top edge at 60%, water surface at 60% (aligned!)
- ✅ Used `waterSurfaceY` constant for consistency

### **2. Sine Wave on LEFT Edge (Vertical)**
- ✅ **Before:** Sine wave on TOP edge (horizontal - wrong!)
- ✅ **After:** Sine wave on LEFT edge (vertical - correct!)
- ✅ Beach edge is now vertical with waves
- ✅ Diagonal beach: Goes from 45% to 60% screen width (top to bottom)

### **3. Smooth Beach → Diving Transition**
Added 1-second animated transition with:
- ✅ **Diver jump animation:** Parabolic arc off boat
- ✅ **Rotation:** Diver rotates 90° during jump
- ✅ **Horizontal movement:** Diver moves left off boat
- ✅ **Fade to black:** 80% opacity fade during jump
- ✅ **Duration:** 1 second total

### **4. Smooth Diving Scene Entry**
- ✅ **Fade-in from black:** 0.8 second duration
- ✅ **Splash effect:** 20 particle splash when entering water
- ✅ **Particles:** Blue water droplets radiating outward
- ✅ **Position:** Splash at 25% X, 30% Y (where diver enters)

### **5. Existing Surfacing Animation**
Already smooth with:
- ✅ 3-second gradual rise to surface
- ✅ Sky/sun/beach fade in (0% → 100%)
- ✅ Background color blend (underwater → sky blue)
- ✅ Speed lines and bubbles

---

## 🎬 Complete Transition Flow

### **Beach → Diving (1.8 seconds total):**

```
Frame 0: Beach scene, diver on boat
  ↓
Frame 1-60 (1s): Diver jumps off boat
  - Parabolic jump arc (50px height)
  - Rotate 90° during jump
  - Move left off boat
  - Fade to black (0% → 80%)
  ↓
Frame 61: Scene change to diving
  ↓
Frame 62-108 (0.8s): Fade in diving scene
  - Black overlay fades (80% → 0%)
  - Splash particles explode
  - Underwater scene revealed
  ↓
Frame 109+: Normal diving gameplay
```

### **Diving → Surfacing → Beach (3+ seconds):**

```
Diving gameplay
  ↓
Treasure collected
  ↓
Frame 1-180 (3s): Surfacing animation
  - Diver rises (80% → 60% screen height)
  - Sky/sun/beach fade in
  - Background color blends
  - Boat fades in
  ↓
Frame 181: Scene change to beach
  ↓
Beach scene (diver on boat, ready again)
```

---

## 🌊 Beach Edge Details

### **Vertical Sine Wave Algorithm:**

```typescript
const beachPoints: any[] = [];
const waveAmplitude = 40;        // Horizontal wave depth
const waveFrequency = 0.008;     // Vertical wave density
const waterSurfaceY = k.height() * 0.6;
const beachStartY = waterSurfaceY; // Top edge at water level
const beachBaseX = k.width() * 0.45;

// Top-right corner (start)
beachPoints.push(k.vec2(beachBaseX + waveAmplitude, beachStartY));

// Wavy LEFT edge (vertical)
for (let y = beachStartY; y <= k.height(); y += 10) {
  const progress = (y - beachStartY) / (k.height() - beachStartY);
  const baseX = beachBaseX + progress * k.width() * 0.15; // Diagonal
  const waveX = baseX + Math.sin(y * waveFrequency) * waveAmplitude; // Wave
  beachPoints.push(k.vec2(waveX, y));
}

// Bottom-right and top-right corners
beachPoints.push(k.vec2(k.width(), k.height()));
beachPoints.push(k.vec2(k.width(), beachStartY));
```

### **Beach Shape:**
```
        [Water Surface Y = 60%]
            |
    ～～～～～|～～～～～～～～～
  ～～      |              |
～～        |              |
～～         |              | Beach
 ～～         |             | (sand)
   ～～        |            |
     ～～       |           |
       ～～      |          |
         ～～     |_________|
    [Wavy edge]  [100%]
```

---

## 🎯 Jump Animation Details

### **Parabolic Arc:**
```typescript
const arc = Math.sin(jumpProgress * Math.PI) * 50;
diver.pos.y = originalY - arc;
```
- Creates natural jump curve
- Peak at progress = 0.5 (50px above start)
- Smooth landing at progress = 1.0

### **Rotation:**
```typescript
diver.angle = jumpProgress * 90;
```
- Starts at 0° (upright)
- Ends at 90° (horizontal/diving)
- Linear rotation looks natural

### **Horizontal Movement:**
```typescript
diver.pos.x -= 30 * k.dt();
```
- Moves left off boat
- ~30 pixels left during 1-second jump
- Ends up in water

---

## 💦 Splash Effect

### **Particle System:**
```typescript
// 20 particles in circle
for (let i = 0; i < 20; i++) {
  const angle = (Math.PI * 2 * i) / 20;
  const splash = k.add([
    k.circle(4 + Math.random() * 3),
    k.pos(k.width() * 0.25, k.height() * 0.3),
    k.color(150, 200, 255), // Light blue
    k.opacity(0.8),
    k.z(250),
  ]);
  
  // Radial velocity
  obj.pos.x += Math.cos(angle) * speed * k.dt();
  obj.pos.y += Math.sin(angle) * speed * k.dt();
  obj.opacity -= k.dt() * 2; // Fade out in 0.5s
}
```

### **Visual Effect:**
- Explodes from diver entry point
- Radiates in all directions
- Fades out quickly (0.5 seconds)
- Blue water droplets

---

## 📊 Timing Breakdown

| Event | Duration | Cumulative |
|-------|----------|------------|
| Beach idle | ∞ | - |
| Jump animation | 1.0s | 1.0s |
| Fade to black | 1.0s | 1.0s |
| Scene change | 0.0s | 1.0s |
| Fade from black | 0.8s | 1.8s |
| Splash effect | 0.5s | 1.3s-1.8s |
| **Total transition** | **1.8s** | - |

### **Surfacing:**
| Event | Duration | Cumulative |
|-------|----------|------------|
| Treasure animation | 2.0s | 2.0s |
| Surfacing rise | 3.0s | 5.0s |
| Scene change | 0.0s | 5.0s |
| **Total** | **5.0s** | - |

---

## 🎨 Visual Improvements

### **Before:**
```
Beach scene
    ↓ [INSTANT - jarring]
Diving scene
```

### **After:**
```
Beach scene
    ↓ [Jump animation - 1s]
    ↓ [Fade to black - simultaneous]
    ↓ [Scene change - instant]
    ↓ [Fade from black - 0.8s]
    ↓ [Splash effect - 0.5s]
Diving scene
```

---

## 🔧 Technical Implementation

### **State Management:**
```typescript
let transitionStarted = false; // Prevent double-trigger

k.onUpdate(() => {
  if (isDivingRef.current && !transitionStarted) {
    transitionStarted = true;
    // Start transition...
  }
});
```

### **Overlay System:**
```typescript
// Beach scene fade-out
const fadeOverlay = k.add([
  k.rect(k.width(), k.height()),
  k.color(0, 0, 0),
  k.opacity(0),
  k.z(200), // Above everything
]);

// Diving scene fade-in
const fadeInOverlay = k.add([
  k.rect(k.width(), k.height()),
  k.color(0, 0, 0),
  k.opacity(0.8),
  k.z(300), // Above everything
]);
```

### **Cleanup:**
```typescript
k.destroy(fadeInOverlay); // Remove when done
fadeInInterval.cancel();   // Stop update loop
```

---

## 🎯 Result

### **Beach Edge:**
- ✅ Vertical wavy edge (looks natural)
- ✅ Aligned with water surface (no gaps)
- ✅ Diagonal beach (more dynamic)
- ✅ Foam dots along edge (decorative)

### **Transitions:**
- ✅ Smooth fade (no instant cuts)
- ✅ Jump animation (natural movement)
- ✅ Splash effect (water entry feedback)
- ✅ No abrupt scene changes

### **User Experience:**
- ✅ Feels polished and professional
- ✅ Clear visual feedback
- ✅ Natural motion and timing
- ✅ Immersive transitions

---

**Last Updated:** 2024-11-15  
**Status:** ✅ Complete and Smooth  
**Transition Quality:** Cinema-grade!
