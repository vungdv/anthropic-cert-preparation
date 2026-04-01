CREATE TABLE customers (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    email       TEXT UNIQUE NOT NULL,
    phone       TEXT,
    status      TEXT NOT NULL DEFAULT 'active',
    tier        TEXT NOT NULL DEFAULT 'standard',
    address     TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE orders (
    id                  TEXT PRIMARY KEY,
    customer_id         TEXT NOT NULL REFERENCES customers(id),
    status              TEXT NOT NULL,
    placed_at           TIMESTAMPTZ NOT NULL,
    delivered_at        TIMESTAMPTZ,
    total               NUMERIC(10,2) NOT NULL,
    items               JSONB NOT NULL DEFAULT '[]',
    shipping_method     TEXT,
    return_eligible     BOOLEAN NOT NULL DEFAULT false,
    return_window_ends  TIMESTAMPTZ
);

CREATE TABLE refunds (
    refund_id       TEXT PRIMARY KEY,
    customer_id     TEXT NOT NULL REFERENCES customers(id),
    order_id        TEXT NOT NULL REFERENCES orders(id),
    amount          NUMERIC(10,2) NOT NULL,
    reason          TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'processed',
    processed_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE escalations (
    ticket_id           TEXT PRIMARY KEY,
    customer_id         TEXT NOT NULL REFERENCES customers(id),
    customer_name       TEXT,
    customer_tier       TEXT,
    summary             TEXT NOT NULL,
    root_cause          TEXT NOT NULL,
    recommended_action  TEXT NOT NULL,
    priority            TEXT NOT NULL,
    status              TEXT NOT NULL DEFAULT 'open',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed customers
INSERT INTO customers (id, name, email, phone, status, tier, address, created_at) VALUES
('CUST-1001', 'Alice Johnson', 'alice.johnson@example.com', '+1-555-0101', 'active',    'gold',     '123 Main St, Springfield, IL 62701', '2024-03-15T10:00:00Z'),
('CUST-1002', 'Bob Smith',     'bob.smith@example.com',     '+1-555-0102', 'active',    'standard', '456 Oak Ave, Portland, OR 97201',    '2024-06-22T14:30:00Z'),
('CUST-1003', 'Carol Davis',   'carol.davis@example.com',   '+1-555-0103', 'suspended', 'platinum', '789 Pine Rd, Austin, TX 78701',      '2023-11-01T09:00:00Z'),
('CUST-1004', 'Bob Smith',     'bob.smith2@example.com',    '+1-555-0104', 'active',    'gold',     '321 Elm St, Denver, CO 80201',       '2025-01-10T16:45:00Z');

-- Seed orders
INSERT INTO orders (id, customer_id, status, placed_at, delivered_at, total, items, shipping_method, return_eligible, return_window_ends) VALUES
('ORD-5001', 'CUST-1001', 'delivered',   '2025-12-01T08:00:00Z', '2025-12-05T14:00:00Z', 149.99,  '[{"name":"Wireless Headphones","sku":"WH-100","qty":1,"price":89.99},{"name":"USB-C Cable","sku":"UC-200","qty":2,"price":15.00},{"name":"Phone Case","sku":"PC-300","qty":1,"price":30.00}]', 'standard', true,  '2026-01-04T14:00:00Z'),
('ORD-5002', 'CUST-1001', 'shipped',     '2026-03-20T10:00:00Z', NULL,                    299.00,  '[{"name":"Bluetooth Speaker","sku":"BS-400","qty":1,"price":299.00}]', 'express',  false, NULL),
('ORD-5003', 'CUST-1002', 'delivered',   '2026-02-14T12:00:00Z', '2026-02-18T09:00:00Z',  59.99,   '[{"name":"Running Shoes","sku":"RS-500","qty":1,"price":59.99}]', 'standard', true,  '2026-03-20T09:00:00Z'),
('ORD-5004', 'CUST-1003', 'delivered',   '2026-01-05T15:00:00Z', '2026-01-09T11:00:00Z',  1249.99, '[{"name":"Laptop Stand","sku":"LS-600","qty":1,"price":49.99},{"name":"4K Monitor","sku":"MN-700","qty":1,"price":1200.00}]', 'express',  true,  '2026-02-08T11:00:00Z'),
('ORD-5005', 'CUST-1004', 'processing',  '2026-03-30T08:00:00Z', NULL,                    34.50,   '[{"name":"Notebook Set","sku":"NB-800","qty":3,"price":11.50}]', 'standard', false, NULL);
