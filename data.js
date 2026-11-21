/* 員工排班表：排班與勞基法工時檢查引擎（瀏覽器 window.SSP，node 可 require）
   純函式、不碰 DOM。改了這支檔案跑 node tools/test_engine.mjs
   規則依勞動基準法一般工時（不含變形工時、特殊行業）；基本工資與加班費倍率和
   資料儀表板/employer-payroll-cost-calculator 一致（2026 年：月薪 29,500、時薪 196）。 */
(function(root){
'use strict';

var DAYS = ['一', '二', '三', '四', '五', '六', '日'];
var P = {
  minWage:29500, minHourly:196,   // 基本工資（2026-01-01 起）
  dayMax:12,                      // 第 32 條：正常＋延長每日不得超過 12 小時
  normalDay:8,                    // 第 30 條：每日正常工時 8 小時
  otMonthCap:46,                  // 第 32 條：每月延長工時上限
  restGap:11,                     // 第 34 條：輪班更換班次至少連續 11 小時休息
  breakAfter:4, breakMin:30,      // 第 35 條：繼續工作 4 小時至少休息 30 分鐘
  childDay:8, childWeek:40,       // 第 47 條：童工每日 8、每週 40 小時
  monthHours:240,                 // 月薪換算時薪：月薪 ÷ 30 ÷ 8
  weeksPerMonth:52 / 12
};
var COLORS = ['#E4572E', '#2E86AB', '#E9A23B', '#3BA272', '#7768AE', '#D9488B'];
var MAX_SHIFTS = 6, MAX_STAFF = 30;

function num(v, d){ if(v === '' || v == null) return d; v = Number(v); return isFinite(v) ? v : d; }
function clamp(v, lo, hi, d){ v = num(v, d); return Math.min(hi, Math.max(lo, v)); }
function r1(x){ return Math.round(x * 10) / 10; }
function uid(prefix, list){ var i = list.length + 1; while(list.some(function(x){ return x.id === prefix + i; })) i++; return prefix + i; }

/* ---------- 時間 ---------- */
function tmin(s){
  var m = /^(\d{1,2}):(\d{2})$/.exec(String(s || '').trim());
  if(!m) return null;
  var h = +m[1], mm = +m[2];
  if(h > 24 || mm > 59 || (h === 24 && mm > 0)) return null;
  return h * 60 + mm;
}
function hhmm(min){ min = ((min % 1440) + 1440) % 1440; return ('0' + Math.floor(min / 60)).slice(-2) + ':' + ('0' + (min % 60)).slice(-2); }
// 班別的時間：結束 ≤ 開始代表跨午夜
function span(sh){
  var s = tmin(sh.start), e = tmin(sh.end);
  if(s == null || e == null) return null;
  if(s === 1440) s = 0;
  if(e <= s) e += 1440;
  var dur = (e - s) / 60, brk = clamp(sh.brk, 0, 600, 0) / 60;
  return {s:s, e:e, dur:dur, brk:Math.min(brk, dur), work:Math.max(0, dur - brk)};
}
// 20:00～隔天 06:00 是否有任何重疊（童工夜間禁止工作，第 48 條）
function nightOverlap(sp){
  for(var base = -1440; base <= 1440; base += 1440){
    var a = base + 20 * 60, b = base + 30 * 60;   // 當天 20:00 到隔天 06:00
    if(sp.s < b && sp.e > a) return true;
  }
  return false;
}

/* ---------- 正規化 ---------- */
function newShift(x){ x = x || {}; return {id:x.id || 's1', name:String(x.name == null ? '早班' : x.name).slice(0, 8), start:x.start || '09:00', end:x.end || '17:00', brk:x.brk == null ? 60 : x.brk}; }
function newStaff(x){
  x = x || {};
  return {id:x.id || 'p1', name:String(x.name == null ? '員工' : x.name).slice(0, 12), pay:x.pay === 'month' ? 'month' : 'hour',
    wage:x.wage == null ? (x.pay === 'month' ? 32000 : 200) : x.wage, maxDays:x.maxDays == null ? 5 : x.maxDays,
    maxHours:x.maxHours == null ? 40 : x.maxHours, off:Array.isArray(x.off) ? x.off.slice() : [], child:!!x.child};
}
function mondayOf(d){ d = new Date(d.getFullYear(), d.getMonth(), d.getDate()); var w = (d.getDay() + 6) % 7; d.setDate(d.getDate() - w); return d; }
function ymd(d){ return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
function parseYmd(s){ var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || ''); if(!m) return null; var d = new Date(+m[1], +m[2] - 1, +m[3]); return isNaN(d) ? null : d; }
function nextMonday(today){ var d = mondayOf(today || new Date()); d.setDate(d.getDate() + 7); return ymd(d); }
function weekDates(week){ var d = parseYmd(week) || mondayOf(new Date()), out = []; for(var i = 0; i < 7; i++){ var x = new Date(d); x.setDate(d.getDate() + i); out.push(x); } return out; }

function normalize(st){
  st = st || {};
  var shifts = (Array.isArray(st.shifts) ? st.shifts : []).slice(0, MAX_SHIFTS).map(function(s, i){
    var n = newShift(s); n.id = String(s.id || 's' + (i + 1)); n.brk = clamp(s.brk, 0, 600, 0);
    if(tmin(n.start) == null) n.start = '09:00'; if(tmin(n.end) == null) n.end = '17:00';
    return n;
  });
  var staff = (Array.isArray(st.staff) ? st.staff : []).slice(0, MAX_STAFF).map(function(p, i){
    var n = newStaff(p); n.id = String(p.id || 'p' + (i + 1));
    n.wage = clamp(p.wage, 0, 1e7, n.pay === 'month' ? 32000 : 200);
    n.maxDays = Math.round(clamp(p.maxDays, 0, 7, 5)); n.maxHours = clamp(p.maxHours, 0, 84, 40);
    n.off = n.off.map(Number).filter(function(d, j, a){ return d >= 0 && d < 7 && d === Math.floor(d) && a.indexOf(d) === j; }).sort();
    return n;
  });
  var need = {}, grid = {}, ids = shifts.map(function(s){ return s.id; });
  shifts.forEach(function(s){
    var row = st.need && Array.isArray(st.need[s.id]) ? st.need[s.id] : [];
    need[s.id] = DAYS.map(function(_, d){ return Math.round(clamp(row[d], 0, 50, 0)); });
  });
  staff.forEach(function(p){
    var row = st.grid && Array.isArray(st.grid[p.id]) ? st.grid[p.id] : [];
    grid[p.id] = DAYS.map(function(_, d){ return ids.indexOf(row[d]) >= 0 ? row[d] : ''; });
  });
  return {shop:String(st.shop == null ? '我的小店' : st.shop).slice(0, 30), week:parseYmd(st.week) ? ymd(mondayOf(parseYmd(st.week))) : nextMonday(), shifts:shifts, staff:staff, need:need, grid:grid};
}

/* ---------- 加班費（與雇主人事成本試算相同倍率） ---------- */
// 平日延長工時：前 2 小時 4/3、再 2 小時 5/3（這些小時原本沒有薪水，所以是全額）
function otWeekday(hourly, h){ h = Math.min(Math.max(h, 0), 4); return hourly * (Math.min(h, 2) * 4 / 3 + Math.max(h - 2, 0) * 5 / 3); }
// 休息日出勤「另再加給」：前 2 小時 4/3、3–8 小時 5/3、9–12 小時 8/3（加在原本的工資之外）
function otRestday(hourly, h){ h = Math.min(Math.max(h, 0), 12); return hourly * (Math.min(h, 2) * 4 / 3 + Math.max(Math.min(h, 8) - 2, 0) * 5 / 3 + Math.max(h - 8, 0) * 8 / 3); }
function hourlyOf(p){ return p.pay === 'month' ? p.wage / P.monthHours : p.wage; }

/* ---------- 分析 ---------- */
function shiftMap(st){ var m = {}; st.shifts.forEach(function(s, i){ m[s.id] = {sh:s, sp:span(s), color:COLORS[i % COLORS.length], idx:i}; }); return m; }

function analyze(raw){
  var st = normalize(raw), SM = shiftMap(st), issues = [];
  function add(lv, key, who, day, msg, law){ issues.push({lv:lv, key:key, who:who, day:day, msg:msg, law:law || ''}); }

  // 班別本身
  st.shifts.forEach(function(s){
    var sp = SM[s.id].sp;
    if(sp.work > P.dayMax) add('red', 'shiftLong', null, null, '「' + s.name + '」實際工作 ' + r1(sp.work) + ' 小時，超過一天 12 小時上限', '勞基法第 32 條');
    if(sp.dur > P.breakAfter && sp.brk * 60 < P.breakMin) add('red', 'shiftBreak', null, null, '「' + s.name + '」連續 ' + r1(sp.dur) + ' 小時，休息只有 ' + Math.round(sp.brk * 60) + ' 分鐘；工作 4 小時要有至少 30 分鐘休息', '勞基法第 35 條');
    if(sp.work > P.normalDay && sp.work <= P.dayMax) add('yellow', 'shiftOT', null, null, '「' + s.name + '」實際工作 ' + r1(sp.work) + ' 小時，每次都有 ' + r1(sp.work - P.normalDay) + ' 小時加班', '勞基法第 24、32 條');
  });

  var people = st.staff.map(function(p){
    var row = st.grid[p.id], hourly = hourlyOf(p);
    var worked = [], hours = 0, weekdayOT = 0, restHours = 0, holidayHours = 0, base = 0, otPay = 0, restPay = 0, holPay = 0;
    row.forEach(function(sid, d){ if(sid) worked.push(d); });
    worked.forEach(function(d, k){
      var sp = SM[row[d]].sp, h = sp.work;
      hours += h;
      // 第 1～5 個上班日是正常工作日；第 6 個算休息日出勤；第 7 個是例假日出勤（第 36、40 條）
      if(k < 5){
        var normal = Math.min(h, P.normalDay), ot = Math.max(0, h - P.normalDay);
        weekdayOT += ot;
        if(p.pay === 'hour') base += normal * hourly;
        otPay += otWeekday(hourly, ot);
      } else if(k === 5){
        restHours += h;
        if(p.pay === 'hour') base += h * hourly;   // 時薪的人休息日原本沒有工資，先付原本的
        restPay += otRestday(hourly, h);
      } else {
        holidayHours += h;
        holPay += p.pay === 'hour' ? h * hourly * 2 : hourly * P.normalDay;   // 例假出勤工資加倍（月薪另加一日工資）
      }
    });
    if(p.pay === 'month') base = p.wage / P.weeksPerMonth;
    var otWeek = weekdayOT + restHours, otMonth = otWeek * P.weeksPerMonth;
    var total = base + otPay + restPay + holPay;

    // 個人的檢查
    var name = p.name;
    if(p.pay === 'hour' && p.wage < P.minHourly) add('red', 'minHourly', p.id, null, name + '：時薪 ' + p.wage + ' 元低於基本工資時薪 ' + P.minHourly + ' 元', '最低工資法');
    if(p.pay === 'month' && p.wage < P.minWage) add('red', 'minWage', p.id, null, name + '：月薪 ' + p.wage + ' 元低於基本工資 ' + P.minWage + ' 元（部分工時月薪請改用時薪）', '最低工資法');
    if(worked.length >= 7) add('red', 'holiday', p.id, worked[6], name + '：7 天都排班，沒有例假。例假日除天災等特殊情況不得要求出勤', '勞基法第 36、40 條');
    else if(worked.length === 6) add('yellow', 'restday', p.id, worked[5], name + '：上 6 天，有 1 天是休息日出勤，要經本人同意並付休息日加班費', '勞基法第 24、36 條');
    if(otMonth > P.otMonthCap) add('red', 'otMonth', p.id, null, name + '：每週加班 ' + r1(otWeek) + ' 小時，照這樣排每月約 ' + Math.round(otMonth) + ' 小時，超過 46 小時上限（勞資會議同意可到 54 小時、每 3 個月 138 小時）', '勞基法第 32 條');
    else if(otWeek > 0) add('yellow', 'ot', p.id, null, name + '：本週加班 ' + r1(otWeek) + ' 小時（平日 ' + r1(weekdayOT) + '、休息日 ' + r1(restHours) + '），要經同意並付加班費', '勞基法第 24、32 條');
    if(hours > p.maxHours + 1e-9) add('yellow', 'maxHours', p.id, null, name + '：排了 ' + r1(hours) + ' 小時，超過他設定的每週最多 ' + p.maxHours + ' 小時');
    if(worked.length > p.maxDays) add('yellow', 'maxDays', p.id, null, name + '：排了 ' + worked.length + ' 天，超過他設定的每週最多 ' + p.maxDays + ' 天');
    worked.forEach(function(d){
      var sp = SM[row[d]].sp, sn = SM[row[d]].sh.name;
      if(p.off.indexOf(d) >= 0) add('yellow', 'unavailable', p.id, d, name + '：週' + DAYS[d] + '說不能上班，卻排了「' + sn + '」');
      if(p.child){
        if(sp.work > P.childDay) add('red', 'childDay', p.id, d, name + '（童工）：週' + DAYS[d] + '工作 ' + r1(sp.work) + ' 小時，童工每天不得超過 8 小時', '勞基法第 47 條');
        if(nightOverlap(sp)) add('red', 'childNight', p.id, d, name + '（童工）：週' + DAYS[d] + '「' + sn + '」在晚上 8 點到早上 6 點之間，童工不得在這段時間工作', '勞基法第 48 條');
      }
    });
    if(p.child && hours > P.childWeek) add('red', 'childWeek', p.id, null, name + '（童工）：一週 ' + r1(hours) + ' 小時，童工每週不得超過 40 小時', '勞基法第 47 條');
    if(p.child && worked.length > 5) add('red', 'childRest', p.id, null, name + '（童工）：排了 ' + worked.length + ' 天，童工不得在例假或休息日加班', '勞基法第 47 條');
    // 相鄰兩天的換班間隔
    for(var d = 0; d < 6; d++){
      if(!row[d] || !row[d + 1]) continue;
      var a = SM[row[d]].sp, b = SM[row[d + 1]].sp, gap = (1440 + b.s - a.e) / 60;
      if(gap < P.restGap) add('red', 'gap', p.id, d + 1, name + '：週' + DAYS[d] + '「' + SM[row[d]].sh.name + '」下班到週' + DAYS[d + 1] + '「' + SM[row[d + 1]].sh.name + '」上班只隔 ' + r1(gap) + ' 小時，輪班換班至少要連續休息 11 小時', '勞基法第 34 條');
    }
    return {id:p.id, name:p.name, pay:p.pay, hourly:hourly, days:worked.length, hours:hours, weekdayOT:weekdayOT, restHours:restHours, holidayHours:holidayHours,
      otWeek:otWeek, otMonth:otMonth, base:base, otPay:otPay, restPay:restPay, holPay:holPay, total:total, month:total * P.weeksPerMonth};
  });

  // 人力需求
  var cover = [], short = 0, over = 0, needSum = 0, haveSum = 0;
  st.shifts.forEach(function(s){
    DAYS.forEach(function(_, d){
      var need = st.need[s.id][d], have = st.staff.filter(function(p){ return st.grid[p.id][d] === s.id; }).length;
      cover.push({shift:s.id, day:d, need:need, have:have});
      needSum += need; haveSum += Math.min(have, need);
      if(have < need){ short += need - have; add('red', 'short', null, d, '週' + DAYS[d] + '「' + s.name + '」需要 ' + need + ' 人，只排了 ' + have + ' 人'); }
      else if(have > need){ over += have - need; add('yellow', 'over', null, d, '週' + DAYS[d] + '「' + s.name + '」需要 ' + need + ' 人，排了 ' + have + ' 人（多 ' + (have - need) + ' 人）'); }
    });
  });

  var order = {red:0, yellow:1};
  issues.sort(function(a, b){ return order[a.lv] - order[b.lv]; });
  var tot = people.reduce(function(a, x){ a.hours += x.hours; a.cost += x.total; a.ot += x.otPay + x.restPay + x.holPay; return a; }, {hours:0, cost:0, ot:0});
  return {st:st, shiftMap:SM, people:people, cover:cover, issues:issues,
    red:issues.filter(function(i){ return i.lv === 'red'; }).length, yellow:issues.filter(function(i){ return i.lv === 'yellow'; }).length,
    short:short, over:over, coverPct:needSum ? haveSum / needSum : 1, hours:tot.hours, cost:tot.cost, otCost:tot.ot, monthCost:tot.cost * P.weeksPerMonth};
}

/* ---------- 自動排班 ---------- */
// 只填空格（手動排的保留）。逐日、依上班時間先後，挑「本週排得最少」又不違規的人。
function canTake(st, SM, p, d, sid, grid){
  var row = grid[p.id], sp = SM[sid].sp;
  if(row[d]) return false;
  if(p.off.indexOf(d) >= 0) return false;
  var days = row.filter(Boolean).length;
  if(days >= Math.min(p.maxDays, p.child ? 5 : 6)) return false;      // 自動排班不排第 7 天，童工不排休息日
  var hours = row.reduce(function(a, x){ return a + (x ? SM[x].sp.work : 0); }, 0);
  if(hours + sp.work > p.maxHours + 1e-9) return false;
  if(sp.work > P.dayMax) return false;
  if(p.child && (sp.work > P.childDay || nightOverlap(sp) || hours + sp.work > P.childWeek)) return false;
  // 加班不能讓每月推估超過 46 小時：第 6 天整天都算休息日加班，其他天算超過 8 小時的部分
  // 用「排進去之後的整週」依日期先後重算（不是照日期順序填格子，第幾天會變）
  var trial = row.slice(); trial[d] = sid;
  var ot = 0, k = 0;
  trial.forEach(function(x){ if(x){ var w = SM[x].sp.work; ot += k < 5 ? Math.max(0, w - P.normalDay) : w; k++; } });
  if(ot * P.weeksPerMonth > P.otMonthCap + 1e-9) return false;
  if(d > 0 && row[d - 1] && (1440 + sp.s - SM[row[d - 1]].sp.e) / 60 < P.restGap) return false;
  if(d < 6 && row[d + 1] && (1440 + SM[row[d + 1]].sp.s - sp.e) / 60 < P.restGap) return false;
  return true;
}
function autoFill(raw){
  var st = normalize(raw), SM = shiftMap(st), grid = JSON.parse(JSON.stringify(st.grid)), unfilled = [], added = 0;
  // 依上班時間先後；同時間開始的先排長的班（月薪的人會先拿到整天的班）
  var order = st.shifts.slice().sort(function(a, b){ return SM[a.id].sp.s - SM[b.id].sp.s || SM[b.id].sp.work - SM[a.id].sp.work; });
  function hoursOf(p){ return grid[p.id].reduce(function(a, x){ return a + (x ? SM[x].sp.work : 0); }, 0); }
  // 先排最緊的日子（能上班的人 − 需要的人 最少），避免人手少的那天被排在最後時大家的天數都用完了
  var dayOrder = DAYS.map(function(_, d){
    var needD = st.shifts.reduce(function(a, s){ return a + st.need[s.id][d]; }, 0);
    var avail = st.staff.filter(function(p){ return p.off.indexOf(d) < 0 && p.maxDays > 0; }).length;
    return {d:d, slack:avail - needD};
  }).sort(function(a, b){ return a.slack - b.slack || a.d - b.d; }).map(function(x){ return x.d; });
  dayOrder.forEach(function(d){
    order.forEach(function(s){
      var need = st.need[s.id][d] - st.staff.filter(function(p){ return grid[p.id][d] === s.id; }).length;
      while(need > 0){
        var cand = st.staff.filter(function(p){ return canTake(st, SM, p, d, s.id, grid); });
        if(!cand.length){ unfilled.push({day:d, shift:s.id, n:need}); break; }
        cand.sort(function(a, b){
          // 先排還沒滿 5 天的（避免第 6 天變休息日加班）→ 月薪還沒滿 40 小時的 → 本週時數少的 → 前一天同班別的（作息穩定）→ 名單順序
          var a6 = grid[a.id].filter(Boolean).length >= 5, b6 = grid[b.id].filter(Boolean).length >= 5;
          if(a6 !== b6) return a6 ? 1 : -1;
          // 月薪的人薪水本來就要付：還沒排到正常工時 40 小時的先排，再輪到時薪的人
          var ha = hoursOf(a), hb = hoursOf(b), wa = SM[s.id].sp.work;
          var ma = a.pay === 'month' && ha + wa <= 40 + 1e-9, mb = b.pay === 'month' && hb + wa <= 40 + 1e-9;
          if(ma !== mb) return ma ? -1 : 1;
          if(Math.abs(ha - hb) > 1e-9) return ha - hb;
          var sa = d > 0 && grid[a.id][d - 1] === s.id, sb = d > 0 && grid[b.id][d - 1] === s.id;
          if(sa !== sb) return sa ? -1 : 1;
          return st.staff.indexOf(a) - st.staff.indexOf(b);
        });
        grid[cand[0].id][d] = s.id; need--; added++;
      }
    });
  });
  // 補洞：把 A 從另一天換下來（由 B 頂替那一天），讓 A 能來補這個缺
  var still = [];
  unfilled.forEach(function(u){
    var n = u.n;
    while(n > 0 && swapOnce(u.day, u.shift)){ n--; added++; }
    if(n > 0) still.push({day:u.day, shift:u.shift, n:n});
  });
  function swapOnce(d, sid){
    for(var i = 0; i < st.staff.length; i++){
      var a = st.staff[i], row = grid[a.id];
      if(row[d] || a.off.indexOf(d) >= 0) continue;
      for(var d2 = 0; d2 < 7; d2++){
        var sid2 = row[d2]; if(!sid2) continue;
        if(st.need[sid2][d2] <= 0) continue;
        row[d2] = '';
        if(canTake(st, SM, a, d, sid, grid)){
          row[d] = sid;
          for(var j = 0; j < st.staff.length; j++){
            var b = st.staff[j]; if(b === a) continue;
            if(canTake(st, SM, b, d2, sid2, grid)){ grid[b.id][d2] = sid2; return true; }
          }
          row[d] = '';
        }
        row[d2] = sid2;
      }
    }
    return false;
  }
  still.sort(function(a, b){ return a.day - b.day; });
  return {grid:grid, unfilled:still, added:added};
}

/* ---------- 範例店型（店名、人名、數字全部虛構） ---------- */
function preset(key){
  var P_ = {
    cafe:{
      shop:'巷口咖啡（範例）',
      shifts:[{id:'s1', name:'早班', start:'07:00', end:'15:00', brk:30}, {id:'s2', name:'晚班', start:'14:00', end:'22:00', brk:30}],
      staff:[{id:'p1', name:'店長阿哲', pay:'month', wage:38000, maxDays:5, maxHours:40}, {id:'p2', name:'正職小安', pay:'month', wage:31000, maxDays:5, maxHours:40},
        {id:'p3', name:'兼職小美', wage:205, maxDays:4, maxHours:30, off:[0, 1]}, {id:'p4', name:'兼職阿凱', wage:200, maxDays:4, maxHours:30, off:[2]},
        {id:'p5', name:'兼職小芸', wage:200, maxDays:3, maxHours:24, off:[0, 1, 2, 3]}, {id:'p6', name:'兼職阿宏', wage:196, maxDays:4, maxHours:30}],
      need:{s1:[1, 1, 1, 1, 1, 2, 2], s2:[1, 1, 1, 1, 2, 2, 2]}},
    store:{
      shop:'街角便利門市（範例）',
      shifts:[{id:'s1', name:'早班', start:'07:00', end:'15:00', brk:30}, {id:'s2', name:'晚班', start:'15:00', end:'23:00', brk:30}, {id:'s3', name:'大夜', start:'23:00', end:'07:00', brk:30}],
      staff:[{id:'p1', name:'店長怡君', pay:'month', wage:40000}, {id:'p2', name:'副店志偉', pay:'month', wage:34000}, {id:'p3', name:'大夜阿龍', pay:'month', wage:33000},
        {id:'p4', name:'兼職佳蓉', wage:200, maxDays:5, maxHours:40}, {id:'p5', name:'兼職俊傑', wage:200, maxDays:5, maxHours:40}, {id:'p6', name:'兼職雅婷', wage:198, maxDays:4, maxHours:32, off:[5, 6]},
        {id:'p7', name:'兼職承恩', wage:198, maxDays:4, maxHours:32}, {id:'p8', name:'大夜兼職宗翰', wage:215, maxDays:4, maxHours:32}, {id:'p9', name:'兼職品妤', wage:196, maxDays:3, maxHours:24, off:[0, 2, 4]}],
      need:{s1:[2, 2, 2, 2, 2, 2, 2], s2:[2, 2, 2, 2, 2, 2, 2], s3:[1, 1, 1, 1, 1, 1, 1]}},
    restaurant:{
      shop:'家常小館（範例）',
      shifts:[{id:'s1', name:'午餐', start:'10:30', end:'14:30', brk:0}, {id:'s2', name:'晚餐', start:'16:30', end:'21:00', brk:30}, {id:'s3', name:'全天', start:'10:30', end:'21:00', brk:150}],
      staff:[{id:'p1', name:'主廚老王', pay:'month', wage:45000}, {id:'p2', name:'二廚小林', pay:'month', wage:33000},
        {id:'p3', name:'廚助阿德', wage:205, maxDays:3, maxHours:30},
        {id:'p4', name:'外場小晴', wage:200, maxDays:5, maxHours:30}, {id:'p5', name:'外場阿翔', wage:200, maxDays:4, maxHours:24, off:[6]}, {id:'p6', name:'洗碗阿姨', wage:196, maxDays:5, maxHours:30}],
      need:{s1:[0, 1, 1, 1, 1, 1, 1], s2:[0, 1, 1, 1, 1, 2, 2], s3:[0, 2, 2, 2, 2, 2, 2]}}
  };
  var x = P_[key];
  if(!x) return null;
  return normalize({shop:x.shop, shifts:x.shifts, staff:x.staff, need:x.need, grid:{}});
}
var PRESETS = ['cafe', 'store', 'restaurant'];
function presetInfo(key){ var x = {cafe:['☕ 咖啡店', '早晚兩班、週末多一人，6 個人（2 位月薪、4 位兼職）'], store:['🏪 24 小時門市', '早、晚、大夜三班不打烊，9 個人'], restaurant:['🍜 小餐館', '午餐、晚餐、全天三種班，週一公休，6 個人']}[key]; return {label:x[0], hint:x[1]}; }

function emptyState(){
  return normalize({shop:'我的小店', shifts:[newShift({id:'s1', name:'早班', start:'08:00', end:'16:00', brk:30}), newShift({id:'s2', name:'晚班', start:'14:00', end:'22:00', brk:30})],
    staff:[newStaff({id:'p1', name:'員工 1'}), newStaff({id:'p2', name:'員工 2'}), newStaff({id:'p3', name:'員工 3'})], need:{s1:[1, 1, 1, 1, 1, 1, 1], s2:[1, 1, 1, 1, 1, 1, 1]}, grid:{}});
}

/* ---------- 輸出 ---------- */
function money(v){ return isFinite(v) ? 'NT$ ' + Math.round(v).toLocaleString('en-US') : '—'; }
function md(d){ return (d.getMonth() + 1) + '/' + d.getDate(); }
function shiftLabel(sh){ return sh.name + ' ' + sh.start + '–' + sh.end; }
function weekTitle(st){ var ds = weekDates(st.week); return md(ds[0]) + '（一）～' + md(ds[6]) + '（日）'; }
// 傳 LINE 用：每個人一行
function lineText(raw){
  var st = normalize(raw), SM = shiftMap(st), ds = weekDates(st.week);
  var out = ['【' + st.shop + '】班表 ' + weekTitle(st), ''];
  st.staff.forEach(function(p){
    var parts = st.grid[p.id].map(function(sid, d){ return DAYS[d] + ' ' + (sid ? shiftLabel(SM[sid].sh) : '休'); });
    out.push('▍' + p.name);
    out.push(parts.join('、'));
  });
  out.push('', '班別：' + st.shifts.map(function(s){ var sp = span(s); return s.name + ' ' + s.start + '–' + s.end + (sp.brk ? '（休息 ' + Math.round(sp.brk * 60) + ' 分）' : ''); }).join('；'));
  out.push('有問題請在 ' + md(ds[0]) + ' 前跟我說，謝謝！');
  return out.join('\n');
}
function csvText(raw){
  var a = analyze(raw), st = a.st, SM = a.shiftMap, ds = weekDates(st.week);
  function q(v){ v = String(v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }
  var rows = [['人員'].concat(ds.map(function(d, i){ return md(d) + '（' + DAYS[i] + '）'; }), ['天數', '工時', '加班時數', '本週薪資估算'])];
  a.people.forEach(function(x){
    rows.push([x.name].concat(st.grid[x.id].map(function(sid){ return sid ? shiftLabel(SM[sid].sh) : '休'; }), [x.days, r1(x.hours), r1(x.otWeek), Math.round(x.total)]));
  });
  return '﻿' + rows.map(function(r){ return r.map(q).join(','); }).join('\r\n');
}

var API = {DAYS:DAYS, P:P, COLORS:COLORS, MAX_SHIFTS:MAX_SHIFTS, MAX_STAFF:MAX_STAFF, tmin:tmin, hhmm:hhmm, span:span, nightOverlap:nightOverlap,
  newShift:newShift, newStaff:newStaff, uid:uid, normalize:normalize, mondayOf:mondayOf, ymd:ymd, parseYmd:parseYmd, nextMonday:nextMonday, weekDates:weekDates,
  otWeekday:otWeekday, otRestday:otRestday, hourlyOf:hourlyOf, analyze:analyze, autoFill:autoFill, canTake:canTake, shiftMap:shiftMap,
  preset:preset, PRESETS:PRESETS, presetInfo:presetInfo, emptyState:emptyState, money:money, md:md, r1:r1, shiftLabel:shiftLabel, weekTitle:weekTitle, lineText:lineText, csvText:csvText};
if(typeof module !== 'undefined' && module.exports) module.exports = API; else root.SSP = API;
})(this);
