import { headers } from 'next/headers';

/**
 * 网站正式网址（邮件里的链接、快递确认链接会用到）
 * 优先用 NEXT_PUBLIC_SITE_URL；没填时用当前访问的网址（Cloudflare / Vercel 都适用）
 */
export async function siteUrl() {
  const env = process.env.NEXT_PUBLIC_SITE_URL;
  if (env) return env.replace(/\/$/, '');
  try {
    const h = await headers();
    const host = h.get('x-forwarded-host') ?? h.get('host');
    if (host) return `${h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https')}://${host}`;
  } catch {}
  return 'http://localhost:3000';
}
