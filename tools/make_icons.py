# 產生 PWA 圖示（範本版：主色底＋圓角紙卡＋工具代表字）。可依畫風改成程式自繪的圖案。
import os
from PIL import Image, ImageDraw, ImageFont

MAIN, PAPER, INK, GLYPH = '#33363B', '#FFFFFF', '#33363B', '班'
out = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'icons')
os.makedirs(out, exist_ok=True)
FONT = None
for f in (r'C:\Windows\Fonts\msjhbd.ttc', r'C:\Windows\Fonts\msjh.ttc'):
    if os.path.exists(f): FONT = f; break


def draw(size, pad):
    s = 4 * size
    im = Image.new('RGB', (s, s), MAIN)
    d = ImageDraw.Draw(im)
    x0, x1 = pad * s, (1 - pad) * s
    w = x1 - x0
    d.rounded_rectangle([x0, x0, x1, x1], radius=w * .18, fill=PAPER)
    font = ImageFont.truetype(FONT, int(w * .62)) if FONT else ImageFont.load_default()
    d.text((s / 2, s / 2), GLYPH, fill=INK, font=font, anchor='mm')
    return im.resize((size, size), Image.LANCZOS)


draw(192, .1).save(os.path.join(out, 'icon-192.png'))
draw(512, .1).save(os.path.join(out, 'icon-512.png'))
draw(512, .2).save(os.path.join(out, 'icon-maskable-512.png'))
print('ok')
