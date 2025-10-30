// src/index.ts
import dotenv from "dotenv";
import { createServer } from "./server.ts";

dotenv.config();

const PORT = process.env.PORT || 4000;

async function start() {
  try {
    const { httpServer } = await createServer();
    httpServer.listen(PORT, () => {
      console.log(`✅ Server running on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error("❌ Failed to start server:", err);
    process.exit(1);
  }
}

start();
