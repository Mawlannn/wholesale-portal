import type { ReactNode } from 'react';
import type { Dict, Locale } from '@/lib/i18n';
import { fmt, fmtDateTime } from '@/lib/i18n';
import { sendOrderEmail } from '@/lib/actions/admin';
import type { Draft } from '@/lib/mail';
import { SubmitButton } from './client';
import { Icons } from './brand';

type Log = { status: string; created_at: string } | undefined;

/** 订单页的一行邮件：显示发送状态，点开后是生成好的模板，可修改再发送 */
export function MailCompose({ t, locale, orderId, target, kind, draft, last, icon, title, sendLabel }: {
  t: Dict; locale: Locale; orderId: string; target: 'customer' | 'courier'; kind?: string;
  draft: Draft; last: Log; icon: ReactNode; title: string; sendLabel: string;
}) {
  const a = t.admin.orders;
  const status = !last ? { text: a.notSent, cls: 'text-warn' }
    : last.status === 'sent' ? { text: fmt(a.sentAt, { time: fmtDateTime(last.created_at, locale) }), cls: 'text-ok' }
    : last.status === 'failed' ? { text: t.errors.mail_failed, cls: 'text-danger' }
    : { text: fmt(a.savedOnly, { time: fmtDateTime(last.created_at, locale) }), cls: 'text-muted' };
  return (
    <details className="group rounded-[22px] bg-fill p-3 open:bg-card open:ring-1 open:ring-line">
      <summary className="flex cursor-pointer list-none items-center gap-3 [&::-webkit-details-marker]:hidden">
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${last?.status === 'sent' ? 'bg-ok-soft text-ok' : 'bg-card text-ink'}`}>{last?.status === 'sent' ? Icons.check : icon}</span>
        <span className="min-w-0 flex-1">
          <span className="block font-bold">{title}</span>
          <span className="block truncate text-xs text-muted">{draft.to || a.noAddress}</span>
          <span className={`block text-xs font-semibold ${status.cls}`}>{status.text}</span>
        </span>
        <span className={`inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full px-4 text-sm font-semibold group-open:hidden ${last ? 'bg-card text-ink' : 'bg-ink text-white'}`}>
          {Icons.mail}{last ? a.recompose : a.compose}
        </span>
      </summary>
      <form action={sendOrderEmail} className="mt-3 space-y-2.5">
        <input type="hidden" name="order_id" value={orderId} />
        <input type="hidden" name="target" value={target} />
        {kind && <input type="hidden" name="kind" value={kind} />}
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-muted">{a.mailTo}</span>
          <input name="to" type="text" required defaultValue={draft.to} className="field" />
        </label>
        {target === 'courier' && (
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-muted">{a.mailCc}</span>
            <input name="cc" type="text" defaultValue={draft.cc} className="field" />
          </label>
        )}
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-muted">{a.mailSubject}</span>
          <input name="subject" required defaultValue={draft.subject} className="field font-semibold" />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-muted">{a.mailBody}</span>
          <textarea name="body" required rows={12} defaultValue={draft.body} className="field min-h-56 font-mono text-[13px] leading-relaxed" />
        </label>
        <SubmitButton size="lg" className="w-full">{Icons.mail}{sendLabel}</SubmitButton>
      </form>
    </details>
  );
}
