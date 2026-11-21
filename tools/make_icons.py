# 產生 PWA 圖示：鋼板底＋鉚釘＋三排彩色磁鐵班表條（最後一格紅色圓磁鐵）
import os
from PIL import Image, ImageDraw

out = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'icons')
os.makedirs(out, exist_ok=True)
COLS = ['#E4572E', '#2E86AB', '#E9A23B', '#3BA272']


def draw(size, pad):
    s = 4 * size
    im = Image.new('RGB', (s, s), '#3A3F46')
    d = ImageDraw.Draw(im)
    x0, x1 = pad * s, (1 - pad) * s
    w = x1 - x0
    d.rounded_rectangle([x0, x0, x1, x1], radius=w * .1, fill='#DADDE1')
    for i in range(0, int(w), max(2, int(s * .012))):   # 髮絲紋
        d.line([x0 + i, x0 + w * .03, x0 + i, x1 - w * .03], fill='#D0D4D8', width=1)
    r = w * .03
    for cx, cy in ((x0 + w * .07, x0 + w * .07), (x1 - w * .07, x0 + w * .07), (x0 + w * .07, x1 - w * .07), (x1 - w * .07, x1 - w * .07)):
        d.ellipse([cx - r, cy - r, cx + r, cy + r], fill='#8A9098')
    # 三排磁鐵條
    rows = [[0, 1, None, 2], [1, None, 3, 0], [2, 0, 1, None]]
    cw, ch, gx, gy = w * .16, w * .17, w * .045, w * .08
    sx, sy = x0 + w * .13, x0 + w * .2
    for ri, row in enumerate(rows):
        for ci, c in enumerate(row):
            bx, by = sx + ci * (cw + gx), sy + ri * (ch + gy)
            if c is None:
                d.rounded_rectangle([bx, by, bx + cw, by + ch], radius=w * .025, outline='#A3A8AF', width=int(s * .006))
            else:
                d.rounded_rectangle([bx, by + w * .012, bx + cw, by + ch + w * .012], radius=w * .025, fill='#2A2D31')
                d.rounded_rectangle([bx, by, bx + cw, by + ch], radius=w * .025, fill=COLS[c])
    # 紅色圓磁鐵
    cx, cy, rr = x1 - w * .2, x1 - w * .2, w * .11
    d.ellipse([cx - rr, cy - rr + w * .015, cx + rr, cy + rr + w * .015], fill='#2A2D31')
    d.ellipse([cx - rr, cy - rr, cx + rr, cy + rr], fill='#C0392B')
    d.ellipse([cx - rr * .45, cy - rr * .6, cx - rr * .05, cy - rr * .25], fill='#E8806F')
    return im.resize((size, size), Image.LANCZOS)


draw(192, .08).save(os.path.join(out, 'icon-192.png'))
draw(512, .08).save(os.path.join(out, 'icon-512.png'))
draw(512, .18).save(os.path.join(out, 'icon-maskable-512.png'))
print('ok')
