"use client";

import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { ErrorState } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { apiErrorMessage, isApiError } from "@/lib/api/errors";
import type { components } from "@/lib/api/schema";
import { it } from "@/lib/i18n/it";
import { useAiSettings, useUpdateAiSettings, type Provider } from "../hooks/useAiSettings";
import { PlatformQuotaBar } from "../PlatformQuotaBar";
import { AiModeSwitch } from "./AiModeSwitch";
import { ApiKeyField } from "./ApiKeyField";
import { FallbackToggle } from "./FallbackToggle";
import { isValidModelId, ModelPicker } from "./ModelPicker";
import { ProviderSelect } from "./ProviderSelect";
import { TestConfigButton } from "./TestConfigButton";

type Schemas = components["schemas"];
type AiSettings = Schemas["AiSettings"];
type Draft = {
  mode: Schemas["AiMode"];
  provider: Provider;
  model: string;
  fallbackToPlatform: boolean;
};

const t = it.settings.ai;

/** Valori iniziali del form: il provider è quello salvato o il primo con una chiave. */
function toDraft(settings: AiSettings): Draft {
  return {
    mode: settings.mode,
    provider: settings.provider ?? settings.keys[0]?.provider ?? "anthropic",
    model: settings.model ?? "",
    fallbackToPlatform: settings.fallbackToPlatform,
  };
}

function isDirty(draft: Draft, settings: AiSettings): boolean {
  if (draft.mode !== settings.mode) return true;
  if (draft.mode === "platform") return false;
  return (
    draft.provider !== settings.provider ||
    draft.model !== (settings.model ?? "") ||
    draft.fallbackToPlatform !== settings.fallbackToPlatform
  );
}

/** Impostazioni del provider AI (`/settings/ai`). */
export function AiSettingsView() {
  const settings = useAiSettings();

  if (settings.isPending) {
    return (
      <div role="status" aria-label={it.settings.loading} className="flex flex-col gap-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
        </div>
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-11 w-full" />
      </div>
    );
  }

  if (settings.isError) {
    return (
      <ErrorState
        description={isApiError(settings.error) ? settings.error.message : it.settings.loadError}
        onRetry={() => void settings.refetch()}
      />
    );
  }

  return <AiSettingsForm settings={settings.data} />;
}

function AiSettingsForm({ settings }: { settings: AiSettings }) {
  const [draft, setDraft] = useState<Draft>(() => toDraft(settings));
  const [errors, setErrors] = useState<{ model?: string; form?: string }>({});
  const update = useUpdateAiSettings();
  const keyInfo = settings.keys.find((key) => key.provider === draft.provider);
  const providerName = it.aiProviders[draft.provider];
  const dirty = isDirty(draft, settings);

  const change = (patch: Partial<Draft>) => {
    setErrors({});
    setDraft((current) => ({ ...current, ...patch }));
  };

  const changeProvider = (provider: Provider) =>
    change({
      provider,
      // Il modello salvato vale solo per il suo provider.
      model: provider === settings.provider ? (settings.model ?? "") : "",
    });

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    let body: Schemas["AiSettingsInput"];
    if (draft.mode === "platform") {
      body = { mode: "platform" };
    } else {
      if (!keyInfo) {
        setErrors({ form: t.needsKey(providerName) });
        return;
      }
      if (!draft.model || !isValidModelId(draft.model)) {
        setErrors({ model: it.settings.ai.needsModel });
        document.getElementById("ai-model")?.focus();
        return;
      }
      body = {
        mode: "byok",
        provider: draft.provider,
        model: draft.model,
        fallbackToPlatform: draft.fallbackToPlatform,
      };
    }
    try {
      const saved = await update.mutateAsync(body);
      setDraft(toDraft(saved));
      toast.success(t.saved);
    } catch (err) {
      setErrors({ form: isApiError(err) ? err.message : apiErrorMessage("UNKNOWN") });
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <form id="ai-settings-form" onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
        <AiModeSwitch value={draft.mode} onChange={(mode) => change({ mode })} />

        {draft.mode === "platform" ? (
          <PlatformQuotaBar quota={settings.platformQuota} className="rounded-xl border p-4" />
        ) : (
          <div className="flex flex-col gap-5 rounded-xl border p-4">
            <ProviderSelect value={draft.provider} onChange={changeProvider} />
            <ApiKeyField key={`key-${draft.provider}`} provider={draft.provider} info={keyInfo} />
            <ModelPicker
              key={`model-${draft.provider}`}
              provider={draft.provider}
              value={draft.model}
              onChange={(model) => change({ model })}
              hasKey={keyInfo !== undefined}
              error={errors.model}
            />
            <FallbackToggle
              checked={draft.fallbackToPlatform}
              onChange={(fallbackToPlatform) => change({ fallbackToPlatform })}
            />
            <TestConfigButton
              provider={draft.provider}
              model={keyInfo && draft.model && isValidModelId(draft.model) ? draft.model : null}
            />
          </div>
        )}
      </form>

      <div className="flex flex-col gap-2 border-t pt-4">
        {errors.form && (
          <p role="alert" className="text-destructive text-sm">
            {errors.form}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="submit"
            form="ai-settings-form"
            className="bg-brand text-brand-foreground hover:bg-brand/90 h-11"
            disabled={update.isPending}
          >
            {update.isPending ? t.saving : t.save}
          </Button>
          {dirty && <p className="text-muted-foreground text-sm">{t.unsaved}</p>}
        </div>
      </div>
    </div>
  );
}
