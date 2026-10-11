import { it } from "@/lib/i18n/it";
import type { AvoidabilityBucket } from "./lib/avoidability";
import { AVOIDABILITY_COLORS, UNCLASSIFIED_OPACITY } from "./lib/colors";

const t = it.dashboard.avoidability;

/** Opacità di ciò che non è in evidenza mentre si passa sopra a un periodo o a un livello. */
export const DIMMED = 0.25;

export const bucketLabel = (bucket: AvoidabilityBucket) =>
  bucket === "unclassified" ? t.unclassified : it.avoidability[bucket];
export const bucketOpacity = (bucket: AvoidabilityBucket) =>
  bucket === "unclassified" ? UNCLASSIFIED_OPACITY : 1;

/** Riga o chip cliccabile di un livello. */
export const LEVEL_BUTTON =
  "hover:bg-muted/60 focus-visible:ring-ring/50 rounded-md outline-none focus-visible:ring-[3px]";

/** Quadratino del colore di un livello, con la stessa opacità del grafico. */
export function Swatch({ bucket }: { bucket: AvoidabilityBucket }) {
  return (
    <span
      className="size-3 shrink-0 rounded-sm"
      style={{ background: AVOIDABILITY_COLORS[bucket], opacity: bucketOpacity(bucket) }}
      aria-hidden
    />
  );
}
