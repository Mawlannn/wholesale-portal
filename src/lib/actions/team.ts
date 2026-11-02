'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getSession } from '../session';
import { createServiceClient } from '../supabase/admin';
import { done, fail, str } from '../flash';

const PAGE = '/admin/team';

/** 只有系统所有者可以管理管理员 */
async function requireOwner() {
  const s = await getSession();
  if (!s.user) redirect('/login');
  if (s.profile?.role !== 'admin' || !s.profile.is_owner) fail(PAGE, 'owner_only');
  return s;
}

export async function addAdmin(fd: FormData) {
  const s = await requireOwner();
  const email = str(fd, 'email').toLowerCase();
  const name = str(fd, 'name');
  const password = str(fd, 'password');
  if (!email) fail(PAGE, 'required');
  if (password && password.length < 8) fail(PAGE, 'weak_password');
  const db = createServiceClient();

  const { data: existing } = await db.from('profiles').select('id').ilike('email', email).maybeSingle();
  let id = existing?.id as string | undefined;
  if (!id) {
    const { data, error } = await db.auth.admin.createUser({
      email,
      email_confirm: true,
      ...(password ? { password } : {}),
      user_metadata: name ? { contact_name: name } : {},
    });
    if (error || !data.user) fail(PAGE, /registered|exists/i.test(error?.message ?? '') ? 'email_taken' : 'generic');
    id = data.user.id;
  } else if (password) {
    const { error } = await db.auth.admin.updateUserById(id, { password });
    if (error) fail(PAGE, 'generic');
  }

  const patch: Record<string, unknown> = { role: 'admin' };
  if (name) patch.display_name = name;
  const { error } = await db.from('profiles').update(patch).eq('id', id);
  if (error) fail(PAGE, error);
  await db.from('audit_logs').insert({ actor_id: s.user!.id, action: 'admin_added', entity: 'profile', entity_id: id, detail: { email } });
  revalidatePath(PAGE);
  done(PAGE, 'admin.team.added');
}

export async function removeAdmin(fd: FormData) {
  const s = await requireOwner();
  const id = str(fd, 'id');
  if (!id) fail(PAGE, 'generic');
  if (id === s.user!.id) fail(PAGE, 'cannot_remove_self');
  const db = createServiceClient();
  const { data: p } = await db.from('profiles').select('is_owner').eq('id', id).single();
  if (p?.is_owner) fail(PAGE, 'owner_only');
  const { error } = await db.from('profiles').update({ role: 'customer' }).eq('id', id);
  if (error) fail(PAGE, error);
  await db.from('audit_logs').insert({ actor_id: s.user!.id, action: 'admin_removed', entity: 'profile', entity_id: id, detail: {} });
  revalidatePath(PAGE);
  done(PAGE, 'admin.team.removed');
}
