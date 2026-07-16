const STEPS = ["Resume", "Employment history", "Software", "Done"] as const;

export function OnboardingProgress({ stepIndex }: { stepIndex: number }) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground">
        Step {stepIndex + 1} of {STEPS.length}: {STEPS[stepIndex]}
      </p>
      <ol className="flex gap-1.5">
        {STEPS.map((step, i) => (
          <li
            key={step}
            className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"
          >
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-500 ease-out"
              style={{ width: i <= stepIndex ? "100%" : "0%" }}
            />
          </li>
        ))}
      </ol>
    </div>
  );
}
