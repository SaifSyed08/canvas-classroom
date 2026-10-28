"""Draws the built-in page backgrounds into art/: a forest line along the bottom (Forest), blossom
branches reaching in from the top corners (Blossom), mountain ridges and waves along the bottom,
clouds along the top, a starry sky with a moon, and school doodles around the edges. Each comes in an ink for light pages
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


# ------------------------------------------------------------------ mountains
def ridge(rnd, base, amp, peaks):
    """A jagged ridgeline across the page, closed down to the bottom."""
    pts, x = [], -40
    while x < W + 40:
        pts.append((x, base - rnd.uniform(0.25, 1) * amp))
        x += W / peaks * rnd.uniform(0.35, 0.8)
        pts.append((x, base - rnd.uniform(0, 0.25) * amp))
        x += W / peaks * rnd.uniform(0.2, 0.5)
    return 'M-40 ' + f(H) + ' ' + ' '.join(f'L{f(px)} {f(py)}' for px, py in pts) + f' L{W + 40} {H} Z'


def mountains(ink):
    rnd = random.Random(5)
    rows = [(0.22, 640, 300, 5), (0.45, 760, 260, 7), (0.8, 880, 180, 9)]
    return svg(''.join(f'<path fill="{ink}" opacity="{op}" d="{ridge(rnd, b, a, n)}"/>' for op, b, a, n in rows))


# ------------------------------------------------------------------ waves
def waves(ink):
    rnd = random.Random(3)
    body = []
    for op, base, amp, lam in [(0.22, 690, 26, 260), (0.45, 770, 30, 210), (0.8, 850, 34, 170)]:
        ph = rnd.uniform(0, lam)
        d = f'M0 {f(base)}'
        x = -ph
        while x < W + lam:
            # A crest that leans forward, then a long trough.
            d += f' Q{f(x + lam * 0.25)} {f(base - amp * 2)} {f(x + lam * 0.5)} {f(base - amp * 0.4)} T{f(x + lam)} {f(base)}'
            x += lam
        body.append(f'<path fill="{ink}" opacity="{op}" d="{d} V{H} H0 Z"/>')
    return svg(''.join(body))


# ------------------------------------------------------------------ clouds
def cloud(x, y, s):
    parts = [(0, 0, 60), (55, -25, 70), (120, -5, 58), (175, 10, 44), (-50, 12, 42)]
    circles = ''.join(f'<circle cx="{f(x + dx * s)}" cy="{f(y + dy * s)}" r="{f(r * s)}"/>' for dx, dy, r in parts)
    return circles + f'<rect x="{f(x - 70 * s)}" y="{f(y + 10 * s)}" width="{f(270 * s)}" height="{f(44 * s)}" rx="{f(22 * s)}"/>'


def clouds(ink):
    spots = [(0.35, 230, 150, 1.2), (0.55, 1220, 130, 1.1), (0.25, 760, 230, 0.8), (0.45, 470, 360, 0.7), (0.3, 1430, 340, 0.85), (0.2, 90, 380, 0.6), (0.2, 980, 420, 0.55)]
    return svg(''.join(f'<g fill="{ink}" opacity="{op}">{cloud(x, y, s)}</g>' for op, x, y, s in spots)).replace(
        'preserveAspectRatio="xMidYMax slice"', 'preserveAspectRatio="xMidYMin slice"'
    )


# ------------------------------------------------------------------ stars
def sparkle(x, y, r):
    k = r * 0.22
    return f'<path d="M{f(x)} {f(y - r)} Q{f(x + k)} {f(y - k)} {f(x + r)} {f(y)} Q{f(x + k)} {f(y + k)} {f(x)} {f(y + r)} Q{f(x - k)} {f(y + k)} {f(x - r)} {f(y)} Q{f(x - k)} {f(y - k)} {f(x)} {f(y - r)} Z"/>'


def stars(ink):
    rnd = random.Random(9)
    body = [f'<g fill="{ink}">']
    # A crescent moon, top right.
    body.append(f'<path opacity=".8" d="M1400 70 A110 110 0 1 0 1490 250 A88 88 0 1 1 1400 70 Z"/>')
    for _ in range(240):
        x, y = rnd.uniform(0, W), rnd.uniform(0, H)
        # Fewer in the middle, where the page's content is.
        if abs(x - W / 2) < W * 0.28 and rnd.random() < 0.7:
            continue
        if rnd.random() < 0.2:
            body.append(f'<g opacity="{f(rnd.uniform(0.6, 1))}">{sparkle(x, y, rnd.uniform(12, 24))}</g>')
        else:
            body.append(f'<circle cx="{f(x)}" cy="{f(y)}" r="{f(rnd.uniform(2.5, 5))}" opacity="{f(rnd.uniform(0.45, 0.95))}"/>')
    body.append('</g>')
    return svg(''.join(body)).replace('preserveAspectRatio="xMidYMax slice"', 'preserveAspectRatio="xMidYMid slice"')


# ------------------------------------------------------------------ school doodles
DOODLES = {
    'pencil': 'M-60 20 L40 -80 L70 -50 L-30 50 Z M40 -80 L55 -95 L85 -65 L70 -50 M-60 20 L-75 65 L-30 50',
    'book': 'M-70 -45 Q-35 -60 0 -40 Q35 -60 70 -45 V45 Q35 30 0 50 Q-35 30 -70 45 Z M0 -40 V50',
    'star': 'M0 -55 L16 -17 L57 -17 L24 8 L36 48 L0 24 L-36 48 L-24 8 L-57 -17 L-16 -17 Z',
    'bulb': 'M-22 30 Q-50 5 -40 -25 Q-28 -60 0 -60 Q28 -60 40 -25 Q50 5 22 30 Z M-18 42 H18 M-12 54 H12',
    'plane': 'M-70 10 L70 -50 L20 50 L0 15 Z M0 15 L70 -50',
    'atom': 'M-70 0 A70 26 0 1 0 70 0 A70 26 0 1 0 -70 0 M-35 -61 A70 26 60 1 0 35 61 A70 26 60 1 0 -35 -61 M-35 61 A70 26 -60 1 0 35 -61 A70 26 -60 1 0 -35 61',
    'ruler': 'M-80 -18 H80 V18 H-80 Z M-60 -18 V-2 M-40 -18 V2 M-20 -18 V-2 M0 -18 V6 M20 -18 V-2 M40 -18 V2 M60 -18 V-2',
    'pi': 'M-40 -30 H40 M-20 -30 V40 M18 -30 Q14 20 32 40',
    'plus': 'M-24 0 H24 M0 -24 V24',
    'heart': 'M0 40 Q-60 0 -40 -30 Q-20 -55 0 -25 Q20 -55 40 -30 Q60 0 0 40 Z',
}


def doodles(ink):
    rnd = random.Random(13)
    names = list(DOODLES)
    body, placed = [], []
    tries = 0
    while len(placed) < 26 and tries < 4000:
        tries += 1
        x, y = rnd.uniform(60, W - 60), rnd.uniform(60, H - 60)
        # The edges, not the middle of the page.
        if abs(x - W / 2) < W * 0.26 and abs(y - H / 2) < H * 0.3:
            continue
        if any((x - px) ** 2 + (y - py) ** 2 < 170**2 for px, py in placed):
            continue
        placed.append((x, y))
        n = names[len(placed) % len(names)]
        s = rnd.uniform(0.55, 0.85)
        body.append(f'<path d="{DOODLES[n]}" transform="translate({f(x)} {f(y)}) rotate({f(rnd.uniform(-25, 25))}) scale({f(s)})" stroke-width="{f(5 / s)}"/>')
    return svg(f'<g fill="none" stroke="{ink}" stroke-linecap="round" stroke-linejoin="round">{"".join(body)}</g>').replace(
        'preserveAspectRatio="xMidYMax slice"', 'preserveAspectRatio="xMidYMid slice"'
    )


def main():
    os.makedirs(OUT, exist_ok=True)
    files = {
        'trees-light.svg': trees('#1f2a22'),
        'trees-dark.svg': trees('#dfe7e0'),
        'blossom-light.svg': blossoms('#3b3b3b', '#c9c9c9', '#6e6e6e', '#3b3b3b'),
        'blossom-dark.svg': blossoms('#cfcfcf', '#e8e8e8', '#9a9a9a', '#6a6a6a'),
    }
    for name, draw in [('mountains', mountains), ('waves', waves), ('clouds', clouds), ('stars', stars), ('doodles', doodles)]:
        files[f'{name}-light.svg'] = draw('#1f2a22')
        files[f'{name}-dark.svg'] = draw('#dfe7e0')
    for name, text in files.items():
        with open(os.path.join(OUT, name), 'w', encoding='utf-8', newline='\n') as fh:
            fh.write(text)
        print(name, len(text))


if __name__ == '__main__':
    main()
