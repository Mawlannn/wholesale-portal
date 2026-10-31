import { requireAdmin, getT } from '@/lib/session';
import { BottomNav, type NavItem } from '@/components/nav';
import { Icons } from '@/components/brand';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { supabase } = await requireAdmin();
  const { t } = await getT();
  const { data: d } = await supabase.rpc('admin_dashboard');
  const dash = (d ?? {}) as Record<string, number>;
  const nav: NavItem[] = [
    { href: '/admin', label: t.nav.dashboard, exact: true, icon: Icons.home },
    { href: '/admin/orders', label: t.nav.adminOrders, badge: (dash.pending_orders ?? 0) + (dash.cancel_requests ?? 0), icon: Icons.list },
    { href: '/admin/customers', label: t.nav.customers, badge: dash.pending_customers, icon: Icons.users },
    { href: '/admin/products', label: t.nav.products, icon: Icons.box },
    { href: '/admin/more', label: t.nav.more, icon: Icons.grid,
      also: ['/admin/inbound', '/admin/inventory', '/admin/recall', '/admin/receivables', '/admin/emails', '/admin/logs', '/admin/settings'] },
  ];
  return (
    <div className="mx-auto min-h-dvh max-w-7xl">
      {/* 导航统一放在底部（手机、电脑一样） */}
      <main className="min-w-0 px-4 pb-32 pt-[calc(16px+env(safe-area-inset-top,0px))] md:px-6 md:pt-6">{children}</main>
      <BottomNav items={nav} />
    </div>
  );
}
