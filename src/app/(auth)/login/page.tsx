import Link from 'next/link';
import { getT } from '@/lib/session';
import { readFlash } from '@/lib/flash';
import { login } from '@/lib/actions/auth';
import { Field, Flash, Input } from '@/components/ui';
import { SubmitButton } from '@/components/client';

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const { t } = await getT();
  const flash = readFlash(t, await searchParams);
  return (
    <>
      <h1 className="display mb-6 text-[2rem] font-extrabold leading-tight">{t.auth.login}</h1>
      <Flash {...flash} />
      <form action={login} className="space-y-4 rounded-[28px] bg-card p-5 shadow-card sm:p-6">
        <Field label={t.auth.email}><Input name="email" type="email" autoComplete="email" required /></Field>
        <Field label={t.auth.password}><Input name="password" type="password" autoComplete="current-password" required /></Field>
        <SubmitButton className="w-full" size="lg">{t.auth.loginBtn}</SubmitButton>
        <Link href="/forgot" className="block text-center text-sm font-semibold text-harbor hover:underline">{t.auth.forgot}</Link>
      </form>
      <p className="mt-6 text-center text-sm text-muted">
        {t.auth.noAccount}{' '}
        <Link href="/register" className="font-medium font-semibold text-harbor hover:underline">{t.auth.register}</Link>
      </p>
    </>
  );
}
