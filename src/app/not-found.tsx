import Link from "next/link";
import { FileQuestion } from "lucide-react";
import { EmptyState } from "@/components/layout";
import { buttonVariants } from "@/components/ui/button";
import { it } from "@/lib/i18n/it";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-lg items-center px-4">
      <div className="w-full">
        <EmptyState
          icon={FileQuestion}
          headingLevel="h1"
          title={it.states.notFoundTitle}
          description={it.states.notFoundDescription}
          action={
            <Link href="/dashboard" className={buttonVariants()}>
              {it.states.backHome}
            </Link>
          }
        />
      </div>
    </main>
  );
}
