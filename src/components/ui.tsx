import Link from 'next/link';
import type { ComponentProps, ReactNode } from 'react';
import { yen, type Dict } from '@/lib/i18n';

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

// ---------------------------------------------------------------------
// 按钮：黑色胶囊为主按钮，强调色只在需要突出时使用
// ---------------------------------------------------------------------
type Variant = 'primary' | 'accent' | 'secondary' | 'danger' | 'ghost' | 'mango';
const variants: Record<Variant, string> = {
  primary: 'bg-ink text-white hover:bg-black',
  accent: 'bg-harbor text-white hover:bg-harbor-dark',
  mango: 'bg-harbor text-white hover:bg-harbor-dark',
  secondary: 'bg-fill text-ink hover:bg-[#e9ebef]',
  danger: 'bg-danger-soft text-danger hover:bg-[#fbdcdc]',
  ghost: 'text-ink hover:bg-fill',
};
export const btn = (v: Variant = 'primary', size: 'sm' | 'md' | 'lg' = 'md') =>
  cx(
    'inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-[transform,background-color] duration-150 active:scale-[.97] disabled:opacity-40 disabled:pointer-events-none select-none',
    size === 'sm' ? 'h-9 px-4 text-sm' : size === 'lg' ? 'h-14 px-7 text-base' : 'h-12 px-6 text-[0.95rem]',
    variants[v],
  );

export function Button({ variant = 'primary', size = 'md', className, ...p }: ComponentProps<'button'> & { variant?: Variant; size?: 'sm' | 'md' | 'lg' }) {
  return <button {...p} className={cx(btn(variant, size), className)} />;
}

export function LinkButton({ variant = 'primary', size = 'md', className, ...p }: ComponentProps<typeof Link> & { variant?: Variant; size?: 'sm' | 'md' | 'lg' }) {
  return <Link {...p} className={cx(btn(variant, size), className)} />;
}

/** 圆形图标按钮（返回、通知、收藏等） */
export const iconBtn = (tone: 'white' | 'fill' | 'dark' = 'white') =>
  cx('relative inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition active:scale-95',
    tone === 'white' && 'bg-card text-ink shadow-card', tone === 'fill' && 'bg-fill text-ink', tone === 'dark' && 'bg-ink text-white');

export function IconLink({ href, label, children, tone = 'white', badge }: { href: string; label: string; children: ReactNode; tone?: 'white' | 'fill' | 'dark'; badge?: number }) {
  return (
    <Link href={href} aria-label={label} title={label} className={iconBtn(tone)}>
      {children}
      {badge ? <span className="absolute -right-0.5 -top-0.5 min-w-[18px] rounded-full bg-harbor px-1 text-center text-[10px] font-bold leading-[18px] text-white num ring-2 ring-paper">{badge}</span> : null}
    </Link>
  );
}

// ---------------------------------------------------------------------
// 卡片与分区
// ---------------------------------------------------------------------
export function Card({ title, actions, children, className, pad = true }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; pad?: boolean }) {
  return (
    <section className={cx('rounded-[28px] bg-card shadow-card', className)}>
      {(title || actions) && (
        <header className="flex flex-wrap items-center justify-between gap-2 px-5 pt-5">
          {title && <h2 className="text-[1.05rem] font-bold tracking-tight">{title}</h2>}
          {actions && <div className="flex flex-wrap items-center gap-2 text-sm">{actions}</div>}
        </header>
      )}
      <div className={pad ? 'p-5' : 'pb-2 pt-3'}>{children}</div>
    </section>
  );
}

/** 不带卡片的小标题行：左标题，右“查看全部” */
export function SectionTitle({ title, href, more }: { title: ReactNode; href?: string; more?: string }) {
  return (
    <div className="mb-3 mt-7 flex items-center justify-between px-1">
      <h2 className="text-[1.15rem] font-bold tracking-tight">{title}</h2>
      {href && more && <Link href={href} className="text-sm font-semibold text-muted hover:text-ink">{more}</Link>}
    </div>
  );
}

export function PageHeader({ title, sub, actions, back }: { title: ReactNode; sub?: ReactNode; actions?: ReactNode; back?: string }) {
  return (
    <div className="mb-5">
      {back && (
        <Link href={back} aria-label="back" className={cx(iconBtn('white'), 'mb-4')}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 18 9 12l6-6" /></svg>
        </Link>
      )}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="display text-[1.75rem] font-extrabold leading-tight sm:text-[2rem]">{title}</h1>
          {sub && <p className="mt-1 text-[0.92rem] text-muted">{sub}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------
// 状态胶囊
// ---------------------------------------------------------------------
type Tone = 'neutral' | 'harbor' | 'signal' | 'ok' | 'warn' | 'danger' | 'sky' | 'plum' | 'dark';
const tones: Record<Tone, string> = {
  neutral: 'bg-fill text-muted',
  harbor: 'bg-harbor-soft text-harbor',
  plum: 'bg-harbor-soft text-harbor',
  signal: 'bg-signal-soft text-[#8a6500]',
  ok: 'bg-ok-soft text-ok',
  warn: 'bg-warn-soft text-warn',
  danger: 'bg-danger-soft text-danger',
  sky: 'bg-sky-soft text-sky',
  dark: 'bg-ink text-white',
};
const dots: Record<Tone, string> = {
  neutral: 'bg-faint', harbor: 'bg-harbor', plum: 'bg-harbor', signal: 'bg-signal', ok: 'bg-ok', warn: 'bg-warn', danger: 'bg-danger', sky: 'bg-sky', dark: 'bg-white',
};
export function Badge({ tone = 'neutral', children, dot = true }: { tone?: Tone; children: ReactNode; dot?: boolean }) {
  return (
    <span className={cx('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold leading-none', tones[tone])}>
      {dot && <span className={cx('h-1.5 w-1.5 rounded-full', dots[tone])} />}
      {children}
    </span>
  );
}

export function OrderStatus({ t, status, cancelRequested }: { t: Dict; status: string; cancelRequested?: boolean }) {
  if (cancelRequested && status === 'confirmed') return <Badge tone="warn">{t.status.cancelRequested}</Badge>;
  const tone: Record<string, Tone> = { pending: 'signal', confirmed: 'harbor', shipped: 'ok', cancelled: 'neutral' };
  return <Badge tone={tone[status] ?? 'neutral'}>{t.status[status as keyof Dict['status']] ?? status}</Badge>;
}

export function PayStatus({ t, status }: { t: Dict; status: string }) {
  const tone: Record<string, Tone> = { unpaid: 'danger', partial: 'warn', paid: 'ok' };
  return <Badge tone={tone[status] ?? 'neutral'}>{t.pay[status as 'unpaid'] ?? status}</Badge>;
}

// ---------------------------------------------------------------------
// 表单
// ---------------------------------------------------------------------
export function Field({ label, hint, children, className }: { label: ReactNode; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <label className={cx('block', className)}>
      <span className="mb-2 block text-sm font-semibold text-ink/80">{label}</span>
      {children}
      {hint && <span className="mt-1.5 block text-xs text-muted">{hint}</span>}
    </label>
  );
}
export function Input(p: ComponentProps<'input'>) {
  return <input {...p} className={cx('field', p.className)} />;
}
export function Select(p: ComponentProps<'select'>) {
  return <select {...p} className={cx('field', p.className)} />;
}
export function Textarea(p: ComponentProps<'textarea'>) {
  return <textarea rows={3} {...p} className={cx('field', p.className)} />;
}

export function Flash({ ok, err }: { ok?: string | null; err?: string | null }) {
  if (!ok && !err) return null;
  return (
    <div role="status" className={cx('pop mb-4 flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold', err ? 'bg-danger-soft text-danger' : 'bg-ink text-white')}>
      <span className={cx('flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs', err ? 'bg-danger text-white' : 'bg-white/15')} aria-hidden="true">
        {err ? '!' : '✓'}
      </span>
      <span>{err || ok}</span>
    </div>
  );
}

export function Money({ v, className }: { v: number | string | null | undefined; className?: string }) {
  return <span className={cx('num', className)}>{yen(v)}</span>;
}

// ---------------------------------------------------------------------
// 数字卡片
// ---------------------------------------------------------------------
type StatTone = 'white' | 'dark' | 'accent' | 'danger' | 'warn' | 'signal' | 'harbor' | 'lime' | 'sky' | 'berry' | 'plum';
export function Stat({ label, value, tone = 'white', href, icon, sub, className }: { label: string; value: ReactNode; tone?: StatTone; href?: string; icon?: ReactNode; sub?: ReactNode; className?: string }) {
  const dark = tone === 'dark' || tone === 'accent';
  const bg = tone === 'dark' ? 'bg-ink text-white' : tone === 'accent' ? 'bg-gradient-to-br from-[#6a5bff] to-[#4636e0] text-white' : 'bg-card shadow-card';
  const valueColor = tone === 'danger' ? 'text-danger' : tone === 'warn' ? 'text-warn' : '';
  const inner = (
    <div className={cx('relative flex h-full flex-col overflow-hidden rounded-[24px] p-4 sm:p-5', bg, className)}>
      {dark && <div aria-hidden="true" className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-white/10 blur-xl" />}
      <div className="relative flex items-center justify-between gap-2">
        <div className={cx('text-[0.82rem] font-semibold', dark ? 'text-white/70' : 'text-muted')}>{label}</div>
        {icon && <div className={cx('flex h-9 w-9 shrink-0 items-center justify-center rounded-full', dark ? 'bg-white/12 text-white' : 'bg-fill text-ink')}>{icon}</div>}
      </div>
      <div className={cx('relative mt-3 text-[1.6rem] font-extrabold leading-none tracking-tight num sm:text-[1.85rem]', valueColor)}>{value}</div>
      {sub && <div className={cx('relative mt-2.5 text-xs font-medium', dark ? 'text-white/65' : 'text-muted')}>{sub}</div>}
    </div>
  );
  return href ? <Link href={href} className="block h-full transition-transform active:scale-[.98]">{inner}</Link> : inner;
}

export function Empty({ children, action, icon }: { children: ReactNode; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-[28px] bg-card px-6 py-12 text-center shadow-card">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-fill text-faint">
        {icon ?? <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5v-9ZM3 7.5 12 12l9-4.5M12 12v9" /></svg>}
      </div>
      <p className="mt-4 max-w-xs text-muted">{children}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/** 胶囊筛选条：选中为黑底 */
export function Tabs({ items, active }: { items: { key: string; label: ReactNode; href: string; count?: number }[]; active: string }) {
  return (
    <nav className="scroller -mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1">
      {items.map((i) => (
        <Link key={i.key} href={i.href}
          className={cx('inline-flex h-10 items-center gap-2 whitespace-nowrap rounded-full px-4 text-sm font-semibold transition-colors',
            i.key === active ? 'bg-ink text-white' : 'bg-card text-ink shadow-card hover:bg-fill')}>
          {i.label}
          {i.count ? <span className={cx('min-w-5 rounded-full px-1.5 text-center text-xs leading-5 num', i.key === active ? 'bg-white text-ink' : 'bg-harbor text-white')}>{i.count}</span> : null}
        </Link>
      ))}
    </nav>
  );
}

// ---------------------------------------------------------------------
// 列表行：手机上代替表格
// ---------------------------------------------------------------------
export function List({ children, className }: { children: ReactNode; className?: string }) {
  return <ul className={cx('divide-y divide-[#f0f1f4] overflow-hidden rounded-[28px] bg-card shadow-card', className)}>{children}</ul>;
}

export function Row({ href, lead, title, sub, end, endSub, className, children }: { href?: string; lead?: ReactNode; title: ReactNode; sub?: ReactNode; end?: ReactNode; endSub?: ReactNode; className?: string; children?: ReactNode }) {
  const body = (
    <>
      {lead && <div className="shrink-0">{lead}</div>}
      <div className="min-w-0 flex-1">
        <div className="truncate font-semibold">{title}</div>
        {sub && <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.8rem] text-muted">{sub}</div>}
        {children}
      </div>
      {(end || endSub) && (
        <div className="shrink-0 text-right">
          {end && <div className="font-bold num">{end}</div>}
          {endSub && <div className="mt-1 flex justify-end">{endSub}</div>}
        </div>
      )}
    </>
  );
  const cls = cx('flex items-center gap-3.5 px-4 py-3.5 sm:px-5', className);
  return <li>{href ? <Link href={href} className={cx(cls, 'transition-colors hover:bg-[#fafafb] active:bg-fill')}>{body}</Link> : <div className={cls}>{body}</div>}</li>;
}

/** 圆形头像：取名字首字 */
export function Avatar({ name, size = 44, tone = 'fill' }: { name: string; size?: number; tone?: 'fill' | 'accent' | 'dark' }) {
  const ch = [...(name || '?').replace(/^(株式会社|有限会社|\(株\)|（株）)\s*/, '').trim()][0] ?? '?';
  return (
    <span className={cx('inline-flex shrink-0 items-center justify-center rounded-full font-bold',
      tone === 'fill' && 'bg-fill text-ink', tone === 'accent' && 'bg-harbor-soft text-harbor', tone === 'dark' && 'bg-ink text-white')}
      style={{ width: size, height: size, fontSize: size * 0.4 }} aria-hidden="true">
      {ch.toUpperCase()}
    </span>
  );
}

/** 图标圆底 */
export function IconDot({ children, tone = 'fill' }: { children: ReactNode; tone?: 'fill' | 'accent' | 'ok' | 'warn' | 'danger' | 'dark' }) {
  return (
    <span className={cx('inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full',
      tone === 'fill' && 'bg-fill text-ink', tone === 'accent' && 'bg-harbor-soft text-harbor', tone === 'ok' && 'bg-ok-soft text-ok',
      tone === 'warn' && 'bg-warn-soft text-warn', tone === 'danger' && 'bg-danger-soft text-danger', tone === 'dark' && 'bg-ink text-white')}>
      {children}
    </span>
  );
}

export function Progress({ value, max, tone = 'accent' }: { value: number; max: number; tone?: 'accent' | 'danger' | 'dark' }) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  return (
    <div className="h-2.5 w-full overflow-hidden rounded-full bg-fill" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
      <div className={cx('h-full rounded-full', tone === 'accent' && 'bg-harbor', tone === 'danger' && 'bg-danger', tone === 'dark' && 'bg-ink')} style={{ width: `${pct}%` }} />
    </div>
  );
}

/** 柱状图：重点柱子用强调色并显示数值，其它为斜纹 */
export function Bars({ data, height = 168, format = yen }: { data: { label: string; value: number; highlight?: boolean }[]; height?: number; format?: (n: number) => string }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="flex items-end gap-2 sm:gap-3" style={{ height }}>
      {data.map((d, i) => {
        const h = Math.max((d.value / max) * (height - 46), 6);
        return (
          <div key={i} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-2">
            {d.highlight && <span className="rounded-full bg-ink px-2 py-0.5 text-[10px] font-bold text-white num">{format(d.value)}</span>}
            <div className={cx('w-full max-w-12 rounded-[12px]', d.highlight ? 'bg-harbor' : 'stripes')} style={{ height: h }} title={format(d.value)} />
            <span className={cx('truncate text-[11px] font-semibold', d.highlight ? 'text-ink' : 'text-faint')}>{d.label}</span>
          </div>
        );
      })}
    </div>
  );
}

/** 订单进度：图标 + 虚线（参考外卖配送进度） */
export function OrderRail({ t, order, locale }: { t: Dict; order: { status: string; created_at: string; confirmed_at: string | null; shipped_at: string | null; cancelled_at: string | null }; locale: string }) {
  const f = (d: string | null) => (d ? new Intl.DateTimeFormat(locale === 'zh' ? 'zh-CN' : locale === 'en' ? 'en-US' : 'ja-JP', { timeZone: 'Asia/Tokyo', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(d)) : '—');
  if (order.status === 'cancelled')
    return <div className="flex items-center gap-3 text-sm text-muted"><Badge>{t.status.cancelled}</Badge><span className="num">{f(order.cancelled_at)}</span></div>;
  const icons = [
    'M9 5h10v14H5V9l4-4ZM9 5v4H5M9 13h6M9 16h4',
    'M5 12.5 10 17l9-10',
    'M3 6h11v10H3zM14 10h4l3 3v3h-7M7 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm10 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z',
  ];
  const steps = [
    { label: t.orders.placed, at: order.created_at, done: true },
    { label: t.status.confirmed, at: order.confirmed_at, done: !!order.confirmed_at },
    { label: t.status.shipped, at: order.shipped_at, done: !!order.shipped_at },
  ];
  return (
    <ol className="flex items-start">
      {steps.map((s, i) => (
        <li key={i} className={cx('flex items-start', i < 2 && 'flex-1')}>
          <div className="flex w-16 flex-col items-center text-center">
            <span className={cx('flex h-11 w-11 items-center justify-center rounded-full', s.done ? 'bg-ink text-white' : 'bg-fill text-faint')}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={icons[i]} /></svg>
            </span>
            <span className={cx('mt-2 text-xs font-bold', !s.done && 'text-faint')}>{s.label}</span>
            <span className="text-[11px] text-muted num">{s.done ? f(s.at) : ''}</span>
          </div>
          {i < 2 && <div className={cx('mt-[21px] h-0 flex-1 border-t-[3px] border-dotted', steps[i + 1].done ? 'border-ink' : 'border-[#d9dbe1]')} />}
        </li>
      ))}
    </ol>
  );
}

/** 详情键值对 */
export function KV({ items }: { items: [ReactNode, ReactNode][] }) {
  return (
    <dl className="divide-y divide-[#f0f1f4]">
      {items.map(([k, v], i) => (
        <div key={i} className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0">
          <dt className="max-w-[45%] shrink-0 text-sm text-muted">{k}</dt>
          <dd className="min-w-0 text-right text-sm font-semibold [overflow-wrap:anywhere]">{v}</dd>
        </div>
      ))}
    </dl>
  );
}
