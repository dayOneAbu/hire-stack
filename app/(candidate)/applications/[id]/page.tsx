"use client";

import { use, useState, useEffect } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc/client";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export default function ApplicationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const utils = trpc.useUtils();
  const { data: session } = authClient.useSession();
  const [draft, setDraft] = useState("");

  const messages = trpc.messages.list.useQuery({ applicationId: id });
  const markRead = trpc.messages.markRead.useMutation({
    onError: (e) => toast.error(e.message),
  });
  const send = trpc.messages.send.useMutation({
    onSuccess: () => {
      utils.messages.list.invalidate({ applicationId: id });
      setDraft("");
    },
    onError: (e) => toast.error(e.message),
  });

  useEffect(() => {
    if (messages.data?.length) markRead.mutate({ applicationId: id });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, messages.data?.length]);

  return (
    <div className="mx-auto flex h-full w-full max-w-2xl flex-col p-6 py-10">
      <Link
        href="/dashboard"
        className="mb-4 inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" />
        Dashboard
      </Link>

      <h1 className="mb-4 text-xl font-semibold tracking-tight text-foreground">Messages</h1>

      {messages.isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : messages.isError ? (
        <div className="flex flex-1 flex-col items-center justify-center rounded-lg border border-dashed border-border p-4 text-center">
          <p className="text-sm text-muted-foreground">Couldn&apos;t load messages.</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => messages.refetch()}>
            Retry
          </Button>
        </div>
      ) : (
        <div className="flex-1 space-y-2 overflow-y-auto rounded-lg border border-border p-4">
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
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <MessageSquare className="size-8 text-muted-foreground" />
              <p className="mt-3 text-sm font-medium text-foreground">No messages yet</p>
              <p className="mt-1 text-sm text-muted-foreground">Send a message to get the conversation started.</p>
            </div>
          )}
        </div>
      )}

      <div className="mt-4 flex gap-2">
        <Textarea
          placeholder="Write a message…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={2}
          className="flex-1"
        />
        <Button
          disabled={!draft || send.isPending}
          onClick={() => send.mutate({ applicationId: id, content: draft })}
        >
          Send
        </Button>
      </div>
    </div>
  );
}
