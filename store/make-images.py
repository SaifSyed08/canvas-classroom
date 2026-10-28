# Builds the Chrome Web Store images from docs/screenshots, store/raw and icons/:
#   store/images/screenshot-*.png   1280x800 (the store's size; at most 5)
#   store/images/promo-small.png    440x280  (required small promo tile)
#   store/images/promo-marquee.png  1400x560 (optional marquee)
# Rerun after renaming: python store/make-images.py --name "New Name"
# Needs Pillow, fontTools and brotli (pip install pillow fonttools brotli).
import argparse
import io
import os

from fontTools.ttLib import TTFont
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SHOTS = os.path.join(ROOT, 'docs', 'screenshots')
OUT = os.environ.get('GCX_OUT') or os.path.join(ROOT, 'store', 'images')

RAW = os.environ.get('GCX_RAW') or os.path.join(ROOT, 'store', 'raw')

# In store order: the first one is what people see first. A slide is built from the screenshots in
# store/raw when they're all there (full-window 16:10 PNGs), else the plain docs screenshot stands in.
#   themes: theme-blossom, theme-classroom, theme-schooldark, theme-forest (the dashboard in each theme)
#   ai:     ai-pill (Ask anything open over the page), ai-chat (the same with an answer)
#   pet:    pet (the pet with its speech bubble up)
SLIDES = [('themes', 'dashboard'), ('ai', 'ask'), (None, 'course-home'), (None, 'file-viewer'), ('pet', 'assignment')]
THEMES = [('theme-blossom', 'Blossom'), ('theme-classroom', 'Default'), ('theme-schooldark', 'School dark'), ('theme-forest', 'Forest')]

TOP = (16, 94, 58)
BOTTOM = (8, 52, 34)


def font(name, size):
    t = TTFont(os.path.join(ROOT, 'fonts', name))
    t.flavor = None
    b = io.BytesIO()
    t.save(b)
    b.seek(0)
    return ImageFont.truetype(b, size)


def gradient(w, h):
    g = Image.new('RGB', (w, h))
    px = g.load()
    for y in range(h):
        for x in range(w):
            k = (y / h) * 0.7 + (x / w) * 0.3
            px[x, y] = tuple(round(a + (b - a) * k) for a, b in zip(TOP, BOTTOM))
    return g


def rounded(img, r):
    m = Image.new('L', img.size, 0)
    ImageDraw.Draw(m).rounded_rectangle((0, 0, img.width - 1, img.height - 1), r, fill=255)
    img = img.convert('RGBA')
    img.putalpha(m)
    return img


def paste_shadowed(bg, img, xy, r, blur):
    sh = Image.new('RGBA', (img.width + blur * 4, img.height + blur * 4), (0, 0, 0, 0))
    ImageDraw.Draw(sh).rounded_rectangle((blur * 2, blur * 2, blur * 2 + img.width, blur * 2 + img.height), r, fill=(0, 0, 0, 110))
    sh = sh.filter(ImageFilter.GaussianBlur(blur))
    bg.alpha_composite(sh, (xy[0] - blur * 2, xy[1] - blur * 2 + blur // 2))
    bg.alpha_composite(rounded(img, r), xy)


def raw(name):
    for ext in ('.png', '.jpg', '.jpeg', '.webp'):
        p = os.path.join(RAW, name + ext)
        if os.path.exists(p):
            return Image.open(p).convert('RGB')
    return None


def cover(img, w, h, focus=(0.5, 0.5), zoom=1.0):
    """Scaled to fill w x h (times zoom), cropped around focus (fractions of the picture)."""
    k = max(w / img.width, h / img.height) * zoom
    big = img.resize((max(w, round(img.width * k)), max(h, round(img.height * k))), Image.LANCZOS)
    x = min(max(0, round(big.width * focus[0] - w / 2)), big.width - w)
    y = min(max(0, round(big.height * focus[1] - h / 2)), big.height - h)
    return big.crop((x, y, x + w, y + h))


def heading(bg, title, sub, y, title_px=46, sub_px=22):
    d = ImageDraw.Draw(bg)
    f = font('fredoka-latin-700-normal.woff2', title_px)
    d.text(((bg.width - d.textlength(title, font=f)) / 2, y), title, font=f, fill='white')
    if sub:
        fs = font('fredoka-latin-600-normal.woff2', sub_px)
        d.text(((bg.width - d.textlength(sub, font=fs)) / 2, y + title_px * 1.2), sub, font=fs, fill=(214, 240, 225))


def chip(bg, xy, text, px=17):
    d = ImageDraw.Draw(bg)
    f = font('fredoka-latin-600-normal.woff2', px)
    w = d.textlength(text, font=f)
    x, y = xy
    padx, hgt = round(px * 0.7), round(px * 1.6)
    d.rounded_rectangle((x, y, x + w + padx * 2, y + hgt), hgt // 2, fill=(255, 255, 255))
    d.text((x + padx, y + hgt / 2), text, font=f, fill=(30, 30, 30), anchor='lm')


def keycaps(bg, keys, y, px=30):
    """Ctrl + Space, as keys, centered."""
    d = ImageDraw.Draw(bg)
    f = font('fredoka-latin-600-normal.woff2', px)
    widths = [d.textlength(k, font=f) + 30 for k in keys]
    gap = d.textlength('+', font=f) + 24
    x = (bg.width - sum(widths) - gap * (len(keys) - 1)) / 2
    for i, (k, w) in enumerate(zip(keys, widths)):
        d.rounded_rectangle((x, y, x + w, y + px + 20), 10, fill=(33, 120, 80), outline=(214, 240, 225), width=2)
        d.text((x + 15, y + 8), k, font=f, fill='white')
        x += w
        if i < len(keys) - 1:
            d.text((x + 12, y + 8), '+', font=f, fill=(214, 240, 225))
            x += gap


def tilted(bg, img, center, angle, under, under_angle, r=16, blur=12):
    """img with rounded corners, turned angle degrees, on a rounded card of color under that's
    turned a little differently, both centered on center."""
    pad = blur * 3
    w, h = img.width + 24, img.height + 24
    card = Image.new('RGBA', (w + pad * 2, h + pad * 2), (0, 0, 0, 0))
    ImageDraw.Draw(card).rounded_rectangle((pad, pad, pad + w, pad + h), r + 6, fill=under + (255,))
    card = card.rotate(under_angle, Image.BICUBIC, expand=True)
    sh = Image.new('RGBA', card.size, (0, 0, 0, 0))
    sh.putalpha(card.getchannel('A').point(lambda a: a * 100 // 255))
    sh = sh.filter(ImageFilter.GaussianBlur(blur))
    bg.alpha_composite(sh, (center[0] - sh.width // 2, center[1] - sh.height // 2 + blur // 2))
    bg.alpha_composite(card, (center[0] - card.width // 2, center[1] - card.height // 2))
    top = Image.new('RGBA', (img.width + pad * 2, img.height + pad * 2), (0, 0, 0, 0))
    top.alpha_composite(rounded(img, r), (pad, pad))
    top = top.rotate(angle, Image.BICUBIC, expand=True)
    sh = Image.new('RGBA', top.size, (0, 0, 0, 0))
    sh.putalpha(top.getchannel('A').point(lambda a: a * 90 // 255))
    sh = sh.filter(ImageFilter.GaussianBlur(blur // 2))
    bg.alpha_composite(sh, (center[0] - sh.width // 2, center[1] - sh.height // 2 + blur // 3))
    bg.alpha_composite(top, (center[0] - top.width // 2, center[1] - top.height // 2))


def slide_themes():
    shots = [(raw(n), label) for n, label in THEMES]
    if any(im is None for im, _ in shots):
        return None
    bg = gradient(1280, 800).convert('RGBA')
    heading(bg, 'Make it yours', 'Themes, fonts and backgrounds, light or dark', 22, 64, 30)
    # Zoomed in on the sidebar, greeting and first cards, so the page reads at this size. Each is
    # turned a little, on a card in its theme's color turned the other way.
    tw, th = 540, 268
    cards = [((340, 318), -3, (236, 120, 170), 2), ((940, 318), 2.5, (138, 180, 248), -1.5),
             ((340, 618), 2, (240, 150, 60), -2.5), ((940, 618), -2.5, (168, 224, 110), 1.5)]
    for (im, label), (c, ang, col, uang) in zip(shots, cards):
        tile = cover(im, tw, th, (0.3, 0.28), 1.55).convert('RGBA')
        chip(tile, (14, th - 52), label, 26)
        tilted(bg, tile, c, ang, col, uang)
    return bg.convert('RGB')


def slide_ai():
    pill, chat = raw('ai-pill'), raw('ai-chat')
    if pill is None or chat is None:
        return None
    bg = gradient(1280, 800).convert('RGBA')
    heading(bg, 'AI assistance', None, 22, 64)
    keycaps(bg, ['Ctrl', 'Space'], 108)
    pw, ph, y = 540, 486, 196
    # Ask anything sits in the middle of the page; the answer fills the panel.
    paste_shadowed(bg, cover(pill, pw, ph, (0.5, 0.5), 1.35), (60, y), 16, 12)
    paste_shadowed(bg, cover(chat, pw, ph, (0.5, 0.5), 1.2), (1280 - 60 - pw, y), 16, 12)
    d = ImageDraw.Draw(bg)
    cx, cy = 640, y + ph // 2
    d.ellipse((cx - 30, cy - 30, cx + 30, cy + 30), fill=(255, 255, 255, 245))
    d.polygon([(cx - 10, cy - 14), (cx + 14, cy), (cx - 10, cy + 14)], fill=TOP)
    f = font('fredoka-latin-600-normal.woff2', 24)
    note = 'Runs on your own OpenAI key. We never see it, or anything you ask.'
    d.text(((1280 - d.textlength(note, font=f)) / 2, y + ph + 26), note, font=f, fill=(214, 240, 225))
    return bg.convert('RGB')


def slide_pet(at=None):
    shot = raw('pet')
    if shot is None:
        return None
    bg = gradient(1280, 800).convert('RGBA')
    heading(bg, 'A pettable companion', 'that keeps you on track', 22, 64, 32)
    # Turned a little on a card, like the themes slide.
    sw, sh = 1100, 540
    x, y = (1280 - sw) // 2, 200
    # The class cards and the to-do list, without Canvas's sidebar (where the pet isn't).
    box = (round(shot.width * 0.172), round(shot.height * 0.14), shot.width, shot.height)
    tilted(bg, cover(shot.crop(box), sw, sh).convert('RGBA'), (640, y + sh // 2), -1.2, (236, 120, 170), 1.2)
    if at:
        # A closer look at the pet and its bubble: a circle at the bottom right, 2.4x the slide's scale.
        r = 150
        k = max(sw / (box[2] - box[0]), sh / (box[3] - box[1]))
        base = max(2 * r / shot.width, 2 * r / shot.height)
        z = cover(shot, 2 * r, 2 * r, (at[0] / shot.width, at[1] / shot.height), 2.4 * k / base).convert('RGBA')
        m = Image.new('L', (2 * r, 2 * r), 0)
        ImageDraw.Draw(m).ellipse((0, 0, 2 * r - 1, 2 * r - 1), fill=255)
        z.putalpha(m)
        cx, cy = x + sw - 2 * r - 24, y + sh - 2 * r - 24
        ring = Image.new('RGBA', (2 * r + 12, 2 * r + 12), (0, 0, 0, 0))
        ImageDraw.Draw(ring).ellipse((0, 0, 2 * r + 11, 2 * r + 11), fill=TOP + (255,))
        bg.alpha_composite(ring, (cx - 6, cy - 6))
        bg.alpha_composite(z, (cx, cy))
    return bg.convert('RGB')


def promo(w, h, name, tagline, shot_w, icon_px, title_px, tag_px, pad, show=0.82):
    bg = gradient(w, h).convert('RGBA')
    shot = Image.open(os.path.join(SHOTS, 'dashboard.jpg')).convert('RGB')
    sw = shot_w
    sh = round(shot.height * sw / shot.width)
    shot = shot.resize((sw, sh), Image.LANCZOS)
    # The screenshot runs off the right edge, a little below the middle.
    sx = w - int(sw * show)
    sy = int(h * 0.16)
    paste_shadowed(bg, shot, (sx, sy), max(6, sw // 60), max(6, sw // 50))
    # Fade the screenshot's left edge into the background so the words stay readable.
    fade = Image.new('L', (w, h), 0)
    fd = ImageDraw.Draw(fade)
    edge = sx + int(sw * 0.18)
    for x in range(w):
        a = 255 if x < sx else max(0, 255 - int(255 * (x - sx) / max(1, edge - sx)))
        fd.line((x, 0, x, h), fill=a)
    bg = Image.composite(gradient(w, h).convert('RGBA'), bg, fade)
    d = ImageDraw.Draw(bg)
    icon = Image.open(os.path.join(ROOT, 'icons', 'icon-128.png')).convert('RGBA').resize((icon_px, icon_px), Image.LANCZOS)
    ty = pad
    bg.alpha_composite(icon, (pad, ty))
    ty += icon_px + pad // 2
    f = font('fredoka-latin-700-normal.woff2', title_px)
    for line in name.split('\n'):
        d.text((pad, ty), line, font=f, fill='white')
        ty += int(title_px * 1.05)
    ty += pad // 4
    ft = font('fredoka-latin-600-normal.woff2', tag_px)
    for line in tagline.split('\n'):
        d.text((pad, ty), line, font=ft, fill=(214, 240, 225))
        ty += int(tag_px * 1.3)
    return bg.convert('RGB')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--name', default='Even Better Canvas')
    ap.add_argument('--pet-at', help='x,y of the pet in store/raw/pet (pixels) for a zoomed-in circle')
    a = ap.parse_args()
    os.makedirs(OUT, exist_ok=True)
    for f in os.listdir(OUT):
        if f.startswith('screenshot-'):
            os.remove(os.path.join(OUT, f))
    at = tuple(int(v) for v in a.pet_at.split(',')) if a.pet_at else None
    build = {'themes': slide_themes, 'ai': slide_ai, 'pet': lambda: slide_pet(at)}
    for i, (kind, fallback) in enumerate(SLIDES, 1):
        im = build[kind]() if kind else None
        name = kind if im is not None else fallback
        if im is None:
            im = Image.open(os.path.join(SHOTS, fallback + '.jpg')).convert('RGB').resize((1280, 800), Image.LANCZOS)
        im.save(os.path.join(OUT, f'screenshot-{i}-{name}.png'))
    two = '\n'.join(a.name.rsplit(' ', 1))
    promo(440, 280, two, 'Canvas, Classroom-style', 300, 40, 40, 20, 22, show=0.5).save(os.path.join(OUT, 'promo-small.png'))
    promo(1400, 560, two, 'Canvas, Classroom-style.\nWith AI that knows your classes.', 900, 84, 108, 44, 56, show=0.72).save(os.path.join(OUT, 'promo-marquee.png'))
    print('wrote', OUT)


if __name__ == '__main__':
    main()
