import { requireAdmin, getT } from '@/lib/session';
import { fmt, productName, yen } from '@/lib/i18n';
import { Icons, ProductArt } from '@/components/brand';
import { Badge, Empty, LinkButton, List, PageHeader, Row } from '@/components/ui';
import { SearchBar } from '@/components/search';

export default async function Products({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const { supabase } = await requireAdmin();
  const { t, locale } = await getT();
  const [{ data: products }, { data: stock }] = await Promise.all([
    supabase.from('products').select('*').order('category', { nullsFirst: false }).order('sku'),
    supabase.from('product_stock').select('*'),
  ]);
  const st = new Map((stock ?? []).map((s) => [s.product_id, s]));
  const term = (sp.q ?? '').toLowerCase();
  const list = (products ?? []).filter((p) => !term || [p.sku, p.name_ja, p.name_zh, p.name_en, p.brand, p.category].some((v) => v?.toLowerCase().includes(term)));
  const a = t.admin.products;
  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title={a.title} sub={`${list.length} SKU`}
        actions={<LinkButton href="/admin/products/new" size="sm">{Icons.plus}{a.new}</LinkButton>} />
      <SearchBar placeholder={t.shop.search} value={sp.q} label={t.common.search} />
      {!list.length ? <Empty>{t.common.noData}</Empty> : (
        <List>
          {list.map((p) => {
            const s = st.get(p.id) ?? { on_hand: 0, reserved: 0, available: 0 };
            const low = s.available <= p.low_stock_threshold;
            return (
              <Row key={p.id} href={`/admin/products/${p.id}`}
                lead={<ProductArt sku={p.sku} name={productName(p, locale)} category={p.category} brand={p.brand} image={p.image_url} className={`h-14 w-14 rounded-2xl ${p.is_active ? '' : 'opacity-50 grayscale'}`} />}
                title={productName(p, locale)}
                sub={<>
                  <span className="num">{p.sku}</span>
                  <span>{yen(p.price_per_case)} · {p.tax_rate}%</span>
                  {!p.is_active && <Badge>{a.inactive}</Badge>}
                </>}
                end={<span className={low ? 'text-danger' : ''}>{fmt(t.common.casesN, { n: s.available })}</span>}
                endSub={<span className="text-xs text-muted num">{a.onHand} {s.on_hand}{s.reserved ? ` · ${a.reserved} ${s.reserved}` : ''}</span>} />
            );
          })}
        </List>
      )}
    </div>
  );
}
