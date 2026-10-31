import { requireAdmin, getT } from '@/lib/session';
import { readFlash } from '@/lib/flash';
import { changeAdminPassword, saveSettings, sendTestMail } from '@/lib/actions/admin';
import { mailTransport } from '@/lib/mail';
import { fmt } from '@/lib/i18n';
import { Icons } from '@/components/brand';
import { Card, Field, Flash, Input, PageHeader, Select, Textarea } from '@/components/ui';
import { SubmitButton } from '@/components/client';

export default async function Settings({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const { supabase } = await requireAdmin();
  const { t } = await getT();
  const a = t.admin.settings;
  const { data: s } = await supabase.from('settings').select('*').eq('id', 1).single();
  const tr = mailTransport();
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title={a.title} />
      <Flash {...readFlash(t, await searchParams)} />
      <Card title={a.mailTitle} className="mb-4">
        <div className={`flex items-start gap-3 rounded-2xl p-4 ${tr.kind === 'none' ? 'bg-warn-soft' : 'bg-ok-soft'}`}>
          <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-card ${tr.kind === 'none' ? 'text-warn' : 'text-ok'}`}>{tr.kind === 'none' ? Icons.alert : Icons.check}</span>
          <p className={`text-sm font-semibold ${tr.kind === 'none' ? 'text-warn' : 'text-ok'}`}>
            {tr.kind === 'smtp' ? fmt(a.mailSmtp, { from: tr.from }) : tr.kind === 'resend' ? fmt(a.mailResend, { from: tr.from }) : a.mailNone}
          </p>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-muted">{a.mailHow}</p>
        <form action={sendTestMail} className="mt-4 flex flex-col gap-2 sm:flex-row">
          <Input name="to" type="email" required defaultValue={s?.company_email ?? ''} aria-label={a.testTo} placeholder={a.testTo} />
          <SubmitButton variant="secondary" className="shrink-0">{Icons.mail}{a.testSend}</SubmitButton>
        </form>
      </Card>
      <form action={saveSettings} className="space-y-4">
        <Card title={a.company}>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label={a.companyName}><Input name="company_name" defaultValue={s?.company_name} /></Field>
            <Field label={a.regNo}><Input name="invoice_reg_no" defaultValue={s?.invoice_reg_no} placeholder="T1234567890123" /></Field>
            <Field label={a.address} className="md:col-span-2"><Input name="company_address" defaultValue={s?.company_address} /></Field>
            <Field label={a.phone}><Input name="company_phone" defaultValue={s?.company_phone} /></Field>
            <Field label={a.email}><Input name="company_email" type="email" defaultValue={s?.company_email} /></Field>
            <Field label={a.bank} className="md:col-span-2"><Textarea name="bank_info" defaultValue={s?.bank_info} placeholder="○○銀行 ○○支店 普通 1234567 カ）○○" /></Field>
          </div>
        </Card>
        <Card title={a.courier}>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label={a.courierName}><Input name="courier_name" defaultValue={s?.courier_name} /></Field>
            <Field label={a.courierLocale}>
              <Select name="courier_locale" defaultValue={s?.courier_locale ?? 'ja'}>
                <option value="ja">{t.lang.ja}</option><option value="zh">{t.lang.zh}</option><option value="en">{t.lang.en}</option>
              </Select>
            </Field>
            <Field label={a.courierEmail}><Input name="courier_email" type="email" defaultValue={s?.courier_email} /></Field>
            <Field label={a.courierCc}><Input name="courier_cc" defaultValue={s?.courier_cc} /></Field>
          </div>
        </Card>
        <Card title={a.ordering}>
          <div className="grid gap-4 md:grid-cols-3">
            <Field label={a.cutoff}><Input name="order_cutoff" type="time" defaultValue={s?.order_cutoff} /></Field>
            <Field label={a.terms}><Input name="default_payment_terms_days" inputMode="numeric" defaultValue={s?.default_payment_terms_days} /></Field>
            <Field label={a.expiryAlert}><Input name="expiry_alert_days" inputMode="numeric" defaultValue={s?.expiry_alert_days} /></Field>
          </div>
        </Card>
        <SubmitButton size="lg" className="w-full sm:w-auto">{t.common.save}</SubmitButton>
      </form>
      <Card title={t.profile.password} className="mt-4">
        <form action={changeAdminPassword} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <Field label={t.auth.newPassword} hint={t.reg.passwordHint} className="flex-1"><Input name="password" type="password" minLength={8} required autoComplete="new-password" /></Field>
          <SubmitButton variant="secondary" className="sm:mb-6">{t.common.update}</SubmitButton>
        </form>
      </Card>
    </div>
  );
}
