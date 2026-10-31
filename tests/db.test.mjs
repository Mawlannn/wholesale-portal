// 用内存 Postgres 跑完整业务流程，验证数据库函数和权限
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const db = new PGlite();
const mig = (f) => readFileSync(new URL(`../supabase/migrations/${f}`, import.meta.url), 'utf8');

// ---- 模拟 Supabase 环境 ----
await db.exec(`
  create role anon nologin; create role authenticated nologin;
  create schema auth;
  create table auth.users (id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb);
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;
`);
for (const f of ['0001_schema.sql', '0002_functions.sql', '0003_security.sql']) await db.exec(mig(f));
await db.exec(`
  grant usage on schema public to anon, authenticated;
  grant all on all tables in schema public to anon, authenticated;
  grant all on all sequences in schema public to anon, authenticated;
`);

let passed = 0;
const ok = (msg) => { passed++; console.log('  ✓', msg); };

async function as(uid, fn) {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${uid ?? ''}', false);`);
  await db.exec(uid ? 'set role authenticated' : 'set role anon');
  try { return await fn(); } finally { await db.exec('reset role'); }
}
const q = async (sql, params) => (await db.query(sql, params)).rows;
const one = async (sql, params) => (await q(sql, params))[0];
async function fails(promise, pattern, msg) {
  try { await promise; } catch (e) {
    assert.match(e.message, pattern, `${msg}: got ${e.message}`); ok(msg); return;
  }
  assert.fail(`${msg}: expected error ${pattern}`);
}

// ---- 用户 ----
const admin = (await one(`insert into auth.users (email, raw_user_meta_data) values ('boss@x.jp', '{}') returning id`)).id;
await db.exec(`update profiles set role = 'admin' where id = '${admin}'`);
const reg = (email, company) => one(`insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id`,
  [email, JSON.stringify({ company_name: company, contact_name: '店长', phone: '03-0000', postal_code: '100-0001', address: '東京都千代田区1-1', locale: 'zh' })]);
const userA = (await reg('a@shop.jp', 'A商店')).id;
const userB = (await reg('b@shop.jp', 'B商店')).id;
const custA = (await one(`select customer_id from profiles where id = $1`, [userA])).customer_id;
const custB = (await one(`select customer_id from profiles where id = $1`, [userB])).customer_id;
const addrA = (await one(`select id from customer_addresses where customer_id = $1`, [custA])).id;
const addrB = (await one(`select id from customer_addresses where customer_id = $1`, [custB])).id;

console.log('注册与审核');
assert.equal((await one(`select status from customers where id = $1`, [custA])).status, 'pending'); ok('注册后为待审核');
assert.equal((await one(`select locale from profiles where id = $1`, [userA])).locale, 'zh'); ok('记住注册时的语言');
await fails(as(userA, () => q(`select * from get_catalog()`)), /not_approved/, '未审核不能看商品');
await fails(as(userA, () => q(`select set_customer_status($1, 'approved')`, [custA])), /forbidden/, '客户不能自己审核');
await as(admin, async () => {
  await q(`select set_customer_status($1, 'approved')`, [custA]);
  await q(`select set_customer_status($1, 'approved')`, [custB]);
});
ok('管理员审核通过');

console.log('商品与入库');
const [p8, p10] = await as(admin, async () => {
  const a = (await one(`insert into products (sku, name_ja, name_zh, unit_per_case, price_per_case, tax_rate)
                        values ('JUICE-01', 'マンゴージュース', '芒果汁', 24, 2980, 8) returning id`)).id;
  const b = (await one(`insert into products (sku, name_ja, unit_per_case, price_per_case, tax_rate, min_order_qty)
                        values ('BEER-01', 'ビール', 24, 4999, 10, 2) returning id`)).id;
  await q(`select receive_lot($1, 'L-LATE', 5, '2027-06-30', 1500)`, [a]);
  await q(`select receive_lot($1, 'L-EARLY', 3, '2027-01-31', 1400)`, [a]);
  await q(`select receive_lot($1, 'B-1', 10, '2027-03-01', 3000)`, [b]);
  return [a, b];
});
await fails(as(userA, () => q(`select receive_lot($1, 'X', 1)`, [p8])), /forbidden/, '客户不能入库');
let cat = await as(userA, () => q(`select sku, available, price from get_catalog() order by sku`));
assert.deepEqual(cat.map(r => [r.sku, r.available]), [['BEER-01', 10], ['JUICE-01', 8]]); ok('可售库存 = 各批次合计');
await as(admin, () => q(`insert into customer_prices values ($1, $2, 2800)`, [custA, p8]));
cat = await as(userA, () => q(`select sku, price from get_catalog() where sku = 'JUICE-01'`));
assert.equal(Number(cat[0].price), 2800); ok('客户专属价格生效');
await fails(as(userA, () => q(`select * from lots`)).then(r => { if (r.length) throw new Error('visible'); throw new Error('hidden'); }), /hidden/, '客户看不到批次和成本');

console.log('下单与库存锁定');
const items = (arr) => JSON.stringify(arr.map(([product_id, qty]) => ({ product_id, qty })));
await fails(as(userA, () => q(`select place_order($1, $2)`, [items([[p8, 9]]), addrA])), /insufficient_stock/, '超过库存不能下单');
await fails(as(userA, () => q(`select place_order($1, $2)`, [items([[p10, 1]]), addrA])), /below_min_qty/, '低于起订量不能下单');
await fails(as(userA, () => q(`select place_order($1, $2)`, [items([[p8, 1]]), addrB])), /invalid_address/, '不能用别人的地址');
await as(userA, () => q(`insert into cart_items values ($1, $2, 3)`, [custA, p8]));
const o1 = (await as(userA, () => one(`select place_order($1, $2, null, '放后门') as id`, [items([[p8, 3], [p10, 2]]), addrA]))).id;
const ord1 = await one(`select * from orders where id = $1`, [o1]);
// 8%: 2800*3 = 8400 → 672；10%: 4999*2 = 9998 → 999.8 → 999
assert.equal(Number(ord1.tax_8), 672); assert.equal(Number(ord1.tax_10), 999);
assert.equal(Number(ord1.total), 8400 + 9998 + 672 + 999); ok('税额按税率分别计算、端数切捨て');
assert.equal((await q(`select * from cart_items where customer_id = $1`, [custA])).length, 0); ok('下单后清空购物车');
let st = await one(`select * from product_stock where product_id = $1`, [p8]);
assert.deepEqual([st.on_hand, st.reserved, st.available], [8, 3, 5]); ok('下单后锁定库存，实际库存不变');
await fails(as(userB, () => q(`select place_order($1, $2)`, [items([[p8, 6]]), addrB])), /insufficient_stock/, '别的客户不能抢走已锁定的库存');

console.log('修改与取消');
await as(userA, () => q(`select update_pending_order($1, $2, null, null)`, [o1, items([[p8, 8]])]));
st = await one(`select * from product_stock where product_id = $1`, [p8]);
assert.equal(st.reserved, 8); ok('待确认订单可以修改数量（可用到全部库存）');
await fails(as(userB, () => q(`select cancel_order($1)`, [o1])), /forbidden/, '不能取消别人的订单');
let r = await as(userA, () => one(`select cancel_order($1, '下错了') as r`, [o1]));
assert.equal(r.r.result, 'cancelled');
st = await one(`select * from product_stock where product_id = $1`, [p8]);
assert.equal(st.reserved, 0); ok('待确认订单可直接取消，库存释放');

const o2 = (await as(userA, () => one(`select place_order($1, $2) as id`, [items([[p8, 4]]), addrA]))).id;
const token = (await as(admin, () => one(`select confirm_order($1) as t`, [o2]))).t;
await fails(as(userA, () => q(`select confirm_order($1)`, [o2])), /forbidden/, '客户不能确认订单');
await fails(as(userA, () => q(`select update_pending_order($1, $2)`, [o2, items([[p8, 1]])])), /order_locked/, '已确认的订单不能再修改');
r = await as(userA, () => one(`select cancel_order($1, '不要了') as r`, [o2]));
assert.equal(r.r.result, 'requested');
assert.equal((await one(`select status, cancel_requested from orders where id = $1`, [o2])).cancel_requested, true);
ok('已确认订单只能提交取消申请');
await as(admin, () => q(`select reject_cancel_request($1)`, [o2]));
assert.equal((await one(`select cancel_requested from orders where id = $1`, [o2])).cancel_requested, false); ok('管理员可以驳回取消申请');

console.log('快递商确认 → 扣库存（先过期先出）→ 生成应收');
const view = await as(null, () => one(`select courier_get_order($1) as o`, [token]));
assert.equal(view.o.items[0].qty, 4); ok('快递商不登录也能凭链接查看发货单');
await fails(as(null, () => q(`select courier_confirm(gen_random_uuid(), 'X')`)), /not_found/, '错误的链接无效');
assert.equal((await as(null, () => one(`select courier_confirm($1, 'YMT-123') as r`, [token]))).r, 'shipped');
assert.equal((await as(null, () => one(`select courier_confirm($1, 'YMT-123') as r`, [token]))).r, 'already_shipped');
ok('快递商点确认后订单变为已发货，重复点击不会重复扣库存');
const lotsNow = await q(`select lot_no, qty_on_hand from lots where product_id = $1 order by lot_no`, [p8]);
assert.deepEqual(lotsNow.map(l => [l.lot_no, l.qty_on_hand]), [['L-EARLY', 0], ['L-LATE', 4]]); ok('先扣保质期最早的批次');
const rec2 = await one(`select * from receivables where order_id = $1`, [o2]);
assert.equal(Number(rec2.amount), 2800 * 4 + Math.floor(2800 * 4 * 0.08)); ok('发货后自动记入欠款');
assert.match(rec2.due_date.toISOString?.() ?? String(rec2.due_date), /\d/);

console.log('信用额度');
await as(admin, () => q(`update customers set credit_limit = 20000 where id = $1`, [custA]));
await fails(as(userA, () => q(`select place_order($1, $2)`, [items([[p10, 2]]), addrA])), /credit_limit_exceeded/, '超过信用额度不能下单');
await as(admin, () => q(`update customers set credit_limit = null where id = $1`, [custA]));

console.log('付款与结清');
const o3 = (await as(userA, () => one(`select place_order($1, $2) as id`, [items([[p10, 2]]), addrA]))).id;
await as(admin, async () => { await q(`select confirm_order($1)`, [o3]); await q(`select admin_mark_shipped($1, 'S-2')`, [o3]); });
const rec3 = await one(`select * from receivables where order_id = $1`, [o3]);
let pos = await as(userA, () => one(`select * from customer_position($1)`, [custA]));
assert.equal(Number(pos.outstanding), Number(rec2.amount) + Number(rec3.amount)); ok('客户能看到自己的欠款总额');
await fails(as(userB, () => q(`select * from customer_position($1)`, [custA])), /forbidden/, '看不到别人的欠款');
assert.equal((await as(userB, () => q(`select * from receivables`))).length, 0); ok('别的客户的账款完全不可见');

// 指定结清第3笔订单（部分付款）
const pay1 = (await as(admin, () => one(`select record_payment($1, 5000, null, 'bank', '部分', array[$2]::uuid[]) as id`, [custA, rec3.id]))).id;
let r3 = await one(`select status, paid_amount from receivables where id = $1`, [rec3.id]);
assert.deepEqual([r3.status, Number(r3.paid_amount)], ['partial', 5000]); ok('部分付款 → 状态“部分已付”');
// 整月结清（多付 1000 → 余额）
const month = rec2.billing_month;
const monthDue = (await one(`select sum(amount - paid_amount) s from receivables where customer_id = $1 and billing_month = $2`, [custA, month])).s;
await as(admin, () => q(`select record_payment($1, $2, null, 'bank', '整月', null, $3)`, [custA, Number(monthDue) + 1000, month]));
const unpaid = await q(`select * from receivables where customer_id = $1 and status <> 'paid'`, [custA]);
assert.equal(unpaid.length, 0); ok('按月一键结清');
pos = await as(admin, () => one(`select * from customer_position($1)`, [custA]));
assert.equal(Number(pos.credit), 1000); ok('多付的钱保留为余额');
// 新发货自动用余额抵扣
const o4 = (await as(userA, () => one(`select place_order($1, $2) as id`, [items([[p8, 1]]), addrA]))).id;
await as(admin, async () => { await q(`select confirm_order($1)`, [o4]); await q(`select admin_mark_shipped($1)`, [o4]); });
const rec4 = await one(`select * from receivables where order_id = $1`, [o4]);
assert.equal(Number(rec4.paid_amount), 1000); ok('新的欠款自动用余额抵扣');
// 作废付款
await fails(as(admin, () => q(`select void_payment($1, '')`, [pay1])), /reason_required/, '作废必须填写原因');
await as(admin, () => q(`select void_payment($1, '金额录错')`, [pay1]));
pos = await as(admin, () => one(`select * from customer_position($1)`, [custA]));
// 有效付款合计 = rec2 + rec3 - 5000 + 1000，所以剩余欠款 = rec4 + 4000，余额为 0
assert.equal(Number(pos.outstanding), Number(rec4.amount) + 4000);
assert.equal(Number(pos.credit), 0);
ok('作废付款后欠款自动恢复');
await fails(q(`delete from payments where id = $1`, [pay1]), /records_are_immutable/, '付款记录不能删除');

console.log('召回与统计');
const recall = await as(admin, () => q(`select * from recall_lookup('L-EARLY')`));
assert.equal(recall.length, 1); assert.equal(recall[0].company_name, 'A商店'); ok('输入批次号即可查到发给了哪些客户');
await fails(as(userA, () => q(`select * from recall_lookup('L-EARLY')`)), /forbidden/, '客户不能使用召回查询');
const dash = (await as(admin, () => one(`select admin_dashboard() d`))).d;
assert.ok(dash.outstanding > 0); ok('管理员首页统计');
const bal = await as(userA, () => q(`select * from customer_balances`));
assert.equal(bal.length, 1); ok('欠款汇总视图只显示自己');
const logs = await q(`select count(*)::int n from audit_logs`);
assert.ok(logs[0].n > 10); ok(`操作日志已记录 ${logs[0].n} 条`);

console.log('盘点');
const lot = await one(`select id from lots where lot_no = 'L-LATE'`);
await as(admin, () => q(`select adjust_lot($1, 3, '盘点少1箱')`, [lot.id]));
assert.equal((await one(`select qty_on_hand from lots where id = $1`, [lot.id])).qty_on_hand, 3); ok('盘点调整并记录流水');

console.log(`\n全部通过：${passed} 项`);
