import type { ReactNode } from "react";
import { Logo } from "@/components/layout";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-8 px-4 py-10">
      <Logo size={40} />
      {children}
    </main>
  );
}
