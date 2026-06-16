-- Ubah satuan rokok dari bal/slop menjadi slop/pcs.
-- Jalankan di Supabase SQL Editor setelah data rokok sudah masuk.
--
-- Aturan:
-- 1 slop = 10 pcs.
-- Harga besar menjadi harga slop.
-- Harga kecil menjadi estimasi harga pcs dari harga slop / 10.
-- Stok yang sebelumnya tersimpan dalam slop akan dikali 10 menjadi pcs.
--
-- Aman dijalankan ulang: perhitungan harga/stok hanya dilakukan kalau data masih bal/slop.

update products
set
  stock_small = case
    when big_unit = 'bal' and small_unit = 'slop' then stock_small * 10
    else stock_small
  end,
  cost = case
    when big_unit = 'bal' and small_unit = 'slop' and cost > 0 then ceil(cost / 10.0)
    else cost
  end,
  price_big = case
    when big_unit = 'bal' and small_unit = 'slop' then price_small
    else price_big
  end,
  price_small = case
    when big_unit = 'bal' and small_unit = 'slop' and price_small > 0 then ceil(price_small / 10.0)
    else price_small
  end,
  price_member1_big = case
    when big_unit = 'bal' and small_unit = 'slop' then price_member1_small
    else price_member1_big
  end,
  price_member1_small = case
    when big_unit = 'bal' and small_unit = 'slop' and price_member1_small > 0 then ceil(price_member1_small / 10.0)
    else price_member1_small
  end,
  price_member2_big = case
    when big_unit = 'bal' and small_unit = 'slop' then price_member2_small
    else price_member2_big
  end,
  price_member2_small = case
    when big_unit = 'bal' and small_unit = 'slop' and price_member2_small > 0 then ceil(price_member2_small / 10.0)
    else price_member2_small
  end,
  big_unit = 'slop',
  small_unit = 'pcs',
  content_per_big = 10,
  updated_at = now()
where category = 'Rokok';

select
  category,
  big_unit,
  small_unit,
  content_per_big,
  count(*) as jumlah
from products
where category = 'Rokok'
group by category, big_unit, small_unit, content_per_big
order by category, big_unit, small_unit;
