"use client";

import { Menu } from "@base-ui/react/menu";
import { ChartColumn, ChevronsUpDown, LogOut, RotateCw, Sparkles, UserRound } from "lucide-react";
import Link from "next/link";
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

const settingsItems = [
  { href: "/settings/ai", label: it.settingsNav.ai, icon: Sparkles },
  { href: "/settings/usage", label: it.settingsNav.usage, icon: ChartColumn },
  { href: "/settings/account", label: it.settingsNav.account, icon: UserRound },
] as const;

/** Email dell'utente (da `GET /v1/me`), menu con le impostazioni e logout. */
export function UserMenu({ variant = "sidebar", className }: UserMenuProps) {
  const me = useMe();
  const session = useSession();
  const { signOut, pending } = useSignOut();

  // Se /v1/me fallisce o non ha l'email, ripiega sull'email della sessione.
  const email = me.data?.email ?? (me.isError || me.data ? session.session?.user.email : undefined);
  const compact = variant === "compact";

  return (
    <div className={cn("flex min-w-0 items-center gap-2", className)}>
      {email ? (
        <Menu.Root>
          <Menu.Trigger
            aria-label={`${it.auth.accountMenu}: ${email}`}
            className={cn(
              "hover:bg-accent hover:text-accent-foreground data-popup-open:bg-accent flex min-w-0 items-center gap-2 rounded-md px-2 py-1.5 text-left outline-none",
              "focus-visible:ring-ring focus-visible:ring-2",
              compact ? "h-11" : "flex-1",
            )}
          >
            <UserRound className="text-muted-foreground size-4 shrink-0" aria-hidden />
            <span
              data-testid="user-email"
              className={cn("min-w-0 truncate text-sm", compact && "max-w-[40vw] text-xs")}
              title={email}
            >
              {email}
            </span>
            {!compact && (
              <ChevronsUpDown
                className="text-muted-foreground ml-auto size-4 shrink-0"
                aria-hidden
              />
            )}
          </Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner
              side={compact ? "bottom" : "top"}
              align={compact ? "end" : "start"}
              sideOffset={6}
              className="z-50 outline-none"
            >
              <Menu.Popup className="bg-popover text-popover-foreground ring-foreground/10 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 min-w-52 rounded-lg p-1 shadow-md ring-1 duration-100 outline-none">
                <Menu.Group>
                  <Menu.GroupLabel className="text-muted-foreground px-2 py-1.5 text-xs font-medium">
                    {it.nav.settings}
                  </Menu.GroupLabel>
                  {settingsItems.map((item) => {
                    const Icon = item.icon;
                    return (
                      <Menu.LinkItem
                        key={item.href}
                        closeOnClick
                        render={<Link href={item.href} />}
                        className="data-highlighted:bg-accent data-highlighted:text-accent-foreground flex min-h-9 items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none"
                      >
                        <Icon className="text-muted-foreground size-4" aria-hidden />
                        {item.label}
                      </Menu.LinkItem>
                    );
                  })}
                </Menu.Group>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
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
