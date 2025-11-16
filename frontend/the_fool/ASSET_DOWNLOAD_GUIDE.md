# 🎨 Asset Download Guide - Deep Sea Diver Game

## 📦 Required Sound Effects (All CC0/Public Domain)

### From Freesound.org:

1. **Retro Underwater Coin** (Treasure collect sound)
   - URL: https://freesound.org/people/LilMati/sounds/471245/
   - License: CC0 (Public Domain)
   - File: `Retro, Underwater Coin.wav`
   - Save as: `public/sounds/coin.wav`

2. **Retro Underwater Explosion** (Death/attack sound)
   - URL: https://freesound.org/people/LilMati/sounds/456966/
   - License: CC0 (Public Domain)
   - File: `Retro, Underwater Explosion.wav`
   - Save as: `public/sounds/explosion.wav`

3. **Bubble Textures** (Diving bubbles)
   - URL: https://freesound.org/people/harrisonlace/sounds/777924/
   - License: CC0
   - File: `BUBBLE TEXTURES.wav`
   - Save as: `public/sounds/bubbles.wav`

4. **8 Bit Water Stage Loop** (Background music)
   - URL: https://freesound.org/people/Mrthenoronha/sounds/528157/
   - License: CC-BY 4.0
   - File: `8 Bit Water Stage Loop.wav`
   - Save as: `public/sounds/water-loop.wav`
   - **Credit required**: "Mrthenoronha from freesound.org"

### From OpenGameArt.org:

5. **Beach Ocean Waves** (Ambient beach sound)
   - URL: https://opengameart.org/content/beach-ocean-waves
   - License: CC0 (Public Domain)
   - Files: `wave_01_cc0-18363__jasinski__alkaibeach.flac` (pick one)
   - Save as: `public/sounds/beach-waves.flac` (convert to .ogg or .mp3 for web)

---

## 🎨 Optional Additional Sprites

### Beach Decorations:

Currently using **geometric shapes** for beach elements. If you want actual sprites:

1. **Starfish Sprite** (16x16 or 32x32 pixel art)
   - Search: itch.io "free starfish pixel art"
   - License: Look for CC0 or CC-BY

2. **Crab Sprite** (animated, 32x32)
   - Search: itch.io "free crab pixel art"
   - Add as animated beach decoration

3. **Seashell Sprites** (variety pack)
   - Current: Using geometric circles
   - Could add: Actual shell sprites

### Boat Decorations:

Currently using **shapes** for boat. Optional sprite additions:

1. **Wooden Boat Sprite** (top-down view, 64x32)
   - Search: opengameart.org "top down boat sprite"
   
2. **Anchor Sprite** (16x16)
   - Currently using geometric shapes
   
3. **Flag Animation** (16x24, 2-4 frames)
   - Currently using red triangle
   - Could add: Waving flag animation

---

## 📝 How to Download from Freesound:

1. Click the URL
2. Click the blue **"Download"** button (no account needed for CC0 files)
3. Save to the `public/sounds/` directory with the specified name
4. For `.flac` files, consider converting to `.ogg` or `.mp3` for better browser support:
   ```bash
   ffmpeg -i beach-waves.flac -c:a libvorbis beach-waves.ogg
   ```

---

## 📝 How to Download from OpenGameArt:

1. Click the URL
2. Scroll to **"File(s):"** section
3. Click the file name to download
4. Extract if zipped
5. Save to `public/sprites/` directory

---

## ✅ Checklist After Downloading:

- [ ] Downloaded 5 sound files
- [ ] Converted `.flac` to `.ogg` or `.mp3` if needed
- [ ] All files in `public/sounds/` directory
- [ ] File sizes reasonable (<500KB each for sounds)
- [ ] Test audio playback in browser
- [ ] Add attribution for CC-BY licensed sounds in credits

---

## 🎵 Sound Integration Plan:

After downloading, sounds will be integrated into:

1. **coin.wav** → Triggered when treasure chest opens
2. **explosion.wav** → Triggered on death/attack
3. **bubbles.wav** → Triggered during diving animation
4. **water-loop.wav** → Background music (loop, low volume)
5. **beach-waves.flac** → Beach scene ambient (loop)

---

## 📋 Alternative Sound Sources (if above links are broken):

- **Freesound.org** - Filter by CC0 license
- **OpenGameArt.org** - Sound Effects section
- **Itch.io** - Search "free game sounds"
- **Kenney.nl** - Game assets (includes sounds)

---

## 🎨 Current Sprite Situation:

You already have excellent sprites from the **Spear Fishing Assets Pack**:
- ✅ Diver (32x32, animated)
- ✅ Fish (multiple types)
- ✅ Jellyfish
- ✅ Sharks/predators
- ✅ Treasure chest
- ✅ Bubbles
- ✅ Coins

**Beach/Boat elements are currently geometric shapes**, which fits the minimalist aesthetic. Adding sprites is optional!

---

## 💡 Recommendation:

**Start with SOUNDS only.** The visual game is already polished. Adding sound effects will dramatically improve the game feel!

After sounds work well, you can optionally add beach/boat sprites if desired.
