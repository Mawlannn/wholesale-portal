import { requireCustomer, getT } from '@/lib/session';
import { readFlash } from '@/lib/flash';
import { fmtDateTime, yen } from '@/lib/i18n';
import { Icons } from '@/components/brand';
import { Empty, Flash, IconDot, LinkButton, List, OrderStatus, PageHeader, PayStatus, Row, Tabs } from '@/components/ui';

export default async function MyOrders({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const tab = sp.tab ?? 'all';
  const { supabase, customer, profile } = await requireCustomer();
  const { t, locale } = await getT();
  let q = supabase.from('orders')
    .select('id, order_no, status, cancel_requested, total, created_at, delivery_date, ship_label')
    .eq('customer_id', customer.id).order('created_at', { ascending: false }).limit(200);
  if (tab === 'open') q = q.in('status', ['pending', 'confirmed']);
  if (tab === 'shipped') q = q.eq('status', 'shipped');
  const { data: orders } = await q;
  const owner = profile.member_role === 'owner';
  const { data: recs } = owner
    ? await supabase.from('receivables').select('order_id, status').eq('customer_id', customer.id)
    : { data: [] as { order_id: string; status: string }[] };
  const payByOrder = new Map((recs ?? []).map((r) => [r.order_id, r.status]));
  const tone = (s: string) => (s === 'shipped' ? 'ok' : s === 'cancelled' ? 'fill' : s === 'pending' ? 'warn' : 'accent') as 'ok' | 'fill' | 'warn' | 'accent';
  const icon = (s: string) => (s === 'shipped' ? Icons.truck : s === 'pending' ? Icons.clock : s === 'cancelled' ? Icons.box : Icons.check);

  return (
    <>
      <PageHeader title={t.orders.title} />
      <Flash {...readFlash(t, sp)} />
      <Tabs active={tab} items={[
        { key: 'all', label: t.common.all, href: '/shop/orders' },
        { key: 'open', label: `${t.status.pending} / ${t.status.confirmed}`, href: '/shop/orders?tab=open' },
        { key: 'shipped', label: t.status.shipped, href: '/shop/orders?tab=shipped' },
      ]} />
      {!orders?.length ? (
        <Empty icon={Icons.list} action={<LinkButton href="/shop">{t.cart.browse}</LinkButton>}>{t.orders.empty}</Empty>
      ) : (
        <List>
          {orders.map((o) => (
            <Row key={o.id} href={`/shop/orders/${o.id}`}
              lead={<IconDot tone={tone(o.status)}>{icon(o.status)}</IconDot>}
              title={<span className="num">{o.order_no}</span>}
              sub={<><span className="num">{fmtDateTime(o.created_at, locale)}</span>{o.ship_label && <span className="truncate">{o.ship_label}</span>}</>}
              end={yen(o.total)}
              endSub={
                <span className="flex flex-wrap justify-end gap-1">
                  <OrderStatus t={t} status={o.status} cancelRequested={o.cancel_requested} />
                  {payByOrder.get(o.id) && <PayStatus t={t} status={payByOrder.get(o.id)!} />}
                </span>
              }
            />
          ))}
        </List>
      )}
    </>
  );
}
