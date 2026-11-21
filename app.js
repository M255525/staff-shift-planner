/* 員工排班表：畫面
   骨架由 tool-scaffold 產生（跑馬燈、⚙ 常用設定、首訪警語、手冊／創作者／加入主畫面／訪客數、備份還原、大字、列印浮水印）。 */
(function(){
'use strict';
var D = window.SSP, PFX = 'ssp.';
function lsGet(k){ try{ return localStorage.getItem(PFX + k); }catch(e){ return null; } }
function lsSet(k, v){ try{ localStorage.setItem(PFX + k, v); }catch(e){} }
function lsDel(k){ try{ localStorage.removeItem(PFX + k); }catch(e){} }
function lsJson(k, d){ try{ var v = JSON.parse(lsGet(k)); return v == null ? d : v; }catch(e){ return d; } }
function $(id){ return document.getElementById(id); }
function esc(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){ return {'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]; }); }
function today(){ return D.ymd(new Date()); }
function nf(x, d){ return isFinite(x) ? Number(x).toLocaleString('en-US', {maximumFractionDigits:d == null ? 0 : d}) : '—'; }

var COUNTER = 'https://visitor-badge.laobi.icu/badge?page_id=m255525.staffshiftplanner';
var standalone = window.matchMedia && matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
var ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
var TABS = [['board', '📋 班表'], ['setup', '⚙️ 人員與班別'], ['check', '🚦 檢查'], ['cost', '💰 成本'], ['about', '📖 說明']];
var V = {tab:lsGet('tab') || 'board'};
if(!TABS.some(function(t){ return t[0] === V.tab; })) V.tab = 'board';
var DAYS = D.DAYS;

/* ---------- 資料 ---------- */
function defaults(){ return D.preset('cafe'); }
function load(){ var s = lsJson('state', null); return s && Array.isArray(s.shifts) ? D.normalize(s) : defaults(); }
var S = load(), viewOnly = false, saved = null, A = null;
function save(){ if(!viewOnly) lsSet('state', JSON.stringify(S)); }
function analyze(){ A = D.analyze(S); return A; }

/* ---------- 畫面 ---------- */
function render(){
  var h = '<div class="print-head"><h1>' + esc(S.shop) + '　班表 ' + D.weekTitle(D.normalize(S)) + '</h1><div class="small">列印日期 ' + today() + '・員工排班表</div></div>' +
    '<div class="bar"><h1><span class="mag">班</span>員工排班表<small>排好一週的班，順便檢查有沒有違反勞基法、算出人力成本</small></h1>' +
    '<a class="ibtn noprint" href="manual.html">📖 操作手冊</a><button class="ibtn" data-act="print">🖨 列印</button><button class="ibtn" data-act="share">🔗 分享</button><button class="ibtn" data-act="settings" aria-label="常用設定">⚙</button></div>' +
    '<p class="warn-line">排班檢查依勞動基準法一般工時規定整理，只供排班參考，不是法律意見。<button data-act="warn">⚠ 使用警語</button></p>' +
    (viewOnly ? '<div class="viewbar"><span>👀 你正在看別人分享的班表，修改不會存檔。</span><button data-act="keepShared">存成我的班表</button><button data-act="leaveShared">離開</button></div>' : '') +
    (!viewOnly && /（範例）/.test(S.shop) ? '<div class="viewbar" id="sampleBar"><span>🧲 現在是範例店「' + esc(S.shop) + '」，可以先按「🪄 自動排班」看看效果。</span><button data-act="tpl">換成我的店</button></div>' : '') +
    '<div class="kpis" id="kpis"></div>' +
    '<nav class="tabs" role="tablist">' + TABS.map(function(t){ return '<button role="tab" data-tab="' + t[0] + '" aria-selected="' + (V.tab === t[0]) + '">' + t[1] + (t[0] === 'check' ? '<span class="cnt" id="checkCnt" hidden></span>' : '') + '</button>'; }).join('') + '</nav>' +
    TABS.map(function(t){ return '<section class="panel" data-p="' + t[0] + '" id="panel-' + t[0] + '"' + (V.tab === t[0] ? '' : ' hidden') + '></section>'; }).join('') +
    '<footer class="foot">👤 創作者 Mark Tsai（蔡豐全）・<a href="manual.html">📖 操作手冊</a>・<a href="#" data-act="warn">⚠ 使用警語</a>' + (standalone ? '' : '・<a href="#" data-act="install">📲 加入主畫面</a>') +
    '<br><img src="' + COUNTER + '" alt="訪客次數" height="20" loading="lazy" style="vertical-align:middle;margin-top:.4rem"></footer>';
  $('app').innerHTML = h;
  $('panel-setup').innerHTML = setupHTML();
  $('panel-about').innerHTML = aboutHTML();
  refresh();
}
// 輸入時不重繪設定表單（焦點才不會跑掉），只更新其他地方
function refresh(){
  var a = analyze();
  $('kpis').innerHTML = kpiHTML(a);
  $('panel-board').innerHTML = boardHTML(a);
  $('panel-check').innerHTML = checkHTML(a);
  $('panel-cost').innerHTML = costHTML(a);
  var c = $('checkCnt'); c.hidden = !a.red; c.textContent = a.red;
  a.st.shifts.forEach(function(s){ var el = document.querySelector('[data-calc="' + s.id + '"]'); if(el) el.textContent = calcText(s); });
}
function kpi(tape, val, em, cls, go){ return '<' + (go ? 'button data-tab="' + go + '"' : 'div') + ' class="kpi' + (cls ? ' ' + cls : '') + '"><span class="tape' + (cls === 'bad' ? ' red' : '') + '">' + tape + '</span><b>' + val + '</b><em>' + em + '</em></' + (go ? 'button' : 'div') + '>'; }
function kpiHTML(a){
  return kpi('人力需求', Math.round(a.coverPct * 100) + '%', a.short ? '還缺 ' + a.short + ' 個人次' : '每一班都排滿了', a.short ? 'bad' : 'ok', 'board') +
    kpi('違規', a.red, a.red ? '一定要改' : '沒有違反規定', a.red ? 'bad' : 'ok', 'check') +
    kpi('注意', a.yellow, a.yellow ? '加班、休息日、個人意願' : '沒有要注意的', a.yellow ? 'warn' : 'ok', 'check') +
    kpi('本週總工時', nf(a.hours, 1) + ' h', a.st.staff.length + ' 個人', '', null) +
    kpi('本週人力成本', D.money(a.cost), '加班相關 ' + D.money(a.otCost) + '・每月約 ' + D.money(a.monthCost), '', 'cost');
}

/* ---------- 班表 ---------- */
function chip(info){ var sh = info.sh; return '<span class="mag-chip" style="background:' + info.color + '">' + esc(sh.name) + '<small>' + sh.start + '–' + sh.end + '</small></span>'; }
function boardHTML(a){
  var st = a.st, SM = a.shiftMap, ds = D.weekDates(st.week);
  var pins = {};
  a.issues.forEach(function(i){ if(i.who && i.day != null){ var k = i.who + '|' + i.day; if(!pins[k] || i.lv === 'red') pins[k] = i.lv; } });
  var head = '<tr><th class="who">人員</th>' + ds.map(function(d, i){ return '<th class="' + (i >= 5 ? 'we' : '') + '">' + DAYS[i] + '<small>' + D.md(d) + '</small></th>'; }).join('') + '<th>天數</th><th>工時</th><th>加班</th></tr>';
  var body = a.people.map(function(x, pi){
    var p = st.staff[pi], row = st.grid[p.id];
    return '<tr><td class="who">' + esc(p.name) + '<small>' + (p.pay === 'month' ? '月薪' : '時薪 ' + nf(p.wage)) + (p.child ? '・童工' : '') + '</small></td>' +
      row.map(function(sid, d){
        var na = p.off.indexOf(d) >= 0, pin = pins[p.id + '|' + d];
        return '<td class="cell"><button class="slot' + (na ? ' na' : '') + '" data-cell="' + p.id + '|' + d + '" aria-label="' + esc(p.name) + ' 週' + DAYS[d] + '：' + (sid ? esc(SM[sid].sh.name) : '休') + (na ? '（不能上班）' : '') + '">' +
          (sid ? chip(SM[sid]) : '<span class="off">' + (na ? '不能上' : '休') + '</span>') + (pin ? '<i class="pin ' + pin + '"></i>' : '') + '</button></td>';
      }).join('') +
      '<td class="sum"><b>' + x.days + '</b></td><td class="sum"><b>' + nf(x.hours, 1) + '</b></td><td class="sum">' + (x.otWeek ? nf(x.otWeek, 1) : '—') + '</td></tr>';
  }).join('');
  var cov = st.shifts.map(function(s){
    return '<tr class="cov"><td class="who">' + esc(s.name) + ' 排／需</td>' + DAYS.map(function(_, d){
      var c = a.cover.find(function(x){ return x.shift === s.id && x.day === d; });
      var cls = c.need === 0 && c.have === 0 ? 'zero' : c.have < c.need ? 'short' : c.have > c.need ? 'over' : 'fine';
      return '<td><span class="cv ' + cls + '">' + c.have + '/' + c.need + '</span></td>';
    }).join('') + '<td colspan="3"></td></tr>';
  }).join('');
  return '<div class="board"><div class="sheet">' +
    '<div class="toolbar"><div class="wk"><button class="btn alt sm" data-act="weekPrev" aria-label="上一週">◀</button><b>' + D.weekTitle(st) + '</b><button class="btn alt sm" data-act="weekNext" aria-label="下一週">▶</button></div>' +
    '<button class="btn" data-act="auto">🪄 自動排班</button><button class="btn alt" data-act="clear">🧹 清空</button><button class="btn alt" data-act="line">💬 複製給 LINE</button><button class="btn alt" data-act="csv">⬇ CSV</button></div>' +
    (st.staff.length && st.shifts.length ? '<div class="tw"><table class="grid"><thead>' + head + '</thead><tbody>' + body + cov + '</tbody></table></div>' :
      '<p class="small">還沒有' + (st.shifts.length ? '人員' : '班別') + '，先到「⚙️ 人員與班別」新增。</p>') +
    '<div class="legend">' + st.shifts.map(function(s){ var sp = D.span(s); return '<span><i style="background:' + SM[s.id].color + '"></i>' + esc(s.name) + ' ' + s.start + '–' + s.end + '（實際 ' + nf(sp.work, 1) + ' h）</span>'; }).join('') +
    '<span>點格子換班別・斜線＝他說不能上・紅點＝違規、黃點＝注意</span></div></div></div>';
}
function pickModal(pid, d){
  var st = D.normalize(S), SM = D.shiftMap(st), p = st.staff.find(function(x){ return x.id === pid; }); if(!p) return;
  var cur = st.grid[pid][d], ds = D.weekDates(st.week);
  openModal('<h2>' + esc(p.name) + '・週' + DAYS[d] + '（' + D.md(ds[d]) + '）</h2>' +
    (p.off.indexOf(d) >= 0 ? '<p class="small" style="color:var(--bad);font-weight:700">⚠ ' + esc(p.name) + ' 說這天不能上班。</p>' : '') +
    '<div class="pick">' + st.shifts.map(function(s){
      var test = JSON.parse(JSON.stringify(st.grid)); test[pid][d] = '';
      var why = cur === s.id ? '' : D.canTake(st, SM, p, d, s.id, test) ? '' : '可能違規或超過他的上限';
      return '<button data-pick="' + pid + '|' + d + '|' + s.id + '" aria-pressed="' + (cur === s.id) + '">' + chip(SM[s.id]) + (why ? '<span class="why">' + why + '</span>' : '') + '</button>';
    }).join('') + '<button data-pick="' + pid + '|' + d + '|" aria-pressed="' + (!cur) + '"><span class="off" style="font-size:1.1rem">休</span></button></div>' +
    '<div class="vstack"><button class="btn alt" data-act="close">取消</button></div>');
}

/* ---------- 人員與班別 ---------- */
function calcText(s){ var sp = D.span(s); return sp ? '實際 ' + nf(sp.work, 1) + ' h' + (sp.e > 1440 ? '・跨夜' : '') : '時間不對'; }
function setupHTML(){
  var st = D.normalize(S), SM = D.shiftMap(st);
  var shifts = '<div class="tw"><table class="ed"><thead><tr><th></th><th>班別名稱</th><th>上班</th><th>下班</th><th>休息（分鐘）</th><th></th><th></th></tr></thead><tbody>' +
    S.shifts.map(function(s, i){
      return '<tr><td><span class="sw" style="background:' + D.COLORS[i % D.COLORS.length] + '"></span></td>' +
        '<td><input type="text" maxlength="8" data-sh="' + i + '" data-k="name" value="' + esc(s.name) + '" aria-label="班別名稱"></td>' +
        '<td><input type="time" data-sh="' + i + '" data-k="start" value="' + esc(s.start) + '" aria-label="上班時間"></td>' +
        '<td><input type="time" data-sh="' + i + '" data-k="end" value="' + esc(s.end) + '" aria-label="下班時間"></td>' +
        '<td><input type="number" min="0" step="10" data-sh="' + i + '" data-k="brk" value="' + esc(s.brk) + '" aria-label="休息分鐘"></td>' +
        '<td class="calc" data-calc="' + esc(s.id) + '">' + calcText(st.shifts[i]) + '</td>' +
        '<td><button class="x" data-delsh="' + i + '" aria-label="刪除班別 ' + esc(s.name) + '">✕</button></td></tr>';
    }).join('') + '</tbody></table></div>';
  var need = '<div class="tw"><table class="ed"><thead><tr><th>班別</th>' + DAYS.map(function(d){ return '<th>' + d + '</th>'; }).join('') + '<th></th></tr></thead><tbody>' +
    st.shifts.map(function(s){
      return '<tr><td><b>' + esc(s.name) + '</b></td>' + DAYS.map(function(_, d){ return '<td><input type="number" min="0" max="50" data-need="' + s.id + '" data-d="' + d + '" value="' + esc(S.need[s.id] ? S.need[s.id][d] : 0) + '" aria-label="' + esc(s.name) + ' 週' + DAYS[d] + ' 需要人數"></td>'; }).join('') +
        '<td><button class="btn alt sm" data-fillrow="' + s.id + '">週一套用全週</button></td></tr>';
    }).join('') + '</tbody></table></div>';
  var staff = '<div class="tw"><table class="ed"><thead><tr><th>姓名</th><th>計薪</th><th>金額（元）</th><th>每週最多天</th><th>每週最多時數</th><th>不能上班的日子</th><th></th><th></th></tr></thead><tbody>' +
    S.staff.map(function(p, i){
      return '<tr><td><input type="text" maxlength="12" data-st="' + i + '" data-k="name" value="' + esc(p.name) + '" aria-label="姓名"></td>' +
        '<td><div class="seg" role="group"><button data-pay="' + i + '" data-val="hour" aria-pressed="' + (p.pay !== 'month') + '">時薪</button><button data-pay="' + i + '" data-val="month" aria-pressed="' + (p.pay === 'month') + '">月薪</button></div></td>' +
        '<td><input type="number" min="0" data-st="' + i + '" data-k="wage" value="' + esc(p.wage) + '" aria-label="' + (p.pay === 'month' ? '月薪' : '時薪') + '"></td>' +
        '<td><input type="number" min="0" max="7" data-st="' + i + '" data-k="maxDays" value="' + esc(p.maxDays) + '" aria-label="每週最多天"></td>' +
        '<td><input type="number" min="0" max="84" data-st="' + i + '" data-k="maxHours" value="' + esc(p.maxHours) + '" aria-label="每週最多時數"></td>' +
        '<td><div class="days7">' + DAYS.map(function(d, j){ return '<button data-offp="' + i + '" data-d="' + j + '" aria-pressed="' + ((p.off || []).indexOf(j) >= 0) + '" aria-label="週' + d + ' 不能上班">' + d + '</button>'; }).join('') + '</div></td>' +
        '<td><label class="chk"><input type="checkbox" data-child="' + i + '"' + (p.child ? ' checked' : '') + '>童工</label></td>' +
        '<td><button class="x" data-delst="' + i + '" aria-label="刪除 ' + esc(p.name) + '">✕</button></td></tr>';
    }).join('') + '</tbody></table></div>';
  return '<div class="card"><h3><span class="tape">店家</span></h3><div class="row">' +
      '<label class="fld">店名<input type="text" maxlength="30" data-g="shop" value="' + esc(S.shop) + '"></label>' +
      '<label class="fld">哪一週（選那週任何一天）<input type="date" data-g="week" value="' + esc(st.week) + '"><small>只排一週；下一週可以按班表上的 ▶ 直接沿用。</small></label></div>' +
      '<div class="btns"><button class="btn alt" data-act="tpl">套用範例店型</button></div></div>' +
    '<div class="card"><h3><span class="tape blue">班別</span><span class="small">最多 ' + D.MAX_SHIFTS + ' 種；下班早於上班＝跨夜</span></h3>' + shifts +
      '<div class="btns"><button class="btn alt" data-act="addShift"' + (S.shifts.length >= D.MAX_SHIFTS ? ' disabled' : '') + '>＋ 新增班別</button></div></div>' +
    '<div class="card"><h3><span class="tape yel">每班需要幾個人</span></h3>' + (st.shifts.length ? need : '<p class="small">先新增班別。</p>') + '</div>' +
    '<div class="card"><h3><span class="tape">人員</span><span class="small">最多 ' + D.MAX_STAFF + ' 人；月薪會用「月薪 ÷ 240」換算加班費時薪</span></h3>' + staff +
      '<div class="btns"><button class="btn alt" data-act="addStaff"' + (S.staff.length >= D.MAX_STAFF ? ' disabled' : '') + '>＋ 新增人員</button></div>' +
      '<p class="small">童工＝15～16 歲。未滿 18 歲的員工要有法定代理人同意書與年齡證明（勞基法第 46 條）。</p></div>';
}

/* ---------- 檢查、成本、說明 ---------- */
function checkHTML(a){
  if(!a.issues.length) return '<div class="card"><div class="allok">✅ 沒有發現問題：每班都排滿、沒有違反檢查的勞基法規定。</div></div>';
  var names = {}; a.st.staff.forEach(function(p){ names[p.id] = p.name; });
  return '<div class="card"><h3><span class="tape red">違規 ' + a.red + '</span><span class="tape yel">注意 ' + a.yellow + '</span></h3><div class="hl">' + a.issues.map(function(i){
    var go = i.day != null ? '<button class="btn alt sm" data-goto="' + (i.who || '') + '|' + i.day + '">看這格</button>' : '';
    return '<div class="hi ' + i.lv + '"><span class="lamp" aria-label="' + (i.lv === 'red' ? '違規' : '注意') + '"></span><div><p>' + esc(i.msg) + '</p>' + (i.law ? '<span class="law">' + esc(i.law) + '</span>' : '') + '</div>' + go + '</div>';
  }).join('') + '</div><div class="note">紅燈是違反勞基法或基本工資、或人手不足；黃燈是合法但要注意（加班要經同意並付加班費、超過個人意願）。只檢查這一週，<b>跨週連續上班</b>（例如上週日接這週一到週六）請自己留意。</div></div>';
}
function costHTML(a){
  if(!a.people.length) return '<div class="card"><p class="small">還沒有人員。</p></div>';
  var rows = a.people.map(function(x){
    return '<tr><td class="t">' + esc(x.name) + '</td><td class="t">' + (x.pay === 'month' ? '月薪' : '時薪') + '</td><td>' + x.days + '</td><td>' + nf(x.hours, 1) + '</td><td>' + nf(x.base) + '</td><td>' + nf(x.otPay) + '</td><td>' + nf(x.restPay) + '</td><td>' + nf(x.holPay) + '</td><td><b>' + nf(x.total) + '</b></td><td>' + nf(x.month) + '</td></tr>';
  }).join('');
  var t = a.people.reduce(function(s, x){ ['hours', 'base', 'otPay', 'restPay', 'holPay', 'total', 'month'].forEach(function(k){ s[k] = (s[k] || 0) + x[k]; }); s.days += x.days; return s; }, {days:0});
  return '<div class="card"><h3><span class="tape">本週人力成本</span><span class="small">單位：元</span></h3><div class="tw"><table class="data"><thead><tr><th>人員</th><th>計薪</th><th>天數</th><th>工時</th><th>薪資／月薪分攤</th><th>平日加班費</th><th>休息日加給</th><th>例假加倍</th><th>本週合計</th><th>每月推估</th></tr></thead><tbody>' + rows +
    '</tbody><tfoot><tr><td class="t">合計</td><td></td><td>' + t.days + '</td><td>' + nf(t.hours, 1) + '</td><td>' + nf(t.base) + '</td><td>' + nf(t.otPay) + '</td><td>' + nf(t.restPay) + '</td><td>' + nf(t.holPay) + '</td><td>' + nf(t.total) + '</td><td>' + nf(t.month) + '</td></tr></tfoot></table></div>' +
    '<div class="note"><ul><li>時薪的人：正常工時 × 時薪；月薪的人：月薪 ÷（52 ÷ 12）週分攤，加班費用「月薪 ÷ 240」當時薪。</li>' +
    '<li>每天超過 8 小時：前 2 小時 × 4/3、再 2 小時 × 5/3。第 6 個上班日算休息日出勤：另再加給前 2 小時 × 4/3、3～8 小時 × 5/3、9～12 小時 × 8/3。第 7 天是例假出勤：工資加倍（另要補假）。</li>' +
    '<li>只算薪資與加班費，<b>勞健保、勞退、職災等雇主負擔沒有算進去</b>，可以用 <a href="https://m255525.github.io/employer-payroll-cost-calculator/" target="_blank" rel="noopener">雇主人事成本試算</a> 算完整成本。</li>' +
    '<li>每月推估 = 本週 × 52 ÷ 12，假設每週都這樣排。</li></ul></div></div>';
}
function aboutHTML(){
  var L = [['每天工時', '正常 8 小時；加班後一天合計不得超過 12 小時', '第 30、32 條'], ['休息', '連續工作 4 小時，至少休息 30 分鐘', '第 35 條'], ['換班間隔', '輪班換班時，中間至少連續休息 11 小時', '第 34 條'],
    ['例假與休息日', '每 7 天要有 2 天休息：1 天例假、1 天休息日。例假除天災等特殊情況不得出勤', '第 36、40 條'], ['每月加班', '每月延長工時不超過 46 小時（勞資會議同意可到 54、每 3 個月 138）', '第 32 條'],
    ['加班費', '平日前 2 小時 × 4/3、再 2 小時 × 5/3；休息日另再加給 4/3、5/3、8/3', '第 24 條'], ['童工', '15～16 歲：每天不超過 8、每週不超過 40 小時，例假休息日不加班，晚上 8 點到早上 6 點不得工作', '第 47、48 條'],
    ['基本工資', '2026 年起月薪 29,500 元、時薪 196 元', '最低工資法']];
  return '<div class="card"><h3><span class="tape">這是什麼</span></h3><p>給小店老闆、店長用的一週排班工具：設定班別、人員與每班需要幾個人，按「🪄 自動排班」先排出草稿，再點格子微調；每一格都會即時檢查勞基法工時規定，並估算本週人力成本。排好可以列印貼在休息室，或複製文字貼到 LINE 群組。</p></div>' +
    '<div class="card"><h3><span class="tape blue">檢查了哪些規定</span></h3><div class="tw"><table class="law-t"><thead><tr><th>項目</th><th>規定</th><th>依據（勞動基準法）</th></tr></thead><tbody>' +
    L.map(function(r){ return '<tr><td><b>' + r[0] + '</b></td><td>' + r[1] + '</td><td>' + r[2] + '</td></tr>'; }).join('') + '</tbody></table></div>' +
    '<div class="note"><ul><li>以上依一般工時制度整理（2026-11 查證）。<b>沒有處理變形工時</b>（2 週、4 週、8 週）、經指定行業的例假調整、責任制等特殊情況。</li><li>只看這一週；跨週連續上班請自己留意。</li><li>國定假日沒有自動標示，遇到國定假日請自行調整並依規定給薪。</li><li>實際規定以勞動部公告與主管機關解釋為準。</li></ul></div></div>';
}

/* ---------- 彈窗、警語、設定 ---------- */
function openModal(h){ $('modalBox').innerHTML = h; $('modal').classList.add('show'); $('modalBox').scrollTop = 0; var f = $('modalBox').querySelector('button,a,input'); if(f) f.focus(); }
function closeModal(){ $('modal').classList.remove('show'); }
var toastT;
function toast(m){ var o = document.querySelector('.toast'); if(o) o.remove(); var t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); t.textContent = m; document.body.appendChild(t); clearTimeout(toastT); toastT = setTimeout(function(){ t.remove(); }, 3000); }
var WARN_HTML = '<h2>⚠ 使用警語</h2><p><b>本工具是排班輔助，不是法律意見。</b></p><ul>' +
  '<li>檢查依勞動基準法「一般工時」規定整理（2026-11 查證），沒有處理變形工時、特殊行業例假調整、責任制等情況；實際以勞動部公告與主管機關解釋為準。</li>' +
  '<li>只檢查這一週，跨週連續上班、國定假日請自行留意。</li>' +
  '<li>沒有紅燈不代表一定合法；加班、休息日出勤都需要員工同意。</li>' +
  '<li>成本只估算薪資與加班費，不含勞健保、勞退等雇主負擔。</li>' +
  '<li>範例店的店名、人名、薪資都是虛構的。</li>' +
  '<li>資料只存在這台裝置的瀏覽器，不會上傳；「分享」會把班表（含姓名）放在網址裡，拿到連結的人都看得到。</li></ul>';
function showWarn(){ openModal(WARN_HTML + '<div class="vstack"><button class="btn" data-act="close">我知道了</button></div>'); }
function sec(id, title, val, body){ return '<details class="set-sec" data-sec="' + id + '"><summary><span class="sst">' + title + '</span><span class="ssv">' + esc(val) + '</span></summary><div class="set-body">' + body + '</div></details>'; }
function openSettings(){
  var xl = lsGet('fsize') === 'xl';
  openModal('<div class="bar"><h2 style="flex:1 1 0">⚙ 常用設定</h2><button class="ibtn" data-act="foldall">全部展開／收合</button></div>' +
    sec('data', '班表資料', S.staff.length + ' 人・' + S.shifts.length + ' 種班', '<p class="small">資料只存在這台裝置。換電腦或手機前先下載備份檔，再到新裝置還原。</p><div class="vstack"><button class="btn" data-act="backup">下載備份檔</button><button class="btn alt" data-act="restore">從備份檔還原</button><button class="btn alt" data-act="csv">下載班表 CSV</button><button class="btn red" data-act="wipe">清除全部資料</button></div><input type="file" id="restoreFile" accept=".json,application/json" hidden>') +
    sec('view', '顯示', xl ? '大字' : '標準字', '<div class="vstack"><button class="btn' + (xl ? ' alt' : '') + '" data-fontsize="m">標準字</button><button class="btn' + (xl ? '' : ' alt') + '" data-fontsize="xl">大字</button></div>') +
    sec('about', '關於本工具', '', '<p>👤 創作者 Mark Tsai（蔡豐全）<br><a href="manual.html#creator">創作者資料與聯絡方式</a></p><div class="vstack"><a class="btn alt" href="manual.html">📖 操作手冊</a><button class="btn alt" data-act="warn">⚠ 使用警語</button>' +
      (standalone ? '' : '<button class="btn alt" data-act="install">📲 加入主畫面</button>') + '</div><p class="small" style="margin-top:.5rem">訪客數 <img src="' + COUNTER + '" alt="訪客次數" height="20" loading="lazy" style="vertical-align:middle"></p>') +
    '<div class="vstack"><button class="btn" data-act="close">關閉</button></div>');
  var open = lsJson('fold', []);
  document.querySelectorAll('.set-sec').forEach(function(d){ d.open = open.indexOf(d.dataset.sec) >= 0; d.addEventListener('toggle', saveFold); });
  $('restoreFile').addEventListener('change', restoreFile);
}
function saveFold(){ var o = []; document.querySelectorAll('.set-sec').forEach(function(d){ if(d.open) o.push(d.dataset.sec); }); lsSet('fold', JSON.stringify(o)); }
function applyView(){ document.documentElement.dataset.fsize = lsGet('fsize') === 'xl' ? 'xl' : 'm'; }
function tplModal(){
  openModal('<h2>換成哪一種店？</h2><p class="small">會取代目前的班別、人員與班表（建議先在 ⚙ 下載備份）。範例的店名、人名、薪資都是虛構的。</p><div class="tpl">' +
    D.PRESETS.map(function(k){ var i = D.presetInfo(k); return '<button data-tpl="' + k + '"><b>' + i.label + '</b><span>' + i.hint + '</span></button>'; }).join('') +
    '<button data-tpl="blank"><b>📄 空白</b><span>2 種班、3 個人，自己改</span></button></div><div class="vstack"><button class="btn alt" data-act="close">取消</button></div>');
}

/* ---------- 檔案、分享 ---------- */
function download(name, text, type){ var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], {type:type})); a.download = name; document.body.appendChild(a); a.click(); setTimeout(function(){ URL.revokeObjectURL(a.href); a.remove(); }, 500); }
function b64e(s){ return btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
function b64d(s){ s = s.replace(/-/g, '+').replace(/_/g, '/'); while(s.length % 4) s += '='; return decodeURIComponent(escape(atob(s))); }
function shareURL(){ return location.href.split('#')[0] + '#s=' + b64e(JSON.stringify(D.normalize(S))); }
function readShare(){ var m = /#s=([A-Za-z0-9_-]+)/.exec(location.hash); if(!m) return null; try{ var j = JSON.parse(b64d(m[1])); return Array.isArray(j.shifts) ? D.normalize(j) : null; }catch(e){ return null; } }
function copy(text, msg){
  function done(){ toast(msg); }
  function fb(){ var ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select(); try{ document.execCommand('copy'); done(); }catch(e){ toast('複製失敗，請手動選取'); } ta.remove(); }
  if(navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, fb); else fb();
}
function restoreFile(ev){
  var f = ev.target.files[0]; if(!f) return;
  var rd = new FileReader();
  rd.onload = function(){
    try{ var j = JSON.parse(rd.result); if(j.app !== 'staff-shift-planner' || !j.state || !Array.isArray(j.state.shifts)) throw 0; S = D.normalize(j.state); save(); closeModal(); render(); toast('已還原備份'); }
    catch(e){ toast('這不是員工排班表的備份檔'); }
  };
  rd.readAsText(f);
  ev.target.value = '';
}
function shiftWeek(n){ var d = D.parseYmd(D.normalize(S).week); d.setDate(d.getDate() + 7 * n); S.week = D.ymd(d); save(); render(); toast('換到 ' + D.weekTitle(S) + '，沿用原本的班表'); }
function gotoCell(who, day){
  V.tab = 'board'; lsSet('tab', V.tab); render();
  var el = who ? document.querySelector('[data-cell="' + who + '|' + day + '"]') : document.querySelector('[data-cell$="|' + day + '"]');
  if(el){ el.scrollIntoView({behavior:'smooth', block:'center', inline:'center'}); el.classList.add('flash'); setTimeout(function(){ el.classList.remove('flash'); }, 2600); }
}

/* ---------- 事件 ---------- */
var ACT = {
  settings:openSettings, close:closeModal, warn:showWarn, print:function(){ window.print(); }, tpl:tplModal,
  foldall:function(){ var d = document.querySelectorAll('.set-sec'), any = Array.prototype.some.call(d, function(x){ return !x.open; }); d.forEach(function(x){ x.open = any; }); saveFold(); },
  auto:function(){
    var f = D.autoFill(S); S.grid = f.grid; save(); refresh();
    var u = f.unfilled.reduce(function(a, x){ return a + x.n; }, 0);
    toast(f.added ? '排了 ' + f.added + ' 格' + (u ? '，還有 ' + u + ' 個人次排不進去（人手不夠或會違規）' : '，全部排滿') : (u ? '排不進去：人手不夠或會違規' : '已經排滿了'));
  },
  clear:function(){ openModal('<h2>清空這週的班表？</h2><p>班別、人員與需求會保留，只清掉排好的班。</p><div class="vstack"><button class="btn red" data-act="clearYes">清空</button><button class="btn alt" data-act="close">取消</button></div>'); },
  clearYes:function(){ S.grid = {}; S = D.normalize(S); save(); closeModal(); refresh(); toast('已清空，可以再按「🪄 自動排班」'); },
  weekPrev:function(){ shiftWeek(-1); }, weekNext:function(){ shiftWeek(1); },
  line:function(){ copy(D.lineText(S), '已複製班表文字，可以貼到 LINE 群組'); },
  csv:function(){ download('班表-' + D.normalize(S).shop + '-' + D.normalize(S).week + '.csv', D.csvText(S), 'text/csv;charset=utf-8'); },
  share:function(){ var u = shareURL(); copy(u, '已複製分享連結（連結裡有員工姓名）'); if(u.length > 1800) setTimeout(function(){ toast('連結比較長，有些通訊軟體可能會截斷'); }, 3100); },
  keepShared:function(){ openModal('<h2>存成我的班表？</h2><p>會用分享的班表取代你這台裝置上原本的資料。</p><div class="vstack"><button class="btn" data-act="keepYes">取代並存檔</button><button class="btn alt" data-act="close">取消</button></div>'); },
  keepYes:function(){ viewOnly = false; saved = null; save(); history.replaceState(null, '', location.pathname + location.search); closeModal(); render(); toast('已存成你的班表'); },
  leaveShared:function(){ viewOnly = false; S = saved || load(); saved = null; history.replaceState(null, '', location.pathname + location.search); render(); toast('已回到你自己的班表'); },
  addShift:function(){ if(S.shifts.length >= D.MAX_SHIFTS) return; var id = D.uid('s', S.shifts); S.shifts.push(D.newShift({id:id, name:'新班別', start:'12:00', end:'20:00', brk:30})); S = D.normalize(S); save(); render(); },
  addStaff:function(){ if(S.staff.length >= D.MAX_STAFF) return; var id = D.uid('p', S.staff); S.staff.push(D.newStaff({id:id, name:'員工 ' + (S.staff.length + 1)})); S = D.normalize(S); save(); render(); var el = document.querySelector('[data-st="' + (S.staff.length - 1) + '"][data-k=name]'); if(el){ el.focus(); el.select(); } },
  backup:function(){ download('員工排班表備份-' + today() + '.json', JSON.stringify({app:'staff-shift-planner', v:1, saved:new Date().toISOString(), state:D.normalize(S)}, null, 1), 'application/json'); },
  restore:function(){ $('restoreFile').click(); },
  wipe:function(){ openModal('<h2>清除全部資料？</h2><p>班別、人員與班表都會刪掉，無法復原。建議先下載備份檔。</p><div class="vstack"><button class="btn red" data-act="wipeYes">確定清除</button><button class="btn alt" data-act="close">取消</button></div>'); },
  wipeYes:function(){ lsDel('state'); viewOnly = false; S = defaults(); closeModal(); render(); toast('已清除，回到範例店'); },
  install:function(){
    var m = ios ? '請按 Safari 下方的「分享」圖示，選「加入主畫面」。' : '請按瀏覽器網址列右側的安裝圖示，或右上角選單的「安裝應用程式／加到主畫面」。';
    if(window._dp){ window._dp.prompt(); window._dp.userChoice.then(function(){ window._dp = null; }); }
    else openModal('<h2>📲 加入主畫面</h2><p>' + m + '</p><div class="vstack"><button class="btn" data-act="close">知道了</button></div>');
  }
};
document.addEventListener('click', function(ev){
  var el = ev.target.closest('[data-act],[data-tab],[data-fontsize],[data-cell],[data-pick],[data-tpl],[data-delsh],[data-delst],[data-pay],[data-offp],[data-fillrow],[data-goto]');
  if(!el){ if(ev.target.id === 'modal') closeModal(); return; }
  var ds = el.dataset;
  if(ds.act){ if(el.tagName === 'A') ev.preventDefault(); if(ACT[ds.act]) ACT[ds.act](); return; }
  if(ds.tab){ V.tab = ds.tab; lsSet('tab', V.tab); document.querySelectorAll('.tabs button').forEach(function(b){ b.setAttribute('aria-selected', b.dataset.tab === V.tab); }); document.querySelectorAll('.panel').forEach(function(s){ s.hidden = s.dataset.p !== V.tab; }); if(el.classList.contains('kpi')) $('panel-' + V.tab).scrollIntoView({behavior:'smooth', block:'start'}); return; }
  if(ds.fontsize){ lsSet('fsize', ds.fontsize); applyView(); openSettings(); return; }
  if(ds.cell){ var c = ds.cell.split('|'); pickModal(c[0], +c[1]); return; }
  if(ds.pick != null){ var k = ds.pick.split('|'); S = D.normalize(S); S.grid[k[0]][+k[1]] = k[2]; save(); closeModal(); refresh(); var cell = document.querySelector('[data-cell="' + k[0] + '|' + k[1] + '"]'); if(cell) cell.focus(); return; }
  if(ds.tpl){ S = ds.tpl === 'blank' ? D.emptyState() : D.preset(ds.tpl); save(); closeModal(); render(); toast('已套用，接著可以改班別、人員，或按「🪄 自動排班」'); return; }
  if(ds.delsh != null){ var sh = S.shifts[+ds.delsh]; S.shifts.splice(+ds.delsh, 1); S = D.normalize(S); save(); render(); toast('已刪除班別「' + sh.name + '」，排在這個班的格子改成休'); return; }
  if(ds.delst != null){ var p = S.staff[+ds.delst]; S.staff.splice(+ds.delst, 1); S = D.normalize(S); save(); render(); toast('已刪除「' + p.name + '」'); return; }
  if(ds.pay != null){ var pp = S.staff[+ds.pay]; if(pp.pay !== ds.val){ pp.pay = ds.val; pp.wage = ds.val === 'month' ? 32000 : 200; } save(); render(); return; }
  if(ds.offp != null){ var q = S.staff[+ds.offp], d = +ds.d, off = q.off || (q.off = []), i = off.indexOf(d); if(i >= 0) off.splice(i, 1); else off.push(d); el.setAttribute('aria-pressed', i < 0); save(); refresh(); return; }
  if(ds.fillrow){ var row = S.need[ds.fillrow]; for(var j = 1; j < 7; j++) row[j] = row[0]; save(); render(); toast('已把週一的人數套用到整週'); return; }
  if(ds.goto != null){ var g = ds.goto.split('|'); gotoCell(g[0], +g[1]); return; }
});
document.addEventListener('input', function(ev){
  var t = ev.target, ds = t.dataset, v = t.type === 'number' ? (t.value === '' ? '' : Number(t.value)) : t.value;
  if(ds.g === 'shop'){ S.shop = t.value; save(); return; }
  if(ds.sh != null){ S.shifts[+ds.sh][ds.k] = v; save(); refresh(); return; }
  if(ds.need){ S.need[ds.need][+ds.d] = v; save(); refresh(); return; }
  if(ds.st != null){ S.staff[+ds.st][ds.k] = v; save(); refresh(); }
});
// 離開欄位時把空白或超出範圍的值整理回合法值（只有真的被修正才動，避免吃掉使用者的下一次點擊）
document.addEventListener('change', function(ev){
  var t = ev.target, ds = t.dataset;
  if(ds.g === 'week'){ var d = D.parseYmd(t.value); if(d){ S.week = D.ymd(D.mondayOf(d)); save(); render(); } else t.value = D.normalize(S).week; return; }
  if(ds.g === 'shop'){ var n0 = D.normalize(S).shop; if(t.value !== n0){ S.shop = n0; t.value = n0; save(); } render(); return; }
  if(ds.child != null){ S.staff[+ds.child].child = t.checked; save(); refresh(); return; }
  if(ds.sh != null || ds.need || ds.st != null){
    var n = D.normalize(S), src, dst, key;
    if(ds.sh != null){ src = S.shifts[+ds.sh]; dst = n.shifts[+ds.sh]; key = ds.k; }
    else if(ds.st != null){ src = S.staff[+ds.st]; dst = n.staff[+ds.st]; key = ds.k; }
    else { src = S.need[ds.need]; dst = n.need[ds.need]; key = +ds.d; }
    if(dst && src[key] !== dst[key]){ src[key] = dst[key]; t.value = dst[key]; save(); refresh(); }
  }
});
document.addEventListener('keydown', function(e){ if(e.key === 'Escape' && $('modal').classList.contains('show')) closeModal(); });

/* ---------- 跑馬燈（工作區共用公告，不可關） ---------- */
function initMarquee(){
  var URL_ = "https://script.google.com/macros/s/AKfycbwKX0DNNbY8y4nf90BFTHtxgfqJcHHcZasRrgycl4QAe52_hkjMWSkYk4xOsqU-JPCROw/exec";
  var REFRESH = 20 * 60 * 1000, bar = $('marqueeBar'), track = $('marqueeTrack'), lastKey = null;
  function appendText(c, text){ var re = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, li = 0, m; while((m = re.exec(text))){ if(m.index > li) c.appendChild(document.createTextNode(text.slice(li, m.index))); var a = document.createElement('a'); a.href = m[2]; a.textContent = m[1]; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.style.color = 'inherit'; a.style.textDecoration = 'underline'; c.appendChild(a); li = re.lastIndex; } if(li < text.length) c.appendChild(document.createTextNode(text.slice(li))); }
  function renderM(items){
    if(!items || !items.length) return;
    var k = JSON.stringify(items); if(k === lastKey) return; lastKey = k; track.innerHTML = '';
    var fr = document.createDocumentFragment();
    function pass(){ items.forEach(function(it, i){ if(i > 0) fr.appendChild(document.createTextNode('　★　')); appendText(fr, String(it)); }); }
    pass(); fr.appendChild(document.createTextNode('　★　')); pass(); track.appendChild(fr);
    bar.classList.add('show'); document.body.classList.add('has-marquee');
    track.style.animationDuration = Math.max(track.scrollWidth / 2 / 60, 12) + 's';
  }
  function fetchM(){ fetch(URL_, {method:'POST', body:JSON.stringify({serial:''})}).then(function(r){ return r.json(); }).then(function(d){ if(d && Array.isArray(d.marquee) && d.marquee.length){ lsSet('marquee', JSON.stringify(d.marquee)); renderM(d.marquee); } }).catch(function(){}); }
  renderM(lsJson('marquee', [])); fetchM(); setInterval(fetchM, REFRESH);
}

/* ---------- 啟動 ---------- */
window.addEventListener('beforeinstallprompt', function(e){ e.preventDefault(); window._dp = e; });
if('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('service-worker.js').catch(function(){});
(function(){ if(!window.TOOL_WATERMARK) return; var w = document.createElement('div'); w.id = 'pdfWatermark'; w.setAttribute('aria-hidden', 'true'); w.innerHTML = '<img alt="" src="' + window.TOOL_WATERMARK + '">'; document.body.appendChild(w); })();
var shared = readShare();
if(shared){ saved = S; S = shared; viewOnly = true; }
applyView(); render(); initMarquee();
if(!lsGet('warnSeen')){ lsSet('warnSeen', '1'); showWarn(); }
// 測試掛鉤
window._tool = {render:render, analyze:analyze, get S(){ return S; }, get V(){ return V; }, get viewOnly(){ return viewOnly; }};
})();
