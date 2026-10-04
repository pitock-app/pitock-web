import { Skeleton } from "@/components/ui/skeleton";
import { it } from "@/lib/i18n/it";

/** Mentre arriva una pagina dell'app (navigazione o primo caricamento). */
export default function AppLoading() {
  return (
    <div role="status" aria-busy="true" className="flex flex-col gap-4">
      <span className="sr-only">{it.states.loading}</span>
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-4 w-72 max-w-full" />
      <Skeleton className="h-40 w-full rounded-xl" />
      <Skeleton className="h-40 w-full rounded-xl" />
    </div>
  );
}
