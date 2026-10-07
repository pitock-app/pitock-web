"use client";

import { Download, LogOut, RotateCw } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useMe, useSession, useSignOut } from "@/features/auth";
import { api, unwrap } from "@/lib/api/client";
import { it } from "@/lib/i18n/it";
import { DeleteAccountDialog } from "./DeleteAccountDialog";

const t = it.settings.account;

/** Portabilità (art. 20 GDPR): scontrini e righe estratti in JSON; i file originali dal dettaglio. */
async function exportData() {
  const data = await unwrap(api.GET("/v1/stats/dataset", {}));
  const link = document.createElement("a");
  link.href = URL.createObjectURL(
    new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
  );
  link.download = "pitock-export.json";
  link.click();
  URL.revokeObjectURL(link.href);
}

/** Account (`/settings/account`): email, logout, eliminazione dell'account. */
export function AccountInfo() {
  const me = useMe();
  const session = useSession();
  const { signOut, pending } = useSignOut();
  // Se /v1/me fallisce o non ha l'email, si usa quella della sessione.
  const email = me.data?.email ?? (me.isPending ? undefined : session.session?.user.email);

  return (
    <div className="flex flex-col gap-6">
      <section
        aria-labelledby="account-title"
        className="bg-card flex flex-col gap-4 rounded-xl border p-4"
      >
        <h2 id="account-title" className="font-semibold">
          {t.title}
        </h2>
        <dl className="flex flex-col gap-1">
          <dt className="text-muted-foreground text-sm">{t.email}</dt>
          <dd className="break-all">
            {email ??
              (me.isError ? (
                <span className="flex flex-wrap items-center gap-2">
                  <span className="text-destructive text-sm">{t.emailError}</span>
                  <Button variant="outline" className="h-11" onClick={() => void me.refetch()}>
                    <RotateCw aria-hidden />
                    {it.states.retry}
                  </Button>
                </span>
              ) : (
                <Skeleton role="status" className="h-5 w-48">
                  <span className="sr-only">{it.states.loading}</span>
                </Skeleton>
              ))}
          </dd>
        </dl>
        <div className="flex flex-wrap items-center gap-3 border-t pt-4">
          <Button variant="outline" className="h-11" onClick={() => void exportData()}>
            <Download aria-hidden />
            {t.export}
          </Button>
          <Link href="/legal" className="text-sm underline underline-offset-4">
            {t.legal}
          </Link>
        </div>
        <div className="flex flex-col gap-2 border-t pt-4">
          <p className="text-muted-foreground text-sm">{t.logoutDescription}</p>
          <Button
            variant="outline"
            className="h-11 self-start"
            onClick={signOut}
            disabled={pending}
          >
            <LogOut aria-hidden />
            {pending ? it.auth.loggingOut : it.auth.logout}
          </Button>
        </div>
      </section>
      <section
        aria-labelledby="account-danger-title"
        className="border-destructive/40 flex flex-col gap-3 rounded-xl border p-4"
      >
        <h2 id="account-danger-title" className="text-destructive font-semibold">
          {t.dangerTitle}
        </h2>
        <p className="text-muted-foreground text-sm">{t.dangerDescription}</p>
        <div>
          <DeleteAccountDialog />
        </div>
      </section>
    </div>
  );
}
