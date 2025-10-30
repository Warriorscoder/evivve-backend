import { Server, Socket } from "socket.io";
import {
  addOnlinePlayer,
  removeOnlinePlayer,
  getOnlineCount,
  getGridState,
  updateGridCell,
  markPlayerSubmitted,
  hasPlayerSubmitted,
} from "../services/redisService.ts";

// ✅ Track active socket connections per playerId
const playerConnections = new Map<string, Set<string>>();

export function registerSocketHandlers(io: Server) {
  io.on("connection", async (socket: Socket) => {
    const playerId = socket.handshake.query.playerId as string;

    if (!playerId) {
      console.log("❌ Connection without playerId, disconnecting");
      socket.disconnect();
      return;
    }

    // ✅ Track sockets for this player
    if (!playerConnections.has(playerId)) {
      playerConnections.set(playerId, new Set());
    }
    playerConnections.get(playerId)!.add(socket.id);

    const connectionCount = playerConnections.get(playerId)!.size;
    console.log(`🟢 Player connected: ${playerId} (connections: ${connectionCount})`);

    // ✅ Only add to Redis if this is the first tab for this player
    if (connectionCount === 1) {
      await addOnlinePlayer(playerId);
      const count = await getOnlineCount();
      io.emit("player_count", { onlineCount: count });
      console.log(`✅ Player ${playerId} added to online list`);
    } else {
      console.log(`ℹ️ Player ${playerId} opened another tab`);
    }

    // ✅ Always check submission status from Redis immediately
    const alreadySubmitted = await hasPlayerSubmitted(playerId);
    const grid = await getGridState();
    const onlineCount = await getOnlineCount();
    console.log(`Player ${playerId} submission status: ${alreadySubmitted}`);
    // ✅ Send initial data (including submission status)
    socket.emit("init", {
      playerId,
      grid,
      onlineCount,
      submitted: alreadySubmitted,
    });

    // 🔒 If the player has already submitted, lock this new tab immediately
    if (alreadySubmitted) {
      socket.emit("submission_locked");
    }

    // ✅ Handle placing character
    socket.on("place_char", async (data) => {
      const { row, col, char } = data;
      if (!char || row == null || col == null) return;

      const submitted = await hasPlayerSubmitted(playerId);
      if (submitted) {
        // 🔒 Immediately reject any further submissions
        socket.emit("error_msg", {
          message: "You have already submitted a character!",
        });
        socket.emit("submission_locked");
        return;
      }

      const success = await updateGridCell(row, col, char);
      if (!success) {
        socket.emit("error_msg", { message: "Cell already taken!" });
        return;
      }

      await markPlayerSubmitted(playerId);
      io.emit("cell_update", { row, col, char });

      // 🔥 Notify all sockets (including future ones) that the player is locked
      const sockets = playerConnections.get(playerId);
      if (sockets) {
        sockets.forEach((sid) => {
          io.to(sid).emit("submission_locked");
        });
      }
    });

    // ✅ Handle disconnect
    socket.on("disconnect", async () => {
      const sockets = playerConnections.get(playerId);
      if (!sockets) return;

      sockets.delete(socket.id);
      const remaining = sockets.size;

      if (remaining === 0) {
        playerConnections.delete(playerId);
        await removeOnlinePlayer(playerId);
        const count = await getOnlineCount();
        io.emit("player_count", { onlineCount: count });
        console.log(`🔴 Player disconnected fully: ${playerId}`);
      } else {
        console.log(`🟡 Player ${playerId} closed a tab (${remaining} remaining)`);
      }
    });
  });
}
