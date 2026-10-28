/**
 * Steem Games statistics calculation and D1 persistence.
 *
 * This module is intentionally separate from the request handlers. It does not
 * fetch data from Steem yet; the caller supplies verified post/user counts from
 * the selected Steem API adapter.
 *
 * Refresh policy: a game's external statistics are stale when stats_synced_at
 * is NULL or at least six hours old. Keep API fetching sequential in the caller
 * to avoid unnecessary load on Steem API nodes.
 */

export const STATS_REFRESH_INTERVAL_HOURS = 6;
const STATS_REFRESH_INTERVAL_SQL = "-6 hours";

function assertNonNegativeInteger(value, field) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new TypeError(`${field} must be a non-negative safe integer`);
  }
}

/**
 * Return active games whose Steem-derived statistics are missing or stale.
 * D1 evaluates timestamps in UTC; stats_synced_at is written with datetime('now').
 */
export async function getGamesDueForStatsRefresh(db) {
  const result = await db.prepare(
    `SELECT id, game_name, tag, stats_synced_at
       FROM steemgames
      WHERE is_active = 1
        AND (
          stats_synced_at IS NULL
          OR julianday(stats_synced_at) IS NULL
          OR julianday(stats_synced_at) <= julianday('now', ?)
        )
      ORDER BY id ASC`
  ).bind(STATS_REFRESH_INTERVAL_SQL).all();

  return result.results || [];
}

/**
 * Count all recorded directory votes for one game.
 * These are SG directory votes, not blockchain votes on game posts.
 */
export async function countDirectoryVotes(db, gameId) {
  const row = await db.prepare(
    "SELECT COUNT(*) AS votes FROM steemgames_votes WHERE game_id = ?"
  ).bind(gameId).first();

  return Number(row?.votes || 0);
}

/**
 * Calculate and persist a game's metrics.
 *
 * stats.posts: total post count for the game's dedicated Steem tag.
 * stats.users: user count from the selected, verified game-statistics source.
 *
 * Votes are counted from steemgames_votes in D1. Exact decimal points are
 * stored in REAL and the listing endpoint should sort by the unrounded value.
 * UI rounding belongs in the frontend, not in this function.
 */
export async function saveGameStats(db, gameId, stats) {
  if (!Number.isSafeInteger(gameId) || gameId < 1) {
    throw new TypeError("gameId must be a positive safe integer");
  }

  const posts = stats?.posts;
  const users = stats?.users;
  assertNonNegativeInteger(posts, "posts");
  assertNonNegativeInteger(users, "users");

  const game = await db.prepare(
    "SELECT id FROM steemgames WHERE id = ? AND is_active = 1"
  ).bind(gameId).first();

  if (!game) {
    throw new Error(`Active Steem Games entry not found: ${gameId}`);
  }

  const votes = await countDirectoryVotes(db, gameId);
  const points = posts + users + (votes * 0.1);

  const result = await db.prepare(
    `UPDATE steemgames
        SET posts = ?,
            users = ?,
            votes = ?,
            points = ?,
            stats_synced_at = datetime('now'),
            updated_at = datetime('now')
      WHERE id = ? AND is_active = 1`
  ).bind(posts, users, votes, points, gameId).run();

  if (!result.success || result.meta?.changes !== 1) {
    throw new Error(`Failed to save statistics for game id ${gameId}`);
  }

  return { gameId, posts, users, votes, points };
}

/**
 * Process stale games one at a time. fetchExternalStats(game) must return
 * { posts, users } from the chosen Steem/game statistics source.
 *
 * The API adapter and a cross-isolate refresh lock must be added before this
 * function is called automatically from public request handlers. Sequential
 * processing reduces load, but by itself is not a distributed concurrency lock.
 */
export async function refreshDueGameStats(db, fetchExternalStats) {
  if (typeof fetchExternalStats !== "function") {
    throw new TypeError("fetchExternalStats must be a function");
  }

  const dueGames = await getGamesDueForStatsRefresh(db);
  const results = [];

  for (const game of dueGames) {
    try {
      const stats = await fetchExternalStats(game);
      const saved = await saveGameStats(db, game.id, stats);
      results.push({ ...saved, success: true });
    } catch (error) {
      console.error("Steem Games stats refresh failed", {
        gameId: game.id,
        gameName: game.game_name,
        message: error instanceof Error ? error.message : String(error)
      });
      results.push({
        gameId: game.id,
        gameName: game.game_name,
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  return {
    checked: dueGames.length,
    updated: results.filter((item) => item.success).length,
    failed: results.filter((item) => !item.success).length,
    results
  };
}
