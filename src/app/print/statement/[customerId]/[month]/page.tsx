import { notFound } from 'next/navigation';
import { getSession, getT } from '@/lib/session';
import { fmtDate, fmtMonth, yen } from '@/lib/i18n';
import { DocSheet } from '@/components/doc';

// 月度请求书：列出当月每张纳品书（订单）的税率别金额
export default async function Statement({ params }: { params: Promise<{ customerId: string; month: string }> }) {
  const { customerId, month } = await params;
  if (!/^\d{4}-\d{2}$/.test(month)) notFound();
  const { supabase } = await getSession();
  const { t, locale } = await getT();
  const [{ data: c }, { data: s }, { data: recs }] = await Promise.all([
    supabase.from('customers').select('company_name, postal_code, address, invoice_reg_no').eq('id', customerId).maybeSingle(),
    supabase.from('settings').select('*').eq('id', 1).single(),
    supabase.from('receivables').select('*, orders(order_no, shipped_at, subtotal_8, subtotal_10, tax_8, tax_10, total)')
      .eq('customer_id', customerId).eq('billing_month', month).order('created_at'),
  ]);
  if (!c || !s || !recs) notFound();
  const sum = (k: 'subtotal_8' | 'subtotal_10' | 'tax_8' | 'tax_10' | 'total') => recs.reduce((a, r) => a + Number(r.orders?.[k] ?? 0), 0);
  const paid = recs.reduce((a, r) => a + Number(r.paid_amount), 0);
  const due = recs[0]?.due_date;
  const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Tokyo' }).format(new Date());
  return (
    <DocSheet t={t} title={t.print.statement} s={s} c={c}
      meta={[[t.print.issueDate, fmtDate(today, locale)], [t.print.period, fmtMonth(month, locale)], [t.print.due, fmtDate(due, locale)]]}>
      <div className="mb-6 flex items-end justify-between rounded bg-paper px-4 py-3 print:border print:border-ink">
        <span className="text-sm">{t.print.balance}</span>
        <span className="text-2xl font-semibold num">{yen(sum('total') - paid)}</span>
      </div>
      <div className="-mx-1 overflow-x-auto px-1 print:overflow-visible"><table className="tbl min-w-[30rem]">
        <thead><tr>
          <th>{t.print.shipDate}</th><th>{t.print.orderNo}</th><th className="r">{t.common.tax8}</th><th className="r">{t.common.tax} 8%</th>
          <th className="r">{t.common.tax10}</th><th className="r">{t.common.tax} 10%</th><th className="r">{t.common.total}</th>
        </tr></thead>
        <tbody>
          {recs.map((r) => (
            <tr key={r.id}>
              <td className="num">{fmtDate(r.orders?.shipped_at, locale)}</td><td className="num">{r.orders?.order_no}</td>
              <td className="r">{yen(r.orders?.subtotal_8)}</td><td className="r">{yen(r.orders?.tax_8)}</td>
              <td className="r">{yen(r.orders?.subtotal_10)}</td><td className="r">{yen(r.orders?.tax_10)}</td>
              <td className="r">{yen(r.orders?.total)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot className="font-semibold">
          <tr>
            <td colSpan={2}>{t.common.total}</td>
            <td className="r">{yen(sum('subtotal_8'))}</td><td className="r">{yen(sum('tax_8'))}</td>
            <td className="r">{yen(sum('subtotal_10'))}</td><td className="r">{yen(sum('tax_10'))}</td>
            <td className="r">{yen(sum('total'))}</td>
          </tr>
          <tr><td colSpan={6} className="r font-normal text-muted">{t.print.paid}</td><td className="r">−{yen(paid)}</td></tr>
          <tr><td colSpan={6} className="r">{t.print.balance}</td><td className="r text-base">{yen(sum('total') - paid)}</td></tr>
        </tfoot>
      </table></div>
      <p className="mt-2 text-xs text-muted">{t.common.reduced}</p>
    </DocSheet>
  );
}
