import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { qs, qsa, reducedMotion, finePointer } from './utils.js';
import { content } from './content.js';

const nav = qs('.nav');
const main = qs('#main');
const footer = qs('.footer');
const menu = qs('#menu');
const bagEl = qs('#bag');
const FOCUSABLE = 'a[href],button:not([disabled]),[tabindex]:not([tabindex="-1"])';
const setInert = (on) => [main, footer].forEach((el) => el && (on ? el.setAttribute('inert', '') : el.removeAttribute('inert')));

function trapFocus(container, extra = []) {
  const handler = (e) => {
    if (e.key !== 'Tab') return;
    const items = [...qsa(FOCUSABLE, container), ...extra].filter((el) => el.offsetParent !== null);
    if (!items.length) return;
    const first = items[0], last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };
  document.addEventListener('keydown', handler);
  return () => document.removeEventListener('keydown', handler);
}

/* ---------------- Content & external links ---------------- */
export function initContent() {
  qsa('[data-content]').forEach((el) => {
    const [a, b] = el.dataset.content.split('.');
    const v = content[a]?.[b];
    if (v) { el.textContent = v; el.classList.remove('placeholder'); el.removeAttribute('data-placeholder'); }
  });
  qsa('[data-year]').forEach((el) => (el.textContent = new Date().getFullYear()));
  ['catering', 'donate'].forEach((k) => {
    const url = content.links[k];
    if (!url) return;
    qsa(`[data-open-row="${k}"]`).forEach((a) => { a.href = url; a.target = '_blank'; a.rel = 'noopener'; a.removeAttribute('data-scroll-to'); a.removeAttribute('data-open-row'); });
    const head = qs(`[data-row="${k}"] .row__head`);
    head?.addEventListener('click', () => window.open(url, '_blank', 'noopener'));
    head?.removeAttribute('aria-controls'); head?.removeAttribute('aria-expanded');
    qs(`[data-row="${k}"]`)?.setAttribute('data-external', '');
  });
}

/* ---------------- Nav: theme per section + wordmark swap ---------------- */
export function initNav() {
  qsa('[data-nav-theme]').forEach((sec) => {
    ScrollTrigger.create({
      trigger: sec, start: 'top 48px', end: 'bottom 48px',
      onToggle: (self) => { if (self.isActive) nav.dataset.theme = sec.dataset.navTheme; },
    });
  });
  ScrollTrigger.create({ start: 0, end: 'max', onUpdate: (s) => nav.toggleAttribute('data-scrolled', s.scroll() > 60) });
}

/* ---------------- Rows (catering / donate accordion) ---------------- */
export function openRow(key, focus = true) {
  const row = qs(`[data-row="${key}"]`);
  if (!row || row.hasAttribute('data-external') || row.classList.contains('is-open')) return;
  toggleRow(row, true, focus);
}
function toggleRow(row, open, focus) {
  const head = qs('.row__head', row), panel = qs('.row__panel', row);
  if (!panel) return;
  row.classList.toggle('is-open', open);
  head.setAttribute('aria-expanded', String(open));
  const dur = reducedMotion() ? 0 : 0.55;
  if (open) {
    panel.hidden = false;
    gsap.fromTo(panel, { height: 0, opacity: 0 }, { height: 'auto', opacity: 1, duration: dur, ease: 'power3.out', clearProps: 'height' });
  } else {
    gsap.to(panel, { height: 0, opacity: 0, duration: dur, ease: 'power3.inOut', onComplete: () => { panel.hidden = true; gsap.set(panel, { clearProps: 'all' }); } });
  }
  if (open && focus) head.focus({ preventScroll: true });
}
export function initRows() {
  qsa('.row[data-row]').forEach((row) => {
    if (row.hasAttribute('data-external')) return;
    qs('.row__head', row).addEventListener('click', () => toggleRow(row, !row.classList.contains('is-open'), false));
  });
}

/* ---------------- Anchor scrolling ---------------- */
export function initAnchors() {
  document.addEventListener('click', (e) => {
    const a = e.target.closest('[data-scroll-to]');
    if (!a) return;
    e.preventDefault();
    const sel = a.dataset.scrollTo;
    const target = qs(sel);
    if (!target) return;
    const wasMenu = !menu.hidden;
    if (wasMenu) closeMenu(true);
    if (a.dataset.openRow) openRow(a.dataset.openRow, false);
    const go = () => {
      gsap.to(window, {
        scrollTo: { y: target, offsetY: sel === '#top' ? 0 : sel === '#catering' || sel === '#donate' ? 110 : 0, autoKill: true },
        duration: reducedMotion() ? 0 : 1.3, ease: 'power3.inOut',
        onComplete: () => { target.setAttribute('tabindex', '-1'); target.focus({ preventScroll: true }); history.replaceState(null, '', sel); },
      });
    };
    wasMenu ? setTimeout(go, 350) : go();
  });
}

/* ---------------- Mobile menu ---------------- */
const menuBtn = qs('[data-menu-toggle]');
let menuTrap = null;
function openMenu() {
  menu.hidden = false;
  nav.setAttribute('data-menu-open', '');
  menuBtn.setAttribute('aria-expanded', 'true');
  qs('.nav__menu-label').textContent = 'Close';
  setInert(true);
  document.documentElement.style.overflow = 'hidden';
  const dur = reducedMotion() ? 0 : 0.8;
  gsap.fromTo(menu, { clipPath: 'inset(0 0 100% 0)' }, { clipPath: 'inset(0 0 0% 0)', duration: dur, ease: 'expo.inOut' });
  gsap.fromTo('.menu__word', { yPercent: 110 }, { yPercent: 0, duration: dur ? 1 : 0, stagger: 0.07, ease: 'expo.out', delay: dur ? 0.25 : 0 });
  menuTrap = trapFocus(menu, [menuBtn]);
  qs('.menu__link', menu).focus({ preventScroll: true });
}
function closeMenu(instantFocus) {
  if (menu.hidden) return;
  menuBtn.setAttribute('aria-expanded', 'false');
  qs('.nav__menu-label').textContent = 'Menu';
  nav.removeAttribute('data-menu-open');
  setInert(false);
  document.documentElement.style.overflow = '';
  menuTrap?.(); menuTrap = null;
  gsap.to(menu, { clipPath: 'inset(0 0 100% 0)', duration: reducedMotion() ? 0 : 0.6, ease: 'expo.inOut', onComplete: () => { menu.hidden = true; } });
  if (!instantFocus) menuBtn.focus({ preventScroll: true });
}
export function initMenu() {
  menuBtn.addEventListener('click', () => (menu.hidden ? openMenu() : closeMenu()));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !menu.hidden) closeMenu(); });
  window.matchMedia('(min-width: 900px)').addEventListener('change', (e) => e.matches && closeMenu(true));
}

/* ---------------- Bag (front-end demo only) ---------------- */
const KEY = 'tgc-bag-demo';
let bag = [];
let bagTrap = null, lastFocus = null;
const countEl = qs('.nav__count'), statusEl = qs('[data-bag-status]'), listEl = qs('[data-bag-list]'), noticeEl = qs('[data-bag-notice]');
const total = () => bag.reduce((n, i) => n + i.qty, 0);

function saveBag() { try { localStorage.setItem(KEY, JSON.stringify(bag)); } catch { /* storage unavailable */ } }
function renderBag() {
  const n = total();
  countEl.textContent = n;
  countEl.classList.toggle('has-items', n > 0);
  statusEl.textContent = `Bag, ${n} ${n === 1 ? 'item' : 'items'}`;
  listEl.innerHTML = '';
  bag.forEach((it) => {
    const p = content.products[it.id];
    if (!p) return;
    const li = document.createElement('li');
    li.className = 'bag__item';
    li.innerHTML = `<div><b></b><small></small></div><div class="bag__qty"><button type="button" data-q="-1" aria-label="Decrease quantity">−</button><span aria-live="polite"></span><button type="button" data-q="1" aria-label="Increase quantity">+</button></div><button class="bag__rm" type="button" data-rm>Remove</button>`;
    qs('b', li).textContent = p.name;
    qs('small', li).textContent = p.detail;
    qs('.bag__qty span', li).textContent = it.qty;
    li.dataset.id = it.id;
    listEl.appendChild(li);
  });
  noticeEl.textContent = '';
}
function bump() { gsap.fromTo(countEl, { scale: 1.5 }, { scale: 1, duration: 0.6, ease: 'elastic.out(1,.5)' }); }
export function addToBag(id, fromEl) {
  if (!content.products[id]) return;
  const commit = () => {
    const found = bag.find((i) => i.id === id);
    found ? found.qty++ : bag.push({ id, qty: 1 });
    saveBag(); renderBag(); bump();
  };
  if (reducedMotion() || !fromEl) return commit();
  const a = fromEl.getBoundingClientRect(), b = countEl.getBoundingClientRect();
  const dot = document.createElement('span');
  dot.className = 'bag-fly';
  document.body.appendChild(dot);
  gsap.fromTo(dot, { x: a.left + a.width / 2, y: a.top + a.height / 2, scale: 1.4 },
    { x: b.left + b.width / 2 - 8, y: b.top + b.height / 2 - 8, scale: 0.6, duration: 0.7, ease: 'power3.inOut', onComplete: () => { dot.remove(); commit(); } });
}
function openBag() {
  lastFocus = document.activeElement;
  bagEl.hidden = false;
  setInert(true); nav.setAttribute('inert', '');
  document.documentElement.style.overflow = 'hidden';
  const d = reducedMotion() ? 0 : 0.6;
  gsap.to('.bag__scrim', { opacity: 1, duration: d });
  gsap.to('.bag__panel', { x: 0, xPercent: 0, duration: d, ease: 'expo.out' });
  bagTrap = trapFocus(qs('.bag__panel'));
  qs('.bag__panel').focus({ preventScroll: true });
}
function closeBag() {
  if (bagEl.hidden) return;
  const d = reducedMotion() ? 0 : 0.45;
  gsap.to('.bag__scrim', { opacity: 0, duration: d });
  gsap.to('.bag__panel', { xPercent: 100, duration: d, ease: 'expo.inOut', onComplete: () => { bagEl.hidden = true; } });
  setInert(false); nav.removeAttribute('inert');
  document.documentElement.style.overflow = '';
  bagTrap?.(); bagTrap = null;
  lastFocus?.focus?.({ preventScroll: true });
}
export function initBag() {
  try { bag = JSON.parse(localStorage.getItem(KEY) || '[]').filter((i) => content.products[i.id] && i.qty > 0); } catch { bag = []; }
  gsap.set('.bag__panel', { xPercent: 100 });
  renderBag();
  qs('[data-bag-open]').addEventListener('click', openBag);
  qsa('[data-bag-close]').forEach((b) => b.addEventListener('click', closeBag));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeBag(); });
  document.addEventListener('click', (e) => {
    const add = e.target.closest('[data-add]');
    if (add) addToBag(add.dataset.add, add);
  });
  listEl.addEventListener('click', (e) => {
    const li = e.target.closest('.bag__item');
    if (!li) return;
    const it = bag.find((i) => i.id === li.dataset.id);
    const q = e.target.closest('[data-q]');
    if (q && it) it.qty += Number(q.dataset.q);
    if (e.target.closest('[data-rm]')) it.qty = 0;
    bag = bag.filter((i) => i.qty > 0);
    saveBag(); renderBag();
  });
  qs('[data-bag-clear]').addEventListener('click', () => { bag = []; saveBag(); renderBag(); });
  qs('[data-bag-checkout]').addEventListener('click', () => {
    noticeEl.textContent = total()
      ? 'Checkout isn’t connected in this demo, so no order was placed.'
      : 'Add something to your bag first.';
  });
}

/* ---------------- Cursor (fine pointers) ---------------- */
export function initCursor() {
  if (!finePointer() || reducedMotion()) return () => {};
  const cur = qs('.cursor'), label = qs('.cursor__label');
  const xTo = gsap.quickTo(cur, 'x', { duration: 0.35, ease: 'power3' });
  const yTo = gsap.quickTo(cur, 'y', { duration: 0.35, ease: 'power3' });
  const move = (e) => { xTo(e.clientX); yTo(e.clientY); };
  const over = (e) => {
    const t = e.target.closest?.('[data-cursor]');
    if (!t) return;
    label.textContent = t.dataset.cursor;
    gsap.to(cur, { scale: 1, duration: 0.4, ease: 'power3.out' });
  };
  const out = (e) => {
    if (!e.target.closest?.('[data-cursor]')) return;
    if (e.relatedTarget?.closest?.('[data-cursor]')) return;
    gsap.to(cur, { scale: 0, duration: 0.3 });
  };
  document.addEventListener('pointermove', move, { passive: true });
  document.addEventListener('pointerover', over);
  document.addEventListener('pointerout', out);
  return () => { document.removeEventListener('pointermove', move); document.removeEventListener('pointerover', over); document.removeEventListener('pointerout', out); };
}
