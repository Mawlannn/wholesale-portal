import Link from 'next/link';
import { getT } from '@/lib/session';
import { readFlash } from '@/lib/flash';
import { forgotPassword } from '@/lib/actions/auth';
import { Field, Flash, Input } from '@/components/ui';
import { SubmitButton } from '@/components/client';

export default async function ForgotPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const { t } = await getT();
  return (
    <>
      <h1 className="display mb-6 text-[2rem] font-extrabold leading-tight">{t.auth.forgot}</h1>
      <Flash {...readFlash(t, await searchParams)} />
      <form action={forgotPassword} className="space-y-4 rounded-[28px] bg-card p-5 shadow-card sm:p-6">
        <Field label={t.auth.email}><Input name="email" type="email" required /></Field>
        <SubmitButton className="w-full" size="lg">{t.auth.sendReset}</SubmitButton>
      </form>
      <Link href="/login" className="mt-6 block text-center text-sm font-semibold text-harbor hover:underline">{t.common.back}</Link>
    </>
  );
}
