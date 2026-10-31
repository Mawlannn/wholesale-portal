import 'server-only';
import { cache } from 'react';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from './supabase/server';
import { dictionaries, isLocale, pickFromAcceptLanguage, type Dict, type Locale } from './i18n';

export const LANG_COOKIE = 'lang';

/** 语言：手动选择（cookie）> 浏览器语言 > 日语 */
export const getLocale = cache(async (): Promise<Locale> => {
  const c = (await cookies()).get(LANG_COOKIE)?.value;
  if (isLocale(c)) return c;
  return pickFromAcceptLanguage((await headers()).get('accept-language'));
});

export async function getT(): Promise<{ t: Dict; locale: Locale }> {
  const locale = await getLocale();
  return { t: dictionaries[locale], locale };
}

export type Profile = {
  id: string;
  role: 'admin' | 'customer';
  customer_id: string | null;
  member_role: 'owner' | 'staff';
  display_name: string | null;
  email: string | null;
  locale: Locale | null;
};

export type Customer = {
  id: string;
  company_name: string;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  postal_code: string | null;
  address: string | null;
  invoice_reg_no: string | null;
  note: string | null;
  status: 'pending' | 'approved' | 'suspended';
  credit_limit: number | null;
  payment_terms_days: number | null;
  admin_note: string | null;
  created_at: string;
};

export const getSession = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, profile: null as Profile | null, customer: null as Customer | null };
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single<Profile>();
  let customer: Customer | null = null;
  if (profile?.customer_id) {
    const { data } = await supabase.from('customers').select('*').eq('id', profile.customer_id).single<Customer>();
    customer = data;
  }
  return { supabase, user, profile, customer };
});

export async function requireAdmin() {
  const s = await getSession();
  if (!s.user) redirect('/login');
  if (s.profile?.role !== 'admin') redirect('/');
  return s;
}

/** 客户页面：必须登录且审核通过 */
export async function requireCustomer() {
  const s = await getSession();
  if (!s.user) redirect('/login');
  if (s.profile?.role === 'admin') redirect('/admin');
  if (!s.customer || s.customer.status !== 'approved') redirect('/pending');
  return { ...s, customer: s.customer, profile: s.profile! };
}
