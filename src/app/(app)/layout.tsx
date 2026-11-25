import type { ReactNode } from "react";
import { AppShell } from "@/components/layout";
import { UserMenu } from "@/features/auth";
import { ChatLauncher } from "@/features/chat";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <AppShell
      sidebarAccount={<UserMenu variant="sidebar" />}
      headerAccount={<UserMenu variant="compact" />}
      sidebarChat={<ChatLauncher variant="sidebar" />}
      headerChat={<ChatLauncher variant="header" />}
    >
      {children}
    </AppShell>
  );
}
