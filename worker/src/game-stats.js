/**
 * Steem Games statistics sync.
 *
 * Steem condenser_api.get_discussions_by_created only provides a recent
 * result window and does not define cursor pagination. Use SteemWorld's
 * indexed tag feed, which supports limit + offset, to backfill full history.
 */
const STEEMWORLD_BASE = "https://sds0.steemworld.org";
const PAGE_SIZE = 1000;
const PAGE_OVERLAP = 5;
const LOCK_MINUTES = 20;
const STATE_CURSOR_VERSION = "steemworld-offset-v2";

async function ensureStatsTables(db) {
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS steemgames_post_index (
      game_id INTEGER NOT NULL,
      author TEXT NOT NULL,
      permlink TEXT NOT NULL,
      created_at TEXT,
      PRIMARY KEY (game_id, author, permlink)
    )
  `).run();
  await db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_steemgames_post_index_game_created
    ON steemgames_post_index (game_id, created_at)
  `).run();
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS steemgames_stats_state (
      game_id INTEGER PRIMARY KEY,
      mode TEXT NOT NULL DEFAULT 'backfill',
      cursor_author TEXT,
      cursor_permlink TEXT,
      baseline_created TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `).run();
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS steemgames_stats_lock (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      lease_until TEXT NOT NULL,
      token TEXT NOT NULL
    )
  `).run();
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS steemgames_stats_meta (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      last_points_updated_at TEXT
    )
  `).run();
  await db.prepare(`
    INSERT OR IGNORE INTO steemgames_stats_meta (id, last_points_updated_at)
    SELECT 1, MAX(stats_synced_at) FROM steemgames
  `).run();
}

async function acquireLock(db) {
  const token = crypto.randomUUID();
  await db.prepare(`
    INSERT INTO steemgames_stats_lock (id, lease_until, token)
    VALUES (1, datetime('now', '+20 minutes'), ?)
    ON CONFLICT(id) DO UPDATE SET
      lease_until = excluded.lease_until,
      token = excluded.token
    WHERE julianday(steemgames_stats_lock.lease_until) <= julianday('now')
  `).bind(token).run();
  const row = await db.prepare(
    "SELECT token FROM steemgames_stats_lock WHERE id = 1 AND token = ?"
  ).bind(token).first();
  return row ? token : null;
}

async function releaseLock(db, token) {
  await db.prepare("DELETE FROM steemgames_stats_lock WHERE id = 1 AND token = ?")
    .bind(token).run();
}

async function getPage(tag, offset) {
  if (!tag || !String(tag).trim()) return [];
  const cleanTag = String(tag).trim().replace(/^#/, "");
  const url = `${STEEMWORLD_BASE}/feeds_api/getPostsByTagCreated/${encodeURIComponent(cleanTag)}/null/0/${PAGE_SIZE}/${Math.max(0, offset)}`;
  const response = await fetch(url, {
    headers: { "accept": "application/json" },
    signal: AbortSignal.timeout(10000)
  });
  if (!response.ok) throw new Error(`STEEMWORLD_HTTP_${response.status}`);
  const payload = await response.json();
  if (payload?.code !== 0 || !Array.isArray(payload?.result?.rows)) {
    throw new Error("INVALID_STEEMWORLD_FEED_RESPONSE");
  }

  // SteemWorld feed columns: author=6, permlink=7, created=8 (Unix seconds).
  return payload.result.rows.map(row => {
    if (!Array.isArray(row) || typeof row[6] !== "string" ||
        typeof row[7] !== "string" || !Number.isFinite(Number(row[8]))) return null;
    return {
      author: row[6],
      permlink: row[7],
      created: new Date(Number(row[8]) * 1000).toISOString()
    };
  }).filter(Boolean);
}

async function savePage(db, gameId, posts) {
  if (!posts.length) return;
  // Keep each D1 batch modest even when the feed page contains 1,000 posts.
  for (let start = 0; start < posts.length; start += 100) {
    const statements = posts.slice(start, start + 100).map(post => db.prepare(`
      INSERT OR IGNORE INTO steemgames_post_index
        (game_id, author, permlink, created_at)
      VALUES (?, ?, ?, ?)
    `).bind(gameId, post.author, post.permlink, post.created));
    await db.batch(statements);
  }
}

async function updateAggregate(db, gameId, markSynced) {
  const aggregate = await db.prepare(`
    SELECT COUNT(*) AS posts, COUNT(DISTINCT author) AS users
    FROM steemgames_post_index WHERE game_id = ?
  `).bind(gameId).first();
  const votesRow = await db.prepare(
    "SELECT COUNT(*) AS votes FROM steemgames_votes WHERE game_id = ?"
  ).bind(gameId).first();

  const posts = Number(aggregate?.posts || 0);
  const users = Number(aggregate?.users || 0);
  const votes = Number(votesRow?.votes || 0);
  const points = posts + users + votes * 0.1;
  const previous = await db.prepare(
    "SELECT points FROM steemgames WHERE id = ? AND is_active = 1"
  ).bind(gameId).first();
  const pointsIncreased = points > Number(previous?.points || 0);

  // Posts/users/votes stay current, but points are a high-water mark:
  // never lower the leaderboard score when a later snapshot is smaller.
  await db.prepare(`
    UPDATE steemgames
       SET posts = ?, users = ?, votes = ?,
           points = CASE
             WHEN ? > COALESCE(points, 0) THEN ?
             ELSE points
           END,
           stats_synced_at = CASE WHEN ? = 1 THEN datetime('now') ELSE stats_synced_at END,
           updated_at = datetime('now')
     WHERE id = ? AND is_active = 1
  `).bind(posts, users, votes, points, points, markSynced ? 1 : 0, gameId).run();

  if (pointsIncreased) {
    await db.prepare(`
      UPDATE steemgames_stats_meta
         SET last_points_updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
       WHERE id = 1
    `).run();
  }

  const current = await db.prepare(
    "SELECT points FROM steemgames WHERE id = ?"
  ).bind(gameId).first();

  return {
    posts,
    users,
    votes,
    calculatedPoints: points,
    points: Number(current?.points ?? points)
  };
}

async function getState(db, gameId) {
  await db.prepare(`
    INSERT OR IGNORE INTO steemgames_stats_state (game_id, mode, baseline_created)
    VALUES (?, 'backfill', datetime('now'))
  `).bind(gameId).run();

  let state = await db.prepare(
    "SELECT game_id, mode, cursor_author, cursor_permlink, baseline_created FROM steemgames_stats_state WHERE game_id = ?"
  ).bind(gameId).first();

  // Reset old condenser cursor state once because that endpoint does not
  // support the cursor pagination previously assumed by this worker.
  if (state?.cursor_permlink !== STATE_CURSOR_VERSION) {
    await db.prepare(`
      UPDATE steemgames_stats_state
         SET mode = 'backfill', cursor_author = '0', cursor_permlink = ?,
             baseline_created = datetime('now'), updated_at = datetime('now')
       WHERE game_id = ?
    `).bind(STATE_CURSOR_VERSION, gameId).run();
    state = await db.prepare(
      "SELECT game_id, mode, cursor_author, cursor_permlink, baseline_created FROM steemgames_stats_state WHERE game_id = ?"
    ).bind(gameId).first();
  }
  return state;
}

async function setState(db, gameId, patch) {
  await db.prepare(`
    UPDATE steemgames_stats_state
       SET mode = ?, cursor_author = ?, cursor_permlink = ?,
           baseline_created = ?, updated_at = datetime('now')
     WHERE game_id = ?
  `).bind(
    patch.mode,
    patch.offset === null ? null : String(patch.offset),
    STATE_CURSOR_VERSION,
    patch.baseline_created,
    gameId
  ).run();
}

function utcMillis(value) {
  if (!value) return NaN;
  let normalized = value.includes("T") ? value : value.replace(" ", "T");
  if (!/(Z|[+-]\d{2}:?\d{2})$/.test(normalized)) normalized += "Z";
  return Date.parse(normalized);
}

async function processGame(db, game) {
  const state = await getState(db, game.id);
  let mode = state.mode;
  let offset = Math.max(0, Number(state.cursor_author || 0));
  let baseline = state.baseline_created;
  let completed = false;
  let scanned = 0;
  let page = [];
  let pages = 0;

  // Process one 1,000-post page per game on every hourly run.
  // Saved offsets and overlap make historical backfill resumable.
  for (let pageIndex = 0; pageIndex < 1; pageIndex += 1) {
    page = await getPage(game.tag, offset);
    pages += 1;
    if (mode === "incremental") {
      const baselineTime = utcMillis(baseline);
      const boundaryIndex = page.findIndex(post => utcMillis(post.created) <= baselineTime);
      const newPosts = boundaryIndex === -1 ? page : page.slice(0, boundaryIndex);
      await savePage(db, game.id, newPosts);
      scanned += newPosts.length;

      if (boundaryIndex !== -1 || page.length === 0 || page.length < PAGE_SIZE) {
        if (page[0]?.created && utcMillis(page[0].created) > baselineTime) baseline = page[0].created;
        offset = 0;
        completed = true;
        break;
      }

      offset += Math.max(1, page.length - PAGE_OVERLAP);
      continue;
    }

    await savePage(db, game.id, page);
    scanned += page.length;

    if (page.length < PAGE_SIZE) {
      mode = "incremental";
      offset = 0;
      completed = true;
      if (page[0]?.created && utcMillis(page[0].created) > utcMillis(baseline)) {
        baseline = page[0].created;
      }
      break;
    }

    offset += Math.max(1, page.length - PAGE_OVERLAP);
  }

  if (mode === "incremental" && completed) {
    offset = 0;
  }

  await setState(db, game.id, {
    mode,
    offset: completed ? null : offset,
    baseline_created: baseline
  });
  const totals = await updateAggregate(db, game.id, completed);
  return {
    gameId: game.id,
    gameName: game.game_name,
    mode,
    pages,
    offset: completed ? 0 : offset,
    scanned,
    completed,
    ...totals
  };
}

export async function refreshDueGameStats(db) {
  await ensureStatsTables(db);
  const token = await acquireLock(db);
  if (!token) return { skipped: true, reason: "SYNC_LOCKED" };

  try {
    // Check every active game on each hourly run. Each game advances by
    // at most one page, preserving resumable backfill and limiting API load.
    const result = await db.prepare(`
      SELECT id, game_name, tag
      FROM steemgames
      WHERE is_active = 1
      ORDER BY id ASC
    `).all();

    const games = result.results || [];
    if (!games.length) return { skipped: true, reason: "NO_ACTIVE_GAMES" };

    const results = [];
    for (const game of games) {
      try {
        results.push({ success: true, ...(await processGame(db, game)) });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error("Steem Games statistics sync failed", {
          gameId: game.id,
          gameName: game.game_name,
          message
        });
        results.push({
          success: false,
          gameId: game.id,
          gameName: game.game_name,
          error: message
        });
      }
    }

    return {
      skipped: false,
      games: games.length,
      updated: results.filter(item => item.success && !item.skipped).length,
      skippedGames: results.filter(item => item.skipped).length,
      failed: results.filter(item => !item.success).length,
      results
    };
  } finally {
    await releaseLock(db, token);
  }
}
