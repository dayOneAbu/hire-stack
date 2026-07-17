import { EventEmitter } from "node:events";
import type { Message } from "@prisma/client";

// ponytail: in-process emitter assumes one server instance (true on Render free tier).
// Swap for Postgres LISTEN/NOTIFY (already supported by the `pg` driver) when scaling out.
export const messageEvents = new EventEmitter();

export function emitMessage(message: Message) {
  messageEvents.emit(message.applicationId, message);
}
