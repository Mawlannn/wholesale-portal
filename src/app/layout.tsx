import type { Metadata, Viewport } from 'next';
import './globals.css';
import { getLocale } from '@/lib/session';
import { dictionaries } from '@/lib/i18n';
import { Suspense } from 'react';
import { ScrollTop } from '@/components/scroll-top';

export async function generateMetadata(): Promise<Metadata> {
  const t = dictionaries[await getLocale()];
  return { title: { default: t.app.name, template: `%s | ${t.app.name}` }, robots: { index: false } };
}
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#f3f4f6' };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  return (
    <html lang={locale === 'zh' ? 'zh-CN' : locale}>
      <body className="min-h-dvh antialiased">
        <Suspense fallback={null}><ScrollTop /></Suspense>
        {children}
      </body>
    </html>
  );
}
