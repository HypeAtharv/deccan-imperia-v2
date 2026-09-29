"""Generate depth maps for the photoreal scroll-tour assets.

Input:  assets/tour/NNN-name.webp and NNN-name-m.webp
Output: assets/tour/NNN-name-depth.png and NNN-name-depth-m.png

Depth is stored as 8-bit grayscale, white = near and black = far. The mobile
map is resized from the desktop inference so both breakpoints share identical
scene geometry.
"""

from pathlib import Path
import sys
import time

import torch
from PIL import Image, ImageFilter, ImageOps
from transformers import pipeline


root = Path(sys.argv[1] if len(sys.argv) > 1 else "assets/tour")
requested = sys.argv[2:]
sources = (
    [root / name for name in requested]
    if requested
    else sorted(p for p in root.glob("[0-9][0-9][0-9]-*.webp") if not p.stem.endswith("-m"))
)
missing = [p for p in sources if not p.exists()]
if missing:
    raise SystemExit("Missing source image(s): " + ", ".join(map(str, missing)))
if not sources:
    raise SystemExit(f"No desktop tour images found in {root}")

device = "mps" if torch.backends.mps.is_available() else "cpu"
estimator = pipeline(
    "depth-estimation",
    model="depth-anything/Depth-Anything-V2-Small-hf",
    device=device,
)

for source in sources:
    started = time.time()
    image = Image.open(source).convert("RGB")
    depth = estimator(image)["depth"].convert("L").resize(image.size, Image.Resampling.BICUBIC)
    depth = depth.filter(ImageFilter.GaussianBlur(radius=max(1, image.width // 900)))
    depth = ImageOps.autocontrast(depth)

    desktop_out = source.with_name(f"{source.stem}-depth.png")
    depth.save(desktop_out, optimize=True)

    mobile_source = source.with_name(f"{source.stem}-m.webp")
    if mobile_source.exists():
        with Image.open(mobile_source) as mobile:
            mobile_depth = depth.resize(mobile.size, Image.Resampling.LANCZOS)
        mobile_depth.save(source.with_name(f"{source.stem}-depth-m.png"), optimize=True)

    print(f"{source.name:34s} {image.width}x{image.height} {time.time() - started:5.1f}s")
