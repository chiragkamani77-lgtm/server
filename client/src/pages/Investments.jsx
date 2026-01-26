import { useState, useEffect } from 'react'
import { useAuth } from '@/context/AuthContext'
import { investmentsApi, organizationsApi } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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
import { useToast } from '@/hooks/use-toast'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Plus, TrendingUp, Wallet, PiggyBank, ChevronLeft, ChevronRight, Trash2, Edit } from 'lucide-react'

const PAYMENT_MODES = [
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'cash', label: 'Cash' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'upi', label: 'UPI' },
  { value: 'other', label: 'Other' },
]

export default function Investments() {
  const { user, isAdmin } = useAuth()
  const { toast } = useToast()

  const [investments, setInvestments] = useState([])
  const [partners, setPartners] = useState([])
  const [summary, setSummary] = useState(null)
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 })
  const [loading, setLoading] = useState(true)
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)

  const [form, setForm] = useState({
    partnerId: '',
    amount: '',
    description: '',
    investmentDate: new Date().toISOString().split('T')[0],
    referenceNumber: '',
    paymentMode: 'bank_transfer',
  })

  useEffect(() => {
    fetchData()
    fetchPartners()
  }, [pagination.page])

  const fetchData = async () => {
    try {
      setLoading(true)
      const [investmentsRes, summaryRes] = await Promise.all([
        investmentsApi.getAll({ page: pagination.page, limit: 20 }),
        investmentsApi.getSummary(),
      ])
      setInvestments(investmentsRes.data.investments)
      setPagination(investmentsRes.data.pagination)
      setSummary(summaryRes.data)
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to fetch investments',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const fetchPartners = async () => {
    try {
      const orgRes = await organizationsApi.getCurrent()
      const partnersRes = await organizationsApi.getPartners(orgRes.data._id)
      setPartners(partnersRes.data)
    } catch (error) {
      console.error('Failed to fetch partners:', error)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      if (editingId) {
        await investmentsApi.update(editingId, {
          amount: parseFloat(form.amount),
          description: form.description,
          investmentDate: form.investmentDate,
          referenceNumber: form.referenceNumber,
          paymentMode: form.paymentMode,
        })
        toast({ title: 'Investment updated successfully' })
      } else {
        await investmentsApi.create({
          partnerId: form.partnerId,
          amount: parseFloat(form.amount),
          description: form.description,
          investmentDate: form.investmentDate,
          referenceNumber: form.referenceNumber,
          paymentMode: form.paymentMode,
        })
        toast({ title: 'Investment added successfully' })
      }
      setIsAddOpen(false)
      resetForm()
      fetchData()
    } catch (error) {
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to save investment',
        variant: 'destructive',
      })
    }
  }

  const handleEdit = (investment) => {
    setForm({
      partnerId: investment.partner._id,
      amount: investment.amount.toString(),
      description: investment.description || '',
      investmentDate: investment.investmentDate.split('T')[0],
      referenceNumber: investment.referenceNumber || '',
      paymentMode: investment.paymentMode,
    })
    setEditingId(investment._id)
    setIsAddOpen(true)
  }

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this investment?')) return
    try {
      await investmentsApi.delete(id)
      toast({ title: 'Investment deleted' })
      fetchData()
    } catch (error) {
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to delete investment',
        variant: 'destructive',
      })
    }
  }

  const resetForm = () => {
    setForm({
      partnerId: '',
      amount: '',
      description: '',
      investmentDate: new Date().toISOString().split('T')[0],
      referenceNumber: '',
      paymentMode: 'bank_transfer',
    })
    setEditingId(null)
  }

  if (!isAdmin) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold">Access Denied</h2>
        <p className="text-muted-foreground">Only developers can manage investments</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Partner Investments</h1>
          <p className="text-muted-foreground">
            Track partner contributions and fund usage
          </p>
        </div>
        <Button onClick={() => { resetForm(); setIsAddOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" />
          Add Investment
        </Button>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Invested</CardTitle>
              <PiggyBank className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(summary.totalInvestment)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Expenses</CardTitle>
              <Wallet className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(summary.totalExpenses)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Remaining Funds</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${summary.remainingFunds >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(summary.remainingFunds)}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Partners</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.partnerInvestments?.length || 0}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Partner Breakdown */}
      {summary?.partnerInvestments?.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Investment by Partner</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              {summary.partnerInvestments.map((item) => (
                <div key={item.partner?._id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <p className="font-medium">{item.partner?.name}</p>
                    <p className="text-sm text-muted-foreground">{item.count} investments</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">{formatCurrency(item.totalInvested)}</p>
                    <p className="text-sm text-muted-foreground">
                      {((item.totalInvested / summary.totalInvestment) * 100).toFixed(1)}%
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Investments Table */}
      <Card>
        <CardHeader>
          <CardTitle>Investment History</CardTitle>
          <CardDescription>Showing {investments.length} of {pagination.total} entries</CardDescription>
        </CardHeader>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Partner</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Reference</TableHead>
              <TableHead>Mode</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">
                  <div className="flex justify-center">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900"></div>
                  </div>
                </TableCell>
              </TableRow>
            ) : investments.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  No investments recorded yet
                </TableCell>
              </TableRow>
            ) : (
              investments.map((investment) => (
                <TableRow key={investment._id}>
                  <TableCell>{formatDate(investment.investmentDate)}</TableCell>
                  <TableCell className="font-medium">{investment.partner?.name}</TableCell>
                  <TableCell className="max-w-[200px] truncate">{investment.description || '-'}</TableCell>
                  <TableCell>{investment.referenceNumber || '-'}</TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {PAYMENT_MODES.find(m => m.value === investment.paymentMode)?.label}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-bold">{formatCurrency(investment.amount)}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(investment)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(investment._id)}>
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

      {/* Add/Edit Dialog */}
      <Dialog open={isAddOpen} onOpenChange={(open) => { setIsAddOpen(open); if (!open) resetForm(); }}>
        <DialogContent>
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>{editingId ? 'Edit' : 'Add'} Investment</DialogTitle>
              <DialogDescription>Record a partner investment contribution</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {!editingId && (
                <div className="space-y-2">
                  <Label>Partner</Label>
                  <Select
                    value={form.partnerId}
                    onValueChange={(value) => setForm({ ...form, partnerId: value })}
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select partner" />
                    </SelectTrigger>
                    <SelectContent>
                      {partners.map((partner) => (
                        <SelectItem key={partner._id} value={partner._id}>
                          {partner.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-2">
                <Label>Amount (Rs.)</Label>
                <Input
                  type="number"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  placeholder="100000"
                  required
                  min="0"
                />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Initial capital contribution"
                />
              </div>
              <div className="space-y-2">
                <Label>Date</Label>
                <Input
                  type="date"
                  value={form.investmentDate}
                  onChange={(e) => setForm({ ...form, investmentDate: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Reference Number</Label>
                <Input
                  value={form.referenceNumber}
                  onChange={(e) => setForm({ ...form, referenceNumber: e.target.value })}
                  placeholder="TXN123456"
                />
              </div>
              <div className="space-y-2">
                <Label>Payment Mode</Label>
                <Select
                  value={form.paymentMode}
                  onValueChange={(value) => setForm({ ...form, paymentMode: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_MODES.map((mode) => (
                      <SelectItem key={mode.value} value={mode.value}>
                        {mode.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="submit">{editingId ? 'Update' : 'Add'} Investment</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
