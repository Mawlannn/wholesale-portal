import type { Dict } from '@/lib/i18n';
import type { NavItem } from './nav';
import { Icons } from './brand';

/** 管理端菜单（侧边栏和“更多”页面共用） */
export function adminNav(t: Dict, dash: Record<string, number>): NavItem[] {
  const a = t.admin;
  return [
    { href: '/admin', label: t.nav.dashboard, exact: true, icon: Icons.home },
    { href: '/admin/orders', label: t.nav.adminOrders, badge: (dash.pending_orders ?? 0) + (dash.cancel_requests ?? 0), icon: Icons.list, group: a.gSales },
    { href: '/admin/customers', label: t.nav.customers, badge: dash.pending_customers, icon: Icons.users, group: a.gSales },
    { href: '/admin/products', label: t.nav.products, icon: Icons.box, group: a.gStock },
    { href: '/admin/inbound', label: t.nav.inbound, icon: Icons.truck, group: a.gStock },
    { href: '/admin/inventory', label: t.nav.inventory, badge: dash.expiring_lots, icon: Icons.warehouse, group: a.gStock },
    { href: '/admin/recall', label: t.nav.recall, icon: Icons.search, group: a.gStock },
    { href: '/admin/receivables', label: t.nav.receivables, icon: Icons.yen, group: a.gMoney },
    { href: '/admin/emails', label: t.nav.emails, icon: Icons.mail, group: a.gSystem },
    { href: '/admin/logs', label: t.nav.logs, icon: Icons.clock, group: a.gSystem },
    { href: '/admin/settings', label: t.nav.settings, icon: Icons.gear, group: a.gSystem },
  ];
}

