export function canWithdraw(app: { currentStage: string; source: string }): boolean {
  return app.currentStage === "INBOX" && app.source === "CANDIDATE_APPLIED";
}
