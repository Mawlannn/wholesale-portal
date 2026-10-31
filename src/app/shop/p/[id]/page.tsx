import { notFound } from 'next/navigation';
import { requireCustomer, getT } from '@/lib/session';
import { readFlash } from '@/lib/flash';
import { fmt, fmtDate, productName, yen } from '@/lib/i18n';
import { addToCart, toggleFavorite } from '@/lib/actions/shop';
import { Badge, Flash, IconLink, cx } from '@/components/ui';
import { QtyInput, SubmitButton } from '@/components/client';
import { Icons, ProductArt } from '@/components/brand';

type Row = {
  id: string; sku: string; name_ja: string; name_zh: string | null; name_en: string | null; description: string | null;
  category: string | null; brand: string | null; origin_country: string | null; unit_per_case: number; price: number;
  base_price: number; tax_rate: number; min_order_qty: number; image_url: string | null; available: number;
  nearest_expiry: string | null; is_favorite: boolean; in_cart: number;
};

export default async function ProductPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string>> }) {
  const { id } = await params;
  const sp = await searchParams;
  const { supabase } = await requireCustomer();
  const { t, locale } = await getT();
  const { data } = await supabase.rpc('get_catalog');
  const p = ((data ?? []) as Row[]).find((r) => r.id === id);
  if (!p) notFound();
  const out = p.available < p.min_order_qty;
  const special = Number(p.price) < Number(p.base_price);
  const name = productName(p, locale);
  const facts: [string, string][] = [
    [t.common.sku, p.sku],
    [t.admin.products.unitPerCase, String(p.unit_per_case)],
    [t.admin.products.minQty, fmt(t.common.casesN, { n: p.min_order_qty })],
    [t.admin.products.taxRate, `${p.tax_rate}%`],
    ...(p.origin_country ? [[t.shop.origin, p.origin_country] as [string, string]] : []),
    ...(p.nearest_expiry ? [[t.admin.inbound.expiry, fmtDate(p.nearest_expiry, locale)] as [string, string]] : []),
  ];

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-4 flex items-center justify-between gap-3">
        <IconLink href="/shop" label={t.common.back}>{Icons.back}</IconLink>
        <h1 className="truncate text-base font-bold">{t.shop.details}</h1>
        <form action={toggleFavorite}>
          <input type="hidden" name="product_id" value={p.id} />
          <input type="hidden" name="on" value={p.is_favorite ? '0' : '1'} />
          <button aria-label={p.is_favorite ? t.shop.unfavorite : t.shop.favorite}
            className={cx('flex h-11 w-11 items-center justify-center rounded-full bg-card shadow-card transition active:scale-90', p.is_favorite ? 'text-danger' : 'text-ink')}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill={p.is_favorite ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.9" aria-hidden="true">
              <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z" />
            </svg>
          </button>
        </form>
      </header>
      <Flash {...readFlash(t, sp)} />

      <div className="grid gap-4 md:grid-cols-2 md:gap-6">
        <ProductArt sku={p.sku} name={name} category={p.category} brand={p.brand} image={p.image_url}
          className={cx('aspect-square rounded-[32px] shadow-card', out && 'opacity-60 grayscale')} />

        <section className="rounded-[32px] bg-card p-5 shadow-card sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              {p.brand && <div className="text-sm font-semibold text-muted">{p.brand}</div>}
              <h2 className="mt-1 text-[1.55rem] font-extrabold leading-tight tracking-tight">{name}</h2>
            </div>
            <div className="shrink-0 text-right">
              {special && <div className="text-sm text-faint line-through num">{yen(p.base_price)}</div>}
              <div className="text-[1.6rem] font-extrabold leading-none num">{yen(p.price)}</div>
              <div className="mt-1 text-xs text-muted">/{t.common.cases} · {t.common.taxExcl}</div>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {out ? <Badge tone="danger">{t.shop.outOfStock}</Badge> : <Badge tone="ok">{fmt(t.shop.available, { n: p.available })}</Badge>}
            {special && <Badge tone="harbor">{t.shop.specialPrice}</Badge>}
            {p.in_cart > 0 && <Badge tone="dark" dot={false}>{fmt(t.shop.inCart, { n: p.in_cart })}</Badge>}
          </div>

          {p.description && <p className="mt-5 leading-relaxed text-muted">{p.description}</p>}

          <dl className="mt-5 grid grid-cols-2 gap-2">
            {facts.map(([k, v]) => (
              <div key={k} className="rounded-2xl bg-fill px-4 py-3">
                <dt className="text-xs text-muted">{k}</dt>
                <dd className="mt-0.5 font-bold num">{v}</dd>
              </div>
            ))}
          </dl>

          {!out && (
            <form action={addToCart} className="mt-6 flex items-center gap-3">
              <input type="hidden" name="product_id" value={p.id} />
              <input type="hidden" name="back" value={`/shop/p/${p.id}`} />
              <QtyInput name="qty" defaultValue={p.min_order_qty} min={1} max={p.available} />
              <SubmitButton size="lg" className="flex-1">{Icons.cart}{t.shop.addToCart}</SubmitButton>
            </form>
          )}
        </section>
      </div>
    </div>
  );
}
