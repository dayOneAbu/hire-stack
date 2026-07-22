"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Bookmark, BookmarkCheck } from "lucide-react";

export type JobPostSummary = { id: string; title: string; description: string };

export function JobCard({
  jobPost,
  badge,
  isSaved,
  onToggleSave,
  saveMutating,
  footer,
}: {
  jobPost: JobPostSummary;
  badge?: React.ReactNode;
  isSaved: boolean;
  onToggleSave: () => void;
  saveMutating: boolean;
  footer: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2">
          <Link href={`/listings/${jobPost.id}`} className="line-clamp-1 hover:underline">
            {jobPost.title}
          </Link>
          {badge}
        </CardTitle>
        <CardDescription className="line-clamp-2 min-h-10">{jobPost.description}</CardDescription>
      </CardHeader>
      <CardFooter className="justify-between">
        <Button
          variant="ghost"
          size="icon"
          aria-label={isSaved ? "Unsave" : "Save"}
          disabled={saveMutating}
          onClick={onToggleSave}
        >
          {isSaved ? <BookmarkCheck className="size-4" /> : <Bookmark className="size-4" />}
        </Button>
        {footer}
      </CardFooter>
    </Card>
  );
}
