// 抓取真实运行中的系统，生成“能点、能操作”的静态预览：
// 1) 从首页开始爬所有能点到的页面（三种语言）；
// 2) 在真实系统里执行一遍主要操作（确认订单、发邮件、取消、审核、收款、召回、入库……），把操作后的页面也存下来，
//    预览里点同一个按钮就跳到操作后的页面。
import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';

const BASE = 'http://localhost:3000';
const OUT = process.argv[2];
const LANGS = ['zh', 'ja', 'en'];
const demo = JSON.parse(fs.readFileSync(new URL('../demo/demo.json', import.meta.url), 'utf8'));
fs.rmSync(OUT, { recursive: true, force: true });
for (const l of LANGS) fs.mkdirSync(`${OUT}/${l}`, { recursive: true });

const exe = await chromium.executablePath();
const browsers = [];
async function ctx() {
  const b = await puppeteer.launch({ args: chromium.args, executablePath: exe, headless: true });
  browsers.push(b);
  const p = await b.newPage();
  await p.setViewport({ width: 390, height: 844 });
  p.on('dialog', (d) => d.accept());
  return p;
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function go(p, url) {
  await p.goto(url.startsWith('http') ? url : BASE + url, { waitUntil: 'networkidle0', timeout: 30000 });
}
async function login(p, email) {
  await go(p, '/login');
  await p.type('[name=email]', email);
  await p.type('[name=password]', 'password123');
  await Promise.all([p.waitForNavigation({ waitUntil: 'networkidle0' }), p.$eval('main form:has([name=password]) button[type=submit]', (b) => b.click())]);
}
async function setLang(p, lang) { await p.setCookie({ name: 'lang', value: lang, domain: 'localhost', path: '/' }); }

// ---------- 地址 → 文件名 ----------
function key(url) {
  const u = new URL(url, BASE);
  u.searchParams.delete('ok'); u.searchParams.delete('err');
  const q = [...u.searchParams.entries()].filter(([, v]) => v !== '').sort().map(([k, v]) => `${k}=${v}`).join('&');
  return u.pathname.replace(/\/$/, '') + (q ? `?${q}` : '');
}
function slug(k) {
  const [path, q] = k.split('?');
  let s = path.replace(/^\/+/, '').replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g, (m) => m.slice(0, 8)).replace(/[^A-Za-z0-9]+/g, '-') || 'home';
  if (q) s += '--' + encodeURIComponent(q).replace(/%[0-9A-F]{2}/g, (m) => m.slice(1).toLowerCase()).replace(/[^A-Za-z0-9]+/g, '-');
  return s.replace(/-+$/, '');
}

// ---------- 账号 ----------
const admin = await ctx(); await login(admin, 'boss@example.com');
const shop = await ctx(); await login(shop, 'aomi@example.com');
const anon = await ctx();
const pendingUser = await ctx(); await login(pendingUser, 'spice@example.com');
const actorOf = (k) => (k.startsWith('/shop') ? 'shop' : k.startsWith('/admin') || k.startsWith('/print') ? 'admin' : k === '/pending' ? 'pending' : 'anon');
const P = { admin, shop, anon, pending: pendingUser };

// 哪些地址收进预览
const allow = (k) => {
  if (/^\/(admin|shop)(\/|$|\?)/.test(k)) return !k.startsWith('/shop?q=') && !k.includes('?name=') ;
  if (k.startsWith('/print/statement/')) return k.slice(-7) >= '2026-09';
  if (k.startsWith('/print/delivery/')) return true;
  return ['/login', '/register', '/forgot', '/pending'].includes(k) || k.startsWith('/courier/');
};

// ---------- 1. 爬页面（中文） ----------
const seeds = ['/login', '/register', '/forgot', '/pending', '/shop', '/admin', '/admin/more', '/admin/products/new',
  ...['L2610-MG', 'L2605-DM', 'L2608-SJ'].map((l) => `/admin/recall?lot=${l}`)];
const courierTokens = {};
for (const id of [demo.orders.aomiConfirmed, demo.orders.asiaConfirmed]) {
  await go(admin, `/admin/orders/${id}`);
  const link = await admin.$eval('input[readonly]', (i) => i.value).catch(() => null);
  if (link) { const k = new URL(link).pathname; courierTokens[id] = k; seeds.push(k); }
}
for (const p of Object.values(P)) await setLang(p, 'zh');
const queue = [...seeds]; const seen = new Set(queue); const order = [];
const deliveryLimit = { n: 0 };
while (queue.length) {
  const k = queue.shift();
  const p = P[actorOf(k)];
  await go(p, k);
  const landed = key(p.url());
  if (landed !== k) { console.log('  redirect', k, '→', landed); continue; }
  order.push(k);
  const links = await p.$$eval('a[href]', (as) => as.map((a) => a.getAttribute('href')));
  for (const h of links) {
    if (!h || h.startsWith('http') || h.startsWith('#') || h.startsWith('mailto:') || h.startsWith('tel:')) continue;
    const nk = key(h);
    if (seen.has(nk) || !allow(nk)) continue;
    if (nk.startsWith('/print/delivery/') && ++deliveryLimit.n > 8) continue;
    seen.add(nk); queue.push(nk);
  }
  if (order.length > 190) { console.log('  page limit reached'); break; }
}
console.log('pages:', order.length);

// ---------- 2. 存页面（三种语言） ----------
const store = Object.fromEntries(LANGS.map((l) => [l, {}]));
const manifest = { pages: {}, actions: [], entry: {} };
for (const lang of LANGS) {
  for (const p of Object.values(P)) await setLang(p, lang);
  for (const k of order) {
    await go(P[actorOf(k)], k);
    store[lang][slug(k)] = await P[actorOf(k)].content();
  }
  process.stdout.write(lang + ' ');
}
for (const k of order) manifest.pages[slug(k)] = k;

// ---------- 3. 在真实系统里执行操作 ----------
let n = 0;
async function act({ actor, from, form, fill, on, label }) {
  const p = P[actor];
  for (const q of Object.values(P)) await setLang(q, 'zh');
  await go(p, from);
  const idx = await p.evaluate((sel) => [...document.querySelectorAll('form')].indexOf(document.querySelector(sel)), form);
  if (idx < 0) throw new Error(`form not found: ${label} ${form} on ${from}`);
  if (fill) await fill(p);
  await Promise.all([
    p.waitForNavigation({ waitUntil: 'networkidle0', timeout: 15000 }).catch(() => {}),
    p.evaluate((sel) => { const f = document.querySelector(sel); const b = f.querySelector('button[type=submit],button:not([type])'); f.noValidate = true; b ? b.click() : f.requestSubmit(); }, form),
  ]);
  await p.waitForNetworkIdle({ idleTime: 400 }).catch(() => {});
  const R = p.url(); const rk = key(R);
  if (new URL(R).searchParams.get('err')) console.log(`  ! ${label}: err=${new URL(R).searchParams.get('err')}`);
  n++;
  const flash = `${slug(rk)}--r${n}`; const plain = `${slug(rk)}--s${n}`;
  for (const lang of LANGS) {
    await setLang(p, lang);
    await go(p, R); store[lang][flash] = await p.content();
    await go(p, rk); store[lang][plain] = await p.content();
  }
  await setLang(p, 'zh');
  manifest.pages[flash] = rk; manifest.pages[plain] = rk;
  manifest.actions.push({ on: on ?? [slug(key(from))], form: idx, next: flash, set: { [slug(rk)]: plain }, label });
  console.log(`  ✓ ${label} → ${flash}`);
  return { flash, plain, key: rk };
}
const setVal = (sel, v) => (p) => p.evaluate((sel, v) => { const i = document.querySelector(sel); i.value = v; i.dispatchEvent(new Event('input', { bubbles: true })); }, sel, v);
const O = demo.orders;

// 客户端
await act({ label: '修改待确认订单', actor: 'shop', from: `/shop/orders/${O.aomiPending}/edit`, form: 'main form:has(input[name=qty])',
  fill: setVal('main input[name=qty]', '5') });
await act({ label: '加入购物车', actor: 'shop', from: '/shop', form: 'main form:has(input[name=qty])' });
const placed = await act({ label: '下单', actor: 'shop', from: '/shop/cart', form: 'main form:has([name=address_id])',
  fill: setVal('main [name=note]', '入口の右側に置いてください') });
await act({ label: '客户取消订单', actor: 'shop', from: placed.key, on: [placed.flash, placed.plain], form: 'main form:has([name=reason])',
  fill: setVal('main [name=reason]', '数量を変更したいので') });
await act({ label: '客户申请取消', actor: 'shop', from: `/shop/orders/${O.aomiConfirmed}`, form: 'main form:has([name=reason])',
  fill: setVal('main [name=reason]', '納品日を変更したいです') });
await act({ label: '收藏', actor: 'shop', from: '/shop', form: 'main form:has(input[name=product_id]):not(:has(input[name=qty]))' }).catch((e) => console.log('  skip', e.message));

// 管理端：确认 → 发给客户 → 发给快递 → 发货
const c1 = await act({ label: '确认订单', actor: 'admin', from: `/admin/orders/${O.aomiPending}`, form: 'main section form:has(input[name=order_id])' });
const c2 = await act({ label: '发给客户', actor: 'admin', from: c1.key, on: [c1.flash, c1.plain], form: 'main form:has(input[name=target][value=customer])' });
const c3 = await act({ label: '发给快递', actor: 'admin', from: c2.key, on: [c2.flash, c2.plain], form: 'main form:has(input[name=target][value=courier])' });
await act({ label: '手动登记发货', actor: 'admin', from: c3.key, on: [c3.flash, c3.plain], form: 'main form:has(input[name=tracking])',
  fill: setVal('main input[name=tracking]', '4512-3344-9087') });
await act({ label: '同意取消', actor: 'admin', from: `/admin/orders/${O.aomiCancelReq}`, form: 'main form:has(input[name=order_id]):not(:has([name=reason])):not(:has([name=admin_note]))' });
await act({ label: '管理员取消订单', actor: 'admin', from: `/admin/orders/${O.halalPending}`, form: 'main form:has([name=reason])',
  fill: setVal('main [name=reason]', '在庫調整のため') });
await act({ label: '内部备注', actor: 'admin', from: `/admin/orders/${O.kakyoPending}`, form: 'main form:has([name=admin_note])',
  fill: setVal('main [name=admin_note]', '王さんから電話あり、金曜着希望') });
await act({ label: '审核通过', actor: 'admin', from: '/admin/customers', form: 'main form:has(input[name=status][value=approved])' }).catch((e) => console.log('  skip', e.message));
await act({ label: '登记收款', actor: 'admin', from: `/admin/customers/${demo.C.asia}`, form: 'main form:has([name=amount])',
  fill: setVal('main [name=amount]', '65952') });
await act({ label: '保存客户条件', actor: 'admin', from: `/admin/customers/${demo.C.halal}`, form: 'main form:has([name=credit_limit])' });
await act({ label: '发送召回通知', actor: 'admin', from: '/admin/recall?lot=L2605-DM', form: 'main form:has([name=message])',
  fill: setVal('main [name=message]', 'ロット L2605-DM のドライマンゴーに包装不良の可能性があります。該当商品の販売を一時停止し、ご連絡ください。') });
await act({ label: '入库', actor: 'admin', from: '/admin/inbound', form: 'main form:has([name=product_id])', fill: async (p) => {
  await p.select('main [name=product_id]', demo.P['AL-SOJU-360']);
  await setVal('main [name=qty]', '40')(p); await setVal('main [name=lot_no]', 'L2610-SJ')(p);
  await setVal('main [name=expiry]', '2027-10-31')(p); await setVal('main [name=unit_cost]', '2760')(p);
} });
await act({ label: '调整库存', actor: 'admin', from: '/admin/inventory', form: 'main form:has([name=lot_id])', fill: setVal('main form:has([name=lot_id]) [name=reason]', '棚卸差異') });
await act({ label: '保存商品', actor: 'admin', from: `/admin/products/${demo.P['DR-MANGO-330']}`, form: 'main form:has([name=sku])' });
await act({ label: '保存设置', actor: 'admin', from: '/admin/settings', form: 'main form:has([name=company_name])' });
await act({ label: '测试邮件', actor: 'admin', from: '/admin/settings', form: 'main form:has(input[name=to])' });

// 快递商
await act({ label: '快递商确认出货', actor: 'anon', from: courierTokens[O.asiaConfirmed], form: 'form:has([name=tracking])',
  fill: setVal('[name=tracking]', '4498-2210-7765') });

// 新客户注册
await act({ label: '新客户注册', actor: 'anon', from: '/register', form: 'form:has([name=company_name])', fill: async (p) => {
  const f = { company_name: '台湾食品 上野店', contact_name: '林 志明', phone: '03-3833-1122', email: `ueno${Date.now() % 100000}@example.com`, password: 'password123', postal_code: '110-0005', address: '東京都台東区上野6-10-7' };
  for (const [k, v] of Object.entries(f)) await setVal(`[name=${k}]`, v)(p);
} });

manifest.entry = { shop: slug('/shop'), admin: slug('/admin'), login: slug('/login'), courier: slug(courierTokens[O.asiaConfirmed]) };

// ---------- 4. 改写链接并写文件 ----------
const css = await (await fetch(BASE + (await shop.$eval('link[rel=stylesheet]', (l) => l.getAttribute('href'))))).text();
fs.writeFileSync(`${OUT}/app.css`, css);
const map = new Map(); // key → 基础文件名
for (const [s, k] of Object.entries(manifest.pages)) if (!s.includes('--r') && !s.includes('--s')) map.set(k, s);
for (const [s, k] of Object.entries(manifest.pages)) if (!map.has(k)) map.set(k, s); // 只在操作后才出现的页面
const inject = fs.readFileSync(new URL('./inject.js', import.meta.url), 'utf8');
function clean(html) {
  html = html.replace(/<script\b[\s\S]*?<\/script>/g, '')
    .replace(/<link[^>]+rel="(?:preload|modulepreload|expect)"[^>]*>/g, '')
    .replace(/<link rel="stylesheet" href="\/_next\/static\/css\/[^"]+"[^>]*>/g, '<link rel="stylesheet" href="../app.css">')
    .replace(/<next-route-announcer[\s\S]*?<\/next-route-announcer>/g, '')
    .replace(/<template[\s\S]*?<\/template>/g, '')
    .replace(/<a ([^>]*?)href="([^"]+)"/g, (m, pre, href) => {
      if (/^(https?:|mailto:|tel:)/.test(href) && !href.startsWith(BASE)) return m;
      const target = map.get(key(href.replace(BASE, '').replace(/&amp;/g, '&')));
      return `<a ${pre}href="${target ? target + '.html' : '#'}"`;
    })
    .replace(/ target="_blank"/g, '')
    .replace(/http:\/\/localhost:3000/g, 'https://order.example.com');
  return html.replace('</body>', `<script>${inject}</script></body>`);
}
let files = 0;
for (const lang of LANGS) for (const [s, html] of Object.entries(store[lang])) { fs.writeFileSync(`${OUT}/${lang}/${s}.html`, clean(html)); files++; }
fs.writeFileSync(`${OUT}/manifest.json`, JSON.stringify(manifest));
for (const b of browsers) await b.close();
console.log(`\ndone: ${files} pages, ${manifest.actions.length} actions`);
