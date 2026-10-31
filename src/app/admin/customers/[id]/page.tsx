import { notFound } from 'next/navigation';
import { requireAdmin, getT } from '@/lib/session';
import { readFlash } from '@/lib/flash';
import { fmt, fmtDate, fmtDateTime, fmtMonth, yen } from '@/lib/i18n';
import { recordPayment, saveCustomerTerms, setCustomerStatus, voidPayment } from '@/lib/actions/admin';
import { Avatar, Badge, Card, Field, Flash, IconLink, Input, KV, List, OrderStatus, Row, Textarea } from '@/components/ui';
import { PaymentForm, SubmitButton } from '@/components/client';
import { MonthlyTable, PaymentsTable, ReceivablesTable } from '@/components/ledger';
import { Icons } from '@/components/brand';

export default async function CustomerDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string>> }) {
  const { id } = await params;
  const sp = await searchParams;
  const { supabase } = await requireAdmin();
  const { t, locale } = await getT();
  const a = t.admin.customers;
  const [{ data: c }, { data: pos }, { data: months }, { data: recs }, { data: pays }, { data: orders }, { data: s }] = await Promise.all([
    supabase.from('customers').select('*').eq('id', id).maybeSingle(),
    supabase.rpc('customer_position', { p_customer_id: id }).single<{ outstanding: number; overdue: number; credit: number; open_orders: number; exposure: number }>(),
    supabase.from('monthly_summary').select('*').eq('customer_id', id).order('billing_month', { ascending: false }),
    supabase.from('receivables').select('*, orders(order_no, shipped_at)').eq('customer_id', id).order('due_date', { ascending: false }).limit(200),
    supabase.from('payments').select('*, payment_allocations(amount, receivables(orders(order_no)))').eq('customer_id', id).order('paid_on', { ascending: false }).limit(200),
    supabase.from('orders').select('id, order_no, status, cancel_requested, total, created_at').eq('customer_id', id).order('created_at', { ascending: false }).limit(50),
    supabase.from('settings').select('default_payment_terms_days').eq('id', 1).single(),
  ]);
  if (!c) notFound();
  const unpaid = (recs ?? []).filter((r) => r.status !== 'paid').sort((x, y) => x.due_date.localeCompare(y.due_date));
  const openMonths = (months ?? []).filter((m) => Number(m.outstanding) > 0);
  const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Tokyo' }).format(new Date());
  const limit = c.credit_limit != null ? Number(c.credit_limit) : null;
  const exposure = Number(pos?.exposure ?? 0);

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-4 flex items-center gap-3">
        <IconLink href="/admin/customers" label={a.title}>{Icons.back}</IconLink>
        <Avatar name={c.company_name} size={48} />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-extrabold tracking-tight">{c.company_name}</h1>
          <div className="mt-1"><Badge tone={c.status === 'approved' ? 'ok' : c.status === 'pending' ? 'signal' : 'neutral'}>{t.custStatus[c.status as 'pending']}</Badge></div>
        </div>
      </header>
      <Flash {...readFlash(t, sp)} />

      <div className="grid gap-4 xl:grid-cols-[1fr_26rem] xl:gap-6">
        <div className="space-y-4">
          {/* 账款卡 */}
          <section className="relative overflow-hidden rounded-[28px] bg-ink p-6 text-white">
            <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-20 h-60 w-60 rounded-full bg-harbor opacity-60 blur-3xl" />
            <div className="relative text-sm font-semibold text-white/70">{t.account.outstanding}</div>
            <div className="relative mt-2 text-[2.4rem] font-extrabold leading-none tracking-tight num">{yen(pos?.outstanding)}</div>
            <div className="relative mt-4 flex flex-wrap gap-2 text-xs font-semibold">
              <span className={`rounded-full px-3 py-1.5 ${Number(pos?.overdue) > 0 ? 'bg-danger' : 'bg-white/10'}`}>{t.account.overdue} {yen(pos?.overdue)}</span>
              <span className="rounded-full bg-white/10 px-3 py-1.5">{t.account.credit} {yen(pos?.credit)}</span>
              <span className="rounded-full bg-white/10 px-3 py-1.5">{t.account.creditLeft} {limit == null ? t.account.unlimited : yen(limit - exposure)}</span>
            </div>
            {limit != null && (
              <div className="relative mt-4 h-2 overflow-hidden rounded-full bg-white/15">
                <div className="h-full rounded-full bg-white" style={{ width: `${Math.min(100, (exposure / Math.max(limit, 1)) * 100)}%` }} />
              </div>
            )}
          </section>

          <Card title={a.receivables} pad={false}>
            {unpaid.length ? <ReceivablesTable t={t} locale={locale} rows={unpaid} link={(r) => `/admin/orders/${r.order_id}`} />
              : <p className="px-5 pb-4 text-sm font-semibold text-ok">{t.account.allPaid}</p>}
          </Card>
          <Card title={t.account.monthly} pad={false}>
            <MonthlyTable t={t} locale={locale} rows={months ?? []} statementHref={(m) => `/print/statement/${id}/${m}`} />
          </Card>
          <Card title={t.account.payments} pad={false}>
            <PaymentsTable t={t} locale={locale} rows={pays ?? []} extra={(p) => !p.is_void && (
              <details>
                <summary className="cursor-pointer text-xs font-semibold text-danger">{a.voidPayment}</summary>
                <form action={voidPayment} className="mt-2 flex gap-2">
                  <input type="hidden" name="customer_id" value={id} /><input type="hidden" name="payment_id" value={p.id} />
                  <input name="reason" required placeholder={a.voidReason} aria-label={a.voidReason} className="field h-9 flex-1 py-1! text-sm" />
                  <SubmitButton variant="danger" size="sm">{a.voidPayment}</SubmitButton>
                </form>
              </details>
            )} />
          </Card>
          <Card title={a.orders} pad={false}>
            <ul className="divide-y divide-[#f0f1f4]">
              {(orders ?? []).map((o) => (
                <Row key={o.id} href={`/admin/orders/${o.id}`} title={<span className="num">{o.order_no}</span>}
                  sub={<span className="num">{fmtDateTime(o.created_at, locale)}</span>}
                  end={yen(o.total)} endSub={<OrderStatus t={t} status={o.status} cancelRequested={o.cancel_requested} />} />
              ))}
            </ul>
          </Card>
        </div>

        <div className="space-y-4">
          <Card title={a.recordPayment}>
            <PaymentForm
              action={recordPayment}
              customerId={id}
              today={today}
              receivables={unpaid.map((r) => ({
                id: r.id, label: r.orders?.order_no ?? '', due: Number(r.amount) - Number(r.paid_amount),
                sub: `${t.account.dueDate} ${fmtDate(r.due_date, locale)}`,
              }))}
              months={openMonths.map((m) => ({ month: m.billing_month, label: fmtMonth(m.billing_month, locale), due: Number(m.outstanding) }))}
              labels={{
                mode: a.mode, auto: a.modeAuto, selected: a.modeSelected, month: a.modeMonth, selectHint: a.selectHint,
                amount: t.common.amount, paidOn: a.paidOn, method: a.method, note: t.common.note, submit: a.submitPayment, none: t.common.noData,
                bank: t.pay.bank, cash: t.pay.cash, other: t.pay.other, adjustment: t.pay.adjustment,
              }}
            />
          </Card>

          <Card title={a.saveTerms}>
            <form action={saveCustomerTerms} className="space-y-4">
              <input type="hidden" name="customer_id" value={id} />
              <Field label={a.creditLimit} hint={a.creditHint}><Input name="credit_limit" inputMode="numeric" defaultValue={c.credit_limit ?? ''} /></Field>
              <Field label={a.terms} hint={fmt(a.termsHint, { n: s?.default_payment_terms_days ?? 30 })}>
                <Input name="payment_terms_days" inputMode="numeric" defaultValue={c.payment_terms_days ?? ''} /></Field>
              <Field label={t.admin.orders.adminNote}><Textarea name="admin_note" defaultValue={c.admin_note ?? ''} /></Field>
              <SubmitButton variant="secondary" className="w-full">{t.common.save}</SubmitButton>
            </form>
          </Card>

          <Card title={t.profile.company}>
            <KV items={[
              [t.reg.contact, c.contact_name ?? '—'],
              [t.reg.phone, <span key="p" className="num">{c.phone}</span>],
              [t.reg.email, c.email ?? '—'],
              [t.reg.address, `〒${c.postal_code ?? ''} ${c.address ?? ''}`],
              [t.reg.invoiceNo, <span key="i" className="num">{c.invoice_reg_no || '—'}</span>],
              [a.registered, fmtDate(c.created_at, locale)],
              ...(c.note ? [[t.common.note, c.note] as [string, string]] : []),
            ]} />
          </Card>

          {c.status !== 'approved' ? (
            <form action={setCustomerStatus}><input type="hidden" name="customer_id" value={c.id} /><input type="hidden" name="status" value="approved" />
              <SubmitButton size="lg" className="w-full">{Icons.check}{c.status === 'pending' ? a.approve : a.reactivate}</SubmitButton></form>
          ) : (
            <form action={setCustomerStatus}><input type="hidden" name="customer_id" value={c.id} /><input type="hidden" name="status" value="suspended" />
              <SubmitButton size="lg" variant="danger" className="w-full" confirm={t.common.confirmAction}>{a.suspend}</SubmitButton></form>
          )}
        </div>
      </div>
    </div>
  );
}
