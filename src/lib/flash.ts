import { redirect } from 'next/navigation';
import { errorMessage, type Dict } from './i18n';

/** 操作完成后跳回页面并带上提示 */
export function done(path: string, ok: string): never {
  const sep = path.includes('?') ? '&' : '?';
  redirect(`${path}${sep}ok=${encodeURIComponent(ok)}`);
}
export function fail(path: string, err: string | { message?: string } | null | undefined): never {
  const raw = typeof err === 'string' ? err : err?.message || 'generic';
  // 只保留错误代码部分（例如 insufficient_stock:SKU）
  const code = (raw.match(/[a-z_]+(:[^\s"]+)?/)?.[0]) ?? 'generic';
  const sep = path.includes('?') ? '&' : '?';
  redirect(`${path}${sep}err=${encodeURIComponent(code)}`);
}

type SP = Record<string, string | string[] | undefined>;
export function readFlash(t: Dict, sp: SP): { ok?: string; err?: string } {
  const ok = typeof sp.ok === 'string' ? sp.ok : undefined;
  const err = typeof sp.err === 'string' ? sp.err : undefined;
  let okText: string | undefined;
  if (ok) {
    const v = ok.split('.').reduce<unknown>((o, k) => (o && typeof o === 'object' ? (o as Record<string, unknown>)[k] : undefined), t);
    okText = typeof v === 'string' ? v : t.common.saved;
  }
  return { ok: okText, err: err ? errorMessage(t, err) : undefined };
}

export const str = (fd: FormData, k: string) => {
  const v = fd.get(k);
  return typeof v === 'string' ? v.trim() : '';
};
export const num = (fd: FormData, k: string): number | null => {
  const v = str(fd, k).replace(/[,，\s¥]/g, '');
  if (v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
