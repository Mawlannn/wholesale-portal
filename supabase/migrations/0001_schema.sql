-- =====================================================================
-- 批发订货系统 / Wholesale Ordering Portal — 数据库结构
-- Tables, views, row-level security
-- =====================================================================

-- ---------- 系统设置（单行） ----------
create table public.settings (
  id                          int primary key default 1 check (id = 1),
  company_name                text not null default '',
  company_address             text not null default '',
  company_phone               text not null default '',
  company_email               text not null default '',
  invoice_reg_no              text not null default '',      -- 適格請求書発行事業者登録番号 (T + 13 digits)
  bank_info                   text not null default '',
  courier_name                text not null default '',
  courier_email               text not null default '',
  courier_cc                  text not null default '',
  courier_locale              text not null default 'ja' check (courier_locale in ('ja','zh','en')),
  order_cutoff                text not null default '15:00',
  default_payment_terms_days  int  not null default 30,
  expiry_alert_days           int  not null default 60,
  updated_at                  timestamptz not null default now()
);
insert into public.settings (id) values (1);

-- ---------- 客户（商店） ----------
create table public.customers (
  id                  uuid primary key default gen_random_uuid(),
  company_name        text not null,
  contact_name        text,
  phone               text,
  email               text,
  postal_code         text,
  address             text,
  invoice_reg_no      text,
  note                text,
  status              text not null default 'pending' check (status in ('pending','approved','suspended')),
  credit_limit        numeric(12,0),            -- null = 不限额
  payment_terms_days  int,                      -- null = 使用系统默认
  admin_note          text,
  created_at          timestamptz not null default now(),
  approved_at         timestamptz
);

-- ---------- 登录账号 ----------
create table public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  role          text not null default 'customer' check (role in ('admin','customer')),
  customer_id   uuid references public.customers(id) on delete set null,
  member_role   text not null default 'owner' check (member_role in ('owner','staff')),
  display_name  text,
  email         text,
  locale        text check (locale in ('ja','zh','en')),
  created_at    timestamptz not null default now()
);

-- ---------- 收货地址 ----------
create table public.customer_addresses (
  id           uuid primary key default gen_random_uuid(),
  customer_id  uuid not null references public.customers(id) on delete cascade,
  label        text not null,
  recipient    text,
  phone        text,
  postal_code  text,
  address      text not null,
  is_default   boolean not null default false,
  created_at   timestamptz not null default now()
);

-- ---------- 商品 ----------
create table public.products (
  id                   uuid primary key default gen_random_uuid(),
  sku                  text not null unique,
  name_ja              text not null,
  name_zh              text,
  name_en              text,
  description          text,
  category             text,
  brand                text,
  origin_country       text,
  unit_per_case        int not null default 1 check (unit_per_case > 0),
  price_per_case       numeric(12,0) not null check (price_per_case >= 0),   -- 税抜
  tax_rate             int not null default 8 check (tax_rate in (8,10)),     -- 食品/饮料 8%，酒类 10%
  min_order_qty        int not null default 1 check (min_order_qty > 0),
  low_stock_threshold  int not null default 0,
  image_url            text,
  is_active            boolean not null default true,
  created_at           timestamptz not null default now()
);

-- 客户专属价格
create table public.customer_prices (
  customer_id     uuid not null references public.customers(id) on delete cascade,
  product_id      uuid not null references public.products(id) on delete cascade,
  price_per_case  numeric(12,0) not null check (price_per_case >= 0),
  primary key (customer_id, product_id)
);

create table public.favorites (
  customer_id  uuid not null references public.customers(id) on delete cascade,
  product_id   uuid not null references public.products(id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (customer_id, product_id)
);

create table public.cart_items (
  customer_id  uuid not null references public.customers(id) on delete cascade,
  product_id   uuid not null references public.products(id) on delete cascade,
  qty_cases    int not null check (qty_cases > 0),
  updated_at   timestamptz not null default now(),
  primary key (customer_id, product_id)
);

-- ---------- 批次库存（入库单位） ----------
create table public.lots (
  id            uuid primary key default gen_random_uuid(),
  product_id    uuid not null references public.products(id) on delete restrict,
  lot_no        text not null,
  expiry_date   date,
  received_at   date not null default current_date,
  qty_received  int not null check (qty_received > 0),
  qty_on_hand   int not null check (qty_on_hand >= 0),
  unit_cost     numeric(12,2),      -- 每箱进货成本（含关税等诸费）
  note          text,
  created_at    timestamptz not null default now()
);
create index on public.lots (product_id, expiry_date);
create index on public.lots (lot_no);

-- 库存流水（每一次变化都记录）
create table public.inventory_movements (
  id          bigint generated always as identity primary key,
  product_id  uuid not null references public.products(id),
  lot_id      uuid references public.lots(id),
  kind        text not null check (kind in ('inbound','outbound','adjust','return')),
  qty         int not null,                -- 正数增加，负数减少
  order_id    uuid,
  note        text,
  actor_id    uuid,
  created_at  timestamptz not null default now()
);
create index on public.inventory_movements (product_id, created_at desc);

-- ---------- 订单 ----------
create sequence public.order_seq;

create table public.orders (
  id                    uuid primary key default gen_random_uuid(),
  order_no              text not null unique,
  customer_id           uuid not null references public.customers(id),
  status                text not null default 'pending'
                          check (status in ('pending','confirmed','shipped','cancelled')),
  ship_label            text,
  ship_recipient        text,
  ship_phone            text,
  ship_postal_code      text,
  ship_address          text not null,
  delivery_date         date,
  note                  text,
  subtotal_8            numeric(12,0) not null default 0,
  subtotal_10           numeric(12,0) not null default 0,
  tax_8                 numeric(12,0) not null default 0,
  tax_10                numeric(12,0) not null default 0,
  total                 numeric(12,0) not null default 0,
  cancel_requested      boolean not null default false,
  cancel_reason         text,
  courier_token         uuid unique,
  courier_notified_at   timestamptz,
  tracking_no           text,
  admin_note            text,
  created_by            uuid,
  created_at            timestamptz not null default now(),
  confirmed_at          timestamptz,
  shipped_at            timestamptz,
  cancelled_at          timestamptz
);
create index on public.orders (customer_id, created_at desc);
create index on public.orders (status);

create table public.order_items (
  id           uuid primary key default gen_random_uuid(),
  order_id     uuid not null references public.orders(id) on delete cascade,
  product_id   uuid not null references public.products(id),
  sku          text not null,
  name_ja      text not null,
  name_zh      text,
  name_en      text,
  unit_per_case int not null,
  qty_cases    int not null check (qty_cases > 0),
  unit_price   numeric(12,0) not null,
  tax_rate     int not null,
  line_total   numeric(12,0) not null
);
create index on public.order_items (order_id);
create index on public.order_items (product_id);

-- 发货时从哪个批次出的货（召回追溯用）
create table public.order_allocations (
  id             uuid primary key default gen_random_uuid(),
  order_item_id  uuid not null references public.order_items(id) on delete cascade,
  lot_id         uuid not null references public.lots(id),
  qty            int not null check (qty > 0)
);
create index on public.order_allocations (lot_id);

-- ---------- 应收账款 / 付款 ----------
create table public.receivables (
  id             uuid primary key default gen_random_uuid(),
  order_id       uuid not null unique references public.orders(id),
  customer_id    uuid not null references public.customers(id),
  amount         numeric(12,0) not null,
  paid_amount    numeric(12,0) not null default 0,
  status         text not null default 'unpaid' check (status in ('unpaid','partial','paid')),
  billing_month  text not null,          -- 'YYYY-MM'
  due_date       date not null,
  created_at     timestamptz not null default now()
);
create index on public.receivables (customer_id, status);
create index on public.receivables (customer_id, billing_month);

create table public.payments (
  id           uuid primary key default gen_random_uuid(),
  customer_id  uuid not null references public.customers(id),
  paid_on      date not null default current_date,
  amount       numeric(12,0) not null check (amount > 0),
  method       text not null default 'bank' check (method in ('bank','cash','other','adjustment')),
  note         text,
  is_void      boolean not null default false,
  void_reason  text,
  voided_at    timestamptz,
  created_by   uuid,
  created_at   timestamptz not null default now()
);
create index on public.payments (customer_id, paid_on desc);

create table public.payment_allocations (
  id             uuid primary key default gen_random_uuid(),
  payment_id     uuid not null references public.payments(id),
  receivable_id  uuid not null references public.receivables(id),
  amount         numeric(12,0) not null check (amount > 0),
  created_at     timestamptz not null default now()
);
create index on public.payment_allocations (receivable_id);
create index on public.payment_allocations (payment_id);

-- ---------- 邮件存档 / 操作日志 ----------
create table public.email_log (
  id          bigint generated always as identity primary key,
  order_id    uuid references public.orders(id),
  customer_id uuid references public.customers(id),
  kind        text not null,
  to_addr     text not null,
  subject     text not null,
  body        text not null,
  status      text not null check (status in ('sent','failed','skipped')),
  error       text,
  created_at  timestamptz not null default now()
);
create index on public.email_log (order_id);

create table public.audit_logs (
  id          bigint generated always as identity primary key,
  actor_id    uuid,
  action      text not null,
  entity      text not null,
  entity_id   text,
  detail      jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index on public.audit_logs (created_at desc);
create index on public.audit_logs (entity, entity_id);

-- 电子帐簿保存法：付款、应收、邮件、日志不允许删除
create or replace function public.forbid_delete() returns trigger language plpgsql as $$
begin
  raise exception 'records_are_immutable';
end $$;
create trigger no_delete_payments    before delete on public.payments           for each row execute function public.forbid_delete();
create trigger no_delete_allocations before delete on public.payment_allocations for each row execute function public.forbid_delete();
create trigger no_delete_receivables before delete on public.receivables        for each row execute function public.forbid_delete();
create trigger no_delete_email_log   before delete on public.email_log          for each row execute function public.forbid_delete();
create trigger no_delete_audit       before delete on public.audit_logs         for each row execute function public.forbid_delete();
create trigger no_update_audit       before update on public.audit_logs         for each row execute function public.forbid_delete();
create trigger no_update_email_log   before update on public.email_log          for each row execute function public.forbid_delete();
