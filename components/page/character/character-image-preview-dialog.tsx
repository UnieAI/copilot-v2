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

import { handleOnBirthdayChange } from "@/utils/character/functions"
import { handleDrag, handleDrop, handleImageUpload } from "@/utils/character/character-image/functions"

interface Props {
    open: boolean;
    setOpen: React.Dispatch<React.SetStateAction<boolean>>;
    previewImageName: string;
    previewImageSrc: string;
}

export const CharacterImagePreviewDialog = ({
    open,
    setOpen,
    previewImageName,
    previewImageSrc,
}: Props) => {

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <User className="w-5 h-5" />
                        {previewImageName} - 頭像預覽
                    </DialogTitle>
                </DialogHeader>
                <div className="flex justify-center p-4">
                    <div className="relative w-80 h-80 rounded-lg overflow-hidden border shadow-lg">
                        <Image src={previewImageSrc || "/placeholder.svg"} alt={previewImageName} fill className="object-cover" />
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}