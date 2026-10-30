# Builds the Chrome Web Store images from docs/screenshots and icons/:
#   store/images/screenshot-*.png   1280x800 (the store's size)
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
OUT = os.path.join(ROOT, 'store', 'images')

# In store order: the first one is what people see first.
SCREENSHOTS = ['dashboard', 'course-home', 'assignment', 'ask', 'file-viewer']

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
    ap.add_argument('--name', default='Canvas Classroom')
    a = ap.parse_args()
    os.makedirs(OUT, exist_ok=True)
    for i, n in enumerate(SCREENSHOTS, 1):
        im = Image.open(os.path.join(SHOTS, n + '.jpg')).convert('RGB').resize((1280, 800), Image.LANCZOS)
        im.save(os.path.join(OUT, f'screenshot-{i}-{n}.png'))
    two = a.name.replace(' ', '\n', 1)
    promo(440, 280, two, 'Canvas, Classroom-style', 320, 40, 32, 15, 22, show=0.6).save(os.path.join(OUT, 'promo-small.png'))
    promo(1400, 560, two, 'Canvas, Classroom-style.\nWith an AI and a pet.', 1000, 96, 92, 36, 64).save(os.path.join(OUT, 'promo-marquee.png'))
    print('wrote', OUT)


if __name__ == '__main__':
    main()
