import type { Dict } from '@/lib/i18n';

/** 品牌标志：黑色圆角方块里的箱子 */
export function Crate({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
      <rect width="40" height="40" rx="13" fill="#0f1115" />
      <path d="M11 15.5 20 11l9 4.5v9.5L20 29.5 11 25Z" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinejoin="round" />
      <path d="M11 15.5 20 20l9-4.5M20 20v9.5" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinejoin="round" />
      <circle cx="30" cy="10" r="4" fill="#5b4bf5" />
    </svg>
  );
}

export const langLabels = (t: Dict) => ({ ja: t.lang.ja, zh: t.lang.zh, en: t.lang.en });

const ico = (d: string, size = 22) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={d} />
  </svg>
);
export const Icons = {
  box: ico('M3 7.5 12 3l9 4.5v9L12 21l-9-4.5v-9ZM3 7.5 12 12l9-4.5M12 12v9'),
  cart: ico('M5 7h14l-1.2 11.1a2 2 0 0 1-2 1.9H8.2a2 2 0 0 1-2-1.9L5 7ZM9 7V6a3 3 0 0 1 6 0v1'),
  list: ico('M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01'),
  yen: ico('M6 4l6 8 6-8M12 12v8M8 13h8M8 16.5h8'),
  shop: ico('M4 10v10h16V10M3 10l2-6h14l2 6M3 10h18M9 20v-6h6v6'),
  home: ico('M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-4v-6h-6v6H5a1 1 0 0 1-1-1v-9.5Z'),
  truck: ico('M3 6h11v10H3zM14 10h4l3 3v3h-7M7 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm10 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z'),
  warehouse: ico('M3 21V9l9-5 9 5v12M7 21v-8h10v8M7 17h10'),
  users: ico('M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM2 21a7 7 0 0 1 14 0M17 3.5a4 4 0 0 1 0 7.5M19 14a6 6 0 0 1 3 7'),
  user: ico('M12 12a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9ZM4 21a8 8 0 0 1 16 0'),
  chart: ico('M4 20V10M10 20V4M16 20v-7M22 20H2'),
  search: ico('M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14ZM21 21l-5-5'),
  mail: ico('M3 6h18v12H3zM3 7l9 6 9-6'),
  clock: ico('M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 7v5l3 2'),
  gear: ico('M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z'),
  alert: ico('M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z'),
  calendar: ico('M4 5h16v16H4zM4 10h16M9 3v4M15 3v4'),
  bell: ico('M6 9a6 6 0 1 1 12 0c0 6 2.5 7.5 2.5 7.5h-17S6 15 6 9ZM10 20a2 2 0 0 0 4 0'),
  heart: ico('M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z', 20),
  plus: ico('M12 5v14M5 12h14', 20),
  minus: ico('M5 12h14', 20),
  grid: ico('M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z'),
  globe: ico('M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM3 12h18M12 3c2.5 2.7 3.8 5.7 3.8 9s-1.3 6.3-3.8 9c-2.5-2.7-3.8-5.7-3.8-9S9.5 5.7 12 3Z', 20),
  filter: ico('M4 6h16M7 12h10M10 18h4', 20),
  file: ico('M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h6'),
  repeat: ico('M17 2l3 3-3 3M4 11V9a4 4 0 0 1 4-4h12M7 22l-3-3 3-3M20 13v2a4 4 0 0 1-4 4H4', 20),
  arrow: ico('M5 12h14M13 6l6 6-6 6', 18),
  back: ico('M15 18 9 12l6-6', 20),
  chevron: ico('M9 6l6 6-6 6', 18),
  check: ico('M5 12.5 10 17l9-10', 18),
  logout: ico('M15 4h4v16h-4M10 8l-4 4 4 4M6 12h11', 20),
  more: ico('M5 12h.01M12 12h.01M19 12h.01', 22),
  pin: ico('M12 21s-7-6-7-11a7 7 0 0 1 14 0c0 5-7 11-7 11ZM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z', 18),
};

// ---------------------------------------------------------------------
// 商品插画：没有照片时，按分类画出罐子 / 瓶子 / 零食袋 / 箱子，放在浅灰底上
// ---------------------------------------------------------------------
const palettes = [
  { main: '#f5a524', accent: '#0f1115' },
  { main: '#5b4bf5', accent: '#ffffff' },
  { main: '#e5484d', accent: '#ffffff' },
  { main: '#16a34a', accent: '#ffffff' },
  { main: '#2f80ed', accent: '#ffffff' },
  { main: '#0f1115', accent: '#f5a524' },
];
const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
export function productTint(key: string) {
  return palettes[hash(key || 'x') % palettes.length];
}

function shapeFor(category: string | null | undefined, sku: string) {
  const c = `${category ?? ''} ${sku}`.toLowerCase();
  if (/酒|beer|ビール|wine|ワイン|sake|soju|alc|al-/.test(c)) return 'can';
  if (/飲|饮|drink|juice|water|tea|茶|dr-|bev/.test(c)) return 'bottle';
  if (/スナック|零食|snack|chip|菓子|candy|sn-/.test(c)) return 'bag';
  return 'box';
}

export function ProductArt({ sku, name, category, brand, image, className = '' }: { sku: string; name: string; category?: string | null; brand?: string | null; image?: string | null; className?: string }) {
  const p = { ...productTint(sku) };
  const bg = 'linear-gradient(160deg,#f6f7f9 0%,#eceef2 100%)';
  if (image)
    return (
      <div className={`relative overflow-hidden ${className}`} style={{ background: bg }}>
        <img src={image} alt="" className="h-full w-full object-cover" loading="lazy" />
      </div>
    );
  const shape = shapeFor(category, sku);
  if (shape === 'box' && p.main === '#0f1115') p.main = '#f5a524';
  const label = (brand || name).replace(/\s.*/, '').slice(0, 8);
  const lightText = p.accent === '#ffffff';
  return (
    <div className={`relative flex items-center justify-center overflow-hidden ${className}`} style={{ background: bg }} aria-hidden="true">
      <svg viewBox="0 0 120 120" className="h-[82%] w-[82%]">
        <ellipse cx="60" cy="112" rx="30" ry="4.5" fill="#0f1115" opacity=".08" />
        {shape === 'can' && (
          <g>
            <rect x="37" y="20" width="46" height="90" rx="11" fill={p.main} />
            <rect x="41" y="14" width="38" height="9" rx="4.5" fill="#cfd3da" />
            <rect x="37" y="50" width="46" height="30" fill={p.accent} />
            <rect x="44" y="26" width="5" height="78" rx="2.5" fill="#fff" opacity=".22" />
          </g>
        )}
        {shape === 'bottle' && (
          <g>
            <rect x="51" y="7" width="18" height="10" rx="3" fill="#0f1115" />
            <path d="M52 17h16v14c10 6 14 12 14 22v49a8 8 0 0 1-8 8H46a8 8 0 0 1-8-8V53c0-10 4-16 14-22Z" fill={p.main} />
            <rect x="38" y="62" width="44" height="28" fill="#fff" />
            <rect x="45" y="38" width="5" height="66" rx="2.5" fill="#fff" opacity=".22" />
          </g>
        )}
        {shape === 'bag' && (
          <g>
            <path d="M31 16h58l-4 8 4 8v68a8 8 0 0 1-8 8H39a8 8 0 0 1-8-8V32l4-8Z" fill={p.main} />
            <path d="M31 16h58" stroke="#fff" strokeWidth="3" strokeDasharray="4 4" opacity=".55" />
            <circle cx="60" cy="68" r="20" fill="#fff" />
          </g>
        )}
        {shape === 'box' && (
          <g>
            <path d="M22 40 60 24l38 16v56l-38 16-38-16Z" fill={p.main} />
            <path d="M22 40l38 16 38-16M60 56v56" stroke="#fff" strokeWidth="2.5" opacity=".5" fill="none" />
          </g>
        )}
        {shape !== 'box' && (
          <text x="60" y={shape === 'can' ? 69 : shape === 'bottle' ? 80 : 72} textAnchor="middle" fontSize={label.length > 6 ? 9.5 : 11} fontWeight="800"
            fill={shape === 'can' ? (lightText ? p.main : '#fff') : '#0f1115'} fontFamily="Plus Jakarta Sans, sans-serif">
            {label}
          </text>
        )}
      </svg>
    </div>
  );
}
