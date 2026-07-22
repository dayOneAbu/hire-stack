"use client";

import { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc/client";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import type { BoardApplication } from "./KanbanCard";

const TYPING_IDLE_MS = 3000;

export function MessagesDialog({
  app,
  onClose,
}: {
  app: BoardApplication | null;
  onClose: () => void;
}) {
  const utils = trpc.useUtils();
  const { data: session } = authClient.useSession();
  const [draft, setDraft] = useState("");
  const [otherTyping, setOtherTyping] = useState(false);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const canMessage = app !== null && app.currentStage !== "INBOX";

  const messages = trpc.messages.list.useQuery(
    { applicationId: app?.id ?? "" },
    { enabled: canMessage },
  );
  const markRead = trpc.messages.markRead.useMutation();
  const send = trpc.messages.send.useMutation({
    onSuccess: () => {
      utils.messages.list.invalidate({ applicationId: app?.id ?? "" });
      setDraft("");
    },
  });
  const typing = trpc.messages.typing.useMutation();

  useEffect(() => {
    if (canMessage && app && messages.data?.length) markRead.mutate({ applicationId: app.id });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [app?.id, canMessage, messages.data?.length]);

  useEffect(() => {
    setOtherTyping(false);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
  }, [app?.id]);

  trpc.messages.onMessage.useSubscription(
    { applicationId: app?.id ?? "" },
    {
      enabled: canMessage,
      onData: (event) => {
        const data = "data" in event ? event.data : event;
        if (data.type === "typing") {
          if (data.userId === session?.user.id) return;
          setOtherTyping(true);
          if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
          typingTimeoutRef.current = setTimeout(() => setOtherTyping(false), TYPING_IDLE_MS);
          return;
        }
        if (data.type === "message" && data.message.senderId !== session?.user.id) {
          setOtherTyping(false);
          if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        }
        utils.messages.list.invalidate({ applicationId: app?.id ?? "" });
      },
    },
  );

  function handleDraftChange(value: string) {
    setDraft(value);
    if (canMessage && app) typing.mutate({ applicationId: app.id });
  }

  return (
    <Dialog
      open={app !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{app ? `${app.candidate.firstName} ${app.candidate.lastName}` : ""}</DialogTitle>
          <DialogDescription>Visible to your whole workspace and the candidate.</DialogDescription>
        </DialogHeader>

        {!canMessage ? (
          <p className="text-sm text-muted-foreground">
            Move this candidate out of Inbox to start messaging them.
          </p>
        ) : (
          <>
            <div className="max-h-64 space-y-2 overflow-y-auto">
              {messages.data?.length ? (
                (() => {
                  const lastOwnMessageId = [...messages.data].reverse().find((m) => m.senderId === session?.user.id)?.id;
                  return messages.data.map((m) => (
                    <div key={m.id} className={cn("flex flex-col", m.senderId === session?.user.id ? "items-end" : "items-start")}>
                      <p
                        className={cn(
                          "max-w-[80%] rounded-lg px-3 py-2 text-sm wrap-break-word whitespace-pre-wrap",
                          m.senderId === session?.user.id
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-foreground",
                        )}
                      >
                        {m.content}
                      </p>
                      {m.id === lastOwnMessageId && m.readAt && (
                        <span className="mt-0.5 text-xs text-muted-foreground">Seen</span>
                      )}
                    </div>
                  ));
                })()
              ) : (
                <p className="text-sm text-muted-foreground">No messages yet.</p>
              )}
              {otherTyping && <p className="text-xs text-muted-foreground">Typing…</p>}
            </div>

            <div className="flex gap-2">
              <Textarea
                placeholder="Write a message…"
                value={draft}
                onChange={(e) => handleDraftChange(e.target.value)}
                rows={2}
                className="flex-1"
              />
              <Button
                disabled={!draft.trim() || send.isPending}
                onClick={() => app && send.mutate({ applicationId: app.id, content: draft })}
              >
                Send
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
