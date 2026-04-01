import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const API_BASE = process.env.API_BASE || "http://localhost:3000";

const server = new McpServer({
  name: "customer-support-backend",
  version: "1.0.0",
});

// ─── HTTP helper ────────────────────────────────────────────────────────────

async function api(method, path, body) {
  const opts = { method, headers: { "Content-Type": "application/json" } };
  if (body) opts.body = JSON.stringify(body);

  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, opts);
  } catch (err) {
    return {
      isError: true,
      content: [
        {
          type: "text",
          text: JSON.stringify({
            errorCategory: "transient",
            isRetryable: true,
            message: `Backend unavailable: ${err.message}`,
          }),
        },
      ],
    };
  }

  const data = await res.json();

  if (!res.ok) {
    return {
      isError: true,
      content: [{ type: "text", text: JSON.stringify(data) }],
    };
  }

  return {
    content: [{ type: "text", text: JSON.stringify(data) }],
  };
}

// ─── get_customer ───────────────────────────────────────────────────────────

server.registerTool(
  "get_customer",
  {
    description:
      "Look up a customer by their unique customer ID, email address, or name. " +
      "Use this tool FIRST before any order lookup or refund — the returned customer ID " +
      "is required for all downstream operations. " +
      "When searching by name, multiple customers may match; ask the user for an " +
      "additional identifier (email, phone) to disambiguate. " +
      "Input: exactly one of customer_id, email, or name. " +
      "Output: customer record(s) with id, name, email, phone, status, tier.",
    inputSchema: {
      customer_id: z.string().optional().describe("Exact customer ID, e.g. CUST-1001"),
      email: z.string().optional().describe("Exact email address"),
      name: z.string().optional().describe("Customer name (may return multiple matches)"),
    },
  },
  async ({ customer_id, email, name }) => {
    const params = new URLSearchParams();
    if (customer_id) params.set("id", customer_id);
    if (email) params.set("email", email);
    if (name) params.set("name", name);
    return api("GET", `/customers?${params}`);
  }
);

// ─── lookup_order ───────────────────────────────────────────────────────────

server.registerTool(
  "lookup_order",
  {
    description:
      "Retrieve order details by order ID or by customer ID (returns all orders for that customer). " +
      "IMPORTANT: You must call get_customer first to obtain a verified customer_id before using this tool. " +
      "Input: order_id for a specific order, or customer_id for all orders belonging to a customer. " +
      "Output: order record(s) with id, status, items, total, return eligibility, and shipping info.",
    inputSchema: {
      order_id: z.string().optional().describe("Specific order ID, e.g. ORD-5001"),
      customer_id: z.string().optional().describe("Customer ID to list all their orders"),
    },
  },
  async ({ order_id, customer_id }) => {
    const params = new URLSearchParams();
    if (order_id) params.set("id", order_id);
    if (customer_id) params.set("customer_id", customer_id);
    return api("GET", `/orders?${params}`);
  }
);

// ─── process_refund ─────────────────────────────────────────────────────────

server.registerTool(
  "process_refund",
  {
    description:
      "Process a refund for a delivered order. Requires a verified customer_id and order_id. " +
      "Policy constraints enforced by this tool: " +
      "- Order must have status 'delivered' and be within the return window. " +
      "- Refund amount must not exceed the order total. " +
      "- Refunds over $500 are blocked and must be escalated to a human agent. " +
      "- Suspended accounts cannot receive refunds (escalate instead). " +
      "Input: customer_id, order_id, amount, reason. " +
      "Output: refund confirmation with refund_id, or a structured error explaining why it was blocked.",
    inputSchema: {
      customer_id: z.string().describe("Verified customer ID from get_customer"),
      order_id: z.string().describe("Order ID from lookup_order"),
      amount: z.number().describe("Refund amount in USD"),
      reason: z.string().describe("Reason for the refund"),
    },
  },
  async ({ customer_id, order_id, amount, reason }) => {
    return api("POST", "/refunds", { customer_id, order_id, amount, reason });
  }
);

// ─── escalate_to_human ──────────────────────────────────────────────────────

server.registerTool(
  "escalate_to_human",
  {
    description:
      "Escalate the current case to a human support agent. Use when: " +
      "- The customer explicitly requests a human agent. " +
      "- A refund exceeds the $500 auto-approval limit. " +
      "- The customer's account is suspended. " +
      "- Policy is ambiguous or silent on the customer's request. " +
      "- You cannot make meaningful progress after investigation. " +
      "Input: customer_id, summary, root_cause, recommended_action, and priority. " +
      "Output: escalation confirmation with a ticket ID.",
    inputSchema: {
      customer_id: z.string().describe("Verified customer ID"),
      summary: z.string().describe("Brief description of the customer's issue"),
      root_cause: z.string().describe("What you determined to be the root cause"),
      recommended_action: z.string().describe("What you recommend the human agent do"),
      priority: z.enum(["low", "medium", "high", "urgent"]).describe("Escalation priority level"),
    },
  },
  async ({ customer_id, summary, root_cause, recommended_action, priority }) => {
    return api("POST", "/escalations", {
      customer_id,
      summary,
      root_cause,
      recommended_action,
      priority,
    });
  }
);

// ─── Start ──────────────────────────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);
