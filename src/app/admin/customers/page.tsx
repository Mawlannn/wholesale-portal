import { requireAdmin, getT } from '@/lib/session';
import { readFlash } from '@/lib/flash';
import { fmtDate, yen } from '@/lib/i18n';
import { setCustomerStatus } from '@/lib/actions/admin';
import { Avatar, Badge, Empty, Flash, List, PageHeader, Row, Tabs } from '@/components/ui';
import { SubmitButton } from '@/components/client';
import { SearchBar } from '@/components/search';
import { Icons } from '@/components/brand';

export default async function Customers({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const { supabase } = await requireAdmin();
  const { t, locale } = await getT();
  const { data: all } = await supabase.from('customers').select('*').order('created_at', { ascending: false });
  const { data: bal } = await supabase.from('customer_balances').select('customer_id, outstanding, overdue');
  const balMap = new Map((bal ?? []).map((b) => [b.customer_id, b]));
  const counts = { pending: 0, approved: 0, suspended: 0 } as Record<string, number>;
  for (const c of all ?? []) counts[c.status]++;
  const tab = sp.tab ?? (counts.pending ? 'pending' : 'approved');
  const term = (sp.q ?? '').toLowerCase();
  const list = (all ?? []).filter((c) => (tab === 'all' || c.status === tab) &&
    (!term || [c.company_name, c.contact_name, c.phone, c.email].some((v) => v?.toLowerCase().includes(term))));
  const a = t.admin.customers;
  const tabs = [
    { key: 'pending', label: a.tabPending, count: counts.pending },
    { key: 'approved', label: a.tabApproved },
    { key: 'suspended', label: a.tabSuspended },
    { key: 'all', label: t.common.all },
  ].map((x) => ({ ...x, href: `/admin/customers?tab=${x.key}` }));

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title={a.title} />
      <Flash {...readFlash(t, sp)} />
      {tab === 'pending' && list.length > 0 ? (
        // 待审核：每个客户一张卡片，直接点“审核通过”
        <>
          <Tabs items={tabs} active={tab} />
          <ul className="grid gap-3 md:grid-cols-2">
            {list.map((c) => (
              <li key={c.id} className="rounded-[28px] bg-card p-5 shadow-card">
                <div className="flex items-center gap-3">
                  <Avatar name={c.company_name} size={48} tone="accent" />
                  <div className="min-w-0 flex-1">
                    <a href={`/admin/customers/${c.id}`} className="block truncate font-bold">{c.company_name}</a>
                    <div className="truncate text-sm text-muted">{c.contact_name} · {c.phone}</div>
                  </div>
                  <Badge tone="signal">{t.custStatus.pending}</Badge>
                </div>
                <div className="mt-3 space-y-1 rounded-2xl bg-fill p-3 text-sm">
                  <div className="truncate">{c.email}</div>
                  <div className="truncate text-muted">〒{c.postal_code} {c.address}</div>
                  <div className="text-xs text-muted num">{a.registered} {fmtDate(c.created_at, locale)}</div>
                </div>
                <form action={setCustomerStatus} className="mt-3">
                  <input type="hidden" name="customer_id" value={c.id} /><input type="hidden" name="status" value="approved" />
                  <input type="hidden" name="back" value="/admin/customers?tab=pending" />
                  <SubmitButton className="w-full">{Icons.check}{a.approve}</SubmitButton>
                </form>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <>
          <SearchBar placeholder={t.common.search} value={sp.q} hidden={{ tab }} label={t.common.search} />
          <Tabs items={tabs} active={tab} />
          {!list.length ? <Empty icon={Icons.users}>{t.common.noData}</Empty> : (
            <List>
              {list.map((c) => {
                const b = balMap.get(c.id);
                const overdue = Number(b?.overdue) > 0;
                return (
                  <Row key={c.id} href={`/admin/customers/${c.id}`}
                    lead={<Avatar name={c.company_name} />}
                    title={c.company_name}
                    sub={<><span>{c.contact_name}</span><span className="num">{c.phone}</span></>}
                    end={yen(b?.outstanding)}
                    endSub={overdue ? <Badge tone="danger">{t.account.overdue} {yen(b?.overdue)}</Badge>
                      : <Badge tone={c.status === 'approved' ? 'ok' : c.status === 'pending' ? 'signal' : 'neutral'}>{t.custStatus[c.status as 'pending']}</Badge>} />
                );
              })}
            </List>
          )}
        </>
      )}
    </div>
  );
}
