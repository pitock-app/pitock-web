"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { it } from "@/lib/i18n/it";
import { Logo } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";
import { isNavItemActive, navItems } from "./nav-items";

/** Navigazione laterale, visibile solo da md in su. */
export function Sidebar({ account }: { account?: ReactNode }) {
  const pathname = usePathname();

  return (
    <aside className="bg-sidebar text-sidebar-foreground border-sidebar-border sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r md:flex">
      <div className="flex h-16 items-center px-5">
        <Link href="/dashboard" className="focus-visible:ring-ring rounded-md focus-visible:ring-2">
          <Logo />
        </Link>
      </div>
      <nav aria-label={it.nav.main} className="flex-1 px-3 py-2">
        <ul className="flex flex-col gap-1">
          {navItems.map((item) => {
            const active = isNavItemActive(pathname, item.href);
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors outline-none",
                    "focus-visible:ring-ring focus-visible:ring-offset-sidebar focus-visible:ring-2 focus-visible:ring-offset-2",
                    item.primary
                      ? "bg-brand text-brand-foreground hover:bg-brand/90"
                      : active
                        ? "bg-sidebar-accent text-sidebar-accent-foreground border-brand border-l-2 font-semibold"
                        : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                    item.primary && active && "font-semibold shadow-inner",
                  )}
                >
                  <Icon className="size-4" aria-hidden />
                  {item.primary ? it.nav.addLong : item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="border-sidebar-border flex flex-col gap-2 border-t px-3 py-2">
        {account}
        <div className="flex justify-end">
          <ThemeToggle />
        </div>
      </div>
    </aside>
  );
}
