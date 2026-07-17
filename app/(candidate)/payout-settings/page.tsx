"use client";

import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";

export default function PayoutSettingsPage() {
  const status = trpc.candidate.payout.payoutStatus.useQuery();
  const onboard = trpc.candidate.payout.connectOnboard.useMutation({
    onSuccess: (data) => {
      window.location.href = data.url;
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 p-6 py-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Payouts</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Connect a payout account to receive payments from employers.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Payout account
            {status.isLoading ? null : (
              <Badge variant={status.data?.payoutsEnabled ? "secondary" : "outline"}>
                {status.data?.payoutsEnabled ? "enabled" : "not enabled"}
              </Badge>
            )}
          </CardTitle>
          <CardDescription>
            Stripe hosts identity verification and bank-account setup — HireStack never collects
            or stores that information directly.
          </CardDescription>
        </CardHeader>
        <CardContent>{status.isLoading && <Skeleton className="h-4 w-48" />}</CardContent>
        <CardFooter>
          <Button disabled={onboard.isPending} onClick={() => onboard.mutate()}>
            {status.data?.stripeConnectAccountId ? "Continue onboarding" : "Enable payouts"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
