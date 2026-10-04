import type { ReactNode } from "react";
import { AppShell } from "@/components/layout";
import { UserMenu } from "@/features/auth";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <AppShell
      sidebarAccount={<UserMenu variant="sidebar" />}
      headerAccount={<UserMenu variant="compact" />}
    >
      {children}
    </AppShell>
  );
}
