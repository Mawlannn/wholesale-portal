import Link from 'next/link';
import { requireAdmin, getT } from '@/lib/session';
import { fmtDate, yen } from '@/lib/i18n';
import { Avatar, Empty, PageHeader, Stat } from '@/components/ui';
import { Icons } from '@/components/brand';

// 账龄颜色：未到期 → 逾期越久越红
const SEG = ['#5b4bf5', '#f5b400', '#e07b00', '#e5484d'];

export default async function Receivables() {
  const { supabase } = await requireAdmin();
  const { t, locale } = await getT();
  const a = t.admin.receivables;
  const { data } = await supabase.from('customer_balances').select('*').gt('outstanding', 0).order('overdue', { ascending: false }).order('outstanding', { ascending: false });
  const rows = data ?? [];
  const sum = (k: string) => rows.reduce((s, r) => s + Number(r[k] ?? 0), 0);
  const cols = ['not_due', 'overdue_1_30', 'overdue_31_60', 'overdue_61_plus'] as const;
  const labels = [a.notDue, a.d1, a.d31, a.d61];
  const total = sum('outstanding');

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title={a.title} />

      <section className="relative mb-4 overflow-hidden rounded-[28px] bg-ink p-6 text-white">
        <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-20 h-60 w-60 rounded-full bg-harbor opacity-60 blur-3xl" />
        <div className="relative text-sm font-semibold text-white/70">{t.account.outstanding}</div>
        <div className="relative mt-2 text-[2.4rem] font-extrabold leading-none tracking-tight num">{yen(total)}</div>
        {total > 0 && (
          <div className="relative mt-5 flex h-3 overflow-hidden rounded-full bg-white/10">
            {cols.map((c, i) => <div key={c} style={{ width: `${(sum(c) / total) * 100}%`, background: SEG[i] }} />)}
          </div>
        )}
        <div className="relative mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs font-semibold text-white/75">
          {cols.map((c, i) => (
            <span key={c} className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: SEG[i] }} />{labels[i]} <span className="num text-white">{yen(sum(c))}</span></span>
          ))}
        </div>
      </section>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cols.map((c, i) => (
          <Stat key={c} label={labels[i]} value={yen(sum(c))} tone={i === 3 && sum(c) > 0 ? 'danger' : i > 0 && sum(c) > 0 ? 'warn' : 'white'} />
        ))}
      </div>

      {!rows.length ? <Empty icon={Icons.yen}>{t.account.allPaid}</Empty> : (
        <ul className="space-y-3">
          {rows.map((r) => {
            const out = Number(r.outstanding);
            return (
              <li key={r.customer_id}>
                <Link href={`/admin/customers/${r.customer_id}`} className="block rounded-[26px] bg-card p-4 shadow-card transition active:scale-[.99] sm:p-5">
                  <div className="flex items-center gap-3">
                    <Avatar name={r.company_name} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-semibold">{r.company_name}</div>
                      <div className="text-[0.8rem] text-muted num">{a.oldestDue} {fmtDate(r.oldest_due, locale)}{r.credit_limit != null && ` · ${t.account.creditLimit} ${yen(r.credit_limit)}`}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-extrabold num">{yen(out)}</div>
                      {Number(r.overdue) > 0 && <div className="text-xs font-bold text-danger num">{t.account.overdue} {yen(r.overdue)}</div>}
                    </div>
                  </div>
                  <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-fill">
                    {cols.map((c, i) => <div key={c} style={{ width: `${(Number(r[c]) / Math.max(out, 1)) * 100}%`, background: SEG[i] }} />)}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
