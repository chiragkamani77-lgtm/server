import { useState, useEffect } from 'react'
import { useAuth } from '@/context/AuthContext'
import { attendanceApi, sitesApi, usersApi } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
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
import { useToast } from '@/hooks/use-toast'
import { formatDate, formatCurrency } from '@/lib/utils'
import { Plus, Users, Calendar, Clock, CheckCircle, XCircle, Filter, ChevronLeft, ChevronRight, Trash2, Edit } from 'lucide-react'

const STATUS_COLORS = {
  present: 'bg-green-100 text-green-800',
  absent: 'bg-red-100 text-red-800',
  half_day: 'bg-yellow-100 text-yellow-800',
  leave: 'bg-blue-100 text-blue-800',
}

export default function Attendance() {
  const { user, isAdmin, isSupervisor } = useAuth()
  const { toast } = useToast()

  const [records, setRecords] = useState([])
  const [sites, setSites] = useState([])
  const [workers, setWorkers] = useState([])
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 })
  const [editingId, setEditingId] = useState(null)
  const [deleteId, setDeleteId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [isBulkOpen, setIsBulkOpen] = useState(false)

  const [filters, setFilters] = useState({
    siteId: '',
    workerId: '',
    status: '',
    date: '',
  })

  const [form, setForm] = useState({
    workerId: '',
    siteId: '',
    date: new Date().toISOString().split('T')[0],
    status: 'present',
    hoursWorked: '8',
    overtime: '0',
    notes: '',
  })

  // Get selected worker's details
  const selectedWorker = workers.find(w => w._id === form.workerId)
  const dailyRate = selectedWorker?.dailyRate || 0
  const hourlyRate = dailyRate / 8
  const baseEarnings = form.status === 'present' ? dailyRate : form.status === 'half_day' ? dailyRate / 2 : 0
  const overtimeEarnings = parseFloat(form.overtime || 0) * hourlyRate
  const totalEarnings = baseEarnings + overtimeEarnings

  const [bulkForm, setBulkForm] = useState({
    siteId: '',
    date: new Date().toISOString().split('T')[0],
    records: [],
  })

  useEffect(() => {
    if (user?._id) {
      fetchInitialData()
    }
  }, [user?._id])

  useEffect(() => {
    if (user?._id) {
      fetchRecords()
    }
  }, [pagination.page, filters, user?._id])

  const fetchInitialData = async () => {
    if (!user?._id) return

    try {
      const [sitesRes, workersRes] = await Promise.all([
        sitesApi.getAll(),
        usersApi.getChildren(),
      ])
      setSites(sitesRes.data || [])
      setWorkers(workersRes.data || [])
    } catch (error) {
      console.error('Error fetching initial data:', error)
    }
  }

  const fetchRecords = async () => {
    if (!user?._id) return

    try {
      setLoading(true)
      const params = {
        page: pagination.page,
        limit: 50,
        ...Object.fromEntries(Object.entries(filters).filter(([_, v]) => v)),
      }
      const { data } = await attendanceApi.getAll(params)
      setRecords(data?.attendance || [])
      setPagination(data?.pagination || { page: 1, pages: 1, total: 0 })
    } catch (error) {
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to fetch attendance records',
        variant: 'destructive',
      })
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
        const response = await attendanceApi.update(editingId, attendanceData)

        const workerName = selectedWorker?.name || 'Worker'
        let description = `Attendance updated for ${workerName}`

        if (response.data?.pendingSalary && (form.status === 'present' || form.status === 'half_day')) {
          const pendingAmount = formatCurrency(response.data.pendingSalary.totalPending || 0)
          const todayEarnings = formatCurrency(totalEarnings || 0)
          description = `${description}. Today's earnings: ${todayEarnings}. Total pending salary: ${pendingAmount}`
        }

        toast({
          title: 'Attendance updated successfully',
          description: description
        })
      } else {
        const response = await attendanceApi.create(attendanceData)

        const workerName = selectedWorker?.name || 'Worker'
        let description = `Attendance recorded for ${workerName}`

        if (response.data?.pendingSalary && (form.status === 'present' || form.status === 'half_day')) {
          const pendingAmount = formatCurrency(response.data.pendingSalary.totalPending || 0)
          const todayEarnings = formatCurrency(totalEarnings || 0)
          description = `${description}. Today's earnings: ${todayEarnings}. Total pending salary: ${pendingAmount}`
        }

        toast({
          title: 'Attendance recorded successfully',
          description: description
        })
      }

      setIsAddOpen(false)
      resetForm()
      fetchRecords()
    } catch (error) {
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to save attendance',
        variant: 'destructive',
      })
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
    setIsAddOpen(true)
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
        toast({
          title: 'Error',
          description: 'Please mark attendance for at least one worker',
          variant: 'destructive',
        })
        return
      }

      const response = await attendanceApi.bulkCreate({
        siteId: bulkForm.siteId || null,
        date: bulkForm.date,
        attendanceList
      })

      let description = `Attendance recorded for ${attendanceList.length} workers`
      if (response.data?.summary) {
        const totalPending = formatCurrency(response.data.summary.totalPendingSalary || 0)
        description = `${description}. Total pending salary across all workers: ${totalPending}`
      }

      toast({
        title: 'Bulk attendance recorded',
        description: description
      })
      setIsBulkOpen(false)
      resetBulkForm()
      fetchRecords()
    } catch (error) {
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to record attendance',
        variant: 'destructive',
      })
    }
  }

  const handleDelete = async () => {
    try {
      await attendanceApi.delete(deleteId)
      toast({ title: 'Attendance record deleted' })
      setDeleteId(null)
      fetchRecords()
    } catch (error) {
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to delete attendance',
        variant: 'destructive',
      })
    }
  }

  const resetForm = () => {
    setForm({
      workerId: '',
      siteId: '',
      date: new Date().toISOString().split('T')[0],
      status: 'present',
      hoursWorked: '8',
      overtime: '0',
      notes: '',
    })
    setEditingId(null)
  }

  const resetBulkForm = () => {
    setBulkForm({
      siteId: '',
      date: new Date().toISOString().split('T')[0],
      records: [],
    })
  }

  const initBulkRecords = () => {
    setBulkForm({
      ...bulkForm,
      records: workers.map(w => ({
        workerId: w._id,
        workerName: w.name,
        dailyRate: w.dailyRate || 0,
        status: '',
        hoursWorked: '8',
        overtime: '0',
      })),
    })
    setIsBulkOpen(true)
  }

  const updateBulkRecord = (index, field, value) => {
    const newRecords = [...bulkForm.records]
    newRecords[index] = { ...newRecords[index], [field]: value }
    setBulkForm({ ...bulkForm, records: newRecords })
  }

  const clearFilters = () => {
    setFilters({ siteId: '', workerId: '', status: '', date: '' })
    setPagination({ ...pagination, page: 1 })
  }

  // Calculate summary
  const todayRecords = records.filter(r =>
    new Date(r.date).toDateString() === new Date().toDateString()
  )
  const presentToday = todayRecords.filter(r => r.status === 'present').length
  const absentToday = todayRecords.filter(r => r.status === 'absent').length

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Attendance</h1>
          <p className="text-muted-foreground">
            Track worker attendance and work hours
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          {workers.length > 0 && (
            <Button variant="outline" onClick={initBulkRecords} className="w-full sm:w-auto">
              <Users className="h-4 w-4 mr-2" />
              Bulk Entry
            </Button>
          )}
          <Button onClick={() => setIsAddOpen(true)} className="w-full sm:w-auto">
            <Plus className="h-4 w-4 mr-2" />
            Add Record
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Records</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pagination.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Present Today</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{presentToday}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Absent Today</CardTitle>
            <XCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{absentToday}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Workers</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{workers.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-5">
            <div className="space-y-2">
              <Label>Site</Label>
              <Select
                value={filters.siteId}
                onValueChange={(value) => {
                  setFilters({ ...filters, siteId: value === 'all' ? '' : value })
                  setPagination({ ...pagination, page: 1 })
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Sites" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sites</SelectItem>
                  {sites.map((site) => (
                    <SelectItem key={site._id} value={site._id}>{site.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Worker</Label>
              <Select
                value={filters.workerId}
                onValueChange={(value) => {
                  setFilters({ ...filters, workerId: value === 'all' ? '' : value })
                  setPagination({ ...pagination, page: 1 })
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Workers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Workers</SelectItem>
                  {workers.map((worker) => (
                    <SelectItem key={worker._id} value={worker._id}>{worker.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={filters.status}
                onValueChange={(value) => {
                  setFilters({ ...filters, status: value === 'all' ? '' : value })
                  setPagination({ ...pagination, page: 1 })
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="present">Present</SelectItem>
                  <SelectItem value="absent">Absent</SelectItem>
                  <SelectItem value="half_day">Half Day</SelectItem>
                  <SelectItem value="leave">Leave</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Date</Label>
              <Input
                type="date"
                value={filters.date}
                onChange={(e) => {
                  setFilters({ ...filters, date: e.target.value })
                  setPagination({ ...pagination, page: 1 })
                }}
              />
            </div>
            <div className="space-y-2">
              <Label>&nbsp;</Label>
              <Button variant="outline" className="w-full" onClick={clearFilters}>
                Clear Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Attendance Table */}
      <Card>
        <CardHeader>
          <CardTitle>Attendance Records</CardTitle>
          <CardDescription>Showing {records.length} of {pagination.total} entries</CardDescription>
        </CardHeader>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Worker</TableHead>
              <TableHead>Site</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Hours</TableHead>
              <TableHead>Overtime</TableHead>
              <TableHead>Daily Rate</TableHead>
              <TableHead>Notes</TableHead>
              <TableHead>Marked By</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-8">
                  <div className="flex justify-center">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900"></div>
                  </div>
                </TableCell>
              </TableRow>
            ) : records.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                  No attendance records found
                </TableCell>
              </TableRow>
            ) : (
              records.map((record) => (
                <TableRow key={record._id}>
                  <TableCell>{formatDate(record.date)}</TableCell>
                  <TableCell className="font-medium">{record.worker?.name}</TableCell>
                  <TableCell>{record.site?.name || '-'}</TableCell>
                  <TableCell>
                    <Badge className={STATUS_COLORS[record.status]}>
                      {record.status.replace('_', ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {record.hoursWorked > 0 && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {record.hoursWorked}h
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    {record.overtime > 0 && (
                      <span className="text-orange-600 font-medium">+{record.overtime}h</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {record.worker?.dailyRate > 0 && (
                      <span className="text-green-600">₹{record.worker.dailyRate}</span>
                    )}
                  </TableCell>
                  <TableCell className="max-w-[150px] truncate">{record.notes || '-'}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{record.markedBy?.name}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(record)}
                        title="Edit attendance"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteId(record._id)}
                        title="Delete attendance"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Pagination */}
      {pagination.pages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="icon"
            disabled={pagination.page === 1}
            onClick={() => setPagination({ ...pagination, page: pagination.page - 1 })}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm">Page {pagination.page} of {pagination.pages}</span>
          <Button
            variant="outline"
            size="icon"
            disabled={pagination.page === pagination.pages}
            onClick={() => setPagination({ ...pagination, page: pagination.page + 1 })}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Add Single Record Dialog */}
      <Dialog open={isAddOpen} onOpenChange={(open) => {
        setIsAddOpen(open)
        if (!open) resetForm()
      }}>
        <DialogContent>
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>{editingId ? 'Edit' : 'Record'} Attendance</DialogTitle>
              <DialogDescription>
                {editingId ? 'Update attendance record' : 'Mark attendance for a worker'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Worker *</Label>
                <Select
                  value={form.workerId}
                  onValueChange={(value) => setForm({ ...form, workerId: value })}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select worker" />
                  </SelectTrigger>
                  <SelectContent>
                    {workers.map((worker) => (
                      <SelectItem key={worker._id} value={worker._id}>
                        {worker.name} {worker.dailyRate > 0 && `(₹${worker.dailyRate}/day)`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {selectedWorker && (
                <div className="bg-blue-50 p-3 rounded-lg space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Daily Rate:</span>
                    <span className="font-medium">₹{dailyRate.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Hourly Rate:</span>
                    <span className="font-medium">₹{hourlyRate.toFixed(2)}/hr</span>
                  </div>
                </div>
              )}
              <div className="space-y-2">
                <Label>Site</Label>
                <Select
                  value={form.siteId}
                  onValueChange={(value) => setForm({ ...form, siteId: value === 'none' ? '' : value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select site (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No specific site</SelectItem>
                    {sites.map((site) => (
                      <SelectItem key={site._id} value={site._id}>{site.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Date *</Label>
                  <Input
                    type="date"
                    value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Status *</Label>
                  <Select
                    value={form.status}
                    onValueChange={(value) => setForm({ ...form, status: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="present">Present</SelectItem>
                      <SelectItem value="absent">Absent</SelectItem>
                      <SelectItem value="half_day">Half Day</SelectItem>
                      <SelectItem value="leave">Leave</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {(form.status === 'present' || form.status === 'half_day') && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Hours Worked</Label>
                    <Input
                      type="number"
                      value={form.status === 'half_day' ? '4' : form.hoursWorked}
                      onChange={(e) => setForm({ ...form, hoursWorked: e.target.value })}
                      min="0"
                      max="24"
                      step="0.5"
                      disabled={form.status === 'half_day'}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Overtime Hours</Label>
                    <Input
                      type="number"
                      value={form.overtime}
                      onChange={(e) => setForm({ ...form, overtime: e.target.value })}
                      min="0"
                      max="16"
                      step="0.5"
                      placeholder="Extra hours"
                    />
                  </div>
                </div>
              )}
              {selectedWorker && dailyRate > 0 && (form.status === 'present' || form.status === 'half_day') && (
                <div className="bg-green-50 p-3 rounded-lg space-y-1 border border-green-200">
                  <div className="text-sm font-medium text-green-800 mb-2">Earnings Calculation</div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Base ({form.status === 'half_day' ? 'Half Day' : 'Full Day'}):</span>
                    <span>₹{baseEarnings.toFixed(2)}</span>
                  </div>
                  {parseFloat(form.overtime) > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Overtime ({form.overtime} hrs × ₹{hourlyRate.toFixed(2)}):</span>
                      <span>₹{overtimeEarnings.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm font-bold border-t pt-1 mt-1">
                    <span>Total Earnings:</span>
                    <span className="text-green-700">₹{totalEarnings.toFixed(2)}</span>
                  </div>
                </div>
              )}
              <div className="space-y-2">
                <Label>Notes</Label>
                <Input
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="Optional notes"
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="submit">{editingId ? 'Update' : 'Record'} Attendance</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Bulk Entry Dialog */}
      <Dialog open={isBulkOpen} onOpenChange={setIsBulkOpen}>
        <DialogContent className="max-w-2xl">
          <form onSubmit={handleBulkSubmit}>
            <DialogHeader>
              <DialogTitle>Bulk Attendance Entry</DialogTitle>
              <DialogDescription>Mark attendance for multiple workers at once</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Date *</Label>
                  <Input
                    type="date"
                    value={bulkForm.date}
                    onChange={(e) => setBulkForm({ ...bulkForm, date: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Site</Label>
                  <Select
                    value={bulkForm.siteId}
                    onValueChange={(value) => setBulkForm({ ...bulkForm, siteId: value === 'none' ? '' : value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select site" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No specific site</SelectItem>
                      {sites.map((site) => (
                        <SelectItem key={site._id} value={site._id}>{site.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="border rounded-lg max-h-[300px] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Worker</TableHead>
                      <TableHead>Daily Rate</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Hours</TableHead>
                      <TableHead>Overtime</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bulkForm.records.map((record, index) => (
                      <TableRow key={record.workerId}>
                        <TableCell className="font-medium">{record.workerName}</TableCell>
                        <TableCell>
                          {record.dailyRate > 0 ? (
                            <span className="text-green-600">₹{record.dailyRate}</span>
                          ) : (
                            <span className="text-muted-foreground text-sm">Not set</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Select
                            value={record.status}
                            onValueChange={(value) => updateBulkRecord(index, 'status', value)}
                          >
                            <SelectTrigger className="w-[120px]">
                              <SelectValue placeholder="Select" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="present">Present</SelectItem>
                              <SelectItem value="absent">Absent</SelectItem>
                              <SelectItem value="half_day">Half Day</SelectItem>
                              <SelectItem value="leave">Leave</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            value={record.status === 'half_day' ? '4' : record.hoursWorked}
                            onChange={(e) => updateBulkRecord(index, 'hoursWorked', e.target.value)}
                            className="w-[70px]"
                            min="0"
                            max="24"
                            disabled={record.status !== 'present'}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            value={record.overtime}
                            onChange={(e) => updateBulkRecord(index, 'overtime', e.target.value)}
                            className="w-[70px]"
                            min="0"
                            max="16"
                            placeholder="0"
                            disabled={!record.status || record.status === 'absent' || record.status === 'leave'}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
            <DialogFooter>
              <Button type="submit">Save Attendance</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Attendance Record?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this attendance record. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
