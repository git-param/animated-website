import './styles/main.css';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ScrollToPlugin } from 'gsap/ScrollToPlugin';
import { prepareHero, playIntro, initScene, heroScroll } from './js/hero.js';
import { initContent, initNav, initRows, initAnchors, initMenu, initBag, initCursor } from './js/ui.js';
import { statement, lineReveals, products, story, marquees, reel } from './js/sections.js';

gsap.registerPlugin(ScrollTrigger, ScrollToPlugin);
ScrollTrigger.config({ ignoreMobileResize: true }); // mobile URL-bar show/hide must not re-trigger layout
history.scrollRestoration = 'manual';

async function boot() {
  initContent();
  const heroState = await prepareHero();
  const introHandle = playIntro(heroState);

  // UI that is independent of media queries
  initAnchors(); initMenu(); initBag(); initRows();
  const disposeCursor = initCursor();

  // Everything scroll-driven lives in matchMedia so it reverts cleanly on resize / orientation / preference change
  const mm = gsap.matchMedia();
  mm.add(
    { desktop: '(min-width: 900px)', reduce: '(prefers-reduced-motion: reduce)' },
    (ctx) => {
      const { desktop, reduce } = ctx.conditions;
      const opts = { desktop, reduce };
      initNav();
      statement(opts);
      lineReveals(opts);
      products(opts);
      story(opts);
      marquees(opts);
      const cleanReel = reel(opts);
      const cleanHero = reduce ? undefined : heroScroll();
      return () => { cleanReel?.(); cleanHero?.(); };
    },
  );

  await initScene(introHandle);
  requestAnimationFrame(() => ScrollTrigger.refresh());
  window.addEventListener('load', () => ScrollTrigger.refresh(), { once: true });
  window.addEventListener('pagehide', () => { disposeCursor(); mm.revert(); }, { once: true });
}

boot().catch((err) => {
  // Never leave visitors with a blank hero if something fails.
  console.warn('[boot] enhancement failed, showing static page.', err?.message || '');
  document.documentElement.classList.add('reveal-fallback', 'no-webgl');
});
