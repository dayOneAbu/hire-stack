"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const OPTIONS = [
  { value: "ONE_EMPLOYER", label: "One employer/job only" },
  { value: "AGENCY_MULTIPLE_CLIENTS", label: "One agency, multiple client assignments" },
  { value: "MULTIPLE_SEPARATE_CLIENTS", label: "Multiple separate clients/jobs" },
  { value: "FREELANCE", label: "Freelance/contract/gig work" },
  { value: "NOT_SURE", label: "Not sure / needs admin review" },
] as const;

type Answer = (typeof OPTIONS)[number]["value"];

type Split = { companyName: string; jobTitle: string; startDate: string; endDate: string };

export function GroupingQuestion({
  anomalyId,
  onAnswered,
}: {
  anomalyId: string;
  onAnswered: (isSearchable: boolean) => void;
}) {
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [splits, setSplits] = useState<Split[]>([
    { companyName: "", jobTitle: "", startDate: "", endDate: "" },
  ]);
  const mutation = trpc.candidate.wizard.answerGrouping.useMutation({
    onSuccess: (res) => onAnswered(res.isSearchable),
  });

  function submit() {
    if (!answer) return;
    if (answer === "MULTIPLE_SEPARATE_CLIENTS") {
      mutation.mutate({
        anomalyId,
        answer,
        splits: splits.map((s) => ({
          companyName: s.companyName,
          jobTitle: s.jobTitle,
          startDate: new Date(s.startDate),
          endDate: s.endDate ? new Date(s.endDate) : null,
        })),
      });
    } else {
      mutation.mutate({ anomalyId, answer });
    }
  }

  const canSubmit =
    answer &&
    (answer !== "MULTIPLE_SEPARATE_CLIENTS" ||
      splits.every((s) => s.companyName && s.jobTitle && s.startDate));

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {OPTIONS.map((opt) => (
          <label key={opt.value} className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="grouping"
              checked={answer === opt.value}
              onChange={() => setAnswer(opt.value)}
            />
            {opt.label}
          </label>
        ))}
      </div>

      {answer === "MULTIPLE_SEPARATE_CLIENTS" && (
        <div className="space-y-4 border-t pt-4">
          {splits.map((split, i) => (
            <div key={i} className="space-y-2 rounded-lg border p-3">
              <Label>Company name</Label>
              <Input
                value={split.companyName}
                onChange={(e) =>
                  setSplits((s) => s.map((x, j) => (j === i ? { ...x, companyName: e.target.value } : x)))
                }
              />
              <Label>Job title</Label>
              <Input
                value={split.jobTitle}
                onChange={(e) =>
                  setSplits((s) => s.map((x, j) => (j === i ? { ...x, jobTitle: e.target.value } : x)))
                }
              />
              <div className="flex gap-2">
                <div className="flex-1 space-y-1">
                  <Label>Start date</Label>
                  <Input
                    type="date"
                    value={split.startDate}
                    onChange={(e) =>
                      setSplits((s) => s.map((x, j) => (j === i ? { ...x, startDate: e.target.value } : x)))
                    }
                  />
                </div>
                <div className="flex-1 space-y-1">
                  <Label>End date (blank if current)</Label>
                  <Input
                    type="date"
                    value={split.endDate}
                    onChange={(e) =>
                      setSplits((s) => s.map((x, j) => (j === i ? { ...x, endDate: e.target.value } : x)))
                    }
                  />
                </div>
              </div>
            </div>
          ))}
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              setSplits((s) => [...s, { companyName: "", jobTitle: "", startDate: "", endDate: "" }])
            }
          >
            Add another
          </Button>
        </div>
      )}

      <Button disabled={!canSubmit || mutation.isPending} onClick={submit}>
        Continue
      </Button>
    </div>
  );
}
