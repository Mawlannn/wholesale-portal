import { LangSwitcher } from '@/components/client';
import { Crate, Icons, ProductArt, langLabels } from '@/components/brand';
import { setLanguage } from '@/lib/actions/common';
import { getT } from '@/lib/session';

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const { t, locale } = await getT();
  const tiles: [string, string, string][] = [['AL-1', '酒類', 'Harbor'], ['DR-2', 'drink', 'Tropica'], ['SN-3', 'snack', 'Crunchy']];
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[1fr_1fr]">
      {/* 桌面左侧：黑色品牌面板 */}
      <aside className="relative hidden overflow-hidden bg-ink p-12 text-white lg:flex lg:flex-col">
        <div aria-hidden="true" className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-harbor opacity-50 blur-3xl" />
        <div aria-hidden="true" className="absolute -bottom-32 -left-16 h-80 w-80 rounded-full bg-sky opacity-25 blur-3xl" />
        <div className="relative flex items-center gap-3">
          <Crate size={44} />
          <div>
            <div className="text-lg font-extrabold">{t.app.name}</div>
            <div className="text-sm text-white/60">{t.auth.heroSub}</div>
          </div>
        </div>
        <h2 className="relative mt-auto max-w-lg text-[3rem] font-extrabold leading-[1.08] tracking-tight">{t.auth.heroTitle}</h2>
        <ul className="relative mt-8 space-y-3 text-white/80">
          {[t.auth.p1, t.auth.p2, t.auth.p3].map((p) => (
            <li key={p} className="flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10">{Icons.check}</span>{p}
            </li>
          ))}
        </ul>
        <div aria-hidden="true" className="relative mt-12 flex gap-4">
          {tiles.map(([sku, cat, brand], i) => (
            <div key={sku} className="w-32 rounded-[26px] bg-white p-2" style={{ transform: `rotate(${(i - 1) * 6}deg) translateY(${i === 1 ? -14 : 0}px)` }}>
              <ProductArt sku={sku} name="" category={cat} brand={brand} className="aspect-square rounded-[20px]" />
            </div>
          ))}
        </div>
      </aside>

      <main className="flex flex-col px-5 pb-12 pt-[calc(16px+env(safe-area-inset-top,0px))] sm:px-8 lg:pt-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5 lg:invisible">
            <Crate size={40} />
            <div>
              <div className="font-extrabold leading-tight">{t.app.name}</div>
              <div className="text-xs text-muted">{t.auth.heroSub}</div>
            </div>
          </div>
          <LangSwitcher action={setLanguage} current={locale} labels={langLabels(t)} title={t.lang.label} />
        </div>
        {/* 手机：小插画条 */}
        <div aria-hidden="true" className="mt-8 flex justify-center gap-3 lg:hidden">
          {tiles.map(([sku, cat, brand], i) => (
            <div key={sku} className="w-24 rounded-[22px] bg-card p-1.5 shadow-card" style={{ transform: `rotate(${(i - 1) * 6}deg) translateY(${i === 1 ? -8 : 0}px)` }}>
              <ProductArt sku={sku} name="" category={cat} brand={brand} className="aspect-square rounded-[17px]" />
            </div>
          ))}
        </div>
        <div className="mx-auto mt-8 w-full max-w-md lg:my-auto">{children}</div>
      </main>
    </div>
  );
}
