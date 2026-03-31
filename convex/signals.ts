import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Simple signal insert - no server-side cleanup on every insert
// Client handles TTL filtering, server does periodic cleanup
export const sendSignal = mutation({
  args: {
    roomId: v.id("rooms"),
    from: v.string(),
    to: v.string(),
    signal: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("signals", {
      roomId: args.roomId,
      from: args.from,
      to: args.to,
      signal: args.signal,
      timestamp: Date.now(),
    });
  },
});

// Simple query - returns all signals, client filters by timestamp
export const getSignals = query({
  args: { peerId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("signals")
      .withIndex("by_to", (q) => q.eq("to", args.peerId))
      .collect();
  },
});

// Batch consume multiple signals at once - more efficient
export const consumeSignals = mutation({
  args: { signalIds: v.array(v.id("signals")) },
  handler: async (ctx, args) => {
    for (const id of args.signalIds) {
      const signal = await ctx.db.get(id);
      if (signal) {
        await ctx.db.delete(id);
      }
    }
  },
});

// Legacy single consume - kept for compatibility
export const consumeSignal = mutation({
  args: { signalId: v.id("signals") },
  handler: async (ctx, args) => {
    const signal = await ctx.db.get(args.signalId);
    if (signal) {
      await ctx.db.delete(args.signalId);
    }
  },
});

export const clearSignals = mutation({
  args: { peerId: v.string() },
  handler: async (ctx, args) => {
    const signals = await ctx.db
      .query("signals")
      .withIndex("by_to", (q) => q.eq("to", args.peerId))
      .collect();

    for (const s of signals) {
      await ctx.db.delete(s._id);
    }
  },
});

// Periodic cleanup - call this occasionally (e.g., on room join/leave)
// Signals older than 60 seconds are definitely stale
export const cleanupStaleSignals = mutation({
  args: { roomId: v.optional(v.id("rooms")) },
  handler: async (ctx, args) => {
    const staleThreshold = Date.now() - 60 * 1000;
    let deleted = 0;

    if (args.roomId) {
      const roomId = args.roomId;
      const signals = await ctx.db
        .query("signals")
        .withIndex("by_room", (q) => q.eq("roomId", roomId))
        .collect();

      for (const s of signals) {
        if (s.timestamp < staleThreshold) {
          await ctx.db.delete(s._id);
          deleted++;
        }
      }
    } else {
      const allSignals = await ctx.db.query("signals").collect();
      for (const s of allSignals) {
        if (s.timestamp < staleThreshold) {
          await ctx.db.delete(s._id);
          deleted++;
        }
      }
    }

    return { deleted };
  },
});
