"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { ShieldCheck } from "lucide-react";

type SignupIntent = "CANDIDATE" | "EMPLOYER";

const COPY: Record<SignupIntent, { title: string; description: string }> = {
  CANDIDATE: {
    title: "Create your candidate account",
    description: "Upload your resume and get verified for VA roles.",
  },
  EMPLOYER: {
    title: "Create your employer account",
    description: "Post a job and start reviewing verified candidates.",
  },
};

export default function SignUpPage() {
  return (
    <Suspense>
      <SignUpForm />
    </Suspense>
  );
}

function SignUpForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const intentParam = searchParams.get("as");
  const [intent, setIntent] = useState<SignupIntent>(intentParam === "employer" ? "EMPLOYER" : "CANDIDATE");
  const [name, setName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const claimReferral = trpc.referral.claim.useMutation();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error: signUpError } = await authClient.signUp.email({
      email,
      password,
      name,
      signupIntent: intent,
      companyName: intent === "EMPLOYER" ? companyName : undefined,
    });
    setLoading(false);
    if (signUpError) {
      setError(signUpError.message ?? "Sign up failed.");
      return;
    }
    if (intent === "EMPLOYER") {
      router.push("/overview");
      return;
    }
    const referrerId = searchParams.get("ref");
    if (referrerId) {
      claimReferral.mutate({ referrerId });
    }
    router.push("/onboarding");
  }

  return (
    <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center p-6">
      <Card className="motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2 motion-safe:duration-300">
        <CardHeader>
          <ShieldCheck className="mb-1 size-6 text-primary" />
          <CardTitle>{COPY[intent].title}</CardTitle>
          <CardDescription>{COPY[intent].description}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4 grid grid-cols-2 gap-2 rounded-lg bg-muted p-1">
            <Button
              type="button"
              size="sm"
              variant={intent === "CANDIDATE" ? "default" : "ghost"}
              onClick={() => setIntent("CANDIDATE")}
            >
              I&apos;m looking for work
            </Button>
            <Button
              type="button"
              size="sm"
              variant={intent === "EMPLOYER" ? "default" : "ghost"}
              onClick={() => setIntent("EMPLOYER")}
            >
              I&apos;m hiring
            </Button>
          </div>
          <form className="space-y-3" onSubmit={handleSubmit}>
            <div className="space-y-1">
              <Label>Full name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            {intent === "EMPLOYER" && (
              <div className="space-y-1">
                <Label>Company name</Label>
                <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} required />
              </div>
            )}
            <div className="space-y-1">
              <Label>Email</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="space-y-1">
              <Label>Password</Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
                required
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" disabled={loading} className="w-full">
              Sign up
            </Button>
          </form>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <a href="/sign-in" className="text-primary underline-offset-4 hover:underline">
              Sign in
            </a>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
