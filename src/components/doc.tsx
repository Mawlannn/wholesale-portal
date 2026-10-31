import type { ReactNode } from 'react';
import { PrintButton } from './client';
import type { Dict } from '@/lib/i18n';

type Settings = { company_name: string; company_address: string; company_phone: string; company_email: string; invoice_reg_no: string; bank_info: string };
type Cust = { company_name: string; postal_code: string | null; address: string | null; invoice_reg_no: string | null };

/** A4 单据外框：标题、收件方、开票方（含登记号码） */
export function DocSheet({ t, title, s, c, meta, children }: { t: Dict; title: string; s: Settings; c: Cust; meta: [string, ReactNode][]; children: ReactNode }) {
  return (
    <>
      <div className="no-print mx-auto mb-4 flex max-w-[210mm] justify-end px-4"><PrintButton>{t.common.print}</PrintButton></div>
      <article className="mx-auto max-w-[210mm] bg-white p-10 text-[13px] shadow-sm print:p-0 print:shadow-none">
        <header className="mb-8 flex items-start justify-between border-b-2 border-ink pb-3">
          <h1 className="text-2xl font-semibold tracking-wide">{title}</h1>
          <dl className="text-right text-xs leading-6">
            {meta.map(([k, v]) => <div key={k}><dt className="inline text-muted">{k}: </dt><dd className="inline num">{v}</dd></div>)}
          </dl>
        </header>
        <div className="mb-8 grid grid-cols-2 gap-8">
          <div>
            <div className="text-xs text-muted">{t.print.billTo}</div>
            <div className="mt-1 border-b border-ink pb-1 text-lg font-semibold">{c.company_name} {t.print.honorific}</div>
            <div className="mt-1 text-xs">〒{c.postal_code} {c.address}</div>
          </div>
          <div className="text-right text-xs leading-5">
            <div className="text-xs text-muted">{t.print.issuer}</div>
            <div className="mt-1 text-base font-semibold">{s.company_name}</div>
            <div>{s.company_address}</div>
            <div>{[s.company_phone, s.company_email].filter(Boolean).join(' / ')}</div>
            {s.invoice_reg_no && <div className="mt-1 font-medium">{t.print.regNo}: <span className="num">{s.invoice_reg_no}</span></div>}
          </div>
        </div>
        {children}
        {s.bank_info && (
          <div className="mt-8 rounded border border-line p-3 text-xs">
            <div className="mb-1 font-medium">{t.print.bank}</div>
            <div className="whitespace-pre-wrap">{s.bank_info}</div>
          </div>
        )}
        <p className="mt-6 text-xs text-muted">{t.print.thanks}</p>
      </article>
    </>
  );
}

type PItem = { id: string; sku: string; name_ja: string; name_zh: string | null; name_en: string | null; qty_cases: number; unit_price: number; tax_rate: number; line_total: number; unit_per_case: number };
type PTotals = { subtotal_8: number; subtotal_10: number; tax_8: number; tax_10: number; total: number };

/** 单据用的明细表（打印格式） */
export function PrintItems({ t, locale, order, items }: { t: Dict; locale: import('@/lib/i18n').Locale; order: PTotals; items: PItem[] }) {
  const name = (i: PItem) => (locale === 'zh' && i.name_zh) || (locale === 'en' && i.name_en) || i.name_ja;
  const y = (n: number) => '¥' + Math.round(Number(n)).toLocaleString('ja-JP');
  return (
    <div className="-mx-1 overflow-x-auto px-1 print:overflow-visible"><table className="tbl min-w-[30rem]">
      <thead><tr><th>{t.common.sku}</th><th>{t.common.name}</th><th className="r">{t.common.qty}</th><th className="r">{t.common.price}</th><th className="r">{t.common.amount}</th></tr></thead>
      <tbody>
        {items.map((i) => (
          <tr key={i.id}>
            <td className="num">{i.sku}</td><td>{name(i)}{i.tax_rate === 8 && ' ※'}</td>
            <td className="r">{i.qty_cases}</td><td className="r">{y(i.unit_price)}</td><td className="r">{y(i.line_total)}</td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        {Number(order.subtotal_8) > 0 && <tr><td colSpan={4} className="r">{t.common.tax8} {y(order.subtotal_8)}　{t.common.tax}</td><td className="r">{y(order.tax_8)}</td></tr>}
        {Number(order.subtotal_10) > 0 && <tr><td colSpan={4} className="r">{t.common.tax10} {y(order.subtotal_10)}　{t.common.tax}</td><td className="r">{y(order.tax_10)}</td></tr>}
        <tr><td colSpan={4} className="r font-bold">{t.common.grandTotal}</td><td className="r text-base font-bold">{y(order.total)}</td></tr>
        <tr><td colSpan={5} className="text-xs">{t.common.reduced}</td></tr>
      </tfoot>
    </table></div>
  );
}
