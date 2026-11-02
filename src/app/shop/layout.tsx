import { requireCustomer, getT } from '@/lib/session';
import { yen } from '@/lib/i18n';
import { calcTotals } from '@/lib/totals';
import { BottomNav, CartBar, type NavItem } from '@/components/nav';
import { Icons } from '@/components/brand';

export default async function ShopLayout({ children }: { children: React.ReactNode }) {
  const { supabase, customer, profile } = await requireCustomer();
  const { t } = await getT();
  // 只查购物车里的商品价格（不再每次切换页面都拉整个商品目录）
  const [{ data: cart }, { data: special }] = await Promise.all([
    supabase.from('cart_items').select('product_id, qty_cases, products!inner(price_per_case, tax_rate, is_active)').eq('customer_id', customer.id),
    supabase.from('customer_prices').select('product_id, price_per_case').eq('customer_id', customer.id),
  ]);
  const own = new Map((special ?? []).map((s) => [s.product_id, Number(s.price_per_case)]));
  type Line = { product_id: string; qty_cases: number; products: { price_per_case: number; tax_rate: number; is_active: boolean } | null };
  const price = new Map(((cart ?? []) as unknown as Line[]).filter((c) => c.products?.is_active)
    .map((c) => [c.product_id, { price: own.get(c.product_id) ?? Number(c.products!.price_per_case), tax_rate: c.products!.tax_rate }]));
  const cartCount = (cart ?? []).reduce((s, c) => s + c.qty_cases, 0);
  const cartTotal = calcTotals((cart ?? []).filter((c) => price.has(c.product_id))
    .map((c) => ({ amount: Number(price.get(c.product_id)!.price) * c.qty_cases, rate: price.get(c.product_id)!.tax_rate }))).total;
  const owner = profile.member_role === 'owner';
  const items: NavItem[] = [
    { href: '/shop', label: t.nav.home, exact: true, icon: Icons.home, also: ['/shop/p'] },
    { href: '/shop/cart', label: t.nav.cart, badge: cartCount, icon: Icons.cart },
    { href: '/shop/orders', label: t.nav.orders, icon: Icons.list },
    ...(owner ? [{ href: '/shop/account', label: t.nav.account, icon: Icons.yen }] : []),
    { href: '/shop/profile', label: t.nav.profile, icon: Icons.user },
  ];
  return (
    <div className="min-h-dvh pb-44">
      {/* 导航统一放在底部（手机、电脑一样），顶部不放导航 */}
      <main className="mx-auto max-w-6xl px-4 pt-[calc(16px+env(safe-area-inset-top,0px))] md:px-6 md:pt-6">{children}</main>
      <CartBar count={cartCount} total={yen(cartTotal)} label={t.cart.viewCart} />
      <BottomNav items={items} />
    </div>
  );
}
