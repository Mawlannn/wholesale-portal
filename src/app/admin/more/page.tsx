import { requireAdmin, getT } from '@/lib/session';
import { setLanguage, signOut } from '@/lib/actions/common';
import { adminNav } from '@/components/admin-nav';
import { LangSwitcher, SubmitButton } from '@/components/client';
import { Avatar, IconDot, List, PageHeader, Row } from '@/components/ui';
import { Icons, langLabels } from '@/components/brand';

// 手机端“更多”：所有功能入口
export default async function More() {
  const { supabase, user } = await requireAdmin();
  const { t, locale } = await getT();
  const { data: d } = await supabase.rpc('admin_dashboard');
  const items = adminNav(t, (d ?? {}) as Record<string, number>).filter((i) => i.href !== '/admin');
  const groups = [...new Set(items.map((i) => i.group))];
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title={t.nav.more} />
      <section className="mb-5 flex items-center gap-4 rounded-[28px] bg-card p-5 shadow-card">
        <Avatar name={user?.email ?? 'A'} size={56} tone="dark" />
        <div className="min-w-0 flex-1">
          <div className="font-extrabold">{t.admin.title}</div>
          <div className="truncate text-sm text-muted">{user?.email}</div>
        </div>
        <LangSwitcher action={setLanguage} current={locale} labels={langLabels(t)} title={t.lang.label} variant="icon" />
      </section>
      {groups.map((g) => (
        <div key={g} className="mb-5">
          <h2 className="mb-2 px-2 text-xs font-bold uppercase tracking-wider text-faint">{g}</h2>
          <List>
            {items.filter((i) => i.group === g).map((i) => (
              <Row key={i.href} href={i.href} lead={<IconDot>{i.icon}</IconDot>} title={i.label}
                end={i.badge ? <span className="rounded-full bg-harbor px-2 py-0.5 text-xs text-white">{i.badge}</span> : <span className="text-faint">{Icons.chevron}</span>} />
            ))}
          </List>
        </div>
      ))}
      <form action={signOut}><SubmitButton variant="danger" size="lg" className="w-full">{Icons.logout}{t.common.signOut}</SubmitButton></form>
    </div>
  );
}
