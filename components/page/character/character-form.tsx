"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { initialCharacter, type CharacterType } from "@/utils/character/type"
import {
    Gender,
    BloodType,
    PersonalityType,
    GENDER_OPTIONS,
    BLOOD_TYPE_OPTIONS,
    PERSONALITY_OPTIONS,
} from "@/utils/character"
import {
    type ColumnDef,
    getCoreRowModel,
    useReactTable,
    flexRender,
    getPaginationRowModel,
} from "@tanstack/react-table"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent } from "@/components/ui/card"
import {
    Upload,
    Users,
    Edit,
    Trash2,
    Calendar,
    Droplets,
    Brain,
    Star,
    User,
    Mars,
    Venus,
} from "lucide-react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { cn } from "../../../lib/utils"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"

import { calculateZodiac } from "@/utils/character/functions"

import { CharacterStatsCards } from "./character-stats-cards"
import { CharacterTable } from "./character-table"
import { CreateCharacterDialog } from "./create-character-dialog"
import { EditCharacterDialog } from "./edit-character-dialog"
import { DeleteCharacterAlertDialog } from "./delete-character-alert-dialog"
import { CharacterImagePreviewDialog } from "./character-image-preview-dialog"
import { ActionGetCharactersByUser } from "@/app/(main)/actions"
import { Session } from "next-auth"
import { toast } from "sonner"
import { UniformDetail } from "../game/guessing-dick/step1"

export const CharacterForm = ({
    session
}: {
    session: Session
}) => {
    const [characterDatas, setCharacterDatas] = useState<CharacterType[]>([]);

    const [createDialogOpen, setCreateDialogOpen] = useState<boolean>(false);

    const [editDialogOpen, setEditDialogOpen] = useState<boolean>(false);
    const [editCharacter, setEditCharacter] = useState<CharacterType>(initialCharacter);

    const [deleteDialogOpen, setDeleteDialogOpen] = useState<boolean>(false);
    const [characterToDelete, setCharacterToDelete] = useState<CharacterType | null>(null);

    const [imagePreviewOpen, setImagePreviewOpen] = useState<boolean>(false);
    const [previewImageSrc, setPreviewImageSrc] = useState<string>("");
    const [previewImageName, setPreviewImageName] = useState<string>("");

    const router = useRouter();

    const fetchData = async () => {
        try {
            if (!session?.user?.id) {
                console.warn("無法載入角色：使用者未登入");
                toast.error("請先登入以查看您的角色");
                return;
            }

            const rawCharacters = await ActionGetCharactersByUser({
                userId: session.user.id,
            });

            // 轉換成前端期望的型別
            const characters: CharacterType[] = rawCharacters.map((char) => ({
                id: char.id,
                userId: char.userId,
                image: char.image,
                name: char.name,
                tag: char.tag ?? "",
                gender: char.gender as Gender,
                birthday: char.birthday,
                zodiac: char.zodiac,
                bloodType: char.bloodType as BloodType,
                personality: char.personality ?? "",
                systemPrompt: char.systemPrompt ?? "",
                englishName: char.englishName ?? "",
                mbti: char.mbti as PersonalityType,
                birthplace: char.birthplace ?? "",
                education: char.education ?? "",
                appearance: char.appearance ?? "",
                detail: char.detail ?? "",
                uniformDetail: char.uniformDetail as UniformDetail || null,
            }));

            setCharacterDatas(characters);

        } catch (error) {
            console.error("載入角色失敗：", error);
            toast.error("載入角色失敗，請稍後再試");
            setCharacterDatas([]); // 發生錯誤時顯示空陣列，避免無限載入
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-500 rounded-lg">
                        <Users className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold">角色管理</h1>
                        <p className="text-muted-foreground">管理你的AI角色設定</p>
                    </div>
                </div>

                {/* 新增角色對話框 */}
                <CreateCharacterDialog
                    session={session}
                    open={createDialogOpen}
                    setOpen={setCreateDialogOpen}
                    fetchData={fetchData}
                />
            </div>

            {/* Stats Cards */}
            <CharacterStatsCards
                characterDatas={characterDatas}
            />

            {/* Table */}
            <CharacterTable
                characterDatas={characterDatas}
                setPreviewImageSrc={setPreviewImageSrc}
                setPreviewImageName={setPreviewImageName}
                setImagePreviewOpen={setImagePreviewOpen}
                setEditCharacter={setEditCharacter}
                setEditDialogOpen={setEditDialogOpen}
                setCharacterToDelete={setCharacterToDelete}
                setDeleteDialogOpen={setDeleteDialogOpen}
            />

            {/* 編輯角色對話框 */}
            <EditCharacterDialog
                open={editDialogOpen}
                setOpen={setEditDialogOpen}
                fetchData={fetchData}
                selectCharacter={editCharacter}
                setSelectCharacter={setEditCharacter}
            />

            {/* 刪除確認對話框 */}
            <DeleteCharacterAlertDialog
                open={deleteDialogOpen}
                setOpen={setDeleteDialogOpen}
                fetchData={fetchData}
                selectCharacter={characterToDelete}
                setSelectCharacter={setCharacterToDelete}
            />

            {/* 圖片預覽對話框 */}
            <CharacterImagePreviewDialog
                open={imagePreviewOpen}
                setOpen={setImagePreviewOpen}
                previewImageName={previewImageName}
                previewImageSrc={previewImageSrc}
            />
        </div>
    )
}
