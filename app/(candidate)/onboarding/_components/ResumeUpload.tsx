"use client";

import { useRef, useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";

type ParseStatus = "PENDING" | "PARSED" | "FAILED" | null;

export function ResumeUpload({
  parseStatus,
  onParsed,
  onManualEntry,
}: {
  parseStatus: ParseStatus;
  onParsed: () => void;
  onManualEntry: () => void;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const getUploadUrl = trpc.candidate.resume.getUploadUrl.useMutation();
  const confirmUpload = trpc.candidate.resume.confirmUpload.useMutation();
  const utils = trpc.useUtils();

  trpc.candidate.resume.status.useQuery(undefined, {
    enabled: parseStatus === "PENDING",
    refetchInterval: (query) => {
      const s = query.state.data?.parseStatus;
      if (s === "PARSED") {
        onParsed();
        return false;
      }
      if (s === "FAILED") return false;
      return 3000;
    },
  });

  async function handleFile(file: File) {
    setError(null);
    if (file.size > 10 * 1024 * 1024) {
      setError("File is too large (max 10MB).");
      return;
    }
    setUploading(true);
    try {
      const { uploadUrl, rawResumeUrl } = await getUploadUrl.mutateAsync({
        filename: file.name,
        contentType: file.type as
          | "application/pdf"
          | "application/msword"
          | "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        sizeBytes: file.size,
      });
      const putRes = await fetch(uploadUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
      if (!putRes.ok) throw new Error("Upload failed");
      await confirmUpload.mutateAsync({ rawResumeUrl });
      await utils.candidate.resume.status.invalidate();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed. Try again.");
    } finally {
      setUploading(false);
    }
  }

  if (parseStatus === "PENDING") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Processing your resume&hellip;</CardTitle>
          <CardDescription>This usually takes a few seconds.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Upload your resume</CardTitle>
        <CardDescription>PDF or Word document, up to 10MB.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <input
          ref={fileInput}
          type="file"
          accept=".pdf,.doc,.docx"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleFile(file);
          }}
        />
        <div
          className="cursor-pointer rounded-lg border-2 border-dashed border-border p-8 text-center text-sm text-muted-foreground hover:bg-muted/50"
          onClick={() => fileInput.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const file = e.dataTransfer.files?.[0];
            if (file) void handleFile(file);
          }}
        >
          {uploading ? "Uploading…" : "Drag & drop your resume, or click to choose a file"}
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        {parseStatus === "FAILED" && (
          <p className="text-sm text-destructive">
            We couldn&apos;t parse your last resume. You can try again or enter your work history
            manually.
          </p>
        )}
      </CardContent>
      <CardFooter className="justify-between">
        <Button variant="ghost" onClick={onManualEntry}>
          Enter manually instead
        </Button>
      </CardFooter>
    </Card>
  );
}
