import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const SITE_URL = (process.env.SG_SITE_URL || "https://steemgames.do2earn.dev").replace(/\/+$/, "");
const API_URL = (process.env.SG_API_URL || "https://steemgames.do2earn.workers.dev").replace(/\/+$/, "");
const OUTPUT_DIR = path.resolve(process.env.SG_OUTPUT_DIR || "_site");
const TEMPLATE_PATH = path.resolve(process.env.SG_TEMPLATE || "game-info.html");

const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
})[char]);

const slugify = (value) => String(value ?? "")
  .normalize("NFKD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLowerCase()
  .replace(/&/g, " and ")
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-+|-+$/g, "");

const safeHttpUrl = (value) => {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  try {
    const parsed = new URL(raw);
    return ["http:", "https:"].includes(parsed.protocol) ? parsed.href : "";
  } catch {
    return "";
  }
};

const assetUrl = (value) => {
  const raw = String(value ?? "").trim();
  if (!raw) return "assets/images/game-placeholder.svg";
  if (/^(https?:|data:image\/)/i.test(raw) || raw.startsWith("/")) return raw;
  if (raw.includes("/")) return raw;
  return "assets/games-logos/" + raw;
};

const compactDescription = (name, about) => {
  const plain = String(about ?? "").replace(/\s+/g, " ").trim();
  const base = plain && plain !== "No description is available yet."
    ? "Explore " + name + " on Steem Games. " + plain
    : "Explore " + name + ", a game on the Steem blockchain. Discover its developer, genres, official website and community activity on Steem Games.";
  return base.length > 158 ? base.slice(0, 155).replace(/\s+\S*$/, "") + "..." : base;
};

const setMeta = (html, attribute, name, content) => {
  const escaped = escapeHtml(content);
  const pattern = attribute === "name"
    ? new RegExp('<meta\\s+name="' + name + '"\\s+content="[^"]*">', "i")
    : new RegExp('<meta\\s+property="' + name + '"\\s+content="[^"]*">', "i");
  const tag = '<meta ' + attribute + '="' + name + '" content="' + escaped + '">';
  if (pattern.test(html)) return html.replace(pattern, tag);
  return html.replace("</head>", "  " + tag + "\n</head>");
};

const makeStaticCard = (game, gameUrl) => {
  const name = String(game.game_name || "Steem Game");
  const about = String(game.about || "No description is available yet.");
  const developer = String(game.developer || "").replace(/^@/, "").trim();
  const tag = String(game.tag || "steem-games").replace(/^#/, "").trim();
  const genres = (Array.isArray(game.genres) ? game.genres : String(game.genres || "").split(/[|,;]/))
    .map((item) => String(item).trim()).filter(Boolean);
  const website = safeHttpUrl(game.website_url);
  const logo = assetUrl(game.game_logo);
  const profile = developer ? "https://steempro.com/@" + encodeURIComponent(developer) : "";
  const publishUrl = "https://steemit.com/submit.html?tags=" + encodeURIComponent(tag);
  return '<section id="gameInfoCard" class="sg-content-card sg-game-info-card" aria-live="polite">' +
    '<img class="sg-game-info-logo" src="' + escapeHtml(logo) + '" alt="' + escapeHtml(name) + ' logo" width="412" height="412" loading="eager" fetchpriority="high" onerror="this.onerror=null;this.src=\\'assets/images/game-placeholder.svg\\'">' +
    '<h1 class="sg-game-info-title">' + escapeHtml(name) + '</h1>' +
    '<hr class="sg-game-info-divider">' +
    '<div class="sg-game-info-actions">' +
    (website ? '<a class="sg-game-play" href="' + escapeHtml(website) + '" target="_blank" rel="noopener noreferrer">▶️ Play</a>' : '') +
    '<a class="sg-game-publish" href="' + escapeHtml(publishUrl) + '" target="_blank" rel="noopener noreferrer">📝 Publish</a>' +
    '<a class="sg-game-share" href="' + escapeHtml(gameUrl) + '">🔗 Game Link</a>' +
    '</div><hr class="sg-game-info-divider"><div class="sg-game-info-stats">' +
    '<div><strong>⭐ Points:</strong> ' + Math.round(Number(game.points) || 0).toLocaleString("en-US") + '</div>' +
    '<div><strong>📄 Posts Numbers:</strong> ' + Math.round(Number(game.posts) || 0).toLocaleString("en-US") + '</div>' +
    '<div><strong>#️⃣ Dedicated Tag:</strong> <a class="sg-game-tag-link" href="https://steemx.org/created/' + encodeURIComponent(tag) + '" target="_blank" rel="noopener noreferrer">#' + escapeHtml(tag) + '</a></div>' +
    '<div class="sg-game-developer"><strong>👩‍💻 Developer:</strong> ' + (developer ? '<a href="' + escapeHtml(profile) + '" target="_blank" rel="noopener noreferrer">@' + escapeHtml(developer) + '</a>' : '<span>Not specified</span>') + '</div>' +
    (genres.length ? '<div class="sg-game-genres"><strong>🗂️ Genres:</strong>' + genres.map((genre) => '<span class="sg-game-genre">' + escapeHtml(genre) + '</span>').join("") + '</div>' : '') +
    '</div><hr class="sg-game-info-divider"><h2 style="text-align:left;margin:0 0 10px">About</h2>' +
    '<div class="sg-game-about">' + escapeHtml(about) + '</div></section>';
};

const response = await fetch(API_URL + "/api/games", {
  headers: { Accept: "application/json" },
  signal: AbortSignal.timeout(30000)
});
if (!response.ok) throw new Error("Steem Games API returned HTTP " + response.status);
const payload = await response.json();
if (payload.success !== true || !Array.isArray(payload.games)) {
  throw new Error("Steem Games API returned an unexpected response.");
}

const games = payload.games.filter((game) => game && Number(game.is_active ?? 1) !== 0);
if (!games.length) throw new Error("The API returned no active games; refusing to publish an empty game directory.");

const template = await readFile(TEMPLATE_PATH, "utf8");
if (!template.includes('id="gameInfoCard"')) throw new Error("The game-info.html template does not contain #gameInfoCard.");

const gamesDir = path.join(OUTPUT_DIR, "games");
await rm(gamesDir, { recursive: true, force: true });
const seenSlugs = new Map();
const gameUrls = [];

for (const game of games) {
  const name = String(game.game_name || "").trim();
  const slug = slugify(name);
  if (!name || !slug) throw new Error("An active game has an empty or invalid name.");
  if (seenSlugs.has(slug)) {
    throw new Error('Slug collision: "' + name + '" and "' + seenSlugs.get(slug) + '" both map to /games/' + slug + '/.');
  }
  seenSlugs.set(slug, name);

  const gameUrl = SITE_URL + "/games/" + slug + "/";
  const description = compactDescription(name, game.about);
  const title = name + " | Steem Games";
  const genres = (Array.isArray(game.genres) ? game.genres : String(game.genres || "").split(/[|,;]/))
    .map((item) => String(item).trim()).filter(Boolean);
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: title,
    url: gameUrl,
    description,
    mainEntity: {
      "@type": "VideoGame",
      name,
      description: String(game.about || "No description is available yet."),
      genre: genres,
      ...(String(game.developer || "").trim() ? { author: { "@type": "Person", name: String(game.developer).replace(/^@/, "").trim() } } : {}),
      ...(safeHttpUrl(game.website_url) ? { sameAs: safeHttpUrl(game.website_url) } : {})
    },
    isPartOf: { "@type": "WebSite", name: "Steem Games", url: SITE_URL + "/" }
  };

  let html = template;
  html = html.replace(/<title>[\s\S]*?<\/title>/i, "<title>" + escapeHtml(title) + "</title>");
  html = setMeta(html, "name", "description", description);
  html = setMeta(html, "property", "og:title", title);
  html = setMeta(html, "property", "og:description", description);
  html = setMeta(html, "property", "og:url", gameUrl);
  html = setMeta(html, "name", "twitter:title", title);
  html = setMeta(html, "name", "twitter:description", description);
  html = html.replace(/<link\s+rel="canonical"\s+href="[^"]*">/i, '<link rel="canonical" href="' + escapeHtml(gameUrl) + '">');
  html = html.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/i,
    '<script type="application/ld+json">' + JSON.stringify(structuredData).replace(/</g, "\\u003c") + "</script>");
  html = html.replace(/<script>window\.STEEM_GAMES_API_URL\s*=\s*"[^"]*";<\/script>/i,
    "<script>window.STEEM_GAMES_API_URL = " + JSON.stringify(API_URL) + "; window.SG_GAME_NAME = " + JSON.stringify(name) + "; window.SG_GAME_URL = " + JSON.stringify(gameUrl) + ";</script>");
  html = html.replace(/<section id="gameInfoCard"[\s\S]*?<\/section>/i, makeStaticCard(game, gameUrl));

  const pageDir = path.join(gamesDir, slug);
  await mkdir(pageDir, { recursive: true });
  await writeFile(path.join(pageDir, "index.html"), html, "utf8");
  gameUrls.push(gameUrl);
}

const staticUrls = [SITE_URL + "/", SITE_URL + "/about.html", SITE_URL + "/faq.html"];
const sitemap = '<?xml version="1.0" encoding="UTF-8"?>\n' +
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
  [...staticUrls, ...gameUrls].map((url) => "  <url><loc>" + escapeHtml(url) + "</loc></url>").join("\n") +
  "\n</urlset>\n";
await writeFile(path.join(OUTPUT_DIR, "sitemap.xml"), sitemap, "utf8");
console.log("Generated " + gameUrls.length + " SEO-ready game pages and sitemap.xml.");
