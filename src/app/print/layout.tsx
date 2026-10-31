import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';

export default async function PrintLayout({ children }: { children: React.ReactNode }) {
  const { user } = await getSession();
  if (!user) redirect('/login');
  return <div className="min-h-dvh bg-paper py-6 print:bg-white print:py-0">{children}</div>;
}
