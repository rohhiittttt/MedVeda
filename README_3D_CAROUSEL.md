# 3D Media Card Carousel Hero Section

A full-viewport, 60fps **3D Media Card Carousel** built with React, TypeScript, Tailwind CSS, and GPU-accelerated CSS 3D transforms.

Engineered specifically for the **MedVeda** home page to present all healthcare features with an editorial, clean-studio aesthetic.

---

## 📸 Overview & Visual Styling

- **Studio Floor & Lighting**: Near-white background (`#FCFCFB`) with a soft elliptical studio floor shadow underneath the cards, making them look as if they stand on a physical studio surface.
- **Editorial Typography**: Geometric sans typography (`Plus Jakarta Sans` / `Inter`), tight-tracked headline, and crisp grey body copy.
- **Card Geometry**: Tall portrait rectangles (aspect ratio ~3:4.2, roughly 330×460px), 18px rounded corners, subtle edge lighting, and depth-based drop shadows.
- **Perspective**: `perspective: 1400px` with `transform-style: preserve-3d`.
- **Card Stack Depth**: Active card is angled toward the viewer (`rotateY: -10°`, `rotateX: 2°`). Subsequent cards step back along the Z-axis (`-150px` per slot), shift right (`+170px` per slot), scale down (16% smaller per slot), and fade in opacity (`1 → 0.9 → 0.75 → 0.55 → 0.35 → 0.15`).
- **Floor-Aligned**: `transform-origin: bottom center` vertically aligns cards to the floor plane.

---

## 🗂️ Component Architecture & File Structure

All deliverables are located in `frontend/src/features/carousel/` and integrated into the home page:

```
frontend/
├── app/
│   └── page.tsx                    # Next.js Home Page rendering the 3D Carousel Hero
├── public/
│   ├── app.js                      # MedVeda Single Page Application (Home Page 3D Carousel)
│   ├── app.compiled.js             # High-speed compiled bundle
│   └── media/                      # Placeholder media assets
│       ├── item-01.svg             # Pink fuzzy tennis balls
│       ├── item-02.svg             # Skier with red-pink motion-blurred visor
│       ├── item-03.svg             # Floating silver embossed coins
│       ├── item-04.svg             # Woman with blue sunglasses & denim jacket
│       ├── item-05.svg             # Man in pink LA cap & hoodie on red
│       ├── item-06.svg             # Glossy green 3D spiral with blue sphere
│       └── item-07.svg             # Dramatic face profile in red-orange light
└── src/
    └── features/
        └── carousel/
            ├── types.ts            # TypeScript interfaces (CardItem, CarouselConfig)
            ├── media.ts            # MedVeda feature cards & reference media data arrays
            ├── Card.tsx            # Tall portrait 3D card component with audio/speaker button
            ├── Carousel3D.tsx      # Core 3D stage with all parameters exposed at the top
            ├── Hero.tsx            # Left editorial text block + right 3D carousel stage
            ├── CookieBanner.tsx    # Floating cookie consent card (bottom-right)
            └── index.ts            # Barrel export
```

---

## ⚙️ Configurable Parameters in `Carousel3D.tsx`

All parameters are exposed as constants at the top of `frontend/src/features/carousel/Carousel3D.tsx` (and `app.js`) for quick tuning:

```typescript
export const CARD_WIDTH = 330;           // Base active card width in px
export const CARD_HEIGHT = 460;          // Base active card height in px (~3:4.2 aspect ratio)
export const CARD_SPACING_X = 170;       // Shift in +X per slot in px
export const DEPTH_STEP_Z = -150;        // Push back in -Z per slot in px
export const SCALE_STEP = 0.16;          // Scale down percentage per slot (16% smaller)
export const ROTATE_Y = -10;             // Y rotation angle in degrees (-8° to -12°)
export const ROTATE_X = 2;               // Slight upward tilt in degrees
export const FADE_STEPS = [1.0, 0.90, 0.75, 0.55, 0.35, 0.15]; // Opacity per slot
export const PERSPECTIVE = 1400;         // 3D stage perspective in px
export const TRANSITION_DURATION = 800;  // Transition time in ms (700–900ms)
export const TRANSITION_EASING = 'cubic-bezier(0.22, 1, 0.36, 1)'; // Natural deceleration
export const AUTOPLAY_DELAY = 2500;      // Idle advance delay in ms (~2.5s)
export const VISIBLE_CARDS_COUNT = 7;    // Number of cards displayed simultaneously (6–7)
```

---

## 🎮 Interaction Features

1. **Navigation**:
   - **Circular outline buttons** (`←`, `→`): 40px circular buttons with light grey borders and hover fills.
   - **Pointer Drag / Touch Swipe**: Smooth gesture support with hand/grab cursor (`cursor: grab` → `cursor: grabbing`).
   - **Mouse Wheel / Trackpad**: Horizontal/vertical wheel navigation with 450ms debounce.
   - **Keyboard**: Left (`ArrowLeft`) and Right (`ArrowRight`) arrow keys navigate.
2. **Infinite Looping**:
   - On "next", active card slides out to the left (`translateX: -380px`, `rotateY: -24°`, fading out) while background cards smoothly slide forward.
3. **Autoplay**:
   - Automatically advances every 2.5 seconds when idle.
   - Automatically pauses on hover or drag.
4. **Card Interactions**:
   - **Hover Lift**: Hovering a non-active card slightly lifts it (`translateY: -6px`).
   - **Click to Focus**: Clicking any non-active card brings it immediately to the front.
   - **Feature Execution**: Clicking the active card triggers the feature action (e.g., launching Triage, Teleconsultation, etc.).
   - **Audio/Speaker Button**: The active card features a dark translucent circle speaker button in its top-right corner to toggle mute/unmute.
5. **Accessibility**:
   - Full `prefers-reduced-motion` compliance (disables 3D transforms & autoplay, uses gentle crossfades).
6. **Cookie Consent Banner**:
   - Floating white card in the bottom-right corner with 16px corner radius and Accept/Decline actions.

---

## 🚀 Run Instructions

### Option 1: Start MedVeda Unified Server (Recommended)
Double-click `start-server.bat` or run:
```bash
npx tsx frontend/server.js
```
Then open `http://localhost:3000` in your browser.

### Option 2: Re-compile Public App Bundle
If you edit `frontend/public/app.js`:
```bash
node frontend/build.js
```

### Option 3: Next.js Development Server
```bash
npm run dev --workspace=frontend
```
Then open `http://localhost:3000` to view the Next.js home page (`frontend/app/page.tsx`).
