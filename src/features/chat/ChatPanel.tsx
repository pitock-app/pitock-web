"use client";

import { MessageCircle, SendHorizontal, ShieldAlert, Trash2 } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { isApiError } from "@/lib/api/errors";
import { it } from "@/lib/i18n/it";
import { cn } from "@/lib/utils";
import { ChatChart } from "./ChatChart";
import { useAskChat } from "./hooks/useAskChat";
import { useChatStore, type ChatEntry } from "./store";

const t = it.chat;

function Message({ entry }: { entry: ChatEntry }) {
  if (entry.role === "user") {
    return (
      <li className="bg-brand text-brand-foreground max-w-[85%] self-end rounded-2xl rounded-br-sm px-3 py-2 text-sm whitespace-pre-wrap">
        <span className="sr-only">{t.you}: </span>
        {entry.content}
      </li>
    );
  }
  return (
    <li className="flex max-w-full flex-col gap-2 self-start">
      <p className="bg-muted rounded-2xl rounded-bl-sm px-3 py-2 text-sm whitespace-pre-wrap">
        <span className="sr-only">{t.assistant}: </span>
        {entry.content}
      </p>
      {!entry.grounded && (
        <p className="text-muted-foreground flex items-center gap-1 text-xs">
          <ShieldAlert className="size-3.5" aria-hidden />
          {t.unverified}
        </p>
      )}
      {entry.charts.map((chart, index) => (
        <ChatChart key={index} chart={chart} />
      ))}
    </li>
  );
}

/** Conversazione con l'assistente: domande sulle spese, risposte con i numeri verificati. */
function ChatPanel() {
  const { entries, add, clear } = useChatStore();
  const ask = useAskChat();
  const [draft, setDraft] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [entries.length, ask.isPending]);

  const send = (history: ChatEntry[]) => {
    ask.mutate(history, {
      onSuccess: (res) =>
        add({ role: "assistant", content: res.answer, grounded: res.grounded, charts: res.charts }),
    });
  };

  const submit = (text: string) => {
    const content = text.trim();
    if (!content || ask.isPending) return;
    add({ role: "user", content });
    setDraft("");
    send(useChatStore.getState().entries);
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    submit(draft);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      submit(draft);
    }
  };

  const last = entries.at(-1);
  const failed = ask.isError && last?.role === "user";

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-start justify-between gap-2 border-b p-4 pr-14">
        <div className="flex flex-col gap-1">
          <DialogTitle>{t.title}</DialogTitle>
          <DialogDescription>{t.description}</DialogDescription>
        </div>
        {entries.length > 0 && (
          <Button
            variant="ghost"
            size="icon"
            className="size-11"
            onClick={() => {
              ask.reset();
              clear();
            }}
          >
            <Trash2 aria-hidden />
            <span className="sr-only">{t.clear}</span>
          </Button>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {entries.length === 0 ? (
          <div className="flex flex-col gap-3">
            <p className="text-muted-foreground text-sm">{t.examplesIntro}</p>
            <ul className="flex flex-col gap-2">
              {t.examples.map((example) => (
                <li key={example}>
                  <Button
                    variant="outline"
                    className="h-auto min-h-11 w-full justify-start text-left whitespace-normal"
                    onClick={() => submit(example)}
                  >
                    {example}
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <ol role="log" aria-live="polite" aria-label={t.title} className="flex flex-col gap-3">
            {entries.map((entry) => (
              <Message key={entry.id} entry={entry} />
            ))}
          </ol>
        )}
        {ask.isPending && (
          <p role="status" className="text-muted-foreground mt-3 animate-pulse text-sm">
            {t.thinking}
          </p>
        )}
        {failed && (
          <div role="alert" className="mt-3 flex flex-col items-start gap-2 text-sm">
            <p className="text-destructive">
              {isApiError(ask.error) ? ask.error.message : it.states.errorDescription}
            </p>
            <Button variant="outline" size="sm" className="h-11" onClick={() => send(entries)}>
              {it.states.retry}
            </Button>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <form
        onSubmit={onSubmit}
        className="flex items-end gap-2 border-t p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
      >
        <label htmlFor="chat-input" className="sr-only">
          {t.inputLabel}
        </label>
        <Textarea
          id="chat-input"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder={t.placeholder}
          maxLength={2000}
          rows={1}
          className="max-h-32 min-h-11"
        />
        <Button
          type="submit"
          size="icon"
          className="size-11 shrink-0"
          disabled={!draft.trim() || ask.isPending}
        >
          <SendHorizontal aria-hidden />
          <span className="sr-only">{t.send}</span>
        </Button>
      </form>
    </div>
  );
}

/**
 * Pulsante che apre l'assistente in un pannello da sinistra. `sidebar`: voce della sidebar
 * desktop; `header`: icona nell'header mobile. Entrambi mostrano la stessa conversazione.
 */
export function ChatLauncher({ variant }: { variant: "sidebar" | "header" }) {
  return (
    <Dialog>
      <DialogTrigger
        render={
          variant === "sidebar" ? (
            <button
              type="button"
              className={cn(
                "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors outline-none",
                "focus-visible:ring-ring focus-visible:ring-offset-sidebar focus-visible:ring-2 focus-visible:ring-offset-2",
              )}
            />
          ) : (
            <Button variant="ghost" size="icon" className="size-11" aria-label={t.open} />
          )
        }
      >
        <MessageCircle className={variant === "sidebar" ? "size-4" : undefined} aria-hidden />
        {variant === "sidebar" && t.open}
      </DialogTrigger>
      <DialogContent
        className={cn(
          "top-0 left-0 flex h-dvh max-h-dvh w-full max-w-full translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none p-0 sm:max-w-md",
          "data-open:slide-in-from-left data-closed:slide-out-to-left data-open:zoom-in-100 data-closed:zoom-out-100",
        )}
      >
        <ChatPanel />
      </DialogContent>
    </Dialog>
  );
}
