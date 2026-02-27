import type React from "react"

import { useEffect, useMemo, useState } from "react"
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
    Search,
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
    setPreviewImageSrc: React.Dispatch<React.SetStateAction<string>>;
    setPreviewImageName: React.Dispatch<React.SetStateAction<string>>;
    setImagePreviewOpen: React.Dispatch<React.SetStateAction<boolean>>;
    setEditCharacter: (character: CharacterType) => void
    setEditDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
    setCharacterToDelete: (character: CharacterType) => void
    setDeleteDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

export const CharacterTable = ({
    characterDatas,
    setPreviewImageSrc,
    setPreviewImageName,
    setImagePreviewOpen,
    setEditCharacter,
    setEditDialogOpen,
    setCharacterToDelete,
    setDeleteDialogOpen,
}: Props) => {

    const openEditDialog = (character: CharacterType) => {
        setEditCharacter(character);
        setEditDialogOpen(true);
    }

    const handleDeleteClick = (character: CharacterType) => {
        setCharacterToDelete(character);
        setDeleteDialogOpen(true);
    }

    // 新增搜尋與篩選狀態
    const [searchTerm, setSearchTerm] = useState("");
    const [genderFilter, setGenderFilter] = useState<"all" | Gender>("all");

    // 過濾資料：先篩選性別，再套用搜尋
    const filteredData = useMemo(() => {
        let data = characterDatas;

        // 性別篩選
        if (genderFilter !== "all") {
            data = data.filter((char) => char.gender === genderFilter);
        }

        // 搜尋 name 或 tag
        if (searchTerm.trim()) {
            const term = searchTerm.toLowerCase().trim();
            data = data.filter(
                (char) =>
                    char.name.toLowerCase().includes(term) ||
                    (char.tag && char.tag.toLowerCase().includes(term))
            );
        }

        return data;
    }, [characterDatas, searchTerm, genderFilter]);

    const columns: ColumnDef<CharacterType>[] = [
        {
            accessorKey: "image",
            header: "頭像",
            cell: ({ row }) => (
                <div className="flex justify-center">
                    <div
                        className="relative w-12 h-12 rounded-full overflow-hidden border-2 border-zinc-200 cursor-pointer hover:border-blue-400 transition-colors"
                        onClick={() => {
                            setPreviewImageSrc(row.getValue("image") || "/placeholder.svg")
                            setPreviewImageName(row.getValue("name") || "Unknown")
                            setImagePreviewOpen(true)
                        }}
                    >
                        <Image src={row.getValue("image") || "/placeholder.svg"} alt="avatar" fill className="object-cover" />
                    </div>
                </div>
            ),
        },
        {
            accessorKey: "name",
            header: "姓名",
            cell: ({ row }) => {
                return (
                    <div className="flex flex-col items-center gap-1 text-sm">
                        <div className="font-medium">{row.getValue("name")}</div>
                        <div className="font-medium text-xs text-muted-foreground">{row.original.tag}</div>
                    </div>
                )
            },
        },
        {
            accessorKey: "gender",
            header: "性別",
            cell: ({ row }) => {
                const gender = row.getValue("gender") as Gender
                const genderOption = GENDER_OPTIONS.find((option) => option.value === gender)
                return (
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        {gender === Gender.MALE ? (
                            <Mars className="w-4 h-4 text-blue-500" />
                        ) : (
                            <Venus className="w-4 h-4 text-pink-500" />
                        )}
                        {genderOption?.label}
                    </div>
                )
            },
        },
        {
            accessorKey: "birthday",
            header: "生日",
            cell: ({ row }) => (
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Calendar className="w-3 h-3" />
                    {row.getValue("birthday")}
                </div>
            ),
        },
        {
            accessorKey: "zodiac",
            header: "星座",
            cell: ({ row }) => (
                <div className="flex items-center gap-1">
                    <Star className="w-3 h-3 text-yellow-500" />
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">{row.getValue("zodiac")}</div>
                </div>
            ),
        },
        {
            accessorKey: "bloodType",
            header: "血型",
            cell: ({ row }) => {
                const bloodType = row.getValue("bloodType") as BloodType
                const bloodTypeOption = BLOOD_TYPE_OPTIONS.find((option) => option.value === bloodType)
                return (
                    <div className="flex items-center gap-1">
                        <Droplets className="w-3 h-3 text-red-500" />
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">{bloodTypeOption?.label}</div>
                    </div>
                )
            },
        },
        {
            accessorKey: "mbti",
            header: "MBTI",
            cell: ({ row }) => {
                const mbti = row.getValue("mbti") as PersonalityType
                const personalityOption = PERSONALITY_OPTIONS.find((option) => option.value === mbti)
                return (
                    <div className="flex items-center gap-1">
                        <Brain className="w-3 h-3 text-purple-500" />
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">{personalityOption?.label}</div>
                    </div>
                )
            },
        },
        // {
        //   accessorKey: "systemPrompt",
        //   header: "System Prompt",
        //   cell: ({ row }) => (
        //     <div className="flex items-start gap-1 max-w-xs">
        //       <Code className="w-3 h-3 text-blue-500 mt-0.5 flex-shrink-0" />
        //       <div className="line-clamp-2 text-sm text-muted-foreground">{row.getValue("systemPrompt")}</div>
        //     </div>
        //   ),
        // },
        {
            id: "actions",
            header: "操作",
            cell: ({ row }) => (
                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openEditDialog(row.original)}
                        className="hover:bg-blue-500 hover:border-blue-700"
                    >
                        <Edit className="w-3 h-3 mr-1" />
                        編輯
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteClick(row.original)}
                        className="hover:bg-red-500 hover:border-red-700"
                    >
                        <Trash2 className="w-3 h-3 mr-1" />
                        刪除
                    </Button>
                </div>
            ),
        },
    ];

    // 使用過濾後的資料來建立 table
    const table = useReactTable({
        data: filteredData,
        columns,
        getCoreRowModel: getCoreRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
    });

    // 當 filteredData 改變時，自動回到第一頁
    useEffect(() => {
        table.setPageIndex(0);
    }, [filteredData]);

    return (
        <>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                {/* 左邊：搜尋框 */}
                <div className="w-full sm:w-72 relative">
                    <Input
                        placeholder="搜尋姓名或註記..."
                        value={searchTerm}
                        onChange={(e) => {
                            setSearchTerm(e.target.value);
                            table.setPageIndex(0); // 搜尋時回到第一頁
                        }}
                        className="pl-9"
                    />
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                </div>

                {/* 右邊：性別篩選 */}
                <div className="flex items-center gap-3 w-full sm:w-auto">
                    <Select
                        value={genderFilter}
                        onValueChange={(value) => {
                            setGenderFilter(value as "all" | Gender);
                            table.setPageIndex(0); // 切換篩選時回到第一頁
                        }}
                    >
                        <SelectTrigger className="w-[140px]">
                            <SelectValue placeholder="性別篩選" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">全部</SelectItem>
                            <SelectItem value={Gender.MALE}>
                                <div className="flex items-center gap-2">
                                    <Mars className="h-4 w-4 text-blue-500" />
                                    男性
                                </div>
                            </SelectItem>
                            <SelectItem value={Gender.FEMALE}>
                                <div className="flex items-center gap-2">
                                    <Venus className="h-4 w-4 text-pink-500" />
                                    女性
                                </div>
                            </SelectItem>
                        </SelectContent>
                    </Select>

                    {/* 顯示目前篩選結果數量 */}
                    <div className="text-sm text-muted-foreground whitespace-nowrap">
                        共 {filteredData.length} 位
                    </div>
                </div>
            </div>

            <Card className="bg-card shadow-sm">
                <CardContent className="p-0">
                    <div className="rounded-lg overflow-hidden">
                        <Table>
                            <TableHeader className="bg-muted/50">
                                {table.getHeaderGroups().map((headerGroup) => (
                                    <TableRow key={headerGroup.id} className="border-b">
                                        {headerGroup.headers.map((header) => (
                                            <TableHead key={header.id} className="font-semibold py-4">
                                                {flexRender(header.column.columnDef.header, header.getContext())}
                                            </TableHead>
                                        ))}
                                    </TableRow>
                                ))}
                            </TableHeader>
                            <TableBody>
                                {table.getRowModel().rows.length ? (
                                    table.getRowModel().rows.map((row) => (
                                        <TableRow key={row.id} className="hover:bg-muted/50 transition-colors border-b">
                                            {row.getVisibleCells().map((cell) => (
                                                <TableCell key={cell.id} className="py-4">
                                                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                                </TableCell>
                                            ))}
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={columns.length} className="text-center py-16">
                                            <div className="flex flex-col items-center gap-3">
                                                <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center">
                                                    <Users className="w-8 h-8 text-muted-foreground" />
                                                </div>
                                                <div>
                                                    <p className="text-lg font-medium">還沒有角色</p>
                                                    <p className="text-sm text-muted-foreground">點擊上方按鈕新增你的第一個角色</p>
                                                </div>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            {/* Pagination */}
            {table.getPageCount() > 1 && (
                <div className="flex items-center justify-between">
                    <div className="text-sm text-muted-foreground">
                        顯示 {table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1} 到{" "}
                        {Math.min((table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize, characterDatas.length)}{" "}
                        項， 共 {characterDatas.length} 項
                    </div>
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => table.previousPage()}
                            disabled={!table.getCanPreviousPage()}
                        >
                            上一頁
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
                            下一頁
                        </Button>
                    </div>
                </div>
            )}
        </>
    )
}