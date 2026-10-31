/** 网站正式网址：优先用 NEXT_PUBLIC_SITE_URL；部署在 Vercel 时没填也会自动用 Vercel 的正式网址 */
export function siteUrl() {
  const env = process.env.NEXT_PUBLIC_SITE_URL
    || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : '')
    || 'http://localhost:3000';
  return env.replace(/\/$/, '');
}
