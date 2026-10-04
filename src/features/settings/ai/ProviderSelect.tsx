import { Field, NativeSelect } from "@/components/form";
import { aiProviders } from "@/lib/api/enums";
import { it } from "@/lib/i18n/it";
import type { Provider } from "../hooks/useAiSettings";

/** Provider della propria chiave: Anthropic, OpenAI, OpenRouter. */
export function ProviderSelect({
  value,
  onChange,
}: {
  value: Provider;
  onChange: (provider: Provider) => void;
}) {
  return (
    <Field id="ai-provider" label={it.settings.ai.provider}>
      {(control) => (
        <NativeSelect
          {...control}
          value={value}
          onChange={(event) => {
            const next = aiProviders.find((provider) => provider === event.target.value);
            if (next) onChange(next);
          }}
        >
          {aiProviders.map((provider) => (
            <option key={provider} value={provider}>
              {it.aiProviders[provider]}
            </option>
          ))}
        </NativeSelect>
      )}
    </Field>
  );
}
