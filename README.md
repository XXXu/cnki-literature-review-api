# CNKI Literature Review API

Backend API service for the CNKI Literature Review Assistant browser extension.

The extension collects literature metadata from CNKI result pages. This backend handles user accounts, quota checks, DeepSeek API calls, and report generation for quick and deep literature review workflows.

## Product Positioning

This project is not a paper-writing service and does not bypass CNKI access restrictions. It helps students prepare traceable literature review materials before writing a thesis or dissertation.

The intended workflow is:

1. The browser extension collects papers from CNKI search result pages.
2. The user logs in and generates a quick review based on titles, abstracts, and keywords.
3. The quick review helps identify representative papers worth reading in full.
4. The user legally obtains PDF files and imports them in the extension.
5. The backend generates a deeper review report based on the collected metadata and PDF full text.
6. The extension downloads the generated report locally.

## Planned Tech Stack

- Runtime: Node.js
- Language: TypeScript
- Web framework: Fastify
- Database: SQLite
- ORM: Prisma
- Deployment target: Tencent Cloud server
- Process manager: PM2 for the MVP phase

## Python Virtual Environment

If Python helper scripts are added later, they should use a project-local .venv virtual environment. The backend service itself remains Node.js + TypeScript.

## MVP Responsibilities

The backend should provide:

- User registration and login
- Authentication for protected API routes
- Quick review quota checks and deductions
- Deep review task quota checks and deductions
- DeepSeek API integration
- Quick review report generation
- Deep review report generation
- Minimal task metadata and quota logs
- Health check endpoint

The backend should not provide in the MVP:

- CNKI PDF or CAJ downloading
- Any bypass of CNKI login, captcha, payment, or permission controls
- Long-term PDF storage
- Long-term cloud report history
- Online document library
- Team collaboration
- Paper ghostwriting features

## Planned API Surface

```text
GET  /health
POST /auth/register
POST /auth/login
GET  /me
POST /review/quick
POST /review/deep
```

## Environment Variables

Copy `.env.example` to `.env` for local development and fill in real secrets:

```text
NODE_ENV=development
PORT=3000
HOST=127.0.0.1
DATABASE_URL="file:./dev.db"
DEEPSEEK_API_KEY="your DeepSeek API key"
DEEPSEEK_BASE_URL="https://api.deepseek.com"
DEEPSEEK_MODEL="deepseek-chat"
JWT_SECRET="a long random secret"
LOG_LEVEL=info
LOG_FILE=logs/app.log
SMTP_HOST=""
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=""
SMTP_PASS=""
SMTP_FROM=""
SMTP_FROM_NAME="CNKI Literature Review Assistant"
```

`DEEPSEEK_API_KEY` must stay on the backend. Never expose it to the browser extension or frontend build artifacts.

Registration requires an email verification code. In production, configure `SMTP_HOST` and `SMTP_FROM`; if the mail provider requires authentication, also configure `SMTP_USER` and `SMTP_PASS`. When the email sender is not configured, the API refuses to send verification codes and new users cannot bypass ownership verification.

## Review Modes

### Quick Review

Input:

- Paper title
- Authors
- Source
- Publication date
- Abstract
- Keywords
- CNKI detail URL

Output:

- Topic categories
- Representative papers
- Repeated viewpoints
- Possible research gaps
- Suggested papers for full-text reading
- Literature review material draft

### Deep Review

Input:

- Collected paper metadata
- Extracted PDF full text from the extension
- PDF-to-paper matching information

Output:

- Per-paper structured analysis
- Method and data comparison
- Research lineage
- Representative papers
- Common limitations
- Research gaps
- Traceable literature review material

## Data and Privacy Principles

- Store only the minimum data needed for accounts, quotas, and task audit metadata.
- Do not store raw PDF full text or generated report bodies long-term in the MVP.
- Never expose DeepSeek API keys, payment secrets, database URLs, or JWT secrets to the browser extension.
- Avoid logging full paper text, full reports, passwords, or access tokens.
- Generated reports should be returned to the extension for local download.

## Related Project

Browser extension project:

```text
C:\workspace\cnki-extension-ai-export
```

## Current Status

This repository has been initialized for backend planning. Implementation scaffolding has not been added yet.

