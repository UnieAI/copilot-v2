'use server';

import bcrypt from "bcryptjs";
import {
    createUser,
    getUserByEmail,
    getUserApiSettings,
    upsertUserApiSettings,
    deleteUserApiSettings,
    getCharactersByUser,
    getGirlsByUser,
    getBoysByUser,
    getCharacterById,
    createCharacter,
    updateCharacter,
    deleteCharacter,
    getSystemPromptTemplates,
    getSystemPromptTemplateById,
    createSystemPromptTemplate,
    updateSystemPromptTemplate,
    deleteSystemPromptTemplate,
    createGuessingDickLeaderboardEntry,
    getGuessingDickLeaderboard,
    deleteGuessingDickLeaderboardEntry,
} from "@/lib/db/queries";
import { ApiSettings } from "@/utils/settings/type";

export async function registerUser(
    email: string,
    password: string,
    username: string,
    userimage: string
): Promise<{ success: boolean; message?: string }> {
    if (!email || !password || !username) {
        return { success: false, message: "欄位不可為空" };
    }

    // 檢查 email 是否存在
    const existingUser = await getUserByEmail(email);
    if (existingUser) {
        return { success: false, message: "此 Email 已被註冊" };
    }

    // 密碼加密
    const hashedPassword = await bcrypt.hash(password, 10);

    // 建立使用者
    await createUser(
        email,
        hashedPassword,
        username,
        userimage || "/system/default-avatar.png"
    );

    return { success: true };
}

export async function ActionGetUserImgByEmail(data: { email: string }) {
    if (!data.email) {
        throw new Error("Email is required");
    }

    const img = (await getUserByEmail(data.email)).userimage;

    if (!img) {
        return { success: false, message: "User not found or no image", image: null };
    }

    return { success: true, image: img };
}

// -------------------------------------------------------------------

/**
 * 取得使用者的 API 設定
 * @param userId - 必須傳入的使用者 ID
 */
export async function ActionGetUserApiSettings(userId: string) {
    if (!userId) {
        throw new Error("userId is required");
    }

    const settings = await getUserApiSettings(userId);
    if (!settings) return null;

    return {
        apiUrl: settings.apiUrl,
        apiKey: settings.apiKey,
        selectedModel: settings.selectedModel || "",
    } satisfies ApiSettings;
}

/**
 * 儲存 / 更新使用者的 API 設定（upsert）
 * @param userId - 必須傳入的使用者 ID
 * @param settings - 要儲存的設定資料
 */
export async function ActionSaveUserApiSettings(
    userId: string,
    settings: ApiSettings
): Promise<{ success: boolean; message?: string }> {
    if (!userId) {
        return { success: false, message: "userId is required" };
    }

    if (!settings.apiUrl || !settings.apiKey) {
        return { success: false, message: "API URL 和 API Key 為必填" };
    }

    await upsertUserApiSettings(userId, {
        apiUrl: settings.apiUrl.replace(/\/$/, ""),
        apiKey: settings.apiKey,
        selectedModel: settings.selectedModel || null,
    });

    return { success: true };
}

/**
 * 刪除使用者的 API 設定
 * @param userId - 必須傳入的使用者 ID
 */
export async function ActionDeleteUserApiSettings(userId: string) {
    if (!userId) {
        throw new Error("userId is required");
    }

    await deleteUserApiSettings(userId);
    return { success: true };
}

// -------------------------------------------------------------------

export async function ActionGetCharactersByUser(data: { userId: string }) {
    if (!data.userId) throw new Error("User ID is required");
    return await getCharactersByUser(data.userId);
}

export async function ActionGetGirlsByUser(data: { userId: string }) {
    if (!data.userId) throw new Error("User ID is required");
    return await getGirlsByUser(data.userId);
}

export async function ActionGetBoysByUser(data: { userId: string }) {
    if (!data.userId) throw new Error("User ID is required");
    return await getBoysByUser(data.userId);
}

export async function ActionGetCharacterById(data: { id: string }) {
    if (!data.id) throw new Error("ID is required");
    return await getCharacterById(data.id);
}

export async function ActionCreateCharacter(data: any) {
    if (!data.userId || !data.name) throw new Error("User ID and name are required");
    return await createCharacter(data);
}

export async function ActionUpdateCharacter(data: any) {
    if (!data.id) throw new Error("ID is required");
    return await updateCharacter(data.id, data);
}

export async function ActionDeleteCharacter(data: { id: string }) {
    if (!data.id) throw new Error("ID is required");
    return await deleteCharacter(data.id);
}

// -------------------------------------------------------------------

/**
 * 取得所有 System Prompt Templates
 */
export async function ActionGetSystemPromptTemplates(data: { userId: string }) {
    return await getSystemPromptTemplates(data.userId);
}

/**
 * 取得單一 System Prompt Template
 */
export async function ActionGetSystemPromptTemplateById(data: {
    id: string;
}) {
    if (!data.id) throw new Error("ID is required");
    return await getSystemPromptTemplateById(data.id);
}

/**
 * 新增 System Prompt Template
 */
export async function ActionCreateSystemPromptTemplate(data: {
    userId: string;
    name: string;
    content: string;
}) {
    if (!data.userId || !data.name || !data.content) {
        throw new Error("userId, name and content are required");
    }
    return await createSystemPromptTemplate(data);
}

/**
 * 更新 System Prompt Template
 */
export async function ActionUpdateSystemPromptTemplate(data: {
    id: string;
    name?: string;
    content?: string;
}) {
    if (!data.id) throw new Error("ID is required");

    return await updateSystemPromptTemplate(data.id, {
        name: data.name,
        content: data.content,
    });
}

/**
 * 刪除 System Prompt Template
 */
export async function ActionDeleteSystemPromptTemplate(data: {
    id: string;
}) {
    if (!data.id) throw new Error("ID is required");
    return await deleteSystemPromptTemplate(data.id);
}

// -------------------------------------------------------------------

/**
 * 新增排行榜紀錄
 */
export async function ActionCreateGuessingDickLeaderboardEntry(data: {
    girlName: string;
    girlImg: string;
    boyName: string;
    amount: number;
}) {
    if (!data.girlName || !data.boyName || data.amount == null) {
        throw new Error("Girl name, boy name, and amount are required");
    }

    return await createGuessingDickLeaderboardEntry({
        girlName: data.girlName,
        girlImg: data.girlImg,
        boyName: data.boyName,
        amount: data.amount,
    });
}

/**
 * 刪除單筆排行榜紀錄
 */
export async function ActionDeleteGuessingDickLeaderboardEntry(data: {
    id: string;
}) {
    if (!data.id) {
        throw new Error("ID is required");
    }

    const deleted = await deleteGuessingDickLeaderboardEntry(data.id);

    if (!deleted) {
        return { success: false, message: "紀錄不存在或已被刪除" };
    }

    return { success: true, message: "排行榜紀錄已刪除", deletedEntry: deleted };
}

/**
 * 取得排行榜（前 N 名）
 */
export async function ActionGetGuessingDickLeaderboard(data: {
    limit?: number;
}) {
    return await getGuessingDickLeaderboard(data.limit);
}

// -------------------------------------------------------------------



// -------------------------------------------------------------------
