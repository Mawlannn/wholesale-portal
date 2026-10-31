import { notFound } from 'next/navigation';
import { getSession, getT } from '@/lib/session';
import { fmtDate } from '@/lib/i18n';
import { DocSheet } from '@/components/doc';
import { PrintItems } from '@/components/doc';

// 纳品书 = 每张订单的适格请求书（税率别合计、每个税率端数处理一次）
export default async function DeliveryNote({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await getSession();
  const { t, locale } = await getT();
  const [{ data: o }, { data: s }] = await Promise.all([
    supabase.from('orders').select('*, order_items(*), customers(company_name, postal_code, address, invoice_reg_no)').eq('id', id).maybeSingle(),
    supabase.from('settings').select('*').eq('id', 1).single(),
  ]);
  if (!o || !s) notFound();
  const { data: rec } = await supabase.from('receivables').select('due_date').eq('order_id', id).maybeSingle();
  return (
    <DocSheet t={t} title={t.print.delivery} s={s} c={o.customers}
      meta={[[t.print.orderNo, o.order_no], [t.print.shipDate, fmtDate(o.shipped_at ?? o.created_at, locale)], ...(rec ? [[t.print.due, fmtDate(rec.due_date, locale)] as [string, string]] : [])]}>
      <div className="mb-3 text-xs">{t.orders.shipTo}: {o.ship_label} 〒{o.ship_postal_code} {o.ship_address}</div>
      <PrintItems t={t} locale={locale} order={o} items={o.order_items} />
    </DocSheet>
  );
}
