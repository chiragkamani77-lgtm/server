import { useState, useEffect } from 'react'
import { useAuth } from '@/context/AuthContext'
import { attendanceApi, sitesApi, usersApi } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { useToast } from '@/hooks/use-toast'
import { useBulkSelect } from '@/hooks/use-bulk-select'
import { formatDate, formatCurrency } from '@/lib/utils'
import {
  PageLayout, PageHeader, SummaryBanner, SearchFilterBar,
  ListItem, ActionBtn, PagePagination, EmptyState,
} from '@/components/page'
import { Plus, Users, Calendar, Clock, Trash2, Edit, Download, Upload, FileSpreadsheet } from 'lucide-react'

const STATUS_COLORS = {
  present: 'bg-green-100 text-green-800',
  absent: 'bg-red-100 text-red-800',
  half_day: 'bg-yellow-100 text-yellow-800',
  leave: 'bg-blue-100 text-blue-800',
}

const STATUS_AVATAR_COLORS = {
  present: 'green',
  absent: 'slate',
  half_day: 'amber',
  leave: 'blue',
}

export default function Attendance() {
  const { user } = useAuth()
  const { toast } = useToast()

  const [records, setRecords] = useState([])
  const [sites, setSites] = useState([])
  const [workers, setWorkers] = useState([])
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 })
  const [editingId, setEditingId] = useState(null)
  const [deleteId, setDeleteId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [isBulkOpen, setIsBulkOpen] = useState(false)
  const [isExportOpen, setIsExportOpen] = useState(false)
  const [isImportOpen, setIsImportOpen] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importFile, setImportFile] = useState(null)
  const [importResult, setImportResult] = useState(null)

  const [filters, setFilters] = useState({ siteId: '', workerId: '', status: '', date: '' })

  const bulkSelect = useBulkSelect(
    records,
    attendanceApi.bulkDelete,
    (count) => { toast({ title: `${count} record(s) deleted` }); fetchRecords() },
    (error) => { toast({ title: 'Error', description: error.response?.data?.message || 'Failed to delete', variant: 'destructive' }) }
  )

  const [form, setForm] = useState({
    workerId: '',
    siteId: '',
    date: new Date().toISOString().split('T')[0],
    status: 'present',
    hoursWorked: '8',
    overtime: '0',
    notes: '',
  })

  const [bulkForm, setBulkForm] = useState({
    siteId: '',
    date: new Date().toISOString().split('T')[0],
    records: [],
  })

  const currentDate = new Date()
  const [exportForm, setExportForm] = useState({
    year: currentDate.getFullYear(),
    month: currentDate.getMonth() + 1,
    siteId: '',
  })
  const [importForm, setImportForm] = useState({
    year: currentDate.getFullYear(),
    month: currentDate.getMonth() + 1,
    siteId: '',
  })

  const selectedWorker = workers.find(w => w._id === form.workerId)
  const dailyRate = selectedWorker?.dailyRate || 0
  const hourlyRate = dailyRate / 8
  const baseEarnings = form.status === 'present' ? dailyRate : form.status === 'half_day' ? dailyRate / 2 : 0
  const overtimeEarnings = parseFloat(form.overtime || 0) * hourlyRate
  const totalEarnings = baseEarnings + overtimeEarnings

  useEffect(() => { if (user?._id) fetchInitialData() }, [user?._id])
  useEffect(() => { if (user?._id) fetchRecords() }, [pagination.page, filters, user?._id])

  const fetchInitialData = async () => {
    try {
      const [sitesRes, workersRes] = await Promise.all([sitesApi.getAll(), usersApi.getChildren()])
      setSites(sitesRes.data || [])
      setWorkers(workersRes.data || [])
    } catch (e) { console.error(e) }
  }

  const fetchRecords = async () => {
    setLoading(true)
    try {
      const params = {
        page: pagination.page,
        limit: 50,
        ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)),
      }
      const { data } = await attendanceApi.getAll(params)
      setRecords(data?.attendance || [])
      setPagination(data?.pagination || { page: 1, pages: 1, total: 0 })
    } catch (error) {
      toast({ title: 'Error', description: error.response?.data?.message || 'Failed to fetch records', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      const attendanceData = {
        workerId: form.workerId,
        siteId: form.siteId || null,
        date: form.date,
        status: form.status,
        hoursWorked: form.status === 'present' ? parseFloat(form.hoursWorked) : form.status === 'half_day' ? 4 : 0,
        overtime: parseFloat(form.overtime) || 0,
        notes: form.notes,
      }
      if (editingId) {
        const res = await attendanceApi.update(editingId, attendanceData)
        let desc = `Updated for ${selectedWorker?.name || 'Worker'}`
        if (res.data?.pendingSalary) desc += `. Today: ${formatCurrency(totalEarnings)}. Pending: ${formatCurrency(res.data.pendingSalary.totalPending || 0)}`
        toast({ title: 'Attendance updated', description: desc })
      } else {
        const res = await attendanceApi.create(attendanceData)
        let desc = `Recorded for ${selectedWorker?.name || 'Worker'}`
        if (res.data?.pendingSalary) desc += `. Today: ${formatCurrency(totalEarnings)}. Pending: ${formatCurrency(res.data.pendingSalary.totalPending || 0)}`
        toast({ title: 'Attendance recorded', description: desc })
      }
      setSheetOpen(false)
      resetForm()
      fetchRecords()
    } catch (error) {
      toast({ title: 'Error', description: error.response?.data?.message || 'Failed to save', variant: 'destructive' })
    }
  }

  const handleEdit = (record) => {
    setForm({
      workerId: record.worker?._id || '',
      siteId: record.site?._id || '',
      date: record.date.split('T')[0],
      status: record.status,
      hoursWorked: record.hoursWorked?.toString() || '8',
      overtime: record.overtime?.toString() || '0',
      notes: record.notes || '',
    })
    setEditingId(record._id)
    setSheetOpen(true)
  }

  const handleBulkSubmit = async (e) => {
    e.preventDefault()
    try {
      const attendanceList = bulkForm.records
        .filter(r => r.status)
        .map(r => ({
          workerId: r.workerId,
          status: r.status,
          hoursWorked: r.status === 'present' ? parseFloat(r.hoursWorked || 8) : r.status === 'half_day' ? 4 : 0,
          overtime: parseFloat(r.overtime || 0),
        }))
      if (attendanceList.length === 0) {
        toast({ title: 'Please mark at least one worker', variant: 'destructive' })
        return
      }
      const res = await attendanceApi.bulkCreate({ siteId: bulkForm.siteId || null, date: bulkForm.date, attendanceList })
      let desc = `Recorded for ${attendanceList.length} workers`
      if (res.data?.summary) desc += `. Total pending salary: ${formatCurrency(res.data.summary.totalPendingSalary || 0)}`
      toast({ title: 'Bulk attendance recorded', description: desc })
      setIsBulkOpen(false)
      resetBulkForm()
      fetchRecords()
    } catch (error) {
      toast({ title: 'Error', description: error.response?.data?.message || 'Failed to record', variant: 'destructive' })
    }
  }

  const handleDelete = async () => {
    try {
      await attendanceApi.delete(deleteId)
      toast({ title: 'Record deleted' })
      setDeleteId(null)
      fetchRecords()
    } catch (error) {
      toast({ title: 'Error', description: error.response?.data?.message || 'Failed to delete', variant: 'destructive' })
    }
  }

  const resetForm = () => {
    setForm({ workerId: '', siteId: '', date: new Date().toISOString().split('T')[0], status: 'present', hoursWorked: '8', overtime: '0', notes: '' })
    setEditingId(null)
  }
  const resetBulkForm = () => {
    setBulkForm({ siteId: '', date: new Date().toISOString().split('T')[0], records: [] })
  }

  const initBulkRecords = () => {
    setBulkForm({
      ...bulkForm,
      records: workers.map(w => ({ workerId: w._id, workerName: w.name, dailyRate: w.dailyRate || 0, status: '', hoursWorked: '8', overtime: '0' })),
    })
    setIsBulkOpen(true)
  }

  const updateBulkRecord = (index, field, value) => {
    const newRecords = [...bulkForm.records]
    newRecords[index] = { ...newRecords[index], [field]: value }
    setBulkForm({ ...bulkForm, records: newRecords })
  }

  const handleExport = async () => {
    if (!exportForm.siteId) { toast({ title: 'Please select a site', variant: 'destructive' }); return }
    try {
      setExporting(true)
      const response = await attendanceApi.exportTemplate({ year: exportForm.year, month: exportForm.month, siteId: exportForm.siteId })
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      const site = sites.find(s => s._id === exportForm.siteId)
      link.setAttribute('download', `attendance-${exportForm.year}-${String(exportForm.month).padStart(2, '0')}-${(site?.name || 'export').replace(/\s+/g, '-')}.csv`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
      toast({ title: 'Exported successfully' })
      setIsExportOpen(false)
    } catch (error) {
      toast({ title: 'Export failed', description: error.response?.data?.message || 'Failed', variant: 'destructive' })
    } finally {
      setExporting(false)
    }
  }

  const handleImport = async () => {
    if (!importForm.siteId) { toast({ title: 'Please select a site', variant: 'destructive' }); return }
    if (!importFile) { toast({ title: 'Please select a file', variant: 'destructive' }); return }
    try {
      setImporting(true)
      setImportResult(null)
      const reader = new FileReader()
      reader.onload = async (e) => {
        try {
          const response = await attendanceApi.importSheet({ csvData: e.target.result, year: importForm.year, month: importForm.month, siteId: importForm.siteId })
          setImportResult(response.data.results)
          toast({ title: 'Import completed', description: response.data.message })
          fetchRecords()
        } catch (err) {
          toast({ title: 'Import failed', description: err.response?.data?.message || 'Failed', variant: 'destructive' })
        } finally {
          setImporting(false)
        }
      }
      reader.readAsText(importFile)
    } catch { setImporting(false) }
  }

  const presentToday = records.filter(r => new Date(r.date).toDateString() === new Date().toDateString() && r.status === 'present').length

  return (
    <PageLayout>
      <PageHeader title="Attendance" subtitle={`${pagination.total} records`}>
        {bulkSelect.selectedCount > 0 && (
          <Button size="sm" variant="destructive" onClick={bulkSelect.deleteSelected} disabled={bulkSelect.deleting}>
            <Trash2 className="h-4 w-4 mr-1" />
            Delete {bulkSelect.selectedCount}
          </Button>
        )}
        {workers.length > 0 && (
          <Button size="sm" variant="outline" onClick={initBulkRecords}>
            <Users className="h-4 w-4 mr-1" />
            Bulk Entry
          </Button>
        )}
        <Button size="sm" variant="outline" onClick={() => setIsExportOpen(true)}>
          <Download className="h-4 w-4 mr-1" />
          Export
        </Button>
        <Button size="sm" variant="outline" onClick={() => setIsImportOpen(true)}>
          <Upload className="h-4 w-4 mr-1" />
          Import
        </Button>
        <Button size="sm" onClick={() => { resetForm(); setSheetOpen(true) }} className="bg-green-600 hover:bg-green-700 text-white">
          <Plus className="h-4 w-4 mr-1" />
          Mark
        </Button>
      </PageHeader>

      <SummaryBanner
        color="green"
        icon={<Calendar className="h-8 w-8" />}
        items={[
          { label: 'Total Records', value: String(pagination.total) },
          { label: 'Present Today', value: String(presentToday) },
          { label: 'Workers', value: String(workers.length) },
        ]}
      />

      <SearchFilterBar>
        <Select value={filters.siteId || 'all'} onValueChange={(v) => { setFilters(f => ({ ...f, siteId: v === 'all' ? '' : v })); setPagination(p => ({ ...p, page: 1 })) }}>
          <SelectTrigger className="h-9 w-32 text-sm"><SelectValue placeholder="All Sites" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sites</SelectItem>
            {sites.map(s => <SelectItem key={s._id} value={s._id}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filters.workerId || 'all'} onValueChange={(v) => { setFilters(f => ({ ...f, workerId: v === 'all' ? '' : v })); setPagination(p => ({ ...p, page: 1 })) }}>
          <SelectTrigger className="h-9 w-32 text-sm"><SelectValue placeholder="All Workers" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Workers</SelectItem>
            {workers.map(w => <SelectItem key={w._id} value={w._id}>{w.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filters.status || 'all'} onValueChange={(v) => { setFilters(f => ({ ...f, status: v === 'all' ? '' : v })); setPagination(p => ({ ...p, page: 1 })) }}>
          <SelectTrigger className="h-9 w-28 text-sm"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="present">✅ Present</SelectItem>
            <SelectItem value="absent">❌ Absent</SelectItem>
            <SelectItem value="half_day">🌗 Half Day</SelectItem>
            <SelectItem value="leave">🏖️ Leave</SelectItem>
          </SelectContent>
        </Select>
        <Input type="date" className="h-9 text-sm w-36" value={filters.date}
          onChange={(e) => { setFilters(f => ({ ...f, date: e.target.value })); setPagination(p => ({ ...p, page: 1 })) }} />
        {(filters.siteId || filters.workerId || filters.status || filters.date) && (
          <Button variant="ghost" size="sm" onClick={() => setFilters({ siteId: '', workerId: '', status: '', date: '' })}>Clear</Button>
        )}
      </SearchFilterBar>

      <div className="flex-1">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600" />
          </div>
        ) : records.length === 0 ? (
          <EmptyState
            message="No attendance records found"
            icon={<Calendar className="h-12 w-12" />}
            action={
              <Button variant="outline" size="sm" onClick={() => { resetForm(); setSheetOpen(true) }}>
                <Plus className="h-4 w-4 mr-1" /> Mark First Attendance
              </Button>
            }
          />
        ) : (
          <div className="divide-y divide-gray-100">
            {records.map((record) => (
              <ListItem
                key={record._id}
                avatar={record.worker?.name || 'W'}
                avatarColor={STATUS_AVATAR_COLORS[record.status] || 'slate'}
                title={record.worker?.name || 'Unknown Worker'}
                subtitle={
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs text-gray-400">{formatDate(record.date)}</span>
                    {record.site?.name && <span className="text-xs text-gray-400">• {record.site.name}</span>}
                    {record.hoursWorked > 0 && (
                      <span className="text-xs text-gray-400">
                        • <Clock className="h-3 w-3 inline" /> {record.hoursWorked}h
                        {record.overtime > 0 && <span className="text-orange-500"> +{record.overtime}h OT</span>}
                      </span>
                    )}
                    {record.worker?.dailyRate > 0 && <span className="text-xs text-green-600">• ₹{record.worker.dailyRate}/day</span>}
                    {record.notes && <span className="text-xs text-gray-400">• {record.notes}</span>}
                  </div>
                }
                badge={{ label: record.status.replace('_', ' '), className: STATUS_COLORS[record.status] || '' }}
                selected={bulkSelect.isSelected(record._id)}
                onSelect={() => bulkSelect.toggleSelect(record._id)}
                actions={
                  <>
                    <ActionBtn onClick={() => handleEdit(record)} title="Edit" icon={Edit} />
                    <ActionBtn
                      onClick={() => setDeleteId(record._id)}
                      title="Delete"
                      icon={Trash2}
                      hoverClass="hover:text-red-600 hover:bg-red-50"
                    />
                  </>
                }
              />
            ))}
          </div>
        )}
      </div>

      <PagePagination
        page={pagination.page}
        pages={pagination.pages}
        total={pagination.total}
        onChange={(page) => setPagination(p => ({ ...p, page }))}
      />

      {/* Add / Edit Sheet */}
      <Sheet open={sheetOpen} onOpenChange={(open) => { setSheetOpen(open); if (!open) resetForm() }}>
        <SheetContent title={editingId ? 'Edit Attendance' : 'Mark Attendance'}>
          <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
            <div className="space-y-1">
              <Label>Worker *</Label>
              <Select value={form.workerId} onValueChange={(v) => setForm({ ...form, workerId: v })} required>
                <SelectTrigger><SelectValue placeholder="Select worker" /></SelectTrigger>
                <SelectContent>
                  {workers.map(w => (
                    <SelectItem key={w._id} value={w._id}>
                      {w.name}{w.dailyRate > 0 ? ` (₹${w.dailyRate}/day)` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedWorker && dailyRate > 0 && (
              <div className="bg-blue-50 p-3 rounded-lg grid grid-cols-2 gap-2 text-sm">
                <div><p className="text-xs text-gray-500">Daily Rate</p><p className="font-semibold">₹{dailyRate}</p></div>
                <div><p className="text-xs text-gray-500">Hourly Rate</p><p className="font-semibold">₹{hourlyRate.toFixed(0)}/hr</p></div>
              </div>
            )}

            <div className="space-y-1">
              <Label>Site (Optional)</Label>
              <Select value={form.siteId || 'none'} onValueChange={(v) => setForm({ ...form, siteId: v === 'none' ? '' : v })}>
                <SelectTrigger><SelectValue placeholder="Select site" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No specific site</SelectItem>
                  {sites.map(s => <SelectItem key={s._id} value={s._id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Date *</Label>
                <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
              </div>
              <div className="space-y-1">
                <Label>Status *</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="present">✅ Present</SelectItem>
                    <SelectItem value="absent">❌ Absent</SelectItem>
                    <SelectItem value="half_day">🌗 Half Day</SelectItem>
                    <SelectItem value="leave">🏖️ Leave</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {(form.status === 'present' || form.status === 'half_day') && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Hours Worked</Label>
                  <Input type="number"
                    value={form.status === 'half_day' ? '4' : form.hoursWorked}
                    onChange={(e) => setForm({ ...form, hoursWorked: e.target.value })}
                    min="0" max="24" step="0.5"
                    disabled={form.status === 'half_day'}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Overtime Hours</Label>
                  <Input type="number" value={form.overtime}
                    onChange={(e) => setForm({ ...form, overtime: e.target.value })}
                    min="0" max="16" step="0.5" placeholder="0" />
                </div>
              </div>
            )}

            {selectedWorker && dailyRate > 0 && (form.status === 'present' || form.status === 'half_day') && (
              <div className="bg-green-50 border border-green-200 p-3 rounded-lg">
                <p className="text-xs font-semibold text-green-800 mb-2">Earnings</p>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Base ({form.status === 'half_day' ? 'Half' : 'Full'} Day)</span>
                  <span>₹{baseEarnings.toFixed(0)}</span>
                </div>
                {parseFloat(form.overtime) > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Overtime</span>
                    <span>₹{overtimeEarnings.toFixed(0)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-bold border-t mt-1 pt-1">
                  <span>Total</span>
                  <span className="text-green-700">₹{totalEarnings.toFixed(0)}</span>
                </div>
              </div>
            )}

            <div className="space-y-1">
              <Label>Notes</Label>
              <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Optional notes..." />
            </div>

            <Button type="submit" className="w-full h-11 text-base bg-green-600 hover:bg-green-700">
              {editingId ? 'Update Attendance' : 'Mark Attendance'}
            </Button>
          </form>
        </SheetContent>
      </Sheet>

      {/* Bulk Entry Dialog */}
      <Dialog open={isBulkOpen} onOpenChange={setIsBulkOpen}>
        <DialogContent className="max-w-2xl">
          <form onSubmit={handleBulkSubmit}>
            <DialogHeader>
              <DialogTitle>Bulk Attendance Entry</DialogTitle>
              <DialogDescription>Mark attendance for all workers at once</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Date *</Label>
                  <Input type="date" value={bulkForm.date} onChange={(e) => setBulkForm({ ...bulkForm, date: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label>Site</Label>
                  <Select value={bulkForm.siteId || 'none'} onValueChange={(v) => setBulkForm({ ...bulkForm, siteId: v === 'none' ? '' : v })}>
                    <SelectTrigger><SelectValue placeholder="Select site" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No specific site</SelectItem>
                      {sites.map(s => <SelectItem key={s._id} value={s._id}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="border rounded-lg max-h-[300px] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Worker</TableHead>
                      <TableHead>Rate</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Hours</TableHead>
                      <TableHead>OT</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bulkForm.records.map((record, index) => (
                      <TableRow key={record.workerId}>
                        <TableCell className="font-medium">{record.workerName}</TableCell>
                        <TableCell>
                          {record.dailyRate > 0
                            ? <span className="text-green-600 text-sm">₹{record.dailyRate}</span>
                            : <span className="text-gray-400 text-xs">Not set</span>}
                        </TableCell>
                        <TableCell>
                          <Select value={record.status} onValueChange={(v) => updateBulkRecord(index, 'status', v)}>
                            <SelectTrigger className="w-[110px]"><SelectValue placeholder="Select" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="present">Present</SelectItem>
                              <SelectItem value="absent">Absent</SelectItem>
                              <SelectItem value="half_day">Half Day</SelectItem>
                              <SelectItem value="leave">Leave</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Input type="number" value={record.status === 'half_day' ? '4' : record.hoursWorked}
                            onChange={(e) => updateBulkRecord(index, 'hoursWorked', e.target.value)}
                            className="w-[65px]" min="0" max="24"
                            disabled={record.status !== 'present'} />
                        </TableCell>
                        <TableCell>
                          <Input type="number" value={record.overtime}
                            onChange={(e) => updateBulkRecord(index, 'overtime', e.target.value)}
                            className="w-[65px]" min="0" max="16" placeholder="0"
                            disabled={!record.status || record.status === 'absent' || record.status === 'leave'} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" type="button" onClick={() => setIsBulkOpen(false)}>Cancel</Button>
              <Button type="submit">Save Attendance</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Export Dialog */}
      <Dialog open={isExportOpen} onOpenChange={setIsExportOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><FileSpreadsheet className="h-5 w-5" /> Export Attendance Sheet</DialogTitle>
            <DialogDescription>Download a monthly attendance template (CSV format)</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Year</Label>
                <Input type="number" value={exportForm.year} onChange={(e) => setExportForm({ ...exportForm, year: parseInt(e.target.value) })} min="2020" max="2099" />
              </div>
              <div className="space-y-2">
                <Label>Month</Label>
                <Select value={exportForm.month.toString()} onValueChange={(v) => setExportForm({ ...exportForm, month: parseInt(v) })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 12 }, (_, i) => (
                      <SelectItem key={i + 1} value={(i + 1).toString()}>
                        {new Date(2000, i).toLocaleString('default', { month: 'long' })}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Site *</Label>
              <Select value={exportForm.siteId} onValueChange={(v) => setExportForm({ ...exportForm, siteId: v })}>
                <SelectTrigger><SelectValue placeholder="Select site" /></SelectTrigger>
                <SelectContent>
                  {sites.map(s => <SelectItem key={s._id} value={s._id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsExportOpen(false)}>Cancel</Button>
            <Button onClick={handleExport} disabled={exporting}>
              <Download className="h-4 w-4 mr-2" />{exporting ? 'Exporting...' : 'Export'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Dialog */}
      <Dialog open={isImportOpen} onOpenChange={(open) => { setIsImportOpen(open); if (!open) { setImportFile(null); setImportResult(null) } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Upload className="h-5 w-5" /> Import Attendance Sheet</DialogTitle>
            <DialogDescription>Upload a filled CSV attendance sheet</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Year</Label>
                <Input type="number" value={importForm.year} onChange={(e) => setImportForm({ ...importForm, year: parseInt(e.target.value) })} min="2020" max="2099" />
              </div>
              <div className="space-y-2">
                <Label>Month</Label>
                <Select value={importForm.month.toString()} onValueChange={(v) => setImportForm({ ...importForm, month: parseInt(v) })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 12 }, (_, i) => (
                      <SelectItem key={i + 1} value={(i + 1).toString()}>
                        {new Date(2000, i).toLocaleString('default', { month: 'long' })}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Site *</Label>
              <Select value={importForm.siteId} onValueChange={(v) => setImportForm({ ...importForm, siteId: v })}>
                <SelectTrigger><SelectValue placeholder="Select site" /></SelectTrigger>
                <SelectContent>
                  {sites.map(s => <SelectItem key={s._id} value={s._id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>CSV File *</Label>
              <Input type="file" accept=".csv" onChange={(e) => setImportFile(e.target.files?.[0] || null)} />
            </div>
            {importResult && (
              <div className="bg-green-50 p-3 rounded-lg border border-green-200 grid grid-cols-3 gap-2 text-center">
                <div><p className="text-xs text-gray-500">Created</p><p className="text-xl font-bold text-green-600">{importResult.created}</p></div>
                <div><p className="text-xs text-gray-500">Updated</p><p className="text-xl font-bold text-blue-600">{importResult.updated}</p></div>
                <div><p className="text-xs text-gray-500">Skipped</p><p className="text-xl font-bold text-gray-600">{importResult.skipped}</p></div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsImportOpen(false)}>Cancel</Button>
            <Button onClick={handleImport} disabled={importing || !importFile}>
              <Upload className="h-4 w-4 mr-2" />{importing ? 'Importing...' : 'Import'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this record?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently delete the attendance record. This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageLayout>
  )
}
