// Scheduled function: runs daily at 9 AM ET to scan today's lines automatically
// Configured via netlify.toml schedule

const { schedule } = require("@netlify/functions");

const handler = async (event) => {
  console.log("Scheduled scan starting at", new Date().toISOString());

  try {
    // Call our own odds function to trigger a scan + snapshot
    const baseUrl = process.env.URL || "https://linescoutai.com";
    const scanRes = await fetch(`${baseUrl}/.netlify/functions/odds?which=today`);

    if (!scanRes.ok) {
      console.error("Scan failed:", scanRes.status);
      return { statusCode: 500, body: "Scan failed" };
    }

    const data = await scanRes.json();
    const games = data.games || [];
    console.log(`Scanned ${games.length} games`);

    // Save snapshot for learning
    if (games.length > 0) {
      const learnRes = await fetch(`${baseUrl}/.netlify/functions/learn`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ games }),
      });
      console.log("Snapshot saved:", learnRes.status);
    }

    // Grade yesterday's results
    const gradeRes = await fetch(`${baseUrl}/.netlify/functions/learn`, { method: "PUT" });
    const gradeData = await gradeRes.json();
    console.log("Yesterday graded:", JSON.stringify(gradeData));

    return {
      statusCode: 200,
      body: JSON.stringify({
        scanned: games.length,
        graded: gradeData.gamesGraded || 0,
        date: new Date().toISOString().split("T")[0],
      }),
    };
  } catch (err) {
    console.error("Scheduled scan error:", err);
    return { statusCode: 500, body: err.message };
  }
};

// Run every day at 13:00 UTC (9 AM ET in summer, 8 AM ET in winter)
exports.handler = schedule("0 13 * * *", handler);
