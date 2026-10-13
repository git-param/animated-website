import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { qs, qsa, splitChars, fitText, supportsWebGL, isLowPower, reducedMotion, debounce } from './utils.js';
import { HeroScene } from './scene/HeroScene.js';
import bookUrl from '../assets/img1.jpg';
import bottleUrl from '../assets/img2-cutout.webp';
import toteUrl from '../assets/img3-cutout.webp';

const INTRO_KEY = 'tgc-intro-seen';
let scene = null;

/** Prepare the headline (split + fit + hidden start state). Runs once, before the intro. */
export async function prepareHero() {
  const hero = qs('.hero');
  const foot = qs('.hero__foot');
  const fits = qsa('[data-fit]');
  // Explicitly request the display weight (document.fonts.ready can resolve before the request is made).
  await Promise.race([
    Promise.all([document.fonts?.load('900 100px "Jost Variable"'), document.fonts?.load('900 100px "Futura Brand"')]).catch(() => {}),
    new Promise((r) => setTimeout(r, 1200)),
  ]);

  const chars = qsa('.hero__word').flatMap((w) => splitChars(w));
  fitText(foot, fits);
  let lastW = foot.clientWidth;
  const onResize = debounce(() => {
    if (foot.clientWidth === lastW) return; // ignore mobile URL-bar height changes
    lastW = foot.clientWidth;
    fitText(foot, fits);
    ScrollTrigger.refresh();
  }, 150);
  document.fonts?.addEventListener?.('loadingdone', () => { fitText(foot, fits); });
  window.addEventListener('resize', onResize);
  window.addEventListener('orientationchange', onResize);

  const reduce = reducedMotion();
  if (!reduce) gsap.set(chars, { yPercent: 115 });
  gsap.set('.hero__meta', { autoAlpha: reduce ? 1 : 0, y: reduce ? 0 : 16 });
  gsap.set('.nav > *', { autoAlpha: reduce ? 1 : 0, y: reduce ? 0 : -12 });
  document.documentElement.classList.add('ready');
  return { hero, chars };
}

/** Opening sequence: short curtain (first visit only) → headline → nav → scene. Page is interactive throughout. */
export function playIntro({ chars }) {
  const reduce = reducedMotion();
  const intro = qs('.intro');
  let seen = false;
  try { seen = sessionStorage.getItem(INTRO_KEY) === '1'; sessionStorage.setItem(INTRO_KEY, '1'); } catch { /* private mode */ }

  const tl = gsap.timeline({ defaults: { ease: 'expo.out' } });
  if (reduce || seen) {
    intro?.classList.add('is-skipped');
    tl.to(chars, { yPercent: 0, duration: reduce ? 0 : 0.9, stagger: 0.02 }, 0.1);
  } else {
    tl.fromTo('.intro__mark', { scale: 0.55, rotation: -90, autoAlpha: 0 }, { scale: 1, rotation: 0, autoAlpha: 1, duration: 0.7 }, 0)
      .to('.intro__mark', { yPercent: -120, duration: 0.9, ease: 'expo.inOut' }, 0.65)
      .to(intro, { clipPath: 'inset(0 0 100% 0)', duration: 0.9, ease: 'expo.inOut', onComplete: () => intro.classList.add('is-done') }, 0.65)
      .to(chars, { yPercent: 0, duration: 1.05, stagger: 0.028 }, 1.15);
  }
  const t0 = reduce || seen ? 0.2 : 1.3;
  tl.to('.nav > *', { autoAlpha: 1, y: 0, duration: 0.9, stagger: 0.08 }, t0)
    .to('.hero__meta', { autoAlpha: 1, y: 0, duration: 0.9 }, t0 + 0.35);
  tl.eventCallback('onStart', null);
  return { tl, startAt: t0 };
}

/** Boot the WebGL hero. Falls back to the CSS image composition on any failure. */
export async function initScene(introHandle) {
  const canvas = qs('.hero__canvas');
  const hero = qs('.hero');
  const fail = () => { document.documentElement.classList.add('no-webgl'); canvas.classList.remove('is-live'); };
  if (!supportsWebGL()) return fail();

  try {
    scene = new HeroScene(canvas, {
      images: { book: bookUrl, bottle: bottleUrl, tote: toteUrl },
      quality: isLowPower() ? 'low' : 'high',
      reduced: reducedMotion(),
      onLost: fail,
      onRestored: () => { document.documentElement.classList.remove('no-webgl'); canvas.classList.add('is-live'); },
    });
    await scene.init();
  } catch (err) {
    console.warn('[hero] WebGL scene unavailable, using image fallback.', err?.message || '');
    scene?.dispose(); scene = null;
    return fail();
  }
  canvas.classList.add('is-live');

  // Reveal planes (and push the camera in) once both the intro has progressed and the scene is ready.
  const reduce = reducedMotion();
  const state = { push: reduce ? 1 : 0 };
  const reveal = gsap.timeline({ delay: reduce ? 0 : Math.max(0, introHandle.startAt - 0.1 - introHandle.tl.time()) });
  scene.items.forEach((_, i) => {
    const o = { v: reduce ? 1 : 0 };
    reveal.to(o, { v: 1, duration: reduce ? 0 : 1.5, ease: 'power3.out', onUpdate: () => scene.setReveal(i, o.v) }, i * 0.18);
  });
  reveal.to(state, { push: 1, duration: reduce ? 0 : 2.2, ease: 'expo.out', onUpdate: () => scene.setIntro(state.push) }, 0);
  if (reduce) { scene.items.forEach((_, i) => scene.setReveal(i, 1)); scene.setIntro(1); }

  // Only render while the hero is on screen.
  const io = new IntersectionObserver(([e]) => scene?.setActive(e.isIntersecting), { threshold: 0.01 });
  io.observe(hero);
  window.addEventListener('pagehide', () => { io.disconnect(); scene?.dispose(); scene = null; }, { once: true });
}

/** Scroll choreography for the hero (registered inside gsap.matchMedia so it cleans itself up). */
export function heroScroll() {
  const hero = qs('.hero');
  ScrollTrigger.create({
    trigger: hero, start: 'top top', end: 'bottom top', scrub: true,
    onUpdate: (self) => scene?.setScroll(self.progress),
  });
  gsap.to('.hero__line', {
    y: (i) => -(50 + i * 90), ease: 'none',
    scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: true },
  });
  gsap.to('.hero__meta', { autoAlpha: 0, ease: 'none', scrollTrigger: { trigger: hero, start: '5% top', end: '40% top', scrub: true } });
  return () => scene?.setScroll(0);
}
