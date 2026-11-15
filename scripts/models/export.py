"""Turns the raw renders into what the site ships.

    python3 scripts/models/export.py <scratch dir from shots.sh> public/img

close/*.png  -> close/<name>-1600.webp and -960.webp
fleet/*.png  -> fleet/<id>.webp (720 wide)
hero/*.png   -> hero.mp4 (there and back, so it loops without a cut), hero.webp
                (poster) and ../og-image.jpg
Missing inputs are skipped, so it can run while renders are still coming in.
"""
import subprocess
import sys
import tempfile
from pathlib import Path

from PIL import Image

src, out = Path(sys.argv[1]), Path(sys.argv[2])


def webp(im, path, width, quality=82):
    path.parent.mkdir(parents=True, exist_ok=True)
    h = round(im.height * width / im.width)
    im.convert("RGB").resize((width, h), Image.LANCZOS).save(path, "WEBP", quality=quality, method=6)


for png in sorted((src / "close").glob("*.png")):
    im = Image.open(png)
    webp(im, out / "close" / f"{png.stem}-1600.webp", 1600)
    webp(im, out / "close" / f"{png.stem}-960.webp", 960, 80)

for png in sorted((src / "fleet").glob("*.png")):
    webp(Image.open(png), out / "fleet" / f"{png.stem}.webp", 720, 80)

frames = sorted((src / "hero").glob("*.png"))
if frames:
    # Poster: the frame the video opens on, so the swap from still to motion is invisible.
    first = Image.open(frames[0])
    webp(first, out / "hero.webp", first.width, 84)
    # Social card: a 1200x630 crop from the middle of the move.
    mid = Image.open(frames[len(frames) // 2]).convert("RGB")
    w = mid.width
    h = round(w * 630 / 1200)
    top = (mid.height - h) // 2
    mid.crop((0, top, w, top + h)).resize((1200, 630), Image.LANCZOS).save(out.parent / "og-image.jpg", quality=88)
    with tempfile.TemporaryDirectory() as tmp:
        order = frames + frames[-2:0:-1]
        for i, f in enumerate(order):
            (Path(tmp) / f"{i:04d}.png").symlink_to(f.resolve())
        subprocess.run(
            ["ffmpeg", "-y", "-loglevel", "error", "-framerate", "20", "-i", f"{tmp}/%04d.png",
             "-c:v", "libx264", "-preset", "veryslow", "-crf", "24", "-pix_fmt", "yuv420p",
             "-movflags", "+faststart", "-an", str(out / "hero.mp4")],
            check=True,
        )
print("exported to", out)
