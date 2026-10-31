import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAdmin, getT } from '@/lib/session';
import { readFlash } from '@/lib/flash';
import { siteUrl } from '@/lib/site';
import { fmt, fmtDate, fmtDateTime, yen } from '@/lib/i18n';
import { adminCancel, confirmOrder, markShipped, rejectCancel, saveOrderNote } from '@/lib/actions/admin';
import { composeCourierOrder, composeCustomer } from '@/lib/mail';
import { MailCompose } from '@/components/mail-compose';
import { Avatar, Badge, Card, Field, Flash, IconLink, Input, KV, OrderRail, OrderStatus, PayStatus, Progress, Textarea, btn } from '@/components/ui';
import { SubmitButton } from '@/components/client';
import { OrderItemsTable } from '@/components/order-items';
import { Icons } from '@/components/brand';

export default async function AdminOrder({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string>> }) {
  const { id } = await params;
  const sp = await searchParams;
  const { supabase } = await requireAdmin();
  const { t, locale } = await getT();
  const { data: o } = await supabase.from('orders').select('*, order_items(*), customers(id, company_name, contact_name, phone, email)').eq('id', id).maybeSingle();
  if (!o) notFound();
  const [{ data: rec }, { data: mails }, { data: allocs }, { data: settings }] = await Promise.all([
    supabase.from('receivables').select('*').eq('order_id', id).maybeSingle(),
    supabase.from('email_log').select('*').eq('order_id', id).order('created_at', { ascending: false }),
    supabase.from('order_allocations').select('qty, order_item_id, lots(lot_no, expiry_date)').in('order_item_id', o.order_items.map((i: { id: string }) => i.id)),
    supabase.from('settings').select('courier_email').eq('id', 1).single(),
  ]);
  const site = siteUrl();
  const courierLink = o.courier_token ? `${site}/courier/${o.courier_token}` : null;
  const lastCourierMail = (mails ?? []).find((m) => m.kind === 'courier_order');
  const customerKind = o.status === 'shipped' ? 'shipped' : 'confirmed';
  const lastCustomerMail = (mails ?? []).find((m) => m.kind === `customer_${customerKind}`);
  const showMail = o.status === 'confirmed' || o.status === 'shipped';
  const [courierDraft, customerDraft] = showMail
    ? await Promise.all([o.status === 'confirmed' ? composeCourierOrder(id) : null, composeCustomer(id, customerKind)])
    : [null, null];
  const c = o.customers as { id: string; company_name: string; contact_name: string | null; phone: string | null; email: string | null };
  const skuOf = new Map(o.order_items.map((i: { id: string; sku: string }) => [i.id, i.sku]));
  const a = t.admin.orders;

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-4 flex items-center gap-3">
        <IconLink href="/admin/orders" label={a.title}>{Icons.back}</IconLink>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-extrabold tracking-tight num">{o.order_no}</h1>
          <div className="mt-1 flex flex-wrap gap-1.5">
            <OrderStatus t={t} status={o.status} cancelRequested={o.cancel_requested} />
            {rec && <PayStatus t={t} status={rec.status} />}
          </div>
        </div>
      </header>
      <Flash {...readFlash(t, sp)} />

      <div className="grid gap-4 xl:grid-cols-[1fr_24rem] xl:gap-6">
        {/* 右栏在手机上排在最前：先处理，再看明细 */}
        <div className="space-y-4 xl:order-2">
          {o.status === 'confirmed' && o.cancel_requested && (
            <Card title={t.status.cancelRequested} className="ring-2 ring-warn">
              {o.cancel_reason && <p className="mb-3 rounded-2xl bg-warn-soft px-4 py-3 text-sm font-semibold text-warn">{o.cancel_reason}</p>}
              <div className="grid grid-cols-2 gap-2">
                <form action={adminCancel}><input type="hidden" name="order_id" value={o.id} />
                  <SubmitButton variant="danger" className="w-full" confirm={t.common.confirmAction}>{a.approveCancel}</SubmitButton></form>
                <form action={rejectCancel}><input type="hidden" name="order_id" value={o.id} />
                  <SubmitButton variant="secondary" className="w-full">{a.rejectCancel}</SubmitButton></form>
              </div>
            </Card>
          )}

          {o.status === 'pending' && (
            <section className="relative overflow-hidden rounded-[28px] bg-ink p-5 text-white">
              <div aria-hidden="true" className="pointer-events-none absolute -right-14 -top-14 h-44 w-44 rounded-full bg-harbor opacity-60 blur-3xl" />
              <div className="relative text-sm text-white/70">{t.common.grandTotal}</div>
              <div className="relative mt-1 text-[2rem] font-extrabold leading-none num">{yen(o.total)}</div>
              <p className="relative mt-3 text-sm text-white/70">{a.afterConfirm}</p>
              {!settings?.courier_email && <Link href="/admin/settings" className="relative mt-2 block text-sm font-semibold text-[#ffc46b] underline">{a.noCourierEmail}</Link>}
              <form action={confirmOrder} className="relative mt-5"><input type="hidden" name="order_id" value={o.id} />
                <SubmitButton size="lg" className="w-full bg-white! text-ink!">{Icons.check}{a.confirm}</SubmitButton></form>
            </section>
          )}

          {showMail && customerDraft && (
            <Card title={a.mailTitle}>
              <p className="-mt-1 mb-3 text-sm text-muted">{a.mailHint}</p>
              <div className="space-y-2.5">
                <MailCompose t={t} locale={locale} orderId={o.id} target="customer" kind={customerKind} draft={customerDraft} last={lastCustomerMail}
                  icon={Icons.shop} title={a.toCustomer} sendLabel={a.sendCustomer} />
                {courierDraft && (
                  <MailCompose t={t} locale={locale} orderId={o.id} target="courier" draft={courierDraft} last={lastCourierMail}
                    icon={Icons.truck} title={a.toCourier} sendLabel={a.sendCourier} />
                )}
              </div>
            </Card>
          )}

          {o.status === 'confirmed' && (
            <Card title={a.courierLink}>
              {courierLink && <input readOnly value={courierLink} aria-label={a.courierLink} className="field mb-3 text-xs" />}
              <p className="mb-2 text-xs text-muted">{a.shipHint}</p>
              <form action={markShipped} className="space-y-2">
                <input type="hidden" name="order_id" value={o.id} />
                <Input name="tracking" placeholder={a.trackingNo} />
                <SubmitButton className="w-full" confirm={t.common.confirmAction}>{Icons.truck}{a.markShipped}</SubmitButton>
              </form>
            </Card>
          )}

          <Card>
            <Link href={`/admin/customers/${c.id}`} className="mb-4 flex items-center gap-3">
              <Avatar name={c.company_name} size={48} />
              <div className="min-w-0 flex-1">
                <div className="truncate font-bold">{c.company_name}</div>
                <div className="truncate text-sm text-muted">{c.contact_name} · {c.phone}</div>
              </div>
              <span className="text-faint">{Icons.chevron}</span>
            </Link>
            <KV items={[
              [t.orders.shipTo, <span key="s">{o.ship_label}{o.ship_recipient && ` / ${o.ship_recipient}`}<br /><span className="font-medium text-muted">〒{o.ship_postal_code} {o.ship_address}</span></span>],
              [t.orders.deliveryDate, fmtDate(o.delivery_date, locale)],
              ...(o.note ? [[t.common.note, <span key="n" className="whitespace-pre-wrap font-medium">{o.note}</span>] as [string, React.ReactNode]] : []),
              ...(o.tracking_no ? [[t.orders.tracking, <span key="t" className="num">{o.tracking_no}</span>] as [string, React.ReactNode]] : []),
            ]} />
          </Card>

          {rec && (
            <Card title={t.orders.paymentStatus}>
              <div className="flex items-baseline justify-between num">
                <span className="text-2xl font-extrabold">{yen(rec.paid_amount)}</span><span className="text-sm text-muted">/ {yen(rec.amount)}</span>
              </div>
              <div className="mt-3"><Progress value={Number(rec.paid_amount)} max={Number(rec.amount)} /></div>
              <p className="mt-3 text-sm text-muted num">{t.account.dueDate} {fmtDate(rec.due_date, locale)}</p>
              {o.status === 'shipped' && <Link href={`/print/delivery/${o.id}`} target="_blank" className={`${btn('secondary', 'sm')} mt-4`}>{Icons.file}{t.orders.printDelivery}</Link>}
            </Card>
          )}
        </div>

        <div className="space-y-4 xl:order-1">
          <Card><OrderRail t={t} order={o} locale={locale} /></Card>

          <Card title={t.orders.items} pad={false}>
            <OrderItemsTable t={t} locale={locale} order={o} items={o.order_items} />
          </Card>

          {!!allocs?.length && (
            <Card title={a.lots} pad={false}>
              <ul className="divide-y divide-[#f0f1f4]">
                {allocs.map((al, i) => {
                  const l = al.lots as unknown as { lot_no: string; expiry_date: string | null };
                  return (
                    <li key={i} className="flex items-center gap-3 px-5 py-3 text-sm">
                      <span className="font-semibold num">{String(skuOf.get(al.order_item_id) ?? '')}</span>
                      <Link href={`/admin/recall?lot=${encodeURIComponent(l.lot_no)}`} className="font-semibold text-harbor num">{l.lot_no}</Link>
                      <span className="flex-1 text-muted num">{fmtDate(l.expiry_date, locale)}</span>
                      <span className="font-bold num">{fmt(t.common.casesN, { n: al.qty })}</span>
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}

          <Card title={a.emails} pad={false}>
            {!mails?.length ? <p className="px-5 pb-4 text-sm text-muted">{t.common.noData}</p> : (
              <ul className="divide-y divide-[#f0f1f4]">
                {mails.map((m) => (
                  <li key={m.id} className="px-5 py-3">
                    <details>
                      <summary className="flex cursor-pointer list-none items-center gap-3">
                        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${m.status === 'sent' ? 'bg-ok-soft text-ok' : m.status === 'failed' ? 'bg-danger-soft text-danger' : 'bg-fill text-muted'}`}>{Icons.mail}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold">{m.subject}</span>
                          <span className="block truncate text-xs text-muted">{m.to_addr} · {fmtDateTime(m.created_at, locale)}</span>
                        </span>
                        <Badge tone={m.status === 'sent' ? 'ok' : m.status === 'failed' ? 'danger' : 'neutral'}>{t.admin.emails[m.status as 'sent']}</Badge>
                      </summary>
                      <pre className="mt-3 overflow-x-auto whitespace-pre-wrap rounded-2xl bg-fill p-3 font-sans text-xs">{m.body}</pre>
                      {m.error && <p className="mt-1 text-xs text-danger">{m.error}</p>}
                    </details>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title={a.adminNote}>
            <form action={saveOrderNote} className="space-y-2">
              <input type="hidden" name="order_id" value={o.id} />
              <Textarea name="admin_note" defaultValue={o.admin_note ?? ''} />
              <SubmitButton variant="secondary" size="sm">{t.common.save}</SubmitButton>
            </form>
          </Card>

          {(o.status === 'pending' || (o.status === 'confirmed' && !o.cancel_requested)) && (
            <Card title={a.cancel}>
              <form action={adminCancel} className="space-y-3">
                <input type="hidden" name="order_id" value={o.id} />
                <Field label={t.common.reason}><Input name="reason" /></Field>
                <SubmitButton variant="danger" className="w-full" confirm={t.common.confirmAction}>{a.cancel}</SubmitButton>
              </form>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
