-- Jalankan satu kali SETELAH MIGRASI_NOTA_MASUK_MYSQL.sql.
-- Riwayat nota lama diberi status UNKNOWN karena status pembayarannya tidak tercatat.
ALTER TABLE purchase_receipts
  ADD COLUMN paid_amount DECIMAL(16,2) NOT NULL DEFAULT 0,
  ADD COLUMN due_date DATE NULL,
  ADD COLUMN payment_status VARCHAR(16) NOT NULL DEFAULT 'UNKNOWN';

CREATE TABLE purchase_receipt_payments (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  receipt_id BIGINT UNSIGNED NOT NULL,
  amount DECIMAL(16,2) NOT NULL,
  payment_method VARCHAR(40) NOT NULL DEFAULT 'Tunai',
  note VARCHAR(255) NOT NULL DEFAULT '',
  paid_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX purchase_receipt_payments_receipt_idx (receipt_id),
  INDEX purchase_receipt_payments_paid_at_idx (paid_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
