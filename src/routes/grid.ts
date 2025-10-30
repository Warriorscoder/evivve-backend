import pkg from 'express';
const { Router} = pkg;
import { getGridState } from "../services/redisService.js";

const router = Router();

// Returns current grid state
router.get("/", async (_req, res) => {
  try {
    const grid = await getGridState();
    res.json({ grid });
  } catch (error) {
    console.error("Error fetching grid:", error);
    res.status(500).json({ error: "Failed to load grid" });
  }
});

export default router;
