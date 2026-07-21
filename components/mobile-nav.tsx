"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Drawer,
  DrawerClose,
  DrawerPopup,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { LifeBuoy, LogOut, MoreHorizontal, type LucideIcon } from "lucide-react";

export type MobileNavItem = { href: string; label: string; icon: LucideIcon };

const MAX_PRIMARY_TABS = 3;

export function MobileNav({
  nav,
  user,
  initials,
  onSignOut,
}: {
  nav: MobileNavItem[];
  user: { name?: string | null; email?: string | null } | undefined;
  initials: string;
  onSignOut: () => void;
}) {
  const pathname = usePathname();
  const primary = nav.slice(0, MAX_PRIMARY_TABS);
  const overflow = nav.slice(MAX_PRIMARY_TABS);
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");
  const moreActive = overflow.some((item) => isActive(item.href));

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 flex items-stretch border-t border-border bg-card pb-[env(safe-area-inset-bottom)] md:hidden"
      aria-label="Primary"
    >
      {primary.map(({ href, label, icon: Icon }) => {
        const active = isActive(href);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex min-h-11 flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium",
              active ? "text-primary" : "text-muted-foreground",
            )}
          >
            <Icon className="size-5" />
            <span className="max-w-16 truncate">{label}</span>
          </Link>
        );
      })}

      <Drawer>
        <DrawerTrigger
          className={cn(
            "flex min-h-11 flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium",
            moreActive ? "text-primary" : "text-muted-foreground",
          )}
        >
          <MoreHorizontal className="size-5" />
          More
        </DrawerTrigger>
        <DrawerPopup>
          <div className="flex items-center gap-3 px-4 pb-2">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-sidebar-primary text-xs font-semibold text-sidebar-primary-foreground">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{user?.name ?? "..."}</p>
              <p className="truncate text-xs text-muted-foreground">{user?.email ?? ""}</p>
            </div>
          </div>

          <div className="flex flex-col gap-1 overflow-y-auto px-2 pb-2">
            {overflow.map(({ href, label, icon: Icon }) => (
              <DrawerClose
                key={href}
                render={
                  <Link
                    href={href}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium",
                      isActive(href) ? "bg-accent text-accent-foreground" : "text-foreground",
                    )}
                  />
                }
              >
                <Icon className="size-4 shrink-0" />
                {label}
              </DrawerClose>
            ))}

            <DrawerClose
              render={
                <Link
                  href="/support"
                  className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-foreground"
                />
              }
            >
              <LifeBuoy className="size-4 shrink-0" />
              Help &amp; support
            </DrawerClose>

            <DrawerClose
              render={
                <button
                  type="button"
                  className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-destructive"
                  onClick={onSignOut}
                />
              }
            >
              <LogOut className="size-4 shrink-0" />
              Sign out
            </DrawerClose>
          </div>
        </DrawerPopup>
      </Drawer>
    </nav>
  );
}
