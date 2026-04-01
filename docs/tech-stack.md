# Common Tech Stack

This document defines the standard technology choices across all scenarios in this project.

## Stack

| Layer            | Technology         | Version | Purpose                          |
|------------------|--------------------|---------|----------------------------------|
| Runtime          | Node.js            | 22 LTS  | Server-side JavaScript runtime   |
| Frontend / API   | Next.js            | 15+     | Full-stack React framework       |
| Database         | PostgreSQL         | 17      | Relational database              |
| Containerization | Docker Compose     | v2      | Local multi-service orchestration|
| MCP SDK          | @modelcontextprotocol/sdk | 1.29+ | MCP server implementation  |
| Schema Validation| Zod                | 4+      | Runtime type validation          |

## Conventions

- **Package manager:** npm
- **Module system:** ESM (`"type": "module"` in package.json)
- **Docker base image:** `node:22-alpine` for backend services
- **Database image:** `postgres:17-alpine`
- **Port assignments:** PostgreSQL `5432`, API `3000`, Next.js `3001`
- **Environment:** Ubuntu via WSL on Windows
