import fs from "node:fs/promises";
import path from "node:path";

const API_URL = process.env.STEEM_GAMES_API_URL || "https://steemgames.do2earn.workers.dev";
const SITE_URL = "https://steemgames.do2earn.dev";
const OUTPUT_DIR = path.resolve("games");

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);
}

function slugify(value = "") {
  const slug = String(value).normalize("NFKD").toLowerCase()
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "steem-game";
}

function gameSlug(game) {
  return slugify(game.game_name) + "-" + Number(game.id);
}

function imageUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return SITE_URL + "/assets/images/steemgames_logo.png";
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith("/")) return SITE_URL + raw;
  if (raw.includes("/")) return SITE_URL + "/" + raw;
  return SITE_URL + "/assets/games-logos/" + encodeURIComponent(raw);
}

function formatNumber(value) {
  return Math.round(Number(value) || 0).toLocaleString("en-US");
}

function renderGame(game) {
  const name = String(game.game_name || "Steem Game").trim();
  const slug = gameSlug(game);
  const url = SITE_URL + "/games/" + slug + "/";
  const about = String(game.about || ("Explore " + name + ", a game in the Steem blockchain gaming directory.")).trim();
  const description = about.replace(/\s+/g, " ").slice(0, 300);
  const developer = String(game.developer || "").replace(/^@/, "").trim();
  const tag = String(game.tag || "steem-games").replace(/^#/, "").trim();
  const genres = (Array.isArray(game.genres) ? game.genres : String(game.genres || "").split(/[|,;]/))
    .map((item) => String(item || "").trim()).filter(Boolean);
  const logo = imageUrl(game.game_logo);
  const website = /^https?:\/\//i.test(String(game.website_url || "")) ? String(game.website_url) : "";
  const tagUrl = "https://steemx.org/created/" + encodeURIComponent(tag);
  const developerUrl = developer ? "https://steempro.com/@" + encodeURIComponent(developer) : "";
  const schema = {
    "@context": "https://schema.org",
    "@type": "VideoGame",
    name,
    description,
    url,
    image: logo,
    gamePlatform: "Steem blockchain"
  };
  if (genres.length) schema.genre = genres;
  if (website) schema.sameAs = [website];

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#ffffff">
  <meta name="robots" content="index,follow">
  <title>${escapeHtml(name)} | Steem Games</title>
  <meta name="description" content="${escapeHtml(description)}">
  <link rel="canonical" href="${escapeHtml(url)}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="Steem Games">
  <meta property="og:title" content="${escapeHtml(name)} | Steem Games">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:url" content="${escapeHtml(url)}">
  <meta property="og:image" content="${escapeHtml(logo)}">
  <meta name="twitter:card" content="summary">
  <meta name="twitter:title" content="${escapeHtml(name)} | Steem Games">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  <meta name="twitter:image" content="${escapeHtml(logo)}">
  <link rel="stylesheet" href="/assets/css/style.css">
  <script type="application/ld+json">${JSON.stringify(schema).replace(/</g, "\\u003c")}</script>
  <style>
    .sg-seo-page{width:min(920px,calc(100% - 28px));margin:28px auto 48px}
    .sg-seo-card{background:#fff;border:1px solid #e5e9f0;border-radius:18px;padding:clamp(18px,4vw,34px);box-shadow:0 10px 30px rgba(18,32,60,.07)}
    .sg-seo-logo{display:block;width:auto;height:auto;max-width:min(100%,360px);max-height:260px;object-fit:contain;margin:0 auto 18px}
    .sg-seo-card h1{text-align:center;margin:0 0 16px;overflow-wrap:anywhere}
    .sg-seo-actions{display:flex;justify-content:center;flex-wrap:wrap;gap:10px;margin:18px 0}
    .sg-seo-actions a{display:inline-flex;align-items:center;justify-content:center;padding:10px 16px;border-radius:9px;text-decoration:none;font-weight:800;background:#2563eb;color:#fff}
    .sg-seo-actions a.play{background:#15803d}
    .sg-seo-details{display:grid;gap:10px;margin:18px 0}
    .sg-seo-details a{color:#2563eb;font-weight:700}
    .sg-seo-genres{display:flex;flex-wrap:wrap;gap:7px}
    .sg-seo-genre{background:#e0f2fe;color:#075985;border-radius:7px;padding:3px 9px;font-weight:600}
    .sg-seo-about{white-space:pre-line;overflow-wrap:anywhere;line-height:1.75}
    @media(max-width:560px){.sg-seo-page{margin:14px auto 28px}.sg-seo-card{padding:16px 12px}.sg-seo-actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr))}.sg-seo-actions a{padding:10px 7px}}
  </style>
</head>
<body>
  <header class="topbar">
    <a class="brand" href="/"><img src="/assets/images/steemgames_logo.png" alt="Steem Games"><span>STEEM <b>GAMES</b></span></a>
    <a href="/" aria-label="Back to Steem Games home">Home</a>
  </header>
  <main class="sg-seo-page">
    <article class="sg-seo-card">
      <img class="sg-seo-logo" src="${escapeHtml(logo)}" alt="${escapeHtml(name)} logo" loading="eager">
      <h1>${escapeHtml(name)}</h1>
      <div class="sg-seo-actions">
        ${website ? `<a class="play" href="${escapeHtml(website)}" target="_blank" rel="noopener noreferr">ꕢ Play</a>` : ""}
        <a href="${escapeHtml(tagUrl)}" target="_blank" rel="noopener noreferrer">#${escapeHtml(tag)} posts</a>
        <a href="/game-info.html?game=${encodeURIComponent(name)}">Full game tools</a>
      </div>
      <hr>
      <section class="sg-seo-details" aria-label="Game details">
        <div><strong>Developer:</strong> ${developer && developerUrl ? `<a href="${escapeHtml(developerUrl)}" target="_blank" rel="noopener noreferrer">@${escapeHtml(developer)}</a>` : "Not specified"}</div>
        <div><strong>Points:</strong> ${formatNumber(game.points)}</div>
        <div><strong>Posts:</strong> ${formatNumber(game.posts)}</div>
        <div><strong>Community members:</strong> ${formatNumber(game.users)}</div>
        ${genres.length ? `<div><strong>Genres:/strong> <span class="sg-seo-genres">${genres.map((genre) => `<span class="sg-seo-genre">${escapeHtml(genre)}</span>`).join("")}</span></div>` : ""}
      </section>
      <hr>
      <h2>About ${escapeHtml(name)}</h2>
      <div class="sg-seo-about">${escapeHtml(about)}</div>
      <p style="margin-top:26px"><a href="/">← Explore all Steem Games</a></p>
    </article>
  </main>
</body>
</html>
`;
}

async function main() {
  const response = await fetch(API_URL + "/api/games", { headers: { accept: "application/json" } });
  if (!response.ok) throw new Error("Games API returned HTTP " + response.status);
  const payload = await response.json();
  if (!payload?.success || !Array.isArray(payload.games)) throw new Error("Games API returned an invalid payload");

  const games = payload.games.filter((game) => Number(game.is_active) !== 0 && game.game_name && Number.isFinite(Number(game.id)));
  await fs.rm(OUTPUT_DIR, { recursive: true, force: true });
  const sitemapEntries = [
    ["", "daily", "1.0"],
    ["about.html", "monthly", "0.5"],
    ["faq.html", "monthly", "0.6"]
  ];
  for (const game of games) {
    const slug = gameSlug(game);
    const directory = path.join(OUTPUT_DIR, slug);
    await fs.mkdir(directory, { recursive: true });
    await fs.writeFile(path.join(directory, "index.html"), renderGame(game), "utf8");
    sitemapEntries.push(["games/" + slug + "/", "weekly", "0.8"]);
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapEntries.map(([loc, frequency, priority]) => `  <url><loc>${SITE_URL}/${loc}</loc><changefreq>${frequency}</changefreq><priority>${priority}</priority></url>`).join("\n")}
</urlset>
`;
  await fs.writeFile("sitemap.xml", xml, "utf8");
  console.log("Generated " + games.length + " static game pages and sitemap entries.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});