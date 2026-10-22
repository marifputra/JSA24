-- Jalankan satu kali pada Supabase SQL Editor sebelum deploy versi ini.
alter table products
  add column if not exists supplier_name text not null default '';
