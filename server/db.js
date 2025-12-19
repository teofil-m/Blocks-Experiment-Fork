import pg from "pg";

const { Pool } = pg;

// PostgreSQL connection - requires DATABASE_URL environment variable
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.DATABASE_URL?.includes("localhost") ||
    process.env.DATABASE_URL?.includes("127.0.0.1")
      ? false
      : { rejectUnauthorized: false },
});

// Create matches table
pool
  .query(
    `
  CREATE TABLE IF NOT EXISTS matches (
    id SERIAL PRIMARY KEY,
    whiteName TEXT NOT NULL,
    blackName TEXT NOT NULL,
    winner TEXT NOT NULL,
    matchTime INTEGER NOT NULL,
    whiteNumberOfBlocks INTEGER NOT NULL,
    blackNumberOfBlocks INTEGER NOT NULL,
    matchEndTimestamp TIMESTAMP NOT NULL,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )
`
  )
  .then(() => {
    console.log("PostgreSQL database initialized");
  })
  .catch((err) => {
    console.error("Error initializing PostgreSQL:", err);
    console.error("Make sure DATABASE_URL environment variable is set");
  });

/**
 * Save a match result to the database
 * @param {Object} match - Match data
 * @param {string} match.whiteName - Name of the white player
 * @param {string} match.blackName - Name of the black player
 * @param {string} match.winner - Winner ('white', 'black', or 'draw')
 * @param {number} match.matchTime - Duration of the match in seconds
 * @param {number} match.whiteNumberOfBlocks - Number of blocks white player had
 * @param {number} match.blackNumberOfBlocks - Number of blocks black player had
 * @param {string} match.matchEndTimestamp - ISO timestamp string when the match ended
 * @returns {Object} The inserted match with its ID
 */
export async function saveMatch(match) {
  const query = `
    INSERT INTO matches (
      whiteName, 
      blackName, 
      winner, 
      matchTime, 
      whiteNumberOfBlocks, 
      blackNumberOfBlocks, 
      matchEndTimestamp
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *
  `;

  const values = [
    match.whiteName,
    match.blackName,
    match.winner,
    match.matchTime,
    match.whiteNumberOfBlocks,
    match.blackNumberOfBlocks,
    match.matchEndTimestamp,
  ];

  const result = await pool.query(query, values);
  return result.rows[0];
}

/**
 * Get all matches from the database
 * @param {number} limit - Maximum number of matches to return (default: 100)
 * @returns {Array} Array of match objects
 */
export async function getAllMatches(limit = 100) {
  const query = `
    SELECT * FROM matches 
    ORDER BY matchEndTimestamp DESC 
    LIMIT $1
  `;
  const result = await pool.query(query, [limit]);
  return result.rows;
}

/**
 * Get matches by player name
 * @param {string} playerName - Name of the player
 * @param {number} limit - Maximum number of matches to return (default: 50)
 * @returns {Array} Array of match objects
 */
export async function getMatchesByPlayer(playerName, limit = 50) {
  const query = `
    SELECT * FROM matches 
    WHERE whiteName = $1 OR blackName = $1
    ORDER BY matchEndTimestamp DESC 
    LIMIT $2
  `;
  const result = await pool.query(query, [playerName, limit]);
  return result.rows;
}

/**
 * Get match statistics for a player
 * @param {string} playerName - Name of the player
 * @returns {Object} Statistics object with wins, losses, draws, averages
 */
export async function getPlayerStats(playerName) {
  const query = `
    SELECT 
      COUNT(*)::int as "totalMatches",
      SUM(CASE WHEN winner = 'white' AND whiteName = $1 THEN 1 
               WHEN winner = 'black' AND blackName = $1 THEN 1 
               ELSE 0 END)::int as wins,
      SUM(CASE WHEN winner = 'draw' THEN 1 ELSE 0 END)::int as draws,
      SUM(CASE WHEN winner = 'white' AND blackName = $1 THEN 1 
               WHEN winner = 'black' AND whiteName = $1 THEN 1 
               ELSE 0 END)::int as losses,
      COALESCE(AVG(matchTime), 0)::float as "avgMatchTime",
      COALESCE(AVG(CASE 
        WHEN whiteName = $1 THEN whiteNumberOfBlocks 
        ELSE blackNumberOfBlocks 
      END), 0)::float as "avgBlocks"
    FROM matches
    WHERE whiteName = $1 OR blackName = $1
  `;
  const result = await pool.query(query, [playerName]);
  return result.rows[0];
}

/**
 * Get leaderboard with top players by wins
 * @param {number} limit - Maximum number of players to return (default: 10)
 * @returns {Array} Array of player objects with stats
 */
export async function getLeaderboard(limit = 10) {
  const query = `
    WITH player_names AS (
      SELECT whiteName as playerName FROM matches
      UNION
      SELECT blackName as playerName FROM matches
    ),
    player_stats AS (
      SELECT 
        pn.playerName,
        COUNT(m.id)::int as "totalMatches",
        SUM(CASE 
          WHEN m.winner = 'white' AND m.whiteName = pn.playerName THEN 1 
          WHEN m.winner = 'black' AND m.blackName = pn.playerName THEN 1 
          ELSE 0 
        END)::int as wins,
        SUM(CASE WHEN m.winner = 'draw' THEN 1 ELSE 0 END)::int as draws,
        SUM(CASE 
          WHEN m.winner = 'white' AND m.blackName = pn.playerName THEN 1 
          WHEN m.winner = 'black' AND m.whiteName = pn.playerName THEN 1 
          ELSE 0 
        END)::int as losses
      FROM player_names pn
      LEFT JOIN matches m ON (m.whiteName = pn.playerName OR m.blackName = pn.playerName)
      GROUP BY pn.playerName
    )
    SELECT 
      playerName,
      "totalMatches",
      wins,
      draws,
      losses,
      CASE 
        WHEN "totalMatches" > 0 THEN ROUND(((wins::float / "totalMatches"::float) * 100)::numeric, 1)
        ELSE 0 
      END as "winRate"
    FROM player_stats
    WHERE "totalMatches" > 0
    ORDER BY wins DESC, "winRate" DESC, "totalMatches" DESC
    LIMIT $1
  `;
  const result = await pool.query(query, [limit]);
  return result.rows;
}

export default pool;
