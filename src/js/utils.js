export const qs = (s, r = document) => r.querySelector(s);
export const qsa = (s, r = document) => [...r.querySelectorAll(s)];
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
export const finePointer = () => window.matchMedia('(hover: hover) and (pointer: fine)').matches;

/** Test WebGL availability without leaving a context behind. */
export function supportsWebGL() {
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2') || c.getContext('webgl');
    if (!gl) return false;
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return true;
  } catch {
    return false;
  }
}

/** Weak-device heuristic used to pick the simplified scene. */
export function isLowPower() {
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  const cores = navigator.hardwareConcurrency || 4;
  const mem = navigator.deviceMemory || 4;
  return (coarse && (cores <= 4 || mem <= 3)) || cores <= 2;
}

/** Split an element's text nodes' words into .char spans (keeps the word wrapper). */
export function splitChars(wordEl) {
  const text = wordEl.textContent;
  wordEl.textContent = '';
  return [...text].map((ch) => {
    const s = document.createElement('span');
    s.className = 'char';
    s.textContent = ch;
    wordEl.appendChild(s);
    return s;
  });
}

/** Split text into word spans, preserving spaces. */
export function splitWords(el) {
  const out = [];
  const walk = (node) => {
    [...node.childNodes].forEach((n) => {
      if (n.nodeType === 3) {
        const frag = document.createDocumentFragment();
        n.textContent.split(/(\s+)/).forEach((part) => {
          if (!part) return;
          if (/^\s+$/.test(part)) return frag.appendChild(document.createTextNode(' '));
          const s = document.createElement('span');
          s.className = 'word';
          s.textContent = part;
          frag.appendChild(s);
          out.push(s);
        });
        n.replaceWith(frag);
      } else if (n.nodeType === 1) walk(n);
    });
  };
  walk(el);
  return out;
}

/** Scale each [data-fit] block so its width equals the container width (editorial masthead). */
export function fitText(container, fitEls) {
  const target = container.clientWidth - parseFloat(getComputedStyle(container).paddingInline) * 2;
  fitEls.forEach((el) => {
    const line = el.parentElement;
    line.style.fontSize = '100px';
    const w = el.getBoundingClientRect().width || 1;
    line.style.fontSize = `${(100 * target) / w}px`;
  });
}

export const debounce = (fn, ms = 120) => {
  let t;
  return (...a) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...a), ms);
  };
};
