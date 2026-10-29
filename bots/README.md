# Steem Games Bots

This directory contains the administrative tools integrated into Steem Games.

- `sg-reports-generator/` — complete Steem Games Analyst project, including historical snapshots, reports, scripts, source data, documentation, and its original workflow definitions.
- `sg-points-checker/` — SG Points Checker web application.

GitHub Actions only discovers workflows under the repository-root `.github/workflows/` directory. The active daily SGA collector therefore lives at `.github/workflows/sg-reports-collector.yml` and targets the files inside `bots/sg-reports-generator/`.

The Admin Tools menu is a client-side display gate for the current username `do2earn`; it is not server-side authorization.
