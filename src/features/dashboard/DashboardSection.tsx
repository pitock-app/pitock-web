import type { ReactNode } from "react";

/** Gruppo di grafici con titolo breve e una riga che spiega cosa mostrano. */
export function DashboardSection({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={`${id}-heading`} className="flex flex-col gap-4">
      <div>
        <h2 id={`${id}-heading`} className="text-lg font-semibold tracking-tight">
          {title}
        </h2>
        <p className="text-muted-foreground text-sm">{description}</p>
      </div>
      {children}
    </section>
  );
}
