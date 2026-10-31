import { zh, type Dict } from './zh';
import { ja } from './ja';
import { en } from './en';

export type Locale = 'ja' | 'zh' | 'en';
export const LOCALES: Locale[] = ['ja', 'zh', 'en'];
export const DEFAULT_LOCALE: Locale = 'ja';
export const dictionaries: Record<Locale, Dict> = { ja, zh, en };
export type { Dict };

export function isLocale(v: unknown): v is Locale {
  return v === 'ja' || v === 'zh' || v === 'en';
}

/** 从浏览器的 Accept-Language 里挑出第一个支持的语言 */
export function pickFromAcceptLanguage(header: string | null | undefined): Locale {
  if (!header) return DEFAULT_LOCALE;
  const parts = header
    .split(',')
    .map((p) => {
      const [tag, q] = p.trim().split(';q=');
      return { tag: tag.toLowerCase(), q: q ? parseFloat(q) : 1 };
    })
    .sort((a, b) => b.q - a.q);
  for (const { tag } of parts) {
    const base = tag.split('-')[0];
    if (isLocale(base)) return base;
  }
  return DEFAULT_LOCALE;
}

/** 替换 {name} 占位符 */
export function fmt(s: string, vars: Record<string, string | number>): string {
  return s.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? String(vars[k]) : `{${k}}`));
}

export function productName(p: { name_ja: string; name_zh?: string | null; name_en?: string | null }, locale: Locale) {
  if (locale === 'zh' && p.name_zh) return p.name_zh;
  if (locale === 'en' && p.name_en) return p.name_en;
  return p.name_ja;
}

const intlLocale: Record<Locale, string> = { ja: 'ja-JP', zh: 'zh-CN', en: 'en-US' };

export function yen(n: number | string | null | undefined): string {
  return '¥' + Math.round(Number(n ?? 0)).toLocaleString('ja-JP');
}

export function fmtDate(d: string | Date | null | undefined, locale: Locale): string {
  if (!d) return '—';
  const date = typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) ? new Date(d + 'T00:00:00+09:00') : new Date(d);
  return new Intl.DateTimeFormat(intlLocale[locale], { timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

export function fmtDateTime(d: string | Date | null | undefined, locale: Locale): string {
  if (!d) return '—';
  return new Intl.DateTimeFormat(intlLocale[locale], {
    timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  }).format(new Date(d));
}

export function fmtMonth(m: string, locale: Locale): string {
  const [y, mo] = m.split('-');
  if (locale === 'en') return new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'short' }).format(new Date(+y, +mo - 1, 1));
  return `${y}年${+mo}月`;
}

/** 把数据库错误信息转换成当前语言的提示 */
export function errorMessage(t: Dict, raw: string | null | undefined): string {
  if (!raw) return t.errors.generic;
  const [code, arg] = raw.split(':');
  const msg = (t.errors as Record<string, string>)[code];
  if (!msg) return t.errors.generic;
  return fmt(msg, { sku: arg ?? '' });
}
