# plainfare — Roadmap

Features and infrastructure for future releases.

---

## Infrastructure and Scaling

For when plainfare outgrows a single-user homelab.

### Persistent job queue (BullMQ + Redis)
Replace the in-process queue with BullMQ. Jobs survive restarts, support
retries, and enable horizontal scaling. The current `JobQueue` interface is
already designed for this swap.

### Real-time job progress (SSE or WebSocket)
Replace polling in `useJobPolling` with server-sent events. Reduces
unnecessary requests and gives instant feedback.

### Full-text search
Replace the substring matching in `RecipeLibrary.list()` with a proper search
index — SQLite FTS5 or MeiliSearch. Supports stemming, fuzzy matching, and
ranked results. Important once collections grow past a few hundred recipes.

### Authentication and multi-user
Add auth (probably OAuth2 / OIDC via an external provider) and per-user
recipe directories. Necessary before any hosted/SaaS deployment.

---

## Not planned (and why)

- **Custom markdown syntax** — plainfare's differentiator is that files are
  plain markdown. No `@ingredient{qty}` annotations. If a feature needs
  machine markup, derive it at parse time.
- **Database backend** — `.md` files are the database. This is the core
  philosophy, not a limitation to fix.
- **Mobile app** — Telegram bot covers mobile ingestion. For reading, the
  web UI works on mobile browsers. A native app adds maintenance burden
  without enough upside yet.
