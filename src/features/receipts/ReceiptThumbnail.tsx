"use client";

import { useState } from "react";
import type { components } from "@/lib/api/schema";
import { cn } from "@/lib/utils";
import { safeFileUrl } from "./lib/file-url";
import { sourceIcons } from "./SourceBadge";

type ReceiptListItem = components["schemas"]["ReceiptListItem"];

/** Miniatura del file oppure icona della sorgente. Decorativa: il testo è nella riga. */
export function ReceiptThumbnail({
  item,
  className,
}: {
  item: Pick<ReceiptListItem, "source" | "thumbnailUrl">;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const url = failed ? undefined : safeFileUrl(item.thumbnailUrl);
  const Icon = sourceIcons[item.source];
  return (
    <span
      className={cn(
        "bg-muted text-muted-foreground flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border",
        className,
      )}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element -- URL firmato e temporaneo dello Storage
        <img
          src={url}
          alt=""
          loading="lazy"
          className="size-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <Icon className="size-5" aria-hidden />
      )}
    </span>
  );
}
