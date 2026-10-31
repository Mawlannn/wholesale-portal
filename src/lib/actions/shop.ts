'use server';

import { revalidatePath } from 'next/cache';
import { requireCustomer } from '../session';
import { done, fail, num, str } from '../flash';
import { mailAdmin } from '../mail';

const back = (fd: FormData, fallback: string) => str(fd, 'back') || fallback;

export async function addToCart(fd: FormData) {
  const { supabase, customer } = await requireCustomer();
  const product_id = str(fd, 'product_id');
  const qty = Math.max(0, Math.floor(num(fd, 'qty') ?? 0));
  const path = back(fd, '/shop');
  if (!qty) fail(path, 'invalid_qty');
  const { data: existing } = await supabase.from('cart_items').select('qty_cases').eq('customer_id', customer.id).eq('product_id', product_id).maybeSingle();
  const { error } = await supabase.from('cart_items').upsert({
    customer_id: customer.id, product_id, qty_cases: (existing?.qty_cases ?? 0) + qty, updated_at: new Date().toISOString(),
  });
  if (error) fail(path, error);
  revalidatePath('/shop', 'layout');
  done(path, 'shop.added');
}

export async function setCartQty(fd: FormData) {
  const { supabase, customer } = await requireCustomer();
  const product_id = str(fd, 'product_id');
  const qty = Math.max(0, Math.floor(num(fd, 'qty') ?? 0));
  if (qty === 0) await supabase.from('cart_items').delete().eq('customer_id', customer.id).eq('product_id', product_id);
  else await supabase.from('cart_items').update({ qty_cases: qty, updated_at: new Date().toISOString() }).eq('customer_id', customer.id).eq('product_id', product_id);
  revalidatePath('/shop', 'layout');
}

export async function toggleFavorite(fd: FormData) {
  const { supabase, customer } = await requireCustomer();
  const product_id = str(fd, 'product_id');
  if (str(fd, 'on') === '1') await supabase.from('favorites').upsert({ customer_id: customer.id, product_id });
  else await supabase.from('favorites').delete().eq('customer_id', customer.id).eq('product_id', product_id);
  revalidatePath('/shop');
}

export async function placeOrder(fd: FormData) {
  const { supabase, customer } = await requireCustomer();
  const { data: cart } = await supabase.from('cart_items').select('product_id, qty_cases').eq('customer_id', customer.id);
  if (!cart?.length) fail('/shop/cart', 'empty_order');
  const { data, error } = await supabase.rpc('place_order', {
    p_items: cart.map((c) => ({ product_id: c.product_id, qty: c.qty_cases })),
    p_address_id: str(fd, 'address_id'),
    p_delivery_date: str(fd, 'delivery_date') || null,
    p_note: str(fd, 'note') || null,
  });
  if (error) fail('/shop/cart', error);
  await mailAdmin('new_order', { orderId: data as string });
  revalidatePath('/shop', 'layout');
  done(`/shop/orders/${data}`, 'cart.placed');
}

export async function updateOrder(fd: FormData) {
  const { supabase } = await requireCustomer();
  const id = str(fd, 'order_id');
  const ids = fd.getAll('product_id').map(String);
  const qtys = fd.getAll('qty').map((v) => Math.max(0, Math.floor(Number(v) || 0)));
  const items = ids.map((product_id, i) => ({ product_id, qty: qtys[i] })).filter((i) => i.qty > 0);
  const { error } = await supabase.rpc('update_pending_order', {
    p_order_id: id, p_items: items, p_delivery_date: str(fd, 'delivery_date') || null, p_note: str(fd, 'note') || null,
  });
  if (error) fail(`/shop/orders/${id}/edit`, error);
  done(`/shop/orders/${id}`, 'orders.updated');
}

export async function cancelMyOrder(fd: FormData) {
  const { supabase } = await requireCustomer();
  const id = str(fd, 'order_id');
  const { data, error } = await supabase.rpc('cancel_order', { p_order_id: id, p_reason: str(fd, 'reason') || null });
  if (error) fail(`/shop/orders/${id}`, error);
  const result = (data as { result: string }).result;
  if (result === 'requested') await mailAdmin('cancel_request', { orderId: id });
  revalidatePath('/shop', 'layout');
  done(`/shop/orders/${id}`, result === 'requested' ? 'orders.requested' : 'orders.cancelled');
}

export async function reorder(fd: FormData) {
  const { supabase, customer } = await requireCustomer();
  const id = str(fd, 'order_id');
  const { data: items } = await supabase.from('order_items').select('product_id, qty_cases').eq('order_id', id);
  const { data: cart } = await supabase.from('cart_items').select('product_id, qty_cases').eq('customer_id', customer.id);
  const cur = new Map((cart ?? []).map((c) => [c.product_id, c.qty_cases]));
  const rows = (items ?? []).map((i) => ({
    customer_id: customer.id, product_id: i.product_id, qty_cases: (cur.get(i.product_id) ?? 0) + i.qty_cases, updated_at: new Date().toISOString(),
  }));
  if (rows.length) await supabase.from('cart_items').upsert(rows);
  revalidatePath('/shop', 'layout');
  done('/shop/cart', 'orders.reordered');
}

// ---------- 公司信息 / 地址 ----------
export async function updateCompany(fd: FormData) {
  const { supabase } = await requireCustomer();
  const { error } = await supabase.rpc('update_my_company', {
    p_contact_name: str(fd, 'contact_name'), p_phone: str(fd, 'phone'), p_postal_code: str(fd, 'postal_code'),
    p_address: str(fd, 'address'), p_invoice_reg_no: str(fd, 'invoice_reg_no'),
  });
  if (error) fail('/shop/profile', error);
  done('/shop/profile', 'common.saved');
}

export async function saveAddress(fd: FormData) {
  const { supabase, customer } = await requireCustomer();
  const id = str(fd, 'id');
  const row = {
    customer_id: customer.id, label: str(fd, 'label'), recipient: str(fd, 'recipient') || null, phone: str(fd, 'phone') || null,
    postal_code: str(fd, 'postal_code') || null, address: str(fd, 'address'),
  };
  if (!row.label || !row.address) fail('/shop/profile', 'required');
  const { error } = id
    ? await supabase.from('customer_addresses').update(row).eq('id', id)
    : await supabase.from('customer_addresses').insert(row);
  if (error) fail('/shop/profile', error);
  done('/shop/profile', 'common.saved');
}

export async function addressAction(fd: FormData) {
  const { supabase, customer } = await requireCustomer();
  const id = str(fd, 'id');
  if (str(fd, 'op') === 'delete') {
    await supabase.from('customer_addresses').delete().eq('id', id).eq('is_default', false);
  } else {
    await supabase.from('customer_addresses').update({ is_default: false }).eq('customer_id', customer.id);
    await supabase.from('customer_addresses').update({ is_default: true }).eq('id', id);
  }
  done('/shop/profile', 'common.saved');
}

export async function changePassword(fd: FormData) {
  const { supabase } = await requireCustomer();
  const pw = str(fd, 'password');
  if (pw.length < 8) fail('/shop/profile', 'weak_password');
  const { error } = await supabase.auth.updateUser({ password: pw });
  if (error) fail('/shop/profile', error.message);
  done('/shop/profile', 'auth.passwordUpdated');
}
