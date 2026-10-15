"""
bappy Budget App — Glassmorphic UI Redesign Mockups
Design system: "Deep Ocean Glass" — dark fintech with teal luminescence
"""

import math, os
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

# ── paths ────────────────────────────────────────────────────────────────────
FONTS_DIR = "C:/Users/paula/AppData/Roaming/Claude/local-agent-mode-sessions/skills-plugin/1f9007e1-ac49-40e2-98de-5dfc5c18c97f/685f4935-ba78-4412-b911-7bb70c1d9aea/skills/canvas-design/canvas-fonts"
OUT_DIR   = os.path.dirname(__file__)

def font(name, size):
    return ImageFont.truetype(os.path.join(FONTS_DIR, name), size)

# ── font aliases ─────────────────────────────────────────────────────────────
def F(size, bold=False):
    return font("BricolageGrotesque-Bold.ttf" if bold else "BricolageGrotesque-Regular.ttf", size)
def FM(size, bold=False):
    return font("GeistMono-Bold.ttf" if bold else "GeistMono-Regular.ttf", size)
def FI(size):
    return font("InstrumentSans-Regular.ttf", size)
def FB(size):
    return font("InstrumentSans-Bold.ttf", size)

# ── colour palette ────────────────────────────────────────────────────────────
BG1       = (10,  22, 40)       # deep navy
BG2       = (13,  42, 47)       # dark teal-navy
BG3       = ( 9,  24, 32)       # darkest
TEAL      = (  2, 168, 185)     # ocean teal
SEAFOAM   = (  3, 188, 165)     # seafoam green
AMBER     = (244, 165,  53)
CORAL     = (232,  86, 106)
WHITE     = (255, 255, 255)
WHITE55   = (255, 255, 255, 140)
WHITE30   = (255, 255, 255, 77)
WHITE15   = (255, 255, 255, 38)
GLASS_BG  = (255, 255, 255, 15)   # glass card fill
GLASS_BDR = (255, 255, 255, 40)   # glass border
DARK_CARD = ( 20,  38, 45, 220)   # opaque-ish dark card
TEXT_DIM  = (120, 160, 165)

# ── helpers ───────────────────────────────────────────────────────────────────

def lerp_color(c1, c2, t):
    return tuple(int(c1[i] + (c2[i]-c1[i])*t) for i in range(3))

def make_bg(w, h):
    """Deep ocean gradient background with glow spots."""
    arr = np.zeros((h, w, 3), dtype=np.uint8)
    for y in range(h):
        for x in range(w):
            tx = x/w; ty = y/h
            # base gradient: diagonal deep
            t = tx*0.4 + ty*0.6
            c = lerp_color(BG1, BG2, t)
            arr[y,x] = c
    img = Image.fromarray(arr, 'RGB')

    # teal glow — top centre
    glow = Image.new('RGBA', (w,h), (0,0,0,0))
    gd = ImageDraw.Draw(glow)
    for r in range(320, 0, -4):
        a = int(30 * (1 - r/320)**1.6)
        gd.ellipse([w//2-r, -r//2, w//2+r, r], fill=(*TEAL, a))
    img = Image.alpha_composite(img.convert('RGBA'), glow)

    # seafoam glow — bottom right
    glow2 = Image.new('RGBA', (w,h), (0,0,0,0))
    gd2 = ImageDraw.Draw(glow2)
    for r in range(260, 0, -4):
        a = int(18 * (1 - r/260)**1.8)
        gd2.ellipse([w-r, h-r, w+r//2, h+r//2], fill=(*SEAFOAM, a))
    img = Image.alpha_composite(img, glow2)

    return img.convert('RGB')

def rounded_rect_mask(w, h, radius):
    mask = Image.new('L', (w,h), 0)
    d = ImageDraw.Draw(mask)
    d.rounded_rectangle([0,0,w-1,h-1], radius=radius, fill=255)
    return mask

def glass_card(base_img, x, y, w, h, radius=16, tint_alpha=18, border_alpha=45,
               blur_sigma=18, glow_color=None):
    """Paste a glassmorphic card onto base_img (RGBA) in-place."""
    # crop region and blur it
    region = base_img.crop((x, y, x+w, y+h))
    blurred = region.filter(ImageFilter.GaussianBlur(blur_sigma))

    # tint overlay
    tint = Image.new('RGBA', (w,h), (255,255,255, tint_alpha))
    blurred_rgba = blurred.convert('RGBA')
    card = Image.alpha_composite(blurred_rgba, tint)

    # inner glow / top highlight
    glow_layer = Image.new('RGBA', (w,h), (0,0,0,0))
    gd = ImageDraw.Draw(glow_layer)
    # top edge highlight
    gd.rounded_rectangle([0,0,w-1,2], radius=1, fill=(255,255,255,60))
    if glow_color:
        for r in range(min(w,h)//3, 0, -3):
            a = int(12 * (1-r/(min(w,h)//3))**2)
            gd.ellipse([w//2-r, -r//2, w//2+r, r//2+4], fill=(*glow_color, a))
    card = Image.alpha_composite(card, glow_layer)

    # border
    border_layer = Image.new('RGBA', (w,h), (0,0,0,0))
    bd = ImageDraw.Draw(border_layer)
    bd.rounded_rectangle([0,0,w-1,h-1], radius=radius,
                         outline=(255,255,255, border_alpha), width=1)
    card = Image.alpha_composite(card, border_layer)

    # mask to rounded rect
    mask = rounded_rect_mask(w,h,radius)
    base_img.paste(card.convert('RGB'), (x,y), mask)

    return mask

def dark_card(base_img, x, y, w, h, radius=14):
    """Opaque dark gradient card."""
    card = Image.new('RGBA', (w,h), (0,0,0,0))
    arr = np.zeros((h,w,4), dtype=np.uint8)
    for cy in range(h):
        t = cy/h
        c = lerp_color((26,46,55),(18,32,38),t)
        arr[cy,:,:3] = c
        arr[cy,:,3] = 220
    card = Image.fromarray(arr,'RGBA')

    # diagonal teal shimmer
    shimmer = Image.new('RGBA',(w,h),(0,0,0,0))
    sd = ImageDraw.Draw(shimmer)
    for r in range(80,0,-4):
        a = int(14*(1-r/80)**1.4)
        sd.ellipse([w-r*2, -r, w, r], fill=(*TEAL,a))
    card = Image.alpha_composite(card, shimmer)

    # border
    bd_l = Image.new('RGBA',(w,h),(0,0,0,0))
    bdd = ImageDraw.Draw(bd_l)
    bdd.rounded_rectangle([0,0,w-1,h-1], radius=radius,
                          outline=(255,255,255,20), width=1)
    card = Image.alpha_composite(card, bd_l)

    mask = rounded_rect_mask(w,h,radius)
    base_img.paste(card.convert('RGB'),(x,y),mask)

def draw_text_shadow(draw, pos, text, font, fill, shadow_col=(0,0,0,80), offset=(1,2)):
    sx,sy = pos[0]+offset[0], pos[1]+offset[1]
    draw.text((sx,sy), text, font=font, fill=shadow_col[:3])
    draw.text(pos, text, font=font, fill=fill)

def sparkline(draw, pts, x, y, w, h, color=SEAFOAM, fill_alpha=60):
    """Draw a mini sparkline with gradient fill."""
    mn, mx = min(pts), max(pts)
    rng = mx-mn if mx!=mn else 1
    coords = [(x + i*(w/(len(pts)-1)), y + h - int((p-mn)/rng * h)) for i,p in enumerate(pts)]
    # fill polygon
    poly = list(coords) + [(x+w, y+h), (x, y+h)]
    overlay = Image.new('RGBA', draw.im.size, (0,0,0,0))
    od = ImageDraw.Draw(overlay)
    od.polygon(poly, fill=(*color, fill_alpha))
    draw._image.paste(Image.alpha_composite(draw._image.convert('RGBA'), overlay).convert('RGB'),
                       (0,0), Image.new('L', draw._image.size, 255))
    draw.line(coords, fill=color, width=2)

def donut(draw, cx, cy, outer_r, inner_r, segments, label_large, label_small):
    """Draw donut chart. segments = [(color, fraction), ...]"""
    start = -90  # start top
    for color, frac in segments:
        end = start + frac * 360
        # draw thick arc as pie minus inner circle
        draw.pieslice([cx-outer_r, cy-outer_r, cx+outer_r, cy+outer_r],
                      start=start, end=end, fill=color)
        start = end
    # punch inner circle
    draw.ellipse([cx-inner_r, cy-inner_r, cx+inner_r, cy+inner_r],
                 fill=None)  # will be covered by dark fill below
    # We'll handle the center label separately

def arc_progress(draw, cx, cy, r, thickness, fraction, color, bg_color=(255,255,255,20)):
    """Draw circular progress arc."""
    bbox = [cx-r, cy-r, cx+r, cy+r]
    # background arc
    draw.arc(bbox, start=-100, end=260, fill=(*bg_color[:3], 60), width=thickness)
    # progress arc
    end_angle = -100 + fraction * 360
    if fraction > 0.01:
        draw.arc(bbox, start=-100, end=end_angle, fill=color, width=thickness)

def progress_bar(draw, x, y, w, h, fraction, color, bg=(255,255,255,20), radius=3):
    # background
    draw.rounded_rectangle([x, y, x+w, y+h], radius=radius, fill=(30,50,55))
    # fill
    fw = max(int(w*fraction), 4)
    if fw > 0:
        draw.rounded_rectangle([x, y, x+fw, y+h], radius=radius, fill=color)

# ─────────────────────────────────────────────────────────────────────────────
#  SCREEN 1 — Desktop Dashboard (1440 × 900)
# ─────────────────────────────────────────────────────────────────────────────

def make_desktop_dashboard():
    W, H = 1440, 900
    img = make_bg(W, H).convert('RGBA')
    draw = ImageDraw.Draw(img)

    # ── sidebar ───────────────────────────────────────────────────────────────
    SB = 240
    # sidebar background — slightly distinct dark panel
    sb = Image.new('RGBA', (SB, H), (0,0,0,0))
    sb_arr = np.zeros((H, SB, 4), dtype=np.uint8)
    for y in range(H):
        c = lerp_color((8,20,32),(11,28,36),y/H)
        sb_arr[y,:,:3] = c
        sb_arr[y,:,3] = 200
    sb_img = Image.fromarray(sb_arr,'RGBA')
    # right edge subtle separator
    sb_bd = ImageDraw.Draw(sb_img)
    sb_bd.line([(SB-1,0),(SB-1,H)], fill=(255,255,255,18), width=1)
    img.paste(sb_img.convert('RGB'),(0,0), Image.new('L',(SB,H),200))

    # logo
    draw.ellipse([24,22,54,52], fill=(*TEAL,255))
    draw.ellipse([30,28,48,50], fill=(*BG1,255))
    draw.ellipse([34,32,44,46], fill=(*TEAL,200))
    draw.text((62,28), "bappy", font=FB(20), fill=WHITE)

    # nav items
    nav = [("Home","●"), ("Money","◆"), ("Plan","■"), ("Insights","▲"), ("More","⚙")]
    active = 0
    ny = 90
    for i,(label,icon) in enumerate(nav):
        if i == active:
            # active pill
            pill = Image.new('RGBA',(SB-32, 44),(0,0,0,0))
            pd = ImageDraw.Draw(pill)
            pd.rounded_rectangle([0,0,SB-33,43], radius=10, fill=(*TEAL,35))
            pd.rounded_rectangle([0,0,3,43], radius=2, fill=(*TEAL,255))
            img.paste(pill.convert('RGB'),(16,ny), rounded_rect_mask(SB-32,44,10))
            draw.text((56, ny+13), label, font=FB(15), fill=WHITE)
        else:
            draw.text((56, ny+13), label, font=F(15), fill=(*TEXT_DIM,200))
        ny += 56

    # user avatar
    draw.ellipse([20, H-70, 50, H-40], fill=(*TEAL,200))
    draw.text((27, H-64), "PA", font=FB(12), fill=WHITE)
    draw.text((60, H-66), "Paul A.", font=FB(13), fill=WHITE)
    draw.text((60, H-50), "paul@gmail.com", font=F(10), fill=(*TEXT_DIM,180))

    # ── main content area ─────────────────────────────────────────────────────
    MX = SB + 20   # margin left
    MW = W - SB - 300 - 24  # available width (minus right panel 280)
    MY = 24

    # greeting
    draw.text((MX, MY), "Good morning, Paul", font=FB(24), fill=WHITE)
    draw.text((MX, MY+32), "Wednesday, 28 May 2025  •  Next payday in 2 days", font=F(13), fill=(*TEXT_DIM,200))

    # ── KPI cards ─────────────────────────────────────────────────────────────
    KY = MY + 74
    KH = 118
    KW = (MW - 36)//4

    kpi_data = [
        ("Available to Spend", "£1,247.83", "until 30 May payday", SEAFOAM, "up"),
        ("Net Position",       "£4,891.20", "assets vs liabilities", TEAL,   "bar"),
        ("Monthly Spending",   "£2,103.45", "vs £2,500 budget • 84%",TEAL,   "ring"),
        ("Debt Free",          "14 months", "at current rate",       AMBER,  "bar2"),
    ]

    for i,(label,value,sub,accent,viz) in enumerate(kpi_data):
        kx = MX + i*(KW+12)
        glass_card(img, kx, KY, KW, KH, radius=14, tint_alpha=14)
        d = ImageDraw.Draw(img)
        d.text((kx+16, KY+14), label, font=F(11), fill=(*TEXT_DIM,210))
        d.text((kx+16, KY+32), value, font=FM(22, bold=True), fill=WHITE)
        d.text((kx+16, KY+62), sub, font=F(11), fill=(*TEXT_DIM,180))

        # mini viz
        vx, vy = kx+KW-68, KY+14
        if viz == "up":
            pts = [0.4,0.5,0.35,0.55,0.65,0.7,0.8,0.75,0.9]
            # draw sparkline
            mn,mx2=min(pts),max(pts)
            rng=mx2-mn
            sc = [(vx+j*7, vy+26 - int((p-mn)/rng*26)) for j,p in enumerate(pts)]
            d.line(sc, fill=SEAFOAM, width=2)
        elif viz == "bar":
            d.rounded_rectangle([vx,vy+8,vx+56,vy+16], radius=3, fill=(30,60,65))
            d.rounded_rectangle([vx,vy+8,vx+38,vy+16], radius=3, fill=SEAFOAM)
            d.rounded_rectangle([vx+38,vy+8,vx+56,vy+16], radius=3, fill=CORAL)
        elif viz == "ring":
            # arc progress
            arc_r = 22
            acx, acy = vx+24, vy+24
            arc_bbox = [acx-arc_r, acy-arc_r, acx+arc_r, acy+arc_r]
            d.arc(arc_bbox, start=-90, end=270, fill=(30,60,65), width=5)
            d.arc(arc_bbox, start=-90, end=-90+int(0.84*360), fill=TEAL, width=5)
            d.text((acx-10, acy-9), "84%", font=FM(9), fill=WHITE)
        elif viz == "bar2":
            for j in range(14):
                bx = vx + j*4
                bh = 16 if j < 4 else (12 if j < 10 else 8)
                bc = AMBER if j < 4 else (*TEXT_DIM,120)
                d.rounded_rectangle([bx, vy+26-bh, bx+2, vy+26], radius=1, fill=bc)

    # ── cash flow chart ───────────────────────────────────────────────────────
    CY = KY + KH + 16
    CH = 220
    CW = int(MW * 0.60)

    glass_card(img, MX, CY, CW, CH, radius=14, tint_alpha=10)
    d = ImageDraw.Draw(img)
    d.text((MX+16, CY+14), "Cash Flow Forecast", font=FB(15), fill=WHITE)
    # "90 days" pill
    pill_w = 62
    pill = Image.new('RGBA',(pill_w,22),(0,0,0,0))
    pd = ImageDraw.Draw(pill)
    pd.rounded_rectangle([0,0,pill_w-1,21], radius=11, fill=(*TEAL,40))
    pd.rounded_rectangle([0,0,pill_w-1,21], radius=11, outline=(*TEAL,80), width=1)
    img.paste(pill.convert('RGB'),(MX+CW-78, CY+12), rounded_rect_mask(pill_w,22,11))
    d = ImageDraw.Draw(img)
    d.text((MX+CW-70, CY+16), "90 days", font=F(10), fill=(*TEAL,230))

    # chart area
    cx0, cy0 = MX+16, CY+44
    cw, ch = CW-32, CH-64
    # grid lines
    for gi in range(5):
        gy = cy0 + gi*(ch//4)
        d.line([(cx0,gy),(cx0+cw,gy)], fill=(255,255,255,12), width=1)
    # x-axis labels
    months = ["Jun","Jul","Aug","Sep","Oct","Nov"]
    for mi,m in enumerate(months):
        gx = cx0 + mi*(cw//5)
        d.text((gx-8, cy0+ch+8), m, font=F(10), fill=(*TEXT_DIM,160))

    # area chart data
    data_pts = [0.45, 0.52, 0.40, 0.55, 0.68, 0.62, 0.72, 0.78, 0.74, 0.82,
                0.85, 0.80, 0.90, 0.88, 0.92, 0.95, 0.89, 0.96, 0.98, 1.0,
                0.95, 1.02, 1.0, 0.98]
    pts = [(cx0 + i*(cw//(len(data_pts)-1)), cy0 + ch - int(p*ch*0.85))
           for i,p in enumerate(data_pts)]

    # gradient fill — draw as overlay
    fill_ov = Image.new('RGBA', img.size, (0,0,0,0))
    fod = ImageDraw.Draw(fill_ov)
    poly = list(pts) + [(cx0+cw, cy0+ch),(cx0, cy0+ch)]
    fod.polygon(poly, fill=(*TEAL, 38))
    img = Image.alpha_composite(img.convert('RGBA'), fill_ov)
    d = ImageDraw.Draw(img)
    d.line(pts, fill=(*TEAL,230), width=2)

    # floor line
    floor_y = cy0 + int(ch * 0.75)
    d.line([(cx0, floor_y),(cx0+cw, floor_y)], fill=(*AMBER,120), width=1)
    # dashes
    for dxi in range(0, cw, 14):
        d.line([(cx0+dxi, floor_y),(cx0+dxi+7, floor_y)], fill=(*AMBER,160), width=1)
    d.text((cx0+cw-58, floor_y-14), "Floor £500", font=F(9), fill=(*AMBER,200))

    # ── donut chart ───────────────────────────────────────────────────────────
    DX = MX + CW + 16
    DW = MW - CW - 16
    glass_card(img, DX, CY, DW, CH, radius=14, tint_alpha=10)
    d = ImageDraw.Draw(img)
    d.text((DX+16, CY+14), "Spending by Category", font=FB(14), fill=WHITE)

    segs = [
        ((2,168,185), 0.31, "Groceries",    "£651"),
        ((3,188,165), 0.19, "Transport",    "£399"),
        ((244,165,53),0.22, "Bills",        "£462"),
        ((232,86,106),0.13, "Entertain.",   "£273"),
        ((18,60,70),  0.10, "Dining",       "£210"),
        ((80,110,115),0.05, "Other",        "£108"),
    ]
    dcx = DX + DW//2 - 10
    dcy = CY + 46 + 70
    outer_r, inner_r = 62, 38
    start = -90
    for color,frac,_,_ in segs:
        end_ang = start + frac*360
        d.pieslice([dcx-outer_r,dcy-outer_r,dcx+outer_r,dcy+outer_r],
                   start=start, end=end_ang, fill=color)
        start = end_ang
    # inner circle cover (dark)
    d.ellipse([dcx-inner_r,dcy-inner_r,dcx+inner_r,dcy+inner_r], fill=(16,34,42))
    d.text((dcx-24,dcy-14), "£2,103", font=FM(13,bold=True), fill=WHITE)
    d.text((dcx-22,dcy+4), "this month", font=F(9), fill=(*TEXT_DIM,180))

    # legend
    ly = CY + 170
    for i,(color,_,cat,amt) in enumerate(segs[:4]):
        lx = DX + 12 + (i%2)*(DW//2 - 6)
        row_y = ly + (i//2)*24
        d.ellipse([lx,row_y+3,lx+9,row_y+12], fill=color)
        d.text((lx+14, row_y), cat, font=F(9), fill=(*TEXT_DIM,200))
        d.text((lx+14, row_y+12), amt, font=FM(9,bold=True), fill=WHITE)

    # ── recent transactions ───────────────────────────────────────────────────
    TY = CY + CH + 16
    TH = H - TY - 20
    glass_card(img, MX, TY, MW, TH, radius=14, tint_alpha=10)
    d = ImageDraw.Draw(img)
    d.text((MX+16, TY+14), "Recent Transactions", font=FB(15), fill=WHITE)
    d.text((MX+MW-80, TY+14), "View all →", font=F(12), fill=(*TEAL,220))

    txns = [
        (CORAL,    "T", "Tesco Groceries", "Groceries",    "Yesterday", "-£54.20",  False),
        (SEAFOAM,  "£", "Salary",          "Income",       "24 May",    "+£3,200.00",True),
        (TEAL,     "N", "Netflix",         "Entertain.",   "22 May",    "-£15.99",  False),
        (AMBER,    "G", "Gym Membership",  "Health",       "21 May",    "-£35.00",  False),
        ((80,140,150),"C","Costa Coffee",  "Dining",       "21 May",    "-£4.75",   False),
    ]
    for ti,(icon_c,icon_t,name,cat,date,amt,income) in enumerate(txns):
        ty2 = TY + 44 + ti*((TH-52)//5)
        # separator
        if ti > 0:
            d.line([(MX+16,ty2-4),(MX+MW-16,ty2-4)], fill=(255,255,255,12), width=1)
        # icon circle
        d.ellipse([MX+16,ty2,MX+40,ty2+24], fill=(*icon_c,40))
        d.text((MX+21,ty2+4), icon_t, font=FB(11), fill=icon_c)
        # payee
        d.text((MX+50, ty2+2), name, font=FB(13), fill=WHITE)
        d.text((MX+50, ty2+17), cat, font=F(10), fill=(*TEXT_DIM,180))
        # date
        d.text((MX+MW//2, ty2+8), date, font=F(11), fill=(*TEXT_DIM,160))
        # amount
        amt_c = SEAFOAM if income else ((*TEXT_DIM,230) if not name=="Tesco Groceries" else CORAL)
        if income: amt_c = SEAFOAM
        elif name == "Tesco Groceries": amt_c = CORAL
        else: amt_c = (*TEXT_DIM,230)
        d.text((MX+MW-80, ty2+5), amt, font=FM(13,bold=income), fill=amt_c)

    # ── right panel ───────────────────────────────────────────────────────────
    RX = W - 288
    RY = 24
    RW = 268
    RH = H - 48

    glass_card(img, RX, RY, RW, RH, radius=16, tint_alpha=12, border_alpha=38)
    d = ImageDraw.Draw(img)
    d.text((RX+16, RY+16), "Upcoming Payments", font=FB(14), fill=WHITE)

    upcoming = [
        ("N","Netflix",    "£15.99", "2 days", CORAL),
        ("C","Council Tax","£145.00","4 days", AMBER),
        ("📱","Phone Bill", "£25.00", "6 days", (*TEXT_DIM,200)),
        ("G","Gym",        "£35.00", "8 days", (*TEXT_DIM,200)),
    ]
    for ui,(ico,name2,amt2,days,ac) in enumerate(upcoming):
        uy = RY + 50 + ui*54
        dark_card(img, RX+12, uy, RW-24, 44, radius=10)
        d = ImageDraw.Draw(img)
        d.text((RX+28, uy+8), ico, font=FB(12), fill=WHITE)
        d.text((RX+46, uy+6), name2, font=FB(12), fill=WHITE)
        d.text((RX+46, uy+22), days, font=F(10), fill=(*TEXT_DIM,180))
        d.text((RX+RW-60, uy+12), amt2, font=FM(12,bold=True), fill=ac if isinstance(ac,tuple) and len(ac)==3 else ac[:3] if isinstance(ac,tuple) else WHITE)

    # budgets section
    by = RY + 50 + 4*54 + 16
    d.text((RX+16, by), "Active Budgets", font=FB(13), fill=WHITE)
    budgets = [
        ("Groceries", 0.67, SEAFOAM),
        ("Dining",    0.91, AMBER),
        ("Bills",     0.45, TEAL),
    ]
    for bi,(blabel,bfrac,bc) in enumerate(budgets):
        bay = by + 28 + bi*36
        d.text((RX+16, bay), blabel, font=F(11), fill=(*TEXT_DIM,200))
        bpct = f"{int(bfrac*100)}%"
        d.text((RX+RW-40, bay), bpct, font=FM(10), fill=WHITE)
        progress_bar(d, RX+16, bay+16, RW-32, 6, bfrac, bc)

    # nudge card
    ny2 = by + 28 + 3*36 + 16
    if ny2 < RY + RH - 60:
        nudge = Image.new('RGBA',(RW-24,52),(0,0,0,0))
        nd = ImageDraw.Draw(nudge)
        nd.rounded_rectangle([0,0,RW-25,51], radius=10, fill=(*TEAL,25))
        nd.rounded_rectangle([0,0,RW-25,51], radius=10, outline=(*TEAL,60), width=1)
        img.paste(nudge.convert('RGB'),(RX+12,ny2), rounded_rect_mask(RW-24,52,10))
        d = ImageDraw.Draw(img)
        d.text((RX+28, ny2+10), "🔔", font=F(16), fill=(*TEAL,255))
        d.text((RX+52, ny2+8), "3 new insights", font=FB(12), fill=(*TEAL,255))
        d.text((RX+52, ny2+24), "Tap to review", font=F(10), fill=(*TEAL,160))

    final = img.convert('RGB')
    out_path = os.path.join(OUT_DIR, "01-desktop-dashboard.png")
    final.save(out_path, quality=96)
    print(f"Saved {out_path}")
    return final


# ─────────────────────────────────────────────────────────────────────────────
#  SCREEN 2 — Mobile Dashboard (390 × 844)  iPhone-size
# ─────────────────────────────────────────────────────────────────────────────

def make_mobile_home():
    W, H = 390, 844
    img = make_bg(W, H).convert('RGBA')
    draw = ImageDraw.Draw(img)

    # status bar
    draw.text((20,12), "9:41", font=FM(12,bold=True), fill=WHITE)
    draw.text((W-60,12), "●●●", font=F(10), fill=WHITE)

    # header
    draw.text((20, 44), "bappy", font=FB(22), fill=WHITE)
    # bell icon
    draw.ellipse([W-52, 42, W-28, 66], fill=(255,255,255,18))
    draw.text((W-46, 47), "🔔", font=F(14), fill=(*TEAL,230))

    # greeting
    draw.text((20, 78), "Good morning, Paul", font=FB(18), fill=WHITE)
    draw.text((20, 102), "Next payday in 2 days", font=F(12), fill=(*TEXT_DIM,200))

    # hero card — available to spend
    glass_card(img, 16, 126, W-32, 106, radius=18, tint_alpha=16, glow_color=TEAL)
    draw = ImageDraw.Draw(img)
    draw.text((32, 140), "Available to Spend", font=F(12), fill=(*TEXT_DIM,220))
    draw.text((32, 160), "£1,247.83", font=FM(34, bold=True), fill=WHITE)
    draw.text((32, 200), "until 30 May payday", font=F(12), fill=(*TEXT_DIM,180))
    # small sparkline
    pts = [0.3,0.5,0.42,0.6,0.55,0.7,0.78,0.85,0.9]
    sc = [(W-120 + i*11, 200 - int(p*30)) for i,p in enumerate(pts)]
    ov = Image.new('RGBA', img.size, (0,0,0,0))
    od = ImageDraw.Draw(ov)
    poly2 = list(sc)+[(sc[-1][0], 208),(sc[0][0], 208)]
    od.polygon(poly2, fill=(*SEAFOAM,45))
    img = Image.alpha_composite(img.convert('RGBA'), ov)
    draw = ImageDraw.Draw(img)
    draw.line(sc, fill=SEAFOAM, width=2)

    # KPI 2-col grid
    kpis = [
        ("Net Position", "£4,891", TEAL),
        ("Monthly Spend","£2,103", CORAL),
        ("Debt Free",    "14 mo.", AMBER),
        ("Savings",      "£8,240", SEAFOAM),
    ]
    kw = (W-40-10)//2
    kh = 82
    kstart_y = 250
    for ki,(label,val,color) in enumerate(kpis):
        kx = 16 + (ki%2)*(kw+10)
        ky = kstart_y + (ki//2)*(kh+10)
        glass_card(img, kx, ky, kw, kh, radius=14, tint_alpha=12)
        draw = ImageDraw.Draw(img)
        draw.text((kx+14, ky+12), label, font=F(10), fill=(*TEXT_DIM,200))
        draw.text((kx+14, ky+30), val, font=FM(19, bold=True), fill=WHITE)
        # accent dot
        draw.ellipse([kx+kw-20, ky+12, kx+kw-10, ky+22], fill=(*color,160))

    # cash flow mini section
    sfy = kstart_y + 2*(kh+10) + 16
    glass_card(img, 16, sfy, W-32, 130, radius=14, tint_alpha=10)
    draw = ImageDraw.Draw(img)
    draw.text((32, sfy+14), "Cash Flow", font=FB(13), fill=WHITE)
    draw.text((32, sfy+30), "90-day forecast", font=F(10), fill=(*TEXT_DIM,180))
    # chart
    cpts = [0.45,0.52,0.40,0.55,0.68,0.72,0.78,0.82,0.85,0.90,0.88,0.95]
    cx0,cy0,cw2,ch2 = 32,sfy+50,W-64,62
    scoords = [(cx0+i*(cw2//11), cy0+ch2-int(p*ch2*0.85)) for i,p in enumerate(cpts)]
    ov2 = Image.new('RGBA', img.size, (0,0,0,0))
    od2 = ImageDraw.Draw(ov2)
    poly3 = list(scoords)+[(cx0+cw2,cy0+ch2),(cx0,cy0+ch2)]
    od2.polygon(poly3, fill=(*TEAL,40))
    img = Image.alpha_composite(img.convert('RGBA'), ov2)
    draw = ImageDraw.Draw(img)
    draw.line(scoords, fill=(*TEAL,220), width=2)
    # floor
    fy2 = cy0 + int(ch2*0.72)
    for dx2 in range(0,cw2,10):
        draw.line([(cx0+dx2,fy2),(cx0+dx2+5,fy2)], fill=(*AMBER,100),width=1)

    # recent transactions preview
    ty3 = sfy + 130 + 12
    glass_card(img, 16, ty3, W-32, H-ty3-76, radius=14, tint_alpha=10)
    draw = ImageDraw.Draw(img)
    draw.text((32, ty3+12), "Recent", font=FB(13), fill=WHITE)
    draw.text((W-60, ty3+12), "All →", font=F(11), fill=(*TEAL,220))

    rtxns = [
        (CORAL, "Tesco",   "-£54.20",  False),
        (SEAFOAM,"Salary", "+£3,200", True),
        (TEAL,  "Netflix", "-£15.99",  False),
    ]
    for ri,(rc,rn,ra,rinc) in enumerate(rtxns):
        ry3 = ty3 + 40 + ri*42
        if ri>0: draw.line([(32,ry3-4),(W-32,ry3-4)],fill=(255,255,255,10),width=1)
        draw.ellipse([32,ry3,52,ry3+20],fill=(*rc,35))
        draw.text((36,ry3+3),rn[0],font=FB(10),fill=rc)
        draw.text((60,ry3+1),rn,font=FB(12),fill=WHITE)
        draw.text((60,ry3+16),"Yesterday",font=F(9),fill=(*TEXT_DIM,160))
        amc = SEAFOAM if rinc else TEXT_DIM
        draw.text((W-80,ry3+7),ra,font=FM(12,bold=rinc),fill=amc)

    # bottom tab bar
    tab_y = H - 68
    tab_bg = Image.new('RGBA',(W,68),(0,0,0,0))
    tb_arr = np.zeros((68,W,4),dtype=np.uint8)
    tb_arr[:,:,:3] = lerp_color((8,20,32),(11,28,36),0.5)
    tb_arr[:,:,3] = 210
    tab_bg = Image.fromarray(tb_arr,'RGBA')
    tbd = ImageDraw.Draw(tab_bg)
    tbd.line([(0,0),(W,0)],fill=(255,255,255,25),width=1)
    img.paste(tab_bg.convert('RGB'),(0,tab_y),Image.new('L',(W,68),210))
    draw = ImageDraw.Draw(img)

    tabs = ["Home","Money","Plan","Insights","More"]
    tw = W//5
    for ti2,tl in enumerate(tabs):
        tx2 = ti2*tw + tw//2
        tc = TEAL if ti2==0 else TEXT_DIM
        draw.text((tx2-18, tab_y+10), ["🏠","💳","📋","📊","⚙"][ti2], font=F(16), fill=tc)
        draw.text((tx2-len(tl)*3, tab_y+30), tl, font=F(8), fill=tc)
    # active dot
    draw.ellipse([tw//2-3, tab_y+4, tw//2+3, tab_y+10], fill=TEAL)

    final = img.convert('RGB')
    out = os.path.join(OUT_DIR,"02-mobile-home.png")
    final.save(out, quality=96)
    print(f"Saved {out}")
    return final


# ─────────────────────────────────────────────────────────────────────────────
#  SCREEN 3 — Mobile Accounts / Money (390 × 844)
# ─────────────────────────────────────────────────────────────────────────────

def make_mobile_accounts():
    W, H = 390, 844
    img = make_bg(W, H).convert('RGBA')
    draw = ImageDraw.Draw(img)

    # status bar
    draw.text((20,12), "9:41", font=FM(12,bold=True), fill=WHITE)

    # header
    draw.text((20, 44), "Accounts", font=FB(22), fill=WHITE)

    # net position hero card
    glass_card(img, 16, 82, W-32, 120, radius=18, tint_alpha=16, glow_color=TEAL)
    draw = ImageDraw.Draw(img)
    draw.text((32,96), "Net Position", font=F(12), fill=(*TEXT_DIM,220))
    draw.text((32,116), "£4,891.20", font=FM(30,bold=True), fill=WHITE)
    # bar
    bw = W-80
    draw.rounded_rectangle([32,158,32+bw,166], radius=4, fill=(30,60,65))
    draw.rounded_rectangle([32,158,32+int(bw*0.76),166], radius=4, fill=SEAFOAM)
    draw.text((32,170),"Cash  £6,240", font=F(10), fill=(*TEXT_DIM,180))
    draw.text((W-100,170),"Debt  -£1,349", font=F(10), fill=(*TEXT_DIM,180))

    # account groups
    accs = [
        ("CASH", [("Current Account","£2,040.50",SEAFOAM),("Savings","£4,199.50",TEAL)]),
        ("CREDIT CARDS", [("Barclaycard","−£649.30",CORAL),("AMEX","−£120.00",AMBER)]),
        ("LOANS", [("Car Loan","−£5,800.00",CORAL)]),
    ]
    ay = 220
    for group,items in accs:
        draw.text((20,ay),group,font=FI(10),fill=(*TEXT_DIM,160))
        ay+=20
        glass_card(img,16,ay,W-32,len(items)*60+8,radius=14,tint_alpha=12)
        draw = ImageDraw.Draw(img)
        for i,(aname,abal,ac) in enumerate(items):
            iy = ay + 8 + i*60
            if i>0:
                draw.line([(32,iy),(W-32,iy)],fill=(255,255,255,12),width=1)
            draw.ellipse([32,iy+10,52,iy+30],fill=(*ac,35))
            draw.text((36,iy+14),aname[0],font=FB(11),fill=ac)
            draw.text((60,iy+10),aname,font=FB(13),fill=WHITE)
            draw.text((60,iy+26),"View details →",font=F(10),fill=(*TEXT_DIM,160))
            c2 = CORAL if abal.startswith("−") or abal.startswith("-") else SEAFOAM
            draw.text((W-100,iy+17),abal,font=FM(13,bold=True),fill=c2)
        ay += len(items)*60 + 8 + 16

    # FAB
    fab_w = 56
    fab = Image.new('RGBA',(fab_w,fab_w),(0,0,0,0))
    fd = ImageDraw.Draw(fab)
    # gradient circle
    for r in range(fab_w//2,0,-1):
        t = 1 - r/(fab_w//2)
        c = lerp_color(TEAL,SEAFOAM,t)
        fd.ellipse([fab_w//2-r,fab_w//2-r,fab_w//2+r,fab_w//2+r],fill=c)
    fd.text((fab_w//2-6,fab_w//2-8),"+",font=FB(22),fill=WHITE)
    img.paste(fab.convert('RGB'),(W-72,H-140),rounded_rect_mask(fab_w,fab_w,fab_w//2))
    draw = ImageDraw.Draw(img)

    # tab bar
    tab_y = H-68
    tab_bg_arr = np.zeros((68,W,4),dtype=np.uint8)
    tab_bg_arr[:,:,:3]=lerp_color((8,20,32),(11,28,36),0.5)
    tab_bg_arr[:,:,3]=210
    tab_bg2 = Image.fromarray(tab_bg_arr,'RGBA')
    tb2d = ImageDraw.Draw(tab_bg2)
    tb2d.line([(0,0),(W,0)],fill=(255,255,255,25),width=1)
    img.paste(tab_bg2.convert('RGB'),(0,tab_y),Image.new('L',(W,68),210))
    draw = ImageDraw.Draw(img)
    tabs = ["Home","Money","Plan","Insights","More"]
    tw = W//5
    for ti2,tl in enumerate(tabs):
        tx2 = ti2*tw + tw//2
        tc = TEAL if ti2==1 else TEXT_DIM
        draw.text((tx2-18,tab_y+10),["🏠","💳","📋","📊","⚙"][ti2],font=F(16),fill=tc)
        draw.text((tx2-len(tl)*3,tab_y+30),tl,font=F(8),fill=tc)
    draw.ellipse([tw+tw//2-3,tab_y+4,tw+tw//2+3,tab_y+10],fill=TEAL)

    final = img.convert('RGB')
    out = os.path.join(OUT_DIR,"03-mobile-accounts.png")
    final.save(out, quality=96)
    print(f"Saved {out}")
    return final


# ─────────────────────────────────────────────────────────────────────────────
#  SCREEN 4 — Tablet Dashboard (768 × 1024)
# ─────────────────────────────────────────────────────────────────────────────

def make_tablet_insights():
    W, H = 768, 1024
    img = make_bg(W, H).convert('RGBA')
    draw = ImageDraw.Draw(img)

    # status bar
    draw.text((20,14), "9:41", font=FM(12,bold=True), fill=WHITE)
    draw.text((W-80,14), "●●●  100%", font=F(10), fill=WHITE)

    # header
    draw.text((20, 50), "Insights", font=FB(26), fill=WHITE)
    draw.text((20, 82), "Your financial health overview", font=F(14), fill=(*TEXT_DIM,200))

    # top KPI row — 4 cards
    KH = 96
    KW = (W-48-3*12)//4
    kpis2 = [
        ("Available",  "£1,247", SEAFOAM),
        ("Spending",   "£2,103", TEAL),
        ("Net Worth",  "£14,891",AMBER),
        ("Debt Free",  "14 mo.", CORAL),
    ]
    for ki,(lbl,val,col) in enumerate(kpis2):
        kx = 20 + ki*(KW+12)
        glass_card(img,kx,116,KW,KH,radius=14,tint_alpha=14)
        draw = ImageDraw.Draw(img)
        draw.text((kx+12,116+12),lbl,font=F(11),fill=(*TEXT_DIM,210))
        draw.text((kx+12,116+32),val,font=FM(20,bold=True),fill=WHITE)
        draw.ellipse([kx+KW-22,116+14,kx+KW-8,116+28],fill=(*col,160))

    # ── spending donut (left) + bar chart (right)
    ROW2Y = 116 + KH + 16
    ROW2H = 280
    # donut panel
    DW2 = (W-48)//2
    glass_card(img,20,ROW2Y,DW2,ROW2H,radius=14,tint_alpha=10)
    draw = ImageDraw.Draw(img)
    draw.text((36,ROW2Y+14),"Spending by Category",font=FB(14),fill=WHITE)

    segs2=[
        (TEAL,   0.31,"Groceries","£651"),
        (SEAFOAM,0.19,"Transport","£399"),
        (AMBER,  0.22,"Bills",    "£462"),
        (CORAL,  0.13,"Entertain","£273"),
        ((30,80,90),0.10,"Dining","£210"),
        (TEXT_DIM, 0.05,"Other", "£108"),
    ]
    dcx2=20+DW2//2; dcy2=ROW2Y+50+90
    or2,ir2=80,50
    start2=-90
    for col2,frac2,_,_ in segs2:
        end2=start2+frac2*360
        draw.pieslice([dcx2-or2,dcy2-or2,dcx2+or2,dcy2+or2],start=start2,end=end2,fill=col2)
        start2=end2
    draw.ellipse([dcx2-ir2,dcy2-ir2,dcx2+ir2,dcy2+ir2],fill=(16,34,42))
    draw.text((dcx2-28,dcy2-14),"£2,103",font=FM(15,bold=True),fill=WHITE)
    draw.text((dcx2-26,dcy2+6),"this month",font=F(10),fill=(*TEXT_DIM,180))

    # legend 2-col
    ly2=ROW2Y+ROW2H-80
    for i,(col2,_,cat2,amt2) in enumerate(segs2):
        lx2=(20+14)+(i%2)*((DW2)//2-10)
        ly3=ly2+(i//2)*22
        draw.ellipse([lx2,ly3+4,lx2+9,ly3+13],fill=col2)
        draw.text((lx2+14,ly3),cat2,font=F(9),fill=(*TEXT_DIM,200))
        draw.text((lx2+14,ly3+12),amt2,font=FM(9,bold=True),fill=WHITE)

    # bar chart panel — 6-month summary
    BX=20+DW2+16; BW=DW2
    glass_card(img,BX,ROW2Y,BW,ROW2H,radius=14,tint_alpha=10)
    draw=ImageDraw.Draw(img)
    draw.text((BX+14,ROW2Y+14),"6-Month Summary",font=FB(14),fill=WHITE)

    months2=["Dec","Jan","Feb","Mar","Apr","May"]
    income2=[3200,3200,3800,3200,3200,3200]
    expense2=[2400,2600,2100,2800,2500,2103]
    bw2=(BW-40)//(len(months2))
    chart_h=160; chart_y=ROW2Y+50
    max_val=max(max(income2),max(expense2))
    for mi2,(m,inc,exp) in enumerate(zip(months2,income2,expense2)):
        bx2=BX+20+mi2*bw2
        # income bar
        ih2=int(inc/max_val*chart_h)
        draw.rounded_rectangle([bx2+4,chart_y+chart_h-ih2,bx2+bw2//2-2,chart_y+chart_h],
                                radius=3,fill=(*SEAFOAM,160))
        # expense bar
        eh2=int(exp/max_val*chart_h)
        draw.rounded_rectangle([bx2+bw2//2,chart_y+chart_h-eh2,bx2+bw2-4,chart_y+chart_h],
                                radius=3,fill=(*CORAL,120))
        draw.text((bx2+4,chart_y+chart_h+8),m,font=F(9),fill=(*TEXT_DIM,160))

    # net line
    net_pts=[(BX+20+mi2*bw2+bw2//2,
              chart_y+chart_h-int((inc-exp)/max_val*chart_h)-4)
             for mi2,(inc,exp) in enumerate(zip(income2,expense2))]
    draw.line(net_pts,fill=(*TEAL,200),width=2)
    for nx2,ny3 in net_pts:
        draw.ellipse([nx2-3,ny3-3,nx2+3,ny3+3],fill=TEAL)

    # legend
    draw.ellipse([BX+14,ROW2Y+ROW2H-30,BX+22,ROW2Y+ROW2H-22],fill=(*SEAFOAM,180))
    draw.text((BX+26,ROW2Y+ROW2H-32),"Income",font=F(10),fill=(*TEXT_DIM,200))
    draw.ellipse([BX+80,ROW2Y+ROW2H-30,BX+88,ROW2Y+ROW2H-22],fill=(*CORAL,160))
    draw.text((BX+92,ROW2Y+ROW2H-32),"Expenses",font=F(10),fill=(*TEXT_DIM,200))
    draw.line([(BX+150,ROW2Y+ROW2H-26),(BX+162,ROW2Y+ROW2H-26)],fill=TEAL,width=2)
    draw.text((BX+166,ROW2Y+ROW2H-32),"Net",font=F(10),fill=(*TEXT_DIM,200))

    # ── cash flow forecast full width
    CFFY = ROW2Y + ROW2H + 16
    CFFH = 230
    glass_card(img,20,CFFY,W-40,CFFH,radius=14,tint_alpha=10)
    draw=ImageDraw.Draw(img)
    draw.text((36,CFFY+14),"90-Day Cash Flow Forecast",font=FB(15),fill=WHITE)
    pill2=Image.new('RGBA',(70,22),(0,0,0,0))
    p2d=ImageDraw.Draw(pill2)
    p2d.rounded_rectangle([0,0,69,21],radius=11,fill=(*TEAL,40))
    p2d.rounded_rectangle([0,0,69,21],radius=11,outline=(*TEAL,80),width=1)
    img.paste(pill2.convert('RGB'),(W-90,CFFY+12),rounded_rect_mask(70,22,11))
    draw=ImageDraw.Draw(img)
    draw.text((W-82,CFFY+15),"90 days",font=F(10),fill=(*TEAL,230))

    cx3,cy3,cw3,ch3=36,CFFY+46,W-72,CFFH-66
    for gi in range(5):
        gy=cy3+gi*(ch3//4)
        draw.line([(cx3,gy),(cx3+cw3,gy)],fill=(255,255,255,10),width=1)
    months3=["Jun","Jul","Aug","Sep","Oct","Nov"]
    for mi,m in enumerate(months3):
        gx=cx3+mi*(cw3//5)
        draw.text((gx-8,cy3+ch3+8),m,font=F(10),fill=(*TEXT_DIM,160))
    dpts=[0.45,0.52,0.40,0.55,0.68,0.62,0.72,0.78,0.74,0.82,0.85,0.80,0.90,0.88,0.92,0.95,0.89,0.96,0.98,1.0,0.95,1.02,1.0,0.98]
    cpts2=[(cx3+i*(cw3//(len(dpts)-1)),cy3+ch3-int(p*ch3*0.85)) for i,p in enumerate(dpts)]
    ov3=Image.new('RGBA',img.size,(0,0,0,0))
    od3=ImageDraw.Draw(ov3)
    poly4=list(cpts2)+[(cx3+cw3,cy3+ch3),(cx3,cy3+ch3)]
    od3.polygon(poly4,fill=(*TEAL,35))
    img=Image.alpha_composite(img.convert('RGBA'),ov3)
    draw=ImageDraw.Draw(img)
    draw.line(cpts2,fill=(*TEAL,220),width=2)
    fy3=cy3+int(ch3*0.75)
    for dxi in range(0,cw3,14):
        draw.line([(cx3+dxi,fy3),(cx3+dxi+7,fy3)],fill=(*AMBER,140),width=1)
    draw.text((cx3+cw3-60,fy3-14),"Floor £500",font=F(9),fill=(*AMBER,200))

    # budget progress section
    BPY=CFFY+CFFH+16
    BPH=H-BPY-88
    glass_card(img,20,BPY,W-40,BPH,radius=14,tint_alpha=10)
    draw=ImageDraw.Draw(img)
    draw.text((36,BPY+14),"Budget Overview",font=FB(14),fill=WHITE)
    budgets2=[
        ("Groceries","£481 of £700 spent",0.69,SEAFOAM),
        ("Dining","£273 of £300 spent",0.91,AMBER),
        ("Transport","£185 of £400 spent",0.46,TEAL),
        ("Entertainment","£210 of £200 — over",1.05,CORAL),
    ]
    bpw=(W-80)//2
    for bi,(blabel2,bsub,bfrac2,bc2) in enumerate(budgets2):
        bx3=36+(bi%2)*(bpw+8)
        by3=BPY+44+(bi//2)*68
        draw.text((bx3,by3),blabel2,font=FB(12),fill=WHITE)
        draw.text((bx3,by3+16),bsub,font=F(10),fill=(*TEXT_DIM,180))
        frac_c = min(bfrac2,1.0)
        progress_bar(draw,bx3,by3+32,bpw-8,7,frac_c,bc2)
        pct=f"{int(bfrac2*100)}%"
        draw.text((bx3+bpw-35,by3+28),pct,font=FM(10),fill=bc2 if bfrac2<=1 else CORAL)

    # tab bar
    tab_y2=H-70
    tba2=np.zeros((70,W,4),dtype=np.uint8)
    tba2[:,:,:3]=lerp_color((8,20,32),(11,28,36),0.5)
    tba2[:,:,3]=210
    tbi2=Image.fromarray(tba2,'RGBA')
    tbd2=ImageDraw.Draw(tbi2)
    tbd2.line([(0,0),(W,0)],fill=(255,255,255,25),width=1)
    img.paste(tbi2.convert('RGB'),(0,tab_y2),Image.new('L',(W,70),210))
    draw=ImageDraw.Draw(img)
    tw2=W//5
    tabs2=["Home","Money","Plan","Insights","More"]
    for ti3,tl2 in enumerate(tabs2):
        tx3=ti3*tw2+tw2//2
        tc2=TEAL if ti3==3 else TEXT_DIM
        draw.text((tx3-18,tab_y2+10),["🏠","💳","📋","📊","⚙"][ti3],font=F(18),fill=tc2)
        draw.text((tx3-len(tl2)*3,tab_y2+34),tl2,font=F(9),fill=tc2)
    draw.ellipse([3*tw2+tw2//2-3,tab_y2+4,3*tw2+tw2//2+3,tab_y2+10],fill=TEAL)

    final=img.convert('RGB')
    out=os.path.join(OUT_DIR,"04-tablet-insights.png")
    final.save(out,quality=96)
    print(f"Saved {out}")
    return final


# ─────────────────────────────────────────────────────────────────────────────
#  SCREEN 5 — Mobile Add Transaction Sheet (390 × 844)
# ─────────────────────────────────────────────────────────────────────────────

def make_mobile_add_txn():
    W, H = 390, 844
    img = make_bg(W, H).convert('RGBA')
    draw = ImageDraw.Draw(img)

    # dimmed bg content behind sheet
    dim = Image.new('RGBA',(W,H),(0,0,0,100))
    img = Image.alpha_composite(img.convert('RGBA'), dim)
    draw = ImageDraw.Draw(img)

    # sheet
    SH = 680
    sy = H - SH
    sheet = Image.new('RGBA',(W,SH),(0,0,0,0))
    sa = np.zeros((SH,W,4),dtype=np.uint8)
    for y in range(SH):
        c = lerp_color((14,30,38),(10,24,32),y/SH)
        sa[y,:,:3] = c
        sa[y,:,3] = 245
    sheet_img = Image.fromarray(sa,'RGBA')
    # top border
    sbd = ImageDraw.Draw(sheet_img)
    sbd.rounded_rectangle([0,0,W-1,SH-1],radius=24,outline=(255,255,255,30),width=1)
    # handle
    sbd.rounded_rectangle([W//2-20,12,W//2+20,17],radius=3,fill=(255,255,255,60))
    mask2 = rounded_rect_mask(W,SH,24)
    img.paste(sheet_img.convert('RGB'),(0,sy),mask2)
    draw = ImageDraw.Draw(img)

    # sheet header
    draw.text((20,sy+28),"Add Transaction",font=FB(18),fill=WHITE)
    draw.text((W-44,sy+28),"✕",font=FB(18),fill=(*TEXT_DIM,200))

    # segment: expense / income / transfer
    seg_y = sy+62
    seg_labels = ["Expense","Income","Transfer"]
    seg_w = (W-40)//3
    for si,sl in enumerate(seg_labels):
        sx2 = 20+si*seg_w
        is_active = si==0
        if is_active:
            pill3=Image.new('RGBA',(seg_w-4,36),(0,0,0,0))
            p3d=ImageDraw.Draw(pill3)
            p3d.rounded_rectangle([0,0,seg_w-5,35],radius=10,fill=(*CORAL,50))
            p3d.rounded_rectangle([0,0,seg_w-5,35],radius=10,outline=(*CORAL,100),width=1)
            img.paste(pill3.convert('RGB'),(sx2+2,seg_y),rounded_rect_mask(seg_w-4,36,10))
            draw=ImageDraw.Draw(img)
            draw.text((sx2+seg_w//2-22,seg_y+9),sl,font=FB(12),fill=CORAL)
        else:
            draw.text((sx2+seg_w//2-18,seg_y+9),sl,font=F(12),fill=(*TEXT_DIM,180))

    # amount display
    draw.text((W//2-60,seg_y+52),"£",font=FB(32),fill=(*TEXT_DIM,160))
    draw.text((W//2-30,seg_y+44),"54.20",font=FM(44,bold=True),fill=WHITE)
    # cursor
    draw.line([(W//2+64,seg_y+48),(W//2+64,seg_y+88)],fill=TEAL,width=2)

    # form fields
    fy4 = seg_y+120
    fields = [
        ("Description","Tesco Groceries"),
        ("Category","🛒  Groceries"),
        ("Account","💳  Current Account"),
        ("Date","28 May 2025"),
    ]
    for fi,(flabel,fval) in enumerate(fields):
        fx=20; fw2=W-40; fh2=52
        ffy=fy4+fi*(fh2+10)
        glass_card(img,fx,ffy,fw2,fh2,radius=12,tint_alpha=14)
        draw=ImageDraw.Draw(img)
        draw.text((fx+16,ffy+8),flabel,font=F(10),fill=(*TEXT_DIM,180))
        draw.text((fx+16,ffy+26),fval,font=FB(13),fill=WHITE)
        if fi>0:
            draw.text((fx+fw2-24,ffy+20),"›",font=FB(18),fill=(*TEXT_DIM,160))

    # save button
    btn_y = H-76
    btn = Image.new('RGBA',(W-40,54),(0,0,0,0))
    bd3 = ImageDraw.Draw(btn)
    # gradient
    for bx4 in range(W-40):
        t = bx4/(W-40)
        c = lerp_color(TEAL,SEAFOAM,t)
        bd3.line([(bx4,0),(bx4,53)],fill=c)
    img.paste(btn.convert('RGB'),(20,btn_y),rounded_rect_mask(W-40,54,14))
    draw=ImageDraw.Draw(img)
    draw.text((W//2-44,btn_y+14),"Save Transaction",font=FB(16),fill=WHITE)

    # tab bar
    tab_y3=H-68
    tba3=np.zeros((68,W,4),dtype=np.uint8)
    tba3[:,:,:3]=lerp_color((8,20,32),(11,28,36),0.5)
    tba3[:,:,3]=180
    tbi3=Image.fromarray(tba3,'RGBA')
    img.paste(tbi3.convert('RGB'),(0,tab_y3),Image.new('L',(W,68),180))

    final=img.convert('RGB')
    out=os.path.join(OUT_DIR,"05-mobile-add-transaction.png")
    final.save(out,quality=96)
    print(f"Saved {out}")
    return final


# ─────────────────────────────────────────────────────────────────────────────
#  RUN ALL
# ─────────────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    print("Generating bappy redesign mockups...")
    make_desktop_dashboard()
    make_mobile_home()
    make_mobile_accounts()
    make_tablet_insights()
    make_mobile_add_txn()
    print("\nAll mockups saved to:", OUT_DIR)
