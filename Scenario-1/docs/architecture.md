# Architecture: Customer Support Resolution Agent

Based on the [arc42](https://docs.arc42.org/home/) documentation template.

Common tech stack: [tech-stack.md](../../docs/tech-stack.md)

---

## 1. Introduction and Goals

### Requirements Overview

Build a customer support resolution agent using the Claude Agent SDK that handles high-ambiguity requests (returns, billing disputes, account issues) via MCP tools. Target: 80%+ first-contact resolution while knowing when to escalate.

### Quality Goals

| Priority | Goal          | Description                                                  |
|----------|---------------|--------------------------------------------------------------|
| 1        | Reliability   | Critical workflows (refunds) enforced programmatically       |
| 2        | Accuracy      | Agent disambiguates customers, never guesses                 |
| 3        | Safety        | Suspended accounts and high-value refunds escalate to humans |

### Stakeholders

| Role            | Concern                                    |
|-----------------|--------------------------------------------|
| Support agent   | Accurate handoff summaries when escalated  |
| Customer        | Fast resolution, correct refunds           |
| Developer       | Clear separation of MCP, API, and database |

---

## 2. Constraints

| Constraint          | Detail                                                    |
|---------------------|-----------------------------------------------------------|
| Refund auto-limit   | Max $500 without human approval                           |
| Return window       | 30 days from delivery                                     |
| Suspended accounts  | Cannot process refunds, must escalate                     |
| MCP transport       | stdio (local development), Streamable HTTP (production)   |
| Tech stack          | Next.js, PostgreSQL, Docker Compose (see tech-stack.md)   |

---

## 3. Context and Scope

### Business Context

```mermaid
graph LR
    Customer([Customer]) -->|chat| Agent[Claude Agent]
    Agent -->|get_customer\nlookup_order\nprocess_refund\nescalate_to_human| Backend[Backend Systems]
    Agent -->|structured handoff| Human([Human Agent])
    Backend -->|data| DB[(PostgreSQL)]
```

### Technical Context

```mermaid
graph LR
    CC[Claude Code] -->|stdio\nJSON-RPC| MCP[MCP Server\nmcp/server.js]
    MCP -->|HTTP REST| API[Backend API\nport 3000]
    API -->|SQL| DB[(PostgreSQL\nport 5432)]

    subgraph Docker Compose
        API
        DB
    end

    subgraph Local Process
        CC
        MCP
    end
```

---

## 4. Solution Strategy

| Decision                        | Rationale                                                              |
|---------------------------------|------------------------------------------------------------------------|
| MCP server as thin bridge       | No business logic in MCP layer; all rules enforced server-side         |
| Programmatic enforcement        | Critical tool ordering (get_customer before refund) enforced in API    |
| Structured error responses      | API returns errorCategory, isRetryable, message for agent recovery     |
| stdio transport for dev         | Simplest local setup; no deployment needed                             |
| Seed data covers edge cases     | Duplicate names, suspended accounts, expired windows built into schema |

---

## 5. Building Block View

### Level 1 — System Overview

```mermaid
graph TB
    subgraph "Claude Code (Host)"
        CC[Claude Code CLI]
        MCP[MCP Server]
        CC -->|stdio| MCP
    end

    subgraph "Docker Compose Stack"
        API[Backend API]
        DB[(PostgreSQL)]
        API --> DB
    end

    MCP -->|HTTP| API
```

### Level 2 — MCP Server Internals

```mermaid
graph TB
    subgraph "mcp/server.js"
        Init[StdioServerTransport] --> Router[Tool Router]
        Router --> GC[get_customer]
        Router --> LO[lookup_order]
        Router --> PR[process_refund]
        Router --> EH[escalate_to_human]
    end

    GC -->|"GET /customers?name=..."| API[Backend API]
    LO -->|"GET /orders?customer_id=..."| API
    PR -->|"POST /refunds"| API
    EH -->|"POST /escalations"| API
```

### Level 2 — Backend API Internals

```mermaid
graph TB
    subgraph "backend/api.js"
        Express[Express Router] --> CustH[GET /customers]
        Express --> OrdH[GET /orders]
        Express --> RefH[POST /refunds]
        Express --> EscH[POST /escalations]
        Express --> HealthH[GET /health]

        RefH --> Policy{Policy Check}
        Policy -->|">$500"| Block[403 + suggested_action]
        Policy -->|"suspended"| Block
        Policy -->|"expired window"| Reject[422]
        Policy -->|"OK"| Process[201 + refund record]
    end

    CustH --> DB[(PostgreSQL)]
    OrdH --> DB
    Process --> DB
    EscH --> DB
```

---

## 6. Runtime View

### Scenario: Successful Refund

```mermaid
sequenceDiagram
    participant U as Customer
    participant CC as Claude Code
    participant MCP as MCP Server
    participant API as Backend API
    participant DB as PostgreSQL

    U->>CC: "I want to return my headphones"
    CC->>MCP: tools/call get_customer(name: "Alice")
    MCP->>API: GET /customers?name=Alice
    API->>DB: SELECT * FROM customers WHERE...
    DB-->>API: Alice (CUST-1001)
    API-->>MCP: {results: [Alice], count: 1}
    MCP-->>CC: tool result

    CC->>MCP: tools/call lookup_order(customer_id: "CUST-1001")
    MCP->>API: GET /orders?customer_id=CUST-1001
    API->>DB: SELECT * FROM orders WHERE...
    DB-->>API: [ORD-5001, ORD-5002]
    API-->>MCP: {results: [...], count: 2}
    MCP-->>CC: tool result

    CC->>MCP: tools/call process_refund(CUST-1001, ORD-5001, 89.99, "defective")
    MCP->>API: POST /refunds
    API->>DB: policy checks + INSERT INTO refunds
    DB-->>API: REF-7001
    API-->>MCP: {success: true, refund: {...}}
    MCP-->>CC: tool result

    CC->>U: "Refund of $89.99 processed (REF-7001)"
```

### Scenario: Escalation (Suspended Account)

```mermaid
sequenceDiagram
    participant U as Customer
    participant CC as Claude Code
    participant MCP as MCP Server
    participant API as Backend API

    U->>CC: "I'm Carol Davis, refund my monitor"
    CC->>MCP: tools/call get_customer(name: "Carol Davis")
    MCP->>API: GET /customers?name=Carol+Davis
    API-->>MCP: {results: [Carol, status: "suspended"]}
    MCP-->>CC: tool result

    CC->>MCP: tools/call process_refund(CUST-1003, ORD-5004, 1200, "wrong item")
    MCP->>API: POST /refunds
    API-->>MCP: 403 {errorCategory: "permission", message: "Account is suspended..."}
    MCP-->>CC: isError: true

    CC->>MCP: tools/call escalate_to_human(CUST-1003, ...)
    MCP->>API: POST /escalations
    API-->>MCP: {success: true, ticket_id: "ESC-9001"}
    MCP-->>CC: tool result

    CC->>U: "I've connected you with a specialist (ticket ESC-9001)"
```

### Scenario: Disambiguation (Duplicate Names)

```mermaid
sequenceDiagram
    participant U as Customer
    participant CC as Claude Code
    participant MCP as MCP Server
    participant API as Backend API

    U->>CC: "Hi, I'm Bob Smith"
    CC->>MCP: tools/call get_customer(name: "Bob Smith")
    MCP->>API: GET /customers?name=Bob+Smith
    API-->>MCP: {results: [CUST-1002, CUST-1004], count: 2}
    MCP-->>CC: tool result (2 matches)

    CC->>U: "I found two accounts for Bob Smith. Can you confirm your email?"
    U->>CC: "bob.smith@example.com"
    CC->>MCP: tools/call get_customer(email: "bob.smith@example.com")
    MCP->>API: GET /customers?email=bob.smith@example.com
    API-->>MCP: {results: [CUST-1002], count: 1}
    MCP-->>CC: tool result (1 match)

    CC->>U: "Found your account. How can I help?"
```

---

## 7. Deployment View

```mermaid
graph TB
    subgraph "Developer Machine (WSL Ubuntu)"
        subgraph "Docker Compose"
            DB["postgres:17-alpine\nport 5432\nvolume: pgdata"]
            API["node:22-alpine\nport 3000\ndepends_on: db"]
            API --> DB
        end

        subgraph "Local Node.js"
            MCP["mcp/server.js\nstdio transport"]
            CC["Claude Code CLI"]
            CC -->|stdin/stdout| MCP
            MCP -->|"http://localhost:3000"| API
        end
    end

    Init["db/init.sql"] -->|mount| DB
```

### File Structure

```
Scenario-1/
├── .mcp.json                   # MCP server config (project-scoped)
├── docker-compose.yml          # PostgreSQL + API
├── package.json                # MCP server dependencies
├── mcp/
│   └── server.js               # MCP server (thin bridge)
├── backend/
│   ├── Dockerfile
│   ├── package.json            # express + pg
│   ├── api.js                  # REST API with business rules
│   └── db.js                   # PostgreSQL connection pool
├── db/
│   └── init.sql                # Schema + seed data
└── docs/
    └── architecture.md         # This file
```

---

## 8. Crosscutting Concepts

### Error Handling Strategy

All API errors return structured JSON with consistent fields:

```json
{
  "errorCategory": "validation | permission | transient",
  "isRetryable": false,
  "message": "Human-readable explanation",
  "customer_friendly": "Optional message safe to show the customer",
  "suggested_action": "Optional next step (e.g., escalate_to_human)"
}
```

The MCP server passes these through with `isError: true` so Claude can make informed recovery decisions.

### MCP Configuration Scopes

| Scope       | File              | Shared with team? |
|-------------|-------------------|--------------------|
| **Project** | `.mcp.json`       | Yes (version controlled) |
| **User**    | `~/.claude.json`  | No (personal only)       |

Project-scoped `.mcp.json` supports environment variable expansion (e.g., `${GITHUB_TOKEN}`) for credential management without committing secrets.

### MCP Transport Options

| Method              | Transport        | Use case                                              |
|---------------------|------------------|-------------------------------------------------------|
| **Command** (ours)  | stdio            | Local dev; Claude Code spawns it as a child process   |
| **Hosted endpoint** | Streamable HTTP  | Production; MCP server runs on a URL                  |

---

## 9. Architecture Decisions

| ID    | Decision                                    | Rationale                                                                |
|-------|---------------------------------------------|--------------------------------------------------------------------------|
| ADR-1 | MCP server does no business logic           | Single source of truth for rules in the API; MCP is replaceable          |
| ADR-2 | Programmatic enforcement over prompt-based  | Prompt instructions have non-zero failure rate for critical operations    |
| ADR-3 | Structured errors with categories           | Enables agent to distinguish retryable vs terminal failures              |
| ADR-4 | stdio transport for local dev               | Zero deployment overhead; switch to Streamable HTTP for production       |
| ADR-5 | Seed data covers all edge cases             | Ensures every policy branch is testable without manual data setup        |

---

## 10. Quality

### Quality Scenarios

| Scenario                                   | Expected Behavior                              | Metric               |
|--------------------------------------------|------------------------------------------------|----------------------|
| Customer requests refund under $500        | Auto-processed, confirmation returned          | < 3 tool calls       |
| Customer name matches multiple records     | Agent asks for disambiguation                  | Never guesses        |
| Refund > $500 requested                    | Blocked by API, agent escalates                | 100% enforcement     |
| Suspended account attempts refund          | Blocked by API, agent escalates                | 100% enforcement     |
| Backend API unreachable                    | MCP returns transient error, isRetryable: true | Agent can retry      |

---

## 11. Risks and Technical Debt

| Risk                                       | Mitigation                                            |
|--------------------------------------------|-------------------------------------------------------|
| Backend currently uses Express (not Next.js)| Planned migration to Next.js API routes               |
| In-memory refund ID generation (counter)   | Move to database sequence for production              |
| No authentication on API                   | Acceptable for local dev; add auth for production     |
| No rate limiting on MCP tools              | Add if exposing via Streamable HTTP                   |

---

## 12. Glossary

| Term                | Definition                                                                              |
|---------------------|-----------------------------------------------------------------------------------------|
| MCP                 | Model Context Protocol — standard for connecting AI agents to external tools and data    |
| stdio transport     | Communication over stdin/stdout between Claude Code and MCP server (child process)       |
| Streamable HTTP     | HTTP-based MCP transport for hosted/remote MCP servers                                   |
| Tool schema         | JSON schema defining a tool's name, description, and input parameters                    |
| Agentic loop        | Cycle of: send prompt to Claude, inspect stop_reason, execute tools, return results      |
| Escalation          | Handing a case to a human agent with structured context                                  |
| Programmatic enforcement | Using code (hooks, API gates) to guarantee workflow rules, not relying on prompts   |
