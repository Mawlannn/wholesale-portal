import { requireAdmin, getT } from '@/lib/session';
import { readFlash } from '@/lib/flash';
import { fmt, fmtDate, productName, yen } from '@/lib/i18n';
import { receiveLot } from '@/lib/actions/admin';
import { Card, Field, Flash, Input, List, PageHeader, Row, Select } from '@/components/ui';
import { SubmitButton } from '@/components/client';
import { Icons, ProductArt } from '@/components/brand';

export default async function Inbound({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const { supabase } = await requireAdmin();
  const { t, locale } = await getT();
  const [{ data: products }, { data: recent }] = await Promise.all([
    supabase.from('products').select('id, sku, name_ja, name_zh, name_en').order('sku'),
    supabase.from('lots').select('*, products(sku, name_ja, name_zh, name_en, category, brand, image_url)').order('created_at', { ascending: false }).limit(30),
  ]);
  const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Tokyo' }).format(new Date());
  const a = t.admin.inbound;
  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title={a.title} />
      <Flash {...readFlash(t, sp)} />
      <div className="grid gap-4 xl:grid-cols-[26rem_1fr] xl:gap-6">
        <Card>
          <form action={receiveLot} className="space-y-4">
            <Field label={a.product}>
              <Select name="product_id" required defaultValue={sp.product ?? ''}>
                <option value="" disabled>{a.selectProduct}</option>
                {(products ?? []).map((p) => <option key={p.id} value={p.id}>{p.sku} — {productName(p, locale)}</option>)}
              </Select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label={a.qty}><Input name="qty" inputMode="numeric" required className="text-xl! font-bold" /></Field>
              <Field label={a.expiry}><Input name="expiry" type="date" /></Field>
            </div>
            <Field label={a.lotNo} hint={a.lotHint}><Input name="lot_no" /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label={a.unitCost}><Input name="unit_cost" inputMode="decimal" /></Field>
              <Field label={a.receivedAt}><Input name="received_at" type="date" defaultValue={today} /></Field>
            </div>
            <Field label={t.common.note}><Input name="note" /></Field>
            <SubmitButton size="lg" className="w-full">{Icons.truck}{a.submit}</SubmitButton>
          </form>
        </Card>
        <div>
          <h2 className="mb-3 px-1 text-[1.15rem] font-bold tracking-tight">{a.recent}</h2>
          <List>
            {(recent ?? []).map((l) => (
              <Row key={l.id}
                lead={<ProductArt sku={l.products.sku} name={productName(l.products, locale)} category={l.products.category} brand={l.products.brand} image={l.products.image_url} className="h-12 w-12 rounded-2xl" />}
                title={productName(l.products, locale)}
                sub={<><span className="num">{l.lot_no}</span><span className="num">{t.admin.inbound.expiry} {fmtDate(l.expiry_date, locale)}</span></>}
                end={<span className="text-ok">+{fmt(t.common.casesN, { n: l.qty_received })}</span>}
                endSub={<span className="text-xs text-muted num">{fmtDate(l.received_at, locale)}{l.unit_cost != null && ` · ${yen(l.unit_cost)}`}</span>} />
            ))}
          </List>
        </div>
      </div>
    </div>
  );
}
