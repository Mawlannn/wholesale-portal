import { notFound } from 'next/navigation';
import { requireAdmin, getT } from '@/lib/session';
import { readFlash } from '@/lib/flash';
import { addAdmin, removeAdmin } from '@/lib/actions/team';
import { createServiceClient } from '@/lib/supabase/admin';
import { Avatar, Badge, Card, Field, Flash, Input, List, PageHeader, Row } from '@/components/ui';
import { SubmitButton } from '@/components/client';

// 管理员管理：只有系统所有者能看到
export default async function TeamPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const { user, profile } = await requireAdmin();
  if (!profile?.is_owner) notFound();
  const { t } = await getT();
  const a = t.admin.team;
  const db = createServiceClient();
  const { data: admins } = await db.from('profiles').select('id, email, display_name, is_owner, created_at')
    .eq('role', 'admin').order('created_at');
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title={a.title} sub={a.sub} back="/admin/more" />
      <Flash {...readFlash(t, await searchParams)} />
      <h2 className="mb-2 px-2 text-xs font-bold uppercase tracking-wider text-faint">{a.list}</h2>
      <List className="mb-6">
        {(admins ?? []).map((m) => (
          <Row key={m.id} lead={<Avatar name={m.display_name || m.email || '?'} size={40} />}
            title={<span className="flex items-center gap-2">{m.display_name || m.email}{m.is_owner && <Badge tone="harbor">{a.owner}</Badge>}{m.id === user!.id && <Badge>{a.you}</Badge>}</span>}
            sub={m.display_name ? m.email : undefined}
            end={!m.is_owner && m.id !== user!.id ? (
              <form action={removeAdmin}>
                <input type="hidden" name="id" value={m.id} />
                <SubmitButton variant="secondary" size="sm" confirm={a.removeConfirm}>{a.remove}</SubmitButton>
              </form>
            ) : undefined} />
        ))}
      </List>
      <Card title={a.add}>
        <form action={addAdmin} className="space-y-4">
          <Field label={a.email}><Input name="email" type="email" required autoComplete="off" /></Field>
          <Field label={a.name}><Input name="name" autoComplete="off" /></Field>
          <Field label={a.password} hint={a.passwordHint}><Input name="password" type="password" minLength={8} autoComplete="new-password" /></Field>
          <p className="text-xs text-muted">{a.note}</p>
          <SubmitButton className="w-full" size="lg">{a.addBtn}</SubmitButton>
        </form>
      </Card>
    </div>
  );
}
