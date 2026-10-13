# Two Good Co — immersive editorial site

Vanilla JS + **Three.js** + **GSAP/ScrollTrigger**, bundled with **Vite**. Native scrolling (Locomotive Scroll removed — it fought ScrollTrigger).

## Run
```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # production build -> dist/
npm run preview    # serve dist/ locally
npm run check      # verifies built asset references
```
Node 18+ required (built with Node 22).

## Structure
```
index.html              semantic markup (logo sprite, sections, bag drawer, menu)
src/main.js             boot order + gsap.matchMedia (desktop / mobile / reduced-motion)
src/styles/main.css     tokens, layout, components, responsive, reduced-motion
src/js/content.js       EDITABLE copy, external links, product data
src/js/hero.js          headline split/fit, opening sequence, scene lifecycle, hero scroll
src/js/scene/HeroScene.js   Three.js scene (shader planes, lit spheres, cleanup)
src/js/sections.js      manifesto, shop tilt, pinned story, marquees, optional reel
src/js/ui.js           nav themes, anchors, mobile menu, bag demo, accordion, cursor
src/assets/             img1-3.jpg (originals) + img2/img3 *-cutout.webp (generated)
scripts/make-cutouts.py regenerates the transparent cut-outs from the originals (optional)
legacy/                 your original index.html / style.css / script.js, untouched
```

## Optional assets (drop into `public/`, rebuild)
- `video.mp4` → enables the cinematic "reel" section (click to play/pause, scroll-expanding frame)
- `Futura-Bold.ttf`, `Gilroy-Medium.ttf` → used automatically for display/body type (Jost is the fallback)

None of these shipped with the project, so the build only references them if they exist (no 404s).

## Editing content
Open `src/js/content.js`. Fill `story.body`, `catering.body`, `donate.body` to replace the marked
placeholders; set `links.catering` / `links.donate` to send those links to external URLs instead.
The bag is a **front-end demo** (localStorage, no prices, checkout shows a notice — no order is placed).

## Notes
- Product photos are small (≈380px). Supply larger originals for crisper results on retina screens.
- WebGL unavailable / context lost → a static image composition is shown. Reduced motion → static scene, no scrub.
