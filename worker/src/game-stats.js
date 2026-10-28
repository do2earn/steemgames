/**
 * Steem Games statistics sync.
 *
 * Posts are indexed in D1 so counts stay exact across paginated scans and
 * retries. A historical backfill advances over multiple scheduled runs;
 * later runs only scan new posts until reaching the previous high-water mark.
 */
import { steemRpc } from "./steem-api.js";

const PAGE_SIZE = 100;
const PAGES_PER_GAME_PER_RUN = 2;
const REFRESH_HOURS = 6;
const LOCK_MINUTES = 20;

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

async function getPage(tag, cursorAuthor, cursorPermlink) {
  if (!tag || !String(tag).trim()) return [];
  const query = {
    tag: String(tag).trim().replace(/^#/, ""),
    limit: PAGE_SIZE
  };
  if (cursorAuthor && cursorPermlink) {
    query.start_author = cursorAuthor;
    query.start_permlink = cursorPermlink;
  }
  const result = await steemRpc("condenser_api.get_discussions_by_created", [query]);
  if (!Array.isArray(result)) throw new Error("INVALID_STEEM_DISCUSSIONS_RESPONSE");
  return result.filter(post =>
    post && typeof post.author === "string" &&
    typeof post.permlink === "string" && typeof post.created === "string"
  );
}

async function savePage(db, gameId, posts) {
  if (!posts.length) return;
  const statements = posts.map(post => db.prepare(`
    INSERT OR IGNORE INTO steemgames_post_index
      (game_id, author, permlink, created_at)
    VALUES (?, ?, ?, ?)
  `).bind(gameId, post.author, post.permlink, post.created));
  await db.batch(statements);
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

  await db.prepare(`
    UPDATE steemgames
       SET posts = ?, users = ?, votes = ?, points = ?,
           stats_synced_at = CASE WHEN ? = 1 THEN datetime('now') ELSE stats_synced_at END,
           updated_at = datetime('now')
     WHERE id = ? AND is_active = 1
  `).bind(posts, users, votes, points, markSynced ? 1 : 0, gameId).run();

  return { posts, users, votes, points };
}

async function getState(db, gameId) {
  await db.prepare(`
    INSERT OR IGNORE INTO steemgames_stats_state (game_id, mode, baseline_created)
    VALUES (?, 'backfill', datetime('now'))
  `).bind(gameId).run();
  return db.prepare(
    "SELECT game_id, mode, cursor_author, cursor_permlink, baseline_created FROM steemgames_stats_state WHERE game_id = ?"
  ).bind(gameId).first();
}

async function setState(db, gameId, patch) {
  await db.prepare(`
    UPDATE steemgames_stats_state
       SET mode = ?, cursor_author = ?, cursor_permlink = ?,
           baseline_created = ?, updated_at = datetime('now')
     WHERE game_id = ?
  `).bind(
    patch.mode,
    patch.cursor_author || null,
    patch.cursor_permlink || null,
    patch.baseline_created,
    gameId
  ).run();
}

function utcMillis(value) {
  if (!value) return NaN;
  let normalized = value.includes("T") ? value : value.replace(" ", "T");
  if (!/(Z|[+-]\\d{2}:?\\d{2})$/.test(normalized)) normalized += "Z";
  return Date.parse(normalized);
}

async function processGame(db, game) {
  const state = await getState(db, game.id);
  const syncRow = await db.prepare(
    "SELECT stats_synced_at FROM steemgames WHERE id = ?"
  ).bind(game.id).first();
  const syncAge = syncRow?.stats_synced_at
    ? await db.prepare(
        "SELECT (julianday('now') - julianday(?)) * 24 AS hours"
      ).bind(syncRow.stats_synced_at).first()
    : null;

  if (
    state.mode === "incremental" &&
    !state.cursor_author &&
    Number(syncAge?.hours ?? 999999) < REFRESH_HOURS
  ) {
    return { gameId: game.id, skipped: true, reason: "FRESH" };
  }

  let cursorAuthor = state.cursor_author;
  let cursorPermlink = state.cursor_permlink;
  let mode = state.mode;
  let baseline = state.baseline_created;
  let completed = false;
  let pages = 0;
  let scanned = 0;

  for (let i = 0; i < PAGES_PER_GAME_PER_RUN; i += 1) {
    const page = await getPage(game.tag, cursorAuthor, cursorPermlink);
    pages += 1;

    if (mode === "incremental") {
      const baselineTime = utcMillis(baseline);
      const boundaryIndex = page.findIndex(post => utcMillis(post.created) <= baselineTime);
      const newPosts = boundaryIndex === -1 ? page : page.slice(0, boundaryIndex);
      await savePage(db, game.id, newPosts);
      scanned += newPosts.length;

      if (boundaryIndex !== -1 || page.length === 0 || page.length < PAGE_SIZE) {
        if (page[0]?.created && utcMillis(page[0].created) > baselineTime) baseline = page[0].created;
        cursorAuthor = null;
        cursorPermlink = null;
        completed = true;
        await setState(db, game.id, {
          mode: "incremental", cursor_author: null, cursor_permlink: null,
          baseline_created: baseline
        });
        break;
      }

      const last = page[page.length - 1];
      cursorAuthor = last.author;
      cursorPermlink = last.permlink;
      await setState(db, game.id, {
        mode, cursor_author: cursorAuthor, cursor_permlink: cursorPermlink,
        baseline_created: baseline
      });
      continue;
    }

    await savePage(db, game.id, page);
    scanned += page.length;

    if (page.length < PAGE_SIZE) {
      mode = "incremental";
      cursorAuthor = null;
      cursorPermlink = null;
      completed = true;
      await setState(db, game.id, {
        mode, cursor_author: null, cursor_permlink: null,
        baseline_created: baseline
      });
      break;
    }

    const last = page[page.length - 1];
    cursorAuthor = last.author;
    cursorPermlink = last.permlink;
    await setState(db, game.id, {
      mode, cursor_author: cursorAuthor, cursor_permlink: cursorPermlink,
      baseline_created: baseline
    });
  }

  const totals = await updateAggregate(db, game.id, completed);
  return {
    gameId: game.id,
    gameName: game.game_name,
    mode,
    pages,
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
    const result = await db.prepare(`
      SELECT id, game_name, tag
      FROM steemgames
      WHERE is_active = 1
      ORDER BY id ASC
    `).all();

    const results = [];
    for (const game of result.results || []) {
      try {
        results.push({ success: true, ...(await processGame(db, game)) });
      } catch (error) {
        console.error("Steem Games statistics sync failed", {
          gameId: game.id,
          gameName: game.game_name,
          message: error instanceof Error ? error.message : String(error)
        });
        results.push({
          success: false,
          gameId: game.id,
          gameName: game.game_name,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    return {
      skipped: false,
      games: results.length,
      updated: results.filter(item => item.success && !item.skipped).length,
      failed: results.filter(item => !item.success).length,
      results
    };
  } finally {
    await releaseLock(db, token);
  }
}
