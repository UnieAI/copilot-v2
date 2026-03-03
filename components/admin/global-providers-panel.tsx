"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ChevronDown, ChevronUp, Eye, Plus, RefreshCw, ToggleLeft, ToggleRight, Trash2, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { UnieAIIcon } from "@/components/sidebar/unieai-logo";

type GlobalProvider = {
  id: string;
  enable: number;
  displayName: string;
  prefix: string;
  apiUrl: string;
  apiKey: string;
  modelList: any[];
  selectedModels: string[];
  createdAt?: string;
  updatedAt: string;
};

type QuotaItem = {
  providerId: string;
  role: "user" | "admin" | "super";
  model: string;
  limitTokens: number | null;
  refillIntervalHours: number;
  usedTokens?: number;
  remainingTokens?: number | null;
  refreshAt?: string;
};

type QuotaUsageItem = {
  userId: string;
  name: string;
  image: string | null;
  usedTokens: number;
  remainingTokens: number | null;
  refreshAt: string;
};

const ROLE_LABELS: Record<string, string> = {
  super: '超級管理員',
  admin: '管理員',
  user: '用戶',
  // pending: '待審核',
};

const ROLE_COLORS: Record<string, string> = {
  super: 'bg-purple-100 text-purple-800 dark:bg-purple-950/40 dark:text-purple-300',
  admin: 'bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300',
  user: 'bg-green-100 text-green-800 dark:bg-green-950/40 dark:text-green-300',
  // pending: 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300',
};

const ROLES: Array<"user" | "admin" | "super"> = ["user", "admin", "super"];
const UNIEAI_PROVIDER_URL = process.env.NEXT_PUBLIC_UNIEAI_PROVIDER_URL || "";
const UNIEAI_PROVIDER_KEY = process.env.NEXT_PUBLIC_UNIEAI_PROVIDER_KEY || "";

function formatTokenStatus(remainingTokens: number | null, refreshAt?: string) {
  if (remainingTokens === null) return "Unlimited";
  if (remainingTokens > 0) return `剩餘額度：${remainingTokens.toLocaleString()} tokens`;
  return `額度恢復日期：${refreshAt ? new Date(refreshAt).toLocaleString() : "-"}`;
}

export function GlobalProvidersPanel() {
  const [providers, setProviders] = useState<GlobalProvider[]>([]);
  const [loading, setLoading] = useState(false);

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState({
    displayName: "",
    prefix: "",
    apiUrl: "",
    apiKey: "",
  });
  const [createPrefixError, setCreatePrefixError] = useState("");

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [quotaProviderId, setQuotaProviderId] = useState<string | null>(null);
  const [quotaItems, setQuotaItems] = useState<QuotaItem[]>([]);
  const [loadingQuotaProviderId, setLoadingQuotaProviderId] = useState<string | null>(null);
  const [savingProviderId, setSavingProviderId] = useState<string | null>(null);
  const [quotaSearch, setQuotaSearch] = useState("");
  const [quotaRoleFilter, setQuotaRoleFilter] = useState<"all" | "user" | "admin" | "super">("all");
  const [usageDialogOpen, setUsageDialogOpen] = useState(false);
  const [usageLoading, setUsageLoading] = useState(false);
  const [usageItems, setUsageItems] = useState<QuotaUsageItem[]>([]);
  const [usageDialogTitle, setUsageDialogTitle] = useState("");

  const existingPrefixes = providers.map((p) => p.prefix.toUpperCase());

  const validateCreatePrefix = (val: string) => {
    if (!val) return "Prefix is required";
    if (!/^[A-Z0-9]{4}$/.test(val)) return "Prefix must be 4 alphanumeric characters";
    if (existingPrefixes.includes(val)) return "Prefix already exists";
    return "";
  };

  const fetchProviders = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/global-providers");
      if (!res.ok) return;
      const data = await res.json();
      setProviders(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProviders();
  }, []);

  const createProvider = async () => {
    const normalizedPrefix = createForm.prefix.toUpperCase();
    const prefixErr = validateCreatePrefix(normalizedPrefix);
    if (prefixErr) {
      setCreatePrefixError(prefixErr);
      return;
    }
    if (!createForm.prefix || !createForm.apiUrl || !createForm.apiKey) {
      toast.error("Please fill Prefix / API URL / API Key");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/admin/global-providers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: createForm.displayName,
          prefix: normalizedPrefix,
          apiUrl: createForm.apiUrl,
          apiKey: createForm.apiKey,
          enable: true,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data?.error || "Create failed");
        return;
      }
      toast.success("Global Provider created");
      setCreateForm({ displayName: "", prefix: "", apiUrl: "", apiKey: "" });
      setCreatePrefixError("");
      setShowCreateDialog(false);
      await fetchProviders();
    } finally {
      setCreating(false);
    }
  };

  const applyUnieAIGlobalDefaults = () => {
    if (!UNIEAI_PROVIDER_URL) {
      toast.error("NEXT_PUBLIC_UNIEAI_PROVIDER_URL is not set");
      return;
    }
    if (!UNIEAI_PROVIDER_KEY) {
      toast.error("NEXT_PUBLIC_UNIEAI_PROVIDER_KEY is not set");
      return;
    }
    setCreateForm((s) => ({
      ...s,
      apiUrl: UNIEAI_PROVIDER_URL,
      apiKey: UNIEAI_PROVIDER_KEY,
    }));
  };

  const applyUnieAIToProviderEdit = (providerId: string) => {
    if (!UNIEAI_PROVIDER_URL) {
      toast.error("NEXT_PUBLIC_UNIEAI_PROVIDER_URL is not set");
      return;
    }
    if (!UNIEAI_PROVIDER_KEY) {
      toast.error("NEXT_PUBLIC_UNIEAI_PROVIDER_KEY is not set");
      return;
    }
    setProviders((prev) =>
      prev.map((item) =>
        item.id === providerId
          ? { ...item, apiUrl: UNIEAI_PROVIDER_URL, apiKey: UNIEAI_PROVIDER_KEY }
          : item
      )
    );
  };

  const updateProvider = async (id: string, patch: Record<string, unknown>) => {
    const res = await fetch(`/api/admin/global-providers/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast.error(data?.error || "Update failed");
      return false;
    }
    return true;
  };

  const deleteProvider = async (id: string) => {
    if (!confirm("Delete this Global Provider?")) return;
    const res = await fetch(`/api/admin/global-providers/${id}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error("Delete failed");
      return;
    }
    toast.success("Deleted");
    await fetchProviders();
    if (quotaProviderId === id) {
      setQuotaProviderId(null);
      setQuotaItems([]);
    }
  };

  const syncProviderModels = async (id: string) => {
    const res = await fetch(`/api/admin/global-providers/${id}/sync`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(data?.error || "Sync models failed");
      return;
    }
    toast.success(`Synced ${Array.isArray(data?.modelList) ? data.modelList.length : 0} models`);
    await fetchProviders();
  };

  const buildQuotaItemsForModels = (
    providerId: string,
    modelIds: string[],
    existing: Array<{
      role: "user" | "admin" | "super";
      model: string;
      limitTokens: number | null;
      refillIntervalHours: number;
      usedTokens?: number;
      remainingTokens?: number | null;
      refreshAt?: string;
    }>
  ) => {
    const merged: QuotaItem[] = [];
    for (const role of ROLES) {
      for (const model of modelIds) {
        const item = existing.find((q) => q.role === role && q.model === model);
        merged.push({
          providerId,
          role,
          model,
          limitTokens: item ? item.limitTokens : null,
          refillIntervalHours: item ? Math.max(1, Number(item.refillIntervalHours || 12)) : 12,
          usedTokens: item ? Number(item.usedTokens || 0) : 0,
          remainingTokens: item ? (item.remainingTokens === null ? null : Number(item.remainingTokens || 0)) : null,
          refreshAt: item?.refreshAt,
        });
      }
    }
    return merged;
  };

  const fetchQuotas = async (provider: GlobalProvider) => {
    setQuotaProviderId(provider.id);
    setLoadingQuotaProviderId(provider.id);
    try {
      const res = await fetch(`/api/admin/global-providers/${provider.id}/quotas`);
      if (!res.ok) {
        setQuotaItems([]);
        return;
      }
      const data = await res.json();
      const existing = Array.isArray(data?.quotas) ? data.quotas : [];
      const latestProvider = providers.find((p) => p.id === provider.id) || provider;
      const selectedModels = Array.isArray(latestProvider.selectedModels) ? latestProvider.selectedModels : [];
      const merged = buildQuotaItemsForModels(
        provider.id,
        selectedModels,
        existing.map((q: any) => ({
          role: q.role,
          model: q.model,
          limitTokens: q.limitTokens,
          refillIntervalHours: Number(q.refillIntervalHours || 12),
          usedTokens: Number(q.usedTokens || 0),
          remainingTokens: q.remainingTokens === null ? null : Number(q.remainingTokens || 0),
          refreshAt: q.refreshAt,
        }))
      );
      setQuotaItems(merged);
    } finally {
      setLoadingQuotaProviderId((prev) => (prev === provider.id ? null : prev));
    }
  };

  const saveProviderAll = async (provider: GlobalProvider) => {
    const current = providers.find((item) => item.id === provider.id);
    if (!current) return;
    if (loadingQuotaProviderId === provider.id) {
      toast.error("Quotas are still loading");
      return;
    }
    setSavingProviderId(provider.id);
    try {
      const ok = await updateProvider(provider.id, {
        displayName: current.displayName,
        apiUrl: current.apiUrl,
        apiKey: current.apiKey,
        selectedModels: current.selectedModels,
      });
      if (!ok) return;

      const providerQuotaItems = buildQuotaItemsForModels(
        provider.id,
        current.selectedModels || [],
        quotaItems.filter((q) => q.providerId === provider.id)
      );
      const res = await fetch(`/api/admin/global-providers/${provider.id}/quotas`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quotas: providerQuotaItems.map((q) => ({
            role: q.role,
            model: q.model,
            limitTokens: q.limitTokens === null ? null : Number(q.limitTokens),
            refillIntervalHours: Math.max(1, Number(q.refillIntervalHours || 12)),
          })),
        }),
      });
      if (!res.ok) {
        toast.error("Save quotas failed");
        return;
      }
      toast.success("Saved");
      await fetchProviders();
      await fetchQuotas(current);
    } finally {
      setSavingProviderId((prev) => (prev === provider.id ? null : prev));
    }
  };

  const updateProviderSelectedModels = (providerId: string, nextSelectedModels: string[]) => {
    setProviders((prev) =>
      prev.map((item) => (item.id === providerId ? { ...item, selectedModels: nextSelectedModels } : item))
    );
    setQuotaItems((prev) => {
      const currentQuotaItems = prev.filter((q) => q.providerId === providerId);
      const nextQuotaItems = buildQuotaItemsForModels(providerId, nextSelectedModels, currentQuotaItems);
      return [...prev.filter((q) => q.providerId !== providerId), ...nextQuotaItems];
    });
  };

  const openQuotaUsageDialog = async (q: QuotaItem) => {
    setUsageDialogOpen(true);
    setUsageLoading(true);
    setUsageItems([]);
    setUsageDialogTitle(`${q.role} / ${q.model}`);
    try {
      const params = new URLSearchParams({
        role: q.role,
        model: q.model,
      });
      const res = await fetch(`/api/admin/global-providers/${q.providerId}/quotas/usage?${params.toString()}`);
      if (!res.ok) {
        toast.error("載入使用狀態失敗");
        return;
      }
      const data = await res.json();
      setUsageItems(Array.isArray(data?.items) ? data.items : []);
    } finally {
      setUsageLoading(false);
    }
  };

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold">Global Providers</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Platform shared providers. Users can use these without joining a group or creating personal providers.
          </p>
        </div>
        <button
          onClick={() => setShowCreateDialog(true)}
          className="flex items-center gap-1.5 h-9 px-4 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-all shadow-sm active:scale-95"
        >
          <Plus className="h-3.5 w-3.5" />
          Global Provider
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : providers.length === 0 ? (
        <div className="text-center py-10 border border-dashed border-border rounded-2xl text-muted-foreground">
          <p className="text-sm">No global providers yet</p>
          <p className="text-xs mt-1">Create one to make models available platform-wide.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {[...providers]
            .sort((a, b) => {
              const aName = (a.displayName || "").trim().toLowerCase();
              const bName = (b.displayName || "").trim().toLowerCase();
              const byName = aName.localeCompare(bName);
              if (byName !== 0) return byName;

              const byPrefix = (a.prefix || "").localeCompare(b.prefix || "");
              if (byPrefix !== 0) return byPrefix;

              return a.id.localeCompare(b.id);
            })
            .map((p) => {
            const models = Array.isArray(p.modelList) ? p.modelList : [];
            const selected = Array.isArray(p.selectedModels) ? p.selectedModels : [];
            const isExpanded = expandedId === p.id;
            const providerQuotaItems = quotaItems.filter((q) => q.providerId === p.id);
            const quotaSearchTerm = quotaSearch.trim().toLowerCase();
            const filteredQuotaItems = providerQuotaItems.filter((q) => {
              const roleMatch = quotaRoleFilter === "all" || q.role === quotaRoleFilter;
              const textMatch =
                !quotaSearchTerm ||
                q.model.toLowerCase().includes(quotaSearchTerm) ||
                q.role.toLowerCase().includes(quotaSearchTerm);
              return roleMatch && textMatch;
            });
            return (
              <div
                key={p.id}
                className={`rounded-2xl border transition-colors ${p.enable ? "border-border bg-background" : "border-border/50 bg-muted/30"}`}
              >
                <div className="flex items-center gap-3 px-4 py-3">
                  <button
                    type="button"
                    onClick={async () => {
                      const nextEnable = p.enable !== 1;
                      const ok = await updateProvider(p.id, { enable: nextEnable });
                      if (ok) {
                        setProviders((prev) => prev.map((item) => (item.id === p.id ? { ...item, enable: nextEnable ? 1 : 0 } : item)));
                      }
                    }}
                    className={`shrink-0 transition-colors ${p.enable ? "text-primary" : "text-muted-foreground/50"}`}
                    title={p.enable ? "Disable provider" : "Enable provider"}
                  >
                    {p.enable ? <ToggleRight className="h-5 w-5" /> : <ToggleLeft className="h-5 w-5" />}
                  </button>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm truncate">{p.displayName || "Untitled Provider"}</span>
                      <span className="text-[10px] font-mono bg-primary/10 text-primary px-1.5 py-0.5 rounded font-bold tracking-wider shrink-0">
                        {p.prefix}
                      </span>
                      {!p.enable && (
                        <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded shrink-0">Disabled</span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {p.apiUrl || "No API URL"} | {selected.length}/{models.length} selected models
                    </p>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => syncProviderModels(p.id)}
                      className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-border bg-background hover:bg-muted transition-colors"
                    >
                      <RefreshCw className="h-3 w-3" />
                      Sync
                    </button>
                    <button
                      onClick={async () => {
                        if (isExpanded) {
                          setExpandedId(null);
                          return;
                        }
                        setExpandedId(p.id);
                        await fetchQuotas(p);
                      }}
                      className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground"
                    >
                      {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>
                    <button
                      onClick={() => deleteProvider(p.id)}
                      className="p-1.5 rounded-lg hover:bg-destructive/10 hover:text-destructive transition-colors text-muted-foreground"
                      title="Delete provider"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="px-4 pb-4 space-y-4 border-t border-border/40 pt-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-xs font-medium">顯示名稱</label>
                        <input
                          value={p.displayName}
                          onChange={(e) => setProviders((prev) => prev.map((item) => (item.id === p.id ? { ...item, displayName: e.target.value } : item)))}
                          className="w-full h-9 rounded-xl border border-input/60 bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-medium">Prefix（4碼英數字，唯一識別）</label>
                        <input
                          value={p.prefix}
                          disabled
                          className="w-full h-9 rounded-xl border border-input/60 bg-background px-3 text-sm font-mono uppercase opacity-70"
                        />
                      </div>
                      <div className="space-y-1 md:col-span-2">
                        <label className="text-xs font-medium">API URL</label>
                        <div className="flex items-center gap-2">
                          <input
                            value={p.apiUrl}
                            onChange={(e) => setProviders((prev) => prev.map((item) => (item.id === p.id ? { ...item, apiUrl: e.target.value } : item)))}
                            className="flex-1 h-9 rounded-xl border border-input/60 bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all"
                          />
                          <button
                            type="button"
                            onClick={() => applyUnieAIToProviderEdit(p.id)}
                            className="h-9 w-9 shrink-0 rounded-full border border-input/60 bg-background hover:bg-muted transition-colors inline-flex items-center justify-center"
                            title="Use UnieAI"
                          >
                            <UnieAIIcon className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                      <div className="space-y-1 md:col-span-2">
                        <label className="text-xs font-medium">API Key</label>
                        <input
                          value={p.apiKey}
                          onChange={(e) => setProviders((prev) => prev.map((item) => (item.id === p.id ? { ...item, apiKey: e.target.value } : item)))}
                          className="w-full h-9 rounded-xl border border-input/60 bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all"
                          type="password"
                        />
                      </div>
                    </div>

                    <div className="space-y-2 pt-2 border-t border-border/40">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs text-muted-foreground">選擇模型（已選 {selected.length}/{models.length} 個）</p>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              const allModelIds = models.map((m: any) => m.id || String(m));
                              updateProviderSelectedModels(p.id, Array.from(new Set(allModelIds)));
                            }}
                            className="h-7 px-2.5 rounded-lg border border-border bg-background hover:bg-muted text-xs"
                            disabled={models.length === 0}
                          >
                            全選
                          </button>
                          <button
                            type="button"
                            onClick={() => updateProviderSelectedModels(p.id, [])}
                            className="h-7 px-2.5 rounded-lg border border-border bg-background hover:bg-muted text-xs"
                            disabled={selected.length === 0}
                          >
                            清除選擇
                          </button>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5 max-h-48 overflow-y-auto border border-border/50 rounded-xl p-2">
                        {models.map((m: any) => {
                          const modelId = m.id || String(m);
                          return (
                            <label key={modelId} className="text-xs flex items-center gap-2 rounded-md px-2 py-1 hover:bg-muted/60">
                              <input
                                type="checkbox"
                                checked={selected.includes(modelId)}
                                onChange={(e) => {
                                  const next = e.target.checked
                                    ? Array.from(new Set([...selected, modelId]))
                                    : selected.filter((id: string) => id !== modelId);
                                  updateProviderSelectedModels(p.id, next);
                                }}
                              />
                              <span className="font-mono truncate">{modelId}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>

                    <div className="border-t border-border/40 pt-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium">用量設置</p>
                        {loadingQuotaProviderId === p.id && <span className="text-xs text-muted-foreground">載入用量中...</span>}
                      </div>

                      {quotaProviderId === p.id && providerQuotaItems.length > 0 && (
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <input
                              type="text"
                              value={quotaSearch}
                              onChange={(e) => setQuotaSearch(e.target.value)}
                              placeholder="Search model or role"
                              className="h-8 min-w-[180px] flex-1 rounded-lg border border-input/60 bg-background px-2.5 text-xs"
                            />
                            <select
                              value={quotaRoleFilter}
                              onChange={(e) => setQuotaRoleFilter(e.target.value as "all" | "user" | "admin" | "super")}
                              className="h-8 rounded-lg border border-input/60 bg-background px-2.5 text-xs"
                            >
                              <option value="all">All Roles</option>
                              <option value="user">User</option>
                              <option value="admin">Admin</option>
                              <option value="super">Super</option>
                            </select>
                          </div>
                        </div>
                      )}

                      {quotaProviderId === p.id && filteredQuotaItems.length > 0 && (
                        <div className="space-y-2 max-h-96 overflow-y-auto">
                          {filteredQuotaItems.map((q) => (
                            <div
                              key={`${q.role}-${q.model}`}
                              className="rounded-xl border border-border/50 p-3 flex flex-col gap-2.5 text-xs bg-background"
                            >
                              {/* 第一行：角色 + 模型 */}
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0 space-y-2">
                                  <div className="flex items-center gap-2">
                                <span
                                  className={`
        inline-flex items-center rounded-full 
        px-2.5 py-0.5 text-xs font-medium
        ${ROLE_COLORS[q.role] || 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'}
      `}
                                >
                                  {ROLE_LABELS[q.role] || q.role}
                                </span>
                                    <span className="font-mono px-2 py-1 rounded bg-muted truncate">{q.model}</span>
                                  </div>

                              {/* 第二行：控制項們 */}
                                  <div className="flex flex-wrap items-center gap-3">
                                <label className="flex items-center gap-1.5 whitespace-nowrap">
                                  <input
                                    type="checkbox"
                                    checked={q.limitTokens === null}
                                    onChange={(e) =>
                                      setQuotaItems((prev) =>
                                        prev.map((item) =>
                                          item.providerId === q.providerId && item.role === q.role && item.model === q.model
                                            ? { ...item, limitTokens: e.target.checked ? null : 0 }
                                            : item
                                        )
                                      )
                                    }
                                  />
                                  無上限
                                </label>

                                <input
                                  type="number"
                                  min={0}
                                  value={q.limitTokens === null ? "" : q.limitTokens}
                                  disabled={q.limitTokens === null}
                                  onChange={(e) =>
                                    setQuotaItems((prev) =>
                                      prev.map((item) =>
                                        item.providerId === q.providerId && item.role === q.role && item.model === q.model
                                          ? { ...item, limitTokens: e.target.value === "" ? null : Number(e.target.value) }
                                          : item
                                      )
                                    )
                                  }
                                  className="w-32 h-8 rounded-lg border border-input/60 bg-background px-2 py-1"
                                  placeholder="Token Limit"
                                />

                                <div className="flex items-center gap-1.5">
                                  <span className="text-muted-foreground">刷新(小時)</span>
                                  <input
                                    type="number"
                                    min={1}
                                    value={q.refillIntervalHours}
                                  onChange={(e) =>
                                    setQuotaItems((prev) =>
                                      prev.map((item) =>
                                        item.providerId === q.providerId && item.role === q.role && item.model === q.model
                                          ? { ...item, refillIntervalHours: Math.max(1, Number(e.target.value || 12)) }
                                          : item
                                      )
                                    )
                                  }
                                    className="w-20 h-8 rounded-lg border border-input/60 bg-background px-2 py-1"
                                  />
                                </div>
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => openQuotaUsageDialog(q)}
                                  className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-border bg-background hover:bg-muted transition-colors shrink-0"
                                  title="View usage list"
                                >
                                  <Eye className="h-4 w-4" />
                                </button>
                              </div>

                            </div>
                          ))}
                        </div>
                      )}
                      {quotaProviderId === p.id && providerQuotaItems.length > 0 && filteredQuotaItems.length === 0 && (
                        <p className="text-xs text-muted-foreground">No quota matched your search/filter.</p>
                      )}
                      {quotaProviderId === p.id && !loadingQuotaProviderId && quotaItems.length === 0 && (
                        <p className="text-xs text-muted-foreground">No quota items. Select models to configure quotas.</p>
                      )}
                    </div>

                    <div className="flex justify-end border-t border-border/40 pt-3">
                      <button
                        onClick={() => saveProviderAll(p)}
                        disabled={savingProviderId === p.id || loadingQuotaProviderId === p.id}
                        className="h-9 px-5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-all shadow-sm active:scale-95 disabled:opacity-50"
                      >
                        {savingProviderId === p.id ? "Saving..." : "Save"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={usageDialogOpen} onOpenChange={setUsageDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Usage Status</DialogTitle>
            <DialogDescription>{usageDialogTitle}</DialogDescription>
          </DialogHeader>

          {usageLoading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : usageItems.length === 0 ? (
            <p className="text-sm text-muted-foreground">No users matched.</p>
          ) : (
            <div className="space-y-2">
              {usageItems.map((item) => (
                <div
                  key={item.userId}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border/50 p-3"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {item.image ? (
                      <img src={item.image} alt={item.name} className="h-8 w-8 rounded-full object-cover shrink-0" />
                    ) : (
                      <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs text-muted-foreground shrink-0">
                        {(item.name || "?").slice(0, 1).toUpperCase()}
                      </div>
                    )}
                    <span className="text-sm font-medium truncate">{item.name}</span>
                  </div>
                  <span className="text-xs text-muted-foreground text-right">
                    {formatTokenStatus(item.remainingTokens, item.refreshAt)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {showCreateDialog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget && !creating) setShowCreateDialog(false);
          }}
        >
          <div className="w-full max-w-md mx-4 bg-background rounded-2xl border border-border shadow-xl animate-in zoom-in-95 slide-in-from-bottom-4 duration-200">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border/50">
              <h3 className="font-semibold text-base">Global Provider</h3>
              <button
                type="button"
                onClick={() => !creating && setShowCreateDialog(false)}
                className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors"
                disabled={creating}
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
                  placeholder="e.g. OpenAI"
                  value={createForm.displayName}
                  onChange={(e) => setCreateForm((s) => ({ ...s, displayName: e.target.value }))}
                  className="w-full h-10 rounded-xl border border-input/60 bg-background px-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">
                  Prefix <span className="text-destructive">*</span>
                  <span className="ml-1.5 text-xs text-muted-foreground font-normal">4 alphanumeric chars</span>
                </label>
                <input
                  placeholder="e.g. OAI1"
                  value={createForm.prefix}
                  onChange={(e) => {
                    const nextPrefix = e.target.value.toUpperCase().slice(0, 4);
                    setCreateForm((s) => ({ ...s, prefix: nextPrefix }));
                    setCreatePrefixError(validateCreatePrefix(nextPrefix));
                  }}
                  className={`w-full h-10 rounded-xl border bg-background px-4 text-sm font-mono tracking-widest uppercase focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all ${createPrefixError ? "border-destructive focus:border-destructive" : "border-input/60 focus:border-primary/50"
                    }`}
                />
                {createPrefixError && <p className="text-xs text-destructive">{createPrefixError}</p>}
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">API URL</label>
                <div className="flex items-center gap-2">
                  <input
                    placeholder="https://api.openai.com/v1"
                    value={createForm.apiUrl}
                    onChange={(e) => setCreateForm((s) => ({ ...s, apiUrl: e.target.value }))}
                    className="flex-1 h-10 rounded-xl border border-input/60 bg-background px-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all"
                  />
                  <button
                    type="button"
                    onClick={applyUnieAIGlobalDefaults}
                    className="h-10 w-10 shrink-0 rounded-full border border-input/60 bg-background hover:bg-muted transition-colors inline-flex items-center justify-center"
                    title="Use UnieAI"
                  >
                    <UnieAIIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">API Key</label>
                <input
                  placeholder="sk-..."
                  value={createForm.apiKey}
                  onChange={(e) => setCreateForm((s) => ({ ...s, apiKey: e.target.value }))}
                  className="w-full h-10 rounded-xl border border-input/60 bg-background px-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all"
                  type="password"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border/50">
              <button
                type="button"
                onClick={() => setShowCreateDialog(false)}
                disabled={creating}
                className="h-9 px-4 rounded-xl text-sm text-muted-foreground hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={createProvider}
                disabled={creating || !!createPrefixError}
                className="h-9 px-5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-all shadow-sm active:scale-95 disabled:opacity-50"
              >
                {creating ? "Creating..." : "Create Global Provider"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
