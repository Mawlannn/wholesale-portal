'use client';

import { useFormStatus } from 'react-dom';
import { useRef, useState, type ComponentProps, type ReactNode } from 'react';
import { btn, cx } from './ui';

type Variant = 'primary' | 'accent' | 'secondary' | 'danger' | 'ghost' | 'mango';

/** 提交按钮：提交中显示转圈，可选二次确认 */
export function SubmitButton({
  children, variant = 'primary', size = 'md', confirm, className, ...p
}: ComponentProps<'button'> & { variant?: Variant; size?: 'sm' | 'md' | 'lg'; confirm?: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      {...p}
      disabled={pending || p.disabled}
      onClick={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
        p.onClick?.(e);
      }}
      className={cx(btn(variant, size), className)}
    >
      {pending ? <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent" aria-label="…" /> : children}
    </button>
  );
}

const globe = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
    <circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.5 2.7 3.8 5.7 3.8 9s-1.3 6.3-3.8 9c-2.5-2.7-3.8-5.7-3.8-9S9.5 5.7 12 3Z" />
  </svg>
);

/** 语言切换：pill = 带文字的胶囊；icon = 圆形图标按钮（手机顶栏用） */
export function LangSwitcher({ action, current, labels, title, variant = 'pill' }: { action: (fd: FormData) => void; current: string; labels: Record<string, string>; title: string; variant?: 'pill' | 'icon' }) {
  const ref = useRef<HTMLFormElement>(null);
  const select = (
    <select
      id={`lang-select${variant === 'icon' ? '-icon' : ''}`}
      name="lang"
      defaultValue={current}
      onChange={() => ref.current?.requestSubmit()}
      aria-label={title}
      className={variant === 'icon'
        ? 'absolute inset-0 h-full w-full cursor-pointer opacity-0'
        : 'h-11 cursor-pointer appearance-none rounded-full bg-card pl-10 pr-4 text-sm font-semibold text-ink shadow-card'}
    >
      {Object.entries(labels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
    </select>
  );
  return (
    <form ref={ref} action={action} className="relative shrink-0">
      {variant === 'icon' ? (
        <span className="relative inline-flex h-11 w-11 items-center justify-center rounded-full bg-card text-ink shadow-card">
          {globe}
          <span className="absolute -bottom-0.5 -right-0.5 rounded-full bg-ink px-1 text-[9px] font-bold uppercase leading-[14px] text-white">{current}</span>
          {select}
        </span>
      ) : (
        <>
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted">{globe}</span>
          {select}
        </>
      )}
    </form>
  );
}

/** 数量步进器：灰色 −，黑色 + */
export function QtyInput({ name, defaultValue = 1, min = 0, max, step = 1, size = 'md' }: { name: string; defaultValue?: number; min?: number; max?: number; step?: number; size?: 'sm' | 'md' }) {
  const [v, setV] = useState(defaultValue);
  const clamp = (n: number) => Math.max(min, max != null ? Math.min(max, n) : n);
  const s = size === 'sm' ? 'h-8 w-8' : 'h-10 w-10';
  return (
    <div className="inline-flex items-center gap-1">
      <button type="button" aria-label="−" disabled={v <= min} onClick={() => setV((x) => clamp(x - step))}
        className={cx(s, 'flex items-center justify-center rounded-full bg-fill text-ink transition active:scale-90 disabled:opacity-35')}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M5 12h14" /></svg>
      </button>
      <input name={name} inputMode="numeric" value={v} aria-label="qty"
        onChange={(e) => setV(clamp(parseInt(e.target.value || '0', 10) || 0))}
        className="w-10 bg-transparent text-center text-lg font-bold num outline-none" />
      <button type="button" aria-label="+" disabled={max != null && v >= max} onClick={() => setV((x) => clamp(x + step))}
        className={cx(s, 'flex items-center justify-center rounded-full bg-ink text-white transition active:scale-90 disabled:opacity-35')}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
      </button>
    </div>
  );
}

/** 管理员登记付款：勾选订单时自动计算金额 */
export function PaymentForm({
  action, customerId, receivables, months, labels, today,
}: {
  action: (fd: FormData) => void;
  customerId: string;
  today: string;
  receivables: { id: string; label: string; due: number; sub: string }[];
  months: { month: string; label: string; due: number }[];
  labels: Record<string, string>;
}) {
  const [mode, setMode] = useState<'auto' | 'selected' | 'month'>('auto');
  const [picked, setPicked] = useState<string[]>([]);
  const [month, setMonth] = useState(months[0]?.month ?? '');
  const [amount, setAmount] = useState('');
  const sumPicked = (ids: string[]) => receivables.filter((r) => ids.includes(r.id)).reduce((s, r) => s + r.due, 0);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="customer_id" value={customerId} />
      <input type="hidden" name="mode" value={mode} />
      {mode === 'selected' && picked.map((id) => <input key={id} type="hidden" name="receivable_ids" value={id} />)}
      {mode === 'month' && <input type="hidden" name="month" value={month} />}

      <fieldset>
        <legend className="mb-2 text-sm font-semibold text-ink/80">{labels.mode}</legend>
        <div className="grid grid-cols-3 gap-1 rounded-full bg-fill p-1">
          {(['auto', 'selected', 'month'] as const).map((m) => (
            <button key={m} type="button"
              onClick={() => {
                setMode(m);
                if (m === 'month' && month) setAmount(String(months.find((x) => x.month === month)?.due ?? ''));
                if (m === 'selected') setAmount(picked.length ? String(sumPicked(picked)) : '');
              }}
              className={cx('h-10 truncate rounded-full px-2 text-[13px] font-semibold transition', mode === m ? 'bg-card text-ink shadow-card' : 'text-muted')}>
              {labels[m]}
            </button>
          ))}
        </div>
      </fieldset>

      {mode === 'selected' && (
        <div className="max-h-72 overflow-y-auto rounded-2xl bg-fill p-1">
          <p className="px-3 py-2 text-xs text-muted">{labels.selectHint}</p>
          {receivables.length === 0 && <p className="px-3 py-4 text-sm text-muted">{labels.none}</p>}
          {receivables.map((r) => (
            <label key={r.id} className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-3 text-sm has-[:checked]:bg-card has-[:checked]:shadow-card">
              <input type="checkbox" className="h-5 w-5 accent-[#5b4bf5]" checked={picked.includes(r.id)}
                onChange={(e) => {
                  const next = e.target.checked ? [...picked, r.id] : picked.filter((x) => x !== r.id);
                  setPicked(next);
                  setAmount(next.length ? String(sumPicked(next)) : '');
                }} />
              <span className="min-w-0 flex-1">
                <span className="block font-semibold num">{r.label}</span>
                <span className="block truncate text-xs text-muted">{r.sub}</span>
              </span>
              <span className="font-bold num">¥{r.due.toLocaleString('ja-JP')}</span>
            </label>
          ))}
        </div>
      )}

      {mode === 'month' && (
        <select className="field" value={month}
          onChange={(e) => { setMonth(e.target.value); setAmount(String(months.find((x) => x.month === e.target.value)?.due ?? '')); }}>
          {months.map((m) => <option key={m.month} value={m.month}>{m.label} — ¥{m.due.toLocaleString('ja-JP')}</option>)}
        </select>
      )}

      <label className="block">
        <span className="mb-2 block text-sm font-semibold text-ink/80">{labels.amount}</span>
        <div className="relative">
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-xl font-bold text-faint">¥</span>
          <input name="amount" required inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ''))}
            className="field pl-10! text-2xl! font-extrabold num" />
        </div>
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-ink/80">{labels.paidOn}</span>
          <input name="paid_on" type="date" defaultValue={today} className="field" />
        </label>
        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-ink/80">{labels.method}</span>
          <select name="method" className="field" defaultValue="bank">
            <option value="bank">{labels.bank}</option>
            <option value="cash">{labels.cash}</option>
            <option value="other">{labels.other}</option>
            <option value="adjustment">{labels.adjustment}</option>
          </select>
        </label>
      </div>
      <label className="block">
        <span className="mb-2 block text-sm font-semibold text-ink/80">{labels.note}</span>
        <input name="note" className="field" />
      </label>
      <SubmitButton size="lg" className="w-full">{labels.submit}</SubmitButton>
    </form>
  );
}

export function PrintButton({ children }: { children: ReactNode }) {
  return <button type="button" onClick={() => window.print()} className={btn('primary')}>{children}</button>;
}
