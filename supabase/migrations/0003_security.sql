-- =====================================================================
-- 权限（Row Level Security）：客户只能看到自己的数据，管理员看全部
-- =====================================================================

alter table public.settings            enable row level security;
alter table public.customers           enable row level security;
alter table public.profiles            enable row level security;
alter table public.customer_addresses  enable row level security;
alter table public.products            enable row level security;
alter table public.customer_prices     enable row level security;
alter table public.favorites           enable row level security;
alter table public.cart_items          enable row level security;
alter table public.lots                enable row level security;
alter table public.inventory_movements enable row level security;
alter table public.orders              enable row level security;
alter table public.order_items         enable row level security;
alter table public.order_allocations   enable row level security;
alter table public.receivables         enable row level security;
alter table public.payments            enable row level security;
alter table public.payment_allocations enable row level security;
alter table public.email_log           enable row level security;
alter table public.audit_logs          enable row level security;

-- 设置：登录用户可读（请求书需要公司信息），管理员可改
create policy settings_read  on public.settings for select to authenticated using (true);
create policy settings_write on public.settings for update to authenticated using (is_admin()) with check (is_admin());

-- 客户
create policy customers_read  on public.customers for select to authenticated using (is_admin() or id = my_customer_id());
create policy customers_admin on public.customers for all    to authenticated using (is_admin()) with check (is_admin());

-- 账号
create policy profiles_read  on public.profiles for select to authenticated using (is_admin() or id = auth.uid());
create policy profiles_admin on public.profiles for update to authenticated using (is_admin()) with check (is_admin());

-- 收货地址：客户可以管理自己的地址
create policy addresses_own on public.customer_addresses for all to authenticated
  using (is_admin() or customer_id = my_customer_id())
  with check (is_admin() or customer_id = my_customer_id());

-- 商品：登录用户可读上架商品；管理员全部
create policy products_read  on public.products for select to authenticated using (is_active or is_admin());
create policy products_admin on public.products for all    to authenticated using (is_admin()) with check (is_admin());

create policy prices_read  on public.customer_prices for select to authenticated using (is_admin() or customer_id = my_customer_id());
create policy prices_admin on public.customer_prices for all    to authenticated using (is_admin()) with check (is_admin());

create policy favorites_own on public.favorites for all to authenticated
  using (customer_id = my_customer_id()) with check (customer_id = my_customer_id());
create policy cart_own on public.cart_items for all to authenticated
  using (customer_id = my_customer_id()) with check (customer_id = my_customer_id());

-- 库存批次、流水、出货批次：仅管理员
create policy lots_admin        on public.lots                for all    to authenticated using (is_admin()) with check (is_admin());
create policy movements_admin   on public.inventory_movements for select to authenticated using (is_admin());
create policy allocations_admin on public.order_allocations   for select to authenticated using (is_admin());

-- 订单：读自己的；写入必须通过函数
create policy orders_read       on public.orders      for select to authenticated using (is_admin() or customer_id = my_customer_id());
create policy orders_admin_note on public.orders      for update to authenticated using (is_admin()) with check (is_admin());
create policy order_items_read  on public.order_items for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id and (is_admin() or o.customer_id = my_customer_id())));

-- 账款：只有客户的“老板”账号能看，店员账号看不到
create policy receivables_read on public.receivables for select to authenticated
  using (is_admin() or (customer_id = my_customer_id() and i_am_owner()));
create policy payments_read on public.payments for select to authenticated
  using (is_admin() or (customer_id = my_customer_id() and i_am_owner()));
create policy pay_alloc_read on public.payment_allocations for select to authenticated
  using (exists (select 1 from public.payments p where p.id = payment_id
                 and (is_admin() or (p.customer_id = my_customer_id() and i_am_owner()))));

-- 邮件存档、日志：仅管理员
create policy email_log_read   on public.email_log  for select to authenticated using (is_admin());
create policy email_log_insert on public.email_log  for insert to authenticated with check (is_admin());
create policy audit_read       on public.audit_logs for select to authenticated using (is_admin());

-- ---------- 函数执行权限 ----------
-- 先全部收回，再逐个开放
revoke execute on all functions in schema public from public;
revoke execute on all functions in schema public from anon, authenticated;

grant execute on function public.is_admin()                to authenticated;
grant execute on function public.my_customer_id()          to authenticated;
grant execute on function public.i_am_owner()              to authenticated;
grant execute on function public.jp_today()                to authenticated, anon;
grant execute on function public.get_catalog()             to authenticated;
grant execute on function public.customer_position(uuid)   to authenticated;
grant execute on function public.place_order(jsonb, uuid, date, text, uuid)          to authenticated;
grant execute on function public.update_pending_order(uuid, jsonb, date, text)       to authenticated;
grant execute on function public.cancel_order(uuid, text)                            to authenticated;
grant execute on function public.reject_cancel_request(uuid)                         to authenticated;
grant execute on function public.confirm_order(uuid)                                 to authenticated;
grant execute on function public.mark_courier_notified(uuid)                         to authenticated;
grant execute on function public.admin_mark_shipped(uuid, text)                      to authenticated;
grant execute on function public.receive_lot(uuid, text, int, date, numeric, date, text) to authenticated;
grant execute on function public.adjust_lot(uuid, int, text)                         to authenticated;
grant execute on function public.record_payment(uuid, numeric, date, text, text, uuid[], text) to authenticated;
grant execute on function public.void_payment(uuid, text)                            to authenticated;
grant execute on function public.update_my_company(text, text, text, text, text)     to authenticated;
grant execute on function public.set_my_locale(text)                                 to authenticated;
grant execute on function public.set_customer_status(uuid, text)                     to authenticated;
grant execute on function public.recall_lookup(text)                                 to authenticated;
grant execute on function public.admin_dashboard()                                   to authenticated;
grant execute on function public.stock_available(uuid, uuid)                         to authenticated;
-- 快递商页面（不登录，凭链接里的随机令牌）
grant execute on function public.courier_get_order(uuid)                             to anon, authenticated;
grant execute on function public.courier_confirm(uuid, text)                         to anon, authenticated;

grant select on public.product_stock, public.customer_balances, public.monthly_summary to authenticated;
