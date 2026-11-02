# SG Reports Generator

SG Reports Generator is the daily reporting tool for the Steem Games (SG) website. It creates a publication-ready HTML report for @do2earn using the current active-game records exposed by the SG Worker API, which reads the shared Cloudflare D1 database.

## Source of truth

- API: `https://steemgames.do2earn.workers.dev/api/games`
- Database: shared SG D1 database, through the public read-only games endpoint
- Only active games are included.
- The live API supplies each game's name, logo filename, Points, Posts, Votes, dedicated tag, developer account, website URL, and active status.
- Games are ranked by Points, highest first. The report does not scan Steem posts or calculate a separate activity score.

## Daily report structure

1. Title: `Steem Games | Daily Report | YYYY-MM-DD`
2. A stable introductory paragraph about SG and an invitation to join.
3. **Steem Games Status** — a first-person editorial draft attributed to @do2earn, based on the current table.
4. **Steem Games Table** — rank, linked game logo, Points and a green Vote link, Posts, Dedicated Tag, and Developer.
5. Two varied, data-driven statistical analysis paragraphs.
6. **Developers Beneficiaries** — up to ten distinct developer accounts taken in game-rank order, with a 5% beneficiary share each. The intended total is 50%. If fewer than ten valid developer accounts are present, the report explicitly warns that the missing Developer fields must be completed before publishing.
7. Tags: #steemgame, the dedicated tags of the eight highest-ranked games, and #steemflags (duplicates removed).

The title, HTML content, and tags are separately editable/copyable. A sandboxed full HTML preview is rendered below the editors.

## Authentication and safety

- The interface uses the shared SG authentication module and supports Posting Key verification or Steem Keychain.
- Access is restricted in the interface to the fixed account @do2earn.
- Report generation reads the public SG games API only. It does not modify D1, vote, sign a post, or publish to the Steem blockchain.
- Publishing remains a manual step performed by @do2earn after reviewing the title, content, beneficiary list, and tags.
- Static-site authentication is a client-side access gate, not server-enforced protection for confidential data or privileged operations.

## Daily publication checklist

1. Log in to SG as @do2earn.
2. Open SG Reports Generator and generate today's report.
3. Review the game ranking and current database values.
4. Check that ten distinct developer accounts are present and that each beneficiary is correct.
5. Review the generated analysis, edit the HTML if needed, and inspect the complete preview.
6. Copy the title, content, and tags separately.
7. Publish manually from @do2earn.

All generated report text is in English.
