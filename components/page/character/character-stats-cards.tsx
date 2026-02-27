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
    characterDatas: CharacterType[];
}

export const CharacterStatsCards = ({
    characterDatas,
}: Props) => {

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="bg-card shadow-sm">
                <CardContent className="p-6">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-100 rounded-lg">
                            <Users className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">總角色數</p>
                            <p className="text-2xl font-bold">{characterDatas.length}</p>
                        </div>
                    </div>
                </CardContent>
            </Card>
            <Card className="bg-card shadow-sm">
                <CardContent className="p-6">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-100 rounded-lg">
                            <Mars className="w-5 h-5 text-blue-500" />
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">男性角色</p>
                            <p className="text-2xl font-bold">{characterDatas.filter((char) => char.gender === Gender.MALE).length}</p>
                        </div>
                    </div>
                </CardContent>
            </Card>
            <Card className="bg-card shadow-sm">
                <CardContent className="p-6">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-pink-100 rounded-lg">
                            <Venus className="w-5 h-5 text-pink-500" />
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">女性角色</p>
                            <p className="text-2xl font-bold">{characterDatas.filter((char) => char.gender === Gender.FEMALE).length}</p>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}