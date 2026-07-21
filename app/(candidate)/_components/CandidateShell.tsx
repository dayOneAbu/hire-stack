"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { MobileNav } from "@/components/mobile-nav";
import { CreditCard, Gift, LayoutDashboard, LifeBuoy, LogOut, ShieldCheck, UserRound } from "lucide-react";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/profile", label: "Profile", icon: UserRound },
  { href: "/payout-settings", label: "Payouts", icon: CreditCard },
  { href: "/referrals", label: "Referrals", icon: Gift },
];

export function CandidateShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const session = authClient.useSession();
  const user = session.data?.user;
  const initials =
    user?.name
      ?.split(" ")
      .map((p) => p[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?";

  const signOut = () =>
    authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          router.push("/sign-in");
          router.refresh();
        },
      },
    });

  return (
    <div className="flex h-dvh overflow-hidden">
      <aside className="hidden w-64 shrink-0 flex-col justify-between overflow-y-auto bg-sidebar text-sidebar-foreground md:flex">
        <div>
          <div className="flex items-center gap-2 px-6 py-6">
            <ShieldCheck className="size-6 text-sidebar-primary" />
            <span className="text-lg font-semibold tracking-tight">HireStack</span>
          </div>
          <nav className="mt-2 flex flex-col gap-1 px-3">
            {NAV.map(({ href, label, icon: Icon }) => {
              const active = pathname === href || pathname.startsWith(href + "/");
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    active
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                  )}
                >
                  <Icon className="size-4 shrink-0" />
                  {label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="border-t border-sidebar-border p-3">
          <Link
            href="/support"
            className="mb-1 flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
          >
            <LifeBuoy className="size-4 shrink-0" />
            Help &amp; support
          </Link>
          <div className="flex items-center gap-3 rounded-lg px-3 py-2">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-sidebar-primary text-xs font-semibold text-sidebar-primary-foreground">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{user?.name ?? "..."}</p>
              <p className="truncate text-xs text-sidebar-foreground/60">{user?.email ?? ""}</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="size-8 shrink-0 text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              aria-label="Sign out"
              onClick={signOut}
            >
              <LogOut className="size-4" />
            </Button>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-2 border-b border-border bg-card px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] md:hidden">
          <ShieldCheck className="size-5 shrink-0 text-primary" />
          <span className="text-sm font-semibold tracking-tight">HireStack</span>
        </header>
        <main className="flex-1 overflow-y-auto bg-background pb-16 md:pb-0">{children}</main>
        <MobileNav nav={NAV} user={user} initials={initials} onSignOut={signOut} />
      </div>
    </div>
  );
}
