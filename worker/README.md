# Steem Games API Worker

This Worker belongs to the `do2earn/steemgames` project. It is separate from the Steem Flags project.

## API endpoints

- `GET /api/games` — returns active games from the shared D1 database, ordered by exact points.
- `GET /api/stats` — returns aggregate game, unique-author, post, and directory-vote counts.

## Scheduled statistics sync

Cloudflare Cron triggers the statistics job every 15 minutes. The job uses public Steem condenser RPC nodes with failover and updates each active game's:

- `posts`: indexed posts for its dedicated Steem tag.
- `users`: distinct authors across those posts.
- `votes`: votes recorded in the Steem Games directory table `steemgames_votes`.
- `points`: `posts + users + (votes × 0.1)`.

A historical scan advances in batches and persists its cursor in D1. Once the historical scan completes, subsequent refreshes look for new posts and are throttled to six hours unless an incremental scan is still in progress. Post records and scan-state tables are created with `CREATE TABLE IF NOT EXISTS` by the Worker; no manual D1 migration is required. A D1 lease lock prevents overlapping sync jobs.

The Worker uses the existing shared D1 database named `do2earn`. It does not alter or connect to Steem Flags. Statistics sync is read-only with respect to the Steem blockchain; it only writes derived statistics into D1.

## Deploy

The GitHub Actions workflow `.github/workflows/deploy-steemgames-api.yml` deploys changes under `worker/` to Cloudflare Workers. It requires the repository secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`.

Manual deploy from this directory:

```sh
npx wrangler deploy
```

The site should set `window.STEEM_GAMES_API_URL` to the deployed Worker URL. Do not point it to another project's Worker.

Voting and D2E rewards are not implemented by this statistics integration. Never trust a browser-supplied username as authentication.
