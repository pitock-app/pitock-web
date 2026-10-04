"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { it } from "@/lib/i18n/it";

const items = [
  { href: "/settings/ai", label: it.settingsNav.ai },
  { href: "/settings/usage", label: it.settingsNav.usage },
  { href: "/settings/account", label: it.settingsNav.account },
] as const;

/** Navigazione delle impostazioni: tab orizzontali su mobile, colonna laterale su desktop. */
export function SettingsNav() {
  const pathname = usePathname();

  return (
    <nav aria-label={it.settingsNav.label} className="md:w-48 md:shrink-0">
      <ul className="flex gap-1 overflow-x-auto border-b p-1 md:flex-col md:border-b-0">
        {items.map((item) => {
          const active = pathname === item.href;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-11 items-center rounded-md px-3 py-2 text-sm font-medium whitespace-nowrap outline-none",
                  "focus-visible:ring-ring focus-visible:ring-2",
                  active
                    ? "bg-accent text-accent-foreground border-brand rounded-b-none border-b-2 font-semibold md:rounded-md md:rounded-l-none md:border-b-0 md:border-l-2"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                )}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
