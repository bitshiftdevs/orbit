# Orbit

Internal mission control for [BitShift](https://bitshiftdevs.com) — projects,
issues, sprints, secrets and files, in one place.

Think Jira, sized for a small dev studio and free of GitHub Projects' 5-project
limit. Owned by us, self-hosted on Netlify, backed by Postgres.

## Stack

- **Runtime & package manager** — [Bun](https://bun.sh)
- **Frontend** — Vue 3 + Vite + Tailwind v4 + Reka UI + Pinia
- **API** — Hono on Netlify Functions (Node runtime, bundled by esbuild)
- **DB** — Postgres + Drizzle ORM
- **Auth** — invite-only, argon2 passwords, signed session cookies, optional TOTP MFA, bearer API tokens
- **Secrets** — AES-256-GCM at rest, decrypted only on read (audit-logged)
- **Files** — stored as `bytea` in Postgres, 5 MB cap per file

## Features

- **Jira-style board** — kanban with drag-and-drop, fractional-index ranking
- **Backlog** — filterable list, multi-select bulk edit, per-user saved filters
- **Sprints** — plan/start/complete, story points, burndown chart
- **Secrets & env vars** — per-project, per-environment, one-click `.env` export
- **Files** — inline image + PDF previews, sha256 dedup
- **Notifications** — @mentions, assignments, comments; bell in the sidebar
- **Markdown everywhere** — issue descriptions & comments with mention autocomplete
- **⌘K palette** — jump to any project, issue (by `KEY-42`), member or secret
- **Keyboard shortcuts** — `c` new issue, `/` search, `g d/p/t/s` navigate, `esc` close
- **Webhooks** — Slack, Discord, or any URL; HMAC-signed; delivery log
- **API tokens** — `Authorization: Bearer orb_…` for CLI/CI/MCP; project-scoped tokens gate `env:read` / `secrets:read`
- **GitHub Action** — [`action/`](./action) — `uses: bitshiftdevs/orbit/action@v1` loads a project's env + secrets into any workflow
- **TOTP MFA** — enrol from Settings, works with any authenticator app
- **Nightly backup** — Netlify scheduled function dumps DB to any S3-compatible bucket
- **Audit log** — every secret read, file download, and admin action

## Setup

```sh
bun install
cp .env.schema .env      # fill DATABASE_URL, SECRETS_MASTER_KEY, SESSION_SECRET
bun run db:generate       # generate initial migration
bun run db:migrate        # apply migrations
bun run db:seed           # create the first owner (prompts interactively)
bun run dev               # netlify dev on http://localhost:8888
```

Generate the keys the env file needs:

```sh
openssl rand -base64 32   # SECRETS_MASTER_KEY
openssl rand -base64 48   # SESSION_SECRET
```

Bun auto-loads `.env` for any script run through it, so no `dotenv` needed.

## Deploy

Push to the git remote linked in Netlify. `netlify.toml` pins `BUN_VERSION` and
sets the build command to `bun run build`. Set the same env vars in the Netlify
dashboard (Site settings → Environment variables). Migrations run manually
against production: `DATABASE_URL=... bun run db:migrate`.

## Backups

The nightly backup lives at `netlify/functions/backup.ts` and runs on the
Netlify `@daily` schedule. Set these env vars to enable it:

```
BACKUP_S3_BUCKET=orbit-backups
BACKUP_S3_REGION=auto
BACKUP_S3_ENDPOINT=https://<account>.r2.cloudflarestorage.com   # or S3 / MinIO
BACKUP_S3_ACCESS_KEY_ID=…
BACKUP_S3_SECRET_ACCESS_KEY=…
```

The function writes a single `orbit-<timestamp>.sql` object per run.

## Using the API

Create a token in **Settings → API tokens**, then hit any endpoint:

```sh
curl -H "Authorization: Bearer orb_…" https://<your-orbit>/api/projects
```

All routes accept either a session cookie (browser) or a bearer token (CLI/CI).

## Importing existing issues

```sh
gh api "repos/OWNER/REPO/issues?state=all" --paginate > gh.json
bun run scripts/import-github.ts --project ORB --file gh.json
```

Labels named `bug/task/story/chore/epic` map to issue type; labels named
`urgent/high/medium/low/trivial` map to priority; assignee GitHub logins are
matched against Orbit handles.
