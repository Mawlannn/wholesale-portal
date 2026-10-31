import { saveProduct } from '@/lib/actions/admin';
import type { Dict } from '@/lib/i18n';
import { Field, Input, Select, Textarea } from './ui';
import { SubmitButton } from './client';

type P = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

export function ProductForm({ t, p, categories }: { t: Dict; p?: P; categories: string[] }) {
  const a = t.admin.products;
  return (
    <form action={saveProduct} className="space-y-4">
      {p && <input type="hidden" name="id" value={p.id} />}
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label={<>{t.common.sku} <span className="text-danger">*</span></>}><Input name="sku" defaultValue={p?.sku} required /></Field>
        <Field label={a.category}>
          <Input name="category" defaultValue={p?.category ?? ''} list="cats" />
          <datalist id="cats">{categories.map((c) => <option key={c} value={c} />)}</datalist>
        </Field>
        <Field label={a.brand}><Input name="brand" defaultValue={p?.brand ?? ''} /></Field>
      </div>
      <Field label={<>{a.nameJa} <span className="text-danger">*</span></>}><Input name="name_ja" defaultValue={p?.name_ja} required /></Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={a.nameZh}><Input name="name_zh" defaultValue={p?.name_zh ?? ''} /></Field>
        <Field label={a.nameEn}><Input name="name_en" defaultValue={p?.name_en ?? ''} /></Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-4">
        <Field label={<>{a.price} <span className="text-danger">*</span></>}><Input name="price_per_case" inputMode="numeric" defaultValue={p?.price_per_case} required /></Field>
        <Field label={a.taxRate}>
          <Select name="tax_rate" defaultValue={String(p?.tax_rate ?? 8)}>
            <option value="8">{a.tax8}</option>
            <option value="10">{a.tax10}</option>
          </Select>
        </Field>
        <Field label={a.unitPerCase}><Input name="unit_per_case" inputMode="numeric" defaultValue={p?.unit_per_case ?? 1} /></Field>
        <Field label={a.origin}><Input name="origin_country" defaultValue={p?.origin_country ?? ''} /></Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label={a.minQty}><Input name="min_order_qty" inputMode="numeric" defaultValue={p?.min_order_qty ?? 1} /></Field>
        <Field label={a.lowThreshold}><Input name="low_stock_threshold" inputMode="numeric" defaultValue={p?.low_stock_threshold ?? 0} /></Field>
        <Field label={t.common.status}>
          <Select name="is_active" defaultValue={p?.is_active === false ? '0' : '1'}>
            <option value="1">{a.active}</option>
            <option value="0">{a.inactive}</option>
          </Select>
        </Field>
      </div>
      <Field label={a.description}><Textarea name="description" defaultValue={p?.description ?? ''} /></Field>
      <Field label={a.image}>
        <div className="flex items-center gap-4">
          {p?.image_url && <img src={p.image_url} alt="" className="h-16 w-16 rounded-2xl object-cover" />}
          <input type="file" name="image" accept="image/*" className="text-sm file:mr-3 file:h-10 file:rounded-full file:border-0 file:bg-ink file:px-4 file:font-semibold file:text-white" />
        </div>
      </Field>
      <SubmitButton size="lg" className="w-full sm:w-auto">{t.common.save}</SubmitButton>
    </form>
  );
}
