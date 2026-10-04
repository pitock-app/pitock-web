import Link from "next/link";
import type { ReactNode } from "react";
import { it } from "@/lib/i18n/it";
import { BottomNav } from "./BottomNav";
import { Logo } from "./Logo";
import { Sidebar } from "./Sidebar";
import { ThemeToggle } from "./ThemeToggle";

type AppShellProps = {
  children: ReactNode;
  /** Riquadro dell'account in fondo alla sidebar (desktop). */
  sidebarAccount?: ReactNode;
  /** Riquadro dell'account nell'header (mobile). */
  headerAccount?: ReactNode;
};

/** Shell dell'app: sidebar su desktop, header e bottom nav su mobile. */
export function AppShell({ children, sidebarAccount, headerAccount }: AppShellProps) {
  return (
    <div className="flex min-h-dvh">
      <a
        href="#main"
        className="bg-brand text-brand-foreground sr-only z-50 rounded-md px-3 py-2 focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        {it.nav.skipToContent}
      </a>
      <Sidebar account={sidebarAccount} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="bg-background/95 sticky top-0 z-30 flex h-14 items-center justify-between border-b pr-[max(1rem,env(safe-area-inset-right))] pl-[max(1rem,env(safe-area-inset-left))] backdrop-blur md:hidden">
          <Link
            href="/dashboard"
            className="focus-visible:ring-ring rounded-md focus-visible:ring-2"
          >
            <Logo size={28} />
          </Link>
          <div className="flex min-w-0 items-center gap-1">
            {headerAccount}
            <ThemeToggle />
          </div>
        </header>
        <main
          id="main"
          tabIndex={-1}
          className="mx-auto w-full max-w-6xl flex-1 pt-6 pr-[max(1rem,env(safe-area-inset-right))] pb-[calc(6rem+env(safe-area-inset-bottom))] pl-[max(1rem,env(safe-area-inset-left))] outline-none md:px-8 md:pb-10"
        >
          {children}
        </main>
      </div>
      <BottomNav />
    </div>
  );
}
