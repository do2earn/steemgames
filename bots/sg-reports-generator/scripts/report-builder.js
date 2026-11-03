(() => {
  "use strict";
  const API_BASE = "https://steemgames.do2earn.workers.dev";
  const SITE_BASE = "https://steemgames.do2earn.dev";
  const $ = id => document.getElementById(id);
  const createBtn = $("createReportBtn");
  const editor = $("reportHtmlEditor");
  const progressWrap = $("reportProgressWrap");
  const progressBar = $("reportProgress");
  const progressPercent = $("reportProgressPercent");
  const progressLabel = $("reportProgressLabel");
  const reportStatus = $("createReportStatus");
  const titleBox = $("reportTitleBox");
  const tagsBox = $("reportTagsBox");
  const copyBtn = $("copyEditorBtn");
  const previewBtn = $("previewHtmlBtn");

  const esc = value => String(value ?? "").replace(/[&<>"']/g, ch => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[ch]));
  const cleanTag = value => String(value || "").trim().replace(/^#+/, "").toLowerCase();
  const accountName = value => {
    let name = String(value || "").trim().replace(/^@+/, "");
    return /^[a-z][a-z0-9.-]{1,14}[a-z0-9]$/i.test(name) ? name.toLowerCase() : "";
  };
  const fmt = value => Math.round(Number(value) || 0).toLocaleString("en-US");
  const todayUTC = () => new Date().toISOString().slice(0, 10);
  const randomItem = list => list[Math.floor(Math.random() * list.length)];

  function setProgress(percent, label, type = "") {
    const safe = Math.max(0, Math.min(100, Math.round(percent)));
    progressWrap.hidden = false;
    progressBar.value = safe;
    progressPercent.textContent = safe + "%";
    progressLabel.textContent = label;
    reportStatus.textContent = label;
    reportStatus.className = "status " + type;
  }

  function gamePageUrl(game) {
    return SITE_BASE + "/game-info.html?game=" + encodeURIComponent(game.game_name || "");
  }

  function logoUrl(game) {
    const file = String(game.game_logo || "").trim();
    if (!file) return SITE_BASE + "/assets/images/game-placeholder.svg";
    if (/^https?:\/\//i.test(file)) return file;
    if (file.includes("/")) return SITE_BASE + "/" + file.replace(/^\/+/, "");
    return SITE_BASE + "/assets/games-logos/" + file;
  }

  function buildStatusAnalysis(games, totals) {
    const ranked = games.slice().sort((a,b) => Number(b.points || 0) - Number(a.points || 0));
    const top = ranked[0];
    const second = ranked[1];
    const topShare = totals.points > 0 && top ? Math.round(Number(top.points || 0) / totals.points * 100) : 0;
    const active = games.length;
    const postsPerGame = active ? Math.round(totals.posts / active) : 0;
    const voteLeaders = games.slice().sort((a,b) => Number(b.votes || 0) - Number(a.votes || 0));
    const voteLeader = voteLeaders[0];
    const openings = [
      "The current SG table shows a diverse Steem gaming scene, with projects competing through community activity, published content, and votes. The leading position belongs to " + (top?.game_name || "the current top-ranked game") + ", which accounts for about " + topShare + "% of the points recorded across active listings.",
      "My reading of today's SG rankings is that visibility and community participation remain closely connected. " + (top?.game_name || "The leading game") + " currently heads the table, while the rest of the directory gives players several different experiences to explore.",
      "Today's figures offer a useful snapshot of the Steem gaming ecosystem: " + active + " active games are listed, and the points table provides a simple way to discover projects receiving community attention. " + (top?.game_name || "The top-ranked title") + " leads at the moment."
    ];
    const middle = [
      "A ranking is only one part of the story. Every game can build its position by welcoming new players, encouraging regular gameplay, and helping users share genuine experiences. I invite developers and community members to keep their game information current and bring more players into the SG directory.",
      "Points should be treated as a discovery signal, not a final judgement of game quality. A lower-ranked title can still offer excellent gameplay or a strong niche community. Try different games, publish useful gameplay posts, and use the Vote button on SG to show which projects deserve more visibility.",
      "The best way to strengthen this ecosystem is through real participation: play the games, explain what makes them enjoyable, publish screenshots or guides, and support projects with an SG vote. Consistent community activity can help promising games become easier to discover."
    ];
    const secondLine = second
      ? " " + second.game_name + " follows in second place, which shows that the leaderboard is not defined by a single project alone."
      : "";
    return randomItem(openings) + secondLine + " " + randomItem(middle);
  }

  function buildStatParagraphs(games, totals) {
    const ranked = games.slice().sort((a,b) => Number(b.points || 0) - Number(a.points || 0));
    const top3 = ranked.slice(0,3);
    const leaders = top3.map((g,i) => (i+1) + ". " + g.game_name + " (" + fmt(g.points) + " points)").join("; ");
    const top = ranked[0];
    const second = ranked[1];
    const topShare = totals.points ? Math.round(Number(top?.points || 0) / totals.points * 100) : 0;
    const postShare = totals.posts ? Math.round(Number(top?.posts || 0) / totals.posts * 100) : 0;
    const voteLeader = games.slice().sort((a,b) => Number(b.votes || 0) - Number(a.votes || 0))[0];
    const postLeaders = games.slice().sort((a,b) => Number(b.posts || 0) - Number(a.posts || 0)).slice(0,3);
    const paragraphOne = randomItem([
      "The current leaderboard is headed by " + (top?.game_name || "the top-ranked game") + " with " + fmt(top?.points) + " points, followed by " + (second?.game_name || "the next title") + " with " + fmt(second?.points) + ". The top-ranked game represents approximately " + topShare + "% of the combined points in this active-game snapshot. The three leading positions are: " + leaders + ".",
      "Across " + games.length + " active listings, the SG table records " + fmt(totals.points) + " combined points. " + (top?.game_name || "The leading title") + " currently contributes " + topShare + "% of that total, while " + (second?.game_name || "the runner-up") + " is next in the ranking. Top three today: " + leaders + ".",
      "Points are distributed across a range of projects rather than being identical from game to game. " + (top?.game_name || "The leader") + " has " + fmt(top?.points) + " points (" + topShare + "% of the total), and the leading three games are " + leaders + "."
    ]);
    const paragraphTwo = randomItem([
      "The database currently lists " + fmt(totals.posts) + " posts and " + fmt(totals.votes) + " votes across these games, an average of about " + fmt(totals.posts / Math.max(1,games.length)) + " posts per active listing. " + (postLeaders.length ? postLeaders.map(g=>g.game_name+" ("+fmt(g.posts)+" posts)").join(", ") : "Post activity is not yet available") + " lead the post counts. " + (voteLeader ? voteLeader.game_name + " currently has the highest recorded vote count at " + fmt(voteLeader.votes) + "." : "") + " These totals are a snapshot of SG's database, not a measure of unique verified players.",
      "Content activity is another useful way to compare projects: " + (postLeaders.length ? postLeaders.map(g=>g.game_name+" with "+fmt(g.posts)+" posts").join(", ") : "post totals are not available") + ". Together, the listed games have " + fmt(totals.posts) + " posts and " + fmt(totals.votes) + " community votes recorded in SG. Use these numbers as a guide for discovery, then visit the games and decide which experiences you want to support.",
      "The table also highlights the role of community support. " + fmt(totals.votes) + " votes and " + fmt(totals.posts) + " posts are recorded across the active games, while " + (voteLeader ? voteLeader.game_name + " leads the vote count with " + fmt(voteLeader.votes) + " votes." : "vote totals are not available") + " The strongest next step is to turn discovery into participation: vote for a favourite, play it, and share an original gameplay post or tutorial."
    ]);
    return [paragraphOne, paragraphTwo];
  }

  function buildReport(games, date) {
    const ranked = games.slice().sort((a,b) => Number(b.points || 0) - Number(a.points || 0) || String(a.game_name).localeCompare(String(b.game_name)));
    const totals = games.reduce((acc,g) => {
      acc.points += Number(g.points) || 0;
      acc.posts += Number(g.posts) || 0;
      acc.votes += Number(g.votes) || 0;
      acc.users += Number(g.users) || 0;
      return acc;
    }, {points:0,posts:0,votes:0,users:0});

    const tableRows = ranked.map((game,index) => {
      const name = esc(game.game_name || "Unnamed game");
      const logo = esc(logoUrl(game));
      const info = esc(gamePageUrl(game));
      const tag = cleanTag(game.tag);
      const developer = accountName(game.developer);
      const tagUrl = tag ? "https://www.steemx.org/created/" + encodeURIComponent(tag) : "";
      const developerUrl = developer ? "https://www.steemx.org/@" + encodeURIComponent(developer) : "";
      const tagCell = tag ? "<a href='" + tagUrl + "' target='_blank' rel='noopener noreferrer'>#" + esc(tag) + "</a>" : "—";
      const developerCell = developer ? "<a href='" + developerUrl + "' target='_blank' rel='noopener noreferrer'>@" + developer + "</a>" : esc(game.developer || "Not listed");
      const logoCell = "<a href='" + info + "' target='_blank' rel='noopener noreferrer'><img src='" + logo + "' width='144' height='96' alt='" + name + "' style='display:block!important;width:144px!important;height:96px!important;max-width:144px!important;min-width:0!important;object-fit:contain!important;margin:auto;'></a>";
      const voteCell = '<a href="' + SITE_BASE + '/#steemgamesComponent" target="_blank" rel="noopener noreferrer" style="display:inline-flex;align-items:center;justify-content:center;gap:3px;min-height:27px;padding:4px 8px;margin-top:5px;background:#15803d;border:0;border-radius:7px;color:#fff!important;text-decoration:none;font-family:inherit;font-size:14px;font-weight:800;white-space:nowrap;">✅Vote</a>';
      const pointsCell = "<div style='text-align:center;white-space:nowrap;'><strong style='font-size:18px;line-height:1.2;'>" + fmt(game.points) + "</strong><br>" + voteCell + "</div>";
      return "<tr><td align='center' style='padding:4px 6px;text-align:center;vertical-align:middle;white-space:nowrap;'>" + (index+1) + "</td><td align='center' style='padding:4px 6px;text-align:center;vertical-align:middle;'>" + logoCell + "</td><td align='center' style='padding:4px 6px;text-align:center;vertical-align:middle;'>" + pointsCell + "</td><td align='center' style='padding:4px 6px;text-align:center;vertical-align:middle;white-space:nowrap;'>" + fmt(game.posts) + "</td><td align='center' style='padding:4px 6px;text-align:center;vertical-align:middle;white-space:nowrap;font-weight:700;'><strong>" + tagCell + "</strong></td><td align='center' style='padding:4px 6px;text-align:center;vertical-align:middle;white-space:nowrap;font-weight:700;'><strong>" + developerCell + "</strong></td></tr>";
    }).join("\n");
    const gameTable = "<div class='sg-games-table-wrap' style='width:100%;max-width:100%;overflow-x:auto;-webkit-overflow-scrolling:touch;margin:12px 0 18px;'><table class='sg-games-table' cellpadding='4' cellspacing='0' border='1' style='width:auto;max-width:100%;min-width:0;margin:0 auto;border-collapse:collapse;table-layout:auto;font-size:13px;white-space:nowrap;'><thead><tr><th style='padding:5px 6px;text-align:center;'>Rank</th><th style='padding:5px 6px;text-align:center;'>Game</th><th style='padding:5px 6px;text-align:center;'>Points</th><th style='padding:5px 6px;text-align:center;'>Posts</th><th style='padding:5px 6px;text-align:center;'>Dedicated Tag</th><th style='padding:5px 6px;text-align:center;'>Developer</th></tr></thead><tbody>" + tableRows + "</tbody></table></div>";

    const topDevelopers = [];
    const seen = new Set();
    for (const game of ranked) {
      const developer = accountName(game.developer);
      if (!developer || seen.has(developer)) continue;
      seen.add(developer);
      topDevelopers.push(developer);
      if (topDevelopers.length === 10) break;
    }
    const beneficiaryList = topDevelopers.map(name => "<li style='text-align:left;font-size:16px;line-height:1.65;'><strong>@" + esc(name) + "</strong>: 5%</li>").join("");
    const beneficiaryText = topDevelopers.length
      ? (topDevelopers.length === 10 ? "50% of the author rewards from this report is allocated to the ten highest-ranked distinct game developers represented in the SG table. Each listed developer receives a 5% beneficiary share." : "The intended allocation is 50% of the author rewards: 5% for each of the ten highest-ranked game developers. Only " + topDevelopers.length + " distinct valid developer accounts are currently available in the SG database, so please complete the missing Developer fields before publishing to ensure the full 50% is assigned.")
      : "Developer beneficiary accounts could not be identified from the current SG game records. Please review the Developer fields before publishing this report.";
    const topTags = [];
    for (const game of ranked) {
      const tag = cleanTag(game.tag);
      if (tag && !topTags.includes(tag)) topTags.push(tag);
      if (topTags.length === 8) break;
    }
    const tags = Array.from(new Set(["steemgame", ...topTags, "steemflags"]));
    const title = "Steem Games | Daily Report | " + date;
    const sgLink = "<a href='" + SITE_BASE + "' target='_blank' rel='noopener noreferrer'>Steem Games</a>";
    const introFirst = sgLink + " is a directory and information hub for games on the Steem blockchain. On " + sgLink + ", you can access information about all these games. Discover new games on the Steem blockchain and vote for your favourites every day to help improve their points on " + sgLink + ". Play the games you enjoy and earn more $STEEM by creating and publishing gameplay content about them on Steem platforms.";
    const introSecond = "Game developers can invite their communities to vote for their games on " + sgLink + " to help improve their rankings.";
    const analysis = buildStatParagraphs(ranked, totals);
    const html = [
      introFirst,
      "",
      introSecond,
      "",
      '<a href="' + SITE_BASE + '" target="_blank" rel="noopener noreferrer" style="display:inline-flex;align-items:center;justify-content:center;gap:14px;padding:16px 28px;margin:10px 0;background:linear-gradient(180deg,#ffffff 0%,#d1d5db 100%);border:2px solid #343a40;border-radius:14px;color:#fff!important;text-decoration:none;font-family:Arial,Helvetica,sans-serif;font-size:25px;font-weight:900;line-height:1.05;box-shadow:0 5px 0 #343a40;"><img src="' + SITE_BASE + '/assets/images/steemgames_logo.webp" alt="Steem Games Logo" width="68" height="68" style="display:block;width:68px;height:68px;object-fit:contain;flex:0 0 68px;"><span style="display:inline-flex;flex-direction:column;align-items:flex-start;justify-content:center;white-space:nowrap;line-height:1.05;"><span>Explore</span><span><span style="color:#ef4444!important;-webkit-text-fill-color:#ef4444!important">S</span><span style="color:#f59e0b!important;-webkit-text-fill-color:#f59e0b!important">t</span><span style="color:#22c55e!important;-webkit-text-fill-color:#22c55e!important">e</span><span style="color:#06b6d4!important;-webkit-text-fill-color:#06b6d4!important">e</span><span style="color:#3b82f6!important;-webkit-text-fill-color:#3b82f6!important">m</span> <span style="color:#ec4899!important;-webkit-text-fill-color:#ec4899!important">G</span><span style="color:#f97316!important;-webkit-text-fill-color:#f97316!important">a</span><span style="color:#14b8a6!important;-webkit-text-fill-color:#14b8a6!important">m</span><span style="color:#6366f1!important;-webkit-text-fill-color:#6366f1!important">e</span><span style="color:#eab308!important;-webkit-text-fill-color:#eab308!important">s</span></span></span></a>',
      "",
      "# Steem Games Status",
      "",
      "# Steem Games Table",
      "",
      gameTable,
      "",
      analysis[0],
      "",
      analysis[1],
      "",
      "<table width='100%' cellpadding='16' cellspacing='0' border='0' style='width:100%;border:1px solid #e6c85c;border-radius:12px;border-collapse:separate;border-spacing:0;background:#fff9db;margin:10px 0 18px;'><tr><td align='left' style='text-align:left;background:#fff9db;border-radius:12px;padding:16px 18px;color:#3d3420;'><h2 style='margin:0 0 18px;text-align:left;color:#5b4812;font-size:20px;font-weight:700;line-height:1.3;'>Developers Beneficiaries</h2><p style='margin:0 0 10px;text-align:left;'>" + esc(beneficiaryText) + "</p><ul style='margin:0;padding-left:22px;text-align:left;'>" + beneficiaryList + "</ul></td></tr></table>",
      "",
      "<p style='margin:18px 0 8px;text-align:center;font-size:12px;line-height:1.7;'><a href='" + SITE_BASE + "' target='_blank' rel='noopener noreferrer'>Explore Steem Games</a> &nbsp;·&nbsp; <a href='" + SITE_BASE + "/faq.html' target='_blank' rel='noopener noreferrer'>Frequency Questions (FAQ)</a> &nbsp;·&nbsp; <a href='" + SITE_BASE + "/about.html' target='_blank' rel='noopener noreferrer'>About Steem Games</a></p>",
      "",
      "<hr style='display:block;border:0;border-top:1px solid #cbd5e1;height:0;margin:14px 0 10px;'>",
      "",
      "<p style='margin:8px 0 0;text-align:center;color:#667085;font-size:11px;line-height:1.6;'>Published by <a href='https://do2earn.dev' target='_blank' rel='noopener noreferrer'>Do2Earn</a> (@do2earn)<br>© <a href='" + SITE_BASE + "' target='_blank' rel='noopener noreferrer'>Steem Games</a> Daily Report</p>"
    ].join("\n");

    return {title,html,tags:tags.map(tag=>"#"+tag).join(" "),summary:{games:games.length,posts:totals.posts,votes:totals.votes,points:totals.points,beneficiaries:topDevelopers.length}};
  }

  async function fetchGames() {
    const response = await fetch(API_BASE + "/api/games", {cache:"no-store"});
    if (!response.ok) throw new Error("SG database API returned HTTP " + response.status + ".");
    const data = await response.json();
    if (!data?.success || !Array.isArray(data.games)) throw new Error("The SG database returned an invalid game list.");
    const games = data.games.filter(game => Number(game.is_active) !== 0);
    if (!games.length) throw new Error("No active games were found in the SG database.");
    return {games,lastUpdated:data.last_points_updated_at || null};
  }

  function markdownInline(value) {
    const safeTags = [];
    const preserved = String(value).replace(/<a\b[^>]*>[\s\S]*?<\/a>|<img\b[^>]*>/gi, match => {
      const token = "__SAFE_HTML_" + safeTags.length + "__";
      safeTags.push(match);
      return token;
    });
    return preserved
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/!\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)/g, "<img src=\"$2\" alt=\"$1\">")
      .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, "<a href=\"$2\" target=\"_blank\" rel=\"noopener noreferrer\">$1</a>")
      .replace(/__SAFE_HTML_(\d+)__/g, (_, index) => safeTags[Number(index)]);
  }

  function markdownToHtml(markdown) {
    const lines = String(markdown || "").replace(/\r/g, "").split("\n");
    const out = [];
    let paragraph = [];
    let table = [];
    const flushParagraph = () => {
      if (paragraph.length) { out.push("<p>" + markdownInline(paragraph.join(" ")) + "</p>"); paragraph = []; }
    };
    const flushTable = () => {
      if (!table.length) return;
      const parsed = table.map(line => line.trim().replace(/^\||\|$/g, "").split("|").map(cell => cell.trim()));
      const headers = parsed[0] || [];
      const body = parsed.slice(2);
      out.push("<div class='table-wrap'><table><thead><tr>" + headers.map(c => "<th>" + markdownInline(c) + "</th>").join("") + "</tr></thead><tbody>" +
        body.map(row => "<tr>" + headers.map((_,i) => "<td>" + markdownInline(row[i] || "") + "</td>").join("") + "</tr>").join("") +
        "</tbody></table></div>");
      table = [];
    };
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Preserve complete raw HTML blocks. The game table is wrapped in a
      // <div>, so treating only standalone <table> tags as raw HTML breaks it.
      const blockStart = line.match(/^\s*<(div|table)\b/i);
      if (blockStart) {
        flushParagraph(); flushTable();
        const tagName = blockStart[1].toLowerCase();
        const closeTag = new RegExp("</" + tagName + "\\s*>\\s*$", "i");
        const raw = [line];
        while (!closeTag.test(raw.join("\\n")) && i + 1 < lines.length) raw.push(lines[++i]);
        out.push(raw.join("\\n"));
        continue;
      }
      if (/^\s*<p\b/i.test(line)) { flushParagraph(); flushTable(); out.push(line); continue; }
      // Keep standalone horizontal rules as real HTML instead of escaping them.
      if (/^\s*<hr\b[^>]*>\s*$/i.test(line)) {
        flushParagraph(); flushTable();
        out.push(line.trim());
        continue;
      }
      if (/^\s*\|.*\|\s*$/.test(line)) { flushParagraph(); table.push(line); continue; }
      flushTable();
      if (!line.trim()) { flushParagraph(); continue; }
      const heading = line.match(/^(#{1,6})\s+(.+)$/);
      if (heading) { flushParagraph(); const level = heading[1].length; out.push("<h" + level + ">" + markdownInline(heading[2]) + "</h" + level + ">"); continue; }
      if (/^---+$/.test(line.trim())) { flushParagraph(); out.push("<hr>"); continue; }
      if (/^\s*[-*]\s+/.test(line)) { flushParagraph(); out.push("<li>" + markdownInline(line.replace(/^\s*[-*]\s+/, "")) + "</li>"); continue; }
      paragraph.push(line.trim());
    }
    flushParagraph(); flushTable();
    return out.join("\n");
  }

  function showPreview() {
    const content = editor.value.trim();
    if (!content) return;
    const previewTab = window.open("", "_blank");
    if (!previewTab) {
      setProgress(progressBar.value,"The preview tab was blocked. Allow pop-ups for this site, then try again.","warn");
      return;
    }
    const rendered = markdownToHtml(content);
    previewTab.document.open();
    previewTab.document.write("<!doctype html><html lang='en'><head><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'><title>Steem Games Report Preview</title><style>*{box-sizing:border-box}html,body{margin:0;min-height:100%;font-family:Arial,Helvetica,sans-serif;color:#263445;line-height:1.65}body{padding:0 20px 30px}.toolbar{position:sticky;top:0;z-index:10;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 16px;margin:0 -20px 22px;background:#14243b;color:#fff;box-shadow:0 2px 10px #0002}.toolbar button{border:0;border-radius:8px;padding:9px 15px;background:#fff;color:#14243b;font-weight:700;cursor:pointer}.report{max-width:1100px;margin:0 auto}.report h1,.report h2{color:#17365d}.report p{margin:0 0 18px;text-align:justify}.report a{color:#175bb5}.table-wrap{width:100%;overflow-x:auto;margin:14px 0 22px}table{border-collapse:collapse;width:100%;table-layout:auto;font-size:12px;font-weight:700}th,td{border:1px solid #cbd5e1;padding:7px 6px;text-align:center;vertical-align:middle;font-weight:700}th{background:#eaf0f7}.sg-games-table-wrap{width:100%;max-width:100%;overflow-x:auto;-webkit-overflow-scrolling:touch}.sg-games-table{width:auto;max-width:100%;min-width:0;margin:0 auto;table-layout:auto;white-space:nowrap}.sg-games-table th,.sg-games-table td{white-space:nowrap;overflow-wrap:normal;word-break:normal;padding:4px 5px}.sg-games-table td img{display:block!important;width:144px!important;height:96px!important;max-width:144px!important;min-width:0!important;object-fit:contain!important;vertical-align:middle;margin-left:auto!important;margin-right:auto!important}.sg-games-table td a{white-space:nowrap}.sg-games-table td strong{font-size:20px}li{margin:4px 0}hr{border:0;border-top:1px solid #dce5ef;margin:18px 0}.report .sg-games-table-wrap{margin:14px 0 22px}.report p[style*='font-size:11px']{font-size:11px!important}@media(max-width:600px){body{padding-left:12px;padding-right:12px}.toolbar{margin-left:-12px;margin-right:-12px}}</style></head><body><header class='toolbar'><strong>Steem Games · Report Preview</strong><button id='closePreview' type='button'>✕ Close Preview</button></header><main class='report'>" + rendered + "</main></body></html>");
    previewTab.document.close();
    previewTab.document.getElementById("closePreview").addEventListener("click",() => previewTab.close());
    previewTab.focus();
    previewBtn.textContent = "Open Preview Again";
    setProgress(progressBar.value,"HTML report preview opened in a new tab.","ok");
  }

  async function copyTextBox(box,label) {
    if (!box.value.trim()) return;
    try { await navigator.clipboard.writeText(box.value); setProgress(progressBar.value,label+" copied to clipboard.","ok"); }
    catch (_) { box.focus(); box.select(); const ok=document.execCommand("copy"); setProgress(progressBar.value,ok?label+" copied to clipboard.":"Please copy the selected text manually.",ok?"ok":"warn"); }
  }

  createBtn.addEventListener("click", async () => {
    if (window.sgReportsIsAuthorized !== true) {
      reportStatus.textContent = "Access denied. Log in as @do2earn to create reports.";
      reportStatus.className = "status error";
      return;
    }
    createBtn.disabled = true;
    $("reportEditorSection").hidden = true;
    editor.value = "";
    setProgress(5,"Connecting to the Steem Games database…");
    try {
      const {games,lastUpdated} = await fetchGames();
      setProgress(55,"Preparing the daily ranking and developer beneficiaries…");
      await new Promise(resolve => setTimeout(resolve,20));
      const report = buildReport(games,todayUTC());
      titleBox.value = report.title;
      editor.value = report.html;
      tagsBox.value = report.tags;
      $("reportEditorSection").hidden = false;
      copyBtn.disabled = false;
      previewBtn.disabled = false;
      $("reportResultSummary").textContent = report.summary.games + " active games · " + fmt(report.summary.posts) + " posts · " + fmt(report.summary.votes) + " votes · " + report.summary.beneficiaries + " developer beneficiaries · database points last updated: " + (lastUpdated || "not recorded") + ".";
      setProgress(100,"Daily report generated from the live SG database. Review and edit the HTML, then open the full-page preview and copy.","ok");
    } catch(error) {
      setProgress(progressBar.value,error.message || "Daily report generation failed.","error");
    } finally {
      createBtn.disabled = false;
    }
  });

  editor.addEventListener("input",() => {
    copyBtn.disabled = !editor.value.trim();
    previewBtn.disabled = !editor.value.trim();
  });
  titleBox.addEventListener("input",() => {
    // The report title is kept in its own field and is not inserted into the report body.
  });
  previewBtn.addEventListener("click",showPreview);
  $("copyTitleBtn").addEventListener("click",() => copyTextBox(titleBox,"Report title"));
  $("copyEditorBtn").addEventListener("click",() => copyTextBox(editor,"Report content"));
  $("copyTagsBtn").addEventListener("click",() => copyTextBox(tagsBox,"Report tags"));
})();
