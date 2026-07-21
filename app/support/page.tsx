import Link from "next/link";
import { MessagesSquare } from "lucide-react";

export default function SupportPage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-background px-6 text-center">
      <MessagesSquare className="size-10 text-muted-foreground" />
      <h1 className="text-xl font-semibold">Chat support is under construction</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        We&apos;re building in-app chat support. It&apos;s not ready yet — check back soon.
      </p>
      <Link href="/dashboard" className="text-sm font-medium text-primary hover:underline">
        Back to dashboard
      </Link>
    </div>
  );
}
