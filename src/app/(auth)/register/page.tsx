import Link from 'next/link';
import { getT } from '@/lib/session';
import { readFlash } from '@/lib/flash';
import { register } from '@/lib/actions/auth';
import { Field, Flash, Input, Textarea } from '@/components/ui';
import { SubmitButton } from '@/components/client';

export default async function RegisterPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const { t } = await getT();
  const flash = readFlash(t, await searchParams);
  const req = <span className="text-danger"> *</span>;
  return (
    <>
      <h1 className="display text-[2rem] font-extrabold leading-tight">{t.reg.title}</h1>
      <p className="mb-6 mt-2 text-sm text-muted">{t.reg.intro}</p>
      <Flash {...flash} />
      <form action={register} className="space-y-4 rounded-[28px] bg-card p-5 shadow-card sm:p-6">
        <Field label={<>{t.reg.company}{req}</>}><Input name="company_name" required autoComplete="organization" /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={<>{t.reg.contact}{req}</>}><Input name="contact_name" required autoComplete="name" /></Field>
          <Field label={<>{t.reg.phone}{req}</>}><Input name="phone" type="tel" required autoComplete="tel" /></Field>
        </div>
        <Field label={<>{t.reg.email}{req}</>}><Input name="email" type="email" required autoComplete="email" /></Field>
        <Field label={<>{t.reg.password}{req}</>} hint={t.reg.passwordHint}><Input name="password" type="password" minLength={8} required autoComplete="new-password" /></Field>
        <div className="grid gap-4 sm:grid-cols-[8rem_1fr]">
          <Field label={t.reg.postal}><Input name="postal_code" autoComplete="postal-code" /></Field>
          <Field label={<>{t.reg.address}{req}</>}><Input name="address" required autoComplete="street-address" /></Field>
        </div>
        <Field label={t.reg.invoiceNo} hint={t.reg.invoiceHint}><Input name="invoice_reg_no" pattern="T?\d{13}" placeholder="T1234567890123" /></Field>
        <Field label={t.reg.note}><Textarea name="note" rows={2} /></Field>
        <SubmitButton className="w-full" size="lg">{t.reg.submit}</SubmitButton>
      </form>
      <p className="mt-6 text-center text-sm text-muted">
        {t.auth.haveAccount} <Link href="/login" className="font-medium font-semibold text-harbor hover:underline">{t.auth.login}</Link>
      </p>
    </>
  );
}
