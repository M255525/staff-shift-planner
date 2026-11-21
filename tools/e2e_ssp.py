# 端對端測試：python tools/e2e_ssp.py [截圖資料夾]
# 自己在 port 8916 起靜態伺服器（不佔用正式預覽的 8906）
# 範本產生的部分只驗標準配備；這個工具自己的功能測試加在「主功能」那段。
import sys, io, os, json, subprocess, time, urllib.request
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', line_buffering=True)
from playwright.sync_api import sync_playwright

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
SHOTS = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'tools', '_shots')
os.makedirs(SHOTS, exist_ok=True)
PORT = 8916
BASE = 'http://127.0.0.1:%d/' % PORT
fails = []
def ok(name, cond, extra=''):
    print(('✓ ' if cond else '✗ ') + name + (('  ' + str(extra)) if extra and not cond else ''))
    if not cond: fails.append(name)

srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(PORT), '--bind', '127.0.0.1', '--directory', ROOT], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
for _ in range(40):
    try: urllib.request.urlopen(BASE, timeout=1); break
    except Exception: time.sleep(.25)
try:
    with sync_playwright() as p:
        b = p.chromium.launch()
        ctx = b.new_context(viewport={'width': 1280, 'height': 900})
        # 擋掉訪客計數器，測試不灌「工具使用分析」的數字
        ctx.route('**/visitor-badge.laobi.icu/**', lambda r: r.abort())
        pg = ctx.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.goto(BASE); pg.wait_for_timeout(700)

        # ---------- 標準配備 ----------
        ok('首次造訪跳出警語', pg.locator('#modal.show').count() == 1 and '使用警語' in pg.inner_text('#modalBox'))
        pg.click('#modalBox [data-act=close]')
        ok('重新整理不再跳警語', (pg.reload(), pg.wait_for_timeout(500), pg.locator('#modal.show').count() == 0)[2])
        ok('沒有 JS 錯誤', not errs, errs)
        ok('頁面上看得到警語入口', pg.locator('.warn-line [data-act=warn]').count() == 1)
        ok('頁尾有創作者、手冊、計數器', '創作者' in pg.inner_text('.foot') and pg.locator('.foot a[href="manual.html"]').count() == 1 and pg.locator('.foot img[src*="page_id=m255525.staffshiftplanner"]').count() == 1)
        ok('跑馬燈存在且沒有關閉鈕', pg.locator('#marqueeBar #marqueeTrack').count() == 1 and pg.locator('#marqueeBar button').count() == 0)
        css = pg.evaluate("Array.from(document.styleSheets).map(s=>{try{return Array.from(s.cssRules).map(r=>r.cssText).join('\\n')}catch(e){return ''}}).join('\\n')")
        ok('跑馬燈滑鼠移入暫停', 'paused' in css and '#marqueeBar:hover' in css)
        ok('[hidden] 有 !important', '[hidden] { display: none !important; }' in css)

        pg.click('[data-act=settings]')
        ok('⚙ 常用設定是收合式', pg.locator('#modalBox details.set-sec').count() >= 3 and pg.locator('#modalBox details.set-sec[open]').count() == 0)
        ok('設定裡沒有跑馬燈開關', '跑馬燈' not in pg.inner_text('#modalBox'))
        pg.click('#modalBox details[data-sec=about] > summary')
        about = pg.inner_text('#modalBox details[data-sec=about]')
        ok('關於本工具集中五項入口', all(k in about for k in ('創作者', '操作手冊', '使用警語', '加入主畫面', '訪客數')), about)
        pg.click('[data-act=close]'); pg.click('[data-act=settings]')
        ok('記住展開狀態', pg.locator('#modalBox details[data-sec=about][open]').count() == 1)
        pg.click('#modalBox details[data-sec=view] > summary'); pg.click('[data-fontsize=xl]')
        ok('大字', pg.evaluate("document.documentElement.dataset.fsize") == 'xl')
        pg.click('[data-fontsize=m]'); pg.click('[data-act=close]')

        # ---------- 主功能（範本的範例，換成這個工具的功能測試） ----------
        q = pg.locator('[data-f=qty]'); q.fill(''); q.type('3')
        pg.fill('[data-f=price]', '200'); pg.fill('[data-f=discount]', '10')
        ok('輸入時焦點還在', pg.evaluate("document.activeElement.dataset.f") == 'discount')
        ok('結果即時更新', '540' in pg.inner_text('#result'), pg.inner_text('#result'))
        pg.fill('[data-f=discount]', ''); pg.press('[data-f=discount]', 'Tab')
        ok('空白欄位離開後整理回合法值', pg.input_value('[data-f=discount]') == '0')
        pg.reload(); pg.wait_for_timeout(400)
        ok('重新整理後資料還在', pg.input_value('[data-f=qty]') == '3')

        # 備份還原
        pg.click('[data-act=settings]')
        if pg.locator('#modalBox details[data-sec=data][open]').count() == 0: pg.click('#modalBox details[data-sec=data] > summary')
        with pg.expect_download() as dl: pg.click('[data-act=backup]')
        path = os.path.join(SHOTS, 'backup.json'); dl.value.save_as(path)
        j = json.load(open(path, encoding='utf-8'))
        ok('備份檔格式', j.get('app') == 'staff-shift-planner' and j['state']['input']['qty'] == 3)
        pg.click('[data-act=wipe]'); pg.click('[data-act=wipeYes]')
        ok('清除後回到預設', pg.input_value('[data-f=qty]') != '3')
        pg.click('[data-act=settings]')
        if pg.locator('#modalBox details[data-sec=data][open]').count() == 0: pg.click('#modalBox details[data-sec=data] > summary')
        pg.set_input_files('#restoreFile', path); pg.wait_for_timeout(300)
        ok('從備份還原', pg.input_value('[data-f=qty]') == '3')

        # ---------- PWA、手冊、列印 ----------
        pg.wait_for_timeout(800)
        ok('service worker 已註冊', pg.evaluate("navigator.serviceWorker.getRegistration().then(r=>!!r)"))
        mf = json.loads(urllib.request.urlopen(BASE + 'manifest.json').read().decode('utf-8'))
        ok('manifest 圖示', len(mf.get('icons', [])) == 3 and all(os.path.exists(os.path.join(ROOT, i['src'])) for i in mf['icons']))
        sw = open(os.path.join(ROOT, 'service-worker.js'), encoding='utf-8').read()
        ok('SW 只刪自己前綴的快取', "k.indexOf(CACHE_NAME.replace(" in sw)
        pg.emulate_media(media='print')
        ok('列印有浮水印', pg.evaluate("getComputedStyle(document.getElementById('pdfWatermark')).display") == 'flex')
        pg.emulate_media(media='screen')
        mp = ctx.new_page(); mp.goto(BASE + 'manual.html')
        ok('手冊有完整版創作者資料', mp.locator('#creator .mk-creator').count() == 1 and len(mp.inner_text('#creator')) > 400)
        ok('手冊有手冊計數器', mp.locator('img[src*="m255525.staffshiftplanner.manual"]').count() == 1)
        mp.close()

        # ---------- 手機寬度 ----------
        pg.set_viewport_size({'width': 390, 'height': 800}); pg.wait_for_timeout(200)
        ok('390px 不橫向捲動', pg.evaluate("document.documentElement.scrollWidth <= 391"))
        pg.screenshot(path=os.path.join(SHOTS, 'mobile.png'), full_page=True)
        pg.set_viewport_size({'width': 1280, 'height': 900}); pg.screenshot(path=os.path.join(SHOTS, 'desktop.png'), full_page=True)
        ok('全程沒有 JS 錯誤', not errs, errs)
        b.close()
finally:
    srv.terminate()

print('\n' + ('全部通過' if not fails else '失敗 %d 項：%s' % (len(fails), '、'.join(fails))))
sys.exit(1 if fails else 0)
