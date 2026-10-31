import Link from 'next/link';
import { requireAdmin, getT } from '@/lib/session';
import { setLanguage } from '@/lib/actions/common';
import { fmt, fmtDate, fmtDateTime, fmtMonth, productName, yen } from '@/lib/i18n';
import { Avatar, Badge, Bars, Card, IconDot, List, Row, Stat } from '@/components/ui';
import { LangSwitcher } from '@/components/client';
import { Icons, ProductArt, langLabels } from '@/components/brand';

export default async function Dashboard() {
  const { supabase, user } = await requireAdmin();
  const { t, locale } = await getT();
  const { data: s } = await supabase.from('settings').select('expiry_alert_days, courier_email, company_name').eq('id', 1).single();
  const alertUntil = new Date(Date.now() + (s?.expiry_alert_days ?? 60) * 86400000).toISOString().slice(0, 10);
  const [{ data: d }, { data: pending }, { data: cancelReqs }, { data: stock }, { data: lots }, { data: stockView }, { data: recs }] = await Promise.all([
    supabase.rpc('admin_dashboard'),
    supabase.from('orders').select('id, order_no, total, created_at, customers(company_name)').eq('status', 'pending').order('created_at').limit(8),
    supabase.from('orders').select('id, order_no, cancel_reason, total, customers(company_name)').eq('status', 'confirmed').eq('cancel_requested', true),
    supabase.from('products').select('id, sku, name_ja, name_zh, name_en, category, brand, image_url, low_stock_threshold').eq('is_active', true),
    supabase.from('lots').select('id, lot_no, expiry_date, qty_on_hand, products(sku, name_ja, name_zh, name_en, category, brand, image_url)')
      .gt('qty_on_hand', 0).not('expiry_date', 'is', null).lte('expiry_date', alertUntil).order('expiry_date').limit(6),
    supabase.from('product_stock').select('product_id, available'),
    supabase.from('receivables').select('billing_month, amount'),
  ]);
  const dash = (d ?? {}) as Record<string, number>;
  type P = { id: string; sku: string; name_ja: string; name_zh: string | null; name_en: string | null; category: string | null; brand: string | null; image_url: string | null; low_stock_threshold: number };
  const availMap = new Map((stockView ?? []).map((r: { product_id: string; available: number }) => [r.product_id, r.available]));
  const low = ((stock ?? []) as P[]).filter((p) => (availMap.get(p.id) ?? 0) <= p.low_stock_threshold).slice(0, 6);
  const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Tokyo' }).format(new Date());
  const setupMissing = !s?.courier_email || !s?.company_name;

  // 近 6 个月发货额
  const months: string[] = [];
  const [yy, mm] = today.split('-').map(Number);
  for (let i = 5; i >= 0; i--) {
    const m = new Date(Date.UTC(yy, mm - 1 - i, 1));
    months.push(`${m.getUTCFullYear()}-${String(m.getUTCMonth() + 1).padStart(2, '0')}`);
  }
  const byMonth = new Map<string, number>();
  for (const r of recs ?? []) byMonth.set(r.billing_month, (byMonth.get(r.billing_month) ?? 0) + Number(r.amount));
  const trend = months.map((m) => ({ label: fmtMonth(m, locale).replace(/^\d{4}年/, '').replace(/ \d{4}$/, ''), value: byMonth.get(m) ?? 0, highlight: m === today.slice(0, 7) }));
  const lastMonth = byMonth.get(months[4]) ?? 0;
  const thisMonth = byMonth.get(months[5]) ?? 0;
  const delta = lastMonth ? Math.round(((thisMonth - lastMonth) / lastMonth) * 100) : null;
  const company = (o: { customers: unknown }) => (o.customers as { company_name: string } | null)?.company_name ?? '';
  const emptyBox = (text: string) => <div className="rounded-[28px] bg-card p-6 text-center text-sm text-muted shadow-card">{text}</div>;

  return (
    <div className="mx-auto max-w-7xl">
      <header className="mb-5 flex items-center gap-3">
        <Avatar name={user?.email ?? 'A'} size={48} tone="dark" />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[1.35rem] font-extrabold tracking-tight">{t.admin.dash.greeting}</h1>
          <div className="truncate text-sm text-muted">
            {new Intl.DateTimeFormat(locale === 'zh' ? 'zh-CN' : locale === 'en' ? 'en-US' : 'ja-JP', { timeZone: 'Asia/Tokyo', dateStyle: 'full' }).format(new Date())}
          </div>
        </div>
        <div><LangSwitcher action={setLanguage} current={locale} labels={langLabels(t)} title={t.lang.label} variant="icon" /></div>
      </header>

      {setupMissing && (
        <Link href="/admin/settings" className="mb-4 flex items-center gap-3 rounded-[22px] bg-signal-soft p-4 text-sm font-semibold text-[#7a5900]">
          {Icons.alert}<span className="flex-1">{t.admin.orders.noCourierEmail}</span>{Icons.chevron}
        </Link>
      )}

      <div className="grid gap-4 lg:grid-cols-12">
        {/* 待确认订单：最大的一块 */}
        <Link href="/admin/orders" className="relative overflow-hidden rounded-[28px] bg-ink p-6 text-white transition-transform active:scale-[.99] lg:col-span-4">
          <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-harbor opacity-60 blur-3xl" />
          <div className="relative flex items-center justify-between">
            <span className="text-sm font-semibold text-white/70">{t.admin.dash.pendingOrders}</span>
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10">{Icons.list}</span>
          </div>
          <div className="relative mt-4 text-[4.2rem] font-extrabold leading-none tracking-tight num">{dash.pending_orders ?? 0}</div>
          <div className="relative mt-5 flex flex-wrap gap-2 text-xs font-semibold">
            <span className="rounded-full bg-white/10 px-3 py-1.5">{t.admin.dash.awaitingShipment} {dash.awaiting_shipment ?? 0}</span>
            {!!dash.cancel_requests && <span className="rounded-full bg-warn px-3 py-1.5">{t.admin.dash.cancelRequests} {dash.cancel_requests}</span>}
          </div>
          <span className="relative mt-5 inline-flex h-10 items-center gap-2 rounded-full bg-white px-4 text-sm font-bold text-ink">{t.common.viewAll}{Icons.arrow}</span>
        </Link>

        {/* 发货额趋势 */}
        <Card className="lg:col-span-8" title={t.admin.dash.salesTrend}
          actions={delta != null && <Badge tone={delta >= 0 ? 'ok' : 'danger'}>{delta >= 0 ? '▲' : '▼'} {Math.abs(delta)}%</Badge>}>
          <div className="mb-4 flex flex-wrap items-baseline gap-x-2">
            <span className="text-[2rem] font-extrabold leading-none tracking-tight num">{yen(thisMonth)}</span>
            <span className="text-sm text-muted">{t.admin.dash.monthSales}</span>
          </div>
          <Bars data={trend} height={150} />
        </Card>

        <div className="grid grid-cols-2 gap-4 lg:col-span-12 lg:grid-cols-4">
          <Stat label={t.admin.dash.outstanding} value={yen(dash.outstanding)} icon={Icons.yen} href="/admin/receivables" />
          <Stat label={t.admin.dash.overdue} value={yen(dash.overdue)} tone={dash.overdue ? 'danger' : 'white'} icon={Icons.alert} href="/admin/receivables" />
          <Stat label={t.admin.dash.pendingCustomers} value={dash.pending_customers ?? 0} icon={Icons.users} href="/admin/customers?tab=pending" />
          <Stat label={t.admin.dash.expiringLots} value={dash.expiring_lots ?? 0} tone={dash.expiring_lots ? 'warn' : 'white'} icon={Icons.calendar} href="/admin/inventory?expiring=1" />
        </div>

        {/* 待处理 */}
        <section className="lg:col-span-7">
          <div className="mb-3 flex items-center justify-between px-1">
            <h2 className="text-[1.15rem] font-bold tracking-tight">{t.admin.dash.todo}</h2>
            <Link href="/admin/orders" className="text-sm font-semibold text-muted hover:text-ink">{t.common.viewAll}</Link>
          </div>
          {!pending?.length && !cancelReqs?.length ? emptyBox(t.admin.dash.nothing) : (
            <List>
              {(cancelReqs ?? []).map((o) => (
                <Row key={o.id} href={`/admin/orders/${o.id}`} lead={<IconDot tone="warn">{Icons.alert}</IconDot>}
                  title={company(o)} sub={<><span className="num">{o.order_no}</span>{o.cancel_reason && <span className="truncate">{o.cancel_reason}</span>}</>}
                  end={yen(o.total)} endSub={<Badge tone="warn">{t.status.cancelRequested}</Badge>} />
              ))}
              {(pending ?? []).map((o) => (
                <Row key={o.id} href={`/admin/orders/${o.id}`} lead={<IconDot tone="accent">{Icons.clock}</IconDot>}
                  title={company(o)} sub={<><span className="num">{o.order_no}</span><span className="num">{fmtDateTime(o.created_at, locale)}</span></>}
                  end={yen(o.total)} endSub={<Badge tone="signal">{t.status.pending}</Badge>} />
              ))}
            </List>
          )}
        </section>

        {/* 库存提醒 */}
        <section className="space-y-4 lg:col-span-5">
          <div>
            <h2 className="mb-3 px-1 text-[1.15rem] font-bold tracking-tight">{t.admin.dash.lowStock}</h2>
            {!low.length ? emptyBox(t.admin.dash.nothing) : (
              <List>
                {low.map((p) => {
                  const a = availMap.get(p.id) ?? 0;
                  return (
                    <Row key={p.id} href={`/admin/products/${p.id}`}
                      lead={<ProductArt sku={p.sku} name={productName(p, locale)} category={p.category} brand={p.brand} image={p.image_url} className="h-11 w-11 rounded-2xl" />}
                      title={productName(p, locale)} sub={<span className="num">{p.sku}</span>}
                      endSub={<Badge tone={a <= 0 ? 'danger' : 'warn'}>{fmt(t.common.casesN, { n: a })}</Badge>} />
                  );
                })}
              </List>
            )}
          </div>
          <div>
            <h2 className="mb-3 px-1 text-[1.15rem] font-bold tracking-tight">{t.admin.dash.expiringLots}</h2>
            {!lots?.length ? emptyBox(t.admin.dash.nothing) : (
              <List>
                {lots.map((l) => {
                  const p = l.products as unknown as P;
                  const days = Math.round((new Date(l.expiry_date).getTime() - new Date(today).getTime()) / 86400000);
                  return (
                    <Row key={l.id} href="/admin/inventory?expiring=1"
                      lead={<ProductArt sku={p.sku} name={productName(p, locale)} category={p.category} brand={p.brand} image={p.image_url} className="h-11 w-11 rounded-2xl" />}
                      title={productName(p, locale)} sub={<span className="num">{l.lot_no} · {fmtDate(l.expiry_date, locale)}</span>}
                      end={fmt(t.common.casesN, { n: l.qty_on_hand })}
                      endSub={<Badge tone={days < 0 ? 'danger' : 'warn'}>{days < 0 ? t.admin.inventory.expired : fmt(t.admin.inventory.expiresIn, { n: days })}</Badge>} />
                  );
                })}
              </List>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
