"use client";

import { useState } from "react";
import { adminConfigActions } from "./actions";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card"; // 假設你有這個
import { Sparkles, Globe, Eye, Zap, Save, RefreshCw } from "lucide-react";

type AdminSettings = {
    defaultUserRole?: string | null;
    pendingMessage?: string | null;
    workModelUrl?: string | null;
    workModelKey?: string | null;
    workModelName?: string | null;
    taskModelUrl?: string | null;
    taskModelKey?: string | null;
    taskModelName?: string | null;
    visionModelUrl?: string | null;
    visionModelKey?: string | null;
    visionModelName?: string | null;
};

export function AdminSettingsForm({ settings }: { settings: AdminSettings | undefined }) {
    const router = useRouter();
    const [isSaving, setIsSaving] = useState(false);
    const [workModels, setWorkModels] = useState<string[]>([]);
    const [taskModels, setTaskModels] = useState<string[]>([]);
    const [visionModels, setVisionModels] = useState<string[]>([]);

    const [loadingMap, setLoadingMap] = useState<Record<string, boolean>>({});

    const fetchModels = async (type: string, urlId: string, keyId: string, setModels: any) => {
        const urlInput = document.getElementById(urlId) as HTMLInputElement;
        const keyInput = document.getElementById(keyId) as HTMLInputElement;

        if (!urlInput?.value || !keyInput?.value) {
            toast.error("請提供 API URL 與 Key");
            return;
        }

        setLoadingMap(prev => ({ ...prev, [type]: true }));
        try {
            const res = await fetch(`${urlInput.value}/models`, {
                headers: { "Authorization": `Bearer ${keyInput.value}` }
            });
            const data = await res.json();
            const models = Array.isArray(data.data) ? data.data : [];
            setModels(models.map((m: any) => m.id));
            toast.success("模型清單更新成功");
        } catch (e) {
            toast.error("讀取失敗，請檢查網路或 API 設定");
        } finally {
            setLoadingMap(prev => ({ ...prev, [type]: false }));
        }
    };

    const inputClasses = "w-full h-11 rounded-2xl border-none ring-1 ring-border/50 bg-muted/30 px-4 text-sm focus:ring-2 focus:ring-primary/40 focus:bg-background transition-all duration-300 outline-none";
    const labelClasses = "block text-[13px] font-bold text-foreground/70 mb-2 ml-1 tracking-wide";
    const sectionClasses = "p-6 md:p-8 rounded-[32px] border border-border/30 bg-background/40 shadow-sm space-y-6";

    return (
        <form onSubmit={async (e) => {
            e.preventDefault();
            setIsSaving(true);
            try {
                await adminConfigActions(new FormData(e.currentTarget));
                toast.success("設定已儲存");
                router.refresh();
            } catch {
                toast.error("儲存失敗");
            } finally {
                setIsSaving(false);
            }
        }} className="space-y-10 pb-20">

            {/* 註冊行為設定 */}
            <section className={sectionClasses}>
                <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 rounded-xl bg-primary/10 text-primary">
                        <Globe className="h-5 w-5" />
                    </div>
                    <h2 className="text-xl font-semibold">註冊行為</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className={labelClasses}>預設用戶權限</label>
                        <select name="defaultUserRole" defaultValue={settings?.defaultUserRole || 'pending'} className={inputClasses}>
                            <option value="pending">審核中 (Pending)</option>
                            <option value="user">正式用戶 (User)</option>
                        </select>
                    </div>
                    <div className="md:col-span-2">
                        <label className={labelClasses}>待審核頁面文字</label>
                        <textarea name="pendingMessage" defaultValue={settings?.pendingMessage ?? ""} className="w-full rounded-2xl border-none ring-1 ring-border/50 bg-muted/30 p-4 text-sm focus:ring-2 focus:ring-primary/40 focus:bg-background transition-all outline-none" rows={3} />
                    </div>
                </div>
            </section>

            {/* 模型區塊範本組件 */}
            {[
                { id: 'work', title: 'Work Model', icon: <Sparkles />, desc: '負責標題生成與內容摘要', url: 'workModelUrl', key: 'workModelKey', name: 'workModelName', models: workModels, setter: setWorkModels },
                { id: 'task', title: 'Task Model', icon: <Zap />, desc: '負責 MCP 工具決策與複雜任務', url: 'taskModelUrl', key: 'taskModelKey', name: 'taskModelName', models: taskModels, setter: setTaskModels },
                { id: 'vision', title: 'Vision Model', icon: <Eye />, desc: '負責圖片理解與視覺分析', url: 'visionModelUrl', key: 'visionModelKey', name: 'visionModelName', models: visionModels, setter: setVisionModels }
            ].map((m) => (
                <section key={m.id} className={sectionClasses}>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-xl bg-primary/10 text-primary">{m.icon}</div>
                            <div>
                                <h2 className="text-xl font-semibold">{m.title}</h2>
                                <p className="text-xs text-muted-foreground">{m.desc}</p>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className={labelClasses}>API Endpoint</label>
                            <input id={`${m.id}_url`} name={m.url} placeholder="https://..." defaultValue={(settings as any)?.[m.url] || ""} className={inputClasses} />
                        </div>
                        <div>
                            <label className={labelClasses}>API Key</label>
                            <input id={`${m.id}_key`} name={m.key} type="password" placeholder="sk-..." defaultValue={(settings as any)?.[m.key] || ""} className={inputClasses} />
                        </div>
                    </div>

                    <div className="flex flex-col md:flex-row gap-4 items-end bg-muted/20 p-4 rounded-2xl">
                        <div className="flex-1 w-full">
                            <label className={labelClasses}>指定模型名稱</label>
                            {m.models.length > 0 ? (
                                <select name={m.name} defaultValue={(settings as any)?.[m.name] || ""} className={inputClasses}>
                                    {m.models.map(id => <option key={id} value={id}>{id}</option>)}
                                </select>
                            ) : (
                                <input name={m.name} placeholder="請先獲取模型或手動輸入..." defaultValue={(settings as any)?.[m.name] || ""} className={inputClasses} />
                            )}
                        </div>
                        <button
                            type="button"
                            onClick={() => fetchModels(m.id, `${m.id}_url`, `${m.id}_key`, m.setter)}
                            disabled={loadingMap[m.id]}
                            className="h-11 px-6 rounded-xl bg-background border border-border/50 text-sm font-bold hover:bg-primary hover:text-primary-foreground transition-all shadow-sm flex items-center gap-2 disabled:opacity-50"
                        >
                            <RefreshCw className={`h-4 w-4 ${loadingMap[m.id] ? 'animate-spin' : ''}`} />
                            獲取清單
                        </button>
                    </div>
                </section>
            ))}

            {/* --- 懸浮儲存按鈕 --- */}
            <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-30 w-full max-w-[200px]">
                <button
                    disabled={isSaving}
                    type="submit"
                    className="group w-full h-14 bg-primary text-primary-foreground rounded-full shadow-[0_8px_30px_rgb(var(--primary)/0.4)] hover:shadow-[0_8px_30px_rgb(var(--primary)/0.6)] hover:scale-105 active:scale-95 transition-all duration-300 flex items-center justify-center gap-2 font-bold"
                >
                    {isSaving ? (
                        <RefreshCw className="h-5 w-5 animate-spin" />
                    ) : (
                        <>
                            <Save className="h-5 w-5" />
                            <span>儲存變更</span>
                        </>
                    )}
                </button>
            </div>
        </form>
    );
}