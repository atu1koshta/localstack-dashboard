# LocalStack Dashboard

A lightweight web UI for interacting with [LocalStack](https://localstack.cloud) — browse S3 buckets, manage SQS queues, invoke Lambda functions, publish to SNS topics, and monitor service health.

No build step. No framework overhead. Just Express + vanilla JS.

## Prerequisites

- [Node.js](https://nodejs.org) v18+
- [LocalStack](https://localstack.cloud) running on `http://localhost:4566`

## Quick Start

```bash
npm install
npm run dev
```

Open **http://localhost:3100**

## Features

### Health
- View all LocalStack service statuses (running/available)
- Shows LocalStack version and edition

### S3
- List, create, and delete buckets
- Browse objects by prefix (folder navigation)
- Delete individual objects

### SQS
- List queues with message counts (total, visible, in-flight)
- Inspect queue attributes (ARN, URL, type, retention, visibility timeout) with copy support
- Send messages (auto-handles FIFO queues with group ID and deduplication)
- Poll and receive messages
- Delete individual messages
- Purge queues

### Lambda
- List functions with runtime, handler, memory, and timeout info
- Click function name to open a split view with:
  - **Details panel** — runtime, handler, memory, timeout, environment variables
  - **Live logs** — streams CloudWatch logs in follow mode (polls every 3s, auto-scrolls, scroll up to pause)
- Invoke functions with custom JSON payloads

### SNS
- List, create, and delete topics
- Inspect topic attributes (ARN, subscription counts) with copy support
- Publish messages with optional subject
- Add subscriptions (SQS, HTTP, HTTPS, Email, Lambda)
- List and remove subscriptions

## Configuration

| Environment Variable   | Default                  | Description              |
|------------------------|--------------------------|--------------------------|
| `PORT`                 | `3100`                   | Server port              |
| `LOCALSTACK_ENDPOINT`  | `http://localhost:4566`  | LocalStack endpoint URL  |
| `AWS_REGION`           | `us-east-1`              | AWS region               |

Example:

```bash
LOCALSTACK_ENDPOINT=http://localhost:4566 PORT=8080 npm run dev
```

## Project Structure

```
localstack-dashboard/
├── server.js                  # Express entry point
├── aws-client.js              # Shared LocalStack client config
├── middleware/
│   └── error-handler.js       # Global async error handler
├── routes/
│   ├── health.js              # GET /api/health
│   ├── s3.js                  # /api/s3/*
│   ├── sqs.js                 # /api/sqs/*
│   ├── lambda.js              # /api/lambda/*
│   └── sns.js                 # /api/sns/*
└── public/
    ├── index.html             # SPA shell
    ├── app.js                 # Frontend routing + page renderers
    └── style.css              # Dark theme styles
```

## Extending

To add a new AWS service:

1. Create `routes/<service>.js` with your endpoints
2. Register it in `server.js`: `app.use("/api/<service>", require("./routes/<service>"))`
3. Add a nav link in `public/index.html`
4. Add a page renderer function in `public/app.js` and register it in the `pages` object

Errors are handled globally — just write your route handlers as plain `async` functions. No try/catch needed (uses `express-async-errors`).
