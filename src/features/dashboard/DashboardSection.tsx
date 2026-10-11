import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

/** Gruppo di grafici con titolo breve, icona e una riga che spiega cosa mostrano. */
export function DashboardSection({
  id,
  title,
  description,
  icon: Icon,
  children,
}: {
  id: string;
  title: string;
  description: string;
  icon?: LucideIcon;
  children: ReactNode;
}) {
  return (
    <section
      aria-labelledby={`${id}-heading`}
      className="animate-in fade-in slide-in-from-bottom-4 flex flex-col gap-4 duration-700 motion-reduce:animate-none"
    >
      <div className="flex items-start gap-3">
        {Icon && (
          <span className="dash-section-icon flex size-9 shrink-0 items-center justify-center rounded-xl">
            <Icon className="size-4.5" aria-hidden />
          </span>
        )}
        <div className="min-w-0">
          <h2 id={`${id}-heading`} className="text-lg font-semibold tracking-tight">
            {title}
          </h2>
          <p className="text-muted-foreground text-sm">{description}</p>
        </div>
      </div>
      {children}
    </section>
  );
}
