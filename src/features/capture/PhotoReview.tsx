"use client";

import { Check, Plus, RefreshCw, RotateCw } from "lucide-react";
import type { ReactNode, Ref } from "react";
import { Button } from "@/components/ui/button";
import { it } from "@/lib/i18n/it";

const t = it.capture.camera;

/** Azione principale del tab Foto, nel colore del brand. */
export const PRIMARY_CLASS = "bg-brand text-brand-foreground hover:bg-brand/90";

type PhotoReviewProps = {
  url: string;
  piecesStrip: ReactNode;
  /** Pezzi già scattati prima di questa foto (scontrino lungo). */
  piecesCount: number;
  rotating: boolean;
  stitching: boolean;
  primaryRef: Ref<HTMLButtonElement>;
  onRotate(): void;
  onRetake(): void;
  onAddPiece(): void;
  onConfirm(): void;
};

/** Anteprima della foto appena scattata: ruota, rifai, aggiungi un pezzo o usala. */
export function PhotoReview({
  url,
  piecesStrip,
  piecesCount,
  rotating,
  stitching,
  primaryRef,
  onRotate,
  onRetake,
  onAddPiece,
  onConfirm,
}: PhotoReviewProps) {
  return (
    <div className="flex flex-col items-center gap-4">
      {/* eslint-disable-next-line @next/next/no-img-element -- anteprima locale (blob:) */}
      <img
        src={url}
        alt={t.preview}
        className="bg-muted max-h-[60vh] w-auto max-w-full rounded-xl border object-contain"
      />
      {piecesStrip}
      <div className="flex w-full flex-wrap justify-center gap-2">
        <Button
          type="button"
          variant="outline"
          className="h-11"
          onClick={onRotate}
          disabled={rotating}
        >
          <RotateCw aria-hidden />
          {t.rotate}
        </Button>
        <Button type="button" variant="outline" className="h-11" onClick={onRetake}>
          <RefreshCw aria-hidden />
          {t.retake}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-11"
          onClick={onAddPiece}
          disabled={rotating || stitching}
        >
          <Plus aria-hidden />
          {t.addPiece}
        </Button>
        <Button
          ref={primaryRef}
          type="button"
          className={`h-11 px-5 ${PRIMARY_CLASS}`}
          onClick={onConfirm}
          disabled={rotating || stitching}
        >
          <Check aria-hidden />
          {stitching ? t.stitching : piecesCount > 0 ? t.useStitched(piecesCount + 1) : t.use}
        </Button>
      </div>
      <p className="text-muted-foreground max-w-md text-center text-xs">{t.addPieceHint}</p>
    </div>
  );
}
