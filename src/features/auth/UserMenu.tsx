"use client";

import { LogOut, RotateCw, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { it } from "@/lib/i18n/it";
import { cn } from "@/lib/utils";
import { useMe } from "./hooks/useMe";
import { useSession } from "./hooks/useSession";
import { useSignOut } from "./hooks/useSignOut";

type UserMenuProps = {
  /** "sidebar": email e pulsante Esci; "compact": per l'header mobile. */
  variant?: "sidebar" | "compact";
  className?: string;
};

/** Email dell'utente (da `GET /v1/me`) e logout. */
export function UserMenu({ variant = "sidebar", className }: UserMenuProps) {
  const me = useMe();
  const session = useSession();
  const { signOut, pending } = useSignOut();

  // Se /v1/me fallisce o non ha l'email, ripiega sull'email della sessione.
  const email = me.data?.email ?? (me.isError || me.data ? session.session?.user.email : undefined);
  const compact = variant === "compact";

  return (
    <div className={cn("flex min-w-0 items-center gap-2", className)}>
      <UserRound className="text-muted-foreground size-4 shrink-0" aria-hidden />
      <span className="sr-only">{it.auth.signedInAs}:</span>
      {email ? (
        <span
          data-testid="user-email"
          className={cn("min-w-0 truncate text-sm", compact && "max-w-[40vw] text-xs")}
          title={email}
        >
          {email}
        </span>
      ) : me.isError ? (
        <Button
          variant="ghost"
          size="sm"
          className={cn("text-destructive min-w-0", compact && "h-11")}
          aria-label={it.auth.retryEmail}
          onClick={() => me.refetch()}
        >
          <RotateCw aria-hidden />
          {it.states.retry}
        </Button>
      ) : (
        <Skeleton role="status" className={cn("h-4 w-32", compact && "w-[30vw] max-w-32")}>
          <span className="sr-only">{it.states.loading}</span>
        </Skeleton>
      )}
      <Button
        variant="ghost"
        size={compact ? "icon" : "sm"}
        className={cn("shrink-0", compact ? "size-11" : "ml-auto")}
        onClick={signOut}
        disabled={pending}
        aria-label={compact ? it.auth.logout : undefined}
      >
        <LogOut aria-hidden />
        {!compact && (pending ? it.auth.loggingOut : it.auth.logout)}
      </Button>
    </div>
  );
}
