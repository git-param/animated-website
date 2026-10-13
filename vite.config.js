import { defineConfig } from 'vite';
import fs from 'node:fs';
import path from 'node:path';

const root = import.meta.dirname;
const hasPublic = (file) => fs.existsSync(path.join(root, 'public', file));

/**
 * Optional brand assets.
 * The original project referenced video.mp4, Futura-Bold.ttf and Gilroy-Medium.ttf, but none of them were
 * shipped. Instead of referencing missing files (404s), the build checks public/ and only wires up what exists:
 *   public/video.mp4        -> enables the "reel" section
 *   public/Futura-Bold.ttf  -> used for display type (falls back to Jost)
 *   public/Gilroy-Medium.ttf-> used for body type    (falls back to Jost)
 */
function optionalBrandAssets() {
  return {
    name: 'tgc-optional-brand-assets',
    transformIndexHtml() {
      const faces = [];
      if (hasPublic('Futura-Bold.ttf')) {
        faces.push(`@font-face{font-family:"Futura Brand";src:url("./Futura-Bold.ttf") format("truetype");font-weight:100 900;font-display:swap}`);
      }
      if (hasPublic('Gilroy-Medium.ttf')) {
        faces.push(`@font-face{font-family:"Gilroy Brand";src:url("./Gilroy-Medium.ttf") format("truetype");font-weight:100 900;font-display:swap}`);
      }
      return faces.length
        ? [{ tag: 'style', attrs: { 'data-brand-fonts': '' }, children: faces.join('\n'), injectTo: 'head' }]
        : [];
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [optionalBrandAssets()],
  define: {
    __HAS_REEL__: JSON.stringify(hasPublic('video.mp4')),
  },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/three')) return 'three';
          if (id.includes('node_modules/gsap')) return 'gsap';
        },
      },
    },
  },
  server: { host: true },
  preview: { host: true },
});
