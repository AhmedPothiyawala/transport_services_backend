-- PostgreSQL Database Schema for Transport Management System

CREATE TABLE IF NOT EXISTS branches (
    id SERIAL PRIMARY KEY,
    branch_name VARCHAR(100) UNIQUE NOT NULL,
    city VARCHAR(100) NOT NULL,
    code VARCHAR(20) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    branch_id INT REFERENCES branches(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    mobile VARCHAR(20) UNIQUE NOT NULL,
    address TEXT,
    role VARCHAR(20) NOT NULL CHECK (role IN ('MAIN_ADMIN', 'SUB_ADMIN', 'USER', 'DRIVER')),
    password_hash VARCHAR(255),
    otp VARCHAR(6),
    is_active BOOLEAN DEFAULT TRUE,
    session_version INT DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS series_config (
    id SERIAL PRIMARY KEY,
    branch_id INT REFERENCES branches(id) ON DELETE CASCADE,
    source_city VARCHAR(100) NOT NULL,
    destination_city VARCHAR(100) NOT NULL,
    series_start INT NOT NULL,
    series_end INT NOT NULL,
    current_number INT NOT NULL,
    CONSTRAINT unique_route UNIQUE (source_city, destination_city)
);

-- Consolidated Parties Table (Consignor & Consignee Unified Database)
CREATE TABLE IF NOT EXISTS parties (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    mobile VARCHAR(20) UNIQUE NOT NULL,
    gstin VARCHAR(50),
    address TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS builtys (
    id SERIAL PRIMARY KEY,
    builty_number VARCHAR(50) UNIQUE NOT NULL,
    serial_number INT NOT NULL,
    branch_id INT REFERENCES branches(id),
    user_id INT REFERENCES users(id),
    driver_id INT REFERENCES users(id),
    source_city VARCHAR(100) NOT NULL,
    destination_city VARCHAR(100) NOT NULL,
    party_name VARCHAR(255) NOT NULL, -- Consignor / Sender Name
    sender_mobile VARCHAR(20),
    sender_gstin VARCHAR(50),
    receiver_name VARCHAR(255) NOT NULL, -- Consignee / Receiver Name
    receiver_mobile VARCHAR(20) NOT NULL,
    receiver_gstin VARCHAR(50),
    payment_status VARCHAR(20) NOT NULL CHECK (payment_status IN ('FULLY_PAID', 'PARTIALLY_PAID', 'PENDING')),
    builty_amount NUMERIC(12,2) NOT NULL,
    paid_amount NUMERIC(12,2) DEFAULT 0.00,
    pending_amount NUMERIC(12,2) DEFAULT 0.00,
    bill_type VARCHAR(20) DEFAULT 'PAKKE' CHECK (bill_type IN ('KACCHE', 'PAKKE')),
    no_of_pkt INT DEFAULT 1,
    delivered_parcels INT DEFAULT 0,
    pending_parcels INT DEFAULT 1,
    weight_kg NUMERIC(10,2) DEFAULT 0.00,
    rate_per_kg NUMERIC(10,2) DEFAULT 0.00,
    cgst_percent NUMERIC(5,2) DEFAULT 0.00,
    sgst_percent NUMERIC(5,2) DEFAULT 0.00,
    cgst_amount NUMERIC(12,2) DEFAULT 0.00,
    sgst_amount NUMERIC(12,2) DEFAULT 0.00,
    sonu_gstin VARCHAR(50) DEFAULT '24AEMFS6216C1Z6',
    terms_conditions TEXT,
    description TEXT,
    charges NUMERIC(12,2) DEFAULT 0.00,
    discount NUMERIC(12,2) DEFAULT 0.00,
    delivery_security_code VARCHAR(10) DEFAULT 'SEC123',
    is_security_code_verified BOOLEAN DEFAULT FALSE,
    status VARCHAR(30) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'BOOKED', 'IN_TRANSIT', 'PARTIALLY_DELIVERED', 'DELIVERED', 'CANCELLED')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Ensure new builtys columns exist on existing databases
ALTER TABLE builtys ADD COLUMN IF NOT EXISTS sender_mobile VARCHAR(20);
ALTER TABLE builtys ADD COLUMN IF NOT EXISTS sender_gstin VARCHAR(50);
ALTER TABLE builtys ADD COLUMN IF NOT EXISTS receiver_gstin VARCHAR(50);
ALTER TABLE builtys ADD COLUMN IF NOT EXISTS no_of_pkt INT DEFAULT 1;
ALTER TABLE builtys ADD COLUMN IF NOT EXISTS delivered_parcels INT DEFAULT 0;
ALTER TABLE builtys ADD COLUMN IF NOT EXISTS pending_parcels INT DEFAULT 1;
ALTER TABLE builtys ADD COLUMN IF NOT EXISTS rate_per_kg NUMERIC(10,2) DEFAULT 0.00;
ALTER TABLE builtys ADD COLUMN IF NOT EXISTS cgst_percent NUMERIC(5,2) DEFAULT 0.00;
ALTER TABLE builtys ADD COLUMN IF NOT EXISTS sgst_percent NUMERIC(5,2) DEFAULT 0.00;
ALTER TABLE builtys ADD COLUMN IF NOT EXISTS cgst_amount NUMERIC(12,2) DEFAULT 0.00;
ALTER TABLE builtys ADD COLUMN IF NOT EXISTS sgst_amount NUMERIC(12,2) DEFAULT 0.00;
ALTER TABLE builtys ADD COLUMN IF NOT EXISTS sonu_gstin VARCHAR(50) DEFAULT '24AEMFS6216C1Z6';
ALTER TABLE builtys ADD COLUMN IF NOT EXISTS delivery_security_code VARCHAR(10) DEFAULT 'SEC123';
ALTER TABLE builtys ADD COLUMN IF NOT EXISTS is_security_code_verified BOOLEAN DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS delivery_logs (
    id SERIAL PRIMARY KEY,
    builty_id INT REFERENCES builtys(id) ON DELETE CASCADE,
    delivery_person_name VARCHAR(150) NOT NULL,
    parcels_delivered_in_batch INT NOT NULL,
    remaining_pending_after_batch INT NOT NULL,
    delivered_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS employees (
    id SERIAL PRIMARY KEY,
    branch_id INT NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    mobile_number VARCHAR(15),
    salary NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    debt_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ledgers (
    id SERIAL PRIMARY KEY,
    party_name VARCHAR(255) NOT NULL,
    receiver_mobile VARCHAR(20),
    builty_id INT REFERENCES builtys(id) ON DELETE SET NULL,
    account_type VARCHAR(20) NOT NULL CHECK (account_type IN ('CREDIT', 'DEBIT')),
    amount NUMERIC(12,2) NOT NULL,
    balance NUMERIC(12,2) NOT NULL,
    payment_method VARCHAR(50) DEFAULT 'CASH',
    reference_number VARCHAR(100),
    collected_by VARCHAR(150),
    remarks TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE ledgers ADD COLUMN IF NOT EXISTS reference_number VARCHAR(100);
ALTER TABLE ledgers ADD COLUMN IF NOT EXISTS receiver_mobile VARCHAR(20);
ALTER TABLE ledgers ADD COLUMN IF NOT EXISTS collected_by VARCHAR(150);

CREATE TABLE IF NOT EXISTS expenses (
    id SERIAL PRIMARY KEY,
    builty_id INT REFERENCES builtys(id) ON DELETE CASCADE,
    branch_id INT REFERENCES branches(id) ON DELETE CASCADE,
    sub_admin_id INT REFERENCES users(id) ON DELETE SET NULL,
    customer_id INT REFERENCES users(id) ON DELETE SET NULL,
    expense_title VARCHAR(255) NOT NULL,
    category VARCHAR(100) DEFAULT 'MISC',
    amount NUMERIC(12,2) NOT NULL,
    expense_date DATE DEFAULT CURRENT_DATE,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS category VARCHAR(100) DEFAULT 'MISC';
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS sub_admin_id INT REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS customer_id INT REFERENCES users(id) ON DELETE SET NULL;

-- Ensure branch & active columns exist on parties
ALTER TABLE parties ADD COLUMN IF NOT EXISTS branch_id INT REFERENCES branches(id) ON DELETE SET NULL;
ALTER TABLE parties ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

-- Ensure status column exists on delivery_logs
ALTER TABLE delivery_logs ADD COLUMN IF NOT EXISTS status VARCHAR(30) DEFAULT 'DELIVERED';

-- Ensure branch columns exist on users and builtys tables
ALTER TABLE users ADD COLUMN IF NOT EXISTS branch_id INT REFERENCES branches(id) ON DELETE SET NULL;
ALTER TABLE builtys ADD COLUMN IF NOT EXISTS destination_branch_id INT REFERENCES branches(id) ON DELETE SET NULL;

-- Seed Default Branches (Ahmedabad, Delhi, Pune, Mumbai)
INSERT INTO branches (id, branch_name, city, code)
VALUES 
  (1, 'Ahmedabad Hub', 'Ahmedabad', 'AHM01'),
  (2, 'Delhi Hub', 'Delhi', 'DEL01'),
  (3, 'Pune Hub', 'Pune', 'PUN01'),
  (4, 'Mumbai Hub', 'Mumbai', 'MUM01')
ON CONFLICT (id) DO UPDATE SET branch_name = EXCLUDED.branch_name, city = EXCLUDED.city, code = EXCLUDED.code;

-- Ensure branches sequence is synchronized with seeded IDs to prevent duplicate key errors
SELECT setval('branches_id_seq', COALESCE((SELECT MAX(id) FROM branches), 1));

-- Seed Only Main Admin User (Password: "Arp@78692")
INSERT INTO users (name, mobile, address, role, branch_id, password_hash, otp) 
VALUES 
  ('Sonu Sir (Main Admin)', '9999999999', 'Headquarters, Ahmedabad', 'MAIN_ADMIN', NULL, '$2a$10$DmKZYsULTzgBsCLQEplwPeRPdcxC0wkukOYewP9lUJRsm4wm7d552', '123456')
ON CONFLICT (mobile) DO UPDATE SET password_hash = EXCLUDED.password_hash, branch_id = EXCLUDED.branch_id;

-- Database Performance Indexes for High-Speed Query Optimization
CREATE INDEX IF NOT EXISTS idx_users_mobile ON users(mobile);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_branch_id ON users(branch_id);
CREATE INDEX IF NOT EXISTS idx_parties_mobile ON parties(mobile);
CREATE INDEX IF NOT EXISTS idx_parties_name ON parties(name);
CREATE INDEX IF NOT EXISTS idx_parties_branch_id ON parties(branch_id);
CREATE INDEX IF NOT EXISTS idx_parties_is_active ON parties(is_active);
CREATE INDEX IF NOT EXISTS idx_builtys_party_name ON builtys(party_name);
CREATE INDEX IF NOT EXISTS idx_builtys_branch_id ON builtys(branch_id);
CREATE INDEX IF NOT EXISTS idx_builtys_destination_branch_id ON builtys(destination_branch_id);
CREATE INDEX IF NOT EXISTS idx_builtys_user_id ON builtys(user_id);
CREATE INDEX IF NOT EXISTS idx_builtys_created_at ON builtys(created_at);
CREATE INDEX IF NOT EXISTS idx_builtys_payment_status ON builtys(payment_status);
CREATE INDEX IF NOT EXISTS idx_builtys_status ON builtys(status);
CREATE INDEX IF NOT EXISTS idx_builtys_delivery_security_code ON builtys(delivery_security_code);
CREATE INDEX IF NOT EXISTS idx_ledgers_party_name ON ledgers(party_name);
CREATE INDEX IF NOT EXISTS idx_ledgers_builty_id ON ledgers(builty_id);
CREATE INDEX IF NOT EXISTS idx_ledgers_created_at ON ledgers(created_at);
CREATE INDEX IF NOT EXISTS idx_expenses_customer_id ON expenses(customer_id);
CREATE INDEX IF NOT EXISTS idx_expenses_branch_id ON expenses(branch_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date);
CREATE INDEX IF NOT EXISTS idx_delivery_logs_delivered_at ON delivery_logs(delivered_at);
CREATE INDEX IF NOT EXISTS idx_delivery_logs_builty_id ON delivery_logs(builty_id);

-- High-Load Compound Indexes for 300,000 Entries / Day Scale ($O(\log N)$)
CREATE INDEX IF NOT EXISTS idx_builtys_branch_created ON builtys(branch_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_builtys_dest_branch_created ON builtys(destination_branch_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_builtys_user_created ON builtys(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_builtys_party_created ON builtys(party_name, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_builtys_receiver_mobile ON builtys(receiver_mobile);
CREATE INDEX IF NOT EXISTS idx_builtys_sender_mobile ON builtys(sender_mobile);
CREATE INDEX IF NOT EXISTS idx_delivery_logs_composite ON delivery_logs(delivered_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_ledgers_party_created ON ledgers(party_name, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ledgers_receiver_mobile ON ledgers(receiver_mobile);
CREATE INDEX IF NOT EXISTS idx_expenses_branch_date ON expenses(branch_id, expense_date DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_customer_date ON expenses(customer_id, expense_date DESC);
CREATE INDEX IF NOT EXISTS idx_parties_branch_name ON parties(branch_id, name);
CREATE INDEX IF NOT EXISTS idx_parties_branch_mobile ON parties(branch_id, mobile);


