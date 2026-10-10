#!/usr/bin/env python3
"""
Renders the two textures behind Homeroom's stamp (public/stamp/v2/):

  ink-wear.png     a mask for the stamp's ink: where the ink took fully, where the pressure was uneven, and the tiny dry specks a
                   real rubber stamp leaves. White with an alpha channel (alpha = how much ink got through).
  paper-fiber.png  a tileable paper-fibre overlay. Laid over the ink it makes the ink look soaked into the paper.

Needs numpy, scipy, opencv (cv2) and Pillow. Deterministic. Run:  python3 tools/render_stamp_textures.py
The stamp itself is tools/stamp-tool.svg (rendered to PNGs in four sizes with a headless browser at 4x).
"""
import os
import numpy as np
import cv2
from scipy.ndimage import gaussian_filter
from PIL import Image

OUT = os.path.join(os.path.dirname(__file__), "..", "public", "stamp", "v2")
os.makedirs(OUT, exist_ok=True)
N = 1024

def field(rng, sigma):
    n = gaussian_filter(rng.normal(size=(N, N)), sigma, mode="wrap")
    return (n - n.mean()) / n.std()

def smoothstep(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)

def ink_wear():
    rng = np.random.default_rng(5)
    yy, xx = np.mgrid[0:N, 0:N]
    r = np.hypot(xx - N / 2, yy - N / 2) / (N / 2)
    pressure = 0.6 * field(rng, 170) + 0.4 * field(rng, 60)         # broad, uneven pressure
    dry = field(rng, 4.5)                                           # clumps of dry spots
    fine = field(rng, 1.2)                                          # single grains
    edge = 0.6 * smoothstep(0.86, 1.0, r)                           # rims go dry sooner than the middle
    voids = 1 / (1 + np.exp(-(dry * 0.85 + fine * 0.55 + edge - 2.5) * 5.0))
    tilt = 0.93 + 0.07 * ((xx / N) * 0.6 + (yy / N) * 0.4)         # one side pressed a little less
    alpha = (0.94 - 0.085 * np.abs(pressure)) * (1 - voids) * tilt
    alpha = np.clip(alpha, 0, 1)
    img = np.zeros((N, N, 4), dtype=np.uint8)
    img[..., :3] = 255
    img[..., 3] = (alpha * 255).astype(np.uint8)
    Image.fromarray(img, "RGBA").save(os.path.join(OUT, "ink-wear.png"), optimize=True)
    print("ink-wear: mean alpha %.2f, fully missing %.1f%%" % (alpha.mean(), 100 * (alpha < 0.15).mean()))

def paper_fiber():
    rng = np.random.default_rng(9)
    canvas = np.zeros((N, N, 4), dtype=np.float32)
    layer = np.zeros((N, N), dtype=np.float32)
    for _ in range(2600):
        x, y = rng.uniform(0, N, 2)
        ang = rng.uniform(0, np.pi)
        length = rng.uniform(14, 70)
        bend = rng.normal(0, 0.012)
        pts = []
        for i in range(8):
            t = i / 7 * length
            a = ang + bend * t
            pts.append((x + np.cos(a) * t, y + np.sin(a) * t))
        pts = np.array(pts, dtype=np.float32)
        tone = rng.uniform(0.25, 1.0)
        for dx in (-N, 0, N):                                        # drawn shifted too, so the texture tiles seamlessly
            for dy in (-N, 0, N):
                if dx or dy:
                    if not (pts[:, 0].min() + dx < N and pts[:, 0].max() + dx > 0 and pts[:, 1].min() + dy < N and pts[:, 1].max() + dy > 0): continue
                cv2.polylines(layer, [np.round((pts + [dx, dy]) * 4).astype(np.int32)], False, float(tone), 1, cv2.LINE_AA, shift=2)
    layer = gaussian_filter(layer, 0.5, mode="wrap")
    cloud = field(rng, 38) * 0.5 + field(rng, 12) * 0.5               # slow cloudy variation in the paper's density
    a = np.clip(layer * 0.55 + (cloud * 0.05 + 0.05), 0, 1)
    canvas[..., 0], canvas[..., 1], canvas[..., 2] = 122, 98, 64      # warm brown fibres
    canvas[..., 3] = a * 255 * 0.32
    Image.fromarray(canvas.astype(np.uint8), "RGBA").save(os.path.join(OUT, "paper-fiber.png"), optimize=True)
    print("paper-fiber: mean alpha %.1f/255" % canvas[..., 3].mean())

if __name__ == "__main__":
    ink_wear(); paper_fiber()
