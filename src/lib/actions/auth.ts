'use server';

import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { createClient } from '../supabase/server';
import { getLocale } from '../session';
import { done, fail, str } from '../flash';
import { mailAdmin } from '../mail';
import { siteUrl } from '../site';
import { createClient as createPlainClient } from '@supabase/supabase-js';
import { createServiceClient } from '../supabase/admin';

const origin = siteUrl;

export async function login(fd: FormData) {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email: str(fd, 'email'), password: str(fd, 'password') });
  if (error) redirect('/login?err=invalid_login');
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', data.user.id).single();
  redirect(profile?.role === 'admin' ? '/admin' : '/shop');
}

export async function register(fd: FormData) {
  const required = ['company_name', 'contact_name', 'phone', 'email', 'password', 'address'];
  if (required.some((k) => !str(fd, k))) fail('/register', 'required');
  if (str(fd, 'password').length < 8) fail('/register', 'weak_password');
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: str(fd, 'email'),
    password: str(fd, 'password'),
    options: {
      emailRedirectTo: `${await origin()}/auth/callback?next=/pending`,
      data: {
        company_name: str(fd, 'company_name'),
        contact_name: str(fd, 'contact_name'),
        phone: str(fd, 'phone'),
        postal_code: str(fd, 'postal_code'),
        address: str(fd, 'address'),
        invoice_reg_no: str(fd, 'invoice_reg_no'),
        note: str(fd, 'note'),
        locale: await getLocale(),
      },
    },
  });
  if (error) fail('/register', /registered|exists/i.test(error.message) ? 'email_taken' : error.message);
  // Supabase 对已注册邮箱会返回没有 identities 的用户
  if (data.user && data.user.identities?.length === 0) fail('/register', 'email_taken');
  await mailAdmin('new_customer', { company: str(fd, 'company_name') });
  if (!data.session) redirect('/login?ok=auth.checkEmail');
  redirect('/pending');
}

export async function forgotPassword(fd: FormData) {
  // 用 implicit 方式：邮件链接在任何浏览器 / 手机里打开都能用（PKCE 方式要求在同一个浏览器里打开）
  const supabase = createPlainClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { flowType: 'implicit', persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  await supabase.auth.resetPasswordForEmail(str(fd, 'email'), {
    redirectTo: `${await origin()}/auth/confirm?next=/reset-password`,
  });
  done('/forgot', 'auth.resetSent');
}

export async function resetPassword(fd: FormData) {
  const pw = str(fd, 'password');
  if (pw.length < 8) fail('/reset-password', 'weak_password');
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) fail('/forgot', 'link_expired');
  const { error } = await supabase.auth.updateUser({ password: pw });
  if (error) fail('/reset-password', error.message);
  done('/', 'auth.passwordUpdated');
}

/** 邮件链接（implicit 方式）带回的令牌：写入登录 cookie 后跳转 */
export async function acceptEmailTokens(accessToken: string, refreshToken: string, next: string) {
  const dest = next.startsWith('/') && !next.startsWith('//') ? next : '/';
  if (!accessToken || !refreshToken) fail('/forgot', 'link_expired');
  const supabase = await createClient();
  const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
  if (error) fail('/forgot', 'link_expired');
  redirect(dest);
}

/** Google 登录 / 注册（第一次登录会要求补充公司信息） */
export async function signInWithGoogle() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${await origin()}/auth/callback?next=/`, queryParams: { prompt: 'select_account' } },
  });
  if (error || !data.url) fail('/login', error?.message ?? 'generic');
  redirect(data.url);
}

/** Google 用户第一次登录后补充公司信息 */
export async function completeProfile(fd: FormData) {
  const required = ['company_name', 'contact_name', 'phone', 'address'];
  if (required.some((k) => !str(fd, k))) fail('/complete-profile', 'required');
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const db = createServiceClient();
  const { data: profile } = await db.from('profiles').select('customer_id, role').eq('id', user.id).single();
  if (profile?.role === 'admin') redirect('/admin');
  if (profile?.customer_id) redirect('/pending');
  const v = (k: string) => str(fd, k) || null;
  const { data: c, error } = await db.from('customers').insert({
    company_name: str(fd, 'company_name'), contact_name: str(fd, 'contact_name'), phone: str(fd, 'phone'),
    email: user.email, postal_code: v('postal_code'), address: str(fd, 'address'),
    invoice_reg_no: v('invoice_reg_no'), note: v('note'),
  }).select('id').single();
  if (error || !c) fail('/complete-profile', error);
  await db.from('customer_addresses').insert({
    customer_id: c.id, label: str(fd, 'company_name'), recipient: str(fd, 'contact_name'), phone: str(fd, 'phone'),
    postal_code: v('postal_code'), address: str(fd, 'address'), is_default: true,
  });
  await db.from('profiles').update({ customer_id: c.id, display_name: str(fd, 'contact_name'), locale: await getLocale() }).eq('id', user.id);
  await mailAdmin('new_customer', { company: str(fd, 'company_name') });
  redirect('/pending');
}
