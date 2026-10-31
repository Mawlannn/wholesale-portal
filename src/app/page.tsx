import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';

export default async function Home() {
  const { user, profile } = await getSession();
  if (!user) redirect('/login');
  redirect(profile?.role === 'admin' ? '/admin' : '/shop');
}
