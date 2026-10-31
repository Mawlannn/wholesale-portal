import { notFound } from 'next/navigation';
import { requireAdmin, getT } from '@/lib/session';
import { readFlash } from '@/lib/flash';
import { fmt, fmtDate, productName, yen } from '@/lib/i18n';
import { saveCustomerPrice } from '@/lib/actions/admin';
import { Avatar, Card, Flash, IconLink, Input, LinkButton, Select, Stat } from '@/components/ui';
import { SubmitButton } from '@/components/client';
import { ProductForm } from '@/components/product-form';
import { Icons, ProductArt } from '@/components/brand';

export default async function EditProduct({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string>> }) {
  const { id } = await params;
  const { supabase } = await requireAdmin();
  const { t, locale } = await getT();
  const [{ data: p }, { data: cats }, { data: stock }, { data: lots }, { data: prices }, { data: customers }] = await Promise.all([
    supabase.from('products').select('*').eq('id', id).maybeSingle(),
    supabase.from('products').select('category'),
    supabase.from('product_stock').select('*').eq('product_id', id).maybeSingle(),
    supabase.from('lots').select('*').eq('product_id', id).order('expiry_date', { nullsFirst: false }).order('received_at'),
    supabase.from('customer_prices').select('price_per_case, customer_id, customers(company_name)').eq('product_id', id),
    supabase.from('customers').select('id, company_name').eq('status', 'approved').order('company_name'),
  ]);
  if (!p) notFound();
  const categories = [...new Set((cats ?? []).map((r) => r.category).filter(Boolean))] as string[];
  const a = t.admin.products;
  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-4 flex items-center gap-3">
        <IconLink href="/admin/products" label={a.title}>{Icons.back}</IconLink>
        <ProductArt sku={p.sku} name={productName(p, locale)} category={p.category} brand={p.brand} image={p.image_url} className="h-12 w-12 shrink-0 rounded-2xl" />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-extrabold tracking-tight">{productName(p, locale)}</h1>
          <div className="text-sm text-muted num">{p.sku}</div>
        </div>
        <LinkButton href={`/admin/inbound?product=${p.id}`} size="sm" className="hidden sm:inline-flex">{Icons.truck}{t.admin.inbound.title}</LinkButton>
      </header>
      <Flash {...readFlash(t, await searchParams)} />
      <div className="mb-4 grid grid-cols-3 gap-3">
        <Stat label={a.onHand} value={stock?.on_hand ?? 0} />
        <Stat label={a.reserved} value={stock?.reserved ?? 0} />
        <Stat label={a.available} value={stock?.available ?? 0} tone={(stock?.available ?? 0) <= p.low_stock_threshold ? 'danger' : 'dark'} />
      </div>
      <LinkButton href={`/admin/inbound?product=${p.id}`} className="mb-4 w-full sm:hidden">{Icons.truck}{t.admin.inbound.title}</LinkButton>

      <div className="grid gap-4 xl:grid-cols-[1fr_26rem] xl:gap-6">
        <Card title={a.edit}><ProductForm t={t} p={p} categories={categories} /></Card>
        <div className="space-y-4">
          <Card title={a.lots} pad={false}>
            {!lots?.length ? <p className="px-5 pb-4 text-sm text-muted">{t.common.noData}</p> : (
              <ul className="divide-y divide-[#f0f1f4]">
                {lots.map((l) => (
                  <li key={l.id} className={`flex items-center gap-3 px-5 py-3 ${l.qty_on_hand ? '' : 'opacity-50'}`}>
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-fill">{Icons.warehouse}</span>
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold num">{l.lot_no}</div>
                      <div className="text-xs text-muted num">{t.admin.inbound.expiry} {fmtDate(l.expiry_date, locale)}{l.unit_cost != null && ` · ${yen(l.unit_cost)}`}</div>
                    </div>
                    <div className="text-right font-bold num">{l.qty_on_hand}<span className="text-xs font-medium text-muted"> / {l.qty_received}</span></div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card title={a.specialPrices}>
            <ul className="mb-4 divide-y divide-[#f0f1f4]">
              {(prices ?? []).map((cp) => {
                const name = (cp.customers as unknown as { company_name: string }).company_name;
                return (
                  <li key={cp.customer_id} className="flex items-center gap-3 py-2.5">
                    <Avatar name={name} size={36} />
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold">{name}</span>
                    <span className="font-bold num">{yen(cp.price_per_case)}</span>
                    <form action={saveCustomerPrice}>
                      <input type="hidden" name="product_id" value={id} /><input type="hidden" name="customer_id" value={cp.customer_id} />
                      <input type="hidden" name="op" value="delete" />
                      <button aria-label={t.common.remove} className="flex h-8 w-8 items-center justify-center rounded-full bg-fill text-muted hover:text-danger">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
                      </button>
                    </form>
                  </li>
                );
              })}
            </ul>
            <form action={saveCustomerPrice} className="space-y-2">
              <input type="hidden" name="product_id" value={id} />
              <Select name="customer_id" required aria-label={a.customer}>
                <option value="">{a.customer}</option>
                {(customers ?? []).map((c) => <option key={c.id} value={c.id}>{c.company_name}</option>)}
              </Select>
              <div className="flex gap-2">
                <Input name="price" inputMode="numeric" placeholder="¥" aria-label={t.common.price} required />
                <SubmitButton variant="secondary">{t.common.add}</SubmitButton>
              </div>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
}
