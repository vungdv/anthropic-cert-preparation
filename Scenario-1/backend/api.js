import express from "express";
import { query, waitForDb } from "./db.js";

const POLICY = {
  max_auto_refund: 500.0,
  return_window_days: 30,
  eligible_statuses: ["delivered"],
  requires_customer_verification: true,
  suspended_account_action: "escalate",
};

const app = express();
app.use(express.json());

// ─── Health ─────────────────────────────────────────────────────────────────

app.get("/health", async (_req, res) => {
  try {
    await query("SELECT 1");
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  } catch {
    res.status(503).json({ status: "unhealthy" });
  }
});

// ─── GET /customers ─────────────────────────────────────────────────────────

app.get("/customers", async (req, res) => {
  const { id, email, name } = req.query;

  if (!id && !email && !name) {
    return res.status(400).json({
      errorCategory: "validation",
      isRetryable: false,
      message: "Provide at least one of: id, email, or name.",
    });
  }

  const conditions = [];
  const params = [];
  if (id) {
    params.push(id);
    conditions.push(`id = $${params.length}`);
  }
  if (email) {
    params.push(email);
    conditions.push(`email = $${params.length}`);
  }
  if (name) {
    params.push(`%${name.toLowerCase()}%`);
    conditions.push(`LOWER(name) LIKE $${params.length}`);
  }

  const { rows } = await query(
    `SELECT * FROM customers WHERE ${conditions.join(" AND ")}`,
    params
  );
  res.json({ results: rows, count: rows.length });
});

// ─── GET /orders ────────────────────────────────────────────────────────────

app.get("/orders", async (req, res) => {
  const { id, customer_id } = req.query;

  if (!id && !customer_id) {
    return res.status(400).json({
      errorCategory: "validation",
      isRetryable: false,
      message: "Provide order id or customer_id.",
    });
  }

  const conditions = [];
  const params = [];
  if (id) {
    params.push(id);
    conditions.push(`id = $${params.length}`);
  }
  if (customer_id) {
    params.push(customer_id);
    conditions.push(`customer_id = $${params.length}`);
  }

  const { rows } = await query(
    `SELECT * FROM orders WHERE ${conditions.join(" AND ")}`,
    params
  );
  res.json({ results: rows, count: rows.length });
});

// ─── POST /refunds ──────────────────────────────────────────────────────────

app.post("/refunds", async (req, res) => {
  const { customer_id, order_id, amount, reason } = req.body;

  if (!customer_id || !order_id || amount == null || !reason) {
    return res.status(400).json({
      errorCategory: "validation",
      isRetryable: false,
      message: "Required: customer_id, order_id, amount, reason.",
    });
  }

  // Verify customer
  const { rows: customers } = await query(
    "SELECT * FROM customers WHERE id = $1",
    [customer_id]
  );
  if (customers.length === 0) {
    return res.status(404).json({
      errorCategory: "validation",
      isRetryable: false,
      message: `Customer ${customer_id} not found.`,
    });
  }
  const customer = customers[0];

  if (customer.status === "suspended") {
    return res.status(403).json({
      errorCategory: "permission",
      isRetryable: false,
      message: "Account is suspended. Escalate to a human agent for review.",
      customer_friendly:
        "Your account requires additional review. Let me connect you with a specialist.",
    });
  }

  // Verify order
  const { rows: orderRows } = await query(
    "SELECT * FROM orders WHERE id = $1 AND customer_id = $2",
    [order_id, customer_id]
  );
  if (orderRows.length === 0) {
    return res.status(404).json({
      errorCategory: "validation",
      isRetryable: false,
      message: `Order ${order_id} not found for customer ${customer_id}.`,
    });
  }
  const order = orderRows[0];

  if (order.status !== "delivered") {
    return res.status(422).json({
      errorCategory: "validation",
      isRetryable: false,
      message: `Order status is '${order.status}'. Only delivered orders are eligible for refund.`,
    });
  }

  const now = new Date();
  if (order.return_window_ends && new Date(order.return_window_ends) < now) {
    return res.status(422).json({
      errorCategory: "validation",
      isRetryable: false,
      message: `Return window expired on ${order.return_window_ends}. Escalate for exception review.`,
    });
  }

  if (amount > parseFloat(order.total)) {
    return res.status(422).json({
      errorCategory: "validation",
      isRetryable: false,
      message: `Refund amount $${amount} exceeds order total $${order.total}.`,
    });
  }

  if (amount > POLICY.max_auto_refund) {
    return res.status(403).json({
      errorCategory: "permission",
      isRetryable: false,
      message: `Refund of $${amount} exceeds auto-approval limit of $${POLICY.max_auto_refund}. Escalate to human agent.`,
      suggested_action: "escalate_to_human",
    });
  }

  // Generate refund ID
  const { rows: countRows } = await query("SELECT COUNT(*) FROM refunds");
  const refundId = `REF-${7000 + parseInt(countRows[0].count) + 1}`;

  const { rows: refundRows } = await query(
    `INSERT INTO refunds (refund_id, customer_id, order_id, amount, reason)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [refundId, customer_id, order_id, amount, reason]
  );

  res.status(201).json({ success: true, refund: refundRows[0] });
});

// ─── POST /escalations ─────────────────────────────────────────────────────

app.post("/escalations", async (req, res) => {
  const { customer_id, summary, root_cause, recommended_action, priority } =
    req.body;

  if (!customer_id || !summary || !root_cause || !recommended_action || !priority) {
    return res.status(400).json({
      errorCategory: "validation",
      isRetryable: false,
      message: "Required: customer_id, summary, root_cause, recommended_action, priority.",
    });
  }

  if (!["low", "medium", "high", "urgent"].includes(priority)) {
    return res.status(400).json({
      errorCategory: "validation",
      isRetryable: false,
      message: "priority must be one of: low, medium, high, urgent.",
    });
  }

  const { rows: customers } = await query(
    "SELECT name, tier FROM customers WHERE id = $1",
    [customer_id]
  );
  const customer = customers[0];

  const { rows: countRows } = await query("SELECT COUNT(*) FROM escalations");
  const ticketId = `ESC-${9000 + parseInt(countRows[0].count) + 1}`;

  const { rows: escRows } = await query(
    `INSERT INTO escalations (ticket_id, customer_id, customer_name, customer_tier, summary, root_cause, recommended_action, priority)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
    [
      ticketId,
      customer_id,
      customer?.name ?? "Unknown",
      customer?.tier ?? "unknown",
      summary,
      root_cause,
      recommended_action,
      priority,
    ]
  );

  res.status(201).json({ success: true, escalation: escRows[0] });
});

// ─── GET /refunds & /escalations (for inspection) ───────────────────────────

app.get("/refunds", async (_req, res) => {
  const { rows } = await query("SELECT * FROM refunds ORDER BY processed_at DESC");
  res.json({ results: rows });
});

app.get("/escalations", async (_req, res) => {
  const { rows } = await query("SELECT * FROM escalations ORDER BY created_at DESC");
  res.json({ results: rows });
});

app.get("/policy", (_req, res) => res.json(POLICY));

// ─── Start ──────────────────────────────────────────────────────────────────

const port = process.env.PORT || 3000;

await waitForDb();
app.listen(port, "0.0.0.0", () => {
  console.log(`Customer support backend running on port ${port}`);
});
