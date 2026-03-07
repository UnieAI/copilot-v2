"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  Plus,
  RefreshCw,
  ToggleLeft,
  ToggleRight,
  Trash2,
  X,
} from "lucide-react";
import { GroupProvider, UNIEAI_PROVIDER_KEY, UNIEAI_PROVIDER_URL } from "./group-types";
import { UnieAIIcon } from "@/components/sidebar/unieai-logo";

type ModelItem = {
  id: string;
  object?: string;
  [key: string]: unknown;
};

type ProviderFormState = {
  displayName: string;
  prefix: string;
  apiUrl: string;
  apiKey: string;
  enable: boolean;
};

const getModelId = (model: ModelItem) => model.id || String(model);

function ProviderCard({
  groupId,
  provider,
  onUpdate,
  onDelete,
  canEdit,
}: {
  groupId: string;
  provider: GroupProvider;
  onUpdate: (updated: GroupProvider) => void;
  onDelete: () => void;
  canEdit: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [form, setForm] = useState<ProviderFormState>({
    displayName: provider.displayName,
    prefix: provider.prefix,
    apiUrl: provider.apiUrl,
    apiKey: provider.apiKey,
    enable: provider.enable === 1,
  });
  const [models, setModels] = useState<ModelItem[]>(
    Array.isArray(provider.modelList) ? (provider.modelList as ModelItem[]) : []
  );
  const [selectedModelIds, setSelectedModelIds] = useState<string[]>(
    Array.isArray(provider.selectedModels) ? provider.selectedModels : []
  );

  useEffect(() => {
    setForm({
      displayName: provider.displayName,
      prefix: provider.prefix,
      apiUrl: provider.apiUrl,
      apiKey: provider.apiKey,
      enable: provider.enable === 1,
    });
    setModels(Array.isArray(provider.modelList) ? (provider.modelList as ModelItem[]) : []);
    setSelectedModelIds(Array.isArray(provider.selectedModels) ? provider.selectedModels : []);
  }, [provider]);

  const applyUnieAIProviderDefaults = () => {
    if (!UNIEAI_PROVIDER_URL) {
      toast.error("NEXT_PUBLIC_UNIEAI_PROVIDER_URL is not set");
      return;
    }
    if (!UNIEAI_PROVIDER_KEY) {
      toast.error("NEXT_PUBLIC_UNIEAI_PROVIDER_KEY is not set");
      return;
    }
    setForm((prev) => ({
      ...prev,
      apiUrl: UNIEAI_PROVIDER_URL,
      apiKey: UNIEAI_PROVIDER_KEY,
    }));
  };

  const handleToggleEnable = async () => {
    if (!canEdit) return;
    const nextEnable = !form.enable;
    setForm((prev) => ({ ...prev, enable: nextEnable }));
    try {
      const res = await fetch(`/api/admin/groups/${groupId}/providers/${provider.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enable: nextEnable }),
      });
      if (!res.ok) throw new Error();
      const updated = await res.json();
      onUpdate({
        ...provider,
        ...updated,
        modelList: Array.isArray(updated.modelList) ? updated.modelList : models,
        selectedModels: Array.isArray(updated.selectedModels) ? updated.selectedModels : selectedModelIds,
      });
      toast.success(nextEnable ? "Provider enabled" : "Provider disabled");
    } catch {
      setForm((prev) => ({ ...prev, enable: !nextEnable }));
      toast.error("Update failed");
    }
  };

  const handleSave = async () => {
    if (!canEdit) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/groups/${groupId}/providers/${provider.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: form.displayName,
          apiUrl: form.apiUrl,
          apiKey: form.apiKey,
          enable: form.enable,
          modelList: models,
          selectedModels: selectedModelIds,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Save failed");
      }
      const updated = await res.json();
      onUpdate({
        ...provider,
        ...updated,
        modelList: Array.isArray(updated.modelList) ? updated.modelList : models,
        selectedModels: Array.isArray(updated.selectedModels) ? updated.selectedModels : selectedModelIds,
      });
      toast.success("Saved");
    } catch (e: any) {
      toast.error(e.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleSync = async () => {
    if (!canEdit) return;
    setSyncing(true);
    try {
      const res = await fetch(`/api/admin/groups/${groupId}/providers/${provider.id}/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiUrl: form.apiUrl.trim(),
          apiKey: form.apiKey.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      const nextModels = Array.isArray(data.modelList) ? data.modelList : [];
      const nextSelected = Array.isArray(data.selectedModels) ? data.selectedModels : [];
      setModels(nextModels);
      setSelectedModelIds(nextSelected);
      onUpdate({
        ...provider,
        ...data.provider,
        modelList: nextModels,
        selectedModels: nextSelected,
      });
      if (!res.ok) {
        throw new Error(data.error || "Sync models failed");
      }
      toast.success(`Synced ${nextModels.length} models`);
      setExpanded(true);
    } catch (e: any) {
      toast.error(e.message || "Sync models failed");
    } finally {
      setSyncing(false);
    }
  };

  const handleDelete = async () => {
    if (!canEdit) return;
    if (!confirm(`Delete Provider "${form.displayName || form.prefix}"?`)) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/groups/${groupId}/providers/${provider.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      onDelete();
      toast.success("Provider deleted");
    } catch {
      toast.error("Delete failed");
    } finally {
      setDeleting(false);
    }
  };

  const selectedCount = selectedModelIds.length;
  const totalCount = models.length;

  return (
    <div
      className={`rounded-2xl border transition-colors ${form.enable ? "border-border bg-background" : "border-border/50 bg-muted/30"
        }`}
    >
      <div className="flex items-center gap-3 px-4 py-3">
        <button
          type="button"
          onClick={handleToggleEnable}
          disabled={!canEdit}
          className={`shrink-0 transition-colors ${form.enable ? "text-primary" : "text-muted-foreground/50"
            } disabled:opacity-50`}
          title={form.enable ? "Disable provider" : "Enable provider"}
        >
          {form.enable ? <ToggleRight className="h-5 w-5" /> : <ToggleLeft className="h-5 w-5" />}
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm truncate">{form.displayName || "Untitled Provider"}</span>
            <span className="text-[10px] font-mono bg-primary/10 text-primary px-1.5 py-0.5 rounded font-bold tracking-wider shrink-0">
              {form.prefix}
            </span>
            {!form.enable && (
              <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded shrink-0">
                Disabled
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground truncate">
            {canEdit ? `${form.apiUrl || "No API URL"} | ` : ""}
            {selectedCount}/{totalCount} selected models
          </p>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground"
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting || !canEdit}
            className="p-1.5 rounded-lg hover:bg-destructive/10 hover:text-destructive transition-colors text-muted-foreground disabled:opacity-50"
            title="Delete provider"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-4 space-y-4 border-t border-border/40 pt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium">顯示名稱</label>
              <input
                type="text"
                value={form.displayName}
                onChange={(e) => setForm((prev) => ({ ...prev, displayName: e.target.value }))}
                placeholder="e.g. OpenAI"
                disabled={!canEdit}
                className="w-full h-9 rounded-xl border border-input/60 bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all disabled:opacity-60"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium">
                Prefix（4碼英數字，唯一識別）<span className="text-destructive">*</span>
              </label>
              <input
                type="text"
                value={form.prefix}
                disabled
                className="w-full h-9 rounded-xl border border-input/60 bg-background px-3 text-sm font-mono uppercase disabled:opacity-60"
              />
            </div>

            {canEdit && (
              <div className="space-y-1">
                <label className="text-xs font-medium">API URL</label>
                <div className="flex items-center gap-2">
                  <input
                    type="url"
                    value={form.apiUrl}
                    onChange={(e) => setForm((prev) => ({ ...prev, apiUrl: e.target.value }))}
                    placeholder="https://api.openai.com/v1"
                    disabled={!canEdit}
                    className="flex-1 h-9 rounded-xl border border-input/60 bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all disabled:opacity-60"
                  />
                  <button
                    type="button"
                    onClick={applyUnieAIProviderDefaults}
                    disabled={!canEdit}
                    className="h-9 w-9 shrink-0 rounded-full border border-input/60 bg-background hover:bg-muted transition-colors inline-flex items-center justify-center disabled:opacity-60"
                    title="Use UnieAI"
                  >
                    <UnieAIIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}

            {canEdit && (
              <div className="space-y-1">
                <label className="text-xs font-medium">API Key</label>
                <div className="flex items-center gap-2">
                  <input
                    type={showApiKey ? "text" : "password"}
                    value={form.apiKey}
                    onChange={(e) => setForm((prev) => ({ ...prev, apiKey: e.target.value }))}
                    placeholder="sk-..."
                    disabled={!canEdit}
                    className="flex-1 h-9 rounded-xl border border-input/60 bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all disabled:opacity-60"
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey((prev) => !prev)}
                    className="h-9 w-9 shrink-0 rounded-full border border-input/60 bg-background hover:bg-muted transition-colors inline-flex items-center justify-center"
                    title={showApiKey ? "Hide API Key" : "Show API Key"}
                    aria-label={showApiKey ? "Hide API Key" : "Show API Key"}
                  >
                    {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-2 pt-2 border-t border-border/40">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <p className="text-xs text-muted-foreground">選擇模型（已選 {selectedCount}/{totalCount} 個）</p>
                <button
                  type="button"
                  onClick={handleSync}
                  disabled={syncing || !canEdit}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-border bg-background hover:bg-muted transition-colors disabled:opacity-50"
                >
                  <RefreshCw className={`h-3 w-3 ${syncing ? "animate-spin" : ""}`} />
                  {syncing ? "同步中..." : "同步模型"}
                </button>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedModelIds(models.map(getModelId))}
                  className="h-7 px-2.5 rounded-lg border border-border bg-background hover:bg-muted text-xs"
                  disabled={models.length === 0 || !canEdit}
                >
                  全選
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedModelIds([])}
                  className="h-7 px-2.5 rounded-lg border border-border bg-background hover:bg-muted text-xs"
                  disabled={selectedModelIds.length === 0 || !canEdit}
                >
                  清空
                </button>
              </div>
            </div>

            {models.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5 max-h-48 overflow-y-auto border border-border/50 rounded-xl p-2">
                {models.map((m) => {
                  const modelId = getModelId(m);
                  return (
                    <label key={modelId} className="text-xs flex items-center gap-2 rounded-md px-2 py-1 hover:bg-muted/60">
                      <input
                        type="checkbox"
                        checked={selectedModelIds.includes(modelId)}
                        onChange={(e) => {
                          const next = e.target.checked
                            ? Array.from(new Set([...selectedModelIds, modelId]))
                            : selectedModelIds.filter((id) => id !== modelId);
                          setSelectedModelIds(next);
                        }}
                        disabled={!canEdit}
                      />
                      <span className="font-mono truncate">{modelId}</span>
                    </label>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">尚無模型，請先同步模型。</p>
            )}
          </div>

          <div className="flex justify-end border-t border-border/40 pt-3">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !canEdit}
              className="h-9 px-5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-all shadow-sm active:scale-95 disabled:opacity-50"
            >
              {saving ? "儲存中..." : "儲存"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function CreateProviderDialog({
  groupId,
  existingPrefixes,
  onCreated,
  onClose,
}: {
  groupId: string;
  existingPrefixes: string[];
  onCreated: (provider: GroupProvider) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    displayName: "",
    prefix: "",
    apiUrl: "",
    apiKey: "",
  });
  const [prefixError, setPrefixError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);

  const validatePrefix = (val: string) => {
    if (!val) return "Prefix is required";
    if (!/^[A-Z0-9]{4}$/.test(val)) return "Prefix must be 4 alphanumeric chars";
    if (existingPrefixes.includes(val)) return "Prefix already exists";
    return "";
  };

  const handlePrefixChange = (val: string) => {
    const upper = val.toUpperCase().slice(0, 4);
    setForm((prev) => ({ ...prev, prefix: upper }));
    setPrefixError(validatePrefix(upper));
  };

  const handleSubmit = async () => {
    const err = validatePrefix(form.prefix);
    if (err) {
      setPrefixError(err);
      return;
    }
    if (!form.displayName.trim()) {
      toast.error("Display Name is required");
      return;
    }
    if (!form.apiUrl.trim() || !form.apiKey.trim()) {
      toast.error("Please fill API URL / API Key");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/groups/${groupId}/providers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: form.displayName.trim(),
          prefix: form.prefix,
          apiUrl: form.apiUrl.trim(),
          apiKey: form.apiKey.trim(),
          enable: true,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Create failed");
      }
      onCreated({
        ...data,
        modelList: Array.isArray(data.modelList) ? data.modelList : [],
        selectedModels: Array.isArray(data.selectedModels) ? data.selectedModels : [],
      });
      toast.success("Provider created");
      onClose();
    } catch (e: any) {
      toast.error(e.message || "Create failed");
    } finally {
      setSubmitting(false);
    }
  };

  const applyUnieAIProviderDefaults = () => {
    if (!UNIEAI_PROVIDER_URL) {
      toast.error("NEXT_PUBLIC_UNIEAI_PROVIDER_URL is not set");
      return;
    }
    if (!UNIEAI_PROVIDER_KEY) {
      toast.error("NEXT_PUBLIC_UNIEAI_PROVIDER_KEY is not set");
      return;
    }
    setForm((prev) => ({
      ...prev,
      apiUrl: UNIEAI_PROVIDER_URL,
      apiKey: UNIEAI_PROVIDER_KEY,
    }));
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose();
      }}
    >
      <div className="w-full max-w-md mx-4 bg-background rounded-2xl border border-border shadow-xl animate-in zoom-in-95 slide-in-from-bottom-4 duration-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/50">
          <h3 className="font-semibold text-base">新增 Provider</h3>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              Display Name <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              value={form.displayName}
              onChange={(e) => setForm((prev) => ({ ...prev, displayName: e.target.value }))}
              placeholder="e.g. OpenAI"
              autoFocus
              className="w-full h-10 rounded-xl border border-input/60 bg-background px-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              Prefix <span className="text-destructive">*</span>
              <span className="ml-1.5 text-xs text-muted-foreground font-normal">4 alphanumeric chars</span>
            </label>
            <input
              type="text"
              value={form.prefix}
              onChange={(e) => handlePrefixChange(e.target.value)}
              placeholder="e.g. GRP1"
              maxLength={4}
              className={`w-full h-10 rounded-xl border bg-background px-4 text-sm font-mono tracking-widest uppercase focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all ${prefixError ? "border-destructive focus:border-destructive" : "border-input/60 focus:border-primary/50"
                }`}
            />
            {prefixError && <p className="text-xs text-destructive">{prefixError}</p>}
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">API URL</label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={form.apiUrl}
                onChange={(e) => setForm((prev) => ({ ...prev, apiUrl: e.target.value }))}
                placeholder="https://api.openai.com/v1"
                className="flex-1 h-10 rounded-xl border border-input/60 bg-background px-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all"
              />
              <button
                type="button"
                onClick={applyUnieAIProviderDefaults}
                className="h-10 w-10 shrink-0 rounded-full border border-input/60 bg-background hover:bg-muted transition-colors inline-flex items-center justify-center"
                title="Use UnieAI"
              >
                <UnieAIIcon className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">API Key</label>
            <div className="flex items-center gap-2">
              <input
                type={showApiKey ? "text" : "password"}
                value={form.apiKey}
                onChange={(e) => setForm((prev) => ({ ...prev, apiKey: e.target.value }))}
                placeholder="sk-..."
                className="flex-1 h-10 rounded-xl border border-input/60 bg-background px-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all"
              />
              <button
                type="button"
                onClick={() => setShowApiKey((prev) => !prev)}
                className="h-10 w-10 shrink-0 rounded-full border border-input/60 bg-background hover:bg-muted transition-colors inline-flex items-center justify-center"
                title={showApiKey ? "Hide API Key" : "Show API Key"}
                aria-label={showApiKey ? "Hide API Key" : "Show API Key"}
              >
                {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border/50">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="h-9 px-4 rounded-xl text-sm text-muted-foreground hover:bg-muted transition-colors"
          >
            取消
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || !!prefixError}
            className="h-9 px-5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-all shadow-sm active:scale-95 disabled:opacity-50"
          >
            {submitting ? "建立中..." : "建立 Provider"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function ProviderSection({
  groupId,
  canEdit,
  onProviderCountChange,
}: {
  groupId: string;
  canEdit: boolean;
  onProviderCountChange?: (count: number) => void;
}) {
  const [providers, setProviders] = useState<GroupProvider[]>([]);
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  const fetchProviders = async () => {
    const res = await fetch(`/api/admin/groups/${groupId}/providers`);
    if (!res.ok) return;
    const data = await res.json();
    const list = Array.isArray(data) ? data : [];
    setProviders(list);
    onProviderCountChange?.(list.length);
  };

  useEffect(() => {
    fetchProviders();
  }, [groupId]);

  const existingPrefixes = providers.map((p) => p.prefix.toUpperCase());

  const handleUpdate = (updated: GroupProvider) => {
    setProviders((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
  };

  const handleDelete = (id: string) => {
    setProviders((prev) => prev.filter((p) => p.id !== id));
    onProviderCountChange?.(Math.max(0, providers.length - 1));
  };

  return (
    <>
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold">Group Providers</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              設定群組可用的 Provider 與模型。
            </p>
          </div>
          {canEdit && (
            <button
              type="button"
              onClick={() => setShowCreateDialog(true)}
              className="flex items-center gap-1.5 h-9 px-4 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-all shadow-sm active:scale-95"
            >
              <Plus className="h-3.5 w-3.5" />
              新增 Provider
            </button>
          )}
        </div>

        {providers.length === 0 ? (
          <div className="text-center py-10 border border-dashed border-border rounded-2xl text-muted-foreground">
            <p className="text-sm">尚未設定任何 Provider</p>
            <p className="text-xs mt-1">請先新增 Provider 並同步模型。</p>
          </div>
        ) : (
          <div className="space-y-3">
            {providers.map((p) => (
              <ProviderCard
                key={p.id}
                groupId={groupId}
                provider={p}
                canEdit={canEdit}
                onUpdate={handleUpdate}
                onDelete={() => handleDelete(p.id)}
              />
            ))}
          </div>
        )}

        {!canEdit && (
          <p className="text-xs text-muted-foreground text-right">
            只有 Creator/共編者可以調整 Provider。
          </p>
        )}
      </section>

      {showCreateDialog && canEdit && (
        <CreateProviderDialog
          groupId={groupId}
          existingPrefixes={existingPrefixes}
          onCreated={(newProvider) => {
            setProviders((prev) => [...prev, newProvider]);
            onProviderCountChange?.(providers.length + 1);
          }}
          onClose={() => setShowCreateDialog(false)}
        />
      )}
    </>
  );
}
