#!/usr/bin/env python3
"""Build SEO-ready GitHub Pages routes from the live Steem Games API.

Generated /games/<slug>/ pages exist only in the Pages build artifact.
No per-game HTML files are committed to the source repository.
"""
from __future__ import annotations

import html
import json
import os
import re
import shutil
import sys
import unicodedata
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = Path(os.environ.get("PAGES_OUTPUT", ROOT / "dist")).resolve()
SITE = "https://steemgames.do2earn.dev"
API = os.environ.get("STEEM_GAMES_API_URL", "https://steemgames.do2earn.workers.dev").rstrip("/")
TEMPLATE = ROOT / "game-info.html"


def slugify(value: str) -> str:
    value = unicodedata.normalize("NFKD", str(value or ""))
    value = "".join(ch for ch in value if not unicodedata.combining(ch))
    value = value.lower().replace("&", " and ")
    value = re.sub(r"[^a-z0-9]+", "-", value)
    return value.strip("-")


def fetch_games() -> list[dict]:
    request = urllib.request.Request(
        API + "/api/games",
        headers={"Accept": "application/json", "User-Agent": "SteemGames-PagesBuilder/1.0"},
    )
    with urllib.request.urlopen(request, timeout=45) as response:
        if response.status != 200:
            raise RuntimeError(f"Games API returned HTTP {response.status}")
        payload = json.loads(response.read().decode("utf-8"))

    games = payload.get("games") if isinstance(payload, dict) else None
    if not isinstance(games, list) or not games:
        raise RuntimeError("Games API returned no usable 'games' array; refusing to publish an empty directory.")

    valid = []
    used = {}
    for game in games:
        if not isinstance(game, dict) or not str(game.get("game_name") or "").strip():
            continue
        name = str(game["game_name"]).strip()
        slug = slugify(name)
        if not slug:
            raise RuntimeError(f"Game name cannot produce a URL slug: {name!r}")
        if slug in used and used[slug] != name:
            raise RuntimeError(f"Slug collision: {used[slug]!r} and {name!r} both map to /games/{slug}/")
        used[slug] = name
        valid.append({**game, "_slug": slug})

    if not valid:
        raise RuntimeError("Games API returned no games with valid names.")
    return valid


def replace_meta(document: str, attr_name: str, attr_value: str, value: str) -> str:
    escaped = html.escape(value, quote=True)
    pattern = re.compile(
        r'(<meta\b(?=[^>]*\b' + re.escape(attr_name) + r'=["\']' +
        re.escape(attr_value) + r'["\'])[^>]*>)',
        re.IGNORECASE,
    )
    match = pattern.search(document)
    if not match:
        return document
    tag = match.group(1)
    if re.search(r'\bcontent=["\'][^"\']*["\']', tag, re.IGNORECASE):
        tag = re.sub(
            r'\bcontent=(["\']).*?\1',
            lambda m: 'content="' + escaped + '"',
            tag,
            count=1,
            flags=re.IGNORECASE,
        )
    else:
        tag = tag[:-1] + ' content="' + escaped + '">'
    return document[:match.start()] + tag + document[match.end():]


def set_canonical(document: str, url: str) -> str:
    escaped = html.escape(url, quote=True)
    pattern = re.compile(r'<link\b(?=[^>]*\brel=["\']canonical["\'])[^>]*>', re.IGNORECASE)
    tag = '<link rel="canonical" href="' + escaped + '">'
    if pattern.search(document):
        return pattern.sub(tag, document, count=1)
    return document.replace("</head>", "  " + tag + "\n</head>", 1)


def image_url(game: dict) -> str:
    raw = str(game.get("game_logo") or "").strip()
    if not raw:
        return SITE + "/assets/images/steemgames_logo.png"
    if raw.startswith(("https://", "http://")):
        return raw
    if raw.startswith("/"):
        return SITE + raw
    if "/" in raw:
        return SITE + "/" + urllib.parse.quote(raw, safe="/")
    return SITE + "/assets/games-logos/" + urllib.parse.quote(raw, safe="")


def build_page(template: str, game: dict) -> tuple[str, str]:
    name = str(game["game_name"]).strip()
    slug = game["_slug"]
    url = f"{SITE}/games/{slug}/"
    title = f"{name} | Steem Games"
    about = re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", str(game.get("about") or ""))).strip()
    description = (
        f"Explore {name}, a game on the Steem blockchain. "
        "Discover its gameplay, developer, genres and community activity on Steem Games."
    )
    if about:
        description = f"Explore {name}, a game on the Steem blockchain. {about}"
    description = re.sub(r"\s+", " ", description).strip()
    if len(description) > 160:
        description = description[:157].rsplit(" ", 1)[0].rstrip(" .,;:-") + "..."

    page = re.sub(
        r"<title>.*?</title>",
        "<title>" + html.escape(title) + "</title>",
        template, count=1, flags=re.IGNORECASE | re.DOTALL,
    )
    # Put game-specific content in the initial HTML so crawlers and social
    # preview bots do not depend on client-side JavaScript to discover the page.
    page = re.sub(
        r'<h1 class="sg-game-info-title">.*?</h1>',
        '<h1 class="sg-game-info-title">' + html.escape(name) + '</h1>',
        page, count=1, flags=re.IGNORECASE | re.DOTALL,
    )
    initial_intro = about or (
        f"Explore {name}, a game on the Steem blockchain. "
        "Discover its developer, genres, website and community activity on Steem Games."
    )
    page = re.sub(
        r'<p class="sg-game-about">.*?</p>',
        '<p class="sg-game-about">' + html.escape(initial_intro) + '</p>',
        page, count=1, flags=re.IGNORECASE | re.DOTALL,
    )
    page = replace_meta(page, "name", "description", description)
    page = set_canonical(page, url)
    for attr_name, attr_value, value in [
        ("property", "og:title", title),
        ("property", "og:description", description),
        ("property", "og:url", url),
        ("property", "og:image", image_url(game)),
        ("name", "twitter:title", title),
        ("name", "twitter:description", description),
        ("name", "twitter:image", image_url(game)),
    ]:
        page = replace_meta(page, attr_name, attr_value, value)

    schema = {
        "@context": "https://schema.org",
        "@type": "WebPage",
        "name": title,
        "url": url,
        "description": description,
        "isPartOf": {"@type": "WebSite", "name": "Steem Games", "url": SITE + "/"},
        "mainEntity": {
            "@type": "VideoGame",
            "name": name,
            "url": url,
            "description": description,
            **({"genre": game.get("genres")} if game.get("genres") else {}),
        },
    }
    schema_text = json.dumps(schema, ensure_ascii=False).replace("<", "\\u003c")
    page = re.sub(
        r'<script\s+type=["\']application/ld\+json["\']>.*?</script>',
        '<script type="application/ld+json">' + schema_text + "</script>",
        page, count=1, flags=re.IGNORECASE | re.DOTALL,
    )

    config = (
        "<script>window.SG_GAME_NAME = "
        + json.dumps(name, ensure_ascii=False).replace("<", "\\u003c")
        + "; window.SG_GAME_URL = "
        + json.dumps(url)
        + ";</script>\n  "
    )
    marker = '<script type="module" src="assets/js/app.js'
    if marker not in page:
        raise RuntimeError("game-info.html no longer contains the expected app.js module marker.")
    page = page.replace(marker, config + marker, 1)
    return page, url



def inject_homepage_game_links(games: list[dict]) -> None:
    """Add crawlable game-detail links to the homepage's second directory card."""
    index_path = OUTPUT / "index.html"
    if not index_path.is_file():
        raise RuntimeError("Homepage index.html is missing from the Pages build output.")

    active_games = [
        game for game in games
        if str(game.get("is_active", 1)).strip().lower() not in {"0", "false", "no"}
    ]
    items = []
    for game in sorted(active_games, key=lambda item: str(item["game_name"]).casefold()):
        name = str(game["game_name"]).strip()
        slug = game["_slug"]
        items.append(
            '<li><a href="/games/' + html.escape(slug, quote=True) + '/">'
            + html.escape(name) + '</a></li>'
        )

    navigation = (
        '<nav class="sg-seo-game-links" aria-label="Steem Games information pages">'
        '<h2>Explore Steem Games</h2>'
        '<ul>' + "".join(items) + '</ul>'
        '</nav>\n      '
    )
    style = """
  <style id="sg-seo-game-links-style">
    .sg-seo-game-links{margin:0 0 18px;padding:16px 18px;border:1px solid #e5e9f0;border-radius:16px;background:#fff}
    .sg-seo-game-links h2{margin:0 0 12px;font-size:1.1rem;line-height:1.35;color:#172033}
    .sg-seo-game-links ul{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,220px),1fr));gap:8px 18px;margin:0;padding:0;list-style:none}
    .sg-seo-game-links a{color:#2563eb;text-decoration:underline;text-underline-offset:3px;overflow-wrap:anywhere}
    .sg-seo-game-links a:hover{text-decoration-thickness:2px}
  </style>
"""
    document = index_path.read_text(encoding="utf-8")
    if 'id="sg-seo-game-links"' in document:
        raise RuntimeError("Homepage SEO game links already exist in the source build output.")
    marker = '<div id="steemgamesComponent"'
    if marker not in document:
        raise RuntimeError("Could not find the homepage game directory insertion point.")
    if "</head>" not in document:
        raise RuntimeError("Homepage head closing tag is missing.")
    document = document.replace("</head>", style + "</head>", 1)
    navigation = navigation.replace(
        '<nav class="sg-seo-game-links"',
        '<nav id="sg-seo-game-links" class="sg-seo-game-links"',
        1,
    )
    document = document.replace(marker, navigation + marker, 1)
    index_path.write_text(document, encoding="utf-8")
    print(f"Added {len(active_games)} crawlable game-detail links to the homepage directory card.")


def update_sitemap(games: list[dict]) -> None:
    sitemap_path = OUTPUT / "sitemap.xml"
    namespace = "http://www.sitemaps.org/schemas/sitemap/0.9"
    ET.register_namespace("", namespace)
    root = ET.Element(f"{{{namespace}}}urlset")
    existing = []
    if sitemap_path.exists():
        try:
            old_root = ET.parse(sitemap_path).getroot()
            for node in old_root.findall(f"{{{namespace}}}url"):
                loc = node.findtext(f"{{{namespace}}}loc", default="")
                if loc and "/games/" not in loc:
                    existing.append(loc)
        except ET.ParseError as exc:
            raise RuntimeError(f"Existing sitemap.xml is invalid: {exc}") from exc

    urls = list(dict.fromkeys(existing + [f"{SITE}/games/{g['_slug']}/" for g in games]))
    for url in urls:
        node = ET.SubElement(root, f"{{{namespace}}}url")
        ET.SubElement(node, f"{{{namespace}}}loc").text = url
    sitemap_path.write_bytes(
        b'<?xml version="1.0" encoding="UTF-8"?>\n'
        + ET.tostring(root, encoding="utf-8")
        + b"\n"
    )


def main() -> int:
    if not TEMPLATE.is_file():
        raise RuntimeError("Required template game-info.html is missing.")

    games = fetch_games()
    if OUTPUT.exists():
        shutil.rmtree(OUTPUT)
    shutil.copytree(
        ROOT,
        OUTPUT,
        ignore=shutil.ignore_patterns(
            ".git", ".github", ".vscode", "__pycache__", "node_modules",
            "scripts", "dist", "games",
        ),
    )

    (OUTPUT / ".nojekyll").write_text("", encoding="utf-8")
    template = TEMPLATE.read_text(encoding="utf-8")
    for game in games:
        page, _ = build_page(template, game)
        target = OUTPUT / "games" / game["_slug"] / "index.html"
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(page, encoding="utf-8")

    inject_homepage_game_links(games)
    update_sitemap(games)
    print(f"Generated {len(games)} SEO-ready game pages in the Pages build artifact.")
    print("Generated games/ files are build output only and are not committed to the source repository.")
    print("Updated sitemap.xml from the live games API.")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        raise SystemExit(1)
