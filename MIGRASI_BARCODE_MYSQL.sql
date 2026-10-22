-- Jalankan satu kali pada database MySQL/MariaDB JSA online sebelum deploy.
ALTER TABLE products ADD COLUMN barcode VARCHAR(100) NULL;
CREATE UNIQUE INDEX products_barcode_unique_idx ON products (barcode);
