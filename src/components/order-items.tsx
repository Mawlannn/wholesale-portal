import { fmt, productName, yen, type Dict, type Locale } from '@/lib/i18n';
import { ProductArt } from './brand';

type Item = { id: string; sku: string; name_ja: string; name_zh: string | null; name_en: string | null; qty_cases: number; unit_price: number; tax_rate: number; line_total: number; unit_per_case: number };
type Totals = { subtotal_8: number; subtotal_10: number; tax_8: number; tax_10: number; total: number };

/** 订单明细：每个商品一行 + 按税率分别计算的合计 */
export function OrderItemsTable({ t, locale, order, items }: { t: Dict; locale: Locale; order: Totals; items: Item[] }) {
  return (
    <div>
      <ul className="divide-y divide-[#f0f1f4]">
        {items.map((i) => (
          <li key={i.id} className="flex items-center gap-3.5 px-5 py-3.5">
            <ProductArt sku={i.sku} name={productName(i, locale)} className="h-14 w-14 shrink-0 rounded-2xl" />
            <div className="min-w-0 flex-1">
              <div className="truncate font-semibold">{productName(i, locale)}{i.tax_rate === 8 && <span className="text-faint"> ※</span>}</div>
              <div className="mt-0.5 text-[0.8rem] text-muted num">{i.sku} · {fmt(t.shop.perCase, { n: i.unit_per_case })}</div>
              <div className="text-[0.8rem] text-muted num">{yen(i.unit_price)} × {i.qty_cases}</div>
            </div>
            <div className="font-bold num">{yen(i.line_total)}</div>
          </li>
        ))}
      </ul>
      <div className="mx-5 mb-3 mt-1 space-y-2 rounded-2xl bg-fill p-4 text-sm num">
        {Number(order.subtotal_8) > 0 && (
          <div className="flex justify-between"><span className="text-muted">{t.common.tax8} {yen(order.subtotal_8)}</span><span>{t.common.tax} {yen(order.tax_8)}</span></div>
        )}
        {Number(order.subtotal_10) > 0 && (
          <div className="flex justify-between"><span className="text-muted">{t.common.tax10} {yen(order.subtotal_10)}</span><span>{t.common.tax} {yen(order.tax_10)}</span></div>
        )}
        <div className="flex items-baseline justify-between border-t border-dashed border-[#d9dbe1] pt-2.5">
          <span className="font-semibold">{t.common.grandTotal}</span>
          <span className="text-xl font-extrabold">{yen(order.total)}</span>
        </div>
        <div className="text-xs text-muted">{t.common.reduced}</div>
      </div>
    </div>
  );
}
