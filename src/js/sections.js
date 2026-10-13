import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { qs, qsa, splitWords, finePointer } from './utils.js';

/** Dome → flat dark transition, then word-by-word reveal of the manifesto. */
export function statement({ reduce }) {
  const sec = qs('.statement');
  const words = splitWords(qs('[data-words]'));
  if (reduce) return;
  gsap.fromTo('.statement__bg', { borderRadius: '50% 50% 0 0 / 16vw 16vw 0 0' }, {
    borderRadius: '0% 0% 0 0 / 0vw 0vw 0 0', ease: 'none',
    scrollTrigger: { trigger: sec, start: 'top bottom', end: 'top 25%', scrub: true },
  });
  gsap.fromTo(words, { opacity: 0.14 }, {
    opacity: 1, stagger: 0.12, ease: 'none',
    scrollTrigger: { trigger: '.statement__text', start: 'top 82%', end: 'bottom 55%', scrub: true },
  });
}

/** Masked line reveals for big headings (shop + closing). */
export function lineReveals({ reduce }) {
  if (reduce) return;
  qsa('[data-reveal-line]').forEach((el, i) => {
    gsap.fromTo(el, { yPercent: 115 }, {
      yPercent: 0, duration: 1.1, ease: 'expo.out', delay: (i % 2) * 0.08,
      scrollTrigger: { trigger: el, start: 'top 90%', once: true },
    });
  });
  gsap.from('.row', {
    autoAlpha: 0, y: 40, duration: 0.9, stagger: 0.12, ease: 'power3.out',
    scrollTrigger: { trigger: '.rows', start: 'top 85%', once: true },
  });
}

/** Products: clip reveal, scroll depth, and tilt/sheen interaction (pointer + touch). */
export function products({ reduce }) {
  qsa('.product').forEach((product) => {
    const stage = qs('.product__stage', product);
    const plate = qs('.product__plate', product);
    const img = qs('.product__img', product);
    const ghost = qs('.product__ghost', product);
    const info = qs('.product__info', product);
    gsap.set(img, { z: 90 });
    gsap.set(ghost, { z: 10 });
    gsap.set(qs('.product__shadow', product), { z: 30 });
    gsap.set(qs('.product__sheen', product), { z: 120 });
    if (reduce) return;

    gsap.fromTo(stage, { clipPath: 'inset(100% 0% 0% 0%)' }, {
      clipPath: 'inset(0% 0% 0% 0%)', duration: 1.3, ease: 'expo.out', clearProps: 'clipPath',
      scrollTrigger: { trigger: product, start: 'top 80%', once: true },
    });
    gsap.from(info.children, {
      y: 36, autoAlpha: 0, duration: 0.9, stagger: 0.08, ease: 'power3.out',
      scrollTrigger: { trigger: product, start: 'top 70%', once: true },
    });
    // Layered depth: product and ghost type travel at different speeds
    gsap.fromTo(img, { yPercent: 6 }, { yPercent: -6, ease: 'none', scrollTrigger: { trigger: product, start: 'top bottom', end: 'bottom top', scrub: true } });
    gsap.fromTo(ghost, { yPercent: -8 }, { yPercent: 8, ease: 'none', scrollTrigger: { trigger: product, start: 'top bottom', end: 'bottom top', scrub: true } });
    // Touch devices: scroll-driven tilt instead of hover
    if (!finePointer()) {
      gsap.fromTo(plate, { rotationY: -9, rotationX: 3 }, { rotationY: 9, rotationX: -3, ease: 'none', scrollTrigger: { trigger: product, start: 'top bottom', end: 'bottom top', scrub: true } });
    }

    const rx = gsap.quickTo(plate, 'rotationX', { duration: 0.6, ease: 'power3' });
    const ry = gsap.quickTo(plate, 'rotationY', { duration: 0.6, ease: 'power3' });
    const move = (e) => {
      const r = stage.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
      ry((x - 0.5) * 18); rx(-(y - 0.5) * 14);
      plate.style.setProperty('--mx', `${x * 100}%`);
      plate.style.setProperty('--my', `${y * 100}%`);
      plate.style.setProperty('--sheen', '1');
    };
    const leave = () => { ry(0); rx(0); plate.style.setProperty('--sheen', '0'); };
    stage.addEventListener('pointermove', move);
    stage.addEventListener('pointerleave', leave);
    stage.addEventListener('pointerup', (e) => e.pointerType === 'touch' && leave());
  });
}

/** Story: on desktop the cookbook cover "expands" into the green page (pinned, scrubbed). Simple reveals elsewhere. */
export function story({ reduce, desktop }) {
  const pin = qs('.story__pin'), cover = qs('.story__cover'), frame = qs('.story__frame'), text = qs('.story__text');
  if (reduce) return;
  if (desktop) {
    const sx = () => cover.offsetWidth / pin.clientWidth;
    const sy = () => cover.offsetHeight / pin.clientHeight;
    gsap.set(text, { autoAlpha: 0 });
    const tl = gsap.timeline({
      scrollTrigger: { trigger: pin, start: 'top top', end: '+=160%', pin: true, scrub: 1, anticipatePin: 1, invalidateOnRefresh: true },
    });
    tl.fromTo(frame, { scaleX: sx, scaleY: sy }, { scaleX: 1, scaleY: 1, ease: 'power2.inOut', duration: 1 })
      .to(cover, { x: '-26vw', ease: 'power2.inOut', duration: 1 }, 1)
      .fromTo(text, { autoAlpha: 0, y: 60 }, { autoAlpha: 1, y: 0, ease: 'power2.out', duration: 0.8 }, 1.25);
  } else {
    gsap.from(cover, { clipPath: 'inset(0 0 100% 0)', duration: 1.2, ease: 'expo.out', scrollTrigger: { trigger: cover, start: 'top 85%', once: true } });
    gsap.from(text.children, { y: 30, autoAlpha: 0, stagger: 0.1, duration: 0.9, ease: 'power3.out', scrollTrigger: { trigger: text, start: 'top 85%', once: true } });
  }
}

/** Opposing marquee lines scrubbed by scroll (no autonomous GPU work). */
export function marquees({ reduce }) {
  if (reduce) return;
  qsa('[data-marquee]').forEach((row) => {
    const dir = Number(row.dataset.marquee);
    gsap.fromTo(row, { xPercent: dir < 0 ? 0 : -33 }, {
      xPercent: dir < 0 ? -33 : 0, ease: 'none',
      scrollTrigger: { trigger: '.story__marquee', start: 'top bottom', end: 'bottom top', scrub: true },
    });
  });
}

/** Optional film section. Only active when public/video.mp4 existed at build time. */
export function reel({ reduce, desktop }) {
  const sec = qs('.reel');
  if (!__HAS_REEL__) { sec.remove(); return; }
  sec.hidden = false;
  const video = qs('.reel__video'), frame = qs('.reel__frame');
  const io = new IntersectionObserver(([e]) => {
    if (e.isIntersecting && !video.src) { video.src = `${import.meta.env.BASE_URL}video.mp4`; video.preload = 'auto'; }
    if (!reduce && !userPaused) (e.intersectionRatio > 0.35 ? video.play().catch(() => {}) : video.pause());
  }, { threshold: [0, 0.35], rootMargin: '300px 0px' });
  let userPaused = reduce;
  io.observe(frame);
  frame.addEventListener('click', () => {
    if (!video.src) video.src = `${import.meta.env.BASE_URL}video.mp4`;
    if (video.paused) { userPaused = false; video.play().catch(() => {}); frame.dataset.cursor = 'Pause'; }
    else { userPaused = true; video.pause(); frame.dataset.cursor = 'Play'; }
    const l = qs('.cursor__label'); if (l) l.textContent = frame.dataset.cursor;
  });
  if (!reduce && desktop) {
    gsap.fromTo(frame, { clipPath: 'inset(14% 14% 14% 14%)' }, { clipPath: 'inset(0% 0% 0% 0%)', ease: 'none', scrollTrigger: { trigger: sec, start: 'top 80%', end: 'top 10%', scrub: true } });
  }
  return () => io.disconnect();
}
