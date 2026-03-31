import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  rooms: defineTable({
    code: v.string(),
    name: v.string(),
    createdAt: v.number(),
    maxParticipants: v.number(),
    isLocked: v.boolean(),
    // Password protection (optional)
    password: v.optional(v.string()),
    // Additional settings
    allowChat: v.optional(v.boolean()),
    allowScreenShare: v.optional(v.boolean()),
  }).index("by_code", ["code"]),

  participants: defineTable({
    roomId: v.id("rooms"),
    peerId: v.string(),
    name: v.string(),
    joinedAt: v.number(),
    lastSeen: v.number(),
    isMuted: v.boolean(),
    isVideoOff: v.boolean(),
    isHost: v.boolean(),
  }).index("by_room", ["roomId"]).index("by_peer", ["peerId"]),

  signals: defineTable({
    roomId: v.id("rooms"),
    from: v.string(),
    to: v.string(),
    signal: v.string(),
    timestamp: v.number(),
  }).index("by_room", ["roomId"]).index("by_to", ["to"]),

  messages: defineTable({
    roomId: v.id("rooms"),
    senderId: v.string(),
    senderName: v.string(),
    content: v.string(),
    timestamp: v.number(),
  }).index("by_room", ["roomId"]),
});
