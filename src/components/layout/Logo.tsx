import Image from "next/image";
import { cn } from "@/lib/utils";
import { it } from "@/lib/i18n/it";

type LogoProps = {
  className?: string;
  /** Mostra il nome accanto all'icona. */
  withName?: boolean;
  size?: number;
};

export function Logo({ className, withName = true, size = 32 }: LogoProps) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <Image
        src="/logo.png"
        alt={withName ? "" : it.app.name}
        width={size}
        height={size}
        className="dark:hidden"
        priority
      />
      <Image
        src="/logo-light.png"
        alt={withName ? "" : it.app.name}
        width={size}
        height={size}
        className="hidden dark:block"
        priority
      />
      {withName && <span className="text-lg font-bold tracking-tight">{it.app.name}</span>}
    </span>
  );
}
