"use client";

import { use, useState, useEffect } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc/client";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, FileText, MessageSquare } from "lucide-react";
import { cn, getSafeErrorMessage } from "@/lib/utils";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

const OFFER_STATUS_TONE: Record<string, string> = {
  DRAFT: "bg-muted text-muted-foreground",
  SENT: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
  SIGNED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400",
  DECLINED: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400",
};

function OfferCard({ applicationId }: { applicationId: string }) {
  const utils = trpc.useUtils();
  const offer = trpc.candidate.offer.byApplication.useQuery({ applicationId });
  const [signerName, setSignerName] = useState("");
  const [confirmDecline, setConfirmDecline] = useState(false);

  const sign = trpc.candidate.offer.sign.useMutation({
    onSuccess: () => {
      toast.success("Offer signed");
      utils.candidate.offer.byApplication.invalidate({ applicationId });
    },
    onError: (e) => toast.error(getSafeErrorMessage(e)),
  });
  const decline = trpc.candidate.offer.decline.useMutation({
    onSuccess: () => {
      toast.success("Offer declined");
      utils.candidate.offer.byApplication.invalidate({ applicationId });
      setConfirmDecline(false);
    },
    onError: (e) => toast.error(getSafeErrorMessage(e)),
  });

  if (offer.isLoading || !offer.data) return null;

  return (
    <Card className="mb-4">
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-base">
          Offer
          <Badge className={OFFER_STATUS_TONE[offer.data.status] ?? ""} variant="outline">
            {offer.data.status}
          </Badge>
        </CardTitle>
        <CardDescription>
          <a href={offer.data.downloadUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-primary hover:underline">
            <FileText className="size-3.5" />
            View offer document
          </a>
        </CardDescription>
      </CardHeader>
      {offer.data.status === "SENT" && (
        <CardContent className="space-y-2">
          <Input
            placeholder="Type your legal name to sign"
            value={signerName}
            onChange={(e) => setSignerName(e.target.value)}
          />
        </CardContent>
      )}
      {offer.data.status === "SENT" && (
        <CardFooter className="justify-end gap-2">
          <Button
            variant="outline"
            disabled={decline.isPending}
            onClick={() => setConfirmDecline(true)}
          >
            Decline
          </Button>
          <Button
            disabled={!signerName || sign.isPending}
            onClick={() => sign.mutate({ offerId: offer.data!.id, signerName })}
          >
            Sign offer
          </Button>
        </CardFooter>
      )}

      <ConfirmDialog
        open={confirmDecline}
        onOpenChange={setConfirmDecline}
        title="Decline this offer?"
        description="This can't be undone. The employer will be notified that you've declined."
        confirmLabel="Decline offer"
        pending={decline.isPending}
        onConfirm={() => offer.data && decline.mutate({ offerId: offer.data.id })}
      />
      {offer.data.status === "SIGNED" && offer.data.signerName && (
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Signed by {offer.data.signerName} on {new Date(offer.data.signedAt!).toLocaleDateString()}
          </p>
        </CardContent>
      )}
    </Card>
  );
}

export default function ApplicationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const utils = trpc.useUtils();
  const { data: session } = authClient.useSession();
  const [draft, setDraft] = useState("");

  const messages = trpc.messages.list.useQuery({ applicationId: id });
  const markRead = trpc.messages.markRead.useMutation({
    onError: (e) => toast.error(getSafeErrorMessage(e)),
  });
  const send = trpc.messages.send.useMutation({
    onSuccess: () => {
      utils.messages.list.invalidate({ applicationId: id });
      setDraft("");
    },
    onError: (e) => toast.error(getSafeErrorMessage(e)),
  });

  useEffect(() => {
    if (messages.data?.length) markRead.mutate({ applicationId: id });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, messages.data?.length]);

  trpc.messages.onMessage.useSubscription(
    { applicationId: id },
    { onData: () => utils.messages.list.invalidate({ applicationId: id }) },
  );

  return (
    <div className="mx-auto flex h-full w-full max-w-2xl flex-col p-6 py-10">
      <Link
        href="/dashboard"
        className="mb-4 inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" />
        Dashboard
      </Link>

      <OfferCard applicationId={id} />

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
