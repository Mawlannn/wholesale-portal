import { redirect } from 'next/navigation';
import { getSession, getT } from '@/lib/session';
import { signOut } from '@/lib/actions/common';
import { SubmitButton } from '@/components/client';
import { Icons } from '@/components/brand';

export default async function PendingPage() {
  const { t } = await getT();
  const { user, profile, customer } = await getSession();
  if (!user) redirect('/login');
  if (profile?.role === 'admin') redirect('/admin');
  if (customer?.status === 'approved') redirect('/shop');
  const suspended = customer?.status === 'suspended';
  return (
    <div className="rounded-[28px] bg-card p-6 shadow-card">
      <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-signal-soft text-[#8a5a00]">{suspended ? Icons.alert : Icons.clock}</div>
      <h1 className="display text-2xl font-extrabold">{suspended ? t.auth.suspendedTitle : t.auth.pendingTitle}</h1>
      <p className="mt-2 text-muted">{suspended ? t.auth.suspendedBody : t.auth.pendingBody}</p>
      {customer && <p className="mt-5 rounded-2xl bg-paper px-4 py-3 text-sm"><span className="font-semibold">{customer.company_name}</span><br /><span className="text-muted">{user.email}</span></p>}
      <form action={signOut} className="mt-6"><SubmitButton variant="secondary">{t.common.signOut}</SubmitButton></form>
    </div>
  );
}
