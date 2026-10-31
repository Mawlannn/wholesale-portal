import Link from 'next/link';
import { getT } from '@/lib/session';

export default async function NotFound() {
  const { t } = await getT();
  return (
    <div className="mx-auto max-w-md px-4 py-24 text-center">
      <p className="tag mb-4 text-lg">404</p>
      <p className="text-muted">{t.errors.not_found}</p>
      <Link href="/" className="mt-6 inline-block text-harbor hover:underline">{t.common.back}</Link>
    </div>
  );
}
