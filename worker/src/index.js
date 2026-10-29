import { refreshDueGameStats } from "./game-stats.js";

const ALLOWED_ORIGINS = new Set([
  "https://steemgames.do2earn.dev",
  "https://do2earn.github.io"
]);

function corsHeaders(request) {
  const origin = request.headers.get("Origin") || "";
  const headers = {
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin"
  };
  if (ALLOWED_ORIGINS.has(origin)) headers["Access-Control-Allow-Origin"] = origin;
  return headers;
}

function json(request, body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...corsHeaders(request) }
  });
}

const GAME_LOGO_FILES = [
  ["cur8games", "cur8_logo.png"],
  ["drugwars", "drugwars_logo.png"],
  ["hariraid", "hariraid_logo.png"],
  ["memorygame", "memorygame_logo.png"],
  ["pixelcraft", "pixelcraft_logo.png"],
  ["steem4poker", "steem4poker_logo.png"],
  ["steem4snake", "steem4snake_logo.png"],
  ["steem8ball", "steem8ball_logo.png"],
  ["steemarchers", "steemarchers_logo.png"],
  ["steembingo", "steembingo_logo.png"],
  ["steemflags", "steemflags_logo.png"],
  ["steemheights", "steemheights_logo.png"],
  ["steemhop", "steemhop_logo.png"],
  ["steemludo", "steemludo_logo.png"],
  ["steemmaze", "steemmaze_logo.png"],
  ["steemretrogames", "steemretrogames_logo.png"]
];

async function ensureGameLogoFilenames(db) {
  for (const [normalizedName, filename] of GAME_LOGO_FILES) {
    await db.prepare(`
      UPDATE steemgames
         SET game_logo = ?
       WHERE lower(replace(replace(replace(game_name, ' ', ''), '-', ''), '_', '')) = ?
         AND (game_logo IS NULL OR game_logo != ?)
    `).bind(filename, normalizedName, filename).run();
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(request) });
    }
    if (!["GET", "POST"].includes(request.method)) {
      return json(request, { success: false, error: "METHOD_NOT_ALLOWED" }, 405);
    }
    if (!env.DB) {
      return json(request, { success: false, error: "DATABASE_BINDING_MISSING" }, 500);
    }

    try {
      if (url.pathname === "/api/admin/game" && request.method === "POST") {
        let body;
        try { body = await request.json(); } catch { return json(request, { success: false, error: "INVALID_JSON" }, 400); }
        const { username, gameId, fields, message, signature } = body || {};
        if (String(username || "").toLowerCase() !== "do2earn" || !Number.isInteger(Number(gameId)) ||
            !fields || typeof fields !== "object" || typeof message !== "string" || typeof signature !== "string") {
          return json(request, { success: false, error: "INVALID_ADMIN_REQUEST" }, 400);
        }
        const messageLines = message.split("\n");
        const timestamp = Number(messageLines[3]?.replace("Timestamp: ", ""));
        const signedGameId = Number(messageLines[2]?.replace("Game ID: ", ""));
        const nonce = messageLines[4]?.replace("Nonce: ", "");
        const signedPayloadHex = messageLines[5]?.replace("Payload: ", "");
        if (messageLines.length !== 6 || messageLines[0] !== "Steem Games Admin Edit" ||
            messageLines[1] !== "Account: do2earn" || signedGameId !== Number(gameId) ||
            !Number.isFinite(timestamp) || Math.abs(Date.now() - timestamp) > 5 * 60 * 1000 ||
            !/^[a-f0-9-]{16,}$/i.test(nonce || "") || !/^[a-f0-9]+$/i.test(signedPayloadHex || "")) {
          return json(request, { success: false, error: "INVALID_OR_EXPIRED_SIGNATURE_MESSAGE" }, 400);
        }
        const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(message));
        const hash = [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, "0")).join("");
        const rpcBody = JSON.stringify({ jsonrpc: "2.0", method: "database_api.verify_signatures", params: { hash, signatures: [signature], required_owner: [], required_active: [], required_posting: ["do2earn"], required_other: [] }, id: 1 });
        let verified = false;
        for (const endpoint of ["https://api.steemit.com", "https://api.justyy.com", "https://steemd.steemworld.org"]) {
          try {
            const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: rpcBody, signal: AbortSignal.timeout(7000) });
            const result = await response.json();
            if (result?.result?.valid === true) { verified = true; break; }
          } catch {}
        }
        if (!verified) return json(request, { success: false, error: "ADMIN_SIGNATURE_INVALID" }, 403);
        const payload = JSON.stringify(fields);
        const payloadHex = [...new TextEncoder().encode(payload)].map(b => b.toString(16).padStart(2, "0")).join("");
        if (payloadHex !== signedPayloadHex.toLowerCase()) return json(request, { success: false, error: "SIGNED_PAYLOAD_MISMATCH" }, 400);
        const allowed = ["game_name", "game_logo", "points", "posts", "votes", "users", "tag", "developer", "genres", "about", "website_url", "is_active", "created_at", "stats_synced_at"];
        const updates = allowed.filter(key => Object.prototype.hasOwnProperty.call(fields, key));
        const numericFields = ["points", "posts", "votes", "users"];
        if (!updates.length ||
            updates.some(key => numericFields.includes(key) ? !Number.isFinite(Number(fields[key])) || Number(fields[key]) < 0 :
              key === "is_active" ? ![0, 1, "0", "1"].includes(fields[key]) :
              ["created_at", "stats_synced_at"].includes(key) ? fields[key] !== null && typeof fields[key] !== "string" :
              typeof fields[key] !== "string") ||
            ("points" in fields && !Number.isFinite(Number(fields.points)))) {
          return json(request, { success: false, error: "INVALID_GAME_FIELDS" }, 400);
        }
        const sets = updates.map(key => key + " = ?").join(", ");
        const values = updates.map(key => numericFields.includes(key) ? Number(fields[key]) :
          key === "is_active" ? Number(fields[key]) :
          ["created_at", "stats_synced_at"].includes(key) ? (fields[key] || null) : String(fields[key] ?? "").trim());
        const result = await env.DB.prepare("UPDATE steemgames SET " + sets + ", updated_at = datetime('now') WHERE id = ?").bind(...values, Number(gameId)).run();
        if (!result.meta?.changes) return json(request, { success: false, error: "GAME_NOT_FOUND" }, 404);
        const game = await env.DB.prepare("SELECT id, game_name, game_logo, points, posts, votes, users, tag, developer, genres, about, website_url, is_active, created_at, updated_at, stats_synced_at FROM steemgames WHERE id = ?").bind(Number(gameId)).first();
        return json(request, { success: true, game });
      }

      if (url.pathname === "/api/account") {
        const username = String(url.searchParams.get("username") || "").trim();
        if (!/^[a-z][a-z0-9.-]{2,31}$/i.test(username)) {
          return json(request, { success: false, error: "INVALID_USERNAME" }, 400);
        }
        const account = await env.DB.prepare(
          "SELECT Username, COALESCE(D2E, 0) AS D2E FROM accounts WHERE lower(Username) = lower(?) LIMIT 1"
        ).bind(username).first();
        return json(request, {
          success: true,
          account: account || { Username: username, D2E: 0 }
        });
      }

      if (url.pathname === "/api/games") {
        await ensureGameLogoFilenames(env.DB);
        const includeInactive = url.searchParams.get("include_inactive") === "1";
        const query = includeInactive
          ? "SELECT id, game_name, game_logo, points, posts, votes, users, tag, developer, genres, about, website_url, is_active, stats_synced_at FROM steemgames ORDER BY game_name COLLATE NOCASE ASC"
          : "SELECT id, game_name, game_logo, points, posts, votes, users, tag, developer, genres, about, website_url, is_active, stats_synced_at FROM steemgames WHERE is_active = 1 ORDER BY points DESC, game_name COLLATE NOCASE ASC";
        const result = await env.DB.prepare(query).all();
        const meta = await env.DB.prepare(
          "SELECT last_points_updated_at FROM steemgames_stats_meta WHERE id = 1"
        ).first().catch(() => null);
        return json(request, {
          success: true,
          stats_engine: "steemworld-offset-v4",
          last_points_updated_at: meta?.last_points_updated_at || null,
          games: result.results || []
        });
      }

      if (url.pathname === "/api/stats") {
        const result = await env.DB.prepare(
          "SELECT COUNT(*) AS games, COALESCE(SUM(users), 0) AS players, COALESCE(SUM(posts), 0) AS posts, COALESCE(SUM(votes), 0) AS votes FROM steemgames WHERE is_active = 1"
        ).first();
        return json(request, { success: true, stats: result || { games: 0, players: 0, posts: 0, votes: 0 } });
      }

      return json(request, { success: false, error: "NOT_FOUND" }, 404);
    } catch (error) {
      console.error("Steem Games API database query failed", {
        path: url.pathname,
        message: error instanceof Error ? error.message : String(error)
      });
      return json(request, { success: false, error: "DATABASE_QUERY_FAILED" }, 500);
    }
  },

  scheduled(controller, env, ctx) {
    if (!env.DB) {
      console.error("Steem Games scheduled sync failed: D1 binding DB is missing");
      return;
    }
    ctx.waitUntil((async () => {
      try {
        await ensureGameLogoFilenames(env.DB);
        const result = await refreshDueGameStats(env.DB);
        console.log("Steem Games scheduled statistics sync", JSON.stringify({
          scheduledTime: new Date(controller.scheduledTime).toISOString(),
          cron: controller.cron,
          ...result
        }));
      } catch (error) {
        console.error("Steem Games scheduled statistics sync failed", {
          message: error instanceof Error ? error.message : String(error)
        });
      }
    })());
  }
};
