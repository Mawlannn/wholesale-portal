import { Icons } from './brand';

/** 白色胶囊搜索框（GET 表单） */
export function SearchBar({ placeholder, value, hidden = {}, label, name = 'q' }: { placeholder: string; value?: string; hidden?: Record<string, string | undefined>; label: string; name?: string }) {
  return (
    <form className="relative mb-4" role="search">
      {Object.entries(hidden).map(([k, v]) => (v ? <input key={k} type="hidden" name={k} value={v} /> : null))}
      <span className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-muted">{Icons.search}</span>
      <input name={name} defaultValue={value} placeholder={placeholder} aria-label={label}
        className="h-13 w-full rounded-full bg-card py-3.5 pl-14 pr-5 text-base shadow-card outline-none placeholder:text-faint focus:ring-4 focus:ring-harbor-soft" />
    </form>
  );
}
