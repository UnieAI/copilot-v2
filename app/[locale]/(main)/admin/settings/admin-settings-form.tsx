"use client";

import { useState } from "react";
import { adminConfigActions } from "./actions";
import { toast } from "sonner";
import { AdminSettings } from "@/lib/db/schema";
import { useRouter } from "next/navigation";

export function AdminSettingsForm({ settings }: { settings: AdminSettings | undefined }) {
    const router = useRouter();
    const [isSaving, setIsSaving] = useState(false);

    // State for dynamic model fetching
    const [workModels, setWorkModels] = useState<string[]>([]);
    const [taskModels, setTaskModels] = useState<string[]>([]);
    const [visionModels, setVisionModels] = useState<string[]>([]);

    const [isFetchingWork, setIsFetchingWork] = useState(false);
    const [isFetchingTask, setIsFetchingTask] = useState(false);
    const [isFetchingVision, setIsFetchingVision] = useState(false);

    const fetchModels = async (
        urlId: string,
        keyId: string,
        setModels: React.Dispatch<React.SetStateAction<string[]>>,
        setLoading: React.Dispatch<React.SetStateAction<boolean>>
    ) => {
        const urlInput = document.getElementById(urlId) as HTMLInputElement;
        const keyInput = document.getElementById(keyId) as HTMLInputElement;

        if (!urlInput?.value || !keyInput?.value) {
            toast.error("Please provide both API URL and Key to fetch models.");
            return;
        }

        let baseUrl = urlInput.value;
        if (!baseUrl.endsWith("/v1")) {
            toast.warning("URL usually ends with /v1 for OpenAI compatible APIs");
        }

        setLoading(true);
        try {
            const res = await fetch(`${baseUrl}/models`, {
                headers: { "Authorization": `Bearer ${keyInput.value}` }
            });
            if (!res.ok) throw new Error("Invalid response from API");
            const data = await res.json();
            const models = Array.isArray(data.data) ? data.data : [];
            setModels(models.map((m: any) => m.id));
            toast.success("Models fetched successfully!");
        } catch (e) {
            console.error(e);
            toast.error("Failed to fetch models. Check URL and Key.");
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            const formData = new FormData(e.currentTarget);
            await adminConfigActions(formData);
            toast.success("Settings saved successfully");
            router.refresh();
        } catch (error) {
            toast.error("Failed to save settings");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-8">
            <section className="border p-6 rounded-lg">
                <h2 className="text-xl font-semibold mb-4">Registration Behavior</h2>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-1">Default User Role</label>
                        <select name="defaultUserRole" defaultValue={settings?.defaultUserRole || 'pending'} className="w-full border rounded p-2 bg-background text-foreground">
                            <option value="pending">Pending</option>
                            <option value="user">User</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Pending Screen Message</label>
                        <textarea name="pendingMessage" defaultValue={settings?.pendingMessage} className="w-full border rounded p-2 bg-background text-foreground" rows={3}></textarea>
                    </div>
                </div>
            </section>

            {/* Work Model */}
            <section className="border p-6 rounded-lg space-y-4">
                <h2 className="text-xl font-semibold mb-2">Work Model (Title Generation / Summary)</h2>
                <p className="text-xs text-muted-foreground mb-4">Provide an OpenAI-compatible API. The URL must include the /v1 suffix (e.g. https://api.openai.com/v1).</p>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                        <label className="block text-sm mb-1">API URL (must end in /v1)</label>
                        <input id="work_url" name="workModelUrl" placeholder="https://api.openai.com/v1" defaultValue={settings?.workModelUrl || ""} className="w-full border rounded p-2 bg-background" />
                    </div>
                    <div>
                        <label className="block text-sm mb-1">API Key</label>
                        <input id="work_key" name="workModelKey" placeholder="sk-..." type="password" defaultValue={settings?.workModelKey || ""} className="w-full border rounded p-2 bg-background" />
                    </div>
                </div>
                <div className="flex gap-4 items-end">
                    <button
                        type="button"
                        onClick={() => fetchModels('work_url', 'work_key', setWorkModels, setIsFetchingWork)}
                        disabled={isFetchingWork}
                        className="bg-secondary text-secondary-foreground px-4 py-2 rounded text-sm whitespace-nowrap"
                    >
                        {isFetchingWork ? "Fetching..." : "Fetch Models"}
                    </button>
                    <div className="flex-1">
                        <label className="block text-sm mb-1">Selected Model</label>
                        {workModels.length > 0 ? (
                            <select name="workModelName" defaultValue={settings?.workModelName || ""} className="w-full border rounded p-2 bg-background">
                                {settings?.workModelName && !workModels.includes(settings.workModelName) && (
                                    <option value={settings.workModelName}>{settings.workModelName} (Current)</option>
                                )}
                                {workModels.map(m => <option key={m} value={m}>{m}</option>)}
                            </select>
                        ) : (
                            <input name="workModelName" placeholder="Fetch models first or type manually..." defaultValue={settings?.workModelName || ""} className="w-full border rounded p-2 bg-background" />
                        )}
                    </div>
                </div>
            </section>

            {/* Task Model */}
            <section className="border p-6 rounded-lg space-y-4">
                <h2 className="text-xl font-semibold mb-2">Task Model (MCP Tool Decision)</h2>
                <p className="text-xs text-muted-foreground mb-4">Provide an OpenAI-compatible API. The URL must include the /v1 suffix (e.g. https://api.openai.com/v1).</p>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                        <label className="block text-sm mb-1">API URL (must end in /v1)</label>
                        <input id="task_url" name="taskModelUrl" placeholder="https://api.openai.com/v1" defaultValue={settings?.taskModelUrl || ""} className="w-full border rounded p-2 bg-background" />
                    </div>
                    <div>
                        <label className="block text-sm mb-1">API Key</label>
                        <input id="task_key" name="taskModelKey" placeholder="sk-..." type="password" defaultValue={settings?.taskModelKey || ""} className="w-full border rounded p-2 bg-background" />
                    </div>
                </div>
                <div className="flex gap-4 items-end">
                    <button
                        type="button"
                        onClick={() => fetchModels('task_url', 'task_key', setTaskModels, setIsFetchingTask)}
                        disabled={isFetchingTask}
                        className="bg-secondary text-secondary-foreground px-4 py-2 rounded text-sm whitespace-nowrap"
                    >
                        {isFetchingTask ? "Fetching..." : "Fetch Models"}
                    </button>
                    <div className="flex-1">
                        <label className="block text-sm mb-1">Selected Model</label>
                        {taskModels.length > 0 ? (
                            <select name="taskModelName" defaultValue={settings?.taskModelName || ""} className="w-full border rounded p-2 bg-background">
                                {settings?.taskModelName && !taskModels.includes(settings.taskModelName) && (
                                    <option value={settings.taskModelName}>{settings.taskModelName} (Current)</option>
                                )}
                                {taskModels.map(m => <option key={m} value={m}>{m}</option>)}
                            </select>
                        ) : (
                            <input name="taskModelName" placeholder="Fetch models first or type manually..." defaultValue={settings?.taskModelName || ""} className="w-full border rounded p-2 bg-background" />
                        )}
                    </div>
                </div>
            </section>

            {/* Vision Model */}
            <section className="border p-6 rounded-lg space-y-4">
                <h2 className="text-xl font-semibold mb-2">Vision Model (Image Description)</h2>
                <p className="text-xs text-muted-foreground mb-4">Provide an OpenAI-compatible API. The URL must include the /v1 suffix (e.g. https://api.openai.com/v1).</p>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                        <label className="block text-sm mb-1">API URL (must end in /v1)</label>
                        <input id="vision_url" name="visionModelUrl" placeholder="https://api.openai.com/v1" defaultValue={settings?.visionModelUrl || ""} className="w-full border rounded p-2 bg-background" />
                    </div>
                    <div>
                        <label className="block text-sm mb-1">API Key</label>
                        <input id="vision_key" name="visionModelKey" placeholder="sk-..." type="password" defaultValue={settings?.visionModelKey || ""} className="w-full border rounded p-2 bg-background" />
                    </div>
                </div>
                <div className="flex gap-4 items-end">
                    <button
                        type="button"
                        onClick={() => fetchModels('vision_url', 'vision_key', setVisionModels, setIsFetchingVision)}
                        disabled={isFetchingVision}
                        className="bg-secondary text-secondary-foreground px-4 py-2 rounded text-sm whitespace-nowrap"
                    >
                        {isFetchingVision ? "Fetching..." : "Fetch Models"}
                    </button>
                    <div className="flex-1">
                        <label className="block text-sm mb-1">Selected Model</label>
                        {visionModels.length > 0 ? (
                            <select name="visionModelName" defaultValue={settings?.visionModelName || ""} className="w-full border rounded p-2 bg-background">
                                {settings?.visionModelName && !visionModels.includes(settings.visionModelName) && (
                                    <option value={settings.visionModelName}>{settings.visionModelName} (Current)</option>
                                )}
                                {visionModels.map(m => <option key={m} value={m}>{m}</option>)}
                            </select>
                        ) : (
                            <input name="visionModelName" placeholder="Fetch models first or type manually..." defaultValue={settings?.visionModelName || ""} className="w-full border rounded p-2 bg-background" />
                        )}
                    </div>
                </div>
            </section>

            <button disabled={isSaving} type="submit" className="bg-primary text-primary-foreground px-6 py-2 rounded-md font-medium disabled:opacity-50">
                {isSaving ? "Saving..." : "Save Settings"}
            </button>
        </form>
    );
}
