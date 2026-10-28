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
    if (!["GET"].includes(request.method)) {
      return json(request, { success: false, error: "METHOD_NOT_ALLOWED" }, 405);
    }
    if (!env.DB) {
      return json(request, { success: false, error: "DATABASE_BINDING_MISSING" }, 500);
    }

    try {
      if (url.pathname === "/api/games") {
        const result = await env.DB.prepare(
          "SELECT id, game_name, game_logo, points, posts, votes, users, tag, developer, genres, about, website_url, is_active FROM steemgames WHERE is_active = 1 ORDER BY points DESC, game_name COLLATE NOCASE ASC"
        ).all();
        return json(request, { success: true, games: result.results || [] });
      }

      if (url.pathname === "/api/stats") {
        const result = await env.DB.prepare(
          "SELECT COUNT(*) AS games, COALESCE(SUM(users), 0) AS players, COALESCE(SUM(posts), 0) AS posts, COALESCE(SUM(votes), 0) AS votes FROM steemgames WHERE is_active = 1"
        ).first();
        return json(request, { success: true, stats: result || { games: 0, players: 0, posts: 0, votes: 0 } });
      }

      return json(request, { success: false, error: "NOT_FOUND" }, 404);
    } catch (error) {
      return json(request, { success: false, error: "DATABASE_QUERY_FAILED" }, 500);
    }
  }
};
