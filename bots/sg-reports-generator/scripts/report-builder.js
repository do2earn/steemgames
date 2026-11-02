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

    const rows = ranked.map((game,index) => {
      const name = esc(game.game_name || "Unnamed game");
      const logo = esc(logoUrl(game));
      const info = esc(gamePageUrl(game));
      const tag = cleanTag(game.tag);
      const developer = accountName(game.developer);
      const tagUrl = tag ? "https://www.steemx.org/created/" + encodeURIComponent(tag) : "";
      const developerUrl = developer ? "https://www.steemx.org/@" + encodeURIComponent(developer) : "";
      const developerLabel = developer ? "<a href=\'" + developerUrl + "\' target=\'_blank\' rel=\'noopener noreferrer\'>@" + esc(developer) + "</a>" : esc(game.developer || "Not listed");
      return "<tr>" +
        "<td style='text-align:center;font-weight:700;white-space:nowrap'>" + (index+1) + "</td>" +
        "<td style='text-align:center;min-width:92px'><a href='" + info + "' target='_blank' rel='noopener noreferrer' title='Open " + name + " on Steem Games'><img src='" + logo + "' alt='" + name + "' style='width:76px;max-height:58px;object-fit:contain;border:0;display:block;margin:0 auto'></a></td>" +
        "<td style='text-align:center;white-space:nowrap'><strong>" + fmt(game.points) + "</strong><br><a href='" + SITE_BASE + "/#steemgamesComponent' target='_blank' rel='noopener noreferrer' style='display:inline-block;margin-top:5px;padding:4px 8px;background:#198754;color:#fff;text-decoration:none;border-radius:5px;font-size:12px;font-weight:bold'>✅ Vote</a></td>" +
        "<td style='text-align:center;white-space:nowrap'>" + fmt(game.posts) + "</td>" +
        "<td style='text-align:center;white-space:nowrap'>" + (tag ? "<a href=\'" + tagUrl + "\' target=\'_blank\' rel=\'noopener noreferrer\'>#" + esc(tag) + "</a>" : "—") + "</td>" +
        "<td style='text-align:center;overflow-wrap:anywhere;min-width:100px'>" + developerLabel + "</td>" +
        "</tr>";
    }).join("");

    const topDevelopers = [];
    const seen = new Set();
    for (const game of ranked) {
      const developer = accountName(game.developer);
      if (!developer || seen.has(developer)) continue;
      seen.add(developer);
      topDevelopers.push(developer);
      if (topDevelopers.length === 10) break;
    }
    const beneficiaryList = topDevelopers.map(name => "<li><strong>@" + esc(name) + "</strong>: 5%</li>").join("");
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
      "<div style='font-family:Arial,Helvetica,sans-serif;color:#263445;line-height:1.65;font-size:16px;max-width:100%;overflow-wrap:anywhere'>",
      "<h1 style='color:#17365d;text-align:center'>🎮 <a href='" + SITE_BASE + "' target='_blank' rel='noopener noreferrer' style='color:inherit;text-decoration:none'>Steem Games</a> | Daily Report | " + esc(date) + "</h1>",
      "<p style='font-size:16px;line-height:1.9;text-align:justify;direction:ltr;margin:0 0 14px'>" + introFirst + "</p>",
      "<p style='font-size:16px;line-height:1.9;text-align:justify;direction:ltr;margin:0 0 22px'>" + introSecond + "</p>",
      "<div style='text-align:center;margin:24px 0 28px'><a href='" + SITE_BASE + "' target='_blank' rel='noopener noreferrer' style='display:inline-flex;align-items:center;justify-content:center;gap:13px;background:#198754;color:#fff;padding:16px 28px;border-radius:10px;text-decoration:none;font-size:20px;font-weight:800;box-shadow:0 4px 12px #19875444'><img src='" + SITE_BASE + "/assets/images/steemgames_logo.webp' alt='' style='width:38px;height:38px;object-fit:contain;border:0'>Explore Steem Games</a></div>",
      "<h2 style='color:#17365d'>" + sgLink + " Status</h2>",
      "<h2 style='color:#17365d'>" + sgLink + " Table</h2>",
      "<div style='width:100%;max-width:100%;overflow-x:auto;-webkit-overflow-scrolling:touch;border:1px solid #cbd5e1;border-radius:7px;margin:12px 0'><table style='border-collapse:collapse;width:100%;min-width:650px;font-size:13px;font-weight:700;margin:0;table-layout:auto'><thead><tr style='background:#eaf0f7'><th style='border:1px solid #cbd5e1;padding:8px;white-space:nowrap'>Rank</th><th style='border:1px solid #cbd5e1;padding:8px;white-space:nowrap'>Game</th><th style='border:1px solid #cbd5e1;padding:8px;white-space:nowrap'>Points</th><th style='border:1px solid #cbd5e1;padding:8px;white-space:nowrap'>Posts</th><th style='border:1px solid #cbd5e1;padding:8px;white-space:nowrap'>Dedicated Tag</th><th style='border:1px solid #cbd5e1;padding:8px;white-space:nowrap'>Developer</th></tr></thead><tbody>" + rows + "</tbody></table></div>",
      "<p>" + esc(analysis[0]) + "</p><p>" + esc(analysis[1]) + "</p>",
      "<div style='background:#fff8d6;border:1px solid #f1df91;border-radius:10px;padding:16px 20px;margin:22px 0;color:#493d16'><h2 style='color:#6b5510;margin-top:0'>Developers Beneficiaries</h2><p>" + esc(beneficiaryText) + "</p><ul style='margin-bottom:0'>" + beneficiaryList + "</ul></div>",
      "<hr style='border:0;border-top:1px solid #dce5ef;margin:22px 0'><p style='font-size:12px;color:#7b8794;text-align:center'>Published by @do2earn · " + sgLink + " Daily Report · " + esc(date) + "</p>",
      "</div>"
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

  function showPreview() {
    const content = editor.value.trim();
    if (!content) return;

    // Open synchronously from the Preview button click so popup blockers allow it.
    const previewTab = window.open("", "_blank");
    if (!previewTab) {
      setProgress(progressBar.value,"The preview tab was blocked. Allow pop-ups for this site, then try again.","warn");
      return;
    }

    const documentHtml = "<!doctype html><html><head><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'><style>*{box-sizing:border-box}body{margin:0;padding:18px;font:15px/1.6 Arial,sans-serif;color:#263445;overflow-wrap:anywhere}table{border-collapse:collapse;width:100%;min-width:650px;font-size:13px;font-weight:700;margin:0;table-layout:auto}th,td{border:1px solid #cbd5e1;padding:7px;text-align:center;vertical-align:middle;white-space:nowrap;font-weight:700}th{background:#eaf0f7}img{max-width:100%;height:auto}a{color:#175bb5}</style></head><body>" + content + "</body></html>";

    previewTab.document.open();
    previewTab.document.write("<!doctype html><html lang='en'><head><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'><title>Steem Games Report Preview</title><style>*{box-sizing:border-box}html,body{margin:0;min-height:100%;font-family:system-ui,-apple-system,Segoe UI,Arial,sans-serif}.toolbar{position:sticky;top:0;z-index:10;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 16px;background:#14243b;color:#fff;box-shadow:0 2px 10px #0002}.toolbar strong{font-size:14px}.toolbar button{border:0;border-radius:8px;padding:9px 15px;background:#fff;color:#14243b;font-weight:700;cursor:pointer}.report-frame{display:block;width:100%;height:calc(100vh - 54px);border:0;background:#fff}@media print{.toolbar{display:none}.report-frame{height:100vh}}</style></head><body><header class='toolbar'><strong>Steem Games · Report Preview</strong><button id='closePreview' type='button'>✕ Close Preview</button></header><iframe class='report-frame' id='reportFrame' title='Complete HTML report preview' sandbox=''></iframe></body></html>");
    previewTab.document.close();
    previewTab.document.getElementById("reportFrame").srcdoc = documentHtml;
    previewTab.document.getElementById("closePreview").addEventListener("click",() => previewTab.close());
    previewTab.focus();
    previewBtn.textContent = "Open Preview Again";
    setProgress(progressBar.value,"Full-page HTML preview opened in a new tab.","ok");
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
    if (!editor.value.trim()) return;
    editor.value = editor.value.replace(/<h1[^>]*>.*?<\/h1>/, "<h1 style=\"color:#17365d;text-align:center\">🎮 " + esc(titleBox.value) + "</h1>");
  });
  previewBtn.addEventListener("click",showPreview);
  $("copyTitleBtn").addEventListener("click",() => copyTextBox(titleBox,"Report title"));
  $("copyEditorBtn").addEventListener("click",() => copyTextBox(editor,"Report content"));
  $("copyTagsBtn").addEventListener("click",() => copyTextBox(tagsBox,"Report tags"));
})();
