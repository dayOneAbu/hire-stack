"use client";

import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { toast } from "sonner";

export default function ProfilePage() {
  const utils = trpc.useUtils();
  const profile = trpc.candidate.profile.get.useQuery();
  const update = trpc.candidate.profile.update.useMutation({
    onSuccess: () => {
      toast.success("Profile updated");
      utils.candidate.profile.get.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    bio: "",
    targetHourlyRateMin: "",
    targetHourlyRateMax: "",
    weeklyAvailability: "40",
  });

  useEffect(() => {
    if (!profile.data) return;
    setForm({
      firstName: profile.data.firstName,
      lastName: profile.data.lastName,
      bio: profile.data.bio ?? "",
      targetHourlyRateMin: profile.data.targetHourlyRateMin?.toString() ?? "",
      targetHourlyRateMax: profile.data.targetHourlyRateMax?.toString() ?? "",
      weeklyAvailability: profile.data.weeklyAvailability.toString(),
    });
  }, [profile.data]);

  if (profile.isLoading) {
    return <div className="mx-auto w-full max-w-2xl space-y-6 p-6 py-10 text-sm text-muted-foreground">Loading...</div>;
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 p-6 py-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Profile</h1>
        <p className="mt-1 text-sm text-muted-foreground">Update how employers see you.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Basic info</CardTitle>
          <CardDescription>Name and bio shown on your profile.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="firstName">First name</Label>
              <Input
                id="firstName"
                value={form.firstName}
                onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lastName">Last name</Label>
              <Input
                id="lastName"
                value={form.lastName}
                onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bio">Bio</Label>
            <Textarea
              id="bio"
              rows={5}
              value={form.bio}
              onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Rate & availability</CardTitle>
          <CardDescription>Used for job matching and search.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="rateMin">Target hourly rate (min, USD)</Label>
              <Input
                id="rateMin"
                type="number"
                min={0}
                step="0.01"
                value={form.targetHourlyRateMin}
                onChange={(e) => setForm((f) => ({ ...f, targetHourlyRateMin: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rateMax">Target hourly rate (max, USD)</Label>
              <Input
                id="rateMax"
                type="number"
                min={0}
                step="0.01"
                value={form.targetHourlyRateMax}
                onChange={(e) => setForm((f) => ({ ...f, targetHourlyRateMax: e.target.value }))}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="availability">Weekly availability (hours)</Label>
            <Input
              id="availability"
              type="number"
              min={1}
              max={168}
              value={form.weeklyAvailability}
              onChange={(e) => setForm((f) => ({ ...f, weeklyAvailability: e.target.value }))}
            />
          </div>
        </CardContent>
        <CardFooter>
          <Button
            disabled={update.isPending}
            onClick={() =>
              update.mutate({
                firstName: form.firstName,
                lastName: form.lastName,
                bio: form.bio || null,
                targetHourlyRateMin: form.targetHourlyRateMin ? Number(form.targetHourlyRateMin) : null,
                targetHourlyRateMax: form.targetHourlyRateMax ? Number(form.targetHourlyRateMax) : null,
                weeklyAvailability: Number(form.weeklyAvailability),
              })
            }
          >
            {update.isPending ? "Saving..." : "Save changes"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
