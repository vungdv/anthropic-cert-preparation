# Bridging the Gap: Human Developers and AI Tools

Practical architectures and patterns for working effectively with AI coding tools — grounded in how both human cognition and large language models actually work.

## Why This Repo?

AI coding assistants are powerful, but using them well requires understanding what they are good at and where they fall short. This repo explores that gap through executable scenarios you can run, modify, and learn from.

## Approach

This project draws on three foundations:

1. **Human cognition** — how developers think, plan, and make decisions
2. **AI internals** — core design principles of neural networks, LLMs, and agentic systems (Claude Code in particular)
3. **Anthropic's guidance** — aligned with the [Claude Certified Architect - Foundations Exam Guide](instructor_8lsy243ftffjjy1cx9lm3o2bw_public_1773274827_Claude+Certified+Architect+–+Foundations+Certification+Exam+Guide.pdf)

The focus is on practical application — every concept is backed by a working implementation.

## Scenarios

| Scenario | Description | Key Domains |
|----------|-------------|-------------|
| [Scenario 1](Scenario-1/) | Customer Support Resolution Agent using Claude Agent SDK with MCP tools | Agentic architecture, tool design, context management |

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Runtime | Node.js | 22 LTS |
| Frontend / API | Next.js | 15+ |
| Database | PostgreSQL | 17 |
| Containerization | Docker Compose | v2 |
| MCP SDK | @modelcontextprotocol/sdk | 1.29+ |

See [docs/tech-stack.md](docs/tech-stack.md) for full details and conventions.

## Getting Started

```bash
# Clone the repo
git clone https://github.com/<your-username>/Anthropic.git
cd Anthropic

# Run a scenario
cd Scenario-1
docker compose up
```

## Goals

- Reveal AI tools' strengths and limitations from core design principles
- Provide effective, reusable patterns with executable architectures
- Help developers build better mental models for human-AI collaboration

## License

TBD
