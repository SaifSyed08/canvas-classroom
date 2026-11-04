"""Draws the built-in page backgrounds into art/: a forest line along the bottom (Forest) and
blossom branches reaching in from the top corners (Blossom). Each comes in an ink for light pages
and one for dark pages. They're drawn solid; the page fades them (the Background strength setting).

    python store/make-art.py
"""
import math
import os
import random

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'art')
W, H = 1600, 900


def svg(body):
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" preserveAspectRatio="xMidYMax slice">{body}</svg>\n'


def f(v):
    return f'{v:.1f}'.rstrip('0').rstrip('.')


# ------------------------------------------------------------------ trees
def pine(x, base, h, rnd):
    """A pine: three or four stacked tiers and a stub of trunk."""
    tiers = rnd.choice([3, 4, 4, 5])
    w = h * rnd.uniform(0.36, 0.46)
    trunk = h * 0.08
    top = base - h
    parts = [f'<rect x="{f(x - w * 0.05)}" y="{f(base - trunk)}" width="{f(w * 0.1)}" height="{f(trunk + 2)}"/>']
    pts = []
    for i in range(tiers):
        t0 = i / tiers
        t1 = (i + 1.25) / tiers
        y0 = top + (h - trunk) * t0 * 0.92
        y1 = top + (h - trunk) * min(t1, 1)
        half = w / 2 * (0.45 + 0.55 * (i + 1) / tiers)
        sag = rnd.uniform(2, 6)
        pts.append(f'<path d="M{f(x)} {f(y0)} L{f(x + half)} {f(y1)} Q{f(x)} {f(y1 - sag)} {f(x - half)} {f(y1)} Z"/>')
    return ''.join(parts + pts)


def trees(ink):
    rnd = random.Random(7)
    rows = [
        # (opacity, ground y, height range, spacing)
        (0.28, 800, (150, 260), 46),
        (0.5, 850, (210, 340), 70),
        (0.85, 915, (280, 440), 120),
    ]
    body = []
    for op, ground, (lo, hi), gap in rows:
        g = []
        x = -rnd.uniform(0, gap)
        while x < W + gap:
            # Clearings in the middle so the page's middle stays calm.
            mid = abs(x - W / 2) / (W / 2)
            if rnd.random() < 0.35 + 0.6 * mid:
                h = rnd.uniform(lo, hi) * (0.75 + 0.35 * mid)
                g.append(pine(x, ground + rnd.uniform(-8, 8), h, rnd))
            x += gap * rnd.uniform(0.6, 1.25)
        hill = f'<path d="M0 {ground - 10} Q{W * 0.3} {ground - 40} {W * 0.55} {ground - 14} T{W} {ground - 22} V{H} H0 Z"/>'
        body.append(f'<g fill="{ink}" opacity="{op}">{hill}{"".join(g)}</g>')
    return svg(''.join(body))


# ------------------------------------------------------------------ blossom branches
def branch(rnd, x, y, ang, length, width, depth, out, flowers):
    """A tapering, slightly wandering branch with twigs; blossoms cluster near the tips."""
    segs = max(4, int(length / 26))
    step = length / segs
    for i in range(segs):
        ang += rnd.uniform(-0.16, 0.16)
        nx, ny = x + math.cos(ang) * step, y + math.sin(ang) * step
        w = width * (1 - i / segs * 0.7)
        out.append(f'<line x1="{f(x)}" y1="{f(y)}" x2="{f(nx)}" y2="{f(ny)}" stroke-width="{f(w)}"/>')
        if depth > 0 and i > 1 and rnd.random() < 0.28:
            side = rnd.choice([-1, 1])
            branch(rnd, nx, ny, ang + side * rnd.uniform(0.45, 0.9), length * rnd.uniform(0.3, 0.5), w * 0.7, depth - 1, out, flowers)
        if i > segs * 0.35 and rnd.random() < 0.5:
            flowers.append((nx + rnd.uniform(-14, 14), ny + rnd.uniform(-14, 14), rnd.uniform(9, 17), rnd.uniform(0, 72)))
        x, y = nx, ny
    for _ in range(rnd.randint(2, 4)):
        flowers.append((x + rnd.uniform(-22, 22), y + rnd.uniform(-22, 22), rnd.uniform(10, 18), rnd.uniform(0, 72)))


def blossom(r, x, y, rot, petal, edge, heart, bud=False):
    if bud:
        return f'<circle cx="{f(x)}" cy="{f(y)}" r="{f(r * 0.45)}" fill="{petal}" stroke="{edge}" stroke-width="1.2"/>'
    ps = []
    for k in range(5):
        a = math.radians(rot + k * 72)
        cx, cy = x + math.cos(a) * r * 0.55, y + math.sin(a) * r * 0.55
        ps.append(
            f'<ellipse cx="{f(cx)}" cy="{f(cy)}" rx="{f(r * 0.52)}" ry="{f(r * 0.4)}" transform="rotate({f(math.degrees(a))} {f(cx)} {f(cy)})"/>'
        )
    return (
        f'<g fill="{petal}" stroke="{edge}" stroke-width="1.2">{"".join(ps)}</g>'
        f'<circle cx="{f(x)}" cy="{f(y)}" r="{f(r * 0.2)}" fill="{heart}"/>'
    )


def blossoms(bark, petal, edge, heart):
    rnd = random.Random(11)
    lines, flowers = [], []
    # From the top left, reaching right and down; a smaller one from the top right.
    branch(rnd, -40, 120, 0.18, 760, 26, 2, lines, flowers)
    branch(rnd, -30, 40, 0.42, 420, 16, 1, lines, flowers)
    branch(rnd, W + 40, 70, math.pi - 0.25, 560, 22, 2, lines, flowers)
    # A few petals drifting down.
    drift = []
    for _ in range(16):
        x, y = rnd.uniform(80, W - 80), rnd.uniform(260, H - 40)
        a = rnd.uniform(0, 180)
        drift.append(f'<ellipse cx="{f(x)}" cy="{f(y)}" rx="7" ry="4.5" transform="rotate({f(a)} {f(x)} {f(y)})"/>')
    fl = ''.join(blossom(r, x, y, rot, petal, edge, heart, bud=rnd.random() < 0.18) for x, y, r, rot in flowers)
    return svg(
        f'<g stroke="{bark}" stroke-linecap="round" fill="none">{"".join(lines)}</g>{fl}'
        f'<g fill="{petal}" stroke="{edge}" stroke-width="1" opacity=".8">{"".join(drift)}</g>'
    ).replace('preserveAspectRatio="xMidYMax slice"', 'preserveAspectRatio="xMidYMin slice"')


def main():
    os.makedirs(OUT, exist_ok=True)
    files = {
        'trees-light.svg': trees('#1f2a22'),
        'trees-dark.svg': trees('#dfe7e0'),
        'blossom-light.svg': blossoms('#3b3b3b', '#c9c9c9', '#6e6e6e', '#3b3b3b'),
        'blossom-dark.svg': blossoms('#cfcfcf', '#e8e8e8', '#9a9a9a', '#6a6a6a'),
    }
    for name, text in files.items():
        with open(os.path.join(OUT, name), 'w', encoding='utf-8', newline='\n') as fh:
            fh.write(text)
        print(name, len(text))


if __name__ == '__main__':
    main()
