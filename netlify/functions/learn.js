// Line Scout AI — Learning/Postmortem function
// Grades yesterday's scans against actual results to build signal accuracy history

const { getStore } = require("@netlify/blobs");

exports.handler = async (event) => {
  const API_KEY = process.env.ODDS_API_KEY;
  if (!API_KEY) return { statusCode: 500, body: JSON.stringify({ error: "Odds API key not configured" }) };

  const method = event.httpMethod;
  const store = getStore({ name: "linescoutai", consistency: "strong" });

  // ──────────────────────────────────────────────────────────────────────────
  // POST: Save today's scan snapshot for future grading
  // ──────────────────────────────────────────────────────────────────────────
  if (method === "POST") {
    try {
      const { games } = JSON.parse(event.body);
      const today = new Date().toISOString().split("T")[0];

      // Snapshot just the data we need to grade later
      const snapshot = games.map(g => ({
        home: g.home,
        away: g.away,
        commenceTime: g.commenceTime,
        homeML: g.homeML,
        awayML: g.awayML,
        homeRL: g.homeRL,
        awayRL: g.awayRL,
        total: g.total,
        overOdds: g.overOdds,
        underOdds: g.underOdds,
        flags: g.flags || [],
        totalFlags: g.totalFlags || [],
        signals: [...(g.flags || []), ...(g.totalFlags || [])],
        homeStreak: g.homeStreak,
        awayStreak: g.awayStreak,
        weather: g.weather,
      }));

      await store.set(`scan_${today}`, JSON.stringify(snapshot));

      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ saved: snapshot.length, date: today }),
      };
    } catch (err) {
      return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // PUT: Grade yesterday's snapshot against final scores
  // ──────────────────────────────────────────────────────────────────────────
  if (method === "PUT") {
    try {
      // Get yesterday's date in ET
      const now = new Date();
      const yesterdayET = new Date(now.getTime() - 86400000);
      const dateStr = yesterdayET.toISOString().split("T")[0];

      // Fetch yesterday's scan snapshot
      const raw = await store.get(`scan_${dateStr}`, { type: "text" }).catch(() => null);
      if (!raw) {
        return {
          statusCode: 200,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: "No snapshot found for yesterday", date: dateStr }),
        };
      }

      const snapshot = JSON.parse(raw);

      // Fetch final scores
      const scoresUrl = `https://api.the-odds-api.com/v4/sports/baseball_mlb/scores?daysFrom=3&apiKey=${API_KEY}`;
      const scoresRes = await fetch(scoresUrl);
      const scores = scoresRes.ok ? await scoresRes.json() : [];

      // Match each scanned game to its final score and grade signals
      const gradedGames = [];
      for (const game of snapshot) {
        const result = scores.find(s =>
          s.completed && s.scores &&
          (s.home_team === game.home || s.away_team === game.away)
        );

        if (!result || !result.scores) continue;

        const homeScore = parseInt(result.scores.find(s => s.name === result.home_team)?.score || 0);
        const awayScore = parseInt(result.scores.find(s => s.name === result.away_team)?.score || 0);
        const totalRuns = homeScore + awayScore;
        const homeWon = homeScore > awayScore;
        const margin = Math.abs(homeScore - awayScore);
        const favIsHome = game.homeML !== null && game.awayML !== null && game.homeML < game.awayML;
        const favWon = favIsHome ? homeWon : !homeWon;

        // Grade each signal
        const signalResults = {};
        for (const sig of game.signals) {
          let hit = null;

          if (sig === "RUN LINE VALUE") {
            // Did the favorite cover the -1.5?
            hit = favWon && margin >= 2;
          } else if (sig === "SHORT LINE") {
            // Did the heavy favorite win straight up?
            hit = favWon;
          } else if (sig === "HOT STREAK") {
            // Did the streaking team win?
            const streakingIsHome = game.homeStreak?.type === "W" && game.homeStreak.streak >= 2;
            hit = streakingIsHome ? homeWon : !homeWon;
          } else if (sig === "FADE CANDIDATE") {
            // Did fading the cold team win? (cold team lost)
            const coldIsHome = game.homeStreak?.type === "L" && game.homeStreak.streak >= 3;
            hit = coldIsHome ? !homeWon : homeWon;
          } else if (sig === "OVER VALUE" || sig === "SHARP OVER") {
            hit = game.total !== null && totalRuns > game.total;
          } else if (sig === "LOW TOTAL") {
            hit = game.total !== null && totalRuns < game.total;
          } else if (sig === "WIND OUT") {
            hit = game.total !== null && totalRuns > game.total;
          } else if (sig === "WIND IN") {
            hit = game.total !== null && totalRuns < game.total;
          } else if (sig === "RAIN RISK") {
            hit = game.total !== null && totalRuns < game.total;
          }

          if (hit !== null) signalResults[sig] = hit;
        }

        gradedGames.push({
          date: dateStr,
          away: game.away,
          home: game.home,
          finalScore: `${awayScore}-${homeScore}`,
          totalRuns,
          margin,
          favWon,
          signals: game.signals,
          signalResults,
        });
      }

      // Update signal history aggregate
      const histRaw = await store.get("signal_history", { type: "text" }).catch(() => null);
      const history = histRaw ? JSON.parse(histRaw) : {};

      for (const game of gradedGames) {
        for (const [sig, hit] of Object.entries(game.signalResults)) {
          if (!history[sig]) history[sig] = { w: 0, l: 0, games: [] };
          if (hit) history[sig].w++;
          else history[sig].l++;
          history[sig].games.push({
            date: game.date,
            matchup: `${game.away} @ ${game.home}`,
            score: game.finalScore,
            hit,
          });
          // Keep only last 100 games per signal to limit blob size
          if (history[sig].games.length > 100) history[sig].games.shift();
        }
      }

      // Save graded games for the day
      await store.set(`graded_${dateStr}`, JSON.stringify(gradedGames));
      await store.set("signal_history", JSON.stringify(history));

      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: dateStr,
          gamesGraded: gradedGames.length,
          signalHistory: Object.entries(history).map(([sig, data]) => ({
            signal: sig,
            wins: data.w,
            losses: data.l,
            total: data.w + data.l,
            hitRate: data.w + data.l > 0 ? ((data.w / (data.w + data.l)) * 100).toFixed(1) + "%" : "N/A",
          })),
        }),
      };
    } catch (err) {
      return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // GET: Return signal accuracy history + recent graded games
  // ──────────────────────────────────────────────────────────────────────────
  if (method === "GET") {
    try {
      const histRaw = await store.get("signal_history", { type: "text" }).catch(() => null);
      const history = histRaw ? JSON.parse(histRaw) : {};

      const signalStats = Object.entries(history).map(([sig, data]) => {
        const total = data.w + data.l;
        const recent30 = (data.games || []).slice(-30);
        const recent30W = recent30.filter(g => g.hit).length;
        return {
          signal: sig,
          wins: data.w,
          losses: data.l,
          total,
          hitRate: total > 0 ? ((data.w / total) * 100).toFixed(1) : "0",
          recent30HitRate: recent30.length > 0 ? ((recent30W / recent30.length) * 100).toFixed(1) : "0",
          recent30Count: recent30.length,
        };
      }).sort((a, b) => parseFloat(b.hitRate) - parseFloat(a.hitRate));

      // Get last 7 days of graded games
      const recentGraded = [];
      for (let i = 1; i <= 7; i++) {
        const d = new Date(Date.now() - i * 86400000).toISOString().split("T")[0];
        const raw = await store.get(`graded_${d}`, { type: "text" }).catch(() => null);
        if (raw) recentGraded.push(...JSON.parse(raw));
      }

      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signalStats, recentGraded: recentGraded.slice(0, 30) }),
      };
    } catch (err) {
      return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
    }
  }

  return { statusCode: 405, body: "Method not allowed" };
};
