/* 員工排班表：畫面
   範本產生的骨架：跑馬燈、⚙ 常用設定（收合式）、首訪警語、手冊／創作者／加入主畫面／訪客數、
   備份還原、大字、列印浮水印都已接好。功能寫在「主功能」區塊（mainHTML／refresh）。 */
(function(){
'use strict';
var D = window.SSP, PFX = 'ssp.';
function lsGet(k){ try{ return localStorage.getItem(PFX + k); }catch(e){ return null; } }
function lsSet(k, v){ try{ localStorage.setItem(PFX + k, v); }catch(e){} }
function lsDel(k){ try{ localStorage.removeItem(PFX + k); }catch(e){} }
function lsJson(k, d){ try{ var v = JSON.parse(lsGet(k)); return v == null ? d : v; }catch(e){ return d; } }
function $(id){ return document.getElementById(id); }
function esc(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){ return {'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]; }); }
function today(){ var d = new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }

var COUNTER = 'https://visitor-badge.laobi.icu/badge?page_id=m255525.staffshiftplanner';
var standalone = window.matchMedia && matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
var ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
var TABS = [['main', '主功能'], ['about', '說明']];
var V = {tab:lsGet('tab') || 'main'};
if(!TABS.some(function(t){ return t[0] === V.tab; })) V.tab = 'main';

/* ---------- 資料 ---------- */
function defaults(){ return {input:Object.assign({}, D.BASE)}; }
function load(){ var s = lsJson('state', null); return s && s.input ? s : defaults(); }
var S = load();
function save(){ lsSet('state', JSON.stringify(S)); }

/* ---------- 畫面 ---------- */
function render(){
  var h = '<div class="print-head"><h1>員工排班表</h1><div class="small">列印日期 ' + today() + '</div></div>' +
    '<div class="bar"><h1><span class="seal">班</span>員工排班表<small>小店排一週班表：設定班別、人員與每班需要幾個人，自動排班並檢查勞基法工時規定（每日 12 小時、11 小時輪班間隔、例假、連續上班），算出人力成本與加班費，可列印貼牆或傳 LINE。</small></h1>' +
    '<a class="ibtn noprint" href="manual.html">📖 操作手冊</a><button class="ibtn" data-act="print">🖨 列印</button><button class="ibtn" data-act="settings" aria-label="常用設定">⚙</button></div>' +
    '<p class="warn-line">排班檢查依勞動基準法一般工時規定整理，只供排班參考，不是法律意見；變形工時、特殊行業與個案請洽主管機關。<button data-act="warn">⚠ 使用警語</button></p>' +
    '<nav class="tabs" role="tablist">' + TABS.map(function(t){ return '<button role="tab" data-tab="' + t[0] + '" aria-selected="' + (V.tab === t[0]) + '">' + t[1] + '</button>'; }).join('') + '</nav>' +
    TABS.map(function(t){ return '<section class="panel" data-p="' + t[0] + '" id="panel-' + t[0] + '"' + (V.tab === t[0] ? '' : ' hidden') + '></section>'; }).join('') +
    '<footer class="foot">👤 創作者 Mark Tsai（蔡豐全）・<a href="manual.html">📖 操作手冊</a>・<a href="#" data-act="warn">⚠ 使用警語</a>' + (standalone ? '' : '・<a href="#" data-act="install">📲 加入主畫面</a>') +
    '<br><img src="' + COUNTER + '" alt="訪客次數" height="20" loading="lazy" style="vertical-align:middle;margin-top:.4rem"></footer>';
  $('app').innerHTML = h;
  $('panel-main').innerHTML = mainHTML();
  $('panel-about').innerHTML = aboutHTML();
  refresh();
}
function fld(k, label, unit, hint){
  return '<label class="fld">' + label + '<input type="number" inputmode="decimal" data-f="' + k + '" value="' + esc(S.input[k]) + '">' + (hint ? '<small>' + hint + '</small>' : '') + '</label>';
}
// ── 主功能：範例表單，換成這個工具真正的介面 ──
function mainHTML(){
  return '<div class="card"><h3>輸入</h3><div class="row">' +
    fld('qty', '數量') + fld('price', '單價（元）') + fld('discount', '折扣（%）', '', '0～100') +
    '</div><div class="result" id="result"></div>' +
    '<div class="btns"><button class="btn alt" data-act="reset">恢復預設值</button></div></div>';
}
// 輸入時只更新結果、不重繪表單，焦點才不會跑掉
function refresh(){
  var r = D.calc(S.input);
  var el = $('result'); if(el) el.innerHTML = '小計 <span class="num">' + D.money(r.gross) + '</span>・合計 <b>' + D.money(r.total) + '</b>';
}
function aboutHTML(){
  return '<div class="card"><h3>這是什麼</h3><p>小店排一週班表：設定班別、人員與每班需要幾個人，自動排班並檢查勞基法工時規定（每日 12 小時、11 小時輪班間隔、例假、連續上班），算出人力成本與加班費，可列印貼牆或傳 LINE。</p><p class="small">詳細步驟請看 <a href="manual.html">📖 操作手冊</a>。</p></div>';
}

/* ---------- 彈窗、警語、設定 ---------- */
function openModal(h){ $('modalBox').innerHTML = h; $('modal').classList.add('show'); $('modalBox').scrollTop = 0; var f = $('modalBox').querySelector('button,a,input'); if(f) f.focus(); }
function closeModal(){ $('modal').classList.remove('show'); }
var toastT;
function toast(m){ var o = document.querySelector('.toast'); if(o) o.remove(); var t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); t.textContent = m; document.body.appendChild(t); clearTimeout(toastT); toastT = setTimeout(function(){ t.remove(); }, 3000); }
// 使用警語：頁面上看得到（warn-line、頁尾、⚙），首次造訪自動跳出一次
var WARN_HTML = '<h2>⚠ 使用警語</h2><ul>' +
  '<li>排班檢查依勞動基準法一般工時規定整理，只供排班參考，不是法律意見；變形工時、特殊行業與個案請洽主管機關。</li>' +
  '<li>資料只存在這台裝置的瀏覽器，不會上傳；換裝置前請先在 ⚙ 下載備份檔。</li>' +
  '<li>（範本產生）請依這個工具的性質補上：數字來源與查證日期、規則是自訂的經驗法則、範例全部虛構、不可宣稱的功效等。</li></ul>';
function showWarn(){ openModal(WARN_HTML + '<div class="vstack"><button class="btn" data-act="close">我知道了</button></div>'); }
function sec(id, title, val, body){ return '<details class="set-sec" data-sec="' + id + '"><summary><span class="sst">' + title + '</span><span class="ssv">' + esc(val) + '</span></summary><div class="set-body">' + body + '</div></details>'; }
function openSettings(){
  var xl = lsGet('fsize') === 'xl';
  openModal('<div class="bar"><h2 style="flex:1 1 0">⚙ 常用設定</h2><button class="ibtn" data-act="foldall">全部展開／收合</button></div>' +
    sec('data', '資料', '只存在這台裝置', '<p class="small">換電腦或手機前先下載備份檔，再到新裝置還原。</p><div class="vstack"><button class="btn" data-act="backup">下載備份檔</button><button class="btn alt" data-act="restore">從備份檔還原</button><button class="btn red" data-act="wipe">清除全部資料</button></div><input type="file" id="restoreFile" accept=".json,application/json" hidden>') +
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

/* ---------- 檔案 ---------- */
function download(name, text, type){ var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], {type:type})); a.download = name; document.body.appendChild(a); a.click(); setTimeout(function(){ URL.revokeObjectURL(a.href); a.remove(); }, 500); }
function restoreFile(ev){
  var f = ev.target.files[0]; if(!f) return;
  var rd = new FileReader();
  rd.onload = function(){
    try{ var j = JSON.parse(rd.result); if(j.app !== 'staff-shift-planner' || !j.state || !j.state.input) throw 0; S = {input:D.normalize(j.state.input)}; save(); closeModal(); render(); toast('已還原備份'); }
    catch(e){ toast('這不是員工排班表的備份檔'); }
  };
  rd.readAsText(f);
}

/* ---------- 事件 ---------- */
var ACT = {
  settings:openSettings, close:closeModal, warn:showWarn, print:function(){ window.print(); },
  foldall:function(){ var d = document.querySelectorAll('.set-sec'), any = Array.prototype.some.call(d, function(x){ return !x.open; }); d.forEach(function(x){ x.open = any; }); saveFold(); },
  reset:function(){ S = defaults(); save(); render(); toast('已恢復預設值'); },
  backup:function(){ download('員工排班表備份-' + today() + '.json', JSON.stringify({app:'staff-shift-planner', v:1, saved:new Date().toISOString(), state:S}, null, 1), 'application/json'); },
  restore:function(){ $('restoreFile').click(); },
  wipe:function(){ openModal('<h2>清除全部資料？</h2><p>這台裝置上的資料都會刪掉，無法復原。建議先下載備份檔。</p><div class="vstack"><button class="btn red" data-act="wipeYes">確定清除</button><button class="btn alt" data-act="close">取消</button></div>'); },
  wipeYes:function(){ lsDel('state'); S = defaults(); closeModal(); render(); toast('已清除'); },
  install:function(){
    var m = ios ? '請按 Safari 下方的「分享」圖示，選「加入主畫面」。' : '請按瀏覽器網址列右側的安裝圖示，或右上角選單的「安裝應用程式／加到主畫面」。';
    if(window._dp){ window._dp.prompt(); window._dp.userChoice.then(function(){ window._dp = null; }); }
    else openModal('<h2>📲 加入主畫面</h2><p>' + m + '</p><div class="vstack"><button class="btn" data-act="close">知道了</button></div>');
  }
};
document.addEventListener('click', function(ev){
  var el = ev.target.closest('[data-act],[data-tab],[data-fontsize]');
  if(!el){ if(ev.target.id === 'modal') closeModal(); return; }
  var ds = el.dataset;
  if(ds.act){ if(el.tagName === 'A') ev.preventDefault(); if(ACT[ds.act]) ACT[ds.act](); return; }
  if(ds.tab){ V.tab = ds.tab; lsSet('tab', V.tab); document.querySelectorAll('.tabs button').forEach(function(b){ b.setAttribute('aria-selected', b.dataset.tab === V.tab); }); document.querySelectorAll('.panel').forEach(function(s){ s.hidden = s.dataset.p !== V.tab; }); return; }
  if(ds.fontsize){ lsSet('fsize', ds.fontsize); applyView(); openSettings(); return; }
});
document.addEventListener('input', function(ev){
  var t = ev.target, ds = t.dataset;
  if(ds.f){ S.input[ds.f] = t.type === 'number' ? (t.value === '' ? '' : Number(t.value)) : t.value; save(); refresh(); }
});
// 離開欄位時把空白或超出範圍的數字整理回合法值（只有真的被修正才動，避免吃掉使用者的下一次點擊）
document.addEventListener('change', function(ev){
  var t = ev.target;
  if(t.dataset.f && t.type === 'number'){ var k = t.dataset.f, n = D.normalize(S.input); if(S.input[k] !== n[k]){ S.input[k] = n[k]; t.value = n[k]; save(); refresh(); } }
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
applyView(); render(); initMarquee();
if(!lsGet('warnSeen')){ lsSet('warnSeen', '1'); showWarn(); }
// 測試掛鉤
window._tool = {render:render, get S(){ return S; }, get V(){ return V; }};
})();
