import { requireAdmin, getT } from '@/lib/session';
import { readFlash } from '@/lib/flash';
import { Card, Flash, PageHeader } from '@/components/ui';
import { ProductForm } from '@/components/product-form';

export default async function NewProduct({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const { supabase } = await requireAdmin();
  const { t } = await getT();
  const { data } = await supabase.from('products').select('category');
  const cats = [...new Set((data ?? []).map((r) => r.category).filter(Boolean))] as string[];
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader back="/admin/products" title={t.admin.products.new} />
      <Flash {...readFlash(t, await searchParams)} />
      <Card><ProductForm t={t} categories={cats} /></Card>
    </div>
  );
}
