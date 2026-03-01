import { useState, useEffect } from 'react'
import { useAuth } from '@/context/AuthContext'
import { investmentsApi, organizationsApi } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Sheet, SheetContent } from '@/components/ui/sheet'
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
import { Plus, TrendingUp, PiggyBank, ArrowDownToLine, Edit, Trash2, Receipt, Users, Building2 } from 'lucide-react'
import {
  PageLayout, PageHeader, SummaryBanner, ListItem, ActionBtn, PagePagination, EmptyState,
} from '@/components/page'

const PAYMENT_MODES = [
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'cash', label: 'Cash' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'upi', label: 'UPI' },
  { value: 'other', label: 'Other' },
]

export default function Investments() {
  const { isAdmin } = useAuth()
  const { toast } = useToast()

  const [investments, setInvestments] = useState([])
  const [partners, setPartners] = useState([])
  const [summary, setSummary] = useState(null)
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 })
  const [loading, setLoading] = useState(true)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [isWithdrawOpen, setIsWithdrawOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [withdrawing, setWithdrawing] = useState(false)

  const [form, setForm] = useState({
    partnerId: '',
    amount: '',
    description: '',
    investmentDate: new Date().toISOString().split('T')[0],
    referenceNumber: '',
    paymentMode: 'bank_transfer',
  })

  const [withdrawForm, setWithdrawForm] = useState({
    partnerId: '',
    amount: '',
    description: '',
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
    } catch {
      toast({ title: 'Error', description: 'Failed to fetch investments', variant: 'destructive' })
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
        toast({ title: 'Investment updated' })
      } else {
        await investmentsApi.create({
          partnerId: form.partnerId,
          amount: parseFloat(form.amount),
          description: form.description,
          investmentDate: form.investmentDate,
          referenceNumber: form.referenceNumber,
          paymentMode: form.paymentMode,
        })
        toast({ title: 'Investment added' })
      }
      setSheetOpen(false)
      resetForm()
      fetchData()
    } catch (error) {
      toast({ title: 'Error', description: error.response?.data?.message || 'Failed to save', variant: 'destructive' })
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
    setSheetOpen(true)
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this investment?')) return
    try {
      await investmentsApi.delete(id)
      toast({ title: 'Investment deleted' })
      fetchData()
    } catch (error) {
      toast({ title: 'Error', description: error.response?.data?.message || 'Failed to delete', variant: 'destructive' })
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

  const handleWithdraw = async (e) => {
    e.preventDefault()
    setWithdrawing(true)
    try {
      await investmentsApi.withdraw({
        partnerId: withdrawForm.partnerId,
        amount: parseFloat(withdrawForm.amount),
        description: withdrawForm.description,
        referenceNumber: withdrawForm.referenceNumber,
        paymentMode: withdrawForm.paymentMode,
      })
      toast({ title: 'Withdrawal successful', description: `${formatCurrency(withdrawForm.amount)} credited to wallet` })
      setIsWithdrawOpen(false)
      resetWithdrawForm()
      fetchData()
    } catch (error) {
      toast({ title: 'Error', description: error.response?.data?.message || 'Failed to process withdrawal', variant: 'destructive' })
    } finally {
      setWithdrawing(false)
    }
  }

  const resetWithdrawForm = () => {
    setWithdrawForm({ partnerId: '', amount: '', description: '', referenceNumber: '', paymentMode: 'bank_transfer' })
  }

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center h-64 flex-col gap-2">
        <PiggyBank className="h-12 w-12 text-gray-300" />
        <p className="text-gray-500 font-medium">Only developers can manage investments</p>
      </div>
    )
  }

  const utilizationPct = summary?.totalInvestment > 0
    ? ((summary.totalExpenses / summary.totalInvestment) * 100).toFixed(1)
    : '0'

  return (
    <PageLayout>
      <PageHeader title="Partner Investments" subtitle={`${pagination.total} entries`}>
        {summary?.remainingFunds > 0 && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => { resetWithdrawForm(); setIsWithdrawOpen(true) }}
            className="text-green-600 border-green-300 hover:bg-green-50"
          >
            <ArrowDownToLine className="h-4 w-4 mr-1" />
            Withdraw
          </Button>
        )}
        <Button size="sm" onClick={() => { resetForm(); setSheetOpen(true) }} className="bg-green-600 hover:bg-green-700 text-white">
          <Plus className="h-4 w-4 mr-1" />
          Add
        </Button>
      </PageHeader>

      <SummaryBanner
        color="green"
        icon={<PiggyBank className="h-8 w-8" />}
        items={[
          { label: 'Total Invested', value: formatCurrency(summary?.totalInvestment || 0) },
          { label: 'Total Utilized', value: formatCurrency(summary?.totalExpenses || 0) },
          { label: 'Remaining', value: formatCurrency(summary?.remainingFunds || 0) },
        ]}
      />

      {/* Fund Utilization Breakdown */}
      {summary && (
        <div className="px-4 pb-2 grid grid-cols-4 gap-2">
          <div className="p-3 bg-orange-50 rounded-xl border border-orange-100">
            <div className="flex items-center gap-1 mb-1">
              <Building2 className="h-3 w-3 text-orange-500" />
              <p className="text-[10px] text-orange-600 font-semibold uppercase tracking-wide">Expenses</p>
            </div>
            <p className="text-sm font-bold text-orange-700">{formatCurrency(summary.expenses?.total || 0)}</p>
          </div>
          <div className="p-3 bg-blue-50 rounded-xl border border-blue-100">
            <div className="flex items-center gap-1 mb-1">
              <Receipt className="h-3 w-3 text-blue-500" />
              <p className="text-[10px] text-blue-600 font-semibold uppercase tracking-wide">Bills</p>
            </div>
            <p className="text-sm font-bold text-blue-700">{formatCurrency(summary.bills?.total || 0)}</p>
          </div>
          <div className="p-3 bg-purple-50 rounded-xl border border-purple-100">
            <div className="flex items-center gap-1 mb-1">
              <Users className="h-3 w-3 text-purple-500" />
              <p className="text-[10px] text-purple-600 font-semibold uppercase tracking-wide">Labour</p>
            </div>
            <p className="text-sm font-bold text-purple-700">{formatCurrency(summary.workerLedger?.netPayable || 0)}</p>
          </div>
          <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
            <div className="flex items-center gap-1 mb-1">
              <TrendingUp className="h-3 w-3 text-gray-500" />
              <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-wide">Used %</p>
            </div>
            <p className="text-sm font-bold text-gray-700">{utilizationPct}%</p>
          </div>
        </div>
      )}

      {/* Partner Breakdown */}
      {summary?.partnerInvestments?.length > 0 && (
        <div className="px-4 pb-2">
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">By Partner</p>
            <div className="space-y-2">
              {summary.partnerInvestments.map((item) => (
                <div key={item.partner?._id} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{item.partner?.name}</p>
                    <p className="text-xs text-gray-400">{item.count} investments</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold">{formatCurrency(item.totalInvested)}</p>
                    <p className="text-xs text-gray-400">
                      {((item.totalInvested / summary.totalInvestment) * 100).toFixed(1)}%
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Investments List */}
      <div className="flex-1">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600" />
          </div>
        ) : investments.length === 0 ? (
          <EmptyState
            message="No investments recorded yet"
            action={
              <Button variant="outline" size="sm" onClick={() => { resetForm(); setSheetOpen(true) }}>
                <Plus className="h-4 w-4 mr-1" /> Add First Investment
              </Button>
            }
            icon={<PiggyBank className="h-12 w-12" />}
          />
        ) : (
          <div className="divide-y divide-gray-100">
            {investments.map((investment) => (
              <ListItem
                key={investment._id}
                avatar={investment.partner?.name}
                avatarColor="green"
                title={investment.partner?.name}
                subtitle={
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs text-gray-400">{formatDate(investment.investmentDate)}</span>
                    <span className="text-xs text-gray-400">
                      • {PAYMENT_MODES.find(m => m.value === investment.paymentMode)?.label}
                    </span>
                    {investment.referenceNumber && (
                      <span className="text-xs text-gray-400">• {investment.referenceNumber}</span>
                    )}
                    {investment.description && (
                      <span className="text-xs text-gray-400">• {investment.description}</span>
                    )}
                  </div>
                }
                amount={formatCurrency(investment.amount)}
                actions={
                  <>
                    <ActionBtn onClick={() => handleEdit(investment)} title="Edit" icon={Edit} />
                    <ActionBtn
                      onClick={() => handleDelete(investment._id)}
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
        onChange={(page) => setPagination((p) => ({ ...p, page }))}
      />

      {/* Add/Edit Sheet */}
      <Sheet open={sheetOpen} onOpenChange={(open) => { setSheetOpen(open); if (!open) resetForm() }}>
        <SheetContent title={editingId ? 'Edit Investment' : 'Add Investment'}>
          <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
            {/* Amount first */}
            <div className="space-y-1">
              <Label>Amount ₹ *</Label>
              <Input
                type="number"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                placeholder="e.g. 100000"
                required
                min="0"
                autoFocus
              />
            </div>

            {/* Rest shown after amount is entered */}
            {parseFloat(form.amount) > 0 && (
              <>
                {!editingId && (
                  <div className="space-y-1">
                    <Label>Partner *</Label>
                    <Select
                      value={form.partnerId}
                      onValueChange={(v) => setForm({ ...form, partnerId: v })}
                      required
                    >
                      <SelectTrigger><SelectValue placeholder="Select partner" /></SelectTrigger>
                      <SelectContent>
                        {partners.map((p) => (
                          <SelectItem key={p._id} value={p._id}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="space-y-1">
                  <Label>Date *</Label>
                  <Input
                    type="date"
                    value={form.investmentDate}
                    onChange={(e) => setForm({ ...form, investmentDate: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-1">
                  <Label>Payment Mode</Label>
                  <Select value={form.paymentMode} onValueChange={(v) => setForm({ ...form, paymentMode: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PAYMENT_MODES.map((m) => (
                        <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label>Reference Number</Label>
                  <Input
                    value={form.referenceNumber}
                    onChange={(e) => setForm({ ...form, referenceNumber: e.target.value })}
                    placeholder="e.g. TXN123456"
                  />
                </div>

                <div className="space-y-1">
                  <Label>Description</Label>
                  <Textarea
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    placeholder="e.g. Initial capital contribution"
                    rows={3}
                  />
                </div>
              </>
            )}

            <Button type="submit" className="w-full h-11 text-base bg-green-600 hover:bg-green-700" disabled={!form.amount}>
              {editingId ? 'Save Changes' : 'Add Investment'}
            </Button>
          </form>
        </SheetContent>
      </Sheet>

      {/* Withdraw Dialog */}
      <Dialog open={isWithdrawOpen} onOpenChange={(open) => { setIsWithdrawOpen(open); if (!open) resetWithdrawForm() }}>
        <DialogContent className="max-w-md">
          <form onSubmit={handleWithdraw}>
            <DialogHeader>
              <DialogTitle>Withdraw Available Funds</DialogTitle>
              <DialogDescription>Withdraw from investment pool to wallet</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {summary && (
                <div className="p-4 bg-green-50 border border-green-200 rounded-xl">
                  <p className="text-sm text-green-700 font-medium">Available to Withdraw</p>
                  <p className="text-2xl font-bold text-green-600 mt-1">{formatCurrency(summary.remainingFunds)}</p>
                </div>
              )}

              <div className="space-y-1">
                <Label>Partner *</Label>
                <Select
                  value={withdrawForm.partnerId}
                  onValueChange={(v) => setWithdrawForm({ ...withdrawForm, partnerId: v })}
                  required
                >
                  <SelectTrigger><SelectValue placeholder="Select partner withdrawing" /></SelectTrigger>
                  <SelectContent>
                    {partners.map((p) => (
                      <SelectItem key={p._id} value={p._id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label>Amount (₹) *</Label>
                <Input
                  type="number"
                  value={withdrawForm.amount}
                  onChange={(e) => setWithdrawForm({ ...withdrawForm, amount: e.target.value })}
                  placeholder="Enter amount"
                  required
                  min="1"
                  max={summary?.remainingFunds || 0}
                  step="0.01"
                />
                {summary && (
                  <p className="text-xs text-gray-400">Maximum: {formatCurrency(summary.remainingFunds)}</p>
                )}
              </div>

              <div className="space-y-1">
                <Label>Payment Mode</Label>
                <Select
                  value={withdrawForm.paymentMode}
                  onValueChange={(v) => setWithdrawForm({ ...withdrawForm, paymentMode: v })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PAYMENT_MODES.map((m) => (
                      <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label>Reference Number</Label>
                <Input
                  value={withdrawForm.referenceNumber}
                  onChange={(e) => setWithdrawForm({ ...withdrawForm, referenceNumber: e.target.value })}
                  placeholder="Transaction reference (optional)"
                />
              </div>

              <div className="space-y-1">
                <Label>Description</Label>
                <Textarea
                  value={withdrawForm.description}
                  onChange={(e) => setWithdrawForm({ ...withdrawForm, description: e.target.value })}
                  placeholder="Purpose of withdrawal (optional)"
                  rows={2}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsWithdrawOpen(false)} disabled={withdrawing}>
                Cancel
              </Button>
              <Button type="submit" disabled={withdrawing} className="bg-green-600 hover:bg-green-700">
                {withdrawing ? 'Processing...' : 'Withdraw to Wallet'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </PageLayout>
  )
}
