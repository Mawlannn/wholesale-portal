import Link from 'next/link';
import { requireCustomer, getT } from '@/lib/session';
import { readFlash } from '@/lib/flash';
import { fmt, productName, yen } from '@/lib/i18n';
import { placeOrder, setCartQty } from '@/lib/actions/shop';
import { Badge, Empty, Field, Flash, LinkButton, PageHeader, Select, Textarea, Input } from '@/components/ui';
import { QtyInput, SubmitButton } from '@/components/client';
import { calcTotals } from '@/lib/totals';
import { Icons, ProductArt } from '@/components/brand';

type Cat = { id: string; sku: string; name_ja: string; name_zh: string | null; name_en: string | null; category: string | null; brand: string | null; image_url: string | null; price: number; tax_rate: number; available: number; min_order_qty: number; unit_per_case: number };

export default async function CartPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const { supabase, customer } = await requireCustomer();
  const { t, locale } = await getT();
  const [{ data: cart }, { data: catalog }, { data: addresses }, { data: pos }] = await Promise.all([
    supabase.from('cart_items').select('product_id, qty_cases').eq('customer_id', customer.id).order('updated_at'),
    supabase.rpc('get_catalog'),
    supabase.from('customer_addresses').select('*').eq('customer_id', customer.id).order('is_default', { ascending: false }),
    supabase.rpc('customer_position', { p_customer_id: customer.id }).single<{ exposure: number }>(),
  ]);
  const byId = new Map(((catalog ?? []) as Cat[]).map((c) => [c.id, c]));
  const lines = (cart ?? [])
    .map((c) => ({ ...c, p: byId.get(c.product_id) }))
    .filter((l): l is typeof l & { p: Cat } => !!l.p);
  const totals = calcTotals(lines.map((l) => ({ amount: Number(l.p.price) * l.qty_cases, rate: l.p.tax_rate })));
  const left = customer.credit_limit != null ? Number(customer.credit_limit) - Number(pos?.exposure ?? 0) : null;
  const overLimit = left != null && totals.total > left;
  const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Tokyo' }).format(new Date());
  const count = lines.reduce((s, l) => s + l.qty_cases, 0);

  return (
    <>
      <PageHeader title={t.cart.title} sub={lines.length ? fmt(t.common.casesN, { n: count }) : undefined} />
      <Flash {...readFlash(t, sp)} />
      {lines.length === 0 ? (
        <Empty icon={Icons.cart} action={<LinkButton href="/shop">{t.cart.browse}</LinkButton>}>{t.cart.empty}</Empty>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1fr_24rem] lg:gap-6">
          <ul className="space-y-3">
            {lines.map((l) => {
              const short = l.qty_cases > l.p.available;
              return (
                <li key={l.product_id} className="flex gap-3.5 rounded-[26px] bg-card p-3 shadow-card">
                  <Link href={`/shop/p/${l.product_id}`} className="shrink-0">
                    <ProductArt sku={l.p.sku} name={productName(l.p, locale)} category={l.p.category} brand={l.p.brand} image={l.p.image_url}
                      className="h-[92px] w-[92px] rounded-[20px]" />
                  </Link>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <div className="flex items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="line-clamp-2 font-semibold leading-snug">{productName(l.p, locale)}</div>
                        <div className="mt-0.5 text-xs text-muted num">{yen(l.p.price)} / {t.common.cases}</div>
                      </div>
                      <form action={setCartQty}>
                        <input type="hidden" name="product_id" value={l.product_id} />
                        <input type="hidden" name="qty" value="0" />
                        <button aria-label={t.common.remove} title={t.common.remove} className="flex h-8 w-8 items-center justify-center rounded-full bg-fill text-muted hover:text-danger">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
                        </button>
                      </form>
                    </div>
                    {short && <div className="mt-1"><Badge tone="danger">{fmt(t.shop.available, { n: l.p.available })}</Badge></div>}
                    <div className="mt-auto flex flex-wrap items-end justify-between gap-2 pt-2">
                      <form action={setCartQty} className="flex items-center gap-1.5">
                        <input type="hidden" name="product_id" value={l.product_id} />
                        <QtyInput name="qty" defaultValue={l.qty_cases} min={0} size="sm" />
                        <SubmitButton variant="secondary" size="sm" className="h-8! px-3!">{t.common.update}</SubmitButton>
                      </form>
                      <div className="text-lg font-extrabold num">{yen(Number(l.p.price) * l.qty_cases)}</div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>

          <section className="h-fit rounded-[28px] bg-card p-5 shadow-card lg:sticky lg:top-24">
            <form action={placeOrder} className="space-y-4">
              <Field label={t.cart.address}>
                <Select name="address_id" required>
                  {(addresses ?? []).map((a) => <option key={a.id} value={a.id}>{a.label} — {a.address}</option>)}
                </Select>
                <Link href="/shop/profile" className="mt-1.5 inline-block text-xs font-semibold text-harbor">{t.cart.manageAddresses}</Link>
              </Field>
              <Field label={t.cart.deliveryDate} hint={t.cart.deliveryHint}><Input type="date" name="delivery_date" min={today} /></Field>
              <Field label={t.cart.note}><Textarea name="note" rows={2} placeholder={t.cart.notePlaceholder} /></Field>

              <dl className="space-y-2 rounded-2xl bg-fill p-4 text-sm num">
                {totals.s8 > 0 && <Line k={`${t.common.tax8} (${t.common.taxExcl})`} v={yen(totals.s8)} />}
                {totals.s8 > 0 && <Line k={`${t.common.tax} 8%`} v={yen(totals.t8)} />}
                {totals.s10 > 0 && <Line k={`${t.common.tax10} (${t.common.taxExcl})`} v={yen(totals.s10)} />}
                {totals.s10 > 0 && <Line k={`${t.common.tax} 10%`} v={yen(totals.t10)} />}
                <div className="flex items-baseline justify-between border-t border-dashed border-[#d9dbe1] pt-3">
                  <dt className="font-semibold">{t.common.grandTotal}</dt>
                  <dd className="text-2xl font-extrabold">{yen(totals.total)}</dd>
                </div>
              </dl>
              {overLimit && <p className="rounded-2xl bg-danger-soft p-3.5 text-sm font-medium text-danger">{fmt(t.cart.overLimit, { left: yen(Math.max(0, left!)) })}</p>}
              <SubmitButton className="w-full" size="lg" disabled={overLimit}>{t.cart.placeOrder} · {yen(totals.total)}</SubmitButton>
            </form>
          </section>
        </div>
      )}
    </>
  );
}

function Line({ k, v }: { k: string; v: string }) {
  return <div className="flex justify-between"><dt className="text-muted">{k}</dt><dd className="font-semibold">{v}</dd></div>;
}
