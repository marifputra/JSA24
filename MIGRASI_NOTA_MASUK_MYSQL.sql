-- Jalankan satu kali pada database MySQL JSA1980 sebelum fitur Nota Masuk dipakai.
CREATE TABLE purchase_receipts (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  receipt_date DATE NOT NULL,
  invoice_number VARCHAR(100) NOT NULL DEFAULT '',
  supplier_name VARCHAR(255) NOT NULL,
  total DECIMAL(16,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX purchase_receipts_date_idx (receipt_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE purchase_receipt_items (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  receipt_id BIGINT UNSIGNED NOT NULL,
  product_id BIGINT NOT NULL,
  product_name VARCHAR(255) NOT NULL,
  quantity DECIMAL(16,2) NOT NULL,
  unit VARCHAR(80) NOT NULL DEFAULT 'pcs',
  unit_cost DECIMAL(16,2) NOT NULL DEFAULT 0,
  line_total DECIMAL(16,2) NOT NULL DEFAULT 0,
  INDEX purchase_receipt_items_receipt_idx (receipt_id),
  INDEX purchase_receipt_items_product_idx (product_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
