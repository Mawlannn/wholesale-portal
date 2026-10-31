import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { requireCustomer, getT } from '@/lib/session';
import { readFlash } from '@/lib/flash';
import { fmt, productName, yen } from '@/lib/i18n';
import { updateOrder } from '@/lib/actions/shop';
import { Card, Field, Flash, Input, PageHeader, Textarea } from '@/components/ui';
import { QtyInput, SubmitButton } from '@/components/client';
import { ProductArt } from '@/components/brand';

export default async function EditOrder({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string>> }) {
  const { id } = await params;
  const sp = await searchParams;
  const { supabase } = await requireCustomer();
  const { t, locale } = await getT();
  const { data: o } = await supabase.from('orders').select('*, order_items(*)').eq('id', id).maybeSingle();
  if (!o) notFound();
  if (o.status !== 'pending') redirect(`/shop/orders/${id}`);
  // 可用库存 = 目录可售 + 这张订单自己锁定的数量
  const avail = new Map<string, number>();
  for (const i of o.order_items) {
    const { data } = await supabase.rpc('stock_available', { p_product_id: i.product_id, p_exclude_order: id });
    avail.set(i.product_id, Number(data ?? 0));
  }
  const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Tokyo' }).format(new Date());

  return (
    <>
      <PageHeader back={`/shop/orders/${id}`} title={t.orders.edit} sub={<span className="num">{o.order_no} · {t.orders.pendingHint}</span>} />
      <Flash {...readFlash(t, sp)} />
      <form action={updateOrder} className="grid gap-4 lg:grid-cols-[1fr_22rem] lg:gap-6">
        <input type="hidden" name="order_id" value={id} />
        <ul className="space-y-3">
          {o.order_items.map((i: { id: string; product_id: string; sku: string; name_ja: string; name_zh: string | null; name_en: string | null; qty_cases: number; unit_price: number }) => (
            <li key={i.id} className="flex flex-wrap items-center gap-3.5 rounded-[26px] bg-card p-3 shadow-card">
              <input type="hidden" name="product_id" value={i.product_id} />
              <ProductArt sku={i.sku} name={productName(i, locale)} className="h-16 w-16 shrink-0 rounded-[18px]" />
              <div className="min-w-0 flex-1 basis-40">
                <div className="truncate font-semibold">{productName(i, locale)}</div>
                <div className="text-xs text-muted num">{yen(i.unit_price)} · {fmt(t.shop.available, { n: avail.get(i.product_id) ?? 0 })}</div>
              </div>
              <QtyInput name="qty" defaultValue={i.qty_cases} min={0} max={avail.get(i.product_id)} size="sm" />
            </li>
          ))}
        </ul>
        <Card>
          <div className="space-y-4">
            <Field label={t.cart.deliveryDate}><Input type="date" name="delivery_date" min={today} defaultValue={o.delivery_date ?? ''} /></Field>
            <Field label={t.cart.note}><Textarea name="note" defaultValue={o.note ?? ''} /></Field>
            <SubmitButton className="w-full" size="lg">{t.orders.saveChanges}</SubmitButton>
          </div>
        </Card>
      </form>
    </>
  );
}
