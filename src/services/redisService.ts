// src/services/redisService.ts
import { Redis } from "@upstash/redis";
import { GRID_SIZE } from "../utils/constants.ts";
import dotenv from "dotenv";

// --- Redis client setup ---
dotenv.config();
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// --- Redis keys ---
const GRID_KEY = "grid:state";
const ONLINE_PLAYERS_KEY = "online:players";
const PLAYER_PREFIX = "player:";

// --- Grid Management ---

// Initialize an empty grid (10x10)
async function initializeGrid() {
  const exists = await redis.exists(GRID_KEY);
  if (!exists) {
    const initialGrid: Record<string, string> = {};
    for (let row = 0; row < GRID_SIZE; row++) {
      for (let col = 0; col < GRID_SIZE; col++) {
        initialGrid[`${row},${col}`] = "";
      }
    }
    await redis.hset(GRID_KEY, initialGrid);
    console.log("🧩 Grid initialized in Redis");
  }
}

// Fetch grid from Redis and return as array of { char, userId }
export async function getGridState(): Promise<{ char: string; userId: string | null }[]> {
  let data = (await redis.hgetall<Record<string, string>>(GRID_KEY)) ?? {};

  // If grid doesn't exist or is empty → initialize it
  if (Object.keys(data).length === 0) {
    await initializeGrid();
    data = (await redis.hgetall<Record<string, string>>(GRID_KEY)) ?? {};
  }

  // Convert object like { "0,0": "A", "0,1": "" } into an ordered array
  const gridArray: { char: string; userId: string | null }[] = [];

  for (let row = 0; row < GRID_SIZE; row++) {
    for (let col = 0; col < GRID_SIZE; col++) {
      const key = `${row},${col}`;
      gridArray.push({ char: data[key] || "", userId: null });
    }
  }

  return gridArray;
}


// Update a specific cell if empty (atomic)
export async function updateGridCell(
  row: number,
  col: number,
  char: string
): Promise<boolean> {
  const cellKey = `${row},${col}`;
  const currentValue = await redis.hget<string>(GRID_KEY, cellKey);

  if (currentValue && currentValue.trim() !== "") {
    return false;
  }

  await redis.hset(GRID_KEY, { [cellKey]: char });
  return true;
}

// --- Player Management ---

export async function addOnlinePlayer(playerId: string) {
  await redis.sadd(ONLINE_PLAYERS_KEY, playerId);
}

export async function removeOnlinePlayer(playerId: string) {
  await redis.srem(ONLINE_PLAYERS_KEY, playerId);
  await redis.del(`${PLAYER_PREFIX}${playerId}`);
}

export async function getOnlineCount(): Promise<number> {
  const members = await redis.scard(ONLINE_PLAYERS_KEY);
  console.log("Online members called : ", members);
  return members ?? 0;
}

// --- Submission state per player ---

export async function markPlayerSubmitted(playerId: string) {
  await redis.hset(`${PLAYER_PREFIX}${playerId}`, { has_submitted: "true" });
}

export async function hasPlayerSubmitted(playerId: string): Promise<boolean> {
  const val = await redis.hget(`${PLAYER_PREFIX}${playerId}`, "has_submitted");
  console.log(`Has player ${playerId} submitted called :`, val);
  return String(val).trim().toLowerCase() === "true";
}
