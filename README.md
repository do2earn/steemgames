# Steem Games

A public, mobile-first directory of games built on the Steem blockchain.

## Project rules
- Public directory content is visible whether the visitor is logged in or logged out.
- Login is required only for account actions such as voting.
- Login methods follow Steem Flags: **Steem Posting Key** is selected by default; **Steem Keychain** is the alternative.
- One vote per user, per game, per UTC date.
- A successful vote rewards 2 D2E.
- Energy is not part of the Steem Games experience.
- Posting keys must never be stored in localStorage, sessionStorage, URLs, or the database.

## Structure
- `index.html`: public directory shell
- `assets/css/style.css`: responsive light theme
- `assets/js/steem-auth.js`: Steem login verification helpers
- `assets/images/`: site and game images (add images in GitHub)

## Backend
The frontend must use a Cloudflare Worker for public game data and authenticated vote processing. Never trust a username supplied by the browser as proof of identity. Before enabling rewards, implement server-verifiable authentication and atomic vote + D2E crediting against the shared D1 database.
