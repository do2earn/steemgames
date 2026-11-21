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
    const ranked = games.slice().sort((a,b) => Number(b.points || 0) - Number(a.points || 0) || String(a.game_name || "").localeCompare(String(b.game_name || "")));
    const postRanked = games.slice().sort((a,b) => Number(b.posts || 0) - Number(a.posts || 0));
    const voteRanked = games.slice().sort((a,b) => Number(b.votes || 0) - Number(a.votes || 0));
    const userRanked = games.slice().sort((a,b) => Number(b.users || 0) - Number(a.users || 0));
    const pointLeader = ranked[0];
    const postLeader = postRanked[0];
    const voteLeader = voteRanked[0];
    const userLeader = userRanked[0];
    const average = key => games.length ? totals[key] / games.length : 0;
    const pointShare = game => totals.points > 0 ? Number(game.points || 0) / totals.points * 100 : 0;
    const postShare = game => totals.posts > 0 ? Number(game.posts || 0) / totals.posts * 100 : 0;
    const userShare = game => totals.users > 0 ? Number(game.users || 0) / totals.users * 100 : 0;
    const voteShare = game => totals.votes > 0 ? Number(game.votes || 0) / totals.votes * 100 : 0;
    const ordinal = n => n === 1 ? "first" : n === 2 ? "second" : n === 3 ? "third" : n + "th";
    const gameDescriptions = ranked.map((game,index) => {
      const name = game.game_name || "Unnamed game";
      const parts = [
        name + " is " + ordinal(index + 1) + " in the points ranking with " + fmt(game.points) + " points",
        fmt(game.posts) + " posts",
        fmt(game.users) + " recorded users",
        fmt(game.votes) + " SG votes"
      ];
      const standout = [];
      if (game === pointLeader) standout.push("the strongest points position");
      if (game === postLeader) standout.push("the highest post count");
      if (game === userLeader) standout.push("the largest recorded user count");
      if (game === voteLeader) standout.push("the highest SG vote count");
      const context = standout.length ? "; notably, it also records " + standout.join(" and ") : "";
      const interpretations = [
        "Together, these figures place it at " + pointShare(game).toFixed(1) + "% of all listed points" + context + ".",
        "Its share of the directory's combined points is " + pointShare(game).toFixed(1) + "%" + context + ".",
        "This represents " + pointShare(game).toFixed(1) + "% of total points in the current snapshot" + context + "."
      ];
      return parts.join(", ") + randomItem(interpretations);
    });
    const openings = [
      "A game-by-game reading of today's SG table shows how differently the listed projects are performing. ",
      "Looking across every entry rather than only the top of the leaderboard reveals the distinct activity profiles of the games. ",
      "The current database snapshot provides a detailed comparison of all " + games.length + " listed games. "
    ];
    const closings = [
      "The point shares below show how much each title contributes to the combined leaderboard score.",
      "Taken together, these individual records explain the current ranking while keeping content, users, and SG votes visible as separate measures.",
      "This comparison uses the same four live database measures for every game, making the differences between projects easier to assess."
    ];
    const paragraphOne = randomItem(openings) + gameDescriptions.join(" ") + " " + randomItem(closings);

    const topThree = ranked.slice(0,3);
    const topThreePoints = topThree.reduce((sum,g) => sum + (Number(g.points) || 0),0);
    const topThreeShare = totals.points > 0 ? topThreePoints / totals.points * 100 : 0;
    const activePoints = games.filter(g => Number(g.points) > 0).length;
    const activePosts = games.filter(g => Number(g.posts) > 0).length;
    const activeUsers = games.filter(g => Number(g.users) > 0).length;
    const activeVotes = games.filter(g => Number(g.votes) > 0).length;
    const postPerGame = average("posts");
    const userPerGame = average("users");
    const votePerGame = average("votes");
    const pointPerGame = average("points");
    const pointSpread = pointLeader ? Number(pointLeader.points || 0) - Number(ranked[ranked.length - 1]?.points || 0) : 0;
    const leaders = [
      pointLeader ? pointLeader.game_name + " leads points (" + fmt(pointLeader.points) + ")" : "",
      postLeader ? postLeader.game_name + " leads posts (" + fmt(postLeader.posts) + ")" : "",
      userLeader ? userLeader.game_name + " leads recorded users (" + fmt(userLeader.users) + ")" : "",
      voteLeader ? voteLeader.game_name + " leads SG votes (" + fmt(voteLeader.votes) + ")" : ""
    ].filter(Boolean);
    const conclusions = [
      "Overall, the table describes an ecosystem with " + activePoints + " of " + games.length + " games currently recording points, " + activePosts + " recording posts, " + activeUsers + " recording users, and " + activeVotes + " recording SG votes. The top three games account for " + topThreeShare.toFixed(1) + "% of all points, while the average listing has " + fmt(pointPerGame) + " points, " + fmt(postPerGame) + " posts, " + fmt(userPerGame) + " recorded users, and " + fmt(votePerGame) + " votes. These figures suggest " + (topThreeShare >= 70 ? "a strongly concentrated points leaderboard, where a small group currently holds most of the scoring weight" : topThreeShare >= 45 ? "a leaderboard with a noticeable leading group, alongside meaningful participation from the rest of the directory" : "a comparatively distributed points leaderboard, with the leading group accounting for less than half of the total") + ".",
      "The leading positions are spread across the following measures: " + leaders.join("; ") + ". This distinction matters because a game can attract posts, users, or votes without holding the top points position. The points gap between first and last place is " + fmt(pointSpread) + ", and " + (activePosts === games.length ? "every listed game has recorded posts" : (games.length - activePosts) + " games currently show no recorded posts") + ". The directory therefore contains both established activity and opportunities for quieter projects to grow their player and creator communities.",
      "The figures should be read as a snapshot of SG's recorded activity, not as a judgement of gameplay quality or proof of long-term momentum. " + (topThreeShare >= 60 ? "The concentration of points among the top three makes it especially valuable for other developers to build consistent participation and improve discoverability." : "The spread of points leaves room for several projects to strengthen their position through sustained community involvement.") + " With averages of " + fmt(postPerGame) + " posts and " + fmt(userPerGame) + " recorded users per game, the clearest opportunity across the directory is to turn discovery into real play, original gameplay content, and regular community participation."
    ];
    const paragraphTwo = randomItem(conclusions) + " " + randomItem([
      "Players can help by exploring titles beyond the leaders, sharing useful gameplay posts, and voting for the games they genuinely enjoy.",
      "Developers can use these comparisons to identify where their communities are active and where clearer onboarding, fresh content, or player engagement could make a difference.",
      "The strongest path forward is practical community support: play, publish original experiences, welcome new users, and use SG votes to recognise games worth discovering."
    ]);
    return [paragraphOne, paragraphTwo];
  }

  function buildPostsChart(games) {
    const rows = [];
    const cur8 = games.find(g => cleanTag(g.tag) === "cur8");
    for (const g of games) {
      const tag = cleanTag(g.tag);
      if (!tag || tag === "drugwars-fight") continue;
      if (tag === "cur8") {
        if (cur8 && !rows.some(x => x.tag === "cur8")) rows.push({tag, name:"CUR8 Games", posts:Number(cur8.posts)||0});
        continue;
      }
      rows.push({tag, name:String(g.game_name||tag), posts:Number(g.posts)||0});
    }
    const max = Math.max(1, ...rows.map(x => x.posts));
    const colors = ["#2563eb","#0d9488","#7c3aed","#ea580c","#0891b2","#db2777","#65a30d"];
    const bars = rows.map((x,i) => {
      const w = Math.max(x.posts ? 1 : 0, Math.round(x.posts/max*100));
      return "<div style='display:grid;grid-template-columns:minmax(90px,145px) minmax(0,1fr);gap:8px;align-items:center;margin:9px 0;'><strong style='font-size:12px;text-align:left;overflow-wrap:anywhere;'>"+esc(x.name)+"</strong><div style='height:30px;position:relative;background:#e8edf4;border-radius:7px;overflow:hidden;'><div style='position:absolute;inset:0 auto 0 0;width:"+w+"%;background:"+colors[i%colors.length]+";border-radius:7px;'></div><span style='position:absolute;inset:0;display:flex;align-items:center;justify-content:flex-end;padding:0 10px;color:"+(w>=35?"#ffffff":"#172033")+";font-size:12px;font-weight:800;white-space:nowrap;text-shadow:"+(w>=35?"0 1px 2px rgba(0,0,0,.25)":"none")+";'>"+fmt(x.posts)+"</span></div></div>";
    }).join("");
    const total = rows.reduce((n,x)=>n+x.posts,0);
    const leader = rows.slice().sort((a,b)=>b.posts-a.posts)[0];
    const lowest = rows.filter(x=>x.posts>0).slice().sort((a,b)=>a.posts-b.posts)[0];
    const active = rows.filter(x=>x.posts>0).length;
    const leaderShare = total && leader ? (leader.posts/total*100).toFixed(1) : "0";
    const note = rows.length
      ? "<p style='margin:16px 0 9px;line-height:1.65;'>The chart compares "+rows.length+" dedicated game tags and shows a combined total of <strong>"+fmt(total)+" posts</strong> in the SG database. <strong>"+(leader?leader.name:"The leading game")+"</strong> ranks first with "+fmt(leader.posts)+" posts, representing "+leaderShare+"% of all posts included in this chart.</p><p style='margin:0 0 9px;line-height:1.65;'>"+active+" out of "+rows.length+" games have at least one recorded post. "+(lowest?"At the other end, "+lowest.name+" has the lowest non-zero count, with "+fmt(lowest.posts)+" posts. ":"")+"The gap between the most active game and the remaining communities shows that posting activity is concentrated unevenly across the game tags.</p><p style='margin:0;line-height:1.65;'>These figures are based on the post totals currently stored for each dedicated tag in the Steem Games database. They provide a snapshot of community publishing activity, not a measure of votes, players, or gameplay sessions. The CUR8 Games row represents only the selected CUR8 game's post count, as specified for this report.</p>"
      : "<p>No dedicated game-tag statistics are currently available in the SG database.</p>";
    return "<div style='border:2px solid #475569;border-radius:14px;background:#f1f5f9;padding:16px;margin:18px 0;color:#172033;'><h2 style='margin:0 0 14px;font-size:20px;'>📊 Chart of Games Posts Statistics</h2>"+(bars||"<p>No game tags available.</p>")+note+"</div>";
  }
  function buildTodayGame(games) {
    const g = randomItem(games); if (!g) return "";
    const tag = cleanTag(g.tag), about = String(g.about||"").trim();
    const website = /^https?:\/\//i.test(String(g.website_url||"").trim()) ? String(g.website_url).trim() : "";
    const playButton = website ? "<div style='text-align:center;margin-top:15px;'><a href='"+esc(website)+"' target='_blank' rel='noopener noreferrer' style='display:inline-flex;align-items:center;justify-content:center;padding:11px 22px;background:#15803d;border:1px solid #166534;border-radius:10px;color:#fff!important;text-decoration:none;font-size:16px;font-weight:800;box-shadow:0 3px 0 #166534;'>🎮 Play Now!</a></div>" : "";
    return "<div style='border:2px solid #475569;border-radius:14px;background:#fef3c7;padding:16px;margin:18px 0;color:#172033;'><h2 style='margin:0 0 14px;font-size:20px;'>🎮 Today Game</h2><div style='text-align:center;margin:8px 0 14px;'><img src='"+esc(logoUrl(g))+"' alt='"+esc(g.game_name)+"' style='width:300px;height:220px;max-width:100%;object-fit:contain;'></div><div style='text-align:left;line-height:1.9;'><strong>⭐ Points:</strong> "+fmt(g.points)+"<br><strong>📄 Posts Numbers:</strong> "+fmt(g.posts)+"<br><strong>#️⃣ Dedicated Tag:</strong> "+(tag?"#"+esc(tag):"Not listed")+"<br><strong>👩‍💻 Developer:</strong> "+esc(g.developer||"Not listed")+"<br><strong>🗂️ Genres:</strong> "+esc(g.genres||"Not listed")+"</div><p style='margin:13px 0 0;text-align:left;line-height:1.7;'>"+(about?esc(about):"No game description is currently available.")+"</p>"+playButton+"</div>";
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

    const eligibleDevelopers = Array.from(new Set(ranked.map(game => accountName(game.developer)).filter(Boolean)));
    const selectedDeveloper = eligibleDevelopers.length ? randomItem(eligibleDevelopers) : "";
    const beneficiaryText = selectedDeveloper
      ? "10% of the author rewards from this daily report is allocated to a random selected developer."
      : "No valid developer account is currently available in the SG database, so a 10% developer beneficiary cannot be assigned. Please review the Developer fields before publishing.";
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
    const postsChart = buildPostsChart(games);
    const todayGame = buildTodayGame(games);
    const html = [
      "![Image cover]()",
      "",
      "### Hello to All Fans and Developers of Steem Blockchain Games.",
      "",
      "<div style='border:2px solid #343a40;border-radius:16px;background:#fff;padding:18px 16px;margin:14px 0;color:#172033;text-align:center;'><img src='"+SITE_BASE+"/assets/images/steemgames_logo.webp' alt='Official Steem Games Logo' width='92' height='92' style='display:block;width:92px;height:92px;max-width:100%;object-fit:contain;margin:0 auto 10px;'><h2 style='margin:0 0 12px;font-size:20px;'>What's Steem Games website?</h2><div style='text-align:left;'><p style='margin:0 0 12px;line-height:1.7;'>"+introFirst+"</p><p style='margin:0;line-height:1.7;'>"+introSecond+"</p></div><a href='"+SITE_BASE+"' target='_blank' rel='noopener noreferrer' style='display:inline-flex;align-items:center;justify-content:center;gap:16px;padding:20px 38px;margin:10px 0;background:#2563eb;border:1px solid #1d4ed8;border-radius:14px;color:#fff!important;text-decoration:none;font-family:Arial,Helvetica,sans-serif;font-size:26px;font-weight:900;line-height:1.25;box-shadow:0 4px 12px rgba(37,99,235,.22);'><img src='"+SITE_BASE+"/assets/images/steemgames_logo.webp' alt='Steem Games Logo' width='60' height='60' style='display:block;width:60px;height:60px;object-fit:contain;flex:0 0 60px;'><span>Explore <span style='color:#ef4444'>S</span><span style='color:#f59e0b'>t</span><span style='color:#22c55e'>e</span><span style='color:#06b6d4'>e</span><span style='color:#3b82f6'>m</span> <span style='color:#ec4899'>G</span><span style='color:#f97316'>a</span><span style='color:#14b8a6'>m</span><span style='color:#6366f1'>e</span><span style='color:#eab308'>s</span></span></a></div>",
      '<div style="height:16px;line-height:16px;"></div>',
      "",
      "<hr>",
      "",
      "<div style='border:2px solid #475569;border-radius:14px;background:#e0f2fe;padding:16px;margin:16px 0;color:#172033;'>",
      "<h2 style='margin:0 0 10px;font-size:20px;'>SG Developer Updates</h2>",
      "",
      "</div>",
      "",
      "# Steem Games Statistics",
      "",
      gameTable,
      "",
      postsChart,
      "",
      todayGame,
      "",
      "<table width='100%' cellpadding='16' cellspacing='0' border='0' style='width:100%;border:2px solid #3f8f45;border-radius:12px;border-collapse:separate;border-spacing:0;background:#e4f2d5;margin:10px 0 18px;'><tr><td align='left' style='text-align:left;background:#e4f2d5;border-radius:12px;padding:16px 18px;color:#254329;'><h2 style='margin:0 0 18px;text-align:left;color:#286b35;font-size:20px;font-weight:700;line-height:1.3;'>🎁 Selected Developer Rewards</h2><p style='margin:0 0 14px;text-align:left;'>" + esc(beneficiaryText) + "</p>" + (selectedDeveloper ? "<p style='margin:0;text-align:left;font-size:17px;line-height:1.7;'>🎉 <strong>Today Lucky Developer:</strong><br><strong style='font-size:21px;'>@" + esc(selectedDeveloper) + "</strong></p>" : "") + "</td></tr></table>",
      "",
      "<p style='margin:18px 0 8px;text-align:center;font-size:12px;line-height:1.7;'><a href='" + SITE_BASE + "' target='_blank' rel='noopener noreferrer'>Explore Steem Games</a> &nbsp;·&nbsp; <a href='" + SITE_BASE + "/faq.html' target='_blank' rel='noopener noreferrer'>Frequency Questions (FAQ)</a> &nbsp;·&nbsp; <a href='" + SITE_BASE + "/about.html' target='_blank' rel='noopener noreferrer'>About Steem Games</a></p>",
      "",
      "<hr style='display:block;border:0;border-top:1px solid #cbd5e1;height:0;margin:14px 0 10px;'>",
      "",
      "<p style='margin:8px 0 0;text-align:center;color:#667085;font-size:11px;line-height:1.6;'>Published by <a href='https://do2earn.dev' target='_blank' rel='noopener noreferrer'>Do2Earn</a> (@do2earn)<br>© <a href='" + SITE_BASE + "' target='_blank' rel='noopener noreferrer'>Steem Games</a> Daily Report</p>"
    ].join("\n");

    return {title,html,tags:tags.map(tag=>"#"+tag).join(" "),summary:{games:games.length,posts:totals.posts,votes:totals.votes,points:totals.points,beneficiaries:selectedDeveloper ? 1 : 0}};
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
      const blockStart = line.match(/^\s*<(div|table|center)\b/i);
      if (blockStart) {
        flushParagraph(); flushTable();
        const tagName = blockStart[1].toLowerCase();
        const closeTag = new RegExp("</" + tagName + "\\s*>\\s*$", "i");
        const raw = [line];
        while (!closeTag.test(raw.join("\n")) && i + 1 < lines.length) raw.push(lines[++i]);
        out.push(raw.join("\n"));
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
