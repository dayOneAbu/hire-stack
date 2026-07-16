import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 p-16 text-center">
      <h1 className="max-w-lg text-3xl font-semibold tracking-tight">
        Verified, structured hiring for overseas VA recruiting
      </h1>
      <p className="max-w-md text-muted-foreground">
        Real estate teams hire pre-verified virtual assistants with confirmed work history and
        software experience.
      </p>
      <div className="flex gap-3">
        <Button nativeButton={false} render={<Link href="/sign-up" />}>
          Get started as a candidate
        </Button>
        <Button variant="outline" nativeButton={false} render={<Link href="/sign-in" />}>
          Sign in
        </Button>
      </div>
    </div>
  );
}
