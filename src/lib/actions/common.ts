'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '../supabase/server';
import { isLocale } from '../i18n';
import { LANG_COOKIE } from '../session';

export async function setLanguage(fd: FormData) {
  const lang = fd.get('lang');
  if (!isLocale(lang)) return;
  (await cookies()).set(LANG_COOKIE, lang, { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' });
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (data.user) await supabase.rpc('set_my_locale', { p_locale: lang });
  revalidatePath('/', 'layout');
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}
