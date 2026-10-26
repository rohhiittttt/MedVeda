# Frontend Design & Architecture Specification: Smart Care Navigator

Refer to the complete, official design document located at [`docs/fdesign.md`](file:///c:/Users/rohit%20das/MedVeda/docs/fdesign.md).

### Quick Summary of Requirements & Design Standards
- **Design Tone**: Clean, calm, institutional medical SaaS with zero distraction.
- **Color Theme**: Strictly follows MedVeda's core palette:
  - Deep Navy `#0b2b82` (`bg-brand-600`, `text-brand-600`)
  - Cerulean Blue `#0284c7` (`brand-500` / `brand-accent`)
  - Canvas Slate-50 `#f8fafc`, Surface Pure White `#ffffff`, Borders `#e2e8f0`
- **Zero Multicolored Boxes**: Monochromatic, elegant white card surfaces; no rainbow patchwork.
- **Zero Technical/Internal Info Displayed**: No raw JSON, no algorithm weights (45 pts, 20 pts), no prompt text, no internal safety invariant tags (`INV-01`).
- **No Lucide Icons**: All icons are custom, accessible inline SVGs styled with Tailwind.
- **Step-by-Step URL Routing**:
  1. `/care/symptoms` (Symptom description & voice/text)
  2. `/care/baseline` (Age, duration, onset, past conditions)
  3. `/care/clarification` (Step-by-step adaptive follow-up questions)
  4. `/care/location` (Catchment location & 50 km boundary confirmation)
  5. `/care/recommendations` (Top 5 Recommended Hospitals with direct call & turn-by-turn navigation)
- **Functional Resilience**: Full browser history navigation (`pushState`), `sessionStorage` crash recovery, mobile-first 48px touch targets, and live API integration.
