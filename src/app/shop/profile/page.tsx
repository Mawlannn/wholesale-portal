import { requireCustomer, getT } from '@/lib/session';
import { readFlash } from '@/lib/flash';
import { addressAction, changePassword, saveAddress, updateCompany } from '@/lib/actions/shop';
import { setLanguage, signOut } from '@/lib/actions/common';
import { Avatar, Badge, Card, Field, Flash, Input, PageHeader } from '@/components/ui';
import { LangSwitcher, SubmitButton } from '@/components/client';
import { Icons, langLabels } from '@/components/brand';
import type { Dict } from '@/lib/i18n';

export default async function Profile({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const { supabase, customer, profile, user } = await requireCustomer();
  const { t, locale } = await getT();
  const { data: addresses } = await supabase.from('customer_addresses').select('*').eq('customer_id', customer.id).order('created_at');
  const owner = profile.member_role === 'owner';
  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title={t.profile.title} />
      <Flash {...readFlash(t, sp)} />

      <section className="mb-4 flex items-center gap-4 rounded-[28px] bg-card p-5 shadow-card">
        <Avatar name={customer.company_name} size={64} tone="dark" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-lg font-extrabold">{customer.company_name}</div>
          <div className="truncate text-sm text-muted">{user?.email}</div>
          <div className="mt-1.5"><Badge tone="ok">{t.custStatus[customer.status]}</Badge></div>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title={t.profile.company}>
          {owner ? (
            <form action={updateCompany} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={t.reg.contact}><Input name="contact_name" defaultValue={customer.contact_name ?? ''} required /></Field>
                <Field label={t.reg.phone}><Input name="phone" type="tel" defaultValue={customer.phone ?? ''} required /></Field>
              </div>
              <div className="grid gap-4 sm:grid-cols-[9rem_1fr]">
                <Field label={t.reg.postal}><Input name="postal_code" defaultValue={customer.postal_code ?? ''} /></Field>
                <Field label={t.reg.address}><Input name="address" defaultValue={customer.address ?? ''} /></Field>
              </div>
              <Field label={t.reg.invoiceNo} hint={t.reg.invoiceHint}><Input name="invoice_reg_no" defaultValue={customer.invoice_reg_no ?? ''} /></Field>
              <SubmitButton className="w-full sm:w-auto">{t.common.save}</SubmitButton>
            </form>
          ) : <p className="text-sm text-muted">{t.profile.ownerOnly}</p>}
        </Card>

        <div className="space-y-4">
          <Card title={t.profile.addresses} pad={false}>
            <ul className="divide-y divide-[#f0f1f4]">
              {(addresses ?? []).map((a) => (
                <li key={a.id} className="px-5 py-3.5">
                  <details className="group">
                    <summary className="flex cursor-pointer list-none items-center gap-3">
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-fill">{Icons.pin}</span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2 font-semibold">{a.label}{a.is_default && <Badge tone="dark" dot={false}>{t.profile.defaultAddr}</Badge>}</span>
                        <span className="block truncate text-[0.8rem] text-muted">〒{a.postal_code} {a.address}</span>
                      </span>
                      <span className="text-faint transition-transform group-open:rotate-90">{Icons.chevron}</span>
                    </summary>
                    <AddressForm t={t} a={a} />
                    {!a.is_default && (
                      <div className="mt-2 flex gap-2">
                        <form action={addressAction}><input type="hidden" name="id" value={a.id} /><input type="hidden" name="op" value="default" />
                          <SubmitButton variant="secondary" size="sm">{t.profile.setDefault}</SubmitButton></form>
                        <form action={addressAction}><input type="hidden" name="id" value={a.id} /><input type="hidden" name="op" value="delete" />
                          <SubmitButton variant="danger" size="sm" confirm={t.common.confirmAction}>{t.common.delete}</SubmitButton></form>
                      </div>
                    )}
                  </details>
                </li>
              ))}
              <li className="px-5 py-3.5">
                <details className="group">
                  <summary className="flex cursor-pointer list-none items-center gap-3 font-semibold text-harbor">
                    <span className="flex h-11 w-11 items-center justify-center rounded-full bg-harbor-soft">{Icons.plus}</span>{t.profile.addAddress}
                  </summary>
                  <AddressForm t={t} />
                </details>
              </li>
            </ul>
          </Card>

          <Card>
            <div className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-3 font-semibold"><span className="flex h-11 w-11 items-center justify-center rounded-full bg-fill">{Icons.globe}</span>{t.profile.language}</span>
              <LangSwitcher action={setLanguage} current={locale} labels={langLabels(t)} title={t.lang.label} />
            </div>
          </Card>

          <Card title={t.profile.password}>
            <form action={changePassword} className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <Field label={t.auth.newPassword} hint={t.reg.passwordHint} className="flex-1"><Input name="password" type="password" minLength={8} required autoComplete="new-password" /></Field>
              <SubmitButton variant="secondary" className="sm:mb-6">{t.common.update}</SubmitButton>
            </form>
          </Card>

          <form action={signOut}><SubmitButton variant="danger" size="lg" className="w-full">{Icons.logout}{t.common.signOut}</SubmitButton></form>
        </div>
      </div>
    </div>
  );
}

function AddressForm({ t, a }: { t: Dict; a?: { id: string; label: string; recipient: string | null; phone: string | null; postal_code: string | null; address: string } }) {
  return (
    <form action={saveAddress} className="mt-3 space-y-3 rounded-2xl bg-fill p-3">
      {a && <input type="hidden" name="id" value={a.id} />}
      <Field label={t.profile.label}><Input name="label" defaultValue={a?.label} required className="bg-card!" /></Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t.profile.recipient}><Input name="recipient" defaultValue={a?.recipient ?? ''} className="bg-card!" /></Field>
        <Field label={t.reg.phone}><Input name="phone" defaultValue={a?.phone ?? ''} className="bg-card!" /></Field>
      </div>
      <div className="grid gap-3 sm:grid-cols-[8rem_1fr]">
        <Field label={t.reg.postal}><Input name="postal_code" defaultValue={a?.postal_code ?? ''} className="bg-card!" /></Field>
        <Field label={t.reg.address}><Input name="address" defaultValue={a?.address} required className="bg-card!" /></Field>
      </div>
      <SubmitButton size="sm">{t.common.save}</SubmitButton>
    </form>
  );
}
