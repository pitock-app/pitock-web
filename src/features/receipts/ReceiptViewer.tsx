"use client";

import { ExternalLink, FileText, FileX, Maximize, PenLine, ZoomIn, ZoomOut } from "lucide-react";
import { useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { components } from "@/lib/api/schema";
import { it } from "@/lib/i18n/it";
import { cn } from "@/lib/utils";
import { safeFileUrl } from "./lib/file-url";

type Receipt = components["schemas"]["Receipt"];

const t = it.receipt.viewer;
const ZOOM_LEVELS = [1, 1.5, 2, 3] as const;

function Placeholder({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof PenLine;
  title: string;
  description: string;
}) {
  return (
    <div className="bg-muted/40 flex min-h-48 flex-col items-center justify-center gap-2 rounded-xl border border-dashed p-6 text-center">
      <Icon className="text-muted-foreground size-8" aria-hidden />
      <p className="font-semibold">{title}</p>
      <p className="text-muted-foreground max-w-xs text-sm">{description}</p>
    </div>
  );
}

function OpenFileLink({ url }: { url: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      referrerPolicy="no-referrer"
      className={cn(buttonVariants({ variant: "outline" }), "h-11")}
    >
      <ExternalLink aria-hidden />
      {t.openFile}
    </a>
  );
}

function ImageViewer({ url }: { url: string }) {
  const [zoomIndex, setZoomIndex] = useState(0);
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const zoom = ZOOM_LEVELS[zoomIndex];

  if (failed)
    return <Placeholder icon={FileX} title={t.imageError} description={t.unavailableDescription} />;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label={t.title}>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-11"
          aria-label={t.zoomOut}
          disabled={zoomIndex === 0}
          onClick={() => setZoomIndex((index) => Math.max(0, index - 1))}
        >
          <ZoomOut aria-hidden />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-11"
          aria-label={t.zoomIn}
          disabled={zoomIndex === ZOOM_LEVELS.length - 1}
          onClick={() => setZoomIndex((index) => Math.min(ZOOM_LEVELS.length - 1, index + 1))}
        >
          <ZoomIn aria-hidden />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-11"
          aria-label={t.zoomReset}
          disabled={zoomIndex === 0}
          onClick={() => setZoomIndex(0)}
        >
          <Maximize aria-hidden />
        </Button>
        <span className="text-muted-foreground text-sm tabular-nums" aria-live="polite">
          {t.zoomLevel(Math.round(zoom * 100))}
        </span>
        <span className="ml-auto">
          <OpenFileLink url={url} />
        </span>
      </div>
      {/* Area scorrevole: con lo zoom l'immagine si esplora scorrendo, anche da tastiera. */}
      <div
        className="bg-muted/40 focus-visible:ring-ring max-h-[70vh] overflow-auto rounded-xl border focus-visible:ring-2 focus-visible:outline-none"
        tabIndex={0}
        role="region"
        aria-label={t.image}
      >
        {!loaded && <Skeleton className="aspect-[3/4] w-full rounded-none" aria-hidden />}
        {/* eslint-disable-next-line @next/next/no-img-element -- URL firmato e temporaneo dello Storage */}
        <img
          src={url}
          alt={t.image}
          className={cn("block h-auto max-w-none", !loaded && "sr-only")}
          style={{ width: `${zoom * 100}%` }}
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
        />
      </div>
    </div>
  );
}

function PdfViewer({ url }: { url: string }) {
  return (
    <div className="flex flex-col gap-2">
      {/* Sui telefoni il PDF incorporato spesso non si vede: si apre in una nuova scheda. */}
      <div className="bg-muted/40 flex flex-col items-center gap-3 rounded-xl border border-dashed p-6 text-center md:hidden">
        <FileText className="text-muted-foreground size-8" aria-hidden />
        <p className="text-sm">{t.pdfMobile}</p>
        <OpenFileLink url={url} />
      </div>
      <div className="hidden justify-end md:flex">
        <OpenFileLink url={url} />
      </div>
      {/* Niente sandbox: il visualizzatore PDF del browser non funziona in un iframe isolato.
          L'URL è già limitato ai file firmati del nostro Storage (safeFileUrl). */}
      <iframe
        src={url}
        title={t.pdf}
        referrerPolicy="no-referrer"
        className="hidden h-[70vh] w-full rounded-xl border bg-white md:block"
      />
    </div>
  );
}

/** File originale: immagine con zoom, PDF incorporato o riquadro per gli inserimenti manuali. */
export function ReceiptViewer({ receipt, fileUrl }: { receipt: Receipt; fileUrl?: string }) {
  if (receipt.source === "manual") {
    return <Placeholder icon={PenLine} title={t.manualTitle} description={t.manualDescription} />;
  }
  const url = safeFileUrl(fileUrl);
  if (!url) {
    return (
      <Placeholder icon={FileX} title={t.unavailableTitle} description={t.unavailableDescription} />
    );
  }
  if (receipt.mimeType === "application/pdf") return <PdfViewer url={url} />;
  // Un nuovo URL firmato ricomincia da capo (caricamento ed eventuale errore).
  return <ImageViewer key={url} url={url} />;
}
