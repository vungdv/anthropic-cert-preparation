# Purpose

This project is a preparation for getting the Claude Certified Architect. 

See the [Claude Certified Architect – Foundations Certification Exam Guide](../instructor_8lsy243ftffjjy1cx9lm3o2bw_public_1773274827_Claude+Certified+Architect+–+Foundations+Certification+Exam+Guide.pdf)


# Scope

This folder is a preparation for scenario-1 mentioned in the guide. 

# Preparation Plan

## Scenario 1: Customer Support Resolution Agent

> You are building a customer support resolution agent using the Claude Agent SDK. The agent handles high-ambiguity requests like returns, billing disputes, and account issues. It has access to backend systems through custom MCP tools (`get_customer`, `lookup_order`, `process_refund`, `escalate_to_human`). Target: 80%+ first-contact resolution while knowing when to escalate.

**Primary domains tested:** Agentic Architecture & Orchestration (27%), Tool Design & MCP Integration (18%), Context Management & Reliability (15%)

---

### Domain 1: Agentic Architecture & Orchestration

#### 1.1 — Agentic Loop Design
- [ ] Build an agentic loop that inspects `stop_reason` (`"tool_use"` vs `"end_turn"`) to decide whether to continue or stop
- [ ] Append tool results to conversation history between iterations so the model reasons with new information
- [ ] Avoid anti-patterns: don't parse natural language to detect loop termination, don't use arbitrary iteration caps as primary stopping mechanism

#### 1.2 — Multi-Agent Coordinator-Subagent Patterns
- [ ] Understand hub-and-spoke architecture: coordinator manages all inter-subagent communication
- [ ] Know that subagents have isolated context — they do NOT inherit the coordinator's conversation history
- [ ] Practice designing coordinators that dynamically select which subagents to invoke based on query complexity

#### 1.3 — Subagent Invocation & Context Passing
- [ ] Use the `Task` tool for spawning subagents; `allowedTools` must include `"Task"` for coordinator
- [ ] Explicitly provide context in the subagent prompt — subagents don't auto-inherit parent context
- [ ] Practice spawning parallel subagents by emitting multiple Task tool calls in a single coordinator response
- [ ] Understand `AgentDefinition` configuration: descriptions, system prompts, tool restrictions

#### 1.4 — Multi-Step Workflows & Enforcement
- [ ] Distinguish programmatic enforcement (hooks, prerequisite gates) from prompt-based guidance
- [ ] Implement programmatic prerequisites: block `process_refund` until `get_customer` returns a verified customer ID
- [ ] Build structured handoff summaries (customer ID, root cause, refund amount, recommended action) for human escalation
- [ ] Decompose multi-concern customer requests into distinct items, investigate in parallel

#### 1.5 — Agent SDK Hooks
- [ ] Implement `PostToolUse` hooks to normalize data formats (Unix timestamps → ISO 8601, numeric status codes → labels)
- [ ] Implement tool call interception hooks to block policy-violating actions (e.g., refunds > $500 → human escalation)
- [ ] Know when to choose hooks over prompt-based enforcement (answer: when guaranteed compliance is required)

#### 1.6 — Task Decomposition Strategies
- [ ] Know when to use fixed sequential pipelines (prompt chaining) vs dynamic adaptive decomposition
- [ ] Practice splitting large code reviews into per-file local analysis + cross-file integration pass
- [ ] For open-ended tasks: first map structure, identify high-impact areas, then create a prioritized plan

#### 1.7 — Session State, Resumption & Forking
- [ ] Use `--resume <session-name>` to continue a prior conversation
- [ ] Use `fork_session` to explore divergent approaches from a shared baseline
- [ ] Know when to resume (prior context mostly valid) vs start fresh with injected summaries (stale tool results)

---

### Domain 2: Tool Design & MCP Integration

#### 2.1 — Effective Tool Interfaces
- [ ] Write tool descriptions that clearly differentiate purpose, inputs, outputs, and when to use vs alternatives
- [ ] Rename/split tools to eliminate functional overlap (e.g., generic `analyze_document` → specific `extract_data_points`, `summarize_content`, `verify_claim_against_source`)
- [ ] Review system prompts for keyword-sensitive instructions that might override tool descriptions

#### 2.2 — Structured Error Responses
- [ ] Return structured error metadata: `errorCategory` (transient/validation/permission), `isRetryable` boolean, human-readable description
- [ ] Distinguish transient errors (retry-worthy) from business rule violations (not retryable)
- [ ] Subagents should recover locally from transient failures; propagate only unresolvable errors with partial results

#### 2.3 — Tool Distribution & `tool_choice`
- [ ] Limit each agent to 4-5 tools relevant to its role — too many tools degrades selection reliability
- [ ] Know `tool_choice` options: `"auto"`, `"any"` (must call a tool), forced `{"type": "tool", "name": "..."}` (must call specific tool)
- [ ] Practice replacing generic tools with constrained alternatives

#### 2.4 — MCP Server Integration
- [ ] Project-scoped `.mcp.json` (shared via version control) vs user-scoped `~/.claude.json` (personal)
- [ ] Environment variable expansion in `.mcp.json` (e.g., `${GITHUB_TOKEN}`) for credential management
- [ ] Expose content catalogs as MCP resources to reduce exploratory tool calls

#### 2.5 — Built-in Tools (Read, Write, Edit, Bash, Grep, Glob)
- [ ] Grep for content search (function names, error messages, imports)
- [ ] Glob for file path pattern matching (find files by name/extension)
- [ ] Read + Write as fallback when Edit fails due to non-unique text matches
- [ ] Build codebase understanding incrementally: Grep → find entry points → Read → trace flows

---

### Domain 5: Context Management & Reliability

#### 5.1 — Preserving Critical Information
- [ ] Extract transactional facts (amounts, dates, order numbers) into a persistent "case facts" block outside summarized history
- [ ] Trim verbose tool outputs to only relevant fields before they accumulate in context
- [ ] Place key findings at the beginning; use explicit section headers to mitigate "lost in the middle" effect

#### 5.2 — Escalation & Ambiguity Resolution
- [ ] Add explicit escalation criteria with few-shot examples to system prompt
- [ ] Honor explicit customer requests for human agents immediately (don't investigate first)
- [ ] Escalate when policy is ambiguous or silent on the customer's request
- [ ] Ask for additional identifiers when tool results return multiple matches — don't select by heuristics

#### 5.3 — Error Propagation in Multi-Agent Systems
- [ ] Return structured error context: failure type, attempted query, partial results, alternative approaches
- [ ] Distinguish access failures (timeouts) from valid empty results (successful queries with no matches)
- [ ] Don't silently suppress errors or terminate entire workflows on single failures

#### 5.4 — Large Codebase Context Management
- [ ] Spawn subagents for verbose exploration; main agent preserves high-level coordination
- [ ] Use scratchpad files to persist findings across context boundaries
- [ ] Use `/compact` to reduce context usage during extended exploration sessions

#### 5.5 — Human Review & Confidence Calibration
- [ ] Aggregate accuracy metrics can mask poor performance on specific document types — stratify by type/field
- [ ] Implement stratified random sampling of high-confidence extractions
- [ ] Route low-confidence extractions to human review

#### 5.6 — Information Provenance & Multi-Source Synthesis
- [ ] Require subagents to output structured claim-source mappings (source URLs, document names, excerpts)
- [ ] Handle conflicting statistics by annotating conflicts with source attribution (don't arbitrarily pick one)
- [ ] Include publication/collection dates in structured outputs to avoid misinterpreting temporal differences

---

### Hands-On Practice Projects

1. **Build the Customer Support Agent** — Implement the full agentic loop with `get_customer`, `lookup_order`, `process_refund`, `escalate_to_human` MCP tools using Claude Agent SDK
2. **Add Programmatic Enforcement** — Create hooks that block `process_refund` until `get_customer` has returned a verified customer ID
3. **Implement Error Handling** — Return structured error metadata from each tool; test recovery flows
4. **Build Escalation Logic** — Create system prompt with explicit criteria and few-shot examples for when to escalate vs resolve
5. **Context Management** — Implement "case facts" extraction and test with multi-issue customer conversations

---

### Key Exam Patterns to Remember

| Situation | Best approach |
|---|---|
| Critical tool ordering required | Programmatic enforcement (hooks/gates), NOT prompt instructions |
| Tools being misrouted | Improve tool descriptions first (lowest effort, highest leverage) |
| Wrong escalation decisions | Add explicit criteria + few-shot examples to system prompt |
| Subagent failure | Return structured error context, NOT generic "unavailable" status |
| Too many tools on one agent | Restrict to 4-5 role-relevant tools |
| Verbose context filling up | Trim tool outputs, use subagents for exploration, use `/compact` |
| Complex multi-file task | Plan mode first, then execute |
| Simple single-file fix | Direct execution |
| CI/CD pipeline usage | Use `-p` flag for non-interactive mode |
| Cost savings for batch jobs | Message Batches API for non-blocking work only (up to 24h processing) |
