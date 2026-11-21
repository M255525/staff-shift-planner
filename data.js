/* 員工排班表：計算引擎（瀏覽器 window.SSP，node 可 require）
   純函式、不碰 DOM。改了這支檔案跑 node tools/test_engine.mjs
   ── 以下是範本產生的範例引擎（數量 × 單價 − 折扣），換成這個工具真正的規則 ── */
(function(root){
'use strict';

function num(v, d){ if(v === '' || v == null) return d; v = Number(v); return isFinite(v) ? v : d; }
function clamp(v, lo, hi, d){ v = num(v, d); return Math.min(hi, Math.max(lo, v)); }

var BASE = {qty:10, price:100, discount:0};

// 把使用者輸入（可能是空字串、負數、亂打）整理成合法值
function normalize(x){
  x = x || {};
  return {
    qty:clamp(x.qty, 0, 1e7, BASE.qty),
    price:clamp(x.price, 0, 1e9, BASE.price),
    discount:clamp(x.discount, 0, 100, BASE.discount)
  };
}

function calc(x){
  var p = normalize(x);
  var gross = p.qty * p.price;
  var total = gross * (1 - p.discount / 100);
  return {p:p, gross:gross, total:total};
}

function money(v){ return isFinite(v) ? 'NT$ ' + Math.round(v).toLocaleString('en-US') : '—'; }

var API = {BASE:BASE, normalize:normalize, calc:calc, money:money};
if(typeof module !== 'undefined' && module.exports) module.exports = API; else root.SSP = API;
})(this);
