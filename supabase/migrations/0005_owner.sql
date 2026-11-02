-- 系统所有者：只有所有者能添加 / 移除管理员
alter table public.profiles add column if not exists is_owner boolean not null default false;

update public.profiles set is_owner = true
where email = 'osmanmawlan0101@gmail.com' and role = 'admin';

create or replace function public.is_owner() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select is_owner from profiles where id = auth.uid()), false);
$$;

-- 防止普通管理员通过数据库直接改角色或所有者标记（服务端系统操作 auth.uid() 为空，不受限制）
create or replace function public.guard_profile_role() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null
     and (new.role is distinct from old.role or new.is_owner is distinct from old.is_owner)
     and not public.is_owner() then
    raise exception 'forbidden';
  end if;
  return new;
end $$;

drop trigger if exists guard_profile_role on public.profiles;
create trigger guard_profile_role before update on public.profiles
  for each row execute function public.guard_profile_role();
