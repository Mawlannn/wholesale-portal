// 重置为一套干净、像真实业务的演示数据（只用于本地预览）
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const env = Object.fromEntries(fs.readFileSync(new URL('../keys.env', import.meta.url), 'utf8').split('\n').filter(Boolean).map((l) => l.split('=')));
const SERVICE = env.SERVICE;
const psql = (sql) => { try { return execFileSync('psql', ['-h', '127.0.0.1', '-U', 'postgres', '-qAt', '-v', 'ON_ERROR_STOP=1', '-c', sql], { env: { ...process.env, PGPASSWORD: "pw" }, stdio: ["ignore", "pipe", "pipe"] }).toString().trim(); } catch (e) { throw new Error(String(e.stderr) + "\n" + sql.slice(0, 300)); } };
const lit = (v) => (v == null ? 'null' : `'${String(v).replace(/'/g, "''")}'`);
/** 以某个用户身份调用（带 JWT），返回结果文本 */
function as(uid, expr) {
  const out = psql(`begin; select set_config('request.jwt.claims', '{"sub":"${uid}","role":"authenticated"}', true); set local role authenticated; select 'R:' || coalesce((${expr})::text, ''); commit;`);
  return out.split('\n').find((l) => l.startsWith('R:'))?.slice(2) ?? '';
}
const raw = (sql) => psql(`begin; set local session_replication_role = replica; ${sql}; commit;`);

// ---------- 1. 清空业务数据（保留管理员、商品、设置） ----------
const boss = psql(`select id from auth.users where email='boss@example.com'`);
psql(`truncate order_allocations, payment_allocations, payments, receivables, order_items, orders, inventory_movements, email_log, audit_logs,
  cart_items, favorites, customer_prices, lots restart identity cascade`);
raw(`delete from profiles where id <> '${boss}'; delete from customer_addresses; delete from customers; delete from auth.identities where user_id <> '${boss}'; delete from auth.users where id <> '${boss}'`);
psql(`update profiles set locale='zh', display_name='老板' where id='${boss}'`);
psql(`update settings set company_name='東京輸入食品株式会社', company_address='東京都江東区新木場2-3-4', company_phone='03-1234-5678',
  company_email='orders@tokyo-import.example', invoice_reg_no='T1234567890123', bank_info='みずほ銀行 新木場支店 普通 1234567 トウキョウユニュウショクヒン（カ',
  courier_name='ヤマト倉庫 新木場センター', courier_email='shinkiba@yamato-souko.example', courier_cc='', courier_locale='ja',
  order_cutoff='15:00', default_payment_terms_days=30, expiry_alert_days=60 where id=1`);
try { psql(`alter sequence order_seq restart with 1`); } catch {}

// ---------- 2. 客户（通过登录系统创建，和真实注册一样） ----------
const customers = [
  { key: 'aomi', email: 'aomi@example.com', company_name: '青海マート', contact_name: '山田 太郎', phone: '03-5500-1201', postal_code: '135-0064', address: '東京都江東区青海1-1-1', locale: 'ja', limit: 500000 },
  { key: 'asia', email: 'asia@example.com', company_name: 'アジア食品 新大久保店', contact_name: '金 美英', phone: '03-3200-8812', postal_code: '169-0073', address: '東京都新宿区百人町2-1-5', locale: 'ja', limit: 300000 },
  { key: 'halal', email: 'halal@example.com', company_name: 'ハラル市場 錦糸町', contact_name: 'Ahmed Khan', phone: '03-5600-4433', postal_code: '130-0013', address: '東京都墨田区錦糸3-7-2', locale: 'en', limit: null },
  { key: 'kakyo', email: 'kakyo@example.com', company_name: '華僑スーパー 横浜中華街', contact_name: '王 磊', phone: '045-681-2299', postal_code: '231-0023', address: '神奈川県横浜市中区山下町130', locale: 'zh', limit: 400000 },
  { key: 'spice', email: 'spice@example.com', company_name: 'スパイス堂 吉祥寺', contact_name: '佐藤 花子', phone: '0422-20-7788', postal_code: '180-0004', address: '東京都武蔵野市吉祥寺本町1-10-3', locale: 'ja', pending: true },
];
const U = {}; const C = {};
for (const c of customers) {
  const res = await fetch('http://localhost:54321/auth/v1/admin/users', {
    method: 'POST', headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: c.email, password: 'password123', email_confirm: true, user_metadata: { company_name: c.company_name, contact_name: c.contact_name, phone: c.phone, postal_code: c.postal_code, address: c.address, locale: c.locale } }),
  });
  const u = await res.json();
  if (!u.id) throw new Error(JSON.stringify(u));
  U[c.key] = u.id;
  C[c.key] = psql(`select customer_id from profiles where id='${u.id}'`);
  if (!c.pending) {
    as(boss, `public.set_customer_status('${C[c.key]}', 'approved')`);
  }
}
psql(`insert into customer_addresses (customer_id, label, recipient, phone, postal_code, address, is_default)
  values ('${C.aomi}', '青海マート 豊洲店', '鈴木 一郎', '03-5500-1300', '135-0061', '東京都江東区豊洲3-2-20', false)`);
psql(`update customers set note='毎週火・金に発注。午前中納品希望' where id='${C.aomi}'`);

// ---------- 3. 入库批次 ----------
const P = Object.fromEntries(psql(`select sku||'|'||id from products`).split('\n').map((l) => l.split('|')));
const day = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
const lots = [
  ['DR-MANGO-330', 'L2608-MG', 80, 210, -70, 1790], ['DR-MANGO-330', 'L2610-MG', 120, 330, -8, 1790],
  ['DR-COCO-500', 'L2609-CW', 140, 260, -40, 2160], ['DR-LYCHEE-330', 'L2609-LY', 90, 240, -35, 1730],
  ['DR-OOLONG-500', 'L2610-OL', 110, 300, -12, 1580], ['AL-BEER-330', 'L2607-BR', 60, 180, -95, 3170], ['AL-BEER-330', 'L2610-BR', 70, 360, -6, 3170],
  ['AL-SOJU-360', 'L2608-SJ', 26, 400, -60, 2760], ['FD-COCO-400', 'L2608-CM', 70, 420, -66, 2450], ['FD-NOODLE-5', 'L2609-ND', 100, 160, -30, 2020],
  ['SN-CHIPS-80', 'L2609-CH', 80, 150, -45, 1890], ['SN-MANGO-100', 'L2605-DM', 30, 24, -150, 4080], ['SN-MANGO-100', 'L2610-DM', 50, 240, -5, 4080],
  ['SN-SEAWEED-36', 'L2609-SW', 70, 120, -28, 2590],
];
for (const [sku, no, qty, exp, recv, cost] of lots)
  as(boss, `public.receive_lot('${P[sku]}', ${lit(no)}, ${qty}, '${day(exp)}', ${cost}, '${day(recv)}', null)`);

// ---------- 4. 订单 ----------
const addr = (k) => psql(`select id from customer_addresses where customer_id='${C[k]}' and is_default`);
function order(k, items, opts = {}) {
  const js = JSON.stringify(Object.entries(items).map(([sku, qty]) => ({ product_id: P[sku], qty })));
  const id = as(U[k], `public.place_order('${js}'::jsonb, '${opts.address ?? addr(k)}', ${opts.delivery ? `'${opts.delivery}'` : 'null'}, ${lit(opts.note)})`);
  if (opts.confirm || opts.ship) as(boss, `public.confirm_order('${id}')`);
  if (opts.ship) as(boss, `public.admin_mark_shipped('${id}', ${lit(opts.tracking ?? null)})`);
  return id;
}
/** 把一张订单的日期改到过去（下单、确认、发货、应收月份和付款期限一起改） */
function backdate(id, daysAgo) {
  const d = new Date(Date.now() - daysAgo * 86400000);
  const ymd = d.toISOString().slice(0, 10);
  const yymmdd = ymd.slice(2).replace(/-/g, '');
  const month = ymd.slice(0, 7);
  raw(`update orders set created_at = '${ymd} 10:12+09', confirmed_at = '${ymd} 11:05+09', shipped_at = case when shipped_at is not null then '${ymd} 16:40+09'::timestamptz end,
         order_no = 'O${yymmdd}-' || split_part(order_no, '-', 2) where id='${id}';
       update receivables set billing_month='${month}', due_date = (date_trunc('month', date '${ymd}') + interval '1 month' - interval '1 day')::date + 30, created_at='${ymd} 16:40+09' where order_id='${id}';
       update inventory_movements set created_at='${ymd} 16:40+09' where order_id='${id}'`);
}
const pay = (k, amount, daysAgo, note) => {
  const ymd = day(-daysAgo);
  as(boss, `public.record_payment('${C[k]}', ${amount}, '${ymd}', 'bank', ${lit(note)}, null, null)`);
};
const total = (id) => Number(psql(`select total from orders where id='${id}'`));

// 历史发货（近 6 个月），让图表和账款有数据
const hist = [
  ['asia', { 'DR-MANGO-330': 10, 'SN-CHIPS-80': 6, 'FD-NOODLE-5': 8 }, 172], ['kakyo', { 'DR-OOLONG-500': 12, 'FD-COCO-400': 6 }, 165],
  ['halal', { 'DR-COCO-500': 10, 'SN-SEAWEED-36': 4 }, 140], ['aomi', { 'DR-MANGO-330': 6, 'AL-BEER-330': 4 }, 133],
  ['asia', { 'AL-SOJU-360': 6, 'SN-MANGO-100': 3, 'DR-LYCHEE-330': 8 }, 110], ['kakyo', { 'FD-NOODLE-5': 10, 'DR-MANGO-330': 8 }, 102],
  ['aomi', { 'DR-LYCHEE-330': 10, 'SN-CHIPS-80': 6 }, 96], ['halal', { 'FD-COCO-400': 8, 'DR-OOLONG-500': 6 }, 80],
  ['asia', { 'AL-BEER-330': 6, 'DR-COCO-500': 8 }, 75], ['kakyo', { 'SN-SEAWEED-36': 6, 'SN-MANGO-100': 4, 'AL-SOJU-360': 4 }, 70],
  ['aomi', { 'DR-OOLONG-500': 10, 'FD-NOODLE-5': 6, 'DR-MANGO-330': 8 }, 50], ['halal', { 'DR-COCO-500': 12, 'DR-LYCHEE-330': 6 }, 44],
  ['asia', { 'SN-CHIPS-80': 8, 'FD-COCO-400': 6, 'DR-MANGO-330': 12 }, 38], ['kakyo', { 'DR-MANGO-330': 10, 'AL-BEER-330': 6 }, 33],
  ['aomi', { 'AL-BEER-330': 6, 'SN-SEAWEED-36': 4, 'DR-COCO-500': 6 }, 20], ['halal', { 'FD-NOODLE-5': 8, 'SN-MANGO-100': 3 }, 12],
  ['kakyo', { 'DR-LYCHEE-330': 8, 'FD-COCO-400': 4 }, 9], ['asia', { 'DR-OOLONG-500': 8, 'AL-SOJU-360': 4 }, 6],
];
const ids = {};
hist.forEach(([k, items, ago], i) => {
  const id = order(k, items, { ship: true, tracking: `4${String(5100000000 + i * 7919).slice(0, 3)}-${String(1000 + i * 37).slice(0, 4)}-${String(2000 + i * 53).slice(0, 4)}` });
  backdate(id, ago);
  (ids[k] ??= []).push([id, ago]);
});
// 收款：老的都已付清；アジア食品 有一张 8 月的没付 → 逾期；青海マート 9 月的付了一部分
for (const k of ['asia', 'kakyo', 'halal', 'aomi']) {
  for (const [id, ago] of ids[k]) {
    const amt = total(id);
    if (ago >= 120) pay(k, amt, ago - 40, '');
    else if (k === 'asia' && ago === 75) { /* 逾期未付 */ }
    else if (ago >= 60) pay(k, amt, ago - 35, '');
    else if (k === 'aomi' && ago === 50) pay(k, Math.round(amt / 2 / 100) * 100, 8, '一部入金');
    else if (k === 'halal' && ago === 44) pay(k, amt, 3, '');
  }
}

// 当前进行中的订单
const tomorrow = day(2);
const aomiPending = order('aomi', { 'DR-MANGO-330': 4, 'SN-CHIPS-80': 3, 'DR-LYCHEE-330': 2 }, { note: '午前中にお願いします', delivery: tomorrow });
const kakyoPending = order('kakyo', { 'FD-NOODLE-5': 6, 'DR-OOLONG-500': 6 }, {});
const halalPending = order('halal', { 'DR-COCO-500': 8, 'FD-COCO-400': 4 }, { note: 'Please call before delivery' });
const aomiConfirmed = order('aomi', { 'FD-NOODLE-5': 4, 'DR-OOLONG-500': 6 }, { confirm: true, address: psql(`select id from customer_addresses where customer_id='${C.aomi}' and not is_default`) });
const aomiCancelReq = order('aomi', { 'AL-BEER-330': 4, 'AL-SOJU-360': 2 }, { confirm: true });
as(U.aomi, `public.cancel_order('${aomiCancelReq}', '数量を間違えました。再注文します')`);
const asiaConfirmed = order('asia', { 'SN-MANGO-100': 4, 'DR-MANGO-330': 6 }, { confirm: true });
const aomiCancelled = order('aomi', { 'SN-SEAWEED-36': 2 }, {});
as(U.aomi, `public.cancel_order('${aomiCancelled}', '別の商品に変更')`);
for (const [id, ago] of [[aomiConfirmed, 1], [aomiCancelReq, 1], [asiaConfirmed, 1], [aomiCancelled, 2]]) {
  raw(`update orders set created_at = now() - interval '${ago} day' - interval '3 hour', confirmed_at = case when confirmed_at is not null then now() - interval '${ago} day' end,
    order_no = 'O' || to_char((now() at time zone 'Asia/Tokyo') - interval '${ago} day', 'YYMMDD') || '-' || split_part(order_no, '-', 2) where id='${id}'`);
}
// 已确认的订单：已经发过邮件
for (const id of [aomiConfirmed, asiaConfirmed]) {
  raw(`update orders set courier_notified_at = confirmed_at where id='${id}'`);
  const o = psql(`select order_no||'|'||c.company_name||'|'||coalesce(c.email,'') from orders o join customers c on c.id=o.customer_id where o.id='${id}'`).split('|');
  raw(`insert into email_log (order_id, customer_id, kind, to_addr, subject, body, status, created_at) select id, customer_id, 'customer_confirmed', ${lit(o[2])}, ${lit('【ご注文確定】' + o[0])}, '(省略)', 'sent', confirmed_at + interval '2 min' from orders where id='${id}';
       insert into email_log (order_id, customer_id, kind, to_addr, subject, body, status, created_at) select id, customer_id, 'courier_order', 'shinkiba@yamato-souko.example', ${lit('【出荷依頼】' + o[0] + ' ' + o[1])}, '(省略)', 'sent', confirmed_at + interval '3 min' from orders where id='${id}'`);
}

// 购物车、收藏、专属价格
psql(`insert into cart_items (customer_id, product_id, qty_cases) values ('${C.aomi}', '${P['DR-COCO-500']}', 4), ('${C.aomi}', '${P['FD-COCO-400']}', 3), ('${C.aomi}', '${P['AL-BEER-330']}', 2)`);
psql(`insert into favorites (customer_id, product_id) values ('${C.aomi}', '${P['DR-MANGO-330']}'), ('${C.aomi}', '${P['SN-CHIPS-80']}')`);
psql(`insert into customer_prices (customer_id, product_id, price_per_case) values ('${C.aomi}', '${P['DR-MANGO-330']}', 2800)`);

for (const c of customers) if (!c.pending) psql(`update customers set credit_limit=${c.limit ?? 'null'} where id='${C[c.key]}'`);
const out = { boss, U, C, P, orders: { aomiPending, kakyoPending, halalPending, aomiConfirmed, aomiCancelReq, asiaConfirmed, aomiCancelled }, hist: ids };
fs.writeFileSync(new URL('./demo.json', import.meta.url), JSON.stringify(out, null, 2));
console.log('demo data ready:', psql(`select status||' '||count(*) from orders group by status`).replace(/\n/g, ', '));
