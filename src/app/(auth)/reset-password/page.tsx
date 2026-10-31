import { getT } from '@/lib/session';
import { readFlash } from '@/lib/flash';
import { resetPassword } from '@/lib/actions/auth';
import { Field, Flash, Input } from '@/components/ui';
import { SubmitButton } from '@/components/client';

export default async function ResetPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const { t } = await getT();
  return (
    <>
      <h1 className="display mb-6 text-[2rem] font-extrabold leading-tight">{t.auth.setPassword}</h1>
      <Flash {...readFlash(t, await searchParams)} />
      <form action={resetPassword} className="space-y-4 rounded-[28px] bg-card p-5 shadow-card sm:p-6">
        <Field label={t.auth.newPassword} hint={t.reg.passwordHint}><Input name="password" type="password" minLength={8} required autoComplete="new-password" /></Field>
        <SubmitButton className="w-full" size="lg">{t.auth.setPassword}</SubmitButton>
      </form>
    </>
  );
}
