import Link from 'next/link';
import type { ReactNode } from 'react';
import { fmtDate, fmtMonth, yen, type Dict, type Locale } from '@/lib/i18n';
import { Badge, Bars, PayStatus, Progress, cx } from './ui';
import { Icons } from './brand';

const todayJP = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Tokyo' }).format(new Date());

type Rec = { id: string; order_id: string; amount: number; paid_amount: number; status: string; due_date: string; billing_month: string; orders: { order_no: string; shipped_at: string | null } | null };

/** 未结清订单：每行一个订单 */
export function ReceivablesTable({ t, locale, rows, link, extra }: { t: Dict; locale: Locale; rows: Rec[]; link: (r: Rec) => string; extra?: (r: Rec) => ReactNode }) {
  const today = todayJP();
  return (
    <ul className="divide-y divide-[#f0f1f4]">
      {rows.map((r) => {
        const overdue = r.status !== 'paid' && r.due_date < today;
        const left = Number(r.amount) - Number(r.paid_amount);
        return (
          <li key={r.id} className="px-5 py-3.5">
            <div className="flex items-center gap-3">
              <span className={cx('flex h-11 w-11 shrink-0 items-center justify-center rounded-full', overdue ? 'bg-danger-soft text-danger' : 'bg-fill text-ink')}>{Icons.file}</span>
              <div className="min-w-0 flex-1">
                <Link href={link(r)} className="font-semibold num hover:underline">{r.orders?.order_no}</Link>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[0.8rem] text-muted">
                  <span className="num">{t.account.dueDate} {fmtDate(r.due_date, locale)}</span>
                  {overdue && <Badge tone="danger">{t.account.overdue}</Badge>}
                </div>
              </div>
              <div className="text-right">
                <div className="font-bold num">{yen(left)}</div>
                <div className="mt-1"><PayStatus t={t} status={r.status} /></div>
              </div>
            </div>
            {Number(r.paid_amount) > 0 && (
              <div className="mt-2.5 pl-14"><Progress value={Number(r.paid_amount)} max={Number(r.amount)} /></div>
            )}
            {extra && <div className="mt-2 pl-14">{extra(r)}</div>}
          </li>
        );
      })}
    </ul>
  );
}

type Month = { billing_month: string; order_count: number; total: number; paid: number; outstanding: number; due_date: string };

/** 按月汇总：每行一个月 */
export function MonthlyTable({ t, locale, rows, statementHref, extra }: { t: Dict; locale: Locale; rows: Month[]; statementHref: (m: string) => string; extra?: (m: Month) => ReactNode }) {
  if (!rows.length) return <p className="px-5 py-4 text-sm text-muted">{t.common.noData}</p>;
  return (
    <ul className="divide-y divide-[#f0f1f4]">
      {rows.map((m) => {
        const done = Number(m.outstanding) <= 0;
        return (
          <li key={m.billing_month} className="px-5 py-3.5">
            <div className="flex items-center gap-3">
              <span className={cx('flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-full text-[11px] font-bold leading-tight', done ? 'bg-ok-soft text-ok' : 'bg-harbor-soft text-harbor')}>
                {done ? Icons.check : m.billing_month.slice(5) + (locale === 'en' ? '' : '月')}
              </span>
              <div className="min-w-0 flex-1">
                <div className="font-semibold">{fmtMonth(m.billing_month, locale)}</div>
                <div className="mt-0.5 text-[0.8rem] text-muted num">
                  {m.order_count} · {t.account.billed} {yen(m.total)}
                </div>
              </div>
              <div className="text-right">
                <div className={cx('font-bold num', done && 'text-ok')}>{done ? t.pay.paid : yen(m.outstanding)}</div>
                <Link href={statementHref(m.billing_month)} target="_blank" className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-harbor">
                  {t.account.statement}{Icons.chevron}
                </Link>
              </div>
            </div>
            {extra && <div className="mt-2 pl-14">{extra(m)}</div>}
          </li>
        );
      })}
    </ul>
  );
}

type Pay = { id: string; paid_on: string; amount: number; method: string; note: string | null; is_void: boolean; void_reason: string | null;
  payment_allocations: { amount: number; receivables: { orders: { order_no: string } | null } | null }[] };

/** 付款记录：像银行 App 的交易明细 */
export function PaymentsTable({ t, locale, rows, extra }: { t: Dict; locale: Locale; rows: Pay[]; extra?: (p: Pay) => ReactNode }) {
  if (!rows.length) return <p className="px-5 py-4 text-sm text-muted">{t.account.noPayments}</p>;
  return (
    <ul className="divide-y divide-[#f0f1f4]">
      {rows.map((p) => (
        <li key={p.id} className={cx('px-5 py-3.5', p.is_void && 'opacity-55')}>
          <div className="flex items-center gap-3">
            <span className={cx('flex h-11 w-11 shrink-0 items-center justify-center rounded-full', p.is_void ? 'bg-fill text-faint' : 'bg-ok-soft text-ok')}>{Icons.yen}</span>
            <div className="min-w-0 flex-1">
              <div className="font-semibold">{t.pay[p.method as 'bank'] ?? p.method}</div>
              <div className="mt-0.5 truncate text-[0.8rem] text-muted num">
                {fmtDate(p.paid_on, locale)}
                {p.payment_allocations.length > 0 && <> · {p.payment_allocations.map((a) => a.receivables?.orders?.order_no).filter(Boolean).join(', ')}</>}
              </div>
              {(p.note || p.void_reason) && <div className="mt-0.5 truncate text-xs text-muted">{p.note}{p.is_void && p.void_reason && ` (${p.void_reason})`}</div>}
            </div>
            <div className="text-right">
              <div className={cx('font-bold num', p.is_void ? 'line-through' : 'text-ok')}>+{yen(p.amount)}</div>
              {p.is_void && <div className="mt-1"><Badge>{t.pay.void}</Badge></div>}
            </div>
          </div>
          {extra && <div className="mt-2 pl-14">{extra(p)}</div>}
        </li>
      ))}
    </ul>
  );
}

/** 近几个月进货额：当月高亮 */
export function MonthBars({ rows, locale }: { rows: Month[]; locale: Locale }) {
  const cur = todayJP().slice(0, 7);
  return (
    <Bars data={rows.map((r) => ({
      label: fmtMonth(r.billing_month, locale).replace(/^\d{4}年/, '').replace(/ \d{4}$/, ''),
      value: Number(r.total),
      highlight: r.billing_month === cur || (rows.length === 1),
    }))} />
  );
}
