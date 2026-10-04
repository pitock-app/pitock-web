import Link from "next/link";
import { FileQuestion } from "lucide-react";
import { EmptyState } from "@/components/layout";
import { buttonVariants } from "@/components/ui/button";
import { it } from "@/lib/i18n/it";

/** `notFound()` dalle pagine dell'app (per esempio un id non valido): dentro la shell. */
export default function AppNotFound() {
  return (
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
  );
}
