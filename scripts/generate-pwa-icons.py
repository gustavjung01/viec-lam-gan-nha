#!/usr/bin/env python3
from math import pow
from pathlib import Path

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
SOURCE_SIZE = 512.0
RENDER_MULTIPLIER = 4
OUTPUT_DIR = ROOT / "public"


def lerp(a, b, t):
    return round(a + (b - a) * t)


def gradient_color(t):
    start = (11, 42, 99, 255)
    end = (6, 37, 90, 255)
    return tuple(lerp(start[i], end[i], t) for i in range(4))


def cubic_points(p0, p1, p2, p3, steps=48):
    points = []
    for i in range(1, steps + 1):
        t = i / steps
        mt = 1 - t
        x = (
            pow(mt, 3) * p0[0]
            + 3 * pow(mt, 2) * t * p1[0]
            + 3 * mt * pow(t, 2) * p2[0]
            + pow(t, 3) * p3[0]
        )
        y = (
            pow(mt, 3) * p0[1]
            + 3 * pow(mt, 2) * t * p1[1]
            + 3 * mt * pow(t, 2) * p2[1]
            + pow(t, 3) * p3[1]
        )
        points.append((x, y))
    return points


def transform_points(points, canvas_size, content_scale=1.0):
    scale = (canvas_size / SOURCE_SIZE) * content_scale
    offset = (canvas_size - SOURCE_SIZE * scale) / 2
    return [((x * scale) + offset, (y * scale) + offset) for x, y in points]


def draw_polygon(draw, points, fill):
    draw.polygon(points, fill=fill)


def render_logo(canvas_size, content_scale=1.0):
    canvas = Image.new("RGBA", (canvas_size, canvas_size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(canvas)

    shield_points = [
        (256, 54),
        *cubic_points((256, 54), (317, 99), (381, 115), (430, 118)),
        (430, 260),
        *cubic_points((430, 260), (430, 372), (349, 445), (256, 493)),
        *cubic_points((256, 493), (163, 445), (82, 372), (82, 260)),
        (82, 118),
        *cubic_points((82, 118), (131, 115), (195, 99), (256, 54)),
    ]

    gradient = Image.new("RGBA", (canvas_size, canvas_size), (0, 0, 0, 0))
    gradient_draw = ImageDraw.Draw(gradient)
    for y in range(canvas_size):
        t = 0 if canvas_size <= 1 else y / (canvas_size - 1)
        gradient_draw.line((0, y, canvas_size, y), fill=gradient_color(t))

    shield_mask = Image.new("L", (canvas_size, canvas_size), 0)
    mask_draw = ImageDraw.Draw(shield_mask)
    draw_polygon(mask_draw, transform_points(shield_points, canvas_size, content_scale), fill=255)
    canvas = Image.composite(gradient, canvas, shield_mask)
    draw = ImageDraw.Draw(canvas)

    orange_points = transform_points([(340, 111), (430, 115), (430, 214), (360, 197)], canvas_size, content_scale)
    draw_polygon(draw, orange_points, fill=(255, 122, 0, 255))

    ribbon_points = [
        (175, 214),
        *cubic_points((175, 214), (212, 201), (241, 186), (256, 178)),
        *cubic_points((256, 178), (305, 206), (346, 219), (416, 231)),
        (408, 264),
        *cubic_points((408, 264), (319, 253), (282, 231), (256, 215)),
        *cubic_points((256, 215), (230, 230), (196, 246), (170, 258)),
    ]
    draw_polygon(draw, transform_points(ribbon_points, canvas_size, content_scale), fill=(255, 255, 255, 255))

    vertical_points = transform_points(
        [(193, 219), (257, 190), (257, 388), (225, 422), (193, 388), (204, 253), (193, 258)],
        canvas_size,
        content_scale,
    )
    draw_polygon(draw, vertical_points, fill=(255, 255, 255, 255))

    return canvas


def write_icon(filename, size, content_scale=1.0):
    render_size = size * RENDER_MULTIPLIER
    icon = render_logo(render_size, content_scale).resize((size, size), Image.Resampling.LANCZOS)
    icon.save(OUTPUT_DIR / filename)


def main():
    write_icon("apple-touch-icon.png", 180)
    write_icon("icon-192.png", 192)
    write_icon("icon-512.png", 512)
    write_icon("maskable-512.png", 512, content_scale=0.76)
    print("Generated PWA icons in /public.")


if __name__ == "__main__":
    main()
