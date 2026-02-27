import type React from "react"

import { useEffect, useState } from "react"
import type { CharacterType } from "@/utils/character/type"
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

import { ActionDeleteCharacter } from "@/app/(main)/actions"
import { toast } from "sonner"

interface Props {
    open: boolean;
    setOpen: React.Dispatch<React.SetStateAction<boolean>>;
    fetchData: () => Promise<void>;
    selectCharacter: CharacterType | null;
    setSelectCharacter: React.Dispatch<React.SetStateAction<CharacterType | null>>;
}

export const DeleteCharacterAlertDialog = ({
    open,
    setOpen,
    fetchData,
    selectCharacter,
    setSelectCharacter,
}: Props) => {

    const confirmDeleteCharacter = async () => {
        if (!selectCharacter) return;

        try {
            await ActionDeleteCharacter({ id: selectCharacter.id });

            toast.success("角色刪除成功");
            setOpen(false);
            setSelectCharacter(null);
            await fetchData();
        } catch (error) {
            console.error("刪除角色失敗：", error);
            toast.error("刪除角色失敗，請稍後再試");
        }
    }

    return (
        <AlertDialog open={open} onOpenChange={setOpen}>
            <AlertDialogContent className="max-w-md">
                <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center gap-2 text-red-600">
                        <Trash2 className="w-5 h-5" />
                        確認刪除角色
                    </AlertDialogTitle>
                    <AlertDialogDescription className="space-y-3">
                        <div className="text-center">
                            {selectCharacter && (
                                <div className="flex flex-col items-center gap-3 py-4">
                                    <div className="relative w-16 h-16 rounded-full overflow-hidden border-4 border-red-100">
                                        <Image
                                            src={selectCharacter.image || "/placeholder.svg"}
                                            alt={selectCharacter.name}
                                            fill
                                            className="object-cover"
                                        />
                                    </div>
                                    <div>
                                        <p className="font-semibold text-lg">{selectCharacter.name}</p>
                                        <p className="text-sm text-muted-foreground">
                                            {selectCharacter.mbti} • {selectCharacter.zodiac}
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="text-center space-y-2">
                            <p className="font-medium text-red-600">你確定要刪除這個角色嗎？</p>
                            <p className="text-sm text-muted-foreground">此操作無法復原，角色的所有資料將會永久刪除。</p>
                        </div>
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="gap-2">
                    <AlertDialogCancel className="flex-1">取消</AlertDialogCancel>
                    <AlertDialogAction
                        onClick={confirmDeleteCharacter}
                        className="flex-1 bg-red-600 hover:bg-red-700 focus:ring-red-600 text-white"
                    >
                        <Trash2 className="w-4 h-4 mr-2" />
                        確認刪除
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    )
}