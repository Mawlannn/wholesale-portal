import { requireCustomer, getT } from '@/lib/session';
import { yen } from '@/lib/i18n';
import { Card, Empty, PageHeader, Stat } from '@/components/ui';
import { ReceivablesTable, PaymentsTable, MonthlyTable, MonthBars } from '@/components/ledger';
import { Icons } from '@/components/brand';

export default async function Account() {
  const { supabase, customer, profile } = await requireCustomer();
  const { t, locale } = await getT();
  if (profile.member_role !== 'owner') return <Empty>{t.account.staffHidden}</Empty>;
  const [{ data: pos }, { data: months }, { data: recs }, { data: pays }, { data: settings }] = await Promise.all([
    supabase.rpc('customer_position', { p_customer_id: customer.id }).single<{ outstanding: number; overdue: number; credit: number; exposure: number }>(),
    supabase.from('monthly_summary').select('*').eq('customer_id', customer.id).order('billing_month', { ascending: false }),
    supabase.from('receivables').select('*, orders(order_no, shipped_at)').eq('customer_id', customer.id).neq('status', 'paid').order('due_date'),
    supabase.from('payments').select('*, payment_allocations(amount, receivables(orders(order_no)))').eq('customer_id', customer.id).order('paid_on', { ascending: false }).limit(100),
    supabase.from('settings').select('bank_info').eq('id', 1).single(),
  ]);
  const limit = customer.credit_limit != null ? Number(customer.credit_limit) : null;
  const exposure = Number(pos?.exposure ?? 0);

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title={t.account.title} />

      <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        {/* 欠款卡 */}
        <section className="relative overflow-hidden rounded-[28px] bg-ink p-6 text-white">
          <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-20 h-60 w-60 rounded-full bg-harbor opacity-60 blur-3xl" />
          <div className="relative flex items-center justify-between">
            <span className="text-sm font-semibold text-white/70">{t.account.outstanding}</span>
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10">{Icons.yen}</span>
          </div>
          <div className="relative mt-3 text-[2.6rem] font-extrabold leading-none tracking-tight num">{yen(pos?.outstanding)}</div>
          <div className="relative mt-5 flex flex-wrap gap-2 text-xs font-semibold">
            <span className={`rounded-full px-3 py-1.5 ${Number(pos?.overdue) > 0 ? 'bg-danger text-white' : 'bg-white/10'}`}>{t.account.overdue} {yen(pos?.overdue)}</span>
            <span className="rounded-full bg-white/10 px-3 py-1.5">{t.account.credit} {yen(pos?.credit)}</span>
          </div>
          {limit != null && (
            <div className="relative mt-5">
              <div className="mb-2 flex justify-between gap-2 text-xs font-semibold text-white/70 num">
                <span>{t.account.limitUsed} {yen(exposure)}</span><span>{yen(limit)}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-white/15"><div className="h-full rounded-full bg-white" style={{ width: `${Math.min(100, (exposure / Math.max(limit, 1)) * 100)}%` }} /></div>
            </div>
          )}
        </section>

        <div className="grid grid-cols-2 gap-4">
          <Stat label={t.account.creditLeft} icon={Icons.chart}
            value={limit == null ? t.account.unlimited : yen(Math.max(0, limit - exposure))} />
          <Stat label={t.account.unpaidOrders} icon={Icons.file} value={recs?.length ?? 0} tone={recs?.length ? 'white' : 'white'} />
          {settings?.bank_info && (
            <div className="col-span-2 rounded-[24px] bg-card p-5 shadow-card">
              <div className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-muted">{Icons.warehouse}{t.account.bankInfo}</div>
              <p className="whitespace-pre-wrap font-semibold">{settings.bank_info}</p>
            </div>
          )}
        </div>
      </div>

      {!!months?.length && (
        <Card title={t.account.billed} className="mt-4">
          <MonthBars rows={[...months].slice(0, 6).reverse()} locale={locale} />
        </Card>
      )}

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card title={t.account.unpaidOrders} pad={false}>
          {recs?.length ? <ReceivablesTable t={t} locale={locale} rows={recs} link={(r) => `/shop/orders/${r.order_id}`} />
            : <p className="px-5 pb-4 text-sm font-semibold text-ok">{t.account.allPaid}</p>}
        </Card>
        <Card title={t.account.payments} pad={false}>
          <PaymentsTable t={t} locale={locale} rows={pays ?? []} />
        </Card>
        <Card title={t.account.monthly} pad={false} className="lg:col-span-2">
          <MonthlyTable t={t} locale={locale} rows={months ?? []} statementHref={(m) => `/print/statement/${customer.id}/${m}`} />
        </Card>
      </div>
    </div>
  );
}
