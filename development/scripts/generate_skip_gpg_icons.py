#!/usr/bin/env python3
"""
Generate skip_gpg branded icon assets by applying a diagonal TEST ribbon.
"""

from __future__ import annotations

import math
import shutil
import subprocess
import tempfile
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[2]


def _fit_test_font(
    band_thickness: float,
    visible_len: float,
    icon_base: float,
    text: str = "TEST",
) -> tuple[ImageFont.ImageFont, int, int, int]:
    # Keep text larger while still staying fully inside the ribbon.
    max_h = band_thickness * 0.88
    max_w = visible_len * 0.60

    # Computed size scales by icon base. For 512x512 this is exactly 72px.
    size = max(10, int(round(icon_base * 72 / 512)))
    while size >= 10:
        font = load_font(size)
        stroke_width = max(1, int(size * 0.12))
        letter_spacing = 1
        # Probe text bounds using a tiny canvas.
        probe = Image.new("RGBA", (4, 4), (0, 0, 0, 0))
        draw = ImageDraw.Draw(probe)
        bbox = draw.textbbox((0, 0), text, font=font, stroke_width=stroke_width)
        tw = bbox[2] - bbox[0] + letter_spacing * (max(0, len(text) - 1))
        th = bbox[3] - bbox[1]
        if tw <= max_w and th <= max_h:
            return font, size, letter_spacing, stroke_width
        size -= 1

    fallback_size = 10
    return load_font(fallback_size), fallback_size, 1, max(1, int(fallback_size * 0.12))


def load_font(size: int) -> ImageFont.ImageFont:
    candidates = [
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
        "/System/Library/Fonts/Supplemental/Arial.ttf",
        "/System/Library/Fonts/SFNS.ttf",
    ]
    for candidate in candidates:
        try:
            return ImageFont.truetype(candidate, size)
        except Exception:
            continue
    return ImageFont.load_default()


def add_skip_gpg_badge(src_path: Path, dst_path: Path) -> None:
    image = Image.open(src_path).convert("RGBA")
    w, h = image.size

    overlay = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)

    base = min(w, h)
    angle_deg = 35
    theta = math.radians(angle_deg)
    along = (math.cos(theta), math.sin(theta))
    normal = (-math.sin(theta), math.cos(theta))

    band_thickness = base * 0.18
    half_thickness = band_thickness / 2.0

    # Make the ribbon a long strip that crosses the icon, then clip by icon alpha.
    # This keeps both ends visually consistent (no short rectangular cutoff).
    center = (w * 0.68, h * 0.34)
    half_len = base * 0.95
    p0 = (center[0] - along[0] * half_len, center[1] - along[1] * half_len)
    p1 = (center[0] + along[0] * half_len, center[1] + along[1] * half_len)

    p0a = (p0[0] + normal[0] * half_thickness, p0[1] + normal[1] * half_thickness)
    p0b = (p0[0] - normal[0] * half_thickness, p0[1] - normal[1] * half_thickness)
    p1b = (p1[0] - normal[0] * half_thickness, p1[1] - normal[1] * half_thickness)
    p1a = (p1[0] + normal[0] * half_thickness, p1[1] + normal[1] * half_thickness)

    polygon = [p0a, p0b, p1b, p1a]
    draw.polygon(polygon, fill=(255, 106, 0, 255))
    draw.line([p0a, p1a], fill=(0, 0, 0, 220), width=max(1, int(base * 0.012)))
    draw.line([p0b, p1b], fill=(0, 0, 0, 220), width=max(1, int(base * 0.012)))

    # Clip ribbon to icon shape.
    base_alpha = image.split()[-1]
    overlay_alpha = overlay.split()[-1]
    clipped_alpha = ImageChops.multiply(overlay_alpha, base_alpha)
    overlay.putalpha(clipped_alpha)

    # Compute visible ribbon center line so TEST stays centered inside the strip.
    alpha_px = clipped_alpha.load()
    center_normal = center[0] * normal[0] + center[1] * normal[1]

    band_center_tolerance = band_thickness * 0.22
    min_along = float("inf")
    max_along = float("-inf")
    for y in range(h):
        for x in range(w):
            if alpha_px[x, y] <= 0:
                continue
            nproj = x * normal[0] + y * normal[1]
            if abs(nproj - center_normal) <= band_center_tolerance:
                aproj = x * along[0] + y * along[1]
                if aproj < min_along:
                    min_along = aproj
                if aproj > max_along:
                    max_along = aproj

    if min_along == float("inf") or max_along == float("-inf"):
        min_along = p0[0] * along[0] + p0[1] * along[1]
        max_along = p1[0] * along[0] + p1[1] * along[1]

    center_along = (min_along + max_along) / 2.0
    visible_len = max(1.0, max_along - min_along)

    text_center = (
        center_along * along[0] + center_normal * normal[0],
        center_along * along[1] + center_normal * normal[1],
    )

    # Center TEST within the visible ribbon area and align to ribbon angle.
    text = "TEST"
    font, font_size, letter_spacing, stroke_width = _fit_test_font(
        band_thickness, visible_len, base, text
    )

    # Build a tight canvas around text to avoid off-ribbon antialias artifacts.
    probe = Image.new("RGBA", (8, 8), (0, 0, 0, 0))
    probe_draw = ImageDraw.Draw(probe)
    char_metrics: list[tuple[str, tuple[int, int, int, int], int]] = []
    min_top = float("inf")
    max_bottom = float("-inf")
    raw_w = 0
    for ch in text:
        char_bbox = probe_draw.textbbox(
            (0, 0), ch, font=font, stroke_width=stroke_width
        )
        char_w = char_bbox[2] - char_bbox[0]
        raw_w += char_w
        min_top = min(min_top, char_bbox[1])
        max_bottom = max(max_bottom, char_bbox[3])
        char_metrics.append((ch, char_bbox, char_w))
    raw_w += letter_spacing * (max(0, len(text) - 1))
    raw_h = max_bottom - min_top

    pad = max(4, int(font_size * 0.25))
    text_canvas_w = int(raw_w + pad * 2)
    text_canvas_h = int(raw_h + pad * 2)
    text_canvas = Image.new("RGBA", (text_canvas_w, text_canvas_h), (0, 0, 0, 0))
    text_draw = ImageDraw.Draw(text_canvas)
    baseline_y = int(pad - min_top)
    cursor_x = float(pad)
    for ch, char_bbox, char_w in char_metrics:
        draw_x = int(round(cursor_x - char_bbox[0]))
        text_draw.text(
            (draw_x, baseline_y),
            ch,
            fill=(255, 255, 255, 255),
            font=font,
            stroke_width=stroke_width,
            stroke_fill=(0, 0, 0, 180),
        )
        cursor_x += char_w + letter_spacing

    text_rotated = text_canvas.rotate(
        -angle_deg,
        expand=True,
        resample=Image.BILINEAR,
    )

    text_offset = (
        int(text_center[0] - text_rotated.width / 2),
        int(text_center[1] - text_rotated.height / 2),
    )
    text_layer = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    text_layer.alpha_composite(text_rotated, text_offset)
    text_alpha = text_layer.split()[-1].point(lambda a: 0 if a < 36 else a)
    text_alpha = ImageChops.multiply(text_alpha, clipped_alpha)
    text_layer.putalpha(text_alpha)

    overlay = Image.alpha_composite(overlay, text_layer)

    image = Image.alpha_composite(image, overlay)

    dst_path.parent.mkdir(parents=True, exist_ok=True)
    image.save(dst_path)


def generate_android_icons() -> None:
    base_dir = ROOT / "apps/mobile/android/app/src/main/res"
    density_dirs = [
        "mipmap-mdpi",
        "mipmap-hdpi",
        "mipmap-xhdpi",
        "mipmap-xxhdpi",
        "mipmap-xxxhdpi",
    ]
    for d in density_dirs:
        src_main = base_dir / d / "ic_launcher.png"
        src_round = base_dir / d / "ic_launcher_round.png"
        dst_main = base_dir / d / "ic_launcher_skip_gpg.png"
        dst_round = base_dir / d / "ic_launcher_skip_gpg_round.png"
        add_skip_gpg_badge(src_main, dst_main)
        add_skip_gpg_badge(src_round, dst_round)


def generate_ios_icons() -> None:
    src_dir = (
        ROOT
        / "apps/mobile/ios/OneKeyWallet/Images.xcassets/AppIcon.appiconset"
    )
    dst_dir = (
        ROOT
        / "apps/mobile/ios/OneKeyWallet/Images.xcassets/AppIconSkipGpg.appiconset"
    )
    if dst_dir.exists():
        shutil.rmtree(dst_dir)
    shutil.copytree(src_dir, dst_dir)

    for png_file in dst_dir.glob("*.png"):
        add_skip_gpg_badge(png_file, png_file)


def _create_icns_from_png(src_png: Path, out_icns: Path) -> None:
    iconutil = shutil.which("iconutil")
    if not iconutil:
        raise RuntimeError("iconutil not found; required to generate .icns")

    with tempfile.TemporaryDirectory(prefix="skip-gpg-iconset-") as tmp:
        iconset = Path(tmp) / "skipgpg.iconset"
        iconset.mkdir(parents=True, exist_ok=True)
        base = Image.open(src_png).convert("RGBA")

        sizes = [16, 32, 128, 256, 512]
        for size in sizes:
            img = base.resize((size, size), Image.LANCZOS)
            img.save(iconset / f"icon_{size}x{size}.png")
            img2 = base.resize((size * 2, size * 2), Image.LANCZOS)
            img2.save(iconset / f"icon_{size}x{size}@2x.png")

        out_icns.parent.mkdir(parents=True, exist_ok=True)
        subprocess.run(
            [iconutil, "-c", "icns", str(iconset), "-o", str(out_icns)],
            check=True,
        )


def generate_desktop_icons() -> None:
    icons_dir = ROOT / "apps/desktop/public/static/images/icons"
    src_512 = icons_dir / "512x512.png"
    src_1024 = icons_dir / "512x512@2x.png"

    dst_512 = icons_dir / "512x512-skip-gpg.png"
    dst_1024 = icons_dir / "512x512@2x-skip-gpg.png"
    dst_round = icons_dir / "round_icon-skip-gpg.png"
    dst_icns = icons_dir / "icon-skip-gpg.icns"

    add_skip_gpg_badge(src_512, dst_512)
    add_skip_gpg_badge(src_1024, dst_1024)
    add_skip_gpg_badge(src_512, dst_round)
    _create_icns_from_png(dst_1024, dst_icns)


def main() -> None:
    generate_android_icons()
    generate_ios_icons()
    generate_desktop_icons()
    print("[skip-gpg-icons] generated Android/iOS/Desktop icon assets")


if __name__ == "__main__":
    main()
