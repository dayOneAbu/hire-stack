"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { ShieldCheck } from "lucide-react";

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { data, error: signInError } = await authClient.signIn.email({ email, password });
    setLoading(false);
    if (signInError) {
      setError(signInError.message ?? "Sign in failed.");
      return;
    }
    const role = (data?.user as { role?: string } | undefined)?.role;
    if (role === "EMPLOYER_OWNER" || role === "EMPLOYER_RECRUITER") {
      router.push("/overview");
    } else if (role === "SUPER_ADMIN" || role === "PLATFORM_OPERATOR") {
      router.push("/review-queue");
    } else {
      router.push("/dashboard");
    }
  }

  async function signInDemo(email: string, password: string) {
    setError(null);
    setLoading(true);
    const { data, error: signInError } = await authClient.signIn.email({
      email,
      password,
    });
    setLoading(false);
    if (signInError) {
      setError(signInError.message ?? "Demo sign in failed.");
      return;
    }
    const role = (data?.user as { role?: string } | undefined)?.role;
    if (role === "EMPLOYER_OWNER" || role === "EMPLOYER_RECRUITER") {
      router.push("/overview");
    } else if (role === "SUPER_ADMIN" || role === "PLATFORM_OPERATOR") {
      router.push("/review-queue");
    } else {
      router.push("/dashboard");
    }
  }

  const demoMode = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

  return (
    <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center p-6">
      <Card className="motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2 motion-safe:duration-300">
        <CardHeader>
          <ShieldCheck className="mb-1 size-6 text-primary" />
          <CardTitle>Sign in</CardTitle>
          <CardDescription>Welcome back.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-3" onSubmit={handleSubmit}>
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
                required
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" disabled={loading} className="w-full">
              Sign in
            </Button>
          </form>
          {demoMode && (
            <div className="mt-4 space-y-2 border-t pt-4">
              <p className="text-center text-xs text-muted-foreground">Demo as</p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  disabled={loading}
                  onClick={() => signInDemo("candidate1@bulktest.dev", "bulkpass1234")}
                >
                  Candidate
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  disabled={loading}
                  onClick={() => signInDemo("employer1@bulktest.dev", "bulkpass1234")}
                >
                  Employer
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  disabled={loading}
                  onClick={() => signInDemo("admin1@bulktest.dev", "bulkpass1234")}
                >
                  Admin
                </Button>
              </div>
            </div>
          )}
          <p className="mt-4 text-center text-sm text-muted-foreground">
            Need an account?{" "}
            <a href="/sign-up" className="text-primary underline-offset-4 hover:underline">
              Sign up
            </a>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
