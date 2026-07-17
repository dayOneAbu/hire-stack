"use client";

import { useState, useEffect } from "react";
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

  const messages = trpc.messages.list.useQuery(
    { applicationId: app?.id ?? "" },
    { enabled: app !== null },
  );
  const markRead = trpc.messages.markRead.useMutation();
  const send = trpc.messages.send.useMutation({
    onSuccess: () => {
      utils.messages.list.invalidate({ applicationId: app?.id ?? "" });
      setDraft("");
    },
  });

  useEffect(() => {
    if (app && messages.data?.length) markRead.mutate({ applicationId: app.id });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [app?.id, messages.data?.length]);

  trpc.messages.onMessage.useSubscription(
    { applicationId: app?.id ?? "" },
    {
      enabled: app !== null,
      onData: () => utils.messages.list.invalidate({ applicationId: app?.id ?? "" }),
    },
  );

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

        <div className="max-h-64 space-y-2 overflow-y-auto">
          {messages.data?.length ? (
            messages.data.map((m) => (
              <p
                key={m.id}
                className={cn(
                  "max-w-[80%] rounded-lg px-3 py-2 text-sm",
                  m.senderId === session?.user.id
                    ? "ml-auto bg-primary text-primary-foreground"
                    : "bg-muted text-foreground",
                )}
              >
                {m.content}
              </p>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">No messages yet.</p>
          )}
        </div>

        <div className="flex gap-2">
          <Textarea
            placeholder="Write a message…"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={2}
            className="flex-1"
          />
          <Button
            disabled={!draft || send.isPending}
            onClick={() => app && send.mutate({ applicationId: app.id, content: draft })}
          >
            Send
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
