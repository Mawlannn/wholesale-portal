-- 示例商品（可选，用于试用。正式使用前可以在后台删除或下架）
insert into public.products (sku, name_ja, name_zh, name_en, category, brand, origin_country, unit_per_case, price_per_case, tax_rate, min_order_qty, low_stock_threshold) values
  ('DR-MANGO-330', 'マンゴージュース 330ml', '芒果汁 330ml', 'Mango Juice 330ml', '飲料', 'Tropica', 'Thailand', 24, 2980, 8, 1, 10),
  ('DR-COCO-500',  'ココナッツウォーター 500ml', '椰子水 500ml', 'Coconut Water 500ml', '飲料', 'Tropica', 'Vietnam', 24, 3600, 8, 1, 10),
  ('SN-CHIPS-80',  'キャッサバチップス 80g', '木薯片 80g', 'Cassava Chips 80g', 'スナック', 'Crunchy', 'Indonesia', 30, 3150, 8, 1, 5),
  ('AL-BEER-330',  '輸入ビール 330ml', '进口啤酒 330ml', 'Imported Beer 330ml', '酒類', 'Harbor', 'Germany', 24, 5280, 10, 2, 8)
on conflict (sku) do nothing;

-- 示例入库
insert into public.lots (product_id, lot_no, expiry_date, qty_received, qty_on_hand, unit_cost)
select id, 'DEMO-01', current_date + 200, 40, 40, round(price_per_case * 0.6) from public.products where sku in ('DR-MANGO-330','DR-COCO-500','SN-CHIPS-80','AL-BEER-330');
