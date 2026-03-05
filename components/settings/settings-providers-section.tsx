"use client";

import { useState } from "react";
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
import { UnieAIIcon } from "@/components/sidebar/unieai-logo";

type ModelItem = {
  id: string;
  object?: string;
  [key: string]: any;
};

type Provider = {
  id: string;
  userId: string;
  enable: number;
  displayName: string;
  prefix: string;
  apiUrl: string;
  apiKey: string;
  modelList: ModelItem[];
  selectedModels: string[];
  updatedAt: string;
};

type ProviderFormState = {
  displayName: string;
  prefix: string;
  apiUrl: string;
  apiKey: string;
  enable: boolean;
};

const UNIEAI_PROVIDER_URL = process.env.NEXT_PUBLIC_UNIEAI_PROVIDER_URL || "";
const getModelId = (model: ModelItem) => model.id || String(model);

function ProviderCard({
  provider,
  existingPrefixes,
  onUpdate,
  onDelete,
}: {
  provider: Provider;
  existingPrefixes: string[];
  onUpdate: (updated: Provider) => void;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [form, setForm] = useState<ProviderFormState>({
    displayName: provider.displayName,
    prefix: provider.prefix,
    apiUrl: provider.apiUrl,
    apiKey: provider.apiKey,
    enable: provider.enable === 1,
  });
  const [prefixError, setPrefixError] = useState("");
  const [models, setModels] = useState<ModelItem[]>(
    Array.isArray(provider.modelList) ? provider.modelList : []
  );
  const [selectedModelIds, setSelectedModelIds] = useState<string[]>(
    Array.isArray(provider.selectedModels) ? provider.selectedModels : []
  );

  const validatePrefix = (val: string) => {
    if (!val) return "Prefix 為必填";
    if (!/^[a-zA-Z0-9]{4}$/.test(val)) return "Prefix 需為 4 碼英數字";
    const upper = val.toUpperCase();
    if (existingPrefixes.includes(upper)) return "Prefix 已存在";
    return "";
  };

  const applyUnieAIProviderUrlForEdit = () => {
    if (!UNIEAI_PROVIDER_URL) {
      toast.error("NEXT_PUBLIC_UNIEAI_PROVIDER_URL 未設定");
      return;
    }
    setForm((prev) => ({ ...prev, apiUrl: UNIEAI_PROVIDER_URL }));
    toast.info("已套用 UnieAI Base URL，請填入 API Key");
  };

  const handleToggleEnable = async () => {
    const newEnable = !form.enable;
    setForm((prev) => ({ ...prev, enable: newEnable }));
    try {
      const res = await fetch(`/api/user/providers/${provider.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enable: newEnable }),
      });
      if (!res.ok) throw new Error();
      const updated = await res.json();
      onUpdate({
        ...updated,
        modelList: Array.isArray(updated.modelList) ? updated.modelList : models,
        selectedModels: Array.isArray(updated.selectedModels) ? updated.selectedModels : selectedModelIds,
      });
      toast.success(newEnable ? "Provider 已啟用" : "Provider 已停用");
    } catch {
      setForm((prev) => ({ ...prev, enable: !newEnable }));
      toast.error("更新失敗");
    }
  };

  const handleSave = async () => {
    const err = validatePrefix(form.prefix);
    if (err) {
      setPrefixError(err);
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/user/providers/${provider.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: form.displayName,
          prefix: form.prefix,
          apiUrl: form.apiUrl,
          apiKey: form.apiKey,
          modelList: models,
          selectedModels: selectedModelIds,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "儲存失敗");
      }
      const updated = await res.json();
      onUpdate({
        ...updated,
        modelList: Array.isArray(updated.modelList) ? updated.modelList : models,
        selectedModels: Array.isArray(updated.selectedModels) ? updated.selectedModels : selectedModelIds,
      });
      toast.success("Provider 已儲存");
    } catch (e: any) {
      toast.error(e.message || "儲存失敗");
    } finally {
      setSaving(false);
    }
  };

  const handleSync = async () => {
    const err = validatePrefix(form.prefix);
    if (err) {
      setPrefixError(err);
      return;
    }
    const apiUrl = form.apiUrl.trim();
    const apiKey = form.apiKey.trim();
    if (!apiUrl || !apiKey) {
      toast.error("同步前請先填入 API URL / API Key");
      return;
    }

    setSyncing(true);
    try {
      const res = await fetch(`/api/user/providers/${provider.id}/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiUrl, apiKey }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "同步失敗");
      }
      const data = await res.json();
      const newModels = Array.isArray(data.modelList) ? data.modelList : [];
      const nextModelIds = newModels.map(getModelId);
      const newSelected = nextModelIds;
      setModels(newModels);
      setSelectedModelIds(newSelected);
      onUpdate({
        ...provider,
        ...data.provider,
        modelList: newModels,
        selectedModels: newSelected,
      });
      toast.success(`已同步 ${newModels.length} 個模型`);
      setExpanded(true);
    } catch (e: any) {
      toast.error(e.message || "同步失敗");
    } finally {
      setSyncing(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`確定刪除 Provider「${form.displayName || form.prefix}」？`)) return;
    try {
      const res = await fetch(`/api/user/providers/${provider.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      onDelete();
      toast.success("Provider 已刪除");
    } catch {
      toast.error("刪除失敗");
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
          className={`shrink-0 transition-colors ${form.enable ? "text-primary" : "text-muted-foreground/50"}`}
          title={form.enable ? "停用 Provider" : "啟用 Provider"}
        >
          {form.enable ? <ToggleRight className="h-5 w-5" /> : <ToggleLeft className="h-5 w-5" />}
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm truncate">{form.displayName || "未命名 Provider"}</span>
            <span className="text-[10px] font-mono bg-primary/10 text-primary px-1.5 py-0.5 rounded font-bold tracking-wider shrink-0">
              {form.prefix}
            </span>
            {!form.enable && (
              <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded shrink-0">
                已停用
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground truncate">
            {form.apiUrl || "未設定 API URL"} | 已選 {selectedCount}/{totalCount} 模型
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
            className="p-1.5 rounded-lg hover:bg-destructive/10 hover:text-destructive transition-colors text-muted-foreground"
            title="刪除 Provider"
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
                placeholder="例：OpenAI GPT-4"
                className="w-full h-9 rounded-xl border border-input/60 bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all"
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
                placeholder="例：OAI1"
                maxLength={4}
                className={`w-full h-9 rounded-xl border bg-background px-3 text-sm font-mono uppercase focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all ${prefixError ? "border-destructive focus:border-destructive" : "border-input/60 focus:border-primary/50"
                  }`}
              />
              {prefixError && <p className="text-xs text-destructive">{prefixError}</p>}
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium">API URL</label>
              <div className="flex items-center gap-2">
                <input
                  type="url"
                  value={form.apiUrl}
                  onChange={(e) => setForm((prev) => ({ ...prev, apiUrl: e.target.value }))}
                  placeholder="https://api.openai.com/v1"
                  className="flex-1 h-9 rounded-xl border border-input/60 bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all"
                />
                <button
                  type="button"
                  onClick={applyUnieAIProviderUrlForEdit}
                  className="h-9 w-9 shrink-0 rounded-full border border-input/60 bg-background hover:bg-muted transition-colors inline-flex items-center justify-center"
                  title="使用 UnieAI"
                >
                  <UnieAIIcon className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium">API Key</label>
              <div className="flex items-center gap-2">
                <input
                  type={showApiKey ? "text" : "password"}
                  value={form.apiKey}
                  onChange={(e) => setForm((prev) => ({ ...prev, apiKey: e.target.value }))}
                  placeholder="請輸入 API Key"
                  className="flex-1 h-9 rounded-xl border border-input/60 bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey((prev) => !prev)}
                  className="h-9 w-9 shrink-0 rounded-full border border-input/60 bg-background hover:bg-muted transition-colors inline-flex items-center justify-center"
                  title={showApiKey ? "隱藏 API Key" : "顯示 API Key"}
                  aria-label={showApiKey ? "隱藏 API Key" : "顯示 API Key"}
                >
                  {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-2 pt-2 border-t border-border/40">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <p className="text-xs text-muted-foreground">
                  選擇模型（已選 {selectedCount}/{totalCount} 個）
                </p>
                <button
                  type="button"
                  onClick={handleSync}
                  disabled={syncing}
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
                  disabled={models.length === 0}
                >
                  全選
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedModelIds([])}
                  className="h-7 px-2.5 rounded-lg border border-border bg-background hover:bg-muted text-xs"
                  disabled={selectedModelIds.length === 0}
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
                      />
                      <span className="font-mono truncate">{modelId}</span>
                    </label>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">尚無模型，請先同步。</p>
            )}
          </div>

          <div className="flex justify-end border-t border-border/40 pt-3">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !!prefixError}
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
  existingPrefixes,
  onCreated,
  onClose,
}: {
  existingPrefixes: string[];
  onCreated: (provider: Provider) => void;
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
    if (!val) return "Prefix 為必填";
    if (!/^[A-Z0-9]{4}$/.test(val)) return "Prefix 需為 4 碼英數字";
    if (existingPrefixes.includes(val)) return "Prefix 已存在";
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
      toast.error("顯示名稱為必填");
      return;
    }
    if (!form.apiUrl.trim() || !form.apiKey.trim()) {
      toast.error("請填寫 API URL / API Key");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/user/providers", {
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
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "建立失敗");
      }
      const newProvider = await res.json();
      onCreated({
        ...newProvider,
        modelList: Array.isArray(newProvider.modelList) ? newProvider.modelList : [],
        selectedModels: Array.isArray(newProvider.selectedModels) ? newProvider.selectedModels : [],
      });
      toast.success("Provider 已建立");
      onClose();
    } catch (e: any) {
      toast.error(e.message || "建立失敗");
    } finally {
      setSubmitting(false);
    }
  };

  const applyUnieAIProviderUrl = () => {
    if (!UNIEAI_PROVIDER_URL) {
      toast.error("NEXT_PUBLIC_UNIEAI_PROVIDER_URL 未設定");
      return;
    }
    setForm((prev) => ({ ...prev, apiUrl: UNIEAI_PROVIDER_URL }));
    toast.info("已套用 UnieAI Base URL，請填入 API Key");
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
              顯示名稱 <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              value={form.displayName}
              onChange={(e) => setForm((prev) => ({ ...prev, displayName: e.target.value }))}
              placeholder="例：OpenAI"
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
              placeholder="例：OAI1"
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
                onClick={applyUnieAIProviderUrl}
                className="h-10 w-10 shrink-0 rounded-full border border-input/60 bg-background hover:bg-muted transition-colors inline-flex items-center justify-center"
                title="使用 UnieAI"
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
                placeholder="請輸入 API Key"
                className="flex-1 h-10 rounded-xl border border-input/60 bg-background px-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all"
              />
              <button
                type="button"
                onClick={() => setShowApiKey((prev) => !prev)}
                className="h-10 w-10 shrink-0 rounded-full border border-input/60 bg-background hover:bg-muted transition-colors inline-flex items-center justify-center"
                title={showApiKey ? "隱藏 API Key" : "顯示 API Key"}
                aria-label={showApiKey ? "隱藏 API Key" : "顯示 API Key"}
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

export function SettingsProvidersSection({ initialProviders }: { initialProviders: Provider[] }) {
  const [providers, setProviders] = useState<Provider[]>(initialProviders);
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  const existingPrefixes = providers.map((p) => p.prefix.toUpperCase());

  const handleUpdate = (updated: Provider) => {
    setProviders((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
  };

  const handleDelete = (id: string) => {
    setProviders((prev) => prev.filter((p) => p.id !== id));
  };

  return (
    <>
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold">API Provider 設定</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              管理你的 OpenAI 相容 Provider，並選擇要開放給聊天使用的模型。
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowCreateDialog(true)}
            className="flex items-center gap-1.5 h-9 px-4 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-all shadow-sm active:scale-95"
          >
            <Plus className="h-3.5 w-3.5" />
            新增 Provider
          </button>
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
                provider={p}
                existingPrefixes={existingPrefixes.filter((px) => px !== p.prefix.toUpperCase())}
                onUpdate={handleUpdate}
                onDelete={() => handleDelete(p.id)}
              />
            ))}
          </div>
        )}
      </section>

      {showCreateDialog && (
        <CreateProviderDialog
          existingPrefixes={existingPrefixes}
          onCreated={(newProvider) => setProviders((prev) => [...prev, newProvider])}
          onClose={() => setShowCreateDialog(false)}
        />
      )}
    </>
  );
}
