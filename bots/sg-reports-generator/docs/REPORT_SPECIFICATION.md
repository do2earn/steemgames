# SG Daily Report Specification

## Purpose

Publish a concise, engaging daily snapshot of the Steem Games directory. The report is intended to encourage Steem developers, gaming communities, and players to discover SG, vote for their favourite games, play them, and share original gameplay content.

## Data source

Use the current active-game rows returned by the SG Worker endpoint:

`GET https://steemgames.do2earn.workers.dev/api/games`

The endpoint reads the SG shared D1 database. Do not substitute the separate SGA post collector or its historical snapshots. Do not invent missing values. Rank games by the stored Points field in descending order.

## Required sections

1. **Title** — `Steem Games | Daily Report | YYYY-MM-DD`.
2. **Introduction** — one stable paragraph explaining SG, its discovery and community purpose, and inviting readers to join.
3. **Steem Games Status** — a first-person @do2earn editorial paragraph based on the current SG table.
4. **Steem Games Table** — Rank, Games Logo, Points with a green Vote link, Posts, Dedicated Tag, and Developer. Each logo links to that game's information page on the SG website and opens in a new tab.
5. **Steem Games Table Analysis** — exactly two paragraphs, generated from current table metrics. Vary the wording on each generation while keeping every numerical claim grounded in the API response.
6. **Developers Beneficiaries** — allocate 50% of report author rewards to the ten highest-ranked distinct developer accounts, with 5% each. If ten valid accounts are not available, show a clear warning and do not imply the full 50% is assigned.
7. **Tags** — #steemgame, the dedicated tags of the eight highest-ranked games, and #steemflags. Remove duplicates.

## Editor and preview

- Report title: editable/copyable text box with a small copy control.
- Report content: editable HTML box with a small copy control.
- Report tags: editable text box with a small copy control.
- Complete HTML preview: sandboxed and displayed below all editors.

## Accuracy and safety rules

- Use current SG database values; do not scan Steem posts as a substitute for the database.
- Never describe the database's Posts or Users fields as verified gameplay or verified player counts.
- Keep the report's two statistical analysis paragraphs factual and based on actual values.
- The green Vote link should lead readers to the SG directory; voting still requires SG login.
- The report generator is read-only and must never automatically publish or broadcast a transaction.
- @do2earn reviews the report and publishes it manually.
