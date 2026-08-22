-- ============================================================================
--  Sample data for local development and demonstration.
--
--  Usage:
--     mysql -u root -p < db/schema.sql
--     mysql -u root -p < db/seed.sql
--
--  Every student below has the password:  Password@123
--  The bcrypt digest is committed rather than the plaintext, so the seed file
--  mirrors how real rows are stored. Regenerate with `npm run hash -- <pw>`.
-- ============================================================================

USE college_payment_portal;

INSERT INTO colleges (code, name, city) VALUES
  ('RAIT',  'Ramrao Adik Institute of Technology', 'Navi Mumbai'),
  ('DYPCE', 'D. Y. Patil College of Engineering',  'Pune'),
  ('SIT',   'Symbiosis Institute of Technology',   'Pune');

INSERT INTO students
  (roll_no, name, email, password_hash, course, division, college_id)
VALUES
  ('22CE1042', 'Deeptanshu Lal',  'deeptanshu@example.edu',
   '$2b$12$UcEiq7qg9fA4nTkNO0Zl.u64Aal80k9SYO5MlKIoFpX.wa5QCPMKi',
   'Computer Engineering', 'A', 1),
  ('22CE1043', 'Aarav Sharma',    'aarav@example.edu',
   '$2b$12$UcEiq7qg9fA4nTkNO0Zl.u64Aal80k9SYO5MlKIoFpX.wa5QCPMKi',
   'Computer Engineering', 'A', 1),
  ('22IT2010', 'Priya Nair',      'priya@example.edu',
   '$2b$12$UcEiq7qg9fA4nTkNO0Zl.u64Aal80k9SYO5MlKIoFpX.wa5QCPMKi',
   'Information Technology', 'B', 2);

-- Semester 1 is settled, semester 2 is partly paid, semester 3 is outstanding
-- and past its due date -- enough variety to demonstrate every UI state.
INSERT INTO fees
  (student_id, semester, academic_year, tuition_amount, fine_amount,
   scholarship, amount_paid, due_date)
VALUES
  (1, 1, '2022-23', 325000.00,     0.00, 25000.00, 300000.00, '2022-08-15'),
  (1, 2, '2022-23', 325000.00,     0.00, 25000.00, 150000.00, '2023-01-15'),
  (1, 3, '2023-24', 340000.00,  5000.00, 25000.00,      0.00, '2023-08-15'),
  (2, 1, '2022-23', 325000.00,     0.00,     0.00, 325000.00, '2022-08-15'),
  (2, 2, '2022-23', 325000.00,  2500.00,     0.00,      0.00, '2023-01-15'),
  (3, 1, '2022-23', 298000.00,     0.00, 50000.00, 248000.00, '2022-08-20');

INSERT INTO payments
  (reference, fee_id, student_id, amount, currency, method, status,
   gateway, completed_at)
VALUES
  ('PAY22AUG0001RAIT000001', 1, 1, 300000.00, 'INR', 'netbanking',
   'successful', 'sandbox', '2022-08-11 10:24:00'),
  ('PAY23JAN0002RAIT000002', 2, 1, 150000.00, 'INR', 'upi',
   'successful', 'sandbox', '2023-01-09 18:02:00'),
  ('PAY22AUG0003RAIT000003', 4, 2, 325000.00, 'INR', 'card',
   'successful', 'sandbox', '2022-08-14 09:15:00'),
  ('PAY22AUG0004DYPCE00004', 6, 3, 248000.00, 'INR', 'card',
   'successful', 'sandbox', '2022-08-18 14:40:00');
