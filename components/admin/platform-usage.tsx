"use client"

import { useEffect, useMemo, useState, useRef } from "react"
import { Area, AreaChart, CartesianGrid, XAxis, ResponsiveContainer, Tooltip } from "recharts"
import {
    Search, ChevronLeft, ChevronRight, Download,
    FileText, TrendingUp, Users, User, Calendar, Printer, Save, Trash2
} from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog"

// --- Types ---
type UsageTimeseries = { date: string, totalTokens: number, personalTokens: number, groupTokens: number }
type GroupRow = { groupId: string | null, groupName: string, totalTokens: number }
type Totals = { totalTokens: number, personalTokens: number, groupTokens: number }
type DetailRow = {
    id: string
    model: string | null
    providerPrefix: string | null
    totalTokens: number
    createdAt: string
    user: { id: string, name?: string | null, email?: string | null }
    group: { id: string, name?: string | null } | null
    source: "group" | "personal"
}

export default function PlatformUsage() {
    const [rangeStart, setRangeStart] = useState(() => {
        const d = new Date()
        d.setDate(d.getDate() - 30)
        return d.toISOString().slice(0, 10)
    })
    const [rangeEnd, setRangeEnd] = useState(() => new Date().toISOString().slice(0, 10))
    const [timeseries, setTimeseries] = useState<UsageTimeseries[]>([])
    const [perGroup, setPerGroup] = useState<GroupRow[]>([])
    const [totals, setTotals] = useState<Totals>({ totalTokens: 0, personalTokens: 0, groupTokens: 0 })
    const [loading, setLoading] = useState(false)
    const [details, setDetails] = useState<DetailRow[]>([])

    // UI States
    const [groupPage, setGroupPage] = useState(1)
    const [detailPage, setDetailPage] = useState(1)
    const [detailSearch, setDetailSearch] = useState("")
    const pageSize = 10

    // Invoice Form State
    type InvoiceConfigType = {
        companyName: string, vatNumber: string, email: string, address: string,
        sellerCompanyName: string, sellerEmail: string, sellerAddress: string
    }
    const [invoiceConfig, setInvoiceConfig] = useState<InvoiceConfigType>({
        companyName: "",
        vatNumber: "",
        email: "",
        address: "",
        sellerCompanyName: "UnieAI.Inc",
        sellerEmail: "sales@unieai.com",
        sellerAddress: "UnieAI Agent Service"
    })
    const [isInvoiceDialogOpen, setIsInvoiceDialogOpen] = useState(false)
    const [savedProfiles, setSavedProfiles] = useState<InvoiceConfigType[]>([])

    // Load saved profiles on mount
    useEffect(() => {
        try {
            const saved = localStorage.getItem("invoiceProfiles")
            if (saved) setSavedProfiles(JSON.parse(saved))
        } catch (e) { console.error("Could not load invoice profiles", e) }
    }, [])

    const saveCurrentProfile = () => {
        if (!invoiceConfig.companyName) return
        const newProfiles = [...savedProfiles.filter(p => p.companyName !== invoiceConfig.companyName), invoiceConfig]
        setSavedProfiles(newProfiles)
        localStorage.setItem("invoiceProfiles", JSON.stringify(newProfiles))
    }

    const deleteProfile = (companyName: string) => {
        const newProfiles = savedProfiles.filter(p => p.companyName !== companyName)
        setSavedProfiles(newProfiles)
        localStorage.setItem("invoiceProfiles", JSON.stringify(newProfiles))
    }

    const load = useMemo(() => async () => {
        setLoading(true)
        try {
            const params = new URLSearchParams({ start: rangeStart, end: rangeEnd })
            const [usageRes, detailRes] = await Promise.all([
                fetch(`/api/admin/usage?${params}`),
                fetch(`/api/admin/usage/details?${params}`)
            ])

            if (usageRes.ok) {
                const data = await usageRes.json()
                setTimeseries(data.timeseries || [])
                setPerGroup(data.perGroup || [])
                setTotals(data.totals || { totalTokens: 0, personalTokens: 0, groupTokens: 0 })
            }
            if (detailRes.ok) {
                const detailData = await detailRes.json()
                setDetails(detailData.items || [])
            }
        } catch (e) {
            console.error("Failed to fetch data", e)
        } finally {
            setLoading(false)
        }
    }, [rangeStart, rangeEnd])

    useEffect(() => { load() }, [load])

    // --- Helpers ---
    const filteredDetails = useMemo(() => {
        if (!detailSearch) return details
        const lower = detailSearch.toLowerCase()
        return details.filter(d =>
            d.user.name?.toLowerCase().includes(lower) ||
            d.user.email?.toLowerCase().includes(lower) ||
            d.model?.toLowerCase().includes(lower)
        )
    }, [details, detailSearch])

    const currentGroups = perGroup.slice((groupPage - 1) * pageSize, groupPage * pageSize)
    const currentDetails = filteredDetails.slice((detailPage - 1) * pageSize, detailPage * pageSize)
    const totalDetailPages = Math.ceil(filteredDetails.length / pageSize) || 1

    const handleExportInvoice = () => {
        // 模擬匯出帳單功能
        window.print()
    }

    return (
        <div className="max-w-4xl mx-auto p-6 space-y-8 animate-in fade-in duration-700">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div className="space-y-1">
                    <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
                        資源用量
                    </h1>
                    <p className="text-muted-foreground text-sm flex items-center gap-2">
                        <Calendar className="h-3.5 w-3.5" />
                        {rangeStart} — {rangeEnd} 的代幣消耗明細
                    </p>
                </div>

                <div className="flex items-center gap-2 p-1 bg-muted/30 backdrop-blur-md border border-border/50 rounded-xl shadow-inner">
                    <input
                        type="date"
                        value={rangeStart}
                        onChange={e => setRangeStart(e.target.value)}
                        className="bg-transparent text-xs px-2 py-1.5 focus:outline-none"
                    />
                    <span className="text-muted-foreground">→</span>
                    <input
                        type="date"
                        value={rangeEnd}
                        onChange={e => setRangeEnd(e.target.value)}
                        className="bg-transparent text-xs px-2 py-1.5 focus:outline-none"
                    />
                    <button
                        onClick={load}
                        disabled={loading}
                        className="bg-foreground text-background px-4 py-1.5 rounded-lg text-xs font-medium hover:opacity-90 transition-all disabled:opacity-50"
                    >
                        {loading ? "更新中..." : "套用"}
                    </button>
                </div>
            </div>

            {/* Stat Cards - Glassmorphism Style */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <StatCard
                    label="總消耗 Tokens"
                    value={totals.totalTokens}
                    icon={<TrendingUp className="h-4 w-4 text-blue-500" />}
                    trend="所有模型與群組總計"
                />
                <StatCard
                    label="個人消耗"
                    value={totals.personalTokens}
                    icon={<User className="h-4 w-4 text-purple-500" />}
                    percentage={totals.totalTokens ? (totals.personalTokens / totals.totalTokens) * 100 : 0}
                />
                <StatCard
                    label="群組消耗"
                    value={totals.groupTokens}
                    icon={<Users className="h-4 w-4 text-emerald-500" />}
                    percentage={totals.totalTokens ? (totals.groupTokens / totals.totalTokens) * 100 : 0}
                />
            </div>

            <Tabs defaultValue="overview" className="w-full">
                <div className="flex items-center justify-between mb-4 border-b border-border/50">
                    <TabsList className="bg-transparent h-12 w-full justify-start gap-6 rounded-none p-0">
                        <TabsTrigger value="overview" className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none shadow-none px-1 h-full">概覽圖表</TabsTrigger>
                        <TabsTrigger value="groups" className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none shadow-none px-1 h-full">群組分佈</TabsTrigger>
                        <TabsTrigger value="details" className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none shadow-none px-1 h-full">原始明細</TabsTrigger>
                    </TabsList>

                    <Dialog open={isInvoiceDialogOpen} onOpenChange={setIsInvoiceDialogOpen}>
                        <DialogTrigger asChild>
                            <button className="flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors mb-2">
                                <Download className="h-3.5 w-3.5" /> 匯出帳單 (PDF)
                            </button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[500px] print:hidden">
                            <DialogHeader>
                                <DialogTitle>設定帳單與買方資訊</DialogTitle>
                                <DialogDescription>
                                    您可以填寫單次使用的資訊，或從常用名單中選擇並儲存。
                                </DialogDescription>
                            </DialogHeader>

                            {/* Saved Profiles Section */}
                            {savedProfiles.length > 0 && (
                                <div className="mb-2 p-3 bg-muted/40 rounded-lg border border-border/50">
                                    <Label className="text-xs font-semibold text-muted-foreground mb-2 block uppercase tracking-wider">常用公司名單</Label>
                                    <div className="flex flex-wrap gap-2">
                                        {savedProfiles.map(p => (
                                            <div key={p.companyName} className="flex items-center gap-1 bg-background border border-border rounded-md pl-2 pr-1 py-1 text-sm shadow-sm group">
                                                <button
                                                    onClick={() => setInvoiceConfig(p)}
                                                    className="font-medium hover:text-primary transition-colors text-left"
                                                >
                                                    {p.companyName}
                                                </button>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); deleteProfile(p.companyName) }}
                                                    className="p-1 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                                                    title="刪除常用名單"
                                                >
                                                    <Trash2 className="h-3 w-3" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="grid gap-4 py-2 max-h-[60vh] overflow-y-auto px-1">
                                <h4 className="text-sm font-semibold border-b pb-1 mt-2">買方資訊 (Billed To)</h4>
                                <div className="grid grid-cols-4 items-center gap-4">
                                    <Label htmlFor="companyName" className="text-right">公司名稱</Label>
                                    <Input
                                        id="companyName"
                                        placeholder="例如：王小明股份有限公司"
                                        value={invoiceConfig.companyName}
                                        onChange={(e) => setInvoiceConfig({ ...invoiceConfig, companyName: e.target.value })}
                                        className="col-span-3"
                                    />
                                </div>
                                <div className="grid grid-cols-4 items-center gap-4">
                                    <Label htmlFor="vatNumber" className="text-right">統一編號</Label>
                                    <Input
                                        id="vatNumber"
                                        placeholder="例如：12345678"
                                        value={invoiceConfig.vatNumber}
                                        onChange={(e) => setInvoiceConfig({ ...invoiceConfig, vatNumber: e.target.value })}
                                        className="col-span-3"
                                    />
                                </div>
                                <div className="grid grid-cols-4 items-center gap-4">
                                    <Label htmlFor="email" className="text-right">聯絡 Email</Label>
                                    <Input
                                        id="email"
                                        type="email"
                                        placeholder="例如：billing@example.com"
                                        value={invoiceConfig.email}
                                        onChange={(e) => setInvoiceConfig({ ...invoiceConfig, email: e.target.value })}
                                        className="col-span-3"
                                    />
                                </div>
                                <div className="grid grid-cols-4 items-center gap-4">
                                    <Label htmlFor="address" className="text-right">收件地址</Label>
                                    <Input
                                        id="address"
                                        placeholder="例如：台北市信義區信義路五段7號"
                                        value={invoiceConfig.address}
                                        onChange={(e) => setInvoiceConfig({ ...invoiceConfig, address: e.target.value })}
                                        className="col-span-3"
                                    />
                                </div>

                                <h4 className="text-sm font-semibold border-b pb-1 mt-4">開立方資訊 (Issued By)</h4>
                                <div className="grid grid-cols-4 items-center gap-4">
                                    <Label htmlFor="sellerCompanyName" className="text-right">公司 / 單位名稱</Label>
                                    <Input
                                        id="sellerCompanyName"
                                        value={invoiceConfig.sellerCompanyName}
                                        onChange={(e) => setInvoiceConfig({ ...invoiceConfig, sellerCompanyName: e.target.value })}
                                        className="col-span-3"
                                    />
                                </div>
                                <div className="grid grid-cols-4 items-center gap-4">
                                    <Label htmlFor="sellerEmail" className="text-right">聯絡 Email</Label>
                                    <Input
                                        id="sellerEmail"
                                        value={invoiceConfig.sellerEmail}
                                        onChange={(e) => setInvoiceConfig({ ...invoiceConfig, sellerEmail: e.target.value })}
                                        className="col-span-3"
                                    />
                                </div>
                                <div className="grid grid-cols-4 items-center gap-4">
                                    <Label htmlFor="sellerAddress" className="text-right">服務名稱 / 地址</Label>
                                    <Input
                                        id="sellerAddress"
                                        value={invoiceConfig.sellerAddress}
                                        onChange={(e) => setInvoiceConfig({ ...invoiceConfig, sellerAddress: e.target.value })}
                                        className="col-span-3"
                                    />
                                </div>
                            </div>
                            <DialogFooter className="flex flex-col sm:flex-row sm:justify-between items-center w-full gap-2 mt-2">
                                <button
                                    onClick={saveCurrentProfile}
                                    disabled={!invoiceConfig.companyName}
                                    className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1.5 transition-colors disabled:opacity-50"
                                >
                                    <Save className="h-3.5 w-3.5" />
                                    儲存為常用名單
                                </button>
                                <button
                                    onClick={() => {
                                        setIsInvoiceDialogOpen(false)
                                        setTimeout(() => window.print(), 300) // 增加 delay 確保 Dialog 關閉動畫完成
                                    }}
                                    className="bg-primary text-primary-foreground hover:opacity-90 active:scale-95 transition-all text-sm px-4 py-2 rounded-md flex items-center justify-center gap-2 w-full sm:w-auto"
                                >
                                    <Printer className="h-4 w-4" />
                                    <span>列印 / 匯出 PDF</span>
                                </button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>

                {/* Overview Chart */}
                <TabsContent value="overview" className="mt-6">
                    <div className="relative group p-[1px] rounded-2xl bg-gradient-to-b from-border/50 to-transparent">
                        <div className="bg-background/60 backdrop-blur-xl p-6 rounded-[15px] border border-border/50 shadow-sm">
                            <div className="h-[300px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={timeseries}>
                                        <defs>
                                            <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.1} />
                                                <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="rgba(120,120,120,0.1)" />
                                        <XAxis
                                            dataKey="date"
                                            axisLine={false}
                                            tickLine={false}
                                            tick={{ fontSize: 11, fill: 'gray' }}
                                            tickFormatter={(v) => v.slice(5)}
                                        />
                                        <Tooltip
                                            contentStyle={{ backgroundColor: 'rgba(0,0,0,0.8)', border: 'none', borderRadius: '8px', color: 'white' }}
                                            itemStyle={{ fontSize: '12px' }}
                                        />
                                        <Area
                                            type="monotone"
                                            dataKey="totalTokens"
                                            stroke="hsl(var(--primary))"
                                            fillOpacity={1}
                                            fill="url(#colorTotal)"
                                            strokeWidth={2}
                                        />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>
                </TabsContent>

                {/* Groups List */}
                <TabsContent value="groups">
                    <div className="rounded-2xl border border-border/50 bg-background/50 backdrop-blur-sm overflow-hidden shadow-sm">
                        <Table>
                            <TableHeader className="bg-muted/30">
                                <TableRow>
                                    <TableHead className="w-[300px]">群組名稱</TableHead>
                                    <TableHead>使用佔比</TableHead>
                                    <TableHead className="text-right">消耗 Tokens</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {perGroup.map((g) => {
                                    const percent = totals.groupTokens ? (g.totalTokens / totals.groupTokens) * 100 : 0
                                    return (
                                        <TableRow key={g.groupId || 'none'} className="hover:bg-muted/20 transition-colors">
                                            <TableCell>
                                                <div className="flex flex-col">
                                                    <span className="font-medium text-sm">{g.groupName}</span>
                                                    <span className="text-[10px] text-muted-foreground font-mono uppercase">{g.groupId || '無 ID'}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-3 w-full">
                                                    <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                                                        <div
                                                            className="h-full bg-primary transition-all duration-1000"
                                                            style={{ width: `${percent}%` }}
                                                        />
                                                    </div>
                                                    <span className="text-xs text-muted-foreground w-8">{percent.toFixed(1)}%</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right font-mono text-sm">
                                                {g.totalTokens.toLocaleString()}
                                            </TableCell>
                                        </TableRow>
                                    )
                                })}
                            </TableBody>
                        </Table>
                    </div>
                </TabsContent>

                {/* Details List */}
                <TabsContent value="details" className="space-y-4">
                    <div className="flex items-center gap-2">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="搜尋用戶或模型名稱..."
                                className="pl-10 h-10 bg-muted/20 border-border/50 rounded-xl"
                                value={detailSearch}
                                onChange={(e) => setDetailSearch(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="rounded-2xl border border-border/50 bg-background/50 overflow-hidden shadow-sm">
                        <Table>
                            <TableHeader className="bg-muted/30">
                                <TableRow>
                                    <TableHead className="text-xs uppercase tracking-wider">時間</TableHead>
                                    <TableHead className="text-xs uppercase tracking-wider">用戶</TableHead>
                                    <TableHead className="text-xs uppercase tracking-wider">模型</TableHead>
                                    <TableHead className="text-xs uppercase tracking-wider text-right">Tokens</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {currentDetails.map((d) => (
                                    <TableRow key={d.id} className="text-sm border-b border-border/40">
                                        <TableCell className="text-muted-foreground whitespace-nowrap">
                                            {new Date(d.createdAt).toLocaleDateString()}
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <span className="font-medium">{d.user.name || "Unknown"}</span>
                                                <span className="text-[10px] text-muted-foreground">{d.user.email}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <code className="text-[11px] bg-muted px-1.5 py-0.5 rounded">{d.model}</code>
                                        </TableCell>
                                        <TableCell className="text-right font-mono">
                                            {d.totalTokens.toLocaleString()}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>

                        <div className="p-4 border-t border-border/50 flex items-center justify-between bg-muted/10">
                            <span className="text-xs text-muted-foreground">共 {filteredDetails.length} 筆</span>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setDetailPage(p => Math.max(1, p - 1))}
                                    className="p-1.5 rounded-lg border border-border hover:bg-background transition-colors disabled:opacity-30"
                                    disabled={detailPage === 1}
                                >
                                    <ChevronLeft className="h-4 w-4" />
                                </button>
                                <span className="text-xs font-medium">{detailPage} / {totalDetailPages}</span>
                                <button
                                    onClick={() => setDetailPage(p => Math.min(totalDetailPages, p + 1))}
                                    className="p-1.5 rounded-lg border border-border hover:bg-background transition-colors disabled:opacity-30"
                                    disabled={detailPage === totalDetailPages}
                                >
                                    <ChevronRight className="h-4 w-4" />
                                </button>
                            </div>
                        </div>
                    </div>
                </TabsContent>
            </Tabs>

            {/* Hidden Print Section (Invoice Template) */}
            <div className="hidden print:block fixed inset-0 bg-white text-black p-12 overflow-visible">
                {/* Header */}
                <div className="flex justify-between items-start border-b-2 border-slate-800 pb-8 mb-8">
                    <div>
                        <h1 className="text-5xl font-extrabold tracking-tight text-slate-900">INVOICE</h1>
                        <p className="mt-2 text-slate-500 font-medium">Date: <span className="text-slate-800">{new Date().toLocaleDateString()}</span></p>
                        <p className="text-slate-500 font-medium">Period: <span className="text-slate-800">{rangeStart} to {rangeEnd}</span></p>
                    </div>
                </div>

                {/* Billing Info */}
                <div className="flex justify-between mb-12">
                    <div className="w-1/2 pr-8">
                        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-3 border-b pb-2">Billed To</h3>
                        <div className="space-y-1 text-slate-800">
                            {invoiceConfig.companyName ? (
                                <p className="font-bold text-lg text-black">{invoiceConfig.companyName}</p>
                            ) : (
                                <p className="italic text-slate-400">---</p>
                            )}
                            {invoiceConfig.vatNumber && <p>VAT: {invoiceConfig.vatNumber}</p>}
                            {invoiceConfig.email && <p>{invoiceConfig.email}</p>}
                            {invoiceConfig.address && <p>{invoiceConfig.address}</p>}
                        </div>
                    </div>
                    <div className="w-1/2 pl-8 border-l">
                        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-3 border-b pb-2">Issued By</h3>
                        <div className="space-y-1 text-slate-800">
                            <p className="font-bold text-lg text-black">{invoiceConfig.sellerCompanyName}</p>
                            {invoiceConfig.sellerEmail && <p>{invoiceConfig.sellerEmail}</p>}
                            {invoiceConfig.sellerAddress && <p>{invoiceConfig.sellerAddress}</p>}
                        </div>
                    </div>
                </div>

                {/* Usage Detail Table */}
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">Token Usage Breakdown</h3>
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-slate-100/80 border-y border-slate-300">
                            <th className="py-4 px-4 font-bold text-slate-800">Group / Category</th>
                            <th className="py-4 px-4 font-bold text-slate-800 text-right">Tokens Consumed</th>
                        </tr>
                    </thead>
                    <tbody>
                        {perGroup.map((g, i) => (
                            <tr key={g.groupId || i} className="border-b border-slate-200">
                                <td className="py-4 px-4 text-slate-700">
                                    <p className="font-semibold">{g.groupName}</p>
                                    <p className="text-xs text-slate-400">{g.groupId || "Personal Usage"}</p>
                                </td>
                                <td className="py-4 px-4 text-right font-mono text-slate-800">{g.totalTokens.toLocaleString()}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                {/* Totals */}
                <div className="mt-8 flex justify-end">
                    <div className="w-1/2">
                        <div className="flex justify-between py-3 border-b border-slate-200 text-slate-600">
                            <span>Subtotal (Tokens)</span>
                            <span className="font-mono">{totals.totalTokens.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between py-4 text-xl font-bold border-b-2 border-slate-800">
                            <span>Total Usage</span>
                            <span className="font-mono">{totals.totalTokens.toLocaleString()}</span>
                        </div>
                    </div>
                </div>

                {/* Footer Notes */}
                <div className="mt-16 text-center text-sm text-slate-400 border-t pt-8">
                    <p>Thank you for using UnieAI UnieAI Agent Services.</p>
                    <p>This is a system-generated invoice regarding your usage statistics.</p>
                </div>
            </div>
        </div>
    )
}

function StatCard({ label, value, icon, trend, percentage }: {
    label: string,
    value: number,
    icon: React.ReactNode,
    trend?: string,
    percentage?: number
}) {
    return (
        <div className="relative group overflow-hidden p-[1px] rounded-2xl bg-gradient-to-b from-border to-transparent hover:from-primary/50 transition-all duration-500">
            <div className="bg-background/80 backdrop-blur-xl p-5 rounded-[15px] h-full flex flex-col justify-between">
                <div className="flex justify-between items-start">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
                    <div className="p-2 bg-muted/50 rounded-lg">{icon}</div>
                </div>
                <div className="mt-4">
                    <p className="text-3xl font-bold tracking-tight">{value?.toLocaleString()}</p>
                    {percentage !== undefined ? (
                        <div className="mt-3 space-y-1.5">
                            <div className="flex justify-between text-[10px] font-medium uppercase text-muted-foreground">
                                <span>佔比</span>
                                <span>{percentage.toFixed(1)}%</span>
                            </div>
                            <div className="h-1 w-full bg-muted rounded-full">
                                <div className="h-full bg-foreground rounded-full" style={{ width: `${percentage}%` }} />
                            </div>
                        </div>
                    ) : (
                        <p className="text-[11px] text-muted-foreground mt-1">{trend}</p>
                    )}
                </div>
            </div>
        </div>
    )
}