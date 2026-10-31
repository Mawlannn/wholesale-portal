/* eslint-disable @typescript-eslint/no-explicit-any */
import { requireAdmin, getT } from '@/lib/session';
import { fmtDate, fmtDateTime, yen } from '@/lib/i18n';
import { Avatar, Badge, Empty, List, OrderStatus, PageHeader, Row, Tabs } from '@/components/ui';
import { SearchBar } from '@/components/search';

export default async function AdminOrders({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const tab = sp.tab ?? 'pending';
  const { supabase } = await requireAdmin();
  const { t, locale } = await getT();
  const cols = 'id, order_no, status, cancel_requested, total, created_at, delivery_date, courier_notified_at, customers!inner(company_name)';
  const term = (sp.q ?? '').trim().replace(/[%,()]/g, '');
  let list: any[] = [];
  if (term) {
    // 先按订单号搜索，找不到再按客户名称搜索
    const { data: byNo } = await supabase.from('orders').select(cols).ilike('order_no', `%${term}%`).order('created_at', { ascending: false }).limit(100);
    list = byNo ?? [];
    if (!list.length) {
      const { data: byCustomer } = await supabase.from('orders').select(cols).ilike('customers.company_name', `%${term}%`).order('created_at', { ascending: false }).limit(100);
      list = byCustomer ?? [];
    }
  } else {
    let q = supabase.from('orders').select(cols).order('created_at', { ascending: tab === 'pending' || tab === 'confirmed' || tab === 'cancel' }).limit(300);
    if (tab === 'pending') q = q.eq('status', 'pending');
    if (tab === 'confirmed') q = q.eq('status', 'confirmed');
    if (tab === 'cancel') q = q.eq('status', 'confirmed').eq('cancel_requested', true);
    if (tab === 'shipped') q = q.eq('status', 'shipped');
    if (tab === 'cancelled') q = q.eq('status', 'cancelled');
    list = (await q).data ?? [];
  }
  const { data: counts } = await supabase.rpc('admin_dashboard');
  const c = (counts ?? {}) as Record<string, number>;
  const a = t.admin.orders;
  const tabs = [
    { key: 'pending', label: a.tabPending, count: c.pending_orders },
    { key: 'cancel', label: a.tabCancelReq, count: c.cancel_requests },
    { key: 'confirmed', label: a.tabConfirmed, count: c.awaiting_shipment },
    { key: 'shipped', label: a.tabShipped },
    { key: 'cancelled', label: a.tabCancelled },
    { key: 'all', label: a.tabAll },
  ].map((x) => ({ ...x, href: `/admin/orders?tab=${x.key}` }));

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title={a.title} />
      <SearchBar placeholder={a.search} value={term} hidden={{ tab }} label={t.common.search} />
      {!term && <Tabs items={tabs} active={tab} />}
      {!list.length ? <Empty icon={undefined}>{t.common.noData}</Empty> : (
        <List>
          {list.map((o) => (
            <Row key={o.id} href={`/admin/orders/${o.id}`}
              lead={<Avatar name={o.customers.company_name} />}
              title={o.customers.company_name}
              sub={<>
                <span className="num">{o.order_no}</span>
                <span className="num">{fmtDateTime(o.created_at, locale)}</span>
                {o.delivery_date && <span className="num">→ {fmtDate(o.delivery_date, locale)}</span>}
              </>}
              end={yen(o.total)}
              endSub={<span className="flex flex-wrap justify-end gap-1">
                <OrderStatus t={t} status={o.status} cancelRequested={o.cancel_requested} />
                {o.status === 'confirmed' && !o.courier_notified_at && <Badge tone="warn">✉ {a.notNotified}</Badge>}
              </span>}
            />
          ))}
        </List>
      )}
    </div>
  );
}
