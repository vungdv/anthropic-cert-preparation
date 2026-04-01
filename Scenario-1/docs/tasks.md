# Improvement Tasks

Tracked improvements mapped to certification exam domains.

## Security & Data Privacy

- [ ] **Trim tool output fields** — `get_customer` returns all fields (address, phone) even when not needed. Add a `fields` parameter so the MCP server requests only what's relevant per tool call.
  - Domain 5.1: Trim verbose tool outputs to only relevant fields before they accumulate in context

- [ ] **Separate internal vs customer-facing messages** — Ensure all error responses include a `customer_friendly` field safe to show, separate from internal details.
  - Domain 2.2: Structured error responses should include customer_friendly messages separate from internal details

- [ ] **Redact PII in tool results** — Mask sensitive fields (email, phone, address) before they enter Claude's context unless explicitly needed.
  - Domain 5.1: Context management

- [ ] **Sanitize user-controlled data** — Prevent prompt injection via customer names or order notes that could influence Claude's behavior.
  - Domain 5: Reliability

- [ ] **Add API authentication** — Protect backend endpoints with API key or JWT; pass credentials via env vars in `.mcp.json`.
  - Domain 2.4: Environment variable expansion for credential management

- [ ] **Add audit logging** — Log every tool call with timestamp, tool name, and arguments for compliance.
  - Domain 8: Crosscutting concerns

## Architecture

- [ ] **Migrate backend from Express to Next.js API routes** — Align with common tech stack defined in `docs/tech-stack.md`.

- [ ] **Add programmatic prerequisite enforcement** — Block `lookup_order` and `process_refund` until `get_customer` has returned a verified customer ID.
  - Domain 1.4: Programmatic enforcement over prompt-based guidance

- [ ] **Implement PostToolUse hooks** — Normalize data formats (timestamps, status codes) from tool results before the agent processes them.
  - Domain 1.5: Agent SDK hooks for tool call interception and data normalization
