import { EventEmitter } from "node:events";
import type { Message } from "@prisma/client";

// ponytail: in-process emitter assumes one server instance (true on Render free tier).
// Swap for Postgres LISTEN/NOTIFY (already supported by the `pg` driver) when scaling out.
export const messageEvents = new EventEmitter();

export type MessageEvent =
  | { type: "message"; message: Message }
  | { type: "read"; readerId: string }
  | { type: "typing"; userId: string };

export function emitMessage(message: Message) {
  messageEvents.emit(message.applicationId, { type: "message", message } satisfies MessageEvent);
}

export function emitRead(applicationId: string, readerId: string) {
  messageEvents.emit(applicationId, { type: "read", readerId } satisfies MessageEvent);
}

export function emitTyping(applicationId: string, userId: string) {
  messageEvents.emit(applicationId, { type: "typing", userId } satisfies MessageEvent);
}
