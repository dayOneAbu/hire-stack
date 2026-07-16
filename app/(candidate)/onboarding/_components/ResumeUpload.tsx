"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { UploadCloud } from "lucide-react";
import { cn } from "@/lib/utils";

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
  const [uploadPercent, setUploadPercent] = useState(0);
  const [dragActive, setDragActive] = useState(false);
  const [processingSeconds, setProcessingSeconds] = useState(0);

  const getUploadUrl = trpc.candidate.resume.getUploadUrl.useMutation();
  const confirmUpload = trpc.candidate.resume.confirmUpload.useMutation();
  const utils = trpc.useUtils();

  const pollStatus = trpc.candidate.resume.status.useQuery(undefined, {
    enabled: parseStatus === "PENDING",
    refetchInterval: (query) => {
      const s = query.state.data?.parseStatus;
      if (s === "PARSED" || s === "FAILED") return false;
      return 3000;
    },
  });

  useEffect(() => {
    if (pollStatus.data?.parseStatus === "PARSED") onParsed();
  }, [pollStatus.data?.parseStatus, onParsed]);

  useEffect(() => {
    if (parseStatus !== "PENDING") {
      setProcessingSeconds(0);
      return;
    }
    const interval = setInterval(() => setProcessingSeconds((s) => s + 1), 1000);
    return () => clearInterval(interval);
  }, [parseStatus]);

  function putWithProgress(uploadUrl: string, file: File) {
    return new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", uploadUrl);
      xhr.setRequestHeader("Content-Type", file.type);
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) setUploadPercent(Math.round((e.loaded / e.total) * 100));
      };
      xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error("Upload failed")));
      xhr.onerror = () => reject(new Error("Upload failed"));
      xhr.send(file);
    });
  }

  async function handleFile(file: File) {
    setError(null);
    if (file.size > 10 * 1024 * 1024) {
      setError("File is too large (max 10MB).");
      return;
    }
    setUploading(true);
    setUploadPercent(0);
    try {
      const { uploadUrl, rawResumeUrl } = await getUploadUrl.mutateAsync({
        filename: file.name,
        contentType: file.type as
          | "application/pdf"
          | "application/msword"
          | "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        sizeBytes: file.size,
      });
      await putWithProgress(uploadUrl, file);
      await confirmUpload.mutateAsync({ rawResumeUrl });
      await utils.candidate.resume.status.invalidate();
    } catch (e) {
      const message = e instanceof Error ? e.message : "Upload failed. Try again.";
      setError(message);
      toast.error(message);
    } finally {
      setUploading(false);
    }
  }

  if (parseStatus === "PENDING") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Processing your resume&hellip;</CardTitle>
          <CardDescription>
            {processingSeconds < 10
              ? "This usually takes a few seconds."
              : "Still working — longer resumes can take up to a minute."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full w-1/3 animate-[indeterminate_1.2s_ease-in-out_infinite] rounded-full bg-primary" />
          </div>
        </CardContent>
        {processingSeconds >= 20 && (
          <CardFooter className="justify-between">
            <p className="text-xs text-muted-foreground">Taking longer than usual?</p>
            <Button variant="ghost" size="sm" onClick={onManualEntry}>
              Enter manually instead
            </Button>
          </CardFooter>
        )}
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
          className={cn(
            "flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed p-8 text-center text-sm transition-colors",
            dragActive
              ? "border-primary bg-primary/5 text-foreground"
              : "border-border text-muted-foreground hover:bg-muted/50",
          )}
          onClick={() => fileInput.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragActive(false);
            const file = e.dataTransfer.files?.[0];
            if (file) void handleFile(file);
          }}
        >
          <UploadCloud className={cn("size-6", dragActive && "text-primary")} />
          {uploading ? (
            <div className="w-full max-w-56 space-y-1.5">
              <p>Uploading… {uploadPercent}%</p>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-[width] duration-150 ease-out"
                  style={{ width: `${uploadPercent}%` }}
                />
              </div>
            </div>
          ) : dragActive ? (
            "Drop it here"
          ) : (
            "Drag & drop your resume, or click to choose a file"
          )}
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
