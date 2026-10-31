'use server';

import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { createClient } from '../supabase/server';
import { getLocale } from '../session';
import { done, fail, str } from '../flash';
import { mailAdmin } from '../mail';
import { siteUrl } from '../site';

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
  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(str(fd, 'email'), {
    redirectTo: `${await origin()}/auth/callback?next=/reset-password`,
  });
  done('/forgot', 'auth.resetSent');
}

export async function resetPassword(fd: FormData) {
  const pw = str(fd, 'password');
  if (pw.length < 8) fail('/reset-password', 'weak_password');
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: pw });
  if (error) fail('/reset-password', error.message);
  done('/', 'auth.passwordUpdated');
}
