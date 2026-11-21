// node tools/test_engine.mjs
import {createRequire} from 'node:module';
const require = createRequire(import.meta.url);
const M = require('../data.js');
let n = 0, bad = 0;
const near = (a, b, e = 1e-6) => a === b || Math.abs(a - b) <= e * Math.max(1, Math.abs(b));
function eq(name, got, want){ n++; const ok = typeof want === 'number' ? near(got, want) : JSON.stringify(got) === JSON.stringify(want); if(!ok){ bad++; console.log('✗', name, '\n  得到', got, '\n  應為', want); } }
function ok(name, cond, extra){ n++; if(!cond){ bad++; console.log('✗', name, extra === undefined ? '' : extra); } }

// ── 範本產生的範例測試：換成這個工具的手算案例 ──
let r = M.calc({qty:3, price:200, discount:10});
eq('小計 3×200', r.gross, 600);
eq('打九折', r.total, 540);

// 正規化：空字串、負數、超出範圍
let p = M.normalize({qty:'', price:-5, discount:150});
eq('空白數量用預設值', p.qty, M.BASE.qty);
eq('負單價變 0', p.price, 0);
eq('折扣上限 100', p.discount, 100);

// 亂數：不會出現 NaN、合計不超過小計
for(let i = 0; i < 2000; i++){
  const x = {qty:Math.random() * 1000, price:Math.random() * 1e5, discount:Math.random() * 120 - 10};
  const y = M.calc(x);
  ok('亂數 #' + i + ' 數值有限', isFinite(y.total) && isFinite(y.gross), x);
  ok('亂數 #' + i + ' 合計 ≤ 小計', y.total <= y.gross + 1e-9, x);
}

console.log((bad ? '✗ ' : '✓ ') + (n - bad) + '/' + n + ' 通過');
process.exit(bad ? 1 : 0);
