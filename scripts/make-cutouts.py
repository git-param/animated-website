"""
Builds transparent cut-outs of the supplied product photos (img2 = Nourish & Soothe, img3 = Project X tote).

The photos are shot on white. We flood-fill the background from the image border, turn the shadow/edge
anti-aliasing into black-with-alpha, and leave everything INSIDE the product (labels, the white X) untouched.
Originals in src/assets/img*.jpg are never modified.

Run (optional, outputs are committed):  python3 scripts/make-cutouts.py
Requires: pillow, numpy, scipy
"""
from pathlib import Path
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage as ndi

ROOT = Path(__file__).resolve().parent.parent
SRC, OUT = ROOT / "src/assets", ROOT / "src/assets"
SCALE = 2          # source photos are tiny (<400px); 2x Lanczos keeps WebGL edges clean
BG_THRESHOLD = 0.35

JOBS = {
    # name: (crop px trimmed from each edge to remove the faint photo frame, handle gap max y in source px or None)
    "img2": dict(trim=4, handle_max_y=None),
    "img3": dict(trim=0, handle_max_y=152),
}

def cutout(name, trim, handle_max_y):
    im = Image.open(SRC / f"{name}.jpg").convert("RGB")
    if trim:
        w, h = im.size
        im = im.crop((trim, trim, w - trim, h - trim))
    im = im.resize((im.width * SCALE, im.height * SCALE), Image.LANCZOS)
    rgb = np.asarray(im).astype(np.float32) / 255.0
    lum = rgb.mean(axis=2)

    bg_level = float(np.median(np.concatenate([lum[0], lum[-1], lum[:, 0], lum[:, -1]])))
    candidates = lum > BG_THRESHOLD
    labels, n = ndi.label(candidates)

    border_labels = set(np.unique(np.concatenate([labels[0], labels[-1], labels[:, 0], labels[:, -1]]))) - {0}
    bg_labels = set(border_labels)

    if handle_max_y is not None:
        limit = (handle_max_y - trim) * SCALE
        for lab, sl in enumerate(ndi.find_objects(labels), start=1):
            if lab in bg_labels or sl is None:
                continue
            area = int((labels[sl] == lab).sum())
            if sl[0].stop <= limit and area > 400:  # enclosed gap between the handles
                bg_labels.add(lab)

    bg_mask = np.isin(labels, list(bg_labels))
    # Background + shadow + anti-aliased edge -> black with alpha derived from luminance.
    alpha = np.where(bg_mask, np.clip(1.0 - lum / bg_level, 0.0, 1.0), 1.0)
    # Knock the faint paper tone to zero and slightly firm up the shadow curve.
    alpha = np.where(bg_mask, np.clip((alpha - 0.02) / 0.98, 0, 1), alpha)
    out_rgb = np.where(bg_mask[..., None], 0.0, rgb)

    rgba = np.dstack([out_rgb, alpha])
    img = Image.fromarray((rgba * 255).astype(np.uint8), "RGBA")
    # tiny blur on alpha only to soften the 0.35 threshold seam
    a = img.getchannel("A").filter(ImageFilter.GaussianBlur(0.6))
    img.putalpha(a)
    # crop to the visible product (+ small pad) so layout/aspect ratios are predictable
    bbox = img.getchannel("A").point(lambda v: 255 if v > 6 else 0).getbbox()
    pad = 8 * SCALE
    bbox = (max(bbox[0] - pad, 0), max(bbox[1] - pad, 0), min(bbox[2] + pad, img.width), min(bbox[3] + pad, img.height))
    img = img.crop(bbox)
    path = OUT / f"{name}-cutout.webp"
    img.save(path, "WEBP", quality=92, method=6)
    print(name, "->", path.name, img.size, f"{path.stat().st_size/1024:.0f} KB", "bg_level", round(bg_level, 3),
          "bg comps", len(bg_labels))

for k, v in JOBS.items():
    cutout(k, **v)
