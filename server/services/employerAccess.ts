import { prisma } from "@/lib/prisma";

// FRS §7/§15: full profile access requires an approved staff member AND an
// active-or-dunning subscription. `past_due` still counts (§9 — dunning window).
export async function canViewFullProfile(employerStaffId: string): Promise<boolean> {
  const staff = await prisma.employerStaff.findUnique({
    where: { id: employerStaffId },
    include: { workspace: true },
  });
  if (!staff) return false;
  return (
    staff.approved &&
    (staff.workspace.subscriptionStatus === "ACTIVE" ||
      staff.workspace.subscriptionStatus === "PAST_DUE")
  );
}
