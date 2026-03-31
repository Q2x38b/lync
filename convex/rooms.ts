import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

function generateRoomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export const createRoom = mutation({
  args: {
    name: v.string(),
    maxParticipants: v.number(),
    isLocked: v.boolean(),
    password: v.optional(v.string()),
    allowChat: v.optional(v.boolean()),
    allowScreenShare: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    let code = generateRoomCode();

    // Ensure unique code
    let existing = await ctx.db
      .query("rooms")
      .withIndex("by_code", (q) => q.eq("code", code))
      .first();

    while (existing) {
      code = generateRoomCode();
      existing = await ctx.db
        .query("rooms")
        .withIndex("by_code", (q) => q.eq("code", code))
        .first();
    }

    const roomId = await ctx.db.insert("rooms", {
      code,
      name: args.name,
      createdAt: Date.now(),
      maxParticipants: args.maxParticipants,
      isLocked: args.isLocked,
      password: args.password || undefined,
      allowChat: args.allowChat ?? true,
      allowScreenShare: args.allowScreenShare ?? true,
    });

    return { roomId, code };
  },
});

export const getRoomByCode = query({
  args: { code: v.string() },
  handler: async (ctx, args) => {
    const room = await ctx.db
      .query("rooms")
      .withIndex("by_code", (q) => q.eq("code", args.code.toUpperCase()))
      .first();

    if (!room) return null;

    // Return room info without the actual password, just whether it's protected
    return {
      ...room,
      password: undefined,
      hasPassword: !!room.password,
    };
  },
});

export const verifyRoomPassword = query({
  args: { code: v.string(), password: v.string() },
  handler: async (ctx, args) => {
    const room = await ctx.db
      .query("rooms")
      .withIndex("by_code", (q) => q.eq("code", args.code.toUpperCase()))
      .first();

    if (!room) return { valid: false, error: "Room not found" };
    if (!room.password) return { valid: true };

    return { valid: room.password === args.password };
  },
});

export const getRoom = query({
  args: { roomId: v.id("rooms") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.roomId);
  },
});

export const deleteRoom = mutation({
  args: { roomId: v.id("rooms") },
  handler: async (ctx, args) => {
    // Delete all participants
    const participants = await ctx.db
      .query("participants")
      .withIndex("by_room", (q) => q.eq("roomId", args.roomId))
      .collect();
    for (const p of participants) {
      await ctx.db.delete(p._id);
    }

    // Delete all signals
    const signals = await ctx.db
      .query("signals")
      .withIndex("by_room", (q) => q.eq("roomId", args.roomId))
      .collect();
    for (const s of signals) {
      await ctx.db.delete(s._id);
    }

    // Delete all messages
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_room", (q) => q.eq("roomId", args.roomId))
      .collect();
    for (const m of messages) {
      await ctx.db.delete(m._id);
    }

    // Delete the room
    await ctx.db.delete(args.roomId);
  },
});

export const joinRoom = mutation({
  args: {
    roomId: v.id("rooms"),
    peerId: v.string(),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const room = await ctx.db.get(args.roomId);
    if (!room) throw new Error("Room not found");

    const now = Date.now();
    const staleThreshold = now - 60 * 1000; // 60 seconds

    // Get all participants and clean up stale ones
    const participants = await ctx.db
      .query("participants")
      .withIndex("by_room", (q) => q.eq("roomId", args.roomId))
      .collect();

    // Remove stale participants (no heartbeat for 60 seconds)
    // Use lastSeen if available, otherwise fall back to joinedAt
    const staleParticipants = participants.filter(p => {
      const lastActivity = p.lastSeen ?? p.joinedAt;
      return lastActivity < staleThreshold;
    });
    for (const p of staleParticipants) {
      await ctx.db.delete(p._id);
    }

    // Get active participants count
    const activeParticipants = participants.filter(p => {
      const lastActivity = p.lastSeen ?? p.joinedAt;
      return lastActivity >= staleThreshold;
    });

    if (activeParticipants.length >= room.maxParticipants) {
      throw new Error("Room is full");
    }

    // Check if already in room
    const existing = await ctx.db
      .query("participants")
      .withIndex("by_peer", (q) => q.eq("peerId", args.peerId))
      .first();

    if (existing) {
      // Update lastSeen for existing participant
      await ctx.db.patch(existing._id, { lastSeen: now });
      return existing._id;
    }

    // First active person to join is the host
    const isHost = activeParticipants.length === 0;

    return await ctx.db.insert("participants", {
      roomId: args.roomId,
      peerId: args.peerId,
      name: args.name,
      joinedAt: now,
      lastSeen: now,
      isMuted: false,
      isVideoOff: false,
      isHost,
    });
  },
});

// Heartbeat to update lastSeen - call this every 15 seconds from client
export const heartbeat = mutation({
  args: { peerId: v.string() },
  handler: async (ctx, args) => {
    const participant = await ctx.db
      .query("participants")
      .withIndex("by_peer", (q) => q.eq("peerId", args.peerId))
      .first();

    if (participant) {
      await ctx.db.patch(participant._id, { lastSeen: Date.now() });
    }
  },
});

// Helper to clean up stale participants and check if room should be deleted
// Stale = no heartbeat for 60 seconds
async function cleanupStaleAndCheckRoom(ctx: any, roomId: any) {
  const staleThreshold = Date.now() - 60 * 1000; // 60 seconds

  // Get all participants
  const participants = await ctx.db
    .query("participants")
    .withIndex("by_room", (q: any) => q.eq("roomId", roomId))
    .collect();

  // Delete stale participants (use lastSeen if available, otherwise joinedAt)
  for (const p of participants) {
    const lastActivity = p.lastSeen ?? p.joinedAt;
    if (lastActivity < staleThreshold) {
      await ctx.db.delete(p._id);
    }
  }

  // Re-query to get remaining active participants
  const remaining = await ctx.db
    .query("participants")
    .withIndex("by_room", (q: any) => q.eq("roomId", roomId))
    .collect();

  // If no active participants, clean up room
  if (remaining.length === 0) {
    // Delete all signals
    const signals = await ctx.db
      .query("signals")
      .withIndex("by_room", (q: any) => q.eq("roomId", roomId))
      .collect();
    for (const s of signals) {
      await ctx.db.delete(s._id);
    }

    // Delete all messages
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_room", (q: any) => q.eq("roomId", roomId))
      .collect();
    for (const m of messages) {
      await ctx.db.delete(m._id);
    }

    // Delete room
    const room = await ctx.db.get(roomId);
    if (room) {
      await ctx.db.delete(roomId);
    }

    return true; // Room was deleted
  }

  return false; // Room still has active participants
}

export const leaveRoom = mutation({
  args: { peerId: v.string() },
  handler: async (ctx, args) => {
    const participant = await ctx.db
      .query("participants")
      .withIndex("by_peer", (q) => q.eq("peerId", args.peerId))
      .first();

    if (!participant) return;

    const roomId = participant.roomId;
    await ctx.db.delete(participant._id);

    // Delete signals from/to this peer
    const signals = await ctx.db
      .query("signals")
      .withIndex("by_room", (q) => q.eq("roomId", roomId))
      .collect();

    for (const s of signals) {
      if (s.from === args.peerId || s.to === args.peerId) {
        await ctx.db.delete(s._id);
      }
    }

    // Clean up stale participants and check if room should be deleted
    await cleanupStaleAndCheckRoom(ctx, roomId);
  },
});

export const getParticipants = query({
  args: { roomId: v.id("rooms") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("participants")
      .withIndex("by_room", (q) => q.eq("roomId", args.roomId))
      .collect();
  },
});

export const updateParticipant = mutation({
  args: {
    peerId: v.string(),
    isMuted: v.optional(v.boolean()),
    isVideoOff: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const participant = await ctx.db
      .query("participants")
      .withIndex("by_peer", (q) => q.eq("peerId", args.peerId))
      .first();

    if (!participant) return;

    const updates: { isMuted?: boolean; isVideoOff?: boolean } = {};
    if (args.isMuted !== undefined) updates.isMuted = args.isMuted;
    if (args.isVideoOff !== undefined) updates.isVideoOff = args.isVideoOff;

    await ctx.db.patch(participant._id, updates);
  },
});

// Clean up stale participants (no heartbeat for 60 seconds)
// Also cleans up empty rooms
export const cleanupStaleParticipants = mutation({
  args: { roomId: v.optional(v.id("rooms")) },
  handler: async (ctx, args) => {
    const staleThreshold = Date.now() - 60 * 1000; // 60 seconds
    let deleted = 0;
    const roomsToCheck = new Set<string>();

    if (args.roomId) {
      // Clean specific room
      const roomId = args.roomId;
      const participants = await ctx.db
        .query("participants")
        .withIndex("by_room", (q) => q.eq("roomId", roomId))
        .collect();

      for (const p of participants) {
        const lastActivity = p.lastSeen ?? p.joinedAt;
        if (lastActivity < staleThreshold) {
          await ctx.db.delete(p._id);
          deleted++;
          roomsToCheck.add(roomId);
        }
      }
    } else {
      // Clean all rooms
      const allParticipants = await ctx.db.query("participants").collect();

      for (const p of allParticipants) {
        const lastActivity = p.lastSeen ?? p.joinedAt;
        if (lastActivity < staleThreshold) {
          await ctx.db.delete(p._id);
          deleted++;
          roomsToCheck.add(p.roomId);
        }
      }
    }

    // Check and clean up empty rooms
    let roomsDeleted = 0;
    for (const roomId of roomsToCheck) {
      const remaining = await ctx.db
        .query("participants")
        .withIndex("by_room", (q) => q.eq("roomId", roomId as any))
        .collect();

      if (remaining.length === 0) {
        // Delete signals
        const signals = await ctx.db
          .query("signals")
          .withIndex("by_room", (q) => q.eq("roomId", roomId as any))
          .collect();
        for (const s of signals) {
          await ctx.db.delete(s._id);
        }

        // Delete messages
        const messages = await ctx.db
          .query("messages")
          .withIndex("by_room", (q) => q.eq("roomId", roomId as any))
          .collect();
        for (const m of messages) {
          await ctx.db.delete(m._id);
        }

        // Delete room
        const room = await ctx.db.get(roomId as any);
        if (room) {
          await ctx.db.delete(roomId as any);
          roomsDeleted++;
        }
      }
    }

    return { participantsDeleted: deleted, roomsDeleted };
  },
});

// Force remove a specific participant (for admin cleanup)
export const forceRemoveParticipant = mutation({
  args: { peerId: v.string() },
  handler: async (ctx, args) => {
    const participant = await ctx.db
      .query("participants")
      .withIndex("by_peer", (q) => q.eq("peerId", args.peerId))
      .first();

    if (participant) {
      await ctx.db.delete(participant._id);
      return true;
    }
    return false;
  },
});

// Clear all participants from a room (for reset)
export const clearRoomParticipants = mutation({
  args: { roomId: v.id("rooms") },
  handler: async (ctx, args) => {
    const participants = await ctx.db
      .query("participants")
      .withIndex("by_room", (q) => q.eq("roomId", args.roomId))
      .collect();

    for (const p of participants) {
      await ctx.db.delete(p._id);
    }

    // Also clear signals for this room
    const signals = await ctx.db
      .query("signals")
      .withIndex("by_room", (q) => q.eq("roomId", args.roomId))
      .collect();

    for (const s of signals) {
      await ctx.db.delete(s._id);
    }

    return { participantsDeleted: participants.length, signalsDeleted: signals.length };
  },
});
