import { requireAdmin, getT } from '@/lib/session';
import { readFlash } from '@/lib/flash';
import { fmt, fmtDate } from '@/lib/i18n';
import { sendRecall } from '@/lib/actions/admin';
import { Avatar, Card, Empty, Field, Flash, List, PageHeader, Row, Textarea } from '@/components/ui';
import { SubmitButton } from '@/components/client';
import { SearchBar } from '@/components/search';
import { Icons } from '@/components/brand';

type R = { lot_no: string; sku: string; product_name: string; expiry_date: string | null; order_no: string; shipped_at: string; qty: number;
  customer_id: string; company_name: string; contact_name: string | null; phone: string | null; email: string | null; ship_address: string };

export default async function Recall({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const { supabase } = await requireAdmin();
  const { t, locale } = await getT();
  const a = t.admin.recall;
  const lot = (sp.lot ?? '').trim();
  const { data } = lot ? await supabase.rpc('recall_lookup', { p_lot_no: lot }) : { data: null };
  const rows = (data ?? []) as R[];
  const flash = readFlash(t, sp);
  if (flash.ok && sp.sent) flash.ok = fmt(flash.ok, { n: sp.sent });
  const customers = new Set(rows.map((r) => r.customer_id)).size;
  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title={a.title} sub={a.intro} />
      <Flash {...flash} />
      <SearchBar placeholder={a.lotNo} value={lot} label={a.lotNo} name="lot" />
      {lot && (!rows.length ? <Empty icon={Icons.search}>{a.none}</Empty> : (
        <div className="grid gap-4 xl:grid-cols-[1fr_24rem] xl:gap-6">
          <div>
            <h2 className="mb-3 px-1 text-[1.15rem] font-bold tracking-tight">{fmt(a.results, { n: rows.length })}</h2>
            <List>
              {rows.map((r, i) => (
                <Row key={i} href={`/admin/customers/${r.customer_id}`} lead={<Avatar name={r.company_name} />}
                  title={r.company_name}
                  sub={<><span className="num">{r.order_no}</span><span className="num">{fmtDate(r.shipped_at, locale)}</span><span className="num">{r.phone}</span></>}
                  end={fmt(t.common.casesN, { n: r.qty })}
                  endSub={<span className="text-xs text-muted num">{r.sku}</span>} />
              ))}
            </List>
          </div>
          <Card title={`${a.notify} (${customers})`} className="h-fit">
            <form action={sendRecall} className="space-y-3">
              <input type="hidden" name="lot" value={lot} />
              <Field label={a.message}><Textarea name="message" rows={6} placeholder={a.messagePlaceholder} required /></Field>
              <SubmitButton variant="danger" size="lg" className="w-full" confirm={t.common.confirmAction}>{Icons.mail}{a.send}</SubmitButton>
            </form>
          </Card>
        </div>
      ))}
    </div>
  );
}
