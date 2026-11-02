import { getSession, getT } from '@/lib/session';
import { readFlash } from '@/lib/flash';
import { completeProfile } from '@/lib/actions/auth';
import { redirect } from 'next/navigation';
import { Field, Flash, Input, Textarea } from '@/components/ui';
import { SubmitButton } from '@/components/client';

export default async function CompleteProfilePage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const { t } = await getT();
  const { user, profile, customer } = await getSession();
  if (!user) redirect('/login');
  if (profile?.role === 'admin') redirect('/admin');
  if (customer) redirect('/pending');
  const flash = readFlash(t, await searchParams);
  const req = <span className="text-danger"> *</span>;
  return (
    <>
      <h1 className="display text-[2rem] font-extrabold leading-tight">{t.reg.completeTitle}</h1>
      <p className="mb-6 mt-2 text-sm text-muted">{t.reg.completeIntro}</p>
      <Flash {...flash} />
      <form action={completeProfile} className="space-y-4 rounded-[28px] bg-card p-5 shadow-card sm:p-6">
        <Field label={<>{t.reg.company}{req}</>}><Input name="company_name" required autoComplete="organization" /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={<>{t.reg.contact}{req}</>}><Input name="contact_name" required autoComplete="name" /></Field>
          <Field label={<>{t.reg.phone}{req}</>}><Input name="phone" type="tel" required autoComplete="tel" /></Field>
        </div>
        <Field label={t.reg.email}><Input value={user.email ?? ''} readOnly disabled /></Field>
        <div className="grid gap-4 sm:grid-cols-[8rem_1fr]">
          <Field label={t.reg.postal}><Input name="postal_code" autoComplete="postal-code" /></Field>
          <Field label={<>{t.reg.address}{req}</>}><Input name="address" required autoComplete="street-address" /></Field>
        </div>
        <Field label={t.reg.invoiceNo} hint={t.reg.invoiceHint}><Input name="invoice_reg_no" pattern="T?\d{13}" placeholder="T1234567890123" /></Field>
        <Field label={t.reg.note}><Textarea name="note" rows={2} /></Field>
        <SubmitButton className="w-full" size="lg">{t.reg.submit}</SubmitButton>
      </form>
    </>
  );
}
