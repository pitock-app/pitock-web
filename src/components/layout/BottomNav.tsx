"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { it } from "@/lib/i18n/it";
import { isNavItemActive, navItems } from "./nav-items";

/** Barra di navigazione inferiore, visibile solo su mobile. "+ Aggiungi" è in evidenza. */
export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label={it.nav.main}
      className="bg-background/95 supports-[backdrop-filter]:bg-background/80 fixed inset-x-0 bottom-0 z-40 border-t pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      <ul className="mx-auto grid h-16 max-w-md grid-cols-3 items-center">
        {navItems.map((item) => {
          const active = isNavItemActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <li key={item.href} className="flex justify-center">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex w-full min-w-0 flex-col items-center gap-0.5 rounded-lg px-1 py-1 text-xs font-medium outline-none",
                  "focus-visible:ring-ring focus-visible:ring-2",
                  active ? "text-foreground font-semibold" : "text-muted-foreground",
                )}
              >
                {item.primary ? (
                  <span
                    className={cn(
                      "bg-brand text-brand-foreground -mt-6 flex size-12 items-center justify-center rounded-full shadow-lg",
                      active && "ring-brand/40 ring-4",
                    )}
                  >
                    <Icon className="size-6" aria-hidden />
                  </span>
                ) : (
                  <Icon className="size-5" strokeWidth={active ? 2.5 : 2} aria-hidden />
                )}
                <span
                  className={cn(
                    "max-w-full truncate border-b-2",
                    active && !item.primary ? "border-brand" : "border-transparent",
                  )}
                >
                  {item.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
