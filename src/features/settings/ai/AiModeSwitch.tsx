import { Bot, KeyRound } from "lucide-react";
import type { components } from "@/lib/api/schema";
import { it } from "@/lib/i18n/it";
import { cn } from "@/lib/utils";

type AiMode = components["schemas"]["AiMode"];

const t = it.settings.ai;
const OPTIONS: { value: AiMode; icon: typeof Bot }[] = [
  { value: "platform", icon: Bot },
  { value: "byok", icon: KeyRound },
];

/** Interruttore "Pitock AI" / "La mia chiave": un gruppo di radio con l'aspetto di card. */
export function AiModeSwitch({
  value,
  onChange,
}: {
  value: AiMode;
  onChange: (mode: AiMode) => void;
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-sm font-medium">{t.modeLabel}</legend>
      <div className="grid gap-3 sm:grid-cols-2">
        {OPTIONS.map(({ value: mode, icon: Icon }) => {
          const checked = value === mode;
          return (
            <label
              key={mode}
              className={cn(
                "has-focus-visible:ring-ring flex cursor-pointer gap-3 rounded-xl border p-4 has-focus-visible:ring-2",
                checked ? "border-brand bg-brand/10 border-2" : "hover:bg-accent",
              )}
            >
              <input
                type="radio"
                name="ai-mode"
                value={mode}
                checked={checked}
                onChange={() => onChange(mode)}
                className="accent-brand mt-1 size-4 shrink-0"
                aria-describedby={`ai-mode-${mode}-description`}
              />
              <span className="flex flex-col gap-1">
                <span className="flex items-center gap-2 font-medium">
                  <Icon className="size-4" aria-hidden />
                  {t.modes[mode]}
                </span>
                <span id={`ai-mode-${mode}-description`} className="text-muted-foreground text-sm">
                  {t.modeDescriptions[mode]}
                </span>
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
