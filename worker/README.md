# Steem Games API Worker

This Worker belongs to the `do2earn/steemgames` project. It is separate from the Steem Flags project.

## API endpoints

- `GET /api/games` — returns active games from the shared D1 database, ordered by exact points.
- `GET /api/stats` — returns aggregate game, unique-author, post, and directory-vote counts.

## Scheduled statistics sync

Cloudflare Cron triggers the statistics job **once per hour at minute 0 (UTC)**. Each run processes at most one active game's 1,000-post page, rotating fairly between games. This limits API traffic and D1 writes; historical backfill is incremental and resumable.

The job uses SteemWorld's indexed tag feed at `https://sds0.steemworld.org` and updates each active game's:
- `posts`: indexed posts for its dedicated Steem tag.
- `users`: distinct authors across those posts.
- `votes`: votes recorded in the Steem Games directory table `steemgames_votes`.
- `points`: calculated as `posts + users + (votes × 0.1)`.

Post counts, unique-author counts, and vote counts are refreshed from the indexed data. The stored `points` value is a high-water mark: it is updated only when the newly calculated score is greater than the existing database value; it is never reduced by a smaller later snapshot. Exact decimal values are stored and used for ranking.

Once historical backfill completes, new-post scans are throttled to a six-hour refresh interval. A D1 lease lock prevents overlapping sync jobs, and API errors do not reset valid stored data.

The Worker uses the existing shared D1 database named `do2earn`. It does not alter or connect to Steem Flags. Statistics sync is read-only with respect to the Steem blockchain; it only writes derived statistics into D1.

## Deploy

The GitHub Actions workflow `.github/workflows/deploy-steemgames-api.yml` deploys changes under `worker/` to Cloudflare Workers. It requires the repository secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`.

Manual deploy from this directory:

```sh
npx wrangler deploy
```

The site should set `window.STEEM_GAMES_API_URL` to the deployed Worker URL. Do not point it to another project's Worker.

Voting and D2E rewards are not implemented by this statistics integration. Never trust a browser-supplied username as authentication.
