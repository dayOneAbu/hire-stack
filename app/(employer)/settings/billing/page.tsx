"use client";

import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

const TIERS = [
  { tier: "STARTER" as const, name: "Starter", price: "$?/mo", slots: 1 },
  { tier: "TEAM" as const, name: "Team", price: "$?/mo", slots: 3 },
];

export default function BillingPage() {
  const status = trpc.billing.status.useQuery();
  const checkout = trpc.billing.createCheckoutSession.useMutation({
    onSuccess: (data) => {
      if (data.url) window.location.href = data.url;
    },
    onError: (e) => toast.error(e.message),
  });
  const portal = trpc.billing.createPortalSession.useMutation({
    onSuccess: (data) => {
      if (data.url) window.location.href = data.url;
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 p-6 py-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Billing</h1>
        <p className="mt-1 text-sm text-muted-foreground">Manage your subscription and one-time purchases.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Current plan
            {status.data && <Badge variant="outline">{status.data.subscriptionTier}</Badge>}
          </CardTitle>
          <CardDescription>
            {status.data
              ? `${status.data.subscriptionStatus} · ${status.data.jobSlotLimit} active job slot(s)`
              : "Loading..."}
          </CardDescription>
        </CardHeader>
        {status.data?.hasCustomer && (
          <CardFooter>
            <Button variant="outline" onClick={() => portal.mutate()} disabled={portal.isPending}>
              Manage subscription
            </Button>
          </CardFooter>
        )}
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        {TIERS.map((t) => (
          <Card key={t.tier}>
            <CardHeader>
              <CardTitle>{t.name}</CardTitle>
              <CardDescription>{t.slots} active job slot(s)</CardDescription>
            </CardHeader>
            <CardFooter>
              <Button
                className="w-full"
                disabled={status.data?.subscriptionTier === t.tier || checkout.isPending}
                onClick={() => checkout.mutate({ tier: t.tier })}
              >
                {status.data?.subscriptionTier === t.tier ? "Current plan" : `Subscribe to ${t.name}`}
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>One-time services</CardTitle>
          <CardDescription>Available regardless of subscription status.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row">
          <Button
            variant="outline"
            disabled={status.data?.hasConsultation || checkout.isPending}
            onClick={() => checkout.mutate({ product: "consultation" })}
          >
            {status.data?.hasConsultation ? "Consultation purchased" : "Buy consultation ($100)"}
          </Button>
          <Button
            variant="outline"
            disabled={status.data?.hasHireAssist || checkout.isPending}
            onClick={() => checkout.mutate({ product: "hireAssist" })}
          >
            {status.data?.hasHireAssist ? "Hire Assist purchased" : "Buy Hire Assist ($2,500)"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
