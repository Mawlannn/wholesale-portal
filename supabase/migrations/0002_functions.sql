-- =====================================================================
-- 业务函数：所有涉及库存、金额的操作都在数据库事务里完成，保证不会出错
-- =====================================================================

-- ---------- 身份辅助 ----------
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin');
$$;

create or replace function public.my_customer_id() returns uuid
language sql stable security definer set search_path = public as $$
  select customer_id from profiles where id = auth.uid();
$$;

create or replace function public.i_am_owner() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select member_role = 'owner' from profiles where id = auth.uid()), false);
$$;

create or replace function public.log_audit(p_action text, p_entity text, p_entity_id text, p_detail jsonb default '{}'::jsonb)
returns void language sql security definer set search_path = public as $$
  insert into audit_logs (actor_id, action, entity, entity_id, detail)
  values (auth.uid(), p_action, p_entity, p_entity_id, coalesce(p_detail, '{}'::jsonb));
$$;

create or replace function public.require_admin() returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'forbidden'; end if;
end $$;

-- 日本时区的“今天”
create or replace function public.jp_today() returns date
language sql stable as $$ select (now() at time zone 'Asia/Tokyo')::date $$;

-- ---------- 新用户注册 → 自动建立客户资料（待审核） ----------
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  m   jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  cid uuid;
  loc text := nullif(m->>'locale', '');
begin
  if loc not in ('ja','zh','en') then loc := null; end if;
  if coalesce(m->>'company_name', '') <> '' then
    insert into customers (company_name, contact_name, phone, email, postal_code, address, invoice_reg_no, note)
    values (m->>'company_name', m->>'contact_name', m->>'phone', new.email,
            m->>'postal_code', m->>'address', nullif(m->>'invoice_reg_no', ''), m->>'note')
    returning id into cid;
    insert into customer_addresses (customer_id, label, recipient, phone, postal_code, address, is_default)
    values (cid, m->>'company_name', m->>'contact_name', m->>'phone', m->>'postal_code', coalesce(m->>'address', ''), true);
  end if;
  insert into profiles (id, role, customer_id, display_name, email, locale)
  values (new.id, 'customer', cid, m->>'contact_name', new.email, loc);
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users for each row execute function public.handle_new_user();

-- ---------- 库存视图 ----------
-- 实际库存 on_hand、锁定 reserved（待确认+已确认订单）、可售 available
create or replace view public.product_stock with (security_invoker = true) as
select p.id as product_id,
       coalesce(l.on_hand, 0)::int  as on_hand,
       coalesce(r.reserved, 0)::int as reserved,
       greatest(coalesce(l.on_hand, 0) - coalesce(r.reserved, 0), 0)::int as available,
       l.nearest_expiry
from products p
left join (select product_id, sum(qty_on_hand) as on_hand,
                  min(expiry_date) filter (where qty_on_hand > 0) as nearest_expiry
           from lots group by product_id) l on l.product_id = p.id
left join (select oi.product_id, sum(oi.qty_cases) as reserved
           from order_items oi join orders o on o.id = oi.order_id
           where o.status in ('pending','confirmed')
           group by oi.product_id) r on r.product_id = p.id;

-- 某商品可售数量（可排除某张订单自身的锁定，用于修改订单）
create or replace function public.stock_available(p_product_id uuid, p_exclude_order uuid default null)
returns int language sql stable security definer set search_path = public as $$
  select (coalesce((select sum(qty_on_hand) from lots where product_id = p_product_id), 0)
        - coalesce((select sum(oi.qty_cases) from order_items oi join orders o on o.id = oi.order_id
                     where oi.product_id = p_product_id and o.status in ('pending','confirmed')
                       and (p_exclude_order is null or o.id <> p_exclude_order)), 0))::int;
$$;

-- ---------- 客户可见的商品目录（含专属价格、可售库存、收藏） ----------
create or replace function public.get_catalog()
returns table (
  id uuid, sku text, name_ja text, name_zh text, name_en text, description text,
  category text, brand text, origin_country text, unit_per_case int, price numeric,
  base_price numeric, tax_rate int, min_order_qty int, image_url text,
  available int, nearest_expiry date, is_favorite boolean, in_cart int
)
language plpgsql stable security definer set search_path = public as $$
declare cid uuid := my_customer_id();
begin
  if not is_admin() and not exists (select 1 from customers c where c.id = cid and c.status = 'approved') then
    raise exception 'not_approved';
  end if;
  return query
  select p.id, p.sku, p.name_ja, p.name_zh, p.name_en, p.description, p.category, p.brand, p.origin_country,
         p.unit_per_case, coalesce(cp.price_per_case, p.price_per_case), p.price_per_case, p.tax_rate,
         p.min_order_qty, p.image_url, s.available, s.nearest_expiry,
         (f.product_id is not null), coalesce(ci.qty_cases, 0)
  from products p
  join product_stock s on s.product_id = p.id
  left join customer_prices cp on cp.product_id = p.id and cp.customer_id = cid
  left join favorites f on f.product_id = p.id and f.customer_id = cid
  left join cart_items ci on ci.product_id = p.id and ci.customer_id = cid
  where p.is_active
  order by p.category nulls last, p.sku;
end $$;

-- ---------- 订单金额（インボイス：每张单据每个税率只做一次端数处理，切捨て） ----------
create or replace function public.recalc_order_totals(p_order_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare s8 numeric; s10 numeric;
begin
  select coalesce(sum(line_total) filter (where tax_rate = 8), 0),
         coalesce(sum(line_total) filter (where tax_rate = 10), 0)
    into s8, s10 from order_items where order_id = p_order_id;
  update orders set subtotal_8 = s8, subtotal_10 = s10,
                    tax_8 = floor(s8 * 0.08), tax_10 = floor(s10 * 0.10),
                    total = s8 + s10 + floor(s8 * 0.08) + floor(s10 * 0.10)
   where id = p_order_id;
end $$;

-- ---------- 客户欠款情况 ----------
-- 返回：outstanding 未收应收；credit 未抵扣余额（多付）；open_orders 未发货订单金额；exposure 风险敞口
create or replace function public.customer_position(p_customer_id uuid)
returns table (outstanding numeric, overdue numeric, credit numeric, open_orders numeric, exposure numeric)
language plpgsql stable security definer set search_path = public as $$
declare o numeric; od numeric; cr numeric; op numeric;
begin
  if not is_admin() and (p_customer_id is distinct from my_customer_id()) then raise exception 'forbidden'; end if;
  select coalesce(sum(amount - paid_amount), 0),
         coalesce(sum(amount - paid_amount) filter (where due_date < jp_today()), 0)
    into o, od from receivables where customer_id = p_customer_id;
  select coalesce(sum(p.amount), 0) - coalesce((select sum(pa.amount) from payment_allocations pa
                                                 join payments p2 on p2.id = pa.payment_id
                                                 where p2.customer_id = p_customer_id and not p2.is_void), 0)
    into cr from payments p where p.customer_id = p_customer_id and not p.is_void;
  select coalesce(sum(total), 0) into op from orders
   where customer_id = p_customer_id and status in ('pending','confirmed');
  return query select o, od, cr, op, (o + op - cr);
end $$;

create or replace function public.check_credit_limit(p_customer_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare lim numeric; ex numeric;
begin
  select credit_limit into lim from customers where id = p_customer_id;
  if lim is null then return; end if;
  select exposure into ex from customer_position(p_customer_id);
  if ex > lim then raise exception 'credit_limit_exceeded'; end if;
end $$;

-- ---------- 写入订单明细（下单、修改共用） ----------
create or replace function public.write_order_items(p_order_id uuid, p_customer_id uuid, p_items jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare it record; prod products; price numeric; avail int; n int := 0;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'empty_order';
  end if;
  -- 锁住相关商品，防止两个客户同时下单导致超卖
  perform 1 from products where id in (select (e->>'product_id')::uuid from jsonb_array_elements(p_items) e)
    order by id for update;
  for it in
    select (e->>'product_id')::uuid as pid, sum((e->>'qty')::int) as qty
    from jsonb_array_elements(p_items) e group by 1
  loop
    if it.qty is null or it.qty <= 0 then raise exception 'invalid_qty'; end if;
    select * into prod from products where id = it.pid and is_active;
    if not found then raise exception 'product_unavailable'; end if;
    if it.qty < prod.min_order_qty then raise exception 'below_min_qty:%', prod.sku; end if;
    avail := stock_available(it.pid, p_order_id);
    if it.qty > avail then raise exception 'insufficient_stock:%', prod.sku; end if;
    select coalesce((select price_per_case from customer_prices where customer_id = p_customer_id and product_id = it.pid),
                    prod.price_per_case) into price;
    insert into order_items (order_id, product_id, sku, name_ja, name_zh, name_en, unit_per_case, qty_cases, unit_price, tax_rate, line_total)
    values (p_order_id, it.pid, prod.sku, prod.name_ja, prod.name_zh, prod.name_en, prod.unit_per_case,
            it.qty, price, prod.tax_rate, price * it.qty);
    n := n + 1;
  end loop;
  if n = 0 then raise exception 'empty_order'; end if;
  perform recalc_order_totals(p_order_id);
end $$;

-- ---------- 客户下单 ----------
create or replace function public.place_order(
  p_items jsonb, p_address_id uuid, p_delivery_date date default null, p_note text default null,
  p_customer_id uuid default null           -- 管理员代客下单时使用
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  cid uuid := my_customer_id();
  c   customers;
  a   customer_addresses;
  oid uuid;
begin
  if is_admin() and p_customer_id is not null then cid := p_customer_id; end if;
  select * into c from customers where id = cid;
  if not found or c.status <> 'approved' then raise exception 'not_approved'; end if;
  select * into a from customer_addresses where id = p_address_id and customer_id = cid;
  if not found then raise exception 'invalid_address'; end if;
  if p_delivery_date is not null and p_delivery_date < jp_today() then raise exception 'invalid_delivery_date'; end if;

  insert into orders (order_no, customer_id, ship_label, ship_recipient, ship_phone, ship_postal_code, ship_address,
                      delivery_date, note, created_by)
  values ('O' || to_char(now() at time zone 'Asia/Tokyo', 'YYMMDD') || '-' || lpad(nextval('order_seq')::text, 5, '0'),
          cid, a.label, a.recipient, a.phone, a.postal_code, a.address, p_delivery_date, nullif(p_note, ''), auth.uid())
  returning id into oid;

  perform write_order_items(oid, cid, p_items);
  perform check_credit_limit(cid);
  delete from cart_items where customer_id = cid
    and product_id in (select (e->>'product_id')::uuid from jsonb_array_elements(p_items) e);
  perform log_audit('order.place', 'order', oid::text, jsonb_build_object('items', p_items));
  return oid;
end $$;

-- ---------- 修改待确认订单 ----------
create or replace function public.update_pending_order(
  p_order_id uuid, p_items jsonb, p_delivery_date date default null, p_note text default null
) returns void
language plpgsql security definer set search_path = public as $$
declare o orders;
begin
  select * into o from orders where id = p_order_id for update;
  if not found then raise exception 'not_found'; end if;
  if not is_admin() and o.customer_id is distinct from my_customer_id() then raise exception 'forbidden'; end if;
  if o.status <> 'pending' then raise exception 'order_locked'; end if;
  delete from order_items where order_id = p_order_id;
  perform write_order_items(p_order_id, o.customer_id, p_items);
  update orders set delivery_date = p_delivery_date, note = nullif(p_note, '') where id = p_order_id;
  perform check_credit_limit(o.customer_id);
  perform log_audit('order.update', 'order', p_order_id::text, jsonb_build_object('items', p_items));
end $$;

-- ---------- 取消订单 ----------
-- 客户：待确认 → 直接取消；已确认 → 提交取消申请
-- 管理员：待确认/已确认 → 直接取消
-- 返回 {result: 'cancelled'|'requested', notify_courier: bool}
create or replace function public.cancel_order(p_order_id uuid, p_reason text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare o orders; admin boolean := is_admin();
begin
  select * into o from orders where id = p_order_id for update;
  if not found then raise exception 'not_found'; end if;
  if not admin and o.customer_id is distinct from my_customer_id() then raise exception 'forbidden'; end if;
  if o.status in ('shipped','cancelled') then raise exception 'order_locked'; end if;

  if o.status = 'pending' or admin then
    update orders set status = 'cancelled', cancelled_at = now(), cancel_requested = false,
                      cancel_reason = coalesce(nullif(p_reason, ''), cancel_reason)
     where id = p_order_id;
    perform log_audit('order.cancel', 'order', p_order_id::text, jsonb_build_object('reason', p_reason, 'from', o.status));
    return jsonb_build_object('result', 'cancelled', 'notify_courier', o.courier_notified_at is not null);
  end if;

  update orders set cancel_requested = true, cancel_reason = nullif(p_reason, '') where id = p_order_id;
  perform log_audit('order.cancel_request', 'order', p_order_id::text, jsonb_build_object('reason', p_reason));
  return jsonb_build_object('result', 'requested', 'notify_courier', false);
end $$;

create or replace function public.reject_cancel_request(p_order_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform require_admin();
  update orders set cancel_requested = false where id = p_order_id and status = 'confirmed';
  perform log_audit('order.cancel_reject', 'order', p_order_id::text);
end $$;

-- ---------- 管理员确认订单（之后由程序发送快递邮件） ----------
create or replace function public.confirm_order(p_order_id uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare o orders; tok uuid;
begin
  perform require_admin();
  select * into o from orders where id = p_order_id for update;
  if not found then raise exception 'not_found'; end if;
  if o.status <> 'pending' then raise exception 'order_locked'; end if;
  tok := gen_random_uuid();
  update orders set status = 'confirmed', confirmed_at = now(), courier_token = tok where id = p_order_id;
  perform log_audit('order.confirm', 'order', p_order_id::text);
  return tok;
end $$;

create or replace function public.mark_courier_notified(p_order_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform require_admin();
  update orders set courier_notified_at = now() where id = p_order_id;
end $$;

-- ---------- 应收：重新计算已付金额 ----------
create or replace function public.refresh_receivable(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare paid numeric; amt numeric;
begin
  select coalesce(sum(pa.amount), 0) into paid
    from payment_allocations pa join payments p on p.id = pa.payment_id
   where pa.receivable_id = p_id and not p.is_void;
  select amount into amt from receivables where id = p_id;
  update receivables set paid_amount = paid,
         status = case when paid >= amt then 'paid' when paid > 0 then 'partial' else 'unpaid' end
   where id = p_id;
end $$;

-- 把付款金额分配到应收（按指定顺序）。返回分配掉的金额
create or replace function public.allocate_payment(p_payment_id uuid, p_receivable_ids uuid[]) returns numeric
language plpgsql security definer set search_path = public as $$
declare
  pay payments; remaining numeric; r record; take numeric; used numeric := 0;
begin
  select * into pay from payments where id = p_payment_id;
  if pay.is_void then return 0; end if;
  remaining := pay.amount - coalesce((select sum(amount) from payment_allocations where payment_id = p_payment_id), 0);
  for r in
    select id, amount - paid_amount as due from receivables
     where customer_id = pay.customer_id and amount > paid_amount
       and (p_receivable_ids is null or id = any(p_receivable_ids))
     order by due_date, created_at
     for update
  loop
    exit when remaining <= 0;
    take := least(remaining, r.due);
    insert into payment_allocations (payment_id, receivable_id, amount) values (p_payment_id, r.id, take);
    perform refresh_receivable(r.id);
    remaining := remaining - take;
    used := used + take;
  end loop;
  return used;
end $$;

-- 用客户的余额（多付的钱）自动抵扣最早的欠款
create or replace function public.apply_credit(p_customer_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare p record;
begin
  for p in select id from payments where customer_id = p_customer_id and not is_void order by paid_on, created_at loop
    perform allocate_payment(p.id, null);
  end loop;
end $$;

-- ---------- 发货（扣库存：先过期先出 FEFO，生成应收） ----------
create or replace function public.ship_order_internal(p_order_id uuid, p_tracking text, p_source text) returns void
language plpgsql security definer set search_path = public as $$
declare
  o orders; it record; l record; need int; take int; c customers; terms int; ship_day date;
begin
  select * into o from orders where id = p_order_id for update;
  if not found then raise exception 'not_found'; end if;
  if o.status <> 'confirmed' then raise exception 'order_not_confirmed'; end if;

  for it in select * from order_items where order_id = p_order_id loop
    need := it.qty_cases;
    for l in select id, qty_on_hand from lots
              where product_id = it.product_id and qty_on_hand > 0
              order by expiry_date nulls last, received_at, created_at
              for update
    loop
      exit when need <= 0;
      take := least(need, l.qty_on_hand);
      update lots set qty_on_hand = qty_on_hand - take where id = l.id;
      insert into order_allocations (order_item_id, lot_id, qty) values (it.id, l.id, take);
      insert into inventory_movements (product_id, lot_id, kind, qty, order_id, note, actor_id)
      values (it.product_id, l.id, 'outbound', -take, p_order_id, o.order_no, auth.uid());
      need := need - take;
    end loop;
    if need > 0 then raise exception 'insufficient_stock:%', it.sku; end if;
  end loop;

  update orders set status = 'shipped', shipped_at = now(), cancel_requested = false,
                    tracking_no = coalesce(nullif(p_tracking, ''), tracking_no)
   where id = p_order_id;

  -- 生成应收：当月结账，付款期限 = 当月最后一天 + N 天
  select * into c from customers where id = o.customer_id;
  select coalesce(c.payment_terms_days, s.default_payment_terms_days) into terms from settings s where s.id = 1;
  ship_day := jp_today();
  insert into receivables (order_id, customer_id, amount, billing_month, due_date)
  values (p_order_id, o.customer_id, o.total, to_char(ship_day, 'YYYY-MM'),
          (date_trunc('month', ship_day) + interval '1 month' - interval '1 day')::date + terms);
  perform apply_credit(o.customer_id);
  perform log_audit('order.ship', 'order', p_order_id::text, jsonb_build_object('tracking', p_tracking, 'source', p_source));
end $$;

create or replace function public.admin_mark_shipped(p_order_id uuid, p_tracking text default null) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform require_admin();
  perform ship_order_internal(p_order_id, p_tracking, 'admin');
end $$;

-- ---------- 快递商确认页面（凭邮件里的链接，无需登录） ----------
create or replace function public.courier_get_order(p_token uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare o orders; s settings;
begin
  select * into o from orders where courier_token = p_token;
  if not found then return null; end if;
  select * into s from settings where id = 1;
  return jsonb_build_object(
    'order_no', o.order_no, 'status', o.status, 'cancel_requested', o.cancel_requested,
    'ship_label', o.ship_label, 'ship_recipient', o.ship_recipient, 'ship_phone', o.ship_phone,
    'ship_postal_code', o.ship_postal_code, 'ship_address', o.ship_address,
    'delivery_date', o.delivery_date, 'note', o.note, 'tracking_no', o.tracking_no, 'shipped_at', o.shipped_at,
    'company_name', s.company_name,
    'items', (select coalesce(jsonb_agg(jsonb_build_object('sku', sku, 'name', name_ja, 'qty', qty_cases,
                                                            'unit_per_case', unit_per_case) order by sku), '[]'::jsonb)
              from order_items where order_id = o.id));
end $$;

create or replace function public.courier_confirm(p_token uuid, p_tracking text) returns text
language plpgsql security definer set search_path = public as $$
declare o orders;
begin
  select * into o from orders where courier_token = p_token for update;
  if not found then raise exception 'not_found'; end if;
  if o.status = 'shipped' then return 'already_shipped'; end if;
  if o.status <> 'confirmed' then raise exception 'order_not_confirmed'; end if;
  perform ship_order_internal(o.id, p_tracking, 'courier');
  return 'shipped';
end $$;

-- ---------- 入库 / 盘点 ----------
create or replace function public.receive_lot(
  p_product_id uuid, p_lot_no text, p_qty int, p_expiry date default null,
  p_unit_cost numeric default null, p_received_at date default null, p_note text default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare lid uuid;
begin
  perform require_admin();
  if p_qty is null or p_qty <= 0 then raise exception 'invalid_qty'; end if;
  insert into lots (product_id, lot_no, expiry_date, received_at, qty_received, qty_on_hand, unit_cost, note)
  values (p_product_id, coalesce(nullif(p_lot_no, ''), to_char(jp_today(), 'YYYYMMDD')), p_expiry,
          coalesce(p_received_at, jp_today()), p_qty, p_qty, p_unit_cost, p_note)
  returning id into lid;
  insert into inventory_movements (product_id, lot_id, kind, qty, note, actor_id)
  values (p_product_id, lid, 'inbound', p_qty, p_note, auth.uid());
  perform log_audit('stock.inbound', 'lot', lid::text, jsonb_build_object('product_id', p_product_id, 'qty', p_qty, 'lot_no', p_lot_no));
  return lid;
end $$;

create or replace function public.adjust_lot(p_lot_id uuid, p_new_qty int, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare l lots; diff int;
begin
  perform require_admin();
  if p_new_qty is null or p_new_qty < 0 then raise exception 'invalid_qty'; end if;
  if coalesce(p_reason, '') = '' then raise exception 'reason_required'; end if;
  select * into l from lots where id = p_lot_id for update;
  if not found then raise exception 'not_found'; end if;
  diff := p_new_qty - l.qty_on_hand;
  if diff = 0 then return; end if;
  update lots set qty_on_hand = p_new_qty where id = p_lot_id;
  insert into inventory_movements (product_id, lot_id, kind, qty, note, actor_id)
  values (l.product_id, p_lot_id, 'adjust', diff, p_reason, auth.uid());
  perform log_audit('stock.adjust', 'lot', p_lot_id::text, jsonb_build_object('from', l.qty_on_hand, 'to', p_new_qty, 'reason', p_reason));
end $$;

-- ---------- 付款登记 / 结清 ----------
-- p_receivable_ids：指定结清哪几笔订单；p_month：结清某个月；都不填 = 自动从最早的欠款开始抵扣
-- 多付的部分保留为余额，以后自动抵扣
create or replace function public.record_payment(
  p_customer_id uuid, p_amount numeric, p_paid_on date default null, p_method text default 'bank',
  p_note text default null, p_receivable_ids uuid[] default null, p_month text default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare pid uuid; ids uuid[] := p_receivable_ids;
begin
  perform require_admin();
  if p_amount is null or p_amount <= 0 then raise exception 'invalid_amount'; end if;
  insert into payments (customer_id, paid_on, amount, method, note, created_by)
  values (p_customer_id, coalesce(p_paid_on, jp_today()), p_amount, coalesce(p_method, 'bank'), nullif(p_note, ''), auth.uid())
  returning id into pid;
  if p_month is not null then
    select array_agg(id) into ids from receivables where customer_id = p_customer_id and billing_month = p_month;
  end if;
  if ids is not null then perform allocate_payment(pid, ids); end if;
  perform apply_credit(p_customer_id);
  perform log_audit('payment.record', 'payment', pid::text,
    jsonb_build_object('customer_id', p_customer_id, 'amount', p_amount, 'method', p_method, 'month', p_month, 'receivables', ids));
  return pid;
end $$;

-- 作废付款（录错时使用，不删除，留下记录）
create or replace function public.void_payment(p_payment_id uuid, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare pay payments; r record;
begin
  perform require_admin();
  if coalesce(p_reason, '') = '' then raise exception 'reason_required'; end if;
  select * into pay from payments where id = p_payment_id for update;
  if not found then raise exception 'not_found'; end if;
  if pay.is_void then return; end if;
  update payments set is_void = true, void_reason = p_reason, voided_at = now() where id = p_payment_id;
  for r in select distinct receivable_id from payment_allocations where payment_id = p_payment_id loop
    perform refresh_receivable(r.receivable_id);
  end loop;
  perform apply_credit(pay.customer_id);
  perform log_audit('payment.void', 'payment', p_payment_id::text, jsonb_build_object('reason', p_reason, 'amount', pay.amount));
end $$;

-- ---------- 客户维护自己的资料 ----------
create or replace function public.update_my_company(
  p_contact_name text, p_phone text, p_postal_code text, p_address text, p_invoice_reg_no text
) returns void language plpgsql security definer set search_path = public as $$
declare cid uuid := my_customer_id();
begin
  if cid is null or not i_am_owner() then raise exception 'forbidden'; end if;
  update customers set contact_name = p_contact_name, phone = p_phone, postal_code = p_postal_code,
                       address = p_address, invoice_reg_no = nullif(p_invoice_reg_no, '')
   where id = cid;
  perform log_audit('customer.self_update', 'customer', cid::text);
end $$;

create or replace function public.set_my_locale(p_locale text) returns void
language sql security definer set search_path = public as $$
  update profiles set locale = case when p_locale in ('ja','zh','en') then p_locale end where id = auth.uid();
$$;

-- ---------- 管理员：审核客户 ----------
create or replace function public.set_customer_status(p_customer_id uuid, p_status text) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform require_admin();
  update customers set status = p_status,
         approved_at = case when p_status = 'approved' then coalesce(approved_at, now()) else approved_at end
   where id = p_customer_id;
  perform log_audit('customer.status', 'customer', p_customer_id::text, jsonb_build_object('status', p_status));
end $$;

-- ---------- 召回追溯：某批次发给了哪些客户 ----------
create or replace function public.recall_lookup(p_lot_no text)
returns table (lot_id uuid, lot_no text, sku text, product_name text, expiry_date date,
               order_no text, shipped_at timestamptz, qty int,
               customer_id uuid, company_name text, contact_name text, phone text, email text, ship_address text)
language plpgsql stable security definer set search_path = public as $$
begin
  perform require_admin();
  return query
  select l.id, l.lot_no, p.sku, p.name_ja, l.expiry_date, o.order_no, o.shipped_at, oa.qty,
         c.id, c.company_name, c.contact_name, c.phone, c.email, o.ship_address
  from lots l
  join products p on p.id = l.product_id
  join order_allocations oa on oa.lot_id = l.id
  join order_items oi on oi.id = oa.order_item_id
  join orders o on o.id = oi.order_id
  join customers c on c.id = o.customer_id
  where l.lot_no ilike p_lot_no
  order by c.company_name, o.shipped_at;
end $$;

-- ---------- 管理员首页统计 ----------
create or replace function public.admin_dashboard() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare s settings; res jsonb;
begin
  perform require_admin();
  select * into s from settings where id = 1;
  select jsonb_build_object(
    'pending_orders',    (select count(*) from orders where status = 'pending'),
    'cancel_requests',   (select count(*) from orders where status = 'confirmed' and cancel_requested),
    'awaiting_shipment', (select count(*) from orders where status = 'confirmed'),
    'pending_customers', (select count(*) from customers where status = 'pending'),
    'outstanding',       (select coalesce(sum(amount - paid_amount), 0) from receivables),
    'overdue',           (select coalesce(sum(amount - paid_amount), 0) from receivables where due_date < jp_today()),
    'month_sales',       (select coalesce(sum(amount), 0) from receivables where billing_month = to_char(jp_today(), 'YYYY-MM')),
    'low_stock',         (select count(*) from products p join product_stock st on st.product_id = p.id
                           where p.is_active and st.available <= p.low_stock_threshold),
    'expiring_lots',     (select count(*) from lots where qty_on_hand > 0 and expiry_date is not null
                           and expiry_date <= jp_today() + s.expiry_alert_days)
  ) into res;
  return res;
end $$;

-- ---------- 报表视图（按权限自动过滤） ----------
create or replace view public.customer_balances with (security_invoker = true) as
select c.id as customer_id, c.company_name, c.status, c.credit_limit,
       coalesce(sum(r.amount - r.paid_amount), 0) as outstanding,
       coalesce(sum(r.amount - r.paid_amount) filter (where r.due_date < public.jp_today()), 0) as overdue,
       coalesce(sum(r.amount - r.paid_amount) filter (where r.due_date >= public.jp_today()), 0) as not_due,
       coalesce(sum(r.amount - r.paid_amount) filter (where r.due_date < public.jp_today() and r.due_date >= public.jp_today() - 30), 0) as overdue_1_30,
       coalesce(sum(r.amount - r.paid_amount) filter (where r.due_date < public.jp_today() - 30 and r.due_date >= public.jp_today() - 60), 0) as overdue_31_60,
       coalesce(sum(r.amount - r.paid_amount) filter (where r.due_date < public.jp_today() - 60), 0) as overdue_61_plus,
       min(r.due_date) filter (where r.amount > r.paid_amount) as oldest_due
from public.customers c
left join public.receivables r on r.customer_id = c.id
group by c.id;

create or replace view public.monthly_summary with (security_invoker = true) as
select customer_id, billing_month,
       count(*)::int as order_count,
       sum(amount) as total, sum(paid_amount) as paid, sum(amount - paid_amount) as outstanding,
       min(due_date) as due_date
from public.receivables
group by customer_id, billing_month;

-- ---------- 通用审计触发器（商品、客户、价格、设置的修改） ----------
create or replace function public.audit_row() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into audit_logs (actor_id, action, entity, entity_id, detail)
  values (auth.uid(), lower(tg_op), tg_table_name,
          coalesce((case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end)->>'id',
                   (case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end)->>'product_id'),
          case when tg_op = 'UPDATE' then jsonb_build_object('old', to_jsonb(old), 'new', to_jsonb(new))
               when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end);
  return coalesce(new, old);
end $$;
create trigger audit_products        after insert or update or delete on public.products        for each row execute function public.audit_row();
create trigger audit_customers       after update or delete           on public.customers       for each row execute function public.audit_row();
create trigger audit_customer_prices after insert or update or delete on public.customer_prices for each row execute function public.audit_row();
create trigger audit_settings        after update                     on public.settings        for each row execute function public.audit_row();
