-- 固定函数的 search_path（Supabase 安全检查建议）
alter function public.forbid_delete() set search_path = public;
alter function public.jp_today() set search_path = public;
