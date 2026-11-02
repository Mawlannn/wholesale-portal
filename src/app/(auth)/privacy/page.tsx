import Link from 'next/link';
import { getT } from '@/lib/session';

type Doc = { title: string; updated: string; sections: [string, string][] };

const docs: Record<string, Doc> = {
  zh: {
    title: '隐私政策', updated: '更新日期：2026 年 11 月 2 日',
    sections: [
      ['收集的信息', '注册或使用 Google 登录时，我们会收集您的邮箱地址和姓名；您填写的公司名称、负责人、电话、地址、适格请求书登记号码；以及订单、付款和配送记录。'],
      ['使用目的', '仅用于审核客户账号、接收和处理订单、安排配送、开具纳品书与请求书、管理应收账款，以及就订单与您联系。'],
      ['提供给第三方', '为完成配送，会把收货公司、地址、电话和商品内容提供给我们委托的物流公司。除法律要求外，不会出售或提供给其他第三方。'],
      ['Google 登录', '使用 Google 登录时，我们只取得您的邮箱地址和基本资料（姓名、头像），不会读取您的 Gmail、通讯录或其他 Google 数据。'],
      ['保存与安全', '数据保存在加密的云数据库中，仅限授权人员访问。依据日本电子账簿保存法，交易记录会按法定期限保存。'],
      ['查询、修改与删除', '您可以随时在账户页面查看和修改公司信息。如需删除账号，请通过下方邮箱联系我们（法定保存的交易记录除外）。'],
    ],
  },
  ja: {
    title: 'プライバシーポリシー', updated: '最終更新日：2026年11月2日',
    sections: [
      ['取得する情報', '会員登録または Google ログインの際のメールアドレスと氏名、ご入力いただいた会社名・担当者名・電話番号・住所・適格請求書発行事業者登録番号、ならびにご注文・お支払い・配送の記録を取得します。'],
      ['利用目的', 'アカウントの審査、ご注文の受付と処理、配送手配、納品書・請求書の発行、売掛金の管理、ご注文に関するご連絡のためにのみ利用します。'],
      ['第三者提供', '配送のため、委託先の運送会社に届け先の会社名・住所・電話番号・商品内容を提供します。法令に基づく場合を除き、その他の第三者に販売・提供することはありません。'],
      ['Google ログイン', 'Google ログインでは、メールアドレスと基本プロフィール（氏名・画像）のみを取得し、Gmail・連絡先その他の Google データにはアクセスしません。'],
      ['保管と安全管理', 'データは暗号化されたクラウドデータベースに保管し、権限のある者のみがアクセスします。取引記録は電子帳簿保存法に基づき法定期間保存します。'],
      ['開示・訂正・削除', '会社情報はアカウントページからいつでも確認・変更できます。アカウントの削除をご希望の場合は下記メールアドレスまでご連絡ください（法定保存の取引記録を除きます）。'],
    ],
  },
  en: {
    title: 'Privacy Policy', updated: 'Last updated: November 2, 2026',
    sections: [
      ['Information we collect', 'Your email address and name when you register or sign in with Google; the company name, contact person, phone, address and invoice registration number you provide; and your order, payment and delivery records.'],
      ['How we use it', 'Only to review accounts, receive and process orders, arrange delivery, issue delivery notes and invoices, manage receivables, and contact you about your orders.'],
      ['Sharing', 'To deliver your orders we share the recipient company, address, phone and order contents with our contracted courier. We do not sell or share your data with anyone else except where required by law.'],
      ['Google sign-in', 'With Google sign-in we only receive your email address and basic profile (name, picture). We never access your Gmail, contacts or other Google data.'],
      ['Storage and security', 'Data is stored in an encrypted cloud database with access limited to authorised staff. Transaction records are retained for the period required by Japanese law.'],
      ['Access, correction and deletion', 'You can view and update your company details on your account page at any time. To delete your account, contact us at the email below (legally required transaction records excepted).'],
    ],
  },
};

export const metadata = { title: 'Privacy Policy' };

export default async function PrivacyPage() {
  const { t, locale } = await getT();
  const d = docs[locale] ?? docs.ja;
  return (
    <article className="rounded-[28px] bg-card p-6 shadow-card">
      <h1 className="display text-[2rem] font-extrabold leading-tight">{d.title}</h1>
      <p className="mt-1 text-sm text-muted">{t.app.name} · {d.updated}</p>
      <div className="mt-6 space-y-5 text-sm leading-relaxed">
        {d.sections.map(([h, p]) => (
          <section key={h}>
            <h2 className="mb-1 font-bold">{h}</h2>
            <p className="text-muted">{p}</p>
          </section>
        ))}
        <p className="text-muted">✉ osmanmawlan0101@gmail.com</p>
      </div>
      <Link href="/login" className="mt-6 block text-center text-sm font-semibold text-harbor hover:underline">{t.common.back}</Link>
    </article>
  );
}
