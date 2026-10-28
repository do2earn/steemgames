import { refreshDueGameStats } from "./game-stats.js";

const ALLOWED_ORIGINS = new Set([
  "https://steemgames.do2earn.dev",
  "https://do2earn.github.io"
]);

function corsHeaders(request) {
  const origin = request.headers.get("Origin") || "";
  const headers = {
    "Access-Control-Allow-Methods": "GET, OPTIONS",
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

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(request) });
    }
    if (request.method !== "GET") {
      return json(request, { success: false, error: "METHOD_NOT_ALLOWED" }, 405);
    }
    if (!env.DB) {
      return json(request, { success: false, error: "DATABASE_BINDING_MISSING" }, 500);
    }

    try {
      if (url.pathname === "/api/games") {
        const result = await env.DB.prepare(
          "SELECT id, game_name, game_logo, points, posts, votes, users, tag, developer, genres, about, website_url, is_active, stats_synced_at FROM steemgames WHERE is_active = 1 ORDER BY points DESC, game_name COLLATE NOCASE ASC"
        ).all();
        return json(request, { success: true, stats_engine: "steemworld-offset-v2", games: result.results || [] });
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
