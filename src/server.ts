// src/server.ts
import express from "express";
import http from "http";
import cors from "cors";
import { Server as SocketIOServer } from "socket.io";
import { registerSocketHandlers } from "./socket/socketHandler.js";
import healthRouter from "./routes/health.js";
import gridRouter from "./routes/grid.js";
import dotenv from "dotenv";

dotenv.config();

export async function createServer() {
  // 1. Initialize Express app
  const app = express();

  // 2. Basic middleware
  app.use(cors());
  app.use(express.json());

  // 3. Basic routes (REST)
  app.use("/", healthRouter);
  app.use("/grid", gridRouter);

  // 4. Create HTTP server and attach Socket.IO
  const httpServer = http.createServer(app);

  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: '*', 
    },
  });

  // 5. Register socket event handlers
  registerSocketHandlers(io);

  // 6. Return so index.ts can start listening
  return { app, io, httpServer };
}
