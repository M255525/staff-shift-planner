// node tools/test_engine.mjs
import {createRequire} from 'node:module';
const require = createRequire(import.meta.url);
const M = require('../data.js');
let n = 0, bad = 0;
const near = (a, b, e = 1e-6) => a === b || Math.abs(a - b) <= e * Math.max(1, Math.abs(b));
function eq(name, got, want){ n++; const ok = typeof want === 'number' ? near(got, want) : JSON.stringify(got) === JSON.stringify(want); if(!ok){ bad++; console.log('✗', name, '\n  得到', got, '\n  應為', want); } }
function ok(name, cond, extra){ n++; if(!cond){ bad++; console.log('✗', name, extra === undefined ? '' : extra); } }
const has = (a, key, who) => a.issues.some(i => i.key === key && (who === undefined || i.who === who));
const lv = (a, key) => (a.issues.find(i => i.key === key) || {}).lv;

// ---------- 時間 ----------
eq('07:00 = 420 分', M.tmin('07:00'), 420);
eq('亂打的時間', M.tmin('7點'), null);
eq('24:00 可以', M.tmin('24:00'), 1440);
eq('24:30 不行', M.tmin('24:30'), null);
let sp = M.span({start:'07:00', end:'15:00', brk:30});
eq('早班 8 小時扣休息 30 分 = 7.5', sp.work, 7.5);
sp = M.span({start:'23:00', end:'07:00', brk:30});
eq('大夜跨午夜 8 小時', sp.dur, 8); eq('大夜結束 = 隔天 07:00', sp.e, 1860);
ok('大夜在童工禁止時段', M.nightOverlap(sp));
ok('08–16 不在夜間', !M.nightOverlap(M.span({start:'08:00', end:'16:00', brk:0})));
ok('15–20:30 碰到 20:00 之後', M.nightOverlap(M.span({start:'15:00', end:'20:30', brk:0})));
ok('15–20:00 剛好結束不算', !M.nightOverlap(M.span({start:'15:00', end:'20:00', brk:0})));
ok('05:00 開始碰到清晨', M.nightOverlap(M.span({start:'05:00', end:'09:00', brk:0})));

// ---------- 週次 ----------
eq('任何一天都回到週一', M.ymd(M.mondayOf(new Date(2026, 10, 27))), '2026-11-23');
eq('週日回到同週週一', M.ymd(M.mondayOf(new Date(2026, 10, 29))), '2026-11-23');
eq('下週一', M.nextMonday(new Date(2026, 10, 21)), '2026-11-23');
eq('正規化會把週次改成週一', M.normalize({week:'2026-11-26'}).week, '2026-11-23');
eq('週標題', M.weekTitle({week:'2026-11-23'}), '11/23（一）～11/29（日）');

// ---------- 加班費（與雇主人事成本試算同倍率） ----------
eq('平日加班 2 小時 ×4/3', M.otWeekday(300, 2), 800);
eq('平日加班 3 小時：2×4/3＋1×5/3', M.otWeekday(300, 3), 300 * (8 / 3 + 5 / 3));
eq('平日加班最多算 4 小時', M.otWeekday(300, 6), M.otWeekday(300, 4));
eq('休息日 10 小時：2×4/3＋6×5/3＋2×8/3', M.otRestday(150, 10), 150 * (8 / 3 + 10 + 16 / 3));
eq('月薪 36000 換算時薪 150', M.hourlyOf({pay:'month', wage:36000}), 150);

// ---------- 手算案例：時薪 200、每天 9–20 休 1 小時（實際 10 小時） ----------
const base = (o = {}) => Object.assign({week:'2026-11-23', shifts:[{id:'a', name:'長班', start:'09:00', end:'20:00', brk:60}], staff:[{id:'p', name:'小明', wage:200, maxDays:7, maxHours:84}], need:{a:[0, 0, 0, 0, 0, 0, 0]}, grid:{p:['a', 'a', 'a', 'a', 'a', '', '']}}, o);
let a = M.analyze(base());
let x = a.people[0];
eq('5 天 50 小時', x.hours, 50);
eq('平日加班 10 小時', x.weekdayOT, 10);
eq('正常工時薪資 5×8×200', x.base, 8000);
eq('加班費 5×2×4/3×200', x.otPay, 5 * 2 * 4 / 3 * 200);
eq('本週合計', x.total, 8000 + 5 * 2 * 4 / 3 * 200);
eq('每月推估 = 本週 × 52/12', x.month, x.total * 52 / 12);
ok('班別本身就會加班（黃）', lv(a, 'shiftOT') === 'yellow');
ok('每週 10 小時、每月約 43 小時：黃燈', lv(a, 'ot') === 'yellow' && !has(a, 'otMonth'));
ok('上 5 天沒有休息日警告', !has(a, 'restday') && !has(a, 'holiday'));

// 第 6 天＝休息日出勤
a = M.analyze(base({grid:{p:['a', 'a', 'a', 'a', 'a', 'a', '']}}));
x = a.people[0];
eq('休息日 10 小時', x.restHours, 10);
eq('時薪的人休息日：原本工資＋另再加給', x.base, 8000 + 10 * 200);
eq('休息日加給', x.restPay, M.otRestday(200, 10));
ok('上 6 天：黃燈', lv(a, 'restday') === 'yellow');
ok('每週加班 20 小時、每月約 87 小時：紅燈', lv(a, 'otMonth') === 'red');
// 第 7 天＝例假出勤
a = M.analyze(base({grid:{p:['a', 'a', 'a', 'a', 'a', 'a', 'a']}}));
ok('上 7 天：紅燈', lv(a, 'holiday') === 'red' && a.issues.find(i => i.key === 'holiday').day === 6);
eq('例假出勤工資加倍', a.people[0].holPay, 10 * 200 * 2);

// 月薪
a = M.analyze(base({staff:[{id:'p', name:'店長', pay:'month', wage:36000, maxDays:7, maxHours:84}]}));
x = a.people[0];
eq('月薪本週基本 = 月薪 ÷ 52/12', x.base, 36000 * 12 / 52);
eq('月薪加班以月薪 ÷ 240 計', x.otPay, 5 * M.otWeekday(150, 2));
a = M.analyze(base({staff:[{id:'p', name:'店長', pay:'month', wage:36000, maxDays:7, maxHours:84}], grid:{p:['a', 'a', 'a', 'a', 'a', 'a', 'a']}}));
eq('月薪例假出勤另加一日工資', a.people[0].holPay, 150 * 8);

// 基本工資
ok('時薪 195 紅燈', has(M.analyze(base({staff:[{id:'p', name:'x', wage:195}]})), 'minHourly'));
ok('時薪 196 不亮', !has(M.analyze(base({staff:[{id:'p', name:'x', wage:196}]})), 'minHourly'));
ok('月薪 29000 紅燈', has(M.analyze(base({staff:[{id:'p', name:'x', pay:'month', wage:29000}]})), 'minWage'));

// 班別本身
ok('一天 13 小時：紅燈', lv(M.analyze(base({shifts:[{id:'a', name:'x', start:'08:00', end:'22:00', brk:60}]})), 'shiftLong') === 'red');
ok('連續 5 小時沒休息：紅燈', lv(M.analyze(base({shifts:[{id:'a', name:'x', start:'09:00', end:'14:00', brk:0}]})), 'shiftBreak') === 'red');
ok('剛好 4 小時不用休息', !has(M.analyze(base({shifts:[{id:'a', name:'x', start:'10:30', end:'14:30', brk:0}]})), 'shiftBreak'));

// 換班間隔
const two = {week:'2026-11-23', shifts:[{id:'e', name:'早班', start:'07:00', end:'15:00', brk:30}, {id:'l', name:'晚班', start:'15:00', end:'23:00', brk:30}, {id:'n', name:'大夜', start:'23:00', end:'07:00', brk:30}], staff:[{id:'p', name:'小華'}], need:{}};
a = M.analyze(Object.assign({}, two, {grid:{p:['l', 'e', '', '', '', '', '']}}));
ok('晚班接早班只隔 8 小時：紅燈', lv(a, 'gap') === 'red' && a.issues.find(i => i.key === 'gap').day === 1);
ok('大夜接大夜沒問題', !has(M.analyze(Object.assign({}, two, {grid:{p:['n', 'n', '', '', '', '', '']}})), 'gap'));
ok('大夜接早班隔 0 小時：紅燈', has(M.analyze(Object.assign({}, two, {grid:{p:['n', 'e', '', '', '', '', '']}})), 'gap'));
ok('早班接晚班隔 24 小時', !has(M.analyze(Object.assign({}, two, {grid:{p:['e', 'l', '', '', '', '', '']}})), 'gap'));

// 童工
a = M.analyze(Object.assign({}, two, {staff:[{id:'c', name:'小弟', child:true}], grid:{c:['l', '', '', '', '', '', '']}}));
ok('童工排晚班：紅燈', lv(a, 'childNight') === 'red');
a = M.analyze(base({staff:[{id:'p', name:'小弟', child:true, maxDays:7, maxHours:84}]}));
ok('童工一天 10 小時：紅燈', has(a, 'childDay') && has(a, 'childWeek'));

// 個人設定
a = M.analyze(base({staff:[{id:'p', name:'小明', wage:200, off:[0], maxDays:3, maxHours:20}]}));
ok('排在不能上的日子', has(a, 'unavailable') && a.issues.find(i => i.key === 'unavailable').day === 0);
ok('超過每週天數', has(a, 'maxDays')); ok('超過每週時數', has(a, 'maxHours'));

// 人力需求
a = M.analyze(base({need:{a:[2, 1, 0, 0, 0, 0, 0]}}));
eq('週一缺 1 人', a.short, 1); eq('週三多 1 人', a.over, 3);
eq('涵蓋率 2/3', a.coverPct, 2 / 3);
ok('缺人是紅燈', lv(a, 'short') === 'red');

// ---------- 正規化 ----------
let s = M.normalize({shifts:[{id:'a', start:'亂打', end:'', brk:-5}], staff:[{id:'p', wage:'', maxDays:9, off:[0, 0, 8, 1.5, 2]}], need:{a:[1, -2, 'x', 3.6]}, grid:{p:['a', 'zz', 'a']}});
eq('壞時間回預設', [s.shifts[0].start, s.shifts[0].end, s.shifts[0].brk], ['09:00', '17:00', 0]);
eq('空白時薪回預設', s.staff[0].wage, 200);
eq('天數上限 7', s.staff[0].maxDays, 7);
eq('不能上的日子去重、去非法', s.staff[0].off, [0, 2]);
eq('需求整理', s.need.a, [1, 0, 0, 4, 0, 0, 0]);
eq('班表只留存在的班別', s.grid.p, ['a', '', 'a', '', '', '', '']);
eq('沒班別、沒人也不會壞', M.analyze({}).issues.length, 0);

// ---------- 自動排班 ----------
const SAFE = ['gap', 'holiday', 'childDay', 'childNight', 'childWeek', 'childRest', 'unavailable', 'maxDays', 'maxHours', 'otMonth'];
for(const k of M.PRESETS){
  const p = M.preset(k);
  ok(k + '：範例名稱標示（範例）', /（範例）/.test(p.shop));
  const f = M.autoFill(p); p.grid = f.grid;
  const r = M.analyze(p);
  ok(k + '：自動排完沒有紅燈', r.red === 0, r.issues.filter(i => i.lv === 'red').map(i => i.msg));
  ok(k + '：全部排滿', f.unfilled.length === 0 && r.short === 0, f.unfilled);
  ok(k + '：沒人上 6 天以上', r.people.every(x => x.days <= 5), r.people.map(x => x.name + x.days));
}
// 月薪的人先排滿正常工時
for(const k of M.PRESETS){
  const p = M.preset(k); p.grid = M.autoFill(p).grid;
  const r = M.analyze(p);
  ok(k + '：月薪的人排到 5 天 35 小時以上', r.people.filter(x => x.pay === 'month').every(x => x.days === 5 && x.hours >= 35), r.people.map(x => x.name + x.days + '天' + x.hours + 'h'));
}
// 手動排的保留
let st = M.preset('cafe'); st.grid.p6 = ['s2', '', '', '', '', '', ''];
let f = M.autoFill(st);
eq('手動排的不會被改', f.grid.p6[0], 's2');
// 自動排班會跳過不能上班的日子
ok('不會排到不能上的日子', M.preset('cafe').staff.every(p => p.off.every(d => !M.autoFill(M.preset('cafe')).grid[p.id][d])));
// 人不夠時回報沒排到的
st = M.normalize({shifts:[{id:'a', start:'09:00', end:'17:00', brk:60}], staff:[{id:'p'}], need:{a:[2, 0, 0, 0, 0, 0, 0]}});
f = M.autoFill(st);
eq('人不夠：週一還缺 1 人', f.unfilled, [{day:0, shift:'a', n:1}]);

// ---------- 亂數：分析不出 NaN；從空白自動排不會產生個人違規 ----------
let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const pick = a => a[Math.floor(rnd() * a.length)];
for(let i = 0; i < 1500; i++){
  const ns = 1 + Math.floor(rnd() * 4), np = 1 + Math.floor(rnd() * 8);
  const shifts = Array.from({length:ns}, (_, j) => { const s = Math.floor(rnd() * 24), len = 3 + Math.floor(rnd() * 10); return {id:'s' + j, name:'班' + j, start:M.hhmm(s * 60 + pick([0, 30])), end:M.hhmm((s + len) * 60), brk:pick([0, 30, 60])}; });
  const staff = Array.from({length:np}, (_, j) => ({id:'p' + j, name:'人' + j, pay:pick(['hour', 'month']), wage:pick([180, 196, 220, 30000, 36000]), maxDays:Math.floor(rnd() * 8), maxHours:Math.floor(rnd() * 60), off:[0, 1, 2, 3, 4, 5, 6].filter(() => rnd() < .25), child:rnd() < .15}));
  const need = Object.fromEntries(shifts.map(s => [s.id, Array.from({length:7}, () => Math.floor(rnd() * 3))]));
  const st0 = {week:'2026-11-23', shifts, staff, need, grid:{}};
  const f0 = M.autoFill(st0); st0.grid = f0.grid;
  const r = M.analyze(st0);
  ok('亂數 #' + i + ' 數值有限', [r.hours, r.cost, r.coverPct].every(isFinite) && r.people.every(x => isFinite(x.total)), st0);
  const badKeys = r.issues.filter(x => SAFE.includes(x.key));
  ok('亂數 #' + i + ' 自動排班沒產生個人違規', badKeys.length === 0, badKeys.map(x => x.msg));
  // 排到的格數 + 沒排到的 = 需求
  const want = Object.values(r.st.need).flat().reduce((a, b) => a + b, 0), got = r.cover.reduce((a, c) => a + Math.min(c.have, c.need), 0);
  ok('亂數 #' + i + ' 需求守恆', got + f0.unfilled.reduce((a, u) => a + u.n, 0) === want);
}

// ---------- 輸出 ----------
st = M.preset('cafe'); st.grid = M.autoFill(st).grid;
const t = M.lineText(st);
ok('LINE 文字每個人都有', st.staff.every(p => t.includes('▍' + p.name)));
ok('LINE 文字有休假', t.includes('休'));
const csv = M.csvText(st);
ok('CSV 有 BOM 與 7 天欄位', csv.charCodeAt(0) === 0xFEFF && csv.split('\r\n')[0].split(',').length === 12);
eq('CSV 一人一列', csv.split('\r\n').length, st.staff.length + 1);

console.log((bad ? '✗ ' : '✓ ') + (n - bad) + '/' + n + ' 通過');
process.exit(bad ? 1 : 0);
