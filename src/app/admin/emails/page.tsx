import Link from 'next/link';
import { requireAdmin, getT } from '@/lib/session';
import { fmtDateTime } from '@/lib/i18n';
import { Badge, Empty, PageHeader } from '@/components/ui';
import { Icons } from '@/components/brand';

export default async function Emails() {
  const { supabase } = await requireAdmin();
  const { t, locale } = await getT();
  const a = t.admin.emails;
  const { data } = await supabase.from('email_log').select('*').order('created_at', { ascending: false }).limit(200);
  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title={a.title} />
      {!data?.length ? <Empty icon={Icons.mail}>{t.common.noData}</Empty> : (
        <ul className="divide-y divide-[#f0f1f4] overflow-hidden rounded-[28px] bg-card shadow-card">
          {data.map((m) => (
            <li key={m.id} className="px-4 py-3.5 sm:px-5">
              <details>
                <summary className="flex cursor-pointer list-none items-center gap-3">
                  <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${m.status === 'sent' ? 'bg-ok-soft text-ok' : m.status === 'failed' ? 'bg-danger-soft text-danger' : 'bg-fill text-muted'}`}>{Icons.mail}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{m.subject}</span>
                    <span className="block truncate text-[0.8rem] text-muted">{m.to_addr} · <span className="num">{fmtDateTime(m.created_at, locale)}</span></span>
                  </span>
                  <Badge tone={m.status === 'sent' ? 'ok' : m.status === 'failed' ? 'danger' : 'neutral'}>{a[m.status as 'sent']}</Badge>
                </summary>
                <pre className="mt-3 overflow-x-auto whitespace-pre-wrap rounded-2xl bg-fill p-3 font-sans text-xs">{m.body}</pre>
                {m.error && <p className="mt-1 text-xs text-danger">{m.error}</p>}
                {m.order_id && <Link href={`/admin/orders/${m.order_id}`} className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-harbor">{t.common.details}{Icons.chevron}</Link>}
              </details>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
