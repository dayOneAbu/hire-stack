"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Search, Send, MessageCircle } from "lucide-react";

const TYPING_IDLE_MS = 3000;

function initials(firstName: string, lastName: string) {
  return `${firstName[0] ?? ""}${lastName[0] ?? ""}`.toUpperCase();
}

function timeShort(date: Date) {
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  if (sameDay) return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return date.toLocaleDateString([], { month: "numeric", day: "numeric", year: "2-digit" });
}

function dayLabel(date: Date) {
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  if (sameDay) return "Today";
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return date.toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" });
}

export default function MessagesInboxPage() {
  const utils = trpc.useUtils();
  const { data: session } = authClient.useSession();
  const { data: threads, isLoading } = trpc.messages.listThreads.useQuery();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState("");
  const [otherTyping, setOtherTyping] = useState(false);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!selectedId && threads?.length) setSelectedId(threads[0].applicationId);
  }, [selectedId, threads]);

  const filteredThreads = useMemo(() => {
    if (!threads) return [];
    const q = query.trim().toLowerCase();
    if (!q) return threads;
    return threads.filter(
      (t) =>
        `${t.candidate.firstName} ${t.candidate.lastName}`.toLowerCase().includes(q) ||
        t.jobPost.title.toLowerCase().includes(q),
    );
  }, [threads, query]);

  const active = threads?.find((t) => t.applicationId === selectedId) ?? null;

  const messages = trpc.messages.list.useQuery(
    { applicationId: active?.applicationId ?? "" },
    { enabled: !!active },
  );
  const markRead = trpc.messages.markRead.useMutation({
    onSuccess: () => utils.messages.listThreads.invalidate(),
  });
  const send = trpc.messages.send.useMutation({
    onSuccess: () => {
      utils.messages.list.invalidate({ applicationId: active?.applicationId ?? "" });
      utils.messages.listThreads.invalidate();
      setDraft("");
    },
  });
  const typing = trpc.messages.typing.useMutation();

  useEffect(() => {
    if (active && messages.data?.length) markRead.mutate({ applicationId: active.applicationId });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.applicationId, messages.data?.length]);

  useEffect(() => {
    setOtherTyping(false);
    setDraft("");
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
  }, [active?.applicationId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ block: "end" });
  }, [active?.applicationId, messages.data]);

  trpc.messages.onMessage.useSubscription(
    { applicationId: active?.applicationId ?? "" },
    {
      enabled: !!active,
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
        utils.messages.list.invalidate({ applicationId: active?.applicationId ?? "" });
        utils.messages.listThreads.invalidate();
      },
    },
  );

  function handleDraftChange(value: string) {
    setDraft(value);
    if (active) typing.mutate({ applicationId: active.applicationId });
  }

  function handleSend() {
    if (!active || !draft.trim()) return;
    send.mutate({ applicationId: active.applicationId, content: draft });
  }

  const lastOwnMessageId = useMemo(() => {
    if (!messages.data || !session?.user.id) return null;
    for (let i = messages.data.length - 1; i >= 0; i--) {
      if (messages.data[i].senderId === session.user.id) return messages.data[i].id;
    }
    return null;
  }, [messages.data, session?.user.id]);

  const groupedMessages = useMemo(() => {
    if (!messages.data) return [];
    const groups: { label: string; items: typeof messages.data }[] = [];
    for (const m of messages.data) {
      const label = dayLabel(new Date(m.createdAt));
      const last = groups[groups.length - 1];
      if (last && last.label === label) last.items.push(m);
      else groups.push({ label, items: [m] });
    }
    return groups;
  }, [messages.data]);

  return (
    <div className="flex h-full min-h-0">
      {/* Thread list */}
      <div className="flex w-80 shrink-0 flex-col border-r border-border">
        <div className="border-b border-border px-4 py-4">
          <h1 className="mb-3 text-xl font-semibold tracking-tight">Messages</h1>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search messages"
              className="pl-8"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {isLoading && <p className="p-4 text-sm text-muted-foreground">Loading…</p>}
          {!isLoading && !filteredThreads.length && (
            <p className="p-4 text-sm text-muted-foreground">No conversations yet.</p>
          )}
          {filteredThreads.map((t) => {
            const isSelected = t.applicationId === selectedId;
            return (
              <button
                key={t.applicationId}
                onClick={() => setSelectedId(t.applicationId)}
                className={cn(
                  "flex w-full items-start gap-3 border-b border-border/60 px-4 py-3 text-left transition-colors",
                  isSelected ? "bg-muted" : "hover:bg-muted/50",
                )}
              >
                <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                  {initials(t.candidate.firstName, t.candidate.lastName)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className={cn("truncate text-sm", t.unreadCount > 0 ? "font-semibold" : "font-medium")}>
                      {t.candidate.firstName} {t.candidate.lastName}
                    </p>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {timeShort(new Date(t.lastMessage.createdAt))}
                    </span>
                  </div>
                  <p className="truncate text-xs text-muted-foreground">{t.jobPost.title}</p>
                  <div className="mt-0.5 flex items-center justify-between gap-2">
                    <p
                      className={cn(
                        "truncate text-sm",
                        t.unreadCount > 0 ? "font-medium text-foreground" : "text-muted-foreground",
                      )}
                    >
                      {t.lastMessage.content}
                    </p>
                    {t.unreadCount > 0 && (
                      <Badge variant="default" className="h-4.5 min-w-4.5 shrink-0 justify-center rounded-full px-1 text-[10px]">
                        {t.unreadCount}
                      </Badge>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Active thread */}
      <div className="flex min-w-0 flex-1 flex-col">
        {!active ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 text-muted-foreground">
            <MessageCircle className="size-8" />
            <p className="text-sm">Select a conversation</p>
          </div>
        ) : (
          <>
            <div className="border-b border-border px-6 py-4">
              <p className="text-lg font-semibold tracking-tight">
                {active.candidate.firstName} {active.candidate.lastName}
              </p>
              <p className="text-xs text-muted-foreground">{active.jobPost.title}</p>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto px-6 py-4">
              {groupedMessages.map((group) => (
                <div key={group.label}>
                  <div className="mb-3 flex items-center gap-3">
                    <div className="h-px flex-1 bg-border" />
                    <span className="text-xs text-muted-foreground">{group.label}</span>
                    <div className="h-px flex-1 bg-border" />
                  </div>
                  <div className="space-y-2">
                    {group.items.map((m) => {
                      const isOwn = m.senderId === session?.user.id;
                      const isLastOwn = isOwn && m.id === lastOwnMessageId;
                      return (
                        <div key={m.id} className={cn("flex flex-col", isOwn ? "items-end" : "items-start")}>
                          <p
                            className={cn(
                              "max-w-[70%] rounded-lg px-3 py-2 text-sm wrap-break-word whitespace-pre-wrap",
                              isOwn ? "bg-primary text-primary-foreground" : "bg-muted text-foreground",
                            )}
                          >
                            {m.content}
                          </p>
                          <span className="mt-0.5 text-[11px] text-muted-foreground">
                            {timeShort(new Date(m.createdAt))}
                            {isLastOwn && (m.readAt ? " · Seen" : " · Sent")}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
              {otherTyping && <p className="text-xs text-muted-foreground">Typing…</p>}
              <div ref={messagesEndRef} />
            </div>

            <div className="flex items-end gap-2 border-t border-border px-4 py-3">
              <Textarea
                placeholder="Send a message…"
                value={draft}
                onChange={(e) => handleDraftChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                rows={1}
                className="max-h-32 flex-1 resize-none"
              />
              <Button
                size="icon"
                disabled={!draft.trim() || send.isPending}
                onClick={handleSend}
                aria-label="Send message"
              >
                <Send className="size-4" />
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
