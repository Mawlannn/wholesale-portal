import 'server-only';
import { createServiceClient } from './supabase/admin';
import { siteUrl } from './site';
import { fmtDate, isLocale, productName, yen, type Locale } from './i18n';

type Mail = {
  to: string;
  cc?: string;
  subject: string;
  body: string;
  kind: string;
  orderId?: string;
  customerId?: string;
};

/** 当前用哪种方式发信：自己的邮箱（SMTP）优先，其次 Resend，都没配置时只存档 */
export function mailTransport(): { kind: 'smtp' | 'resend' | 'none'; from: string } {
  const from = process.env.EMAIL_FROM || process.env.SMTP_USER || '';
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) return { kind: 'smtp', from };
  if (process.env.RESEND_API_KEY) return { kind: 'resend', from: from || 'onboarding@resend.dev' };
  return { kind: 'none', from };
}

const list = (s?: string) => (s ?? '').split(/[,;，、\s]+/).map((x) => x.trim()).filter(Boolean);

async function deliver(m: Mail, replyTo: string | undefined) {
  const tr = mailTransport();
  if (tr.kind === 'smtp') {
    const nodemailer = (await import('nodemailer')).default;
    const port = Number(process.env.SMTP_PORT || 465);
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST, port, secure: port === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
    await transporter.sendMail({ from: tr.from, to: list(m.to), cc: list(m.cc), replyTo, subject: m.subject, text: m.body });
    return;
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: tr.from, to: list(m.to), cc: m.cc ? list(m.cc) : undefined, reply_to: replyTo, subject: m.subject, text: m.body }),
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
}

/** 发送邮件并永久存档。没有配置发信方式时只存档、不发送（状态 skipped） */
export async function sendMail(m: Mail): Promise<'sent' | 'failed' | 'skipped'> {
  const db = createServiceClient();
  let status: 'sent' | 'failed' | 'skipped' = 'skipped';
  let error: string | null = null;
  if (mailTransport().kind !== 'none' && list(m.to).length) {
    const { data: s } = await db.from('settings').select('company_email').eq('id', 1).single();
    try {
      await deliver(m, s?.company_email || undefined);
      status = 'sent';
    } catch (e) {
      status = 'failed';
      error = String(e instanceof Error ? e.message : e).slice(0, 500);
    }
  }
  await db.from('email_log').insert({
    order_id: m.orderId ?? null,
    customer_id: m.customerId ?? null,
    kind: m.kind,
    to_addr: [m.to, m.cc].filter(Boolean).join(', ') || '-',
    subject: m.subject,
    body: m.body,
    status,
    error,
  });
  return status;
}

const site = siteUrl;

// ---------------------------------------------------------------------
// 邮件模板（三种语言）
// ---------------------------------------------------------------------
const T = {
  ja: {
    courierSubject: '【出荷依頼】{no} {company}',
    courierCancelSubject: '【出荷取消】{no} {company}',
    courierHello: '{courier} ご担当者様\n\nいつもお世話になっております。{sender}です。\n下記の通り出荷をお願いいたします。',
    courierCancelBody: '{courier} ご担当者様\n\n下記の出荷依頼はキャンセルになりました。出荷しないでください。\n既に出荷済みの場合はご連絡ください。',
    courierLink: '出荷後、下記リンクから追跡番号を入力して「出荷済み」を押してください：',
    no: '注文番号', items: '出荷商品', shipTo: 'お届け先', tel: '電話', delivery: '希望納品日', note: '備考', none: '指定なし',
    caseUnit: 'ケース', perCase: '入数',
    confirmedSubject: '【ご注文確定】{no}', confirmedBody: '{company} 様\n\nご注文を確定し、出荷の手配をしました。',
    shippedSubject: '【出荷のお知らせ】{no}', shippedBody: '{company} 様\n\nご注文の商品を出荷しました。', tracking: '追跡番号',
    cancelOkSubject: '【キャンセル承認】{no}', cancelOkBody: '{company} 様\n\nご注文のキャンセルを承りました。',
    cancelNgSubject: '【キャンセル不可】{no}', cancelNgBody: '{company} 様\n\n申し訳ございません。既に出荷手配が進んでいるため、キャンセルできませんでした。ご不明な点はご連絡ください。',
    approvedSubject: '【登録完了】ご注文いただけるようになりました', approvedBody: '{company} 様\n\nご登録を承認しました。下記からログインしてご注文ください。',
    total: '合計（税込）', view: '詳細', sign: '\n\n{sender}',
    adminNewOrderSubject: '[新規注文] {no} {company}', adminNewCustomerSubject: '[新規登録] {company}', adminCancelSubject: '[キャンセル申請] {no} {company}',
    adminCourierShippedSubject: '[出荷登録] {no} {company}',
    recallSubject: '【重要】商品回収のお知らせ（ロット {lot}）',
  },
  zh: {
    courierSubject: '【出货委托】{no} {company}',
    courierCancelSubject: '【取消出货】{no} {company}',
    courierHello: '{courier} 负责人您好：\n\n我是{sender}。请按以下内容安排出货。',
    courierCancelBody: '{courier} 负责人您好：\n\n以下出货委托已取消，请不要出货。如已出货请告知。',
    courierLink: '出货后，请打开下面的链接填写快递单号并点击“确认已出货”：',
    no: '订单号', items: '出货商品', shipTo: '收货地址', tel: '电话', delivery: '希望送达日期', note: '备注', none: '不指定',
    caseUnit: '箱', perCase: '每箱',
    confirmedSubject: '【订单已确认】{no}', confirmedBody: '{company} 您好：\n\n您的订单已确认，正在安排出货。',
    shippedSubject: '【已发货】{no}', shippedBody: '{company} 您好：\n\n您订购的商品已发货。', tracking: '快递单号',
    cancelOkSubject: '【取消已同意】{no}', cancelOkBody: '{company} 您好：\n\n您的订单已取消。',
    cancelNgSubject: '【无法取消】{no}', cancelNgBody: '{company} 您好：\n\n很抱歉，订单已经在出货中，无法取消。如有疑问请联系我们。',
    approvedSubject: '【注册通过】现在可以下单了', approvedBody: '{company} 您好：\n\n您的注册已审核通过，请通过下面的链接登录下单。',
    total: '合计（含税）', view: '查看详情', sign: '\n\n{sender}',
    adminNewOrderSubject: '[新订单] {no} {company}', adminNewCustomerSubject: '[新客户注册] {company}', adminCancelSubject: '[取消申请] {no} {company}',
    adminCourierShippedSubject: '[快递已确认出货] {no} {company}',
    recallSubject: '【重要】商品召回通知（批次 {lot}）',
  },
  en: {
    courierSubject: '[Shipping request] {no} {company}',
    courierCancelSubject: '[Shipment cancelled] {no} {company}',
    courierHello: 'Hello {courier},\n\nThis is {sender}. Please ship the following order.',
    courierCancelBody: 'Hello {courier},\n\nThe shipping request below has been cancelled. Please do not ship it, and let us know if it already went out.',
    courierLink: 'After shipping, open this link, enter the tracking number and press "Mark as shipped":',
    no: 'Order no.', items: 'Items', shipTo: 'Deliver to', tel: 'Phone', delivery: 'Delivery date', note: 'Note', none: 'No preference',
    caseUnit: 'cases', perCase: 'per case',
    confirmedSubject: '[Order confirmed] {no}', confirmedBody: 'Dear {company},\n\nYour order is confirmed and being prepared for shipment.',
    shippedSubject: '[Shipped] {no}', shippedBody: 'Dear {company},\n\nYour order has been shipped.', tracking: 'Tracking no.',
    cancelOkSubject: '[Cancellation approved] {no}', cancelOkBody: 'Dear {company},\n\nYour order has been cancelled.',
    cancelNgSubject: '[Cancellation not possible] {no}', cancelNgBody: 'Dear {company},\n\nSorry — the order is already being shipped, so it could not be cancelled. Please contact us with any questions.',
    approvedSubject: '[Registration approved] You can now place orders', approvedBody: 'Dear {company},\n\nYour registration is approved. Sign in below to place orders.',
    total: 'Total (incl. tax)', view: 'View', sign: '\n\n{sender}',
    adminNewOrderSubject: '[New order] {no} {company}', adminNewCustomerSubject: '[New registration] {company}', adminCancelSubject: '[Cancel request] {no} {company}',
    adminCourierShippedSubject: '[Courier confirmed shipment] {no} {company}',
    recallSubject: '[Important] Product recall notice (lot {lot})',
  },
} satisfies Record<Locale, Record<string, string>>;

const fill = (s: string, v: Record<string, string>) => s.replace(/\{(\w+)\}/g, (_, k) => v[k] ?? '');

type OrderRow = {
  id: string; order_no: string; customer_id: string; status: string; total: number; courier_token: string | null;
  ship_label: string | null; ship_recipient: string | null; ship_phone: string | null; ship_postal_code: string | null;
  ship_address: string; delivery_date: string | null; note: string | null; tracking_no: string | null;
  customers: { company_name: string; email: string | null };
  order_items: { sku: string; name_ja: string; name_zh: string | null; name_en: string | null; qty_cases: number; unit_per_case: number }[];
};

async function loadOrder(orderId: string) {
  const db = createServiceClient();
  const [{ data: order }, { data: settings }] = await Promise.all([
    db.from('orders').select('*, customers(company_name, email), order_items(sku, name_ja, name_zh, name_en, qty_cases, unit_per_case)')
      .eq('id', orderId).single<OrderRow>(),
    db.from('settings').select('*').eq('id', 1).single(),
  ]);
  return { db, order: order!, settings: settings! };
}

async function customerLocale(customerId: string): Promise<Locale> {
  const db = createServiceClient();
  const { data } = await db.from('profiles').select('locale').eq('customer_id', customerId).eq('member_role', 'owner').limit(1).maybeSingle();
  return isLocale(data?.locale) ? data!.locale : 'ja';
}

async function adminLocale(): Promise<Locale> {
  const db = createServiceClient();
  const { data } = await db.from('profiles').select('locale').eq('role', 'admin').not('locale', 'is', null).limit(1).maybeSingle();
  return isLocale(data?.locale) ? data!.locale : 'zh';
}

function shipBlock(o: OrderRow, L: (typeof T)[Locale], locale: Locale) {
  const items = o.order_items
    .map((i) => `・${i.sku}  ${productName(i, locale)}  ×${i.qty_cases} ${L.caseUnit}（${L.perCase} ${i.unit_per_case}）`)
    .join('\n');
  return [
    `${L.no}: ${o.order_no}`,
    '',
    `■ ${L.items}`,
    items,
    '',
    `■ ${L.shipTo}`,
    [o.ship_label, o.ship_recipient].filter(Boolean).join(' / '),
    `〒${o.ship_postal_code ?? ''} ${o.ship_address}`,
    `${L.tel}: ${o.ship_phone ?? '-'}`,
    '',
    `${L.delivery}: ${o.delivery_date ? fmtDate(o.delivery_date, locale) : L.none}`,
    o.note ? `${L.note}: ${o.note}` : '',
  ].filter((l) => l !== null).join('\n');
}

export type Draft = { to: string; cc: string; subject: string; body: string };

/** 生成发给快递商的出货委托邮件（含确认链接），管理员可以改完再发 */
export async function composeCourierOrder(orderId: string): Promise<Draft> {
  const { order, settings } = await loadOrder(orderId);
  const locale: Locale = isLocale(settings.courier_locale) ? settings.courier_locale : 'ja';
  const L = T[locale];
  const v = { no: order.order_no, company: order.customers.company_name, courier: settings.courier_name || '', sender: settings.company_name || '' };
  const body = [
    fill(L.courierHello, v),
    '',
    shipBlock(order, L, locale),
    '',
    L.courierLink,
    `${await site()}/courier/${order.courier_token}`,
    fill(L.sign, v),
    [settings.company_phone, settings.company_email].filter(Boolean).join(' / '),
  ].join('\n');
  return { to: settings.courier_email ?? '', cc: settings.courier_cc ?? '', subject: fill(L.courierSubject, v), body };
}

/** 发给快递商：出货委托 */
export async function mailCourierOrder(orderId: string, draft?: Draft) {
  const d = draft ?? (await composeCourierOrder(orderId));
  const { db, order } = await loadOrder(orderId);
  if (!d.to) return { status: 'skipped' as const, ...d };
  const status = await sendMail({ to: d.to, cc: d.cc, subject: d.subject, body: d.body, kind: 'courier_order', orderId, customerId: order.customer_id });
  if (status === 'sent') await db.from('orders').update({ courier_notified_at: new Date().toISOString() }).eq('id', orderId);
  return { status, ...d };
}

/** 发给快递商：取消出货 */
export async function mailCourierCancel(orderId: string) {
  const { order, settings } = await loadOrder(orderId);
  if (!settings.courier_email) return;
  const locale: Locale = isLocale(settings.courier_locale) ? settings.courier_locale : 'ja';
  const L = T[locale];
  const v = { no: order.order_no, company: order.customers.company_name, courier: settings.courier_name || '', sender: settings.company_name || '' };
  await sendMail({
    to: settings.courier_email, cc: settings.courier_cc, kind: 'courier_cancel', orderId, customerId: order.customer_id,
    subject: fill(L.courierCancelSubject, v),
    body: [fill(L.courierCancelBody, v), '', shipBlock(order, L, locale), fill(L.sign, v)].join('\n'),
  });
}

export type CustomerMailKind = 'confirmed' | 'shipped' | 'cancel_ok' | 'cancel_ng';

/** 生成发给客户的订单邮件（含商品明细），管理员可以改完再发 */
export async function composeCustomer(orderId: string, kind: CustomerMailKind): Promise<Draft> {
  const { order, settings } = await loadOrder(orderId);
  const locale = await customerLocale(order.customer_id);
  const L = T[locale];
  const v = { no: order.order_no, company: order.customers.company_name, sender: settings.company_name || '' };
  const map = {
    confirmed: [L.confirmedSubject, L.confirmedBody],
    shipped: [L.shippedSubject, L.shippedBody],
    cancel_ok: [L.cancelOkSubject, L.cancelOkBody],
    cancel_ng: [L.cancelNgSubject, L.cancelNgBody],
  } as const;
  const [subj, intro] = map[kind];
  const lines = [fill(intro, v), ''];
  if (kind === 'confirmed' || kind === 'shipped') lines.push(shipBlock(order, L, locale), '');
  else lines.push(`${L.no}: ${order.order_no}`);
  lines.push(`${L.total}: ${yen(order.total)}`);
  if (kind === 'shipped' && order.tracking_no) lines.push(`${L.tracking}: ${order.tracking_no}`);
  lines.push('', `${L.view}: ${await site()}/shop/orders/${order.id}`, fill(L.sign, v), [settings.company_phone, settings.company_email].filter(Boolean).join(' / '));
  return { to: order.customers.email ?? '', cc: '', subject: fill(subj, v), body: lines.join('\n') };
}

/** 发给客户：订单状态变化 */
export async function mailCustomer(orderId: string, kind: CustomerMailKind, draft?: Draft) {
  const d = draft ?? (await composeCustomer(orderId, kind));
  if (!d.to) return 'skipped' as const;
  const { order } = await loadOrder(orderId);
  return sendMail({ to: d.to, cc: d.cc, subject: d.subject, body: d.body, kind: `customer_${kind}`, orderId, customerId: order.customer_id });
}

/** 设置页：发一封测试邮件给自己 */
export async function mailTest(to: string) {
  return sendMail({ to, subject: 'Test / テスト / 测试', body: 'OK — ' + new Date().toISOString(), kind: 'test' });
}

export async function mailCustomerApproved(customerId: string) {
  const db = createServiceClient();
  const [{ data: c }, { data: s }] = await Promise.all([
    db.from('customers').select('company_name, email').eq('id', customerId).single(),
    db.from('settings').select('company_name').eq('id', 1).single(),
  ]);
  if (!c?.email) return;
  const L = T[await customerLocale(customerId)];
  const v = { company: c.company_name, sender: s?.company_name || '' };
  await sendMail({
    to: c.email, kind: 'customer_approved', customerId,
    subject: L.approvedSubject,
    body: [fill(L.approvedBody, v), '', `${await site()}/login`, fill(L.sign, v)].join('\n'),
  });
}

/** 发给自己（管理员）：新订单 / 新注册 / 取消申请 / 快递已确认 */
export async function mailAdmin(kind: 'new_order' | 'new_customer' | 'cancel_request' | 'courier_shipped', ref: { orderId?: string; company?: string }) {
  const db = createServiceClient();
  const { data: s } = await db.from('settings').select('company_email').eq('id', 1).single();
  if (!s?.company_email) return;
  const L = T[await adminLocale()];
  let subject = '';
  let body = '';
  if (ref.orderId) {
    const { order } = await loadOrder(ref.orderId);
    const v = { no: order.order_no, company: order.customers.company_name };
    subject = fill(
      kind === 'new_order' ? L.adminNewOrderSubject : kind === 'cancel_request' ? L.adminCancelSubject : L.adminCourierShippedSubject, v);
    body = [`${L.no}: ${order.order_no}`, `${L.total}: ${yen(order.total)}`, '', `${await site()}/admin/orders/${order.id}`].join('\n');
  } else {
    subject = fill(L.adminNewCustomerSubject, { company: ref.company ?? '' });
    body = `${await site()}/admin/customers?tab=pending`;
  }
  await sendMail({ to: s.company_email, subject, body, kind: `admin_${kind}`, orderId: ref.orderId });
}

export async function mailRecall(lot: string, message: string, customers: { id: string; email: string | null }[]) {
  const db = createServiceClient();
  const { data: s } = await db.from('settings').select('company_name, company_phone, company_email').eq('id', 1).single();
  let n = 0;
  for (const c of customers) {
    if (!c.email) continue;
    const L = T[await customerLocale(c.id)];
    await sendMail({
      to: c.email, kind: 'recall', customerId: c.id,
      subject: fill(L.recallSubject, { lot }),
      body: [message, '', `Lot: ${lot}`, '', s?.company_name ?? '', [s?.company_phone, s?.company_email].filter(Boolean).join(' / ')].join('\n'),
    });
    n++;
  }
  return n;
}
