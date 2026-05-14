// ── BALLPARK COORDINATES & ORIENTATION ────────────────────────────────────────
// orientation = degrees the "out to center" direction points (compass bearing)
// Wind blowing FROM the opposite direction = wind blowing OUT
const BALLPARKS = {
  "New York Yankees":       { lat: 40.8296, lon: -73.9262, name: "Yankee Stadium",        centerBearing: 5   },
  "Boston Red Sox":         { lat: 42.3467, lon: -71.0972, name: "Fenway Park",            centerBearing: 90  },
  "Toronto Blue Jays":      { lat: 43.6414, lon: -79.3894, name: "Rogers Centre",          centerBearing: 10  },
  "Tampa Bay Rays":         { lat: 27.7683, lon: -82.6534, name: "Tropicana Field",        centerBearing: 0   },
  "Baltimore Orioles":      { lat: 39.2838, lon: -76.6218, name: "Camden Yards",           centerBearing: 230 },
  "Chicago White Sox":      { lat: 41.8300, lon: -87.6338, name: "Guaranteed Rate Field",  centerBearing: 5   },
  "Cleveland Guardians":    { lat: 41.4962, lon: -81.6852, name: "Progressive Field",      centerBearing: 20  },
  "Detroit Tigers":         { lat: 42.3390, lon: -83.0485, name: "Comerica Park",          centerBearing: 340 },
  "Kansas City Royals":     { lat: 39.0517, lon: -94.4803, name: "Kauffman Stadium",       centerBearing: 5   },
  "Minnesota Twins":        { lat: 44.9817, lon: -93.2776, name: "Target Field",           centerBearing: 330 },
  "Houston Astros":         { lat: 29.7573, lon: -95.3555, name: "Minute Maid Park",       centerBearing: 25  },
  "Los Angeles Angels":     { lat: 33.8003, lon: -117.8827,name: "Angel Stadium",          centerBearing: 5   },
  "Oakland Athletics":      { lat: 37.7516, lon: -122.2005,name: "Oakland Coliseum",       centerBearing: 330 },
  "Seattle Mariners":       { lat: 47.5914, lon: -122.3325,name: "T-Mobile Park",          centerBearing: 10  },
  "Texas Rangers":          { lat: 32.7473, lon: -97.0831, name: "Globe Life Field",       centerBearing: 5   },
  "Atlanta Braves":         { lat: 33.8908, lon: -84.4678, name: "Truist Park",            centerBearing: 340 },
  "Miami Marlins":          { lat: 25.7781, lon: -80.2197, name: "loanDepot Park",         centerBearing: 350 },
  "New York Mets":          { lat: 40.7571, lon: -73.8458, name: "Citi Field",             centerBearing: 5   },
  "Philadelphia Phillies":  { lat: 39.9061, lon: -75.1665, name: "Citizens Bank Park",     centerBearing: 5   },
  "Washington Nationals":   { lat: 38.8730, lon: -77.0074, name: "Nationals Park",         centerBearing: 5   },
  "Chicago Cubs":           { lat: 41.9484, lon: -87.6553, name: "Wrigley Field",          centerBearing: 355 },
  "Cincinnati Reds":        { lat: 39.0979, lon: -84.5082, name: "Great American Ball Park",centerBearing: 330 },
  "Milwaukee Brewers":      { lat: 43.0280, lon: -87.9712, name: "American Family Field",  centerBearing: 340 },
  "Pittsburgh Pirates":     { lat: 40.4469, lon: -80.0057, name: "PNC Park",               centerBearing: 330 },
  "St. Louis Cardinals":    { lat: 38.6226, lon: -90.1928, name: "Busch Stadium",          centerBearing: 5   },
  "Arizona Diamondbacks":   { lat: 33.4453, lon: -112.0667,name: "Chase Field",            centerBearing: 330 },
  "Colorado Rockies":       { lat: 39.7559, lon: -104.9942,name: "Coors Field",            centerBearing: 350 },
  "Los Angeles Dodgers":    { lat: 34.0739, lon: -118.2400,name: "Dodger Stadium",         centerBearing: 340 },
  "San Diego Padres":       { lat: 32.7073, lon: -117.1566,name: "Petco Park",             centerBearing: 315 },
  "San Francisco Giants":   { lat: 37.7786, lon: -122.3893,name: "Oracle Park",            centerBearing: 5   },
};

// Wind direction helper — returns "out", "in", "cross", or "calm"
function getWindEffect(windDeg, windSpeed, centerBearing) {
  if (windSpeed < 5) return { effect: "calm", label: "Calm" };
  // Angle between wind direction and center bearing
  let diff = Math.abs(windDeg - centerBearing) % 360;
  if (diff > 180) diff = 360 - diff;
  if (diff <= 45) return { effect: "out", label: `Wind OUT ${windSpeed}mph` };
  if (diff >= 135) return { effect: "in", label: `Wind IN ${windSpeed}mph` };
  return { effect: "cross", label: `Crosswind ${windSpeed}mph` };
}

exports.handler = async (event) => {
  const API_KEY = process.env.ODDS_API_KEY;
  const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;

  if (!API_KEY) {
    return { statusCode: 500, body: JSON.stringify({ error: "Odds API key not configured" }) };
  }

  const { which } = event.queryStringParameters || {};

  // ── ODDS URL ───────────────────────────────────────────────────────────────
  let oddsUrl = `https://api.the-odds-api.com/v4/sports/baseball_mlb/odds?regions=us&markets=h2h,spreads,totals&oddsFormat=american&bookmakers=draftkings,fanduel,betmgm,caesars,thescore&apiKey=${API_KEY}`;

  if (which === "tomorrow") {
    const now = new Date();
    const etOffset = 5 * 60 * 60 * 1000;
    const todayET = new Date(now.getTime() - etOffset);
    const tomorrowET = new Date(todayET);
    tomorrowET.setUTCDate(tomorrowET.getUTCDate() + 1);
    tomorrowET.setUTCHours(0, 0, 0, 0);
    const dayAfterET = new Date(tomorrowET);
    dayAfterET.setUTCDate(dayAfterET.getUTCDate() + 1);
    const fromUtc = new Date(tomorrowET.getTime() + etOffset);
    const toUtc = new Date(dayAfterET.getTime() + etOffset);
    const toFmt = (dt) => dt.toISOString().replace(/\.\d{3}Z$/, 'Z');
    oddsUrl += `&commenceTimeFrom=${toFmt(fromUtc)}&commenceTimeTo=${toFmt(toUtc)}`;
  }

  const scoresUrl = `https://api.the-odds-api.com/v4/sports/baseball_mlb/scores?daysFrom=10&apiKey=${API_KEY}`;

  try {
    // Step 1: fetch odds + scores + pitchers in parallel
    const today = new Date();
    const dateStr = which === "tomorrow"
      ? new Date(today.getTime() + 86400000).toISOString().split("T")[0]
      : today.toISOString().split("T")[0];
    const [oddsRes, scoresRes] = await Promise.all([
      fetch(oddsUrl),
      fetch(scoresUrl),
    ]);

    const remaining = oddsRes.headers.get("x-requests-remaining");
    const oddsData = await oddsRes.json();
    const scoresData = scoresRes.ok ? await scoresRes.json() : [];

    const pitcherByTeam = {};
    const pitcherMap2 = {}; // filled after briefing call


    // Helper to get pitcher for a game
    const getPitchers = (home, away) => {
      const homeKey = home.split(" ").pop().toLowerCase();
      const awayKey = away.split(" ").pop().toLowerCase();
      const homePitcher = pitcherMap2[homeKey] || pitcherByTeam[homeKey] || "TBD";
      const awayPitcher = pitcherMap2[awayKey] || pitcherByTeam[awayKey] || "TBD";
      return { home: homePitcher, away: awayPitcher };
    };

    if (!oddsRes.ok) {
      return { statusCode: oddsRes.status, body: JSON.stringify({ error: oddsData.message || "Odds API error" }) };
    }
    if (!Array.isArray(oddsData) || oddsData.length === 0) {
      return { statusCode: 200, headers: { "Content-Type": "application/json", "x-requests-remaining": remaining || "" }, body: JSON.stringify([]) };
    }

    // Step 2: streaks
    const { streakMap, fuzzyLookup, normalize } = buildStreakMap(scoresData);
    const getStreak = name => streakMap[name] || streakMap[fuzzyLookup[normalize(name)]] || streakMap[fuzzyLookup[name.split(' ').pop().toLowerCase()]] || { streak: 0, type: null, last5: [] };

    // Step 3: fetch weather for each unique home team in parallel
    const uniqueHomeTeams = [...new Set(oddsData.map(e => e.home_team))];
    const weatherMap = {};

    await Promise.all(uniqueHomeTeams.map(async (team) => {
      const park = BALLPARKS[team];
      if (!park) return;
      try {
        const gameTime = oddsData.find(e => e.home_team === team)?.commence_time;
        const date = gameTime ? gameTime.split('T')[0] : new Date().toISOString().split('T')[0];
        const hour = gameTime ? new Date(gameTime).getUTCHours() : 18;

        const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${park.lat}&longitude=${park.lon}&hourly=temperature_2m,windspeed_10m,winddirection_10m,precipitation_probability&temperature_unit=fahrenheit&windspeed_unit=mph&timezone=America/New_York&start_date=${date}&end_date=${date}`;
        const wRes = await fetch(weatherUrl);
        if (!wRes.ok) return;
        const wData = await wRes.json();

        // Find the hour closest to game time
        const hours = wData.hourly?.time || [];
        const idx = hours.findIndex(t => new Date(t).getUTCHours() >= hour) || hour;
        const actualIdx = Math.max(0, Math.min(idx, hours.length - 1));

        const windSpeed = Math.round(wData.hourly?.windspeed_10m?.[actualIdx] || 0);
        const windDeg = Math.round(wData.hourly?.winddirection_10m?.[actualIdx] || 0);
        const temp = Math.round(wData.hourly?.temperature_2m?.[actualIdx] || 70);
        const precip = Math.round(wData.hourly?.precipitation_probability?.[actualIdx] || 0);

        const windEffect = getWindEffect(windDeg, windSpeed, park.centerBearing);

        weatherMap[team] = {
          stadium: park.name,
          temp,
          windSpeed,
          windDeg,
          windEffect: windEffect.effect,
          windLabel: windEffect.label,
          precip,
          isIndoor: ["Rogers Centre", "Tropicana Field", "Chase Field", "Minute Maid Park", "American Family Field", "loanDepot Park"].includes(park.name),
        };
      } catch (_) {}
    }));

    // Step 4: build game summaries
    const todayLabel = today.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
    const dayWord = which === "tomorrow" ? "tomorrow" : "today";

    const gameSummaries = oddsData.map(event => {
      const home = event.home_team, away = event.away_team;
      const time = new Date(event.commence_time).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZoneName: "short" });

      let homeMls=[], awayMls=[], homeRLs=[], awayRLs=[], overs=[], unders=[], totals=[];
      for (const book of (event.bookmakers || [])) {
        for (const mkt of (book.markets || [])) {
          if (mkt.key === "h2h") {
            for (const o of mkt.outcomes) {
              if (o.name === home) homeMls.push(o.price); else awayMls.push(o.price);
            }
          }
          if (mkt.key === "spreads") {
            for (const o of mkt.outcomes) {
              if (o.name === home && o.point === -1.5) homeRLs.push(o.price);
              if (o.name === away && o.point === 1.5) awayRLs.push(o.price);
            }
          }
          if (mkt.key === "totals") {
            for (const o of mkt.outcomes) {
              if (o.name === "Over") { overs.push(o.price); totals.push(o.point); }
              if (o.name === "Under") unders.push(o.price);
            }
          }
        }
      }

      const avg = a => a.length ? Math.round(a.reduce((x,y)=>x+y,0)/a.length) : null;
      const homeML = avg(homeMls), awayML = avg(awayMls);
      const homeRL = avg(homeRLs), awayRL = avg(awayRLs);
      const overOdds = avg(overs), underOdds = avg(unders);
      const total = totals.length ? totals[0] : null;

      const homeStreak = getStreak(home);
      const awayStreak = getStreak(away);
      const weather = weatherMap[home] || null;

      const fmt = n => n === null ? "N/A" : (n > 0 ? "+" : "") + n;
      const signals = [];
      if (homeML !== null && homeML < 0 && homeRL !== null && homeRL > 0) signals.push(`${home} ML fav (${fmt(homeML)}) but run line +money (${fmt(homeRL)})`);
      if (awayML !== null && awayML < 0 && awayRL !== null && awayRL > 0) signals.push(`${away} ML fav (${fmt(awayML)}) but run line +money (${fmt(awayRL)})`);
      if (homeML !== null && homeML <= -165) signals.push(`${home} heavily favored at ${fmt(homeML)}`);
      if (awayML !== null && awayML <= -165) signals.push(`${away} heavily favored at ${fmt(awayML)}`);
      if (total !== null && total <= 8 && overOdds !== null && overOdds > 0) signals.push(`Low total (${total}) with +money over (${fmt(overOdds)})`);
      if (overOdds !== null && overOdds >= -105) signals.push(`Sharp over at ${fmt(overOdds)}`);
      if (homeStreak.type === "W" && homeStreak.streak >= 2) signals.push(`${home} on W${homeStreak.streak} streak`);
      if (awayStreak.type === "W" && awayStreak.streak >= 2) signals.push(`${away} on W${awayStreak.streak} streak`);
      if (homeStreak.type === "L" && homeStreak.streak >= 3) signals.push(`${home} on L${homeStreak.streak} skid`);
      if (awayStreak.type === "L" && awayStreak.streak >= 3) signals.push(`${away} on L${awayStreak.streak} skid`);
      if (weather && !weather.isIndoor) {
        if (weather.windEffect === "out" && weather.windSpeed >= 8) signals.push(`Wind blowing OUT at ${weather.windSpeed}mph at ${weather.stadium} — inflates scoring`);
        if (weather.windEffect === "in" && weather.windSpeed >= 8) signals.push(`Wind blowing IN at ${weather.windSpeed}mph at ${weather.stadium} — suppresses scoring`);
        if (weather.temp < 50) signals.push(`Cold game (${weather.temp}°F) — pitchers grip better, scoring tends down`);
        if (weather.precip >= 40) signals.push(`${weather.precip}% chance of rain — watch for delays`);
      }

      const pitchers = getPitchers(home, away);
      return { home, away, time, commenceTime: event.commence_time || null, homeML, awayML, homeRL, awayRL, overOdds, underOdds, total, homeStreak, awayStreak, weather, signals, pitchers };
    });

    // Step 5: AI analysis — batched to avoid token limits
    let analysisMap = {};

    if (ANTHROPIC_KEY) {
      const BATCH_SIZE = 7;
      const batches = [];
      for (let i = 0; i < gameSummaries.length; i += BATCH_SIZE) {
        batches.push(gameSummaries.slice(i, i + BATCH_SIZE).map((g, j) => ({ g, globalIdx: i + j })));
      }

      const gameStr = (g, num) => `GAME ${num}: ${g.away} @ ${g.home} (${g.time})
ML: ${g.home} ${g.homeML !== null ? (g.homeML > 0 ? "+" : "") + g.homeML : "N/A"} | ${g.away} ${g.awayML !== null ? (g.awayML > 0 ? "+" : "") + g.awayML : "N/A"}
Run line: ${g.home} -1.5 @ ${g.homeRL !== null ? (g.homeRL > 0 ? "+" : "") + g.homeRL : "N/A"} | ${g.away} +1.5 @ ${g.awayRL !== null ? (g.awayRL > 0 ? "+" : "") + g.awayRL : "N/A"}
Total: O/U ${g.total ?? "N/A"} | Over ${g.overOdds !== null ? (g.overOdds > 0 ? "+" : "") + g.overOdds : "N/A"} | Under ${g.underOdds !== null ? (g.underOdds > 0 ? "+" : "") + g.underOdds : "N/A"}
${g.home} streak: ${g.homeStreak.type ? g.homeStreak.type + g.homeStreak.streak : "unknown"} | Last 5: ${g.homeStreak.last5.join("-") || "N/A"}
${g.away} streak: ${g.awayStreak.type ? g.awayStreak.type + g.awayStreak.streak : "unknown"} | Last 5: ${g.awayStreak.last5.join("-") || "N/A"}
Pitchers: Use your knowledge of today's probable starters for ${g.away} @ ${g.home}
Weather: ${g.weather ? (g.weather.isIndoor ? "Indoor stadium" : `${g.weather.temp}F, ${g.weather.windLabel}, ${g.weather.precip}% rain at ${g.weather.stadium}`) : "N/A"}
Signals: ${g.signals.length > 0 ? g.signals.join("; ") : "No standout signals"}`;

      // Run batches in parallel
      await Promise.all(batches.map(async (batch) => {
        const prompt = `Today is ${todayLabel}. You are a sharp MLB betting analyst for Line Scout AI.

For EACH game write 3-5 sentences. Reference actual odds, streaks, weather, AND the probable starting pitchers (use your knowledge of today's starters). Give one clear actionable take. Direct, sharp, no filler.

${batch.map(({ g, globalIdx }) => gameStr(g, globalIdx + 1)).join("\n\n")}

Respond ONLY with a JSON object mapping the exact game numbers shown above to analysis strings. No markdown. Start with { end with }:`;

        try {
          const res = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-api-key": ANTHROPIC_KEY,
              "anthropic-version": "2023-06-01",
            },
            body: JSON.stringify({
              model: "claude-haiku-4-5",
              max_tokens: 4000,
              system: "You are a sharp MLB betting analyst with access to current MLB data. When writing analysis, use your knowledge of today's probable starting pitchers. Output only a JSON object mapping game numbers (strings) to 3-5 sentence analysis. No markdown. Start with { end with }.",
              messages: [{ role: "user", content: prompt }],
            }),
          });
          if (res.ok) {
            const data = await res.json();
            const text = (data.content || []).filter(b => b.type === "text").map(b => b.text).join("");
            const cleaned = text.replace(/```json|```/gi, "").trim();
            const s = cleaned.indexOf("{"), e = cleaned.lastIndexOf("}");
            if (s !== -1 && e > s) {
              const parsed = JSON.parse(cleaned.slice(s, e + 1));
              Object.assign(analysisMap, parsed);
            }
          }
        } catch (_) {}
      }));
    }

    // Step 5b: generate daily briefing and fetch pitchers in parallel
    let dailyBriefing = "";
    if (ANTHROPIC_KEY && gameSummaries.length > 0) {
      const nowUtc = new Date();
      const topSignals = gameSummaries
        .filter(g => g.signals.length > 0 && new Date(g.commenceTime || 0) > nowUtc)
        .slice(0, 5)
        .map(g => `${g.away} @ ${g.home}: ${g.signals.join(", ")}`)
        .join("\n");

      const teamList = [...new Set(gameSummaries.flatMap(g => [
        g.home.split(" ").pop(),
        g.away.split(" ").pop()
      ]))].join(", ");

      const briefingPrompt = `Today is ${todayLabel}. You are the lead analyst for Line Scout AI. Write a 3-4 sentence daily briefing covering the biggest value spot, notable weather/streak storylines, and one play of the day. Be specific with team names and odds. Top signals: ${topSignals || "Standard slate"}`;

      const pitcherPrompt = `Search for MLB probable starting pitchers for ${dateStr}. Return ONLY a valid JSON object mapping each team's last name to their starting pitcher's full name. Use the last word of the team name as the key. Teams playing today: ${teamList}. Example format: {"Yankees":"Gerrit Cole","RedSox":"Tanner Houck"}. Return ONLY the JSON, nothing else.`;

      const [bRes, pRes] = await Promise.all([
        fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_KEY, "anthropic-version": "2023-06-01" },
          body: JSON.stringify({
            model: "claude-haiku-4-5",
            max_tokens: 500,
            system: "You are a sharp MLB betting analyst writing a daily briefing. Be direct and specific.",
            messages: [{ role: "user", content: briefingPrompt }],
          }),
        }).catch(() => null),
        fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_KEY, "anthropic-version": "2023-06-01" },
          body: JSON.stringify({
            model: "claude-sonnet-4-5",
            max_tokens: 1000,
            tools: [{ type: "web_search_20250305", name: "web_search" }],
            system: "Search for today's MLB probable starting pitchers and return ONLY a JSON object. No markdown. No explanation.",
            messages: [{ role: "user", content: pitcherPrompt }],
          }),
        }).catch(() => null),
      ]);

      // Parse briefing
      if (bRes && bRes.ok) {
        try {
          const bData = await bRes.json();
          dailyBriefing = (bData.content || []).filter(b => b.type === "text").map(b => b.text).join("").trim();
        } catch (_) {}
      }

      // Parse pitchers
      if (pRes && pRes.ok) {
        try {
          const pData = await pRes.json();
          const pText = (pData.content || []).filter(b => b.type === "text").map(b => b.text).join("").trim();
          const cleaned = pText.replace(/\`\`\`json|\`\`\`/gi, "").trim();
          const s = cleaned.indexOf("{"), e = cleaned.lastIndexOf("}");
          if (s !== -1 && e > s) {
            const parsed = JSON.parse(cleaned.slice(s, e + 1));
            for (const [team, pitcher] of Object.entries(parsed)) {
              pitcherMap2[team.toLowerCase()] = pitcher;
            }
          }
        } catch (_) {}
      }
    }

    // Step 6: enrich and return
    const enriched = oddsData.map((event, i) => {
      const summary = gameSummaries[i];

      // Build per-book odds for line shopping display
      const bookOdds = {};
      const bookKeys = { draftkings: "DK", fanduel: "FD", betmgm: "MGM", caesars: "CZS", thescore: "SCR" };
      for (const book of (event.bookmakers || [])) {
        const abbr = bookKeys[book.key];
        if (!abbr) continue;
        const entry = { ml: null, rl: null, over: null, under: null };
        for (const mkt of (book.markets || [])) {
          if (mkt.key === "h2h") {
            for (const o of mkt.outcomes) {
              if (o.name === event.home_team) entry.homeML = o.price;
              else entry.awayML = o.price;
            }
          }
          if (mkt.key === "spreads") {
            for (const o of mkt.outcomes) {
              if (o.name === event.home_team && o.point === -1.5) entry.homeRL = o.price;
              if (o.name === event.away_team && o.point === 1.5) entry.awayRL = o.price;
            }
          }
          if (mkt.key === "totals") {
            for (const o of mkt.outcomes) {
              if (o.name === "Over") entry.over = o.price;
              if (o.name === "Under") entry.under = o.price;
            }
          }
        }
        bookOdds[abbr] = entry;
      }

      return {
        ...event,
        homeStreak: summary.homeStreak,
        awayStreak: summary.awayStreak,
        weather: summary.weather,
        pitchers: summary.pitchers,
        aiAnalysis: analysisMap[String(i + 1)] || null,
        bookOdds,
      };
    });

    // Step 7: fetch alt lines for top 5 value games (saves API quota)
    const topGames = enriched
      .filter(e => e.homeStreak || e.awayStreak) // has data
      .slice(0, 5); // limit to 5 games

    const altLinesMap = {};
    await Promise.all(topGames.map(async (event) => {
      try {
        const altUrl = `https://api.the-odds-api.com/v4/sports/baseball_mlb/events/${event.id}/odds?regions=us&markets=alternate_spreads,alternate_totals&oddsFormat=american&bookmakers=draftkings,fanduel&apiKey=${API_KEY}`;
        const altRes = await fetch(altUrl);
        if (!altRes.ok) return;
        const altData = await altRes.json();

        const altLines = { spreads: [], totals: [] };

        for (const book of (altData.bookmakers || [])) {
          for (const mkt of (book.markets || [])) {
            if (mkt.key === "alternate_spreads") {
              for (const o of mkt.outcomes) {
                if (o.name === event.home_team) {
                  altLines.spreads.push({ point: o.point, price: o.price, book: book.key });
                }
              }
            }
            if (mkt.key === "alternate_totals") {
              for (const o of mkt.outcomes) {
                if (o.name === "Over") {
                  altLines.totals.push({ point: o.point, price: o.price, book: book.key });
                }
              }
            }
          }
        }

        // Detect mispriced ladder — each 0.5 point should cost ~15 cents of juice
        // Flag when a closer-to-standard line is cheaper than it should be
        const mispriced = [];

        // Sort spreads by point (ascending = more favorable for home)
        const spreads = altLines.spreads.sort((a, b) => b.point - a.point);
        for (let i = 0; i < spreads.length - 1; i++) {
          const curr = spreads[i], next = spreads[i + 1];
          const pointDiff = Math.abs(curr.point - next.point);
          const priceDiff = curr.price - next.price; // positive = curr is better
          const expectedCost = pointDiff * 15; // ~15 cents per half point
          if (priceDiff < expectedCost * 0.5) { // paying less than half expected
            mispriced.push({
              type: "SPREAD",
              line: `${next.point > 0 ? "+" : ""}${next.point}`,
              price: next.price,
              vs: `${curr.point > 0 ? "+" : ""}${curr.point} at ${curr.price > 0 ? "+" : ""}${curr.price}`,
              savings: Math.round(expectedCost - priceDiff),
              book: next.book,
            });
          }
        }

        // Sort totals by point (descending = over is harder to hit)
        const totals = altLines.totals.sort((a, b) => a.point - b.point);
        for (let i = 0; i < totals.length - 1; i++) {
          const curr = totals[i], next = totals[i + 1];
          const pointDiff = Math.abs(next.point - curr.point);
          const priceDiff = next.price - curr.price;
          const expectedCost = pointDiff * 12;
          if (priceDiff < expectedCost * 0.5) {
            mispriced.push({
              type: "TOTAL",
              line: `Over ${next.point}`,
              price: next.price,
              vs: `Over ${curr.point} at ${curr.price > 0 ? "+" : ""}${curr.price}`,
              savings: Math.round(expectedCost - priceDiff),
              book: next.book,
            });
          }
        }

        altLinesMap[event.id] = { spreads: altLines.spreads, totals: altLines.totals, mispriced };
      } catch (_) {}
    }));

    // Attach alt lines to enriched games
    const finalGames = enriched.map(e => ({
      ...e,
      altLines: altLinesMap[e.id] || null,
    }));

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json", "x-requests-remaining": remaining || "" },
      body: JSON.stringify({ games: finalGames, briefing: dailyBriefing }),
    };

  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};

// ── STREAK CALCULATOR ─────────────────────────────────────────────────────────
function buildStreakMap(scoresData) {
  const teamGames = {};
  for (const game of (scoresData || [])) {
    if (!game.completed || !game.scores) continue;
    const home = game.home_team, away = game.away_team;
    let homeScore = null, awayScore = null;
    for (const s of game.scores) {
      if (s.name === home) homeScore = parseInt(s.score);
      if (s.name === away) awayScore = parseInt(s.score);
    }
    if (homeScore === null || awayScore === null) continue;
    const homeWon = homeScore > awayScore;
    if (!teamGames[home]) teamGames[home] = [];
    if (!teamGames[away]) teamGames[away] = [];
    teamGames[home].push({ date: game.commence_time, won: homeWon });
    teamGames[away].push({ date: game.commence_time, won: !homeWon });
  }

  const normalize = name => name.toLowerCase().replace(/[^a-z]/g, '');
  const fuzzyLookup = {};
  for (const team of Object.keys(teamGames)) {
    fuzzyLookup[normalize(team)] = team;
    const lastWord = team.split(' ').pop().toLowerCase();
    if (!fuzzyLookup[lastWord]) fuzzyLookup[lastWord] = team;
  }

  const streakMap = {};
  for (const [team, games] of Object.entries(teamGames)) {
    games.sort((a, b) => new Date(b.date) - new Date(a.date));
    const last5 = games.slice(0, 5).map(g => g.won ? "W" : "L");
    let streak = 0, streakType = null;
    if (games.length > 0) {
      streakType = games[0].won ? "W" : "L";
      for (const g of games) {
        if ((g.won && streakType === "W") || (!g.won && streakType === "L")) streak++;
        else break;
      }
    }
    streakMap[team] = { streak, type: streakType, last5 };
  }

  return { streakMap, fuzzyLookup, normalize };
}
