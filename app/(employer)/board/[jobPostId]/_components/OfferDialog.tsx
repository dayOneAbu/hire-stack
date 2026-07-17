"use client";

import { useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc/client";
import { toast } from "sonner";
import { FileText, Upload } from "lucide-react";
import type { BoardApplication } from "./KanbanCard";

const STATUS_TONE: Record<string, string> = {
  DRAFT: "bg-muted text-muted-foreground",
  SENT: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
  SIGNED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400",
  DECLINED: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400",
};

const PAYMENT_STATUS_TONE: Record<string, string> = {
  HELD: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
  RELEASED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400",
  REFUNDED: "bg-muted text-muted-foreground",
  FAILED: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400",
};

function PaymentSection({ applicationId }: { applicationId: string }) {
  const utils = trpc.useUtils();
  const [amount, setAmount] = useState("");
  const payment = trpc.employer.payment.byApplication.useQuery({ applicationId });

  const fund = trpc.employer.payment.fund.useMutation({
    onSuccess: () => {
      toast.success("Payment funded and held");
      utils.employer.payment.byApplication.invalidate({ applicationId });
    },
    onError: (e) => toast.error(e.message),
  });
  const release = trpc.employer.payment.release.useMutation({
    onSuccess: () => {
      toast.success("Payment released to candidate");
      utils.employer.payment.byApplication.invalidate({ applicationId });
    },
    onError: (e) => toast.error(e.message),
  });
  const refund = trpc.employer.payment.refund.useMutation({
    onSuccess: () => {
      toast.success("Payment refunded");
      utils.employer.payment.byApplication.invalidate({ applicationId });
    },
    onError: (e) => toast.error(e.message),
  });

  if (payment.isLoading) return null;

  return (
    <div className="mt-4 space-y-3 border-t border-border pt-4">
      <p className="text-sm font-medium text-foreground">Payment</p>
      {payment.data ? (
        <div className="flex items-center justify-between rounded-lg border border-border p-3">
          <span className="text-sm">${Number(payment.data.amount).toFixed(2)}</span>
          <Badge className={PAYMENT_STATUS_TONE[payment.data.status] ?? ""} variant="outline">
            {payment.data.status}
          </Badge>
        </div>
      ) : (
        <div className="flex gap-2">
          <Input
            type="number"
            min={0}
            step="0.01"
            placeholder="Amount (USD)"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <Button
            disabled={!amount || fund.isPending}
            onClick={() => fund.mutate({ applicationId, amount: Number(amount) })}
          >
            Fund
          </Button>
        </div>
      )}
      {payment.data?.status === "HELD" && (
        <div className="flex gap-2">
          <Button
            className="flex-1"
            disabled={release.isPending}
            onClick={() => release.mutate({ paymentId: payment.data!.id })}
          >
            Release payment
          </Button>
          <Button
            variant="outline"
            disabled={refund.isPending}
            onClick={() => {
              if (window.confirm("Refund this payment?")) refund.mutate({ paymentId: payment.data!.id });
            }}
          >
            Refund
          </Button>
        </div>
      )}
    </div>
  );
}

export function OfferDialog({ app, onClose }: { app: BoardApplication | null; onClose: () => void }) {
  const utils = trpc.useUtils();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const offer = trpc.employer.offer.byApplication.useQuery(
    { applicationId: app?.id ?? "" },
    { enabled: app !== null },
  );
  const getUploadUrl = trpc.employer.offer.getUploadUrl.useMutation();
  const create = trpc.employer.offer.create.useMutation({
    onSuccess: () => {
      toast.success("Offer created");
      utils.employer.offer.byApplication.invalidate({ applicationId: app?.id ?? "" });
    },
    onError: (e) => toast.error(e.message),
  });
  const send = trpc.employer.offer.send.useMutation({
    onSuccess: () => {
      toast.success("Offer sent to candidate");
      utils.employer.offer.byApplication.invalidate({ applicationId: app?.id ?? "" });
    },
    onError: (e) => toast.error(e.message),
  });

  async function handleUpload(file: File) {
    if (!app) return;
    setUploading(true);
    try {
      const { uploadUrl, documentUrl } = await getUploadUrl.mutateAsync({
        applicationId: app.id,
        filename: file.name,
      });
      await fetch(uploadUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
      await create.mutateAsync({ applicationId: app.id, documentUrl });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <Dialog open={app !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{app ? `Offer — ${app.candidate.firstName} ${app.candidate.lastName}` : ""}</DialogTitle>
          <DialogDescription>Upload an offer document and send it for signature.</DialogDescription>
        </DialogHeader>

        {offer.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : offer.data ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <a
                href={offer.data.downloadUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 text-sm font-medium text-primary hover:underline"
              >
                <FileText className="size-4" />
                View offer document
              </a>
              <Badge className={STATUS_TONE[offer.data.status] ?? ""} variant="outline">
                {offer.data.status}
              </Badge>
            </div>
            {offer.data.status === "DRAFT" && (
              <Button className="w-full" disabled={send.isPending} onClick={() => send.mutate({ offerId: offer.data!.id })}>
                Send to candidate
              </Button>
            )}
            {offer.data.status === "SIGNED" && offer.data.signerName && (
              <p className="text-sm text-muted-foreground">
                Signed by {offer.data.signerName} on {new Date(offer.data.signedAt!).toLocaleDateString()}
              </p>
            )}
            {offer.data.status === "SIGNED" && app && <PaymentSection applicationId={app.id} />}
          </div>
        ) : (
          <div className="space-y-3">
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.doc,.docx"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleUpload(file);
              }}
            />
            <Button
              className="w-full"
              variant="outline"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="size-4" />
              {uploading ? "Uploading..." : "Upload offer document"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
