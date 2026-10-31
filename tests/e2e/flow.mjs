// 浏览器端到端测试：注册 → 审核 → 下单 → 确认 → 快递确认 → 付款
import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';

const BASE = 'http://localhost:3000';
const RUN = String(Date.now() % 100000);
const SHOP = '青海マート' + RUN;
const OUT = new URL('./shots/', import.meta.url).pathname;
fs.mkdirSync(OUT, { recursive: true });
const exe = await chromium.executablePath();
const browsers = [];
const launch = async () => { const b = await puppeteer.launch({ args: chromium.args, executablePath: exe, headless: true }); browsers.push(b); return b; };
const step = (m) => console.log('→', m);

async function ctx(lang, mobile = false) {
  const b = await launch();
  const p = await b.newPage();
  await p.setExtraHTTPHeaders({ 'Accept-Language': lang });
  await p.setViewport(mobile ? { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true } : { width: 1366, height: 900 });
  p.on('dialog', (d) => d.accept());
  p.on('pageerror', (e) => console.log('  [pageerror]', e.message));
  return p;
}
const shot = (p, name, full = true) => p.screenshot({ path: `${OUT}${name}.png`, fullPage: full });
async function go(p, path) { await p.goto(BASE + path, { waitUntil: 'networkidle0' }); }
async function submit(p, selector) {
  selector = selector.startsWith('form') ? 'main ' + selector : selector;
  await Promise.all([p.waitForNavigation({ waitUntil: 'networkidle0', timeout: 8000 }).catch(() => console.log('  (no navigation)')), p.$eval(selector, (b) => b.click())]);
  await p.waitForNetworkIdle({ idleTime: 400 }).catch(() => {});
}
async function text(p) { return p.evaluate(() => document.body.innerText); }
function expect(cond, msg) { if (!cond) { console.log('  ✗', msg); process.exitCode = 1; } else console.log('  ✓', msg); }

// ---------- 客户注册（日语浏览器，手机） ----------
const cust = await ctx('ja-JP,ja;q=0.9', true);
step('customer registers');
await go(cust, '/register');
await shot(cust, '01-register-ja-mobile');
const f = { company_name: SHOP, contact_name: '山田太郎', phone: '03-9999-0000', email: `shop${RUN}@example.com`, password: 'password123', postal_code: '135-0064', address: '東京都江東区青海1-1-1' };
for (const [k, v] of Object.entries(f)) await cust.type(`[name=${k}]`, v);
await submit(cust, 'button[type=submit]');
expect(cust.url().endsWith('/pending'), 'redirected to pending page');
await shot(cust, '02-pending-ja-mobile');

// ---------- 管理员（中文） ----------
const admin = await ctx('zh-CN,zh;q=0.9');
step('admin logs in');
await go(admin, '/login');
await admin.type('[name=email]', 'boss@example.com');
await admin.type('[name=password]', 'password123');
await submit(admin, 'button[type=submit]');
expect(admin.url().endsWith('/admin'), 'admin lands on dashboard');
await shot(admin, '10-admin-dashboard-zh');

step('admin approves customer');
await go(admin, '/admin/customers?tab=pending');
await shot(admin, '11-admin-customers-pending-zh');
await submit(admin, 'form button[type=submit]');
expect((await text(admin)).includes('已审核通过'), 'approval flash shown');

// ---------- 客户下单 ----------
step('customer shops');
await go(cust, '/shop');
expect(cust.url().endsWith('/shop'), 'approved customer sees catalog');
await shot(cust, '03-catalog-ja-mobile');
// 把第一个商品加 3 箱
async function addSku(sku, n) {
  await cust.evaluate((sku, n) => {
    const li = [...document.querySelectorAll('main li')].find((l) => l.innerText.includes(sku));
    const i = li.querySelector('input[name=qty]');
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(i, String(n));
    i.dispatchEvent(new Event('input', { bubbles: true }));
  }, sku, n);
  await new Promise((r) => setTimeout(r, 200));
  await Promise.all([
    cust.waitForNavigation({ waitUntil: 'networkidle0', timeout: 8000 }).catch(() => {}),
    cust.evaluate((sku) => [...document.querySelectorAll('main li')].find((l) => l.innerText.includes(sku))
      .querySelector('form:has(input[name=qty]) button[type=submit]').click(), sku),
  ]);
  await cust.waitForNetworkIdle({ idleTime: 500 }).catch(() => {});
}
await addSku('マンゴージュース', 3);
expect((await text(cust)).includes('カートに追加しました'), 'added to cart');
await addSku('輸入ビール', 2);
await go(cust, '/shop/cart');
await shot(cust, '04-cart-ja-mobile');
const cartText = await text(cust);
expect(cartText.includes('8% 対象') && cartText.includes('10% 対象'), 'cart shows tax by rate');
await cust.type('[name=note]', '午前中にお願いします');
await submit(cust, 'form:has([name=address_id]) button[type=submit]');
expect(cust.url().includes('/shop/orders/'), 'order placed → order page');
if (!cust.url().includes('/shop/orders/')) { console.log((await text(cust)).slice(0, 400)); process.exit(1); }
const orderUrl = cust.url().split('?')[0];
await shot(cust, '05-order-pending-ja-mobile');

step('customer edits pending order');
await go(cust, new URL(orderUrl).pathname + '/edit');
await cust.evaluate(() => { const i = document.querySelector('main input[name=qty]'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(i, '4'); i.dispatchEvent(new Event('input', { bubbles: true })); });
await submit(cust, 'form button[type=submit]');
expect((await text(cust)).includes('注文を変更しました'), 'order updated');

// ---------- 管理员确认 → 快递邮件 ----------
step('admin confirms order');
await go(admin, '/admin/orders');
await shot(admin, '12-admin-orders-zh');
await go(admin, '/admin/orders/' + new URL(orderUrl).pathname.split('/').pop());
await submit(admin, 'form button[type=submit]');
const adminOrderText = await text(admin);
expect(adminOrderText.includes('订单已确认'), 'confirmed flash');
expect(adminOrderText.includes('发给客户') && adminOrderText.includes('发给快递'), 'two email buttons shown');
const inbox = new URL('../smtp/inbox.jsonl', import.meta.url).pathname;
const mailsBefore = fs.existsSync(inbox) ? fs.readFileSync(inbox, 'utf8').trim().split('\n').filter(Boolean).length : 0;
for (const target of ['customer', 'courier']) {
  await admin.$eval(`details:has(input[name=target][value=${target}]) summary`, (s) => s.click());
  const body = await admin.$eval(`form:has(input[name=target][value=${target}]) textarea[name=body]`, (x) => x.value);
  expect(body.includes('DR-MANGO-330') || body.includes('×'), `${target} template has the items`);
  await submit(admin, `form:has(input[name=target][value=${target}]) button[type=submit]`);
  expect((await text(admin)).includes('邮件已发送'), `${target} email sent`);
}
await admin.$eval('details:has(input[name=target][value=courier]) summary', (s) => s.click()).catch(() => {});
await shot(admin, '13-admin-order-confirmed-zh');
const got = fs.readFileSync(inbox, 'utf8').trim().split('\n').slice(mailsBefore).map((l) => JSON.parse(l));
expect(got.some((m) => m.to.includes(`shop${RUN}@example.com`)), 'customer received the email through SMTP');
expect(got.some((m) => /courier|配送|warehouse/i.test(m.to + m.subject) && m.text.includes('/courier/')), 'courier received the email with the confirmation link');
expect(got.every((m) => m.from.includes('orders@tokyo-import.example')), 'sent from our own mailbox');
const courierLink = await admin.$eval('input[readonly]', (i) => i.value);
expect(courierLink.includes('/courier/'), 'courier link available');

// ---------- 客户申请取消（已确认 → 只能申请） ----------
step('customer requests cancel, admin rejects');
await go(cust, new URL(orderUrl).pathname);
console.log('  url', cust.url()); await shot(cust, 'dbg-before-cancel');
await submit(cust, 'form:has([name=reason]) button[type=submit]');
console.log('  url after', cust.url());
await shot(cust, 'dbg-cancel');
expect((await text(cust)).includes('キャンセルを申請しました'), 'cancel request submitted');
await go(admin, new URL(admin.url()).pathname);
expect((await text(admin)).includes('取消申请中'), 'admin sees cancel request');
await submit(admin, 'form:has(input[name=order_id]) + form button[type=submit]');
expect((await text(admin)).includes('已驳回取消申请'), 'admin rejected the request');

// ---------- 快递商确认（日语，手机，不登录） ----------
step('courier confirms shipment');
const courier = await ctx('ja-JP', true);
await courier.goto(courierLink, { waitUntil: 'networkidle0' });
await shot(courier, '06-courier-ja-mobile');
await courier.type('[name=tracking]', '4567-8901-2345');
await submit(courier, 'button[type=submit]');
expect((await text(courier)).includes('出荷を登録しました'), 'courier confirmation done');

// ---------- 客户看到已发货 + 欠款 ----------
step('customer sees shipped + balance');
await go(cust, new URL(orderUrl).pathname);
const shipped = await text(cust);
expect(shipped.includes('出荷済み') && shipped.includes('4567-8901-2345'), 'customer sees shipped with tracking');
await shot(cust, '07-order-shipped-ja-mobile');
await go(cust, '/shop/account');
await shot(cust, '08-account-ja-mobile');
expect((await text(cust)).includes('未入金'), 'unpaid receivable visible');

// ---------- 管理员登记付款（部分） ----------
step('admin records partial payment');
await go(admin, '/admin/customers?tab=approved');
await admin.evaluate((name) => [...document.querySelectorAll('a')].find((a) => a.innerText.includes(name)).click(), SHOP);
await admin.waitForNavigation({ waitUntil: 'networkidle0' });
await admin.type('input[name=amount]', '10000');
await submit(admin, 'form:has(input[name=amount]) button[type=submit]');
expect((await text(admin)).includes('付款已登记'), 'payment recorded');
await shot(admin, '14-admin-customer-zh');

// ---------- 英文界面 + 单据 ----------
step('english admin pages + print docs');
const en = await ctx('en-US,en;q=0.9');
await go(en, '/login');
await en.type('[name=email]', 'boss@example.com');
await en.type('[name=password]', 'password123');
await submit(en, 'button[type=submit]');
await go(en, '/admin/receivables'); await shot(en, '15-admin-receivables-en');
await go(en, '/admin/inventory'); await shot(en, '16-admin-inventory-en');
await go(en, '/admin/products'); await shot(en, '17-admin-products-en');
const lot = await en.evaluate(() => document.querySelector('td.num')?.innerText);
await go(en, '/admin/recall?lot=DEMO-01'); await shot(en, '18-admin-recall-en');
expect((await text(en)).includes(SHOP), 'recall lookup finds the customer');
const oid = new URL(orderUrl).pathname.split('/').pop();
await go(cust, `/print/delivery/${oid}`); await shot(cust, '09-delivery-note-ja-mobile');
const month = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Tokyo' }).format(new Date()).slice(0, 7);
const cid = await admin.evaluate(() => location.pathname.split('/').pop());
await go(admin, `/print/statement/${cid}/${month}`); await shot(admin, '19-statement-zh');
expect((await text(admin)).includes('T1234567890123'), 'statement shows invoice registration no.');
await go(admin, '/admin'); await shot(admin, '20-admin-dashboard-after-zh');
await go(admin, '/admin/logs'); await shot(admin, '21-admin-logs-zh', false);

// ---------- 语言切换 ----------
step('language switch');
await go(cust, '/shop');
await Promise.all([cust.waitForNavigation({ waitUntil: 'networkidle0' }).catch(() => {}), cust.select('select[name=lang]', 'zh')]);
await go(cust, '/shop');
expect((await text(cust)).includes('你好'), 'switched to Chinese');
await shot(cust, '22-catalog-zh-mobile');

for (const b of browsers) await b.close();
console.log(process.exitCode ? 'SOME CHECKS FAILED' : 'ALL CHECKS PASSED');
