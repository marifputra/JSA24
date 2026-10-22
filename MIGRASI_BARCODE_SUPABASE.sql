-- Jalankan satu kali di Supabase SQL Editor bila database lama sudah punya tabel products.
ALTER TABLE products ADD COLUMN IF NOT EXISTS barcode text;
CREATE UNIQUE INDEX IF NOT EXISTS products_barcode_unique_idx
  ON products (barcode)
  WHERE barcode IS NOT NULL AND barcode <> '';
