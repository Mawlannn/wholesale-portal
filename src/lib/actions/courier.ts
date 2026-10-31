'use server';

import { createClient } from '../supabase/server';
import { createServiceClient } from '../supabase/admin';
import { done, fail, str } from '../flash';
import { mailAdmin, mailCustomer } from '../mail';

/** 快递商点击“确认已出货”（无需登录，凭链接中的令牌） */
export async function courierConfirm(fd: FormData) {
  const token = str(fd, 'token');
  const path = `/courier/${token}`;
  if (!/^[0-9a-f-]{36}$/i.test(token)) fail(path, 'not_found');
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('courier_confirm', { p_token: token, p_tracking: str(fd, 'tracking') || null });
  if (error) fail(path, error);
  if (data === 'shipped') {
    const { data: o } = await createServiceClient().from('orders').select('id').eq('courier_token', token).single();
    if (o) {
      await mailCustomer(o.id, 'shipped');
      await mailAdmin('courier_shipped', { orderId: o.id });
    }
  }
  done(path, 'courier.done');
}
