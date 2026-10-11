"use client";

import { Check, Layers, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { it } from "@/lib/i18n/it";
import { PRIMARY_CLASS } from "./PhotoReview";

const t = it.capture.camera;

type PiecesStripProps = {
  /** Pezzi già scattati di uno scontrino lungo, in ordine. */
  pieces: { url: string }[];
  /** Senza una foto in revisione: si può usare o scartare quello che c'è. */
  showActions: boolean;
  stitching: boolean;
  onConfirm(): void;
  onDiscard(): void;
};

/** Miniature dei pezzi di uno scontrino lungo, da unire in un'unica immagine. */
export function PiecesStrip({
  pieces,
  showActions,
  stitching,
  onConfirm,
  onDiscard,
}: PiecesStripProps) {
  if (pieces.length === 0) return null;
  return (
    <section
      aria-label={t.pieces(pieces.length)}
      className="bg-muted/50 flex w-full max-w-2xl flex-col gap-3 rounded-xl border p-3 text-left"
    >
      <div className="flex items-center gap-2 text-sm font-medium">
        <Layers className="size-4" aria-hidden />
        {t.pieces(pieces.length)}
      </div>
      <ol className="flex gap-2 overflow-x-auto">
        {pieces.map((piece, index) => (
          <li key={piece.url} className="shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element -- anteprima locale (blob:) */}
            <img
              src={piece.url}
              alt={t.piece(index + 1)}
              className="bg-background h-24 w-auto rounded-md border object-contain"
            />
          </li>
        ))}
      </ol>
      {showActions && (
        <>
          <p className="text-muted-foreground text-sm">{t.piecesHint}</p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              className={`h-11 ${PRIMARY_CLASS}`}
              onClick={onConfirm}
              disabled={stitching}
            >
              <Check aria-hidden />
              {stitching ? t.stitching : pieces.length === 1 ? t.use : t.useStitched(pieces.length)}
            </Button>
            <Button type="button" variant="outline" className="h-11" onClick={onDiscard}>
              <X aria-hidden />
              {t.discardPieces}
            </Button>
          </div>
        </>
      )}
    </section>
  );
}
