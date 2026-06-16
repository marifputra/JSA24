-- Ubah satuan obat-obatan menjadi lebih sederhana: pak/pcs.
-- Jalankan di Supabase SQL Editor setelah data obat-obatan sudah masuk.
--
-- Aturan:
-- Harga kecil tetap menjadi harga pcs.
-- Harga besar tetap menjadi harga pak.
-- Isi per pak tetap mengikuti data lama, misalnya 1 pak = 12 pcs / 24 pcs.
-- Stok tidak dikali, karena stok lama sudah tersimpan sebagai satuan kecil.

update products
set
  big_unit = 'pak',
  small_unit = 'pcs',
  content_per_big = case
    when content_per_big is null or content_per_big <= 0 then 1
    else content_per_big
  end,
  updated_at = now()
where category = 'Obat-obatan';

select
  category,
  big_unit,
  small_unit,
  count(*) as jumlah
from products
where category = 'Obat-obatan'
group by category, big_unit, small_unit
order by category, big_unit, small_unit;
