#!/usr/bin/env python3
"""Genera resources/neofetch.svg: tarjeta estilo terminal (neofetch) con la foto en bloques retro.

Uso:
    python3 scripts/build-neofetch.py --photo ruta/a/foto.png

El SVG es autocontenido (sin fuentes ni imágenes externas), por lo que se ve igual en el
modo oscuro y claro de GitHub. La información de la derecha se edita en INFO.
"""
import argparse
import html
from pathlib import Path
from PIL import Image, ImageFilter, ImageOps

# ── Información que muestra la terminal (solo datos verificados) ─────────────
USER_HOST = "ricardo@github"
INFO = [
    ("User",        "Ricardo Pocasangre"),
    ("Role",        "Desarrollador Full Stack y móvil"),
    ("Location",    "San Salvador, El Salvador"),
    ("Work",        "Programador @ Famolcas S.A. de C.V. (Lido)"),
    ("Languages",   "C#, Kotlin, JavaScript, TypeScript, Java, PHP, C++"),
    ("Frameworks",  ".NET (XAF), React, Node.js, Express, Laravel"),
    ("Mobile",      "Android (Kotlin), React Native"),
    ("Databases",   "PostgreSQL, SQL Server, MongoDB, Oracle, MySQL"),
    ("Tools",       "Git, GitHub, Postman, Figma, Vercel"),
    ("Studying",    "Técnico en Desarrollo de Software (UCA) · Kodigo"),
    ("Open to",     "Colaboraciones remotas"),
]

# ── Diseño ───────────────────────────────────────────────────────────────────
COLS, ROWS = 72, 80          # retrato en bloques: celdas cuadradas (la foto recortada mide ~1:1.1)
CELL = 4.6                   # lado de cada bloque en px
BG_THRESHOLD = 0.80          # brillo (0-1) a partir del cual se considera fondo
LEVELS = 6                   # niveles de intensidad del bloque (0 = vacío)
BG, BAR, TEXT, DIM = "#0d1117", "#161b22", "#c9d1d9", "#6e7681"
CYAN, PINK, BLUE, GREEN = "#39d0f0", "#ff79c6", "#58a6ff", "#3fb950"
MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace"


def mix(fg: str, bg: str, t: float) -> str:
    f = [int(fg[i:i + 2], 16) for i in (1, 3, 5)]
    b = [int(bg[i:i + 2], 16) for i in (1, 3, 5)]
    return "#" + "".join(f"{round(b[i] + (f[i] - b[i]) * t):02x}" for i in range(3))


SHADES = [mix(CYAN, BG, t) for t in (0.16, 0.34, 0.55, 0.78, 1.0)]


def portrait_levels(photo: Path) -> list[list[int]]:
    """Cuadrícula COLS×ROWS con el nivel (0..LEVELS-1) de cada bloque del retrato."""
    im = Image.open(photo).convert("L")
    w, h = im.size
    # Encuadre cerrado de cabeza y cuello (proporciones de la foto original)
    im = im.crop((int(w * 0.325), int(h * 0.115), int(w * 0.675), int(h * 0.700)))
    im = ImageOps.autocontrast(im, cutoff=1)
    edges = im.filter(ImageFilter.FIND_EDGES).filter(ImageFilter.GaussianBlur(0.6))
    edges = ImageOps.autocontrast(edges, cutoff=2)
    small = im.resize((COLS, ROWS), Image.LANCZOS)
    small_edges = edges.resize((COLS, ROWS), Image.LANCZOS)
    grid = []
    for y in range(ROWS):
        row = []
        for x in range(COLS):
            lum = small.getpixel((x, y)) / 255
            edge = small_edges.getpixel((x, y)) / 255
            if lum > BG_THRESHOLD and edge < 0.34:        # fondo y camisa claros: vacío
                row.append(0)
                continue
            # Dentro del sujeto el contraste se estira entre 0 (oscuro) y el umbral del fondo
            dark = max(0.0, 1 - lum / BG_THRESHOLD) ** 0.75
            v = min(1.0, dark * 0.85 + edge * 0.70)
            row.append(max(1, min(LEVELS - 1, round(v * (LEVELS - 1)))))
        grid.append(row)
    return grid


def portrait_rects(grid: list[list[int]], x0: float, y0: float) -> list[str]:
    """Une bloques contiguos del mismo nivel en una sola barra para mantener el SVG liviano."""
    out = []
    for y, row in enumerate(grid):
        x = 0
        while x < len(row):
            level = row[x]
            if level == 0:
                x += 1
                continue
            end = x
            while end + 1 < len(row) and row[end + 1] == level:
                end += 1
            out.append(
                f'<rect x="{x0 + x*CELL:.1f}" y="{y0 + y*CELL:.1f}" width="{(end-x+1)*CELL:.1f}" height="{CELL + 0.35:.2f}" '
                f'fill="{SHADES[level - 1]}"/>'
            )
            x = end + 1
    return out


def build(photo: Path, out: Path) -> None:
    grid = portrait_levels(photo)
    pad = 28
    art_w, art_h = COLS * CELL, ROWS * CELL
    info_x = pad + art_w + 40
    width = int(info_x + 560)
    top = 52
    height = int(top + 26 + max(art_h, 23 * (len(INFO) + 5)) + 34)
    g = []
    g.append(f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}" role="img" aria-labelledby="t d">')
    g.append('<title id="t">neofetch de Ricardo Pocasangre</title>')
    g.append('<desc id="d">Terminal estilo neofetch: retrato pixelado y datos del perfil (rol, lenguajes, frameworks, herramientas y estudios).</desc>')
    g.append(f'<rect width="{width}" height="{height}" rx="12" fill="{BG}" stroke="#30363d"/>')
    g.append(f'<path d="M0 12a12 12 0 0 1 12-12h{width-24}a12 12 0 0 1 12 12v28H0z" fill="{BAR}"/>')
    for i, c in enumerate(("#ff5f56", "#ffbd2e", "#27c93f")):
        g.append(f'<circle cx="{24+i*20}" cy="20" r="6" fill="{c}"/>')
    g.append(f'<text x="{width/2}" y="25" text-anchor="middle" font-family="{MONO}" font-size="12" fill="{DIM}">{USER_HOST}: ~</text>')
    g.append(f'<text x="{pad}" y="{top+4}" font-family="{MONO}" font-size="13" fill="{GREEN}">{USER_HOST}<tspan fill="{DIM}">:</tspan><tspan fill="{BLUE}">~</tspan><tspan fill="{TEXT}">$ neofetch</tspan></text>')

    # Retrato en bloques
    y0 = top + 26
    g.append('<g shape-rendering="crispEdges">')
    g.extend(portrait_rects(grid, pad, y0))
    g.append("</g>")

    # Información a la derecha
    y = y0 + 12
    g.append(f'<text x="{info_x}" y="{y}" font-family="{MONO}" font-size="15" font-weight="700" fill="{PINK}">{USER_HOST}</text>')
    y += 8
    g.append(f'<rect x="{info_x}" y="{y}" width="{len(USER_HOST)*9}" height="1.5" fill="{DIM}"/>')
    y += 26
    for key, value in INFO:
        g.append(
            f'<text x="{info_x}" y="{y}" font-family="{MONO}" font-size="13.5" font-weight="700" fill="{CYAN}">{html.escape(key)}</text>'
            f'<text x="{info_x+112}" y="{y}" font-family="{MONO}" font-size="13.5" fill="{TEXT}">{html.escape(value)}</text>'
        )
        y += 23
    # Paleta de colores, como en neofetch
    y += 6
    palette = ["#ff5f56", "#ffbd2e", GREEN, CYAN, BLUE, PINK, "#bd93f9", "#e6edf3"]
    for i, c in enumerate(palette):
        g.append(f'<rect x="{info_x + i*26}" y="{y}" width="22" height="14" rx="2" fill="{c}"/>')
    g.append("</svg>")
    out.write_text("\n".join(g), encoding="utf-8")
    print(f"{out} ({width}×{height}, {out.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--photo", required=True, type=Path)
    ap.add_argument("--out", default=Path(__file__).resolve().parent.parent / "resources" / "neofetch.svg", type=Path)
    a = ap.parse_args()
    build(a.photo, a.out)
