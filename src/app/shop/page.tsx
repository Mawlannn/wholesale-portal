import Link from 'next/link';
import { requireCustomer, getT } from '@/lib/session';
import { readFlash } from '@/lib/flash';
import { setLanguage } from '@/lib/actions/common';
import { fmt, fmtDate, productName, yen } from '@/lib/i18n';
import { addToCart, reorder, toggleFavorite } from '@/lib/actions/shop';
import { Avatar, Empty, Flash, IconLink, cx } from '@/components/ui';
import { LangSwitcher, SubmitButton } from '@/components/client';
import { Icons, ProductArt, langLabels } from '@/components/brand';

type Row = {
  id: string; sku: string; name_ja: string; name_zh: string | null; name_en: string | null; description: string | null;
  category: string | null; brand: string | null; origin_country: string | null; unit_per_case: number; price: number;
  base_price: number; tax_rate: number; min_order_qty: number; image_url: string | null; available: number;
  nearest_expiry: string | null; is_favorite: boolean; in_cart: number;
};

export default async function Catalog({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const { supabase, customer, profile } = await requireCustomer();
  const { t, locale } = await getT();
  const [{ data: rows, error }, { data: pos }, { data: settings }, { data: last }, { data: cart }] = await Promise.all([
    supabase.rpc('get_catalog'),
    supabase.rpc('customer_position', { p_customer_id: customer.id }).single<{ outstanding: number; overdue: number; exposure: number }>(),
    supabase.from('settings').select('order_cutoff').eq('id', 1).single(),
    supabase.from('orders').select('id, order_no, total, created_at').eq('customer_id', customer.id).neq('status', 'cancelled').order('created_at', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('cart_items').select('qty_cases').eq('customer_id', customer.id),
  ]);
  const all = (rows ?? []) as Row[];
  const q = (sp.q ?? '').trim().toLowerCase();
  const list = all.filter((p) =>
    (!sp.cat || p.category === sp.cat) &&
    (!sp.fav || p.is_favorite) &&
    (!q || [p.sku, p.name_ja, p.name_zh, p.name_en, p.brand].some((s) => s?.toLowerCase().includes(q))));
  const categories = [...new Set(all.map((p) => p.category).filter(Boolean))] as string[];
  const qs = (o: Record<string, string | undefined>) => {
    const u = new URLSearchParams(Object.entries(o).filter(([, v]) => v) as [string, string][]).toString();
    return u ? `/shop?${u}` : '/shop';
  };
  const backUrl = qs({ q: sp.q, cat: sp.cat, fav: sp.fav });
  const limit = customer.credit_limit != null ? Number(customer.credit_limit) : null;
  const exposure = Number(pos?.exposure ?? 0);
  const flash = readFlash(t, sp);
  const owner = profile.member_role === 'owner';
  const cartCount = (cart ?? []).reduce((s, c) => s + c.qty_cases, 0);
  const chip = (on: boolean) => cx('inline-flex h-11 shrink-0 items-center gap-2 whitespace-nowrap rounded-full px-5 text-sm font-semibold transition-colors',
    on ? 'bg-ink text-white' : 'bg-card text-ink shadow-card');

  return (
    <>
      {/* 顶部：头像 + 问候 + 图标按钮 */}
      <header className="mb-5 flex items-center gap-3">
        <Avatar name={customer.company_name} size={48} tone="dark" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[1.05rem] font-bold">{fmt(t.shop.hello, { name: customer.contact_name || customer.company_name })}</div>
          <div className="truncate text-sm text-muted">{customer.company_name}</div>
        </div>
        <div className="flex gap-2">
          <LangSwitcher action={setLanguage} current={locale} labels={langLabels(t)} title={t.lang.label} variant="icon" />
          <IconLink href="/shop/cart" label={t.nav.cart} badge={cartCount}>{Icons.cart}</IconLink>
        </div>
      </header>

      <Flash ok={flash.ok} err={error ? t.errors.generic : flash.err} />

      <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
        {/* 搜索 */}
        <form className="relative lg:col-span-2" role="search" action="/shop">
          {sp.cat && <input type="hidden" name="cat" value={sp.cat} />}
          {sp.fav && <input type="hidden" name="fav" value={sp.fav} />}
          <span className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-muted">{Icons.search}</span>
          <input name="q" defaultValue={sp.q} placeholder={t.shop.search} aria-label={t.common.search}
            className="h-14 w-full rounded-full bg-card pl-14 pr-5 text-base shadow-card outline-none placeholder:text-faint focus:ring-4 focus:ring-harbor-soft" />
        </form>

        {/* 账款卡：像银行卡一样 */}
        <section className="relative overflow-hidden rounded-[28px] bg-ink p-5 text-white sm:p-6">
          <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-harbor opacity-60 blur-3xl" />
          <div aria-hidden="true" className="pointer-events-none absolute -bottom-24 left-10 h-40 w-40 rounded-full bg-sky opacity-30 blur-3xl" />
          <div className="relative flex items-center justify-between gap-2">
            <span className="text-sm font-semibold text-white/70">{t.shop.balanceCard}</span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold">
              {Icons.clock}<span>{fmt(t.shop.cutoffShort, { time: settings?.order_cutoff ?? '15:00' })}</span>
            </span>
          </div>
          <div className="relative mt-4 text-[2.4rem] font-extrabold leading-none tracking-tight num">{yen(pos?.outstanding)}</div>
          <div className="relative mt-1.5 text-sm text-white/60">
            {t.account.outstanding}
            {Number(pos?.overdue) > 0 && <span className="ml-2 font-semibold text-[#ff8a8e]">{t.account.overdue} {yen(pos?.overdue)}</span>}
          </div>
          {limit != null && (
            <div className="relative mt-5">
              <div className="mb-2 flex justify-between gap-2 text-xs font-semibold text-white/70 num">
                <span>{t.account.limitUsed} {yen(exposure)}</span><span>{t.account.creditLimit} {yen(limit)}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-white/15">
                <div className="h-full rounded-full bg-white" style={{ width: `${Math.min(100, (exposure / Math.max(limit, 1)) * 100)}%` }} />
              </div>
            </div>
          )}
          {owner && (
            <Link href="/shop/account" className="relative mt-5 inline-flex h-10 items-center gap-2 rounded-full bg-white px-4 text-sm font-bold text-ink">
              {t.account.title}{Icons.arrow}
            </Link>
          )}
        </section>

        {/* 再来一单 */}
        {last ? (
          <section className="flex flex-col justify-between gap-4 rounded-[28px] bg-card p-5 shadow-card sm:p-6">
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-harbor-soft text-harbor">{Icons.repeat}</span>
              <div className="min-w-0 flex-1">
                <div className="font-bold">{t.shop.repeatLast}</div>
                <div className="truncate text-sm text-muted num">{last.order_no} · {fmtDate(last.created_at, locale)}</div>
              </div>
              <div className="text-right font-extrabold num">{yen(last.total)}</div>
            </div>
            <form action={reorder}>
              <input type="hidden" name="order_id" value={last.id} />
              <SubmitButton variant="secondary" className="w-full">{t.orders.reorder}</SubmitButton>
            </form>
          </section>
        ) : <div className="hidden lg:block" />}
      </div>

      {/* 分类 */}
      <nav className="scroller -mx-4 mb-1 mt-6 flex gap-2 overflow-x-auto px-4 pb-2" aria-label={t.shop.allCategories}>
        <Link href={qs({ q: sp.q })} className={chip(!sp.cat && !sp.fav)}>{t.common.all}</Link>
        <Link href={qs({ q: sp.q, fav: '1' })} className={chip(!!sp.fav)}><span className={sp.fav ? 'text-[#ff8a8e]' : 'text-danger'}>♥</span>{t.shop.favoritesOnly}</Link>
        {categories.map((c) => <Link key={c} href={qs({ q: sp.q, cat: c })} className={chip(sp.cat === c)}>{c}</Link>)}
      </nav>

      <div className="mb-3 mt-4 flex items-baseline justify-between px-1">
        <h2 className="text-[1.2rem] font-bold tracking-tight">{sp.cat || (sp.fav ? t.shop.favoritesOnly : t.shop.allProducts)}</h2>
        <span className="text-sm font-semibold text-muted num">{list.length}</span>
      </div>

      {list.length === 0 && <Empty>{t.shop.empty}</Empty>}

      <ul className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
        {list.map((p) => {
          const out = p.available < p.min_order_qty;
          const low = !out && p.available <= Math.max(5, p.min_order_qty * 2);
          const special = Number(p.price) < Number(p.base_price);
          const href = `/shop/p/${p.id}`;
          return (
            <li key={p.id} className="flex flex-col rounded-[26px] bg-card p-2 shadow-card">
              <div className="relative">
                <Link href={href} aria-label={productName(p, locale)}>
                  <ProductArt sku={p.sku} name={productName(p, locale)} category={p.category} brand={p.brand} image={p.image_url}
                    className={cx('aspect-square rounded-[20px]', out && 'opacity-50 grayscale')} />
                </Link>
                <form action={toggleFavorite} className="absolute right-2 top-2">
                  <input type="hidden" name="product_id" value={p.id} />
                  <input type="hidden" name="on" value={p.is_favorite ? '0' : '1'} />
                  <button aria-label={p.is_favorite ? t.shop.unfavorite : t.shop.favorite} title={p.is_favorite ? t.shop.unfavorite : t.shop.favorite}
                    className={cx('flex h-9 w-9 items-center justify-center rounded-full bg-card transition active:scale-90', p.is_favorite ? 'text-danger' : 'text-ink')}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill={p.is_favorite ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.9" aria-hidden="true">
                      <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z" />
                    </svg>
                  </button>
                </form>
                <div className="absolute left-2 top-2 flex flex-col items-start gap-1">
                  {out ? <span className="rounded-full bg-ink px-2.5 py-1 text-[11px] font-bold text-white">{t.shop.outOfStock}</span>
                    : low ? <span className="rounded-full bg-warn px-2.5 py-1 text-[11px] font-bold text-white">{t.shop.lowStock}</span> : null}
                  {special && <span className="rounded-full bg-harbor px-2.5 py-1 text-[11px] font-bold text-white">{t.shop.specialPrice}</span>}
                </div>
                {!out && (
                  <form action={addToCart} className="absolute bottom-2 right-2">
                    <input type="hidden" name="product_id" value={p.id} />
                    <input type="hidden" name="back" value={backUrl} />
                    <input type="hidden" name="qty" value={p.min_order_qty} />
                    <SubmitButton size="sm" className="shadow-float h-9! gap-1! px-3.5!" aria-label={t.shop.addToCart}>
                      {Icons.plus}<span>{p.in_cart > 0 ? p.in_cart : t.shop.add}</span>
                    </SubmitButton>
                  </form>
                )}
              </div>
              <Link href={href} className="flex flex-1 flex-col px-2 pb-2 pt-3">
                <h3 className="line-clamp-2 text-[0.95rem] font-semibold leading-snug">{productName(p, locale)}</h3>
                <div className="mt-1 truncate text-xs text-muted">{p.brand ? `${p.brand} · ` : ''}{fmt(t.shop.perCase, { n: p.unit_per_case })}</div>
                {!out && <div className="mt-1 text-[11px] font-semibold text-ok">{fmt(t.shop.available, { n: p.available })}</div>}
                <div className="mt-auto whitespace-nowrap pt-2">
                  <span className="text-[1.15rem] font-extrabold num">{yen(p.price)}</span>
                  <span className="text-xs text-muted">/{t.common.cases}</span>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </>
  );
}
