"""Depth maps for every render, via Depth-Anything-V2-Small on Apple MPS.
Output: 8-bit greyscale PNG, WHITE = NEAR, BLACK = FAR, same aspect as the source.
Saved at the web image size so the shader samples it 1:1 with the colour texture."""
import sys, time, torch
from PIL import Image, ImageFilter
from transformers import pipeline
root = sys.argv[1]
names = ["row-oblique-dusk","row-oblique-day","row-panorama","hero-front","hero-corner",
         "cutaway-ground","cutaway-first"]
dev = "mps" if torch.backends.mps.is_available() else "cpu"
pipe = pipeline("depth-estimation", model="depth-anything/Depth-Anything-V2-Small-hf", device=dev)
for n in names:
    t0 = time.time()
    im = Image.open(f"{root}/{n}.webp").convert("RGB")
    d = pipe(im)["depth"].convert("L").resize(im.size, Image.BICUBIC)
    # light smoothing: kills per-pixel noise that shows up as shimmer when the shader displaces
    d = d.filter(ImageFilter.GaussianBlur(radius=max(1, im.size[0] // 900)))
    lo, hi = d.getextrema()
    d = d.point(lambda v: int(255 * (v - lo) / max(1, hi - lo)))
    d.save(f"{root}/{n}-depth.png", optimize=True)
    small = d.copy(); small.thumbnail((1000, 1000)); small.save(f"{root}/{n}-depth-m.png", optimize=True)
    print(f"{n:16s} {im.size[0]}x{im.size[1]}  {time.time()-t0:5.1f}s  range {lo}-{hi}")
