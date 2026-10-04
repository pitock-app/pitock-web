"use client";

import { Inbox } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { it } from "@/lib/i18n/it";
import { useBeforeUnloadWarning } from "./hooks/useBeforeUnloadWarning";
import { useUploadPipeline } from "./hooks/useUploadPipeline";
import { queueErrorMessage } from "./lib/queue-messages";
import { queueOutcome, sortQueue } from "./lib/queue-review";
import { hasActiveUploads, useUploadQueue, type QueueStatus } from "./store/upload-queue.store";
import { UploadQueueItem } from "./UploadQueueItem";

const t = it.capture.queue;

/** Annuncia agli screen reader solo i cambi di stato degli elementi della coda. */
function useStatusAnnouncement() {
  const [message, setMessage] = useState("");
  const previous = useRef(new Map<string, QueueStatus>());
  useEffect(
    () =>
      useUploadQueue.subscribe(({ items }) => {
        const changes: string[] = [];
        for (const item of items) {
          if (previous.current.get(item.id) === item.status) continue;
          const status =
            item.status === "failed"
              ? `${t.status.failed}. ${queueErrorMessage(item.errorCode)}`
              : queueOutcome(item) === "attention"
                ? `${t.attention}. ${t.attentionHint}`
                : t.status[item.status];
          changes.push(t.announce(item.name, status));
        }
        previous.current = new Map(items.map((item) => [item.id, item.status]));
        if (changes.length) setMessage(changes.join(". "));
      }),
    [],
  );
  return message;
}

/** Coda di upload condivisa dai tab Foto e File. */
export function UploadQueue() {
  const items = useUploadQueue((state) => state.items);
  const clearFinished = useUploadQueue((state) => state.clearFinished);
  const pipeline = useUploadPipeline();
  const [removing, setRemoving] = useState<string | null>(null);
  const active = hasActiveUploads(items);
  useBeforeUnloadWarning(active);

  const titleRef = useRef<HTMLHeadingElement>(null);
  const announcement = useStatusAnnouncement();

  const hasFinished = items.some((item) => queueOutcome(item) === "ok");
  const sorted = sortQueue(items);

  async function remove(id: string) {
    setRemoving(id);
    try {
      await pipeline.remove(id);
      titleRef.current?.focus();
    } catch {
      toast.error(queueErrorMessage("DELETE_FAILED"));
    } finally {
      setRemoving(null);
    }
  }

  return (
    <section aria-labelledby="upload-queue-title" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2
          id="upload-queue-title"
          ref={titleRef}
          tabIndex={-1}
          className="text-lg font-semibold outline-none"
        >
          {t.title}
          {items.length > 0 && (
            <span className="text-muted-foreground ml-2 text-sm font-normal">({items.length})</span>
          )}
        </h2>
        {hasFinished && (
          <Button type="button" variant="ghost" className="h-11" onClick={clearFinished}>
            {t.clearFinished}
          </Button>
        )}
      </div>
      {active && <p className="text-muted-foreground text-xs">{t.leaveWarning}</p>}
      {items.length === 0 ? (
        <p className="text-muted-foreground flex items-center gap-2 rounded-xl border border-dashed p-4 text-sm">
          <Inbox className="size-4 shrink-0" aria-hidden />
          {t.empty}
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {sorted.map((item) => (
            <UploadQueueItem
              key={item.id}
              item={item}
              removing={removing === item.id}
              onRetry={(id) => void pipeline.retry(id)}
              onRemove={(id) => void remove(id)}
              onDismiss={(id) => {
                pipeline.dismiss(id);
                titleRef.current?.focus();
              }}
            />
          ))}
        </ul>
      )}
      <p role="status" className="sr-only">
        {announcement}
      </p>
    </section>
  );
}
