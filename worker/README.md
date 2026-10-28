# Steem Games API Worker

This Worker belongs to the `do2earn/steemgames` project. It is separate from the Steem Flags project.

## Endpoints

- `GET /api/games` — returns active games from the shared D1 database.
- `GET /api/stats` — returns aggregate game, player, post, and vote counts.
- Other routes return JSON 404 responses.

The API is read-only for now. Voting and D2E rewards are deliberately not implemented until server-verifiable Steem authentication and atomic vote/reward processing are ready. Never trust a browser-supplied username as authentication.

## Deploy

From this directory, deploy using Wrangler after connecting your Cloudflare account:

```sh
npx wrangler deploy
```

The Worker binds to the existing D1 database named `do2earn`; it does not create, migrate, or delete database tables.

After deployment, set `window.STEEM_GAMES_API_URL` in the site's `index.html` to the deployed Worker URL. Do not point it to another project's Worker.
