/** インボイス制度：税率ごとに合計してから 1 回だけ端数処理（切捨て）。数据库 recalc_order_totals 使用同一规则 */
export function calcTotals(lines: { amount: number; rate: number }[]) {
  const s8 = lines.filter((l) => l.rate === 8).reduce((s, l) => s + l.amount, 0);
  const s10 = lines.filter((l) => l.rate === 10).reduce((s, l) => s + l.amount, 0);
  const t8 = Math.floor((s8 * 8) / 100);
  const t10 = Math.floor((s10 * 10) / 100);
  return { s8, s10, t8, t10, total: s8 + s10 + t8 + t10 };
}
