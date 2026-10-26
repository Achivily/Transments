"""Draws the app icon (Apple-style squircle, blue gradient, swap arrows) into icons/."""
import os, sys
from PIL import Image, ImageDraw

S = 1024
out_dir = sys.argv[1] if len(sys.argv) > 1 else 'icons'
os.makedirs(out_dir, exist_ok=True)

top, bottom = (64, 156, 255), (88, 86, 214)
grad = Image.new('RGBA', (S, S))
px = grad.load()
for y in range(S):
    t = y / (S - 1)
    c = tuple(round(top[i] + (bottom[i] - top[i]) * t) for i in range(3)) + (255,)
    for x in range(S):
        px[x, y] = c

mask = Image.new('L', (S, S), 0)
m = 100
ImageDraw.Draw(mask).rounded_rectangle([m, m, S - m, S - m], radius=int((S - 2 * m) * 0.225), fill=255)
icon = Image.new('RGBA', (S, S), (0, 0, 0, 0))
icon.paste(grad, (0, 0), mask)

d = ImageDraw.Draw(icon)
w = 46
white = (255, 255, 255, 255)
# upper arrow pointing right
d.line([(300, 420), (700, 420)], fill=white, width=w)
d.polygon([(735, 420), (620, 330), (620, 510)], fill=white)
# lower arrow pointing left
d.line([(324, 604), (724, 604)], fill=white, width=w)
d.polygon([(289, 604), (404, 514), (404, 694)], fill=white)

icon.save(os.path.join(out_dir, 'icon.png'))
for size in (32, 128, 256):
    icon.resize((size, size), Image.LANCZOS).save(os.path.join(out_dir, f'{size}x{size}.png'))
icon.save(os.path.join(out_dir, 'icon.ico'), sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
