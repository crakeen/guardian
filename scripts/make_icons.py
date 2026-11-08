"""Genera los iconos PNG de la app (un escudo con una marca de verificación), sin dependencias."""
import math
import struct
import sys
import zlib
from pathlib import Path


def inside_shield(u, v):
    if v < 0.18 or v > 0.86 or abs(u - 0.5) > 0.32:
        return False
    if v < 0.55:
        return True
    # parte inferior en punta
    return abs(u - 0.5) <= 0.32 * (0.86 - v) / 0.31


def near_segment(u, v, a, b, w):
    ax, ay = a
    bx, by = b
    t = max(0, min(1, ((u - ax) * (bx - ax) + (v - ay) * (by - ay)) / ((bx - ax) ** 2 + (by - ay) ** 2)))
    return math.hypot(u - (ax + t * (bx - ax)), v - (ay + t * (by - ay))) < w


def png(path, size):
    rows = []
    for y in range(size):
        row = bytearray([0])
        for x in range(size):
            u, v = x / size, y / size
            r, g, b = 11, 15, 23
            if inside_shield(u, v):
                r, g, b = 34, 56, 92
                if near_segment(u, v, (0.36, 0.50), (0.46, 0.62), 0.045) or near_segment(u, v, (0.46, 0.62), (0.66, 0.38), 0.045):
                    r, g, b = 34, 197, 94
            row += bytes((r, g, b))
        rows.append(bytes(row))
    raw = zlib.compress(b"".join(rows), 9)

    def chunk(tag, data):
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)

    out = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 2, 0, 0, 0)) + chunk(b"IDAT", raw) + chunk(b"IEND", b"")
    Path(path).write_bytes(out)


if __name__ == "__main__":
    out = Path(sys.argv[1])
    out.mkdir(parents=True, exist_ok=True)
    for s in (180, 192, 512):
        png(out / f"icon-{s}.png", s)
