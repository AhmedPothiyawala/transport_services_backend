-- PostgreSQL Database Schema for Transport Management System

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    mobile VARCHAR(20) UNIQUE NOT NULL,
    address TEXT,
    role VARCHAR(20) NOT NULL CHECK (role IN ('MAIN_ADMIN', 'SUB_ADMIN', 'USER', 'DRIVER')),
    password_hash VARCHAR(255),
    otp VARCHAR(6),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Ensure password_hash column exists on existing installations
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);

CREATE TABLE IF NOT EXISTS branches (
    id SERIAL PRIMARY KEY,
    branch_name VARCHAR(100) UNIQUE NOT NULL,
    city VARCHAR(100) NOT NULL,
    code VARCHAR(20) UNIQUE NOT NULL,
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

CREATE TABLE IF NOT EXISTS builtys (
    id SERIAL PRIMARY KEY,
    builty_number VARCHAR(50) UNIQUE NOT NULL,
    serial_number INT NOT NULL,
    branch_id INT REFERENCES branches(id),
    user_id INT REFERENCES users(id),
    driver_id INT REFERENCES users(id),
    source_city VARCHAR(100) NOT NULL,
    destination_city VARCHAR(100) NOT NULL,
    party_name VARCHAR(255) NOT NULL,
    receiver_name VARCHAR(255) NOT NULL,
    receiver_mobile VARCHAR(20) NOT NULL,
    payment_status VARCHAR(20) NOT NULL CHECK (payment_status IN ('FULLY_PAID', 'PARTIALLY_PAID', 'PENDING')),
    builty_amount NUMERIC(12,2) NOT NULL,
    paid_amount NUMERIC(12,2) DEFAULT 0.00,
    pending_amount NUMERIC(12,2) DEFAULT 0.00,
    bill_type VARCHAR(20) DEFAULT 'PAKKE' CHECK (bill_type IN ('KACCHE', 'PAKKE')),
    terms_conditions TEXT,
    description TEXT,
    weight_kg NUMERIC(10,2) DEFAULT 0.00,
    charges NUMERIC(12,2) DEFAULT 0.00,
    discount NUMERIC(12,2) DEFAULT 0.00,
    status VARCHAR(30) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ASSIGNED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ledgers (
    id SERIAL PRIMARY KEY,
    party_name VARCHAR(255) NOT NULL,
    builty_id INT REFERENCES builtys(id) ON DELETE SET NULL,
    account_type VARCHAR(20) NOT NULL CHECK (account_type IN ('CREDIT', 'DEBIT')),
    amount NUMERIC(12,2) NOT NULL,
    balance NUMERIC(12,2) NOT NULL,
    payment_method VARCHAR(50) DEFAULT 'CASH',
    remarks TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS expenses (
    id SERIAL PRIMARY KEY,
    builty_id INT REFERENCES builtys(id) ON DELETE CASCADE,
    branch_id INT REFERENCES branches(id) ON DELETE CASCADE,
    expense_title VARCHAR(255) NOT NULL,
    amount NUMERIC(12,2) NOT NULL,
    expense_date DATE DEFAULT CURRENT_DATE,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Seed Default Branch
INSERT INTO branches (id, branch_name, city, code)
VALUES (1, 'Ahmedabad Main Hub', 'Ahmedabad', 'AHM01')
ON CONFLICT (code) DO NOTHING;

-- Seed Initial Test Users with Bcrypt Password Hash (Default Password: "123456")
INSERT INTO users (name, mobile, address, role, password_hash, otp) 
VALUES 
  ('Sonu Sir (Main Admin)', '9999999999', 'Headquarters, Ahmedabad', 'MAIN_ADMIN', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', '123456'),
  ('Sub Admin User', '8888888888', 'Branch Office, Delhi', 'SUB_ADMIN', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', '123456'),
  ('Sample Driver', '7777777777', 'Logistics Hub, Mumbai', 'DRIVER', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', '123456'),
  ('Sample Customer', '6666666666', 'Ahmedabad Market', 'USER', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', '123456')
ON CONFLICT (mobile) DO UPDATE SET password_hash = EXCLUDED.password_hash;


