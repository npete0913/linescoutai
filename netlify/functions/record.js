// Record tracking using Netlify Blobs (built-in, no npm package needed in newer Netlify)
// Falls back to environment-based storage if blobs unavailable

exports.handler = async (event) => {
  const method = event.httpMethod;

  let store;
  try {
    const blobs = require("@netlify/blobs");
    store = blobs.getStore("picks");
  } catch (e) {
    // Blobs not available in this deploy context
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ picks: [], record: { overall: {w:0,l:0,p:0}, runLine: {w:0,l:0,p:0}, over: {w:0,l:0,p:0} } }),
    };
  }

  if (method === "GET") {
    try {
      const raw = await store.get("all_picks");
      const picks = raw ? JSON.parse(raw) : [];
      const record = { overall:{w:0,l:0,p:0}, runLine:{w:0,l:0,p:0}, over:{w:0,l:0,p:0} };
      for (const pick of picks) {
        const key = pick.type === "RUN LINE" ? "runLine" : "over";
        if (pick.result === "W") { record.overall.w++; record[key].w++; }
        else if (pick.result === "L") { record.overall.l++; record[key].l++; }
        else { record.overall.p++; record[key].p++; }
      }
      return { statusCode: 200, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ picks, record }) };
    } catch (err) {
      return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
    }
  }

  if (method === "POST") {
    try {
      const { plays } = JSON.parse(event.body);
      const raw = await store.get("all_picks").catch(() => null);
      const existing = raw ? JSON.parse(raw) : [];
      const today = new Date().toISOString().split("T")[0];
      const filtered = existing.filter(p => p.date !== today);
      const newPicks = plays.map(play => ({
        id: `${today}_${play.bet.replace(/\s+/g,"_")}`,
        date: today, bet: play.bet, type: play.type,
        team: play.team, odds: play.odds, confidence: play.confidence,
        result: "P", gameTime: play.time, savedAt: new Date().toISOString(),
      }));
      await store.set("all_picks", JSON.stringify([...filtered, ...newPicks]));
      return { statusCode: 200, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ saved: newPicks.length }) };
    } catch (err) {
      return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
    }
  }

  if (method === "PUT") {
    const API_KEY = process.env.ODDS_API_KEY;
    if (!API_KEY) return { statusCode: 500, body: JSON.stringify({ error: "No API key" }) };
    try {
      const raw = await store.get("all_picks").catch(() => null);
      const picks = raw ? JSON.parse(raw) : [];
      const scoresRes = await fetch(`https://api.the-odds-api.com/v4/sports/baseball_mlb/scores?daysFrom=3&apiKey=${API_KEY}`);
      const scores = scoresRes.ok ? await scoresRes.json() : [];
      let graded = 0;
      const updated = picks.map(pick => {
        if (pick.result !== "P") return pick;
        const game = scores.find(s => s.completed && s.scores &&
          new Date(s.commence_time).toISOString().split("T")[0] === pick.date &&
          (s.home_team.includes(pick.team) || s.away_team.includes(pick.team) ||
           pick.team.includes(s.home_team.split(" ").pop()) ||
           pick.team.includes(s.away_team.split(" ").pop())));
        if (!game?.scores) return pick;
        const homeScore = parseInt(game.scores.find(s => s.name === game.home_team)?.score || 0);
        const awayScore = parseInt(game.scores.find(s => s.name === game.away_team)?.score || 0);
        const homeWon = homeScore > awayScore;
        const homeIsTeam = game.home_team.includes(pick.team) || pick.team.includes(game.home_team.split(" ").pop());
        const favWon = homeIsTeam ? homeWon : !homeWon;
        const margin = Math.abs(homeScore - awayScore);
        let result = "P";
        if (pick.type === "RUN LINE") result = (favWon && margin >= 2) ? "W" : "L";
        else if (pick.type === "OVER") {
          const line = parseFloat(pick.bet.replace("Over ", ""));
          result = (homeScore + awayScore) > line ? "W" : "L";
        }
        if (result !== "P") graded++;
        return { ...pick, result, finalScore: `${awayScore}-${homeScore}` };
      });
      await store.set("all_picks", JSON.stringify(updated));
      return { statusCode: 200, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ graded }) };
    } catch (err) {
      return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
    }
  }

  return { statusCode: 405, body: "Method not allowed" };
};
