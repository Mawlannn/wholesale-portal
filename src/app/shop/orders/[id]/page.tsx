import { notFound } from 'next/navigation';
import Link from 'next/link';
import { requireCustomer, getT } from '@/lib/session';
import { readFlash } from '@/lib/flash';
import { fmtDate, yen } from '@/lib/i18n';
import { cancelMyOrder, reorder } from '@/lib/actions/shop';
import { Card, Flash, IconLink, Input, KV, LinkButton, OrderRail, OrderStatus, PayStatus, Progress, btn } from '@/components/ui';
import { SubmitButton } from '@/components/client';
import { OrderItemsTable } from '@/components/order-items';
import { Icons } from '@/components/brand';

export default async function OrderDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string>> }) {
  const { id } = await params;
  const sp = await searchParams;
  const { supabase, profile } = await requireCustomer();
  const { t, locale } = await getT();
  const { data: o } = await supabase.from('orders').select('*, order_items(*)').eq('id', id).maybeSingle();
  if (!o) notFound();
  const { data: rec } = profile.member_role === 'owner'
    ? await supabase.from('receivables').select('*').eq('order_id', id).maybeSingle()
    : { data: null };

  const hint = o.status === 'pending' ? t.orders.pendingHint
    : o.status === 'confirmed' ? (o.cancel_requested ? t.orders.cancelRequestedHint : t.orders.confirmedHint)
    : o.status === 'shipped' ? t.orders.shippedHint : null;
  const canCancel = o.status === 'pending' || (o.status === 'confirmed' && !o.cancel_requested);

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-4 flex items-center gap-3">
        <IconLink href="/shop/orders" label={t.orders.title}>{Icons.back}</IconLink>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-extrabold tracking-tight num">{o.order_no}</h1>
          <div className="mt-1 flex flex-wrap gap-1.5">
            <OrderStatus t={t} status={o.status} cancelRequested={o.cancel_requested} />
            {rec && <PayStatus t={t} status={rec.status} />}
          </div>
        </div>
      </header>
      <Flash {...readFlash(t, sp)} />

      <div className="grid gap-4 lg:grid-cols-[1fr_22rem] lg:gap-6">
        <div className="space-y-4">
          <Card>
            <OrderRail t={t} order={o} locale={locale} />
            {hint && <p className="mt-4 rounded-2xl bg-fill px-4 py-3 text-sm text-muted">{hint}</p>}
          </Card>

          <div className="grid grid-cols-2 gap-2 sm:flex">
            {o.status === 'pending' && <LinkButton href={`/shop/orders/${o.id}/edit`} variant="secondary" className="bg-card! shadow-card">{t.orders.edit}</LinkButton>}
            <form action={reorder} className="contents">
              <input type="hidden" name="order_id" value={o.id} />
              <SubmitButton variant="secondary" className="bg-card! shadow-card">{Icons.repeat}{t.orders.reorder}</SubmitButton>
            </form>
            {o.status === 'shipped' && <Link href={`/print/delivery/${o.id}`} target="_blank" className={`${btn('secondary')} bg-card! shadow-card`}>{Icons.file}{t.orders.printDelivery}</Link>}
          </div>

          <Card title={t.orders.items} pad={false}>
            <OrderItemsTable t={t} locale={locale} order={o} items={o.order_items} />
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <KV items={[
              [t.orders.shipTo, <span key="a">{o.ship_label}{o.ship_recipient && ` / ${o.ship_recipient}`}<br /><span className="font-medium text-muted">〒{o.ship_postal_code} {o.ship_address}</span></span>],
              [t.orders.deliveryDate, o.delivery_date ? fmtDate(o.delivery_date, locale) : '—'],
              ...(o.tracking_no ? [[t.orders.tracking, <span key="tr" className="num">{o.tracking_no}</span>] as [string, React.ReactNode]] : []),
              ...(o.note ? [[t.common.note, <span key="n" className="whitespace-pre-wrap font-medium">{o.note}</span>] as [string, React.ReactNode]] : []),
            ]} />
          </Card>

          {rec && (
            <Card title={t.orders.paymentStatus}>
              <div className="flex items-baseline justify-between num">
                <span className="text-2xl font-extrabold">{yen(rec.paid_amount)}</span>
                <span className="text-sm text-muted">/ {yen(rec.amount)}</span>
              </div>
              <div className="mt-3"><Progress value={Number(rec.paid_amount)} max={Number(rec.amount)} tone={rec.status === 'paid' ? 'dark' : 'accent'} /></div>
              <p className="mt-3 text-sm text-muted num">{t.account.dueDate} {fmtDate(rec.due_date, locale)}</p>
            </Card>
          )}

          {canCancel && (
            <Card title={o.status === 'pending' ? t.orders.cancelOrder : t.orders.requestCancel}>
              <form action={cancelMyOrder} className="space-y-3">
                <input type="hidden" name="order_id" value={o.id} />
                <Input name="reason" placeholder={t.orders.cancelReason} />
                <SubmitButton variant="danger" className="w-full" confirm={t.common.confirmAction}>
                  {o.status === 'pending' ? t.orders.cancelOrder : t.orders.requestCancel}
                </SubmitButton>
              </form>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
