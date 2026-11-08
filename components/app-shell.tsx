"use client";

import { UserButton } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowUpRight,
  Bell,
  Compass,
  Inbox,
  Package,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { Wordmark } from "@/components/brand";
import { TrustedPill } from "@/components/ui/pill";
import { cn } from "@/lib/cn";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  badge?: number;
  adminOnly?: boolean;
};

export function AppShell({
  user,
  children,
}: {
  user: Doc<"users">;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const badges = useQuery(api.requests.badges);

  const groups: { label: string; items: NavItem[] }[] = [
    {
      label: "The board",
      items: [{ href: "/browse", label: "Browse tools", icon: Compass }],
    },
    {
      label: "Your loop",
      items: [
        { href: "/my-listings", label: "My listings", icon: Package },
        {
          href: "/my-requests",
          label: "My requests",
          icon: ArrowUpRight,
          badge: badges?.outgoingActive,
        },
        {
          href: "/incoming",
          label: "Incoming requests",
          icon: Inbox,
          badge: badges?.incomingPending,
        },
        { href: "/notifications", label: "Notifications", icon: Bell, badge: badges?.unread },
      ],
    },
    {
      label: "Admin",
      items: [
        {
          href: "/admin",
          label: "Control room",
          icon: ShieldCheck,
          adminOnly: true,
        },
      ],
    },
  ];

  const visibleGroups = groups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => !item.adminOnly || user.role === "admin"),
    }))
    .filter((group) => group.items.length > 0);

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[260px_1fr]">
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-line bg-surface/55 lg:flex">
        <div className="px-5 py-5">
          <Wordmark href="/browse" />
        </div>

        <nav className="flex-1 space-y-7 overflow-y-auto px-3 pb-6">
          {visibleGroups.map((group) => (
            <div key={group.label}>
              <p className="px-2 pb-2 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint">
                {group.label}
              </p>
              <ul className="space-y-0.5">
                {group.items.map((item) => (
                  <li key={item.href}>
                    <NavLink item={item} active={isActive(pathname, item.href)} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <div className="border-t border-line px-4 py-4">
          <div className="flex items-center gap-3">
            <UserButton />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium text-ink">{user.name}</p>
              <p className="truncate text-[11px] text-ink-faint">{user.email}</p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {user.role === "admin" ? (
              <span className="rounded-full bg-ink px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-paper">
                Admin
              </span>
            ) : null}
            {user.trustedLender || user.role === "admin" ? <TrustedPill /> : null}
          </div>
        </div>
      </aside>

      <div className="flex min-h-dvh flex-col">
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-line bg-paper/90 px-4 backdrop-blur lg:hidden">
          <Wordmark href="/browse" />
          <div className="flex items-center gap-3">
            <Link
              href="/notifications"
              aria-label="Notifications"
              className="relative rounded-lg p-1.5 text-ink-soft hover:bg-paper-deep"
            >
              <Bell className="h-5 w-5" />
              {badges?.unread ? (
                <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-accent" />
              ) : null}
            </Link>
            <UserButton />
          </div>
        </header>

        <div className="sticky top-14 z-10 overflow-x-auto border-b border-line bg-paper/90 px-2 py-2 backdrop-blur lg:hidden">
          <nav className="flex items-center gap-1">
            {visibleGroups.flatMap((group) =>
              group.items.map((item) => {
                const Icon = item.icon;
                const active = isActive(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-medium transition",
                      active
                        ? "bg-ink text-surface"
                        : "text-ink-soft hover:bg-paper-deep hover:text-ink",
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {item.label}
                    {item.badge ? (
                      <span
                        className={cn(
                          "rounded-full px-1.5 py-0.5 text-[10px]",
                          active ? "bg-paper/20 text-paper" : "bg-accent-soft text-accent",
                        )}
                      >
                        {item.badge}
                      </span>
                    ) : null}
                  </Link>
                );
              }),
            )}
          </nav>
        </div>

        <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-8 sm:px-8 sm:py-10">
          {children}
        </main>
      </div>
    </div>
  );
}

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition",
        active
          ? "bg-ink text-surface shadow-[0_1px_0_rgba(0,0,0,0.08)]"
          : "text-ink-soft hover:bg-paper-deep hover:text-ink",
      )}
    >
      <Icon className={cn("h-4 w-4", active ? "text-paper" : "text-ink-faint")} />
      <span className="flex-1">{item.label}</span>
      {item.badge ? (
        <span
          className={cn(
            "min-w-5 rounded-full px-1.5 py-0.5 text-center text-[10px] font-semibold",
            active ? "bg-paper/20 text-paper" : "bg-accent-soft text-accent",
          )}
        >
          {item.badge}
        </span>
      ) : null}
    </Link>
  );
}
