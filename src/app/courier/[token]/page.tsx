import { createClient } from '@/lib/supabase/server';
import { getT } from '@/lib/session';
import { readFlash } from '@/lib/flash';
import { fmtDate, fmtDateTime } from '@/lib/i18n';
import { courierConfirm } from '@/lib/actions/courier';
import { setLanguage } from '@/lib/actions/common';
import { Card, Field, Flash, Input, KV, List, Row } from '@/components/ui';
import { LangSwitcher, SubmitButton } from '@/components/client';
import { Crate, Icons, ProductArt, langLabels } from '@/components/brand';

type CourierOrder = {
  order_no: string; status: string; cancel_requested: boolean; ship_label: string | null; ship_recipient: string | null;
  ship_phone: string | null; ship_postal_code: string | null; ship_address: string; delivery_date: string | null; note: string | null;
  tracking_no: string | null; shipped_at: string | null; company_name: string;
  items: { sku: string; name: string; qty: number; unit_per_case: number }[];
};

export const metadata = { robots: { index: false, follow: false } };

export default async function CourierPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<Record<string, string>> }) {
  const { token } = await params;
  const sp = await searchParams;
  const { t, locale } = await getT();
  const valid = /^[0-9a-f-]{36}$/i.test(token);
  const supabase = await createClient();
  const { data } = valid ? await supabase.rpc('courier_get_order', { p_token: token }) : { data: null };
  const o = data as CourierOrder | null;

  return (
    <div className="mx-auto max-w-xl px-4 pb-12 pt-[calc(16px+env(safe-area-inset-top,0px))]">
      <header className="mb-6 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5"><Crate size={40} /><span className="truncate font-extrabold">{o?.company_name || t.app.name}</span></div>
        <LangSwitcher action={setLanguage} current={locale} labels={langLabels(t)} title={t.lang.label} />
      </header>
      <h1 className="text-[1.75rem] font-extrabold leading-tight tracking-tight">{t.courier.title}</h1>
      {o && <div className="mb-4 mt-2"><span className="tag text-base">{o.order_no}</span></div>}
      <Flash {...readFlash(t, sp)} />
      {!o ? (
        <Card><p className="font-semibold text-danger">{t.courier.invalid}</p></Card>
      ) : (
        <div className="space-y-4">
          {o.status === 'cancelled' && <p className="rounded-2xl bg-danger-soft p-4 font-bold text-danger">{t.courier.cancelled}</p>}
          {o.status === 'pending' && <p className="rounded-2xl bg-signal-soft p-4 font-semibold">{t.courier.notReady}</p>}
          {o.cancel_requested && o.status === 'confirmed' && <p className="rounded-2xl bg-warn-soft p-4 font-semibold text-warn">{t.courier.cancelReq}</p>}
          {o.status === 'confirmed' && <p className="text-muted">{t.courier.intro}</p>}

          <List>
            {o.items.map((i) => (
              <Row key={i.sku}
                lead={<ProductArt sku={i.sku} name={i.name} className="h-14 w-14 rounded-2xl" />}
                title={i.name}
                sub={<span className="num">{i.sku} · {i.unit_per_case} / {t.common.cases}</span>}
                end={<span className="text-xl">{i.qty} <span className="text-sm font-semibold text-muted">{t.common.cases}</span></span>} />
            ))}
          </List>

          <Card title={t.courier.shipTo}>
            <p className="text-[1.05rem] font-semibold leading-7">
              {o.ship_label}{o.ship_recipient && ` / ${o.ship_recipient}`}<br />
              <span className="font-medium text-muted">〒{o.ship_postal_code} {o.ship_address}</span><br />
              <span className="num">{o.ship_phone}</span>
            </p>
            <div className="mt-4"><KV items={[
              [t.orders.deliveryDate, o.delivery_date ? fmtDate(o.delivery_date, locale) : '—'],
              ...(o.note ? [[t.common.note, o.note] as [string, string]] : []),
            ]} /></div>
          </Card>

          {o.status === 'shipped' ? (
            <p className="flex items-center gap-3 rounded-2xl bg-ok-soft p-4 font-semibold text-ok">
              {Icons.check}<span>{t.courier.already} <span className="num">{fmtDateTime(o.shipped_at, locale)} {o.tracking_no && `(${o.tracking_no})`}</span></span>
            </p>
          ) : o.status === 'confirmed' ? (
            <form action={courierConfirm} className="space-y-4 rounded-[28px] bg-card p-5 shadow-card">
              <input type="hidden" name="token" value={token} />
              <Field label={t.courier.tracking}><Input name="tracking" inputMode="text" autoComplete="off" /></Field>
              <SubmitButton size="lg" className="w-full" confirm={t.common.confirmAction}>{Icons.truck}{t.courier.confirm}</SubmitButton>
            </form>
          ) : null}
        </div>
      )}
    </div>
  );
}
