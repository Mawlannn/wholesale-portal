'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '../session';
import { done, fail, num, str } from '../flash';
import { mailCourierCancel, mailCourierOrder, mailCustomer, mailCustomerApproved, mailRecall, mailTest } from '../mail';

const orderPath = (id: string) => `/admin/orders/${id}`;

// ---------------------------------------------------------------------
// 订单
// ---------------------------------------------------------------------
export async function confirmOrder(fd: FormData) {
  const { supabase } = await requireAdmin();
  const id = str(fd, 'order_id');
  const { error } = await supabase.rpc('confirm_order', { p_order_id: id });
  if (error) fail(orderPath(id), error);
  // 确认后不自动发信：由管理员在订单页点“发给客户”“发给快递”，确认模板后再发
  revalidatePath('/admin', 'layout');
  done(orderPath(id), 'admin.orders.confirmedNext');
}

/** 订单页的两个邮件按钮：发给客户 / 发给快递（内容是生成的模板，可修改） */
export async function sendOrderEmail(fd: FormData) {
  await requireAdmin();
  const id = str(fd, 'order_id');
  const target = str(fd, 'target');
  const draft = { to: str(fd, 'to'), cc: str(fd, 'cc'), subject: str(fd, 'subject'), body: str(fd, 'body') };
  if (!draft.to || !draft.subject || !draft.body) fail(orderPath(id), 'required');
  let status: string;
  if (target === 'courier') status = (await mailCourierOrder(id, draft)).status;
  else status = await mailCustomer(id, str(fd, 'kind') === 'shipped' ? 'shipped' : 'confirmed', draft);
  revalidatePath(orderPath(id));
  if (status === 'failed') fail(orderPath(id), 'mail_failed');
  done(orderPath(id), status === 'sent' ? 'admin.orders.mailSent' : 'admin.orders.mailSkipped');
}

/** 旧的“重新发送快递邮件”保留（用默认模板直接发） */
export async function resendCourier(fd: FormData) {
  await requireAdmin();
  const id = str(fd, 'order_id');
  await mailCourierOrder(id);
  done(orderPath(id), 'admin.orders.resent');
}

export async function markShipped(fd: FormData) {
  const { supabase } = await requireAdmin();
  const id = str(fd, 'order_id');
  const { error } = await supabase.rpc('admin_mark_shipped', { p_order_id: id, p_tracking: str(fd, 'tracking') || null });
  if (error) fail(orderPath(id), error);
  await mailCustomer(id, 'shipped');
  revalidatePath('/admin', 'layout');
  done(orderPath(id), 'admin.orders.shippedOk');
}

export async function adminCancel(fd: FormData) {
  const { supabase } = await requireAdmin();
  const id = str(fd, 'order_id');
  const { data, error } = await supabase.rpc('cancel_order', { p_order_id: id, p_reason: str(fd, 'reason') || null });
  if (error) fail(orderPath(id), error);
  if ((data as { notify_courier: boolean }).notify_courier) await mailCourierCancel(id);
  await mailCustomer(id, 'cancel_ok');
  revalidatePath('/admin', 'layout');
  done(orderPath(id), 'admin.orders.cancelledOk');
}

export async function rejectCancel(fd: FormData) {
  const { supabase } = await requireAdmin();
  const id = str(fd, 'order_id');
  const { error } = await supabase.rpc('reject_cancel_request', { p_order_id: id });
  if (error) fail(orderPath(id), error);
  await mailCustomer(id, 'cancel_ng');
  revalidatePath('/admin', 'layout');
  done(orderPath(id), 'admin.orders.rejected');
}

export async function saveOrderNote(fd: FormData) {
  const { supabase } = await requireAdmin();
  const id = str(fd, 'order_id');
  await supabase.from('orders').update({ admin_note: str(fd, 'admin_note') || null }).eq('id', id);
  done(orderPath(id), 'common.saved');
}

// ---------------------------------------------------------------------
// 商品
// ---------------------------------------------------------------------
export async function saveProduct(fd: FormData) {
  const { supabase } = await requireAdmin();
  const id = str(fd, 'id');
  const path = id ? `/admin/products/${id}` : '/admin/products/new';
  const row: Record<string, unknown> = {
    sku: str(fd, 'sku'),
    name_ja: str(fd, 'name_ja'),
    name_zh: str(fd, 'name_zh') || null,
    name_en: str(fd, 'name_en') || null,
    description: str(fd, 'description') || null,
    category: str(fd, 'category') || null,
    brand: str(fd, 'brand') || null,
    origin_country: str(fd, 'origin_country') || null,
    unit_per_case: num(fd, 'unit_per_case') ?? 1,
    price_per_case: num(fd, 'price_per_case'),
    tax_rate: num(fd, 'tax_rate') === 10 ? 10 : 8,
    min_order_qty: num(fd, 'min_order_qty') ?? 1,
    low_stock_threshold: num(fd, 'low_stock_threshold') ?? 0,
    is_active: str(fd, 'is_active') === '1',
  };
  if (!row.sku || !row.name_ja || row.price_per_case == null) fail(path, 'required');

  const file = fd.get('image');
  if (file instanceof File && file.size > 0) {
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
    const key = `${String(row.sku).replace(/[^\w-]/g, '_')}-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from('product-images').upload(key, file, { contentType: file.type, upsert: false });
    if (upErr) fail(path, 'upload_failed');
    row.image_url = supabase.storage.from('product-images').getPublicUrl(key).data.publicUrl;
  }

  const res = id
    ? await supabase.from('products').update(row).eq('id', id).select('id').single()
    : await supabase.from('products').insert(row).select('id').single();
  if (res.error) fail(path, res.error.code === '23505' ? 'sku_taken' : res.error);
  revalidatePath('/admin/products');
  done(`/admin/products/${res.data.id}`, id ? 'common.saved' : 'admin.products.created');
}

export async function saveCustomerPrice(fd: FormData) {
  const { supabase } = await requireAdmin();
  const product_id = str(fd, 'product_id');
  const path = `/admin/products/${product_id}`;
  const price = num(fd, 'price');
  if (str(fd, 'op') === 'delete') {
    await supabase.from('customer_prices').delete().eq('product_id', product_id).eq('customer_id', str(fd, 'customer_id'));
    done(path, 'common.saved');
  }
  if (price == null || !str(fd, 'customer_id')) fail(path, 'required');
  const { error } = await supabase.from('customer_prices').upsert({ product_id, customer_id: str(fd, 'customer_id'), price_per_case: price });
  if (error) fail(path, error);
  done(path, 'common.saved');
}

// ---------------------------------------------------------------------
// 库存
// ---------------------------------------------------------------------
export async function receiveLot(fd: FormData) {
  const { supabase } = await requireAdmin();
  const back = str(fd, 'back') || '/admin/inbound';
  const { error } = await supabase.rpc('receive_lot', {
    p_product_id: str(fd, 'product_id'),
    p_lot_no: str(fd, 'lot_no'),
    p_qty: num(fd, 'qty'),
    p_expiry: str(fd, 'expiry') || null,
    p_unit_cost: num(fd, 'unit_cost'),
    p_received_at: str(fd, 'received_at') || null,
    p_note: str(fd, 'note') || null,
  });
  if (error) fail(back, error);
  revalidatePath('/admin', 'layout');
  done(back, 'admin.inbound.done');
}

export async function adjustLot(fd: FormData) {
  const { supabase } = await requireAdmin();
  const back = str(fd, 'back') || '/admin/inventory';
  const { error } = await supabase.rpc('adjust_lot', { p_lot_id: str(fd, 'lot_id'), p_new_qty: num(fd, 'qty'), p_reason: str(fd, 'reason') });
  if (error) fail(back, error);
  revalidatePath('/admin', 'layout');
  done(back, 'admin.inventory.adjustDone');
}

// ---------------------------------------------------------------------
// 客户 / 账款
// ---------------------------------------------------------------------
export async function setCustomerStatus(fd: FormData) {
  const { supabase } = await requireAdmin();
  const id = str(fd, 'customer_id');
  const status = str(fd, 'status');
  const back = str(fd, 'back') || `/admin/customers/${id}`;
  const { data: before } = await supabase.from('customers').select('approved_at').eq('id', id).single();
  const { error } = await supabase.rpc('set_customer_status', { p_customer_id: id, p_status: status });
  if (error) fail(back, error);
  if (status === 'approved' && !before?.approved_at) await mailCustomerApproved(id);
  revalidatePath('/admin', 'layout');
  done(back, status === 'approved' ? 'admin.customers.approvedOk' : 'common.saved');
}

export async function saveCustomerTerms(fd: FormData) {
  const { supabase } = await requireAdmin();
  const id = str(fd, 'customer_id');
  const { error } = await supabase.from('customers').update({
    credit_limit: num(fd, 'credit_limit'),
    payment_terms_days: num(fd, 'payment_terms_days'),
    admin_note: str(fd, 'admin_note') || null,
  }).eq('id', id);
  if (error) fail(`/admin/customers/${id}`, error);
  done(`/admin/customers/${id}`, 'common.saved');
}

export async function recordPayment(fd: FormData) {
  const { supabase } = await requireAdmin();
  const id = str(fd, 'customer_id');
  const mode = str(fd, 'mode');
  const ids = fd.getAll('receivable_ids').map(String).filter(Boolean);
  const { error } = await supabase.rpc('record_payment', {
    p_customer_id: id,
    p_amount: num(fd, 'amount'),
    p_paid_on: str(fd, 'paid_on') || null,
    p_method: str(fd, 'method') || 'bank',
    p_note: str(fd, 'note') || null,
    p_receivable_ids: mode === 'selected' && ids.length ? ids : null,
    p_month: mode === 'month' ? str(fd, 'month') || null : null,
  });
  if (error) fail(`/admin/customers/${id}`, error);
  revalidatePath('/admin', 'layout');
  done(`/admin/customers/${id}`, 'admin.customers.paymentDone');
}

export async function voidPayment(fd: FormData) {
  const { supabase } = await requireAdmin();
  const id = str(fd, 'customer_id');
  const { error } = await supabase.rpc('void_payment', { p_payment_id: str(fd, 'payment_id'), p_reason: str(fd, 'reason') });
  if (error) fail(`/admin/customers/${id}`, error);
  revalidatePath('/admin', 'layout');
  done(`/admin/customers/${id}`, 'admin.customers.voided');
}

// ---------------------------------------------------------------------
// 设置 / 召回
// ---------------------------------------------------------------------
export async function changeAdminPassword(fd: FormData) {
  const { supabase } = await requireAdmin();
  const pw = str(fd, 'password');
  if (pw.length < 8) fail('/admin/settings', 'weak_password');
  const { error } = await supabase.auth.updateUser({ password: pw });
  if (error) fail('/admin/settings', error.message);
  done('/admin/settings', 'auth.passwordUpdated');
}

export async function sendTestMail(fd: FormData) {
  await requireAdmin();
  const to = str(fd, 'to');
  if (!to) fail('/admin/settings', 'required');
  const status = await mailTest(to);
  if (status === 'failed') fail('/admin/settings', 'mail_failed');
  done('/admin/settings', status === 'sent' ? 'admin.settings.testSent' : 'admin.orders.mailSkipped');
}

export async function saveSettings(fd: FormData) {
  const { supabase } = await requireAdmin();
  const keys = ['company_name', 'company_address', 'company_phone', 'company_email', 'invoice_reg_no', 'bank_info',
    'courier_name', 'courier_email', 'courier_cc', 'courier_locale', 'order_cutoff'] as const;
  const row: Record<string, unknown> = Object.fromEntries(keys.map((k) => [k, str(fd, k)]));
  row.default_payment_terms_days = num(fd, 'default_payment_terms_days') ?? 30;
  row.expiry_alert_days = num(fd, 'expiry_alert_days') ?? 60;
  row.updated_at = new Date().toISOString();
  const { error } = await supabase.from('settings').update(row).eq('id', 1);
  if (error) fail('/admin/settings', error);
  revalidatePath('/', 'layout');
  done('/admin/settings', 'common.saved');
}

export async function sendRecall(fd: FormData) {
  const { supabase } = await requireAdmin();
  const lot = str(fd, 'lot');
  const back = `/admin/recall?lot=${encodeURIComponent(lot)}`;
  const message = str(fd, 'message');
  if (!message) fail(back, 'required');
  const { data, error } = await supabase.rpc('recall_lookup', { p_lot_no: lot });
  if (error) fail(back, error);
  const uniq = new Map<string, { id: string; email: string | null }>();
  for (const r of (data ?? []) as { customer_id: string; email: string | null }[]) uniq.set(r.customer_id, { id: r.customer_id, email: r.email });
  const n = await mailRecall(lot, message, [...uniq.values()]);
  done(`${back}&sent=${n}`, 'admin.recall.sent');
}
