import { it } from "@/lib/i18n/it";

const t = it.settings.fallback;

/** "Se la mia chiave fallisce, usa Pitock AI". */
export function FallbackToggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label htmlFor="ai-fallback" className="flex min-h-11 cursor-pointer items-start gap-3">
      <input
        id="ai-fallback"
        type="checkbox"
        role="switch"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        aria-labelledby="ai-fallback-label"
        aria-describedby="ai-fallback-hint"
        className="accent-brand focus-visible:ring-ring mt-0.5 size-5 shrink-0 rounded focus-visible:ring-2 focus-visible:outline-none"
      />
      <span className="flex flex-col gap-1">
        <span id="ai-fallback-label" className="text-sm font-medium">
          {t.label}
        </span>
        <span id="ai-fallback-hint" className="text-muted-foreground text-xs">
          {t.hint}
        </span>
      </span>
    </label>
  );
}
