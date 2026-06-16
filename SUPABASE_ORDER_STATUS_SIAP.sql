-- Tambah status order untuk menandai belanjaan sudah disiapkan.
-- Jalankan sekali di Supabase SQL Editor.

alter table orders add column if not exists prepared boolean not null default false;

select id, date, member_name, prepared
from orders
order by id desc
limit 10;
