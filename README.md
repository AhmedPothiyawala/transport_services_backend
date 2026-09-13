# Transport Management System - Backend API Engine

High-performance, secure Node.js Express TypeScript REST API backend for the **Transport Management System** (SLPS - Shri Lakshmi Parcel Service). Powers the Flutter Web Admin Panel and Mobile Application with robust PostgreSQL persistence, high-concurrency scaling, and multi-layered security gates.

---

## 1. System Architecture & Tech Stack

- **Runtime & Language**: Node.js (v18+) with TypeScript 5
- **Web Framework**: Express.js
- **Database**: PostgreSQL 16 (Neon Cloud Postgres & Local PostgreSQL)
- **Database Driver**: `pg` (Node-Postgres) with connection pooling and slow-query monitoring
- **Authentication**: JWT (`HS256`), bcrypt password hashing (salt rounds: 10)
- **Security & Middlewares**: Helmet, CORS preflight routing, rate limiting, anti-Postman client integrity guard
- **Test Framework**: Jest with `ts-jest` (6 test suites, 115 assertions passing)

---

## 2. Key Modules & Controllers

| Controller | Source File | Responsibilities |
| :--- | :--- | :--- |
| **Auth** | `src/controllers/auth.controller.ts` | Login with 10-digit mobile, bcrypt verification, 5-attempt brute force lockout, Sonu Admin OTP dispatch & verification. |
| **Builty (Bookings)** | `src/controllers/builty.controller.ts` | Consignment creation (Customer, Sub-Admin, Main Admin), atomic serial generation (`SELECT ... FOR UPDATE`), weight/rate updates with Sonu OTP, split delivery execution, verification code status engine (`POST /builty/verify-code`, `POST /builty/update-status-by-code`), and delivery logs. |
| **Branches** | `src/controllers/branch.controller.ts` | Hub directory, sequence self-healing (`branches_id_seq`), dependency integrity check, Admin OTP protection on create/delete. |
| **Admin & Sub-Admin** | `src/controllers/admin.controller.ts` | Sub-admin creation with Admin OTP verification, one active sub-admin per branch rule, branch customer registration, and customer work history. |
| **Party Master** | `src/controllers/party.controller.ts` | Client contact directory, unique mobile constraint, branch-duplicate name guard, soft-deactivation. |
| **Ledgers** | `src/controllers/ledger.controller.ts` | Receiver freight debit billing, payment credit recording, date-range filtering, and outstanding balance aggregation. |
| **Expenses** | `src/controllers/expense.controller.ts` | Employee expenses, field advances, and COD collection logs with mandatory customer attribution. |

---

## 3. Database Schema & High-Throughput Scaling

### Primary Database Tables
- `users`: User profiles with roles (`MAIN_ADMIN`, `SUB_ADMIN`, `DRIVER`, `USER`/`CUSTOMER`), branch assignment, and lockout counters.
- `branches`: Logistics hub registry with unique uppercase branch codes.
- `series_config`: Atomic serial counter per financial year and branch.
- `builtys`: Consignment bookings with package count, weight, rate, totals, security codes, and delivery status.
- `parties`: Consignor and Consignee directory with GSTIN and branch association.
- `ledgers`: Double-entry accounting tracking DEBIT (Freight Billed) and CREDIT (Payments Received).
- `delivery_logs`: Chronological audit trail of all parcel status transitions and split deliveries with handler phone.
- `expenses`: Financial logs for employee COD, fuel, advances, and daily operations.

### High-Speed Compound B-Tree Indexes
Engineered for 300,000 entries/day (10 branches x 30,000 entries/day):
```sql
CREATE INDEX IF NOT EXISTS idx_builtys_branch_created ON builtys(branch_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_builtys_dest_created ON builtys(destination_branch_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_builtys_party_created ON builtys(party_name, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_builtys_security_code ON builtys(delivery_security_code);
CREATE INDEX IF NOT EXISTS idx_delivery_logs_delivered_at ON delivery_logs(delivered_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_delivery_logs_builty_id ON delivery_logs(builty_id, delivered_at DESC);
CREATE INDEX IF NOT EXISTS idx_ledgers_party_created ON ledgers(party_name, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_branch_date ON expenses(branch_id, expense_date DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_customer_date ON expenses(customer_id, expense_date DESC);
```

---

## 4. Multi-Layered Security Architecture

1. **Anti-Postman & Client Integrity Guard (`src/middlewares/clientIntegrity.ts`)**:
   - Every `/api/v1/*` request must present the cryptographic handshake token:
     ```http
     X-App-Client-Token: slps_transport_secure_client_token_v6_2026
     ```
   - Direct external calls (Postman, curl, scrapers) without this header are blocked with `HTTP 403 Forbidden`.
2. **Reusable Admin OTP Approval Gate**:
   - 4 critical administrative mutations require 6-digit OTP verification sent to Main Admin (Sonu Sir, `9999999999`):
     - Deleting a branch (`DELETE /branches/:id`)
     - Deactivating a user (`PUT /auth/users/:id/status`)
     - Creating a Sub-Admin (`POST /admin/sub-admin`)
     - Creating a branch hub (`POST /branches`)
3. **Strict 10-Digit Mobile Number Validation**:
   - All mobile numbers across auth, parties, builty, and handler logging must be exactly 10 digits (`cleanMobile.length === 10`).
4. **Brute-Force Account Protection**:
   - 5 consecutive failed login attempts lock the mobile number for 15 minutes (`HTTP 429 Too Many Requests`).
5. **Universal Pagination**:
   - All list endpoints enforce `page` and `limit` with max bounds to prevent memory exhaustion under high volume.

---

## 5. Development & Testing Commands

### Install Dependencies
```bash
npm install
```

### Start Development Server
```bash
npm run dev
# Starts server at http://localhost:3000
# Health check: http://localhost:3000/health
```

### Build Production Bundle
```bash
npm run build
```

### Typecheck TypeScript
```bash
npx tsc --noEmit
```

### Run Comprehensive Jest Test Suite (115 Assertions)
```bash
npm test
```
The test suite validates:
- `HighLoadSecurityAntiHacking.test.ts`: Client token verification, SQL injection immunity, JWT tampering.
- `BookingDeliveryPartyEngine.test.ts`: Admin OTP approval gates, Sub-Admin booking permissions, delivery logs, split delivery, cross-branch codes.
- `HighVolumeLoadTest5000.test.ts`: High-concurrency query simulation.
- `HackerPenetrationSecurity.test.ts`: Brute-force lockout and rate limits.
- `ComprehensiveTestingSuite50.test.ts`: Builty creation, auto-calculations, and ledger balancing.
- `TransportCoreEngine.test.ts`: Sequence healing, atomic series config, and currency rounding.
