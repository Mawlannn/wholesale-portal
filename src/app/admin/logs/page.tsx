import { requireAdmin, getT } from '@/lib/session';
import { fmtDateTime } from '@/lib/i18n';
import { Empty, PageHeader } from '@/components/ui';
import { Icons } from '@/components/brand';

export default async function Logs() {
  const { supabase } = await requireAdmin();
  const { t, locale } = await getT();
  const a = t.admin.logs;
  const [{ data }, { data: people }] = await Promise.all([
    supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(300),
    supabase.from('profiles').select('id, email'),
  ]);
  const who = new Map((people ?? []).map((p) => [p.id, p.email]));
  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title={a.title} />
      {!data?.length ? <Empty icon={Icons.clock}>{t.common.noData}</Empty> : (
        <ul className="divide-y divide-[#f0f1f4] overflow-hidden rounded-[28px] bg-card shadow-card">
          {data.map((l) => (
            <li key={l.id} className="px-4 py-3 sm:px-5">
              <details>
                <summary className="flex cursor-pointer list-none items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-fill">{Icons.clock}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{l.action} <span className="font-medium text-muted">{l.entity}</span></span>
                    <span className="block truncate text-xs text-muted">{l.actor_id ? who.get(l.actor_id) ?? l.actor_id.slice(0, 8) : 'system / courier'}</span>
                  </span>
                  <span className="shrink-0 text-xs text-muted num">{fmtDateTime(l.created_at, locale)}</span>
                </summary>
                <pre className="mt-2 max-w-full overflow-x-auto whitespace-pre-wrap rounded-2xl bg-fill p-3 text-xs">{JSON.stringify(l.detail, null, 2)}</pre>
              </details>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
