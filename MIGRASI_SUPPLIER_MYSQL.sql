-- Jalankan satu kali pada database MySQL JSA1980 sebelum deploy versi ini.
ALTER TABLE products
  ADD COLUMN supplier_name VARCHAR(255) NOT NULL DEFAULT '';
