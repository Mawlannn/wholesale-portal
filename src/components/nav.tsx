'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

export type NavItem = { href: string; label: string; badge?: number; exact?: boolean; icon?: ReactNode; group?: string; also?: string[] };

function isActive(path: string, i: NavItem) {
  if (i.also?.some((a) => path === a || path.startsWith(a + '/'))) return true;
  return i.exact ? path === i.href : path === i.href || path.startsWith(i.href + '/');
}

/** 手机底部：黑色悬浮胶囊，选中项变成白色胶囊并显示文字 */
export function BottomNav({ items }: { items: NavItem[] }) {
  const path = usePathname();
  return (
    <nav aria-label="main"
      className="no-print shadow-float fixed inset-x-4 z-30 mx-auto flex max-w-xl items-center justify-between gap-1 rounded-full bg-ink p-1.5"
      style={{ bottom: 'calc(14px + env(safe-area-inset-bottom, 0px))' }}>
      {items.map((i) => {
        const on = isActive(path, i);
        return (
          <Link key={i.href} href={i.href} aria-label={i.label} aria-current={on ? 'page' : undefined}
            className={`relative flex h-12 items-center justify-center gap-2 rounded-full transition-all duration-200 ${on ? 'flex-[1.9] bg-card px-4 text-ink' : 'flex-1 text-white/70 active:text-white'}`}>
            {i.icon}
            {on && <span className="truncate text-sm font-bold">{i.label}</span>}
            {i.badge ? (
              <span className={`absolute top-1 min-w-[18px] rounded-full px-1 text-center text-[10px] font-bold leading-[18px] num ${on ? 'right-2 bg-harbor text-white' : 'right-[calc(50%-20px)] bg-harbor text-white'}`}>{i.badge}</span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}

/** 桌面：顶部胶囊导航（客户端） */
export function TopNav({ items }: { items: NavItem[] }) {
  const path = usePathname();
  return (
    <nav className="hidden items-center gap-1 rounded-full bg-card p-1.5 shadow-card md:flex">
      {items.map((i) => (
        <Link key={i.href} href={i.href}
          className={`relative flex h-10 items-center gap-2 rounded-full px-4 text-sm font-semibold transition-colors ${isActive(path, i) ? 'bg-ink text-white' : 'text-muted hover:text-ink'}`}>
          {i.label}
          {i.badge ? <span className="min-w-5 rounded-full bg-harbor px-1.5 text-center text-xs leading-5 text-white num">{i.badge}</span> : null}
        </Link>
      ))}
    </nav>
  );
}

/** 手机：购物车结算条（悬浮在导航条上方） */
export function CartBar({ count, total, label }: { count: number; total: string; label: string }) {
  const path = usePathname();
  if (!count || path.startsWith('/shop/cart') || path.startsWith('/shop/p/')) return null;
  return (
    <Link href="/shop/cart"
      className="pop no-print shadow-float fixed inset-x-4 z-30 mx-auto flex h-14 max-w-xl items-center gap-3 rounded-full bg-harbor pl-2 pr-5 font-semibold text-white"
      style={{ bottom: 'calc(86px + env(safe-area-inset-bottom, 0px))' }}>
      <span className="flex h-10 min-w-10 items-center justify-center rounded-full bg-white px-2 text-sm font-bold text-harbor num">{count}</span>
      <span className="flex-1">{label}</span>
      <span className="text-lg font-extrabold num">{total}</span>
    </Link>
  );
}

/** 桌面：管理端白色侧边栏 */
export function SideNav({ items, footer, header }: { items: NavItem[]; footer?: ReactNode; header?: ReactNode }) {
  const path = usePathname();
  return (
    <nav className="sticky top-5 hidden max-h-[calc(100dvh-2.5rem)] w-64 shrink-0 flex-col overflow-y-auto rounded-[28px] bg-card p-4 shadow-card md:flex">
      {header}
      <div className="mt-2 flex flex-col gap-1">
        {items.map((i, idx) => (
          <div key={i.href}>
            {i.group && items[idx - 1]?.group !== i.group && (
              <div className="px-3 pb-1.5 pt-4 text-[11px] font-bold uppercase tracking-wider text-faint">{i.group}</div>
            )}
            <Link href={i.href}
              className={`flex h-11 items-center gap-3 rounded-full px-3.5 text-sm font-semibold transition-colors ${isActive(path, i) ? 'bg-ink text-white' : 'text-muted hover:bg-fill hover:text-ink'}`}>
              {i.icon}
              <span className="flex-1">{i.label}</span>
              {i.badge ? <span className={`min-w-5 rounded-full px-1.5 text-center text-xs leading-5 num ${isActive(path, i) ? 'bg-white text-ink' : 'bg-harbor text-white'}`}>{i.badge}</span> : null}
            </Link>
          </div>
        ))}
      </div>
      {footer && <div className="mt-auto pt-5">{footer}</div>}
    </nav>
  );
}
