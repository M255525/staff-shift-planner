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

        # ---------- 主功能：排班 ----------
        ok('範例店提示列', pg.locator('#sampleBar').count() == 1)
        ok('班表 6 人 × 7 天', pg.locator('[data-cell]').count() == 42)
        ok('一開始缺人（紅）', 'bad' in pg.get_attribute('#kpis .kpi:nth-child(1)', 'class'))
        pg.click('[data-act=auto]'); pg.wait_for_timeout(200)
        ok('自動排班後 100%', pg.inner_text('#kpis .kpi:nth-child(1) b') == '100%', pg.inner_text('#kpis .kpi:nth-child(1)'))
        ok('自動排班後沒有違規', pg.inner_text('#kpis .kpi:nth-child(2) b') == '0')
        ok('涵蓋列全綠', pg.locator('.cv.short').count() == 0 and pg.locator('.cv.fine').count() > 0)
        ok('不能上的日子沒被排', pg.evaluate("(() => { const S = window._tool.S; return S.staff.every(p => (p.off||[]).every(d => !S.grid[p.id][d])); })()"))
        # 點格子改班：週三晚班接週四早班，製造換班間隔不足
        pg.click('[data-cell="p4|3"]')
        ok('點格子跳出班別選擇', pg.locator('#modal.show [data-pick]').count() == 3)
        pg.click('[data-pick="p4|3|s2"]')
        pg.click('[data-cell="p4|4"]'); pg.click('[data-pick="p4|4|s1"]')
        pg.wait_for_timeout(150)
        gap = pg.evaluate("window._tool.analyze().issues.filter(i => i.key === 'gap' && i.who === 'p4').length")
        ok('晚班接早班會亮紅燈', gap == 1 and pg.locator('[data-cell="p4|4"] .pin.red').count() == 1)
        ok('檢查分頁數字', pg.inner_text('#checkCnt') != '' and not pg.locator('#checkCnt').is_hidden())
        pg.click('[data-tab=check]')
        ok('檢查清單有換班間隔', '11 小時' in pg.inner_text('#panel-check'))
        pg.click('#panel-check .hi.red [data-goto]')
        ok('看這格會跳回班表', pg.locator('#panel-board').is_visible())
        pg.click('[data-cell="p4|4"]'); pg.click('[data-pick="p4|4|"]')
        ok('改成休之後紅燈消失', pg.locator('[data-cell="p4|4"] .pin').count() == 0)
        # 人員與班別：改輸入不會掉焦點
        pg.click('[data-tab=setup]')
        e = pg.locator('[data-sh="0"][data-k=brk]'); e.fill(''); e.type('0')
        ok('改休息分鐘焦點還在', pg.evaluate("document.activeElement.dataset.k") == 'brk')
        ok('休息 0 分鐘：班別違規（第 35 條）', pg.evaluate("window._tool.analyze().issues.some(i => i.key === 'shiftBreak')"))
        e.fill('30'); e.press('Tab')
        n0 = pg.locator('[data-delst]').count()
        pg.click('[data-act=addStaff]')
        ok('新增人員', pg.locator('[data-delst]').count() == n0 + 1 and pg.evaluate("document.activeElement.dataset.k") == 'name')
        pg.keyboard.type('新來的')
        pg.click('[data-offp="0"][data-d="0"]')
        ok('切換不能上班的日子', pg.get_attribute('[data-offp="0"][data-d="0"]', 'aria-pressed') == 'true')
        pg.click('[data-pay="2"][data-val=month]')
        ok('切換月薪', pg.input_value('[data-st="2"][data-k=wage]') == '32000')
        pg.fill('[data-need="s1"][data-d="0"]', '3'); pg.click('[data-fillrow="s1"]')
        ok('週一套用全週', pg.evaluate("window._tool.S.need.s1.every(v => v === 3)"))
        pg.click('[data-tab=board]')
        ok('新人出現在班表', '新來的' in pg.inner_text('#panel-board'))
        # 成本
        pg.click('[data-tab=cost]')
        ok('成本表一人一列', pg.locator('#panel-cost tbody tr').count() == 7)
        ok('成本重點卡', 'NT$' in pg.inner_text('#kpis .kpi:nth-child(5)'))
        # LINE 文字
        ctx.grant_permissions(['clipboard-read', 'clipboard-write'], origin=BASE.rstrip('/'))
        pg.click('[data-tab=board]'); pg.click('#panel-board [data-act=line]'); pg.wait_for_timeout(200)
        clip = pg.evaluate("navigator.clipboard.readText()")
        ok('複製給 LINE', clip.startswith('【') and '▍新來的' in clip, clip[:80])
        # CSV
        with pg.expect_download() as dl: pg.click('#panel-board [data-act=csv]')
        cpath = os.path.join(SHOTS, 'shift.csv'); dl.value.save_as(cpath)
        csv = open(cpath, encoding='utf-8-sig').read().splitlines()
        ok('CSV 一人一列＋表頭', len(csv) == 8 and csv[0].startswith('人員'))
        # 換週
        w0 = pg.evaluate("window._tool.S.week")
        pg.click('[data-act=weekNext]')
        ok('下一週沿用班表', pg.evaluate("window._tool.S.week") != w0 and pg.locator('#panel-board .mag-chip').count() > 10)
        # 分享（只看）：分享頁改格子，原本的存檔不變
        before = pg.evaluate("localStorage.getItem('ssp.state')")
        url = pg.evaluate(r"location.href.split('#')[0] + '#s=' + btoa(unescape(encodeURIComponent(JSON.stringify(window._tool.S)))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')")
        sp = ctx.new_page(); sp.goto(url); sp.wait_for_timeout(500)
        ok('分享連結進入只看模式', sp.evaluate("window._tool.viewOnly") and sp.locator('.viewbar').count() >= 1)
        cell = sp.locator('[data-cell] .mag-chip').first.locator('xpath=..').get_attribute('data-cell')
        sp.click('[data-cell="%s"]' % cell); sp.click('[data-pick="%s|"]' % cell)
        ok('只看模式修改不存檔', sp.evaluate("localStorage.getItem('ssp.state')") == before)
        sp.close()
        # 套用範例店型
        pg.click('[data-tab=setup]'); pg.click('#panel-setup [data-act=tpl]'); pg.click('[data-tpl=store]')
        ok('套用 24 小時門市', pg.locator('[data-cell]').count() == 63)
        pg.click('[data-tab=board]'); pg.click('[data-act=auto]')
        ok('門市自動排班沒有違規', pg.inner_text('#kpis .kpi:nth-child(2) b') == '0')
        pg.reload(); pg.wait_for_timeout(400)
        ok('重新整理後資料還在', pg.locator('[data-cell]').count() == 63 and pg.locator('#panel-board .mag-chip').count() > 20)

        # 備份還原
        pg.click('[data-act=settings]')
        if pg.locator('#modalBox details[data-sec=data][open]').count() == 0: pg.click('#modalBox details[data-sec=data] > summary')
        with pg.expect_download() as dl: pg.click('#modalBox [data-act=backup]')
        path = os.path.join(SHOTS, 'backup.json'); dl.value.save_as(path)
        j = json.load(open(path, encoding='utf-8'))
        ok('備份檔格式', j.get('app') == 'staff-shift-planner' and len(j['state']['staff']) == 9)
        pg.click('[data-act=wipe]'); pg.click('[data-act=wipeYes]')
        ok('清除後回到範例咖啡店', pg.locator('[data-cell]').count() == 42)
        pg.click('[data-act=settings]')
        if pg.locator('#modalBox details[data-sec=data][open]').count() == 0: pg.click('#modalBox details[data-sec=data] > summary')
        pg.set_input_files('#restoreFile', path); pg.wait_for_timeout(300)
        ok('從備份還原', pg.locator('[data-cell]').count() == 63)
        pg.screenshot(path=os.path.join(SHOTS, 'board.png'), full_page=True)

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
