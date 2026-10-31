import Link from 'next/link';
import { requireAdmin, getT } from '@/lib/session';
import { readFlash } from '@/lib/flash';
import { fmt, fmtDate, fmtDateTime, productName } from '@/lib/i18n';
import { adjustLot } from '@/lib/actions/admin';
import { Badge, Empty, Flash, IconDot, List, PageHeader, Row, Tabs } from '@/components/ui';
import { SubmitButton } from '@/components/client';
import { Icons, ProductArt } from '@/components/brand';

export default async function Inventory({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const tab = sp.tab === 'moves' ? 'moves' : sp.expiring ? 'expiring' : 'lots';
  const { supabase } = await requireAdmin();
  const { t, locale } = await getT();
  const a = t.admin.inventory;
  const { data: s } = await supabase.from('settings').select('expiry_alert_days').eq('id', 1).single();
  const alertDays = s?.expiry_alert_days ?? 60;
  const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Tokyo' }).format(new Date());
  const alertUntil = new Date(Date.now() + alertDays * 86400000).toISOString().slice(0, 10);
  const days = (d: string) => Math.round((new Date(d).getTime() - new Date(today).getTime()) / 86400000);
  const tabs = [
    { key: 'lots', label: a.lots, href: '/admin/inventory' },
    { key: 'expiring', label: a.expiringOnly, href: '/admin/inventory?expiring=1' },
    { key: 'moves', label: a.movements, href: '/admin/inventory?tab=moves' },
  ];

  if (tab === 'moves') {
    const { data: moves } = await supabase.from('inventory_movements').select('*, products(sku, name_ja, name_zh, name_en), lots(lot_no)').order('created_at', { ascending: false }).limit(200);
    const kind: Record<string, string> = { inbound: a.kindInbound, outbound: a.kindOutbound, adjust: a.kindAdjust, return: a.kindReturn };
    return (
      <div className="mx-auto max-w-5xl">
        <PageHeader title={a.title} />
        <Tabs items={tabs} active={tab} />
        <List>
          {(moves ?? []).map((m) => (
            <Row key={m.id} href={m.order_id ? `/admin/orders/${m.order_id}` : undefined}
              lead={<IconDot tone={m.qty > 0 ? 'ok' : m.kind === 'adjust' ? 'warn' : 'accent'}>{m.kind === 'inbound' ? Icons.truck : m.kind === 'adjust' ? Icons.list : Icons.box}</IconDot>}
              title={productName(m.products, locale)}
              sub={<><span>{kind[m.kind]}</span><span className="num">{m.lots?.lot_no}</span><span className="num">{fmtDateTime(m.created_at, locale)}</span>{m.note && <span className="truncate">{m.note}</span>}</>}
              end={<span className={m.qty < 0 ? 'text-danger' : 'text-ok'}>{m.qty > 0 ? `+${m.qty}` : m.qty}</span>} />
          ))}
        </List>
      </div>
    );
  }

  let q = supabase.from('lots').select('*, products(sku, name_ja, name_zh, name_en, category, brand, image_url)').gt('qty_on_hand', 0).order('expiry_date', { nullsFirst: false }).limit(500);
  if (tab === 'expiring') q = q.not('expiry_date', 'is', null).lte('expiry_date', alertUntil);
  const { data: lots } = await q;
  const back = `/admin/inventory${tab === 'expiring' ? '?expiring=1' : ''}`;
  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title={a.title} actions={<Link href="/admin/inbound" className="inline-flex h-9 items-center gap-1.5 rounded-full bg-ink px-4 text-sm font-semibold text-white">{Icons.plus}{t.admin.inbound.title}</Link>} />
      <Flash {...readFlash(t, sp)} />
      <Tabs items={tabs} active={tab} />
      {!lots?.length ? <Empty icon={Icons.warehouse}>{t.common.noData}</Empty> : (
        <List>
          {lots.map((l) => {
            const d = l.expiry_date ? days(l.expiry_date) : null;
            return (
              <li key={l.id} className="px-4 py-3.5 sm:px-5">
                <details className="group">
                  <summary className="flex cursor-pointer list-none items-center gap-3.5">
                    <ProductArt sku={l.products.sku} name={productName(l.products, locale)} category={l.products.category} brand={l.products.brand} image={l.products.image_url} className="h-12 w-12 shrink-0 rounded-2xl" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-semibold">{productName(l.products, locale)}</div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.8rem] text-muted">
                        <span className="num">{l.lot_no}</span>
                        <span className="num">{fmtDate(l.expiry_date, locale)}</span>
                        {d != null && d <= alertDays && <Badge tone={d < 0 ? 'danger' : 'warn'}>{d < 0 ? a.expired : fmt(a.expiresIn, { n: d })}</Badge>}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold num">{l.qty_on_hand}</div>
                      <div className="text-[11px] font-semibold text-harbor">{a.adjust}</div>
                    </div>
                  </summary>
                  <form action={adjustLot} className="mt-3 flex flex-wrap items-center gap-2 rounded-2xl bg-fill p-3">
                    <input type="hidden" name="lot_id" value={l.id} />
                    <input type="hidden" name="back" value={back} />
                    <input name="qty" inputMode="numeric" defaultValue={l.qty_on_hand} aria-label={a.newQty} className="field h-11 w-20 bg-card! py-2! text-center font-bold num" />
                    <input name="reason" placeholder={t.common.reason} required aria-label={t.common.reason} className="field h-11 min-w-0 flex-1 bg-card! py-2!" />
                    <SubmitButton size="sm" className="h-11!">{t.common.update}</SubmitButton>
                  </form>
                </details>
              </li>
            );
          })}
        </List>
      )}
    </div>
  );
}
