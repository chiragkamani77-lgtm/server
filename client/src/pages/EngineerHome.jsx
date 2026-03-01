import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { MobileLayout, FeedItem, EmptyFeed } from '@/components/mobile'
import { ExpenseForm } from '@/components/expenses/ExpenseForm'
import { ExpenseActions } from '@/components/expenses/ExpenseActions'
import { BillForm } from '@/components/bills/BillForm'
import {
  Receipt, FileText, CalendarDays, BookOpen, Wallet, Loader,
  CheckCircle, XCircle,
} from 'lucide-react'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { expensesApi, billsApi, attendanceApi, ledgerApi, usersApi, fundsApi } from '@/lib/api'
import { formatCurrency, formatDate } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'

// ─── Constants ────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'expenses',   label: 'Expenses',   icon: Receipt },
  { id: 'bills',      label: 'Bills',      icon: FileText },
  { id: 'attendance', label: 'Attendance', icon: CalendarDays },
  { id: 'ledger',     label: 'Ledger',     icon: BookOpen },
  { id: 'funds',      label: 'Funds',      icon: Wallet },
]

const BILL_STATUS = {
  pending:  'bg-amber-100 text-amber-700',
  credited: 'bg-blue-100 text-blue-700',
  paid:     'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
}

const EXPENSE_STATUS = {
  pending:  { label: 'Pending',  dot: 'bg-amber-400', text: 'text-amber-600' },
  approved: { label: 'Approved', dot: 'bg-blue-400',  text: 'text-blue-600'  },
  paid:     { label: 'Paid',     dot: 'bg-green-400', text: 'text-green-600' },
  rejected: { label: 'Rejected', dot: 'bg-red-400',   text: 'text-red-500'   },
}

const ATTENDANCE_BADGE = {
  present:  'bg-green-100 text-green-700',
  absent:   'bg-red-100 text-red-700',
  half_day: 'bg-amber-100 text-amber-700',
  leave:    'bg-blue-100 text-blue-700',
}

const PAYMENT_MODES = [
  { value: 'cash',          label: 'Cash' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'upi',           label: 'UPI' },
  { value: 'cheque',        label: 'Cheque' },
]

const TODAY = new Date().toISOString().split('T')[0]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function StatusMeta({ status }) {
  const s = EXPENSE_STATUS[status] || { dot: 'bg-gray-400', text: 'text-gray-500', label: status }
  return (
    <div className="flex items-center gap-1">
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      <span className={`text-[10px] font-medium ${s.text}`}>{s.label}</span>
    </div>
  )
}

function TabLoader() {
  return (
    <div className="flex justify-center py-16">
      <Loader className="h-6 w-6 animate-spin text-gray-300" />
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function EngineerHome() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const { toast } = useToast()

  const [activeTab, setActiveTab] = useState('expenses')
  const [workers, setWorkers] = useState([])
  const [wallet, setWallet] = useState(null)
  const [sheetOpen, setSheetOpen] = useState(false)

  // Approval dialog
  const [approveExpense, setApproveExpense] = useState(null)
  const [approveAction, setApproveAction] = useState('approve')

  // Expenses
  const [expenses, setExpenses] = useState([])
  const [expensesLoading, setExpensesLoading] = useState(false)

  // Attendance
  const [attendance, setAttendance] = useState([])
  const [attendanceLoading, setAttendanceLoading] = useState(false)
  const [attendanceForm, setAttendanceForm] = useState({
    workerId: '', date: TODAY, status: 'present', hoursWorked: '8', notes: '',
  })

  // Ledger
  const [ledger, setLedger] = useState([])
  const [ledgerLoading, setLedgerLoading] = useState(false)
  const [ledgerForm, setLedgerForm] = useState({
    amount: '', workerId: '', paymentMode: 'cash', description: '', transactionDate: TODAY,
  })
  const ledgerAmountEntered = parseFloat(ledgerForm.amount) > 0

  // Bills
  const [bills, setBills] = useState([])
  const [billsLoading, setBillsLoading] = useState(false)

  // Funds
  const [funds, setFunds] = useState([])
  const [fundsLoading, setFundsLoading] = useState(false)
  const [fundsForm, setFundsForm] = useState({
    amount: '', toUserId: '', description: '', referenceNumber: '',
  })
  const fundsAmountEntered = parseFloat(fundsForm.amount) > 0

  // ── Bootstrap ──

  useEffect(() => {
    usersApi.getChildren().then(r => setWorkers(r.data || [])).catch(() => {})
    fundsApi.getWalletSummary().then(r => setWallet(r.data)).catch(() => {})
  }, [])

  // ── Data loaders ──

  const loadExpenses = useCallback(async () => {
    setExpensesLoading(true)
    try {
      const res = await expensesApi.getAll({ limit: 30 })
      setExpenses(res.data?.expenses || [])
    } catch {
      toast({ title: 'Error', description: 'Failed to load expenses', variant: 'destructive' })
    } finally { setExpensesLoading(false) }
  }, [toast])

  const loadAttendance = useCallback(async () => {
    setAttendanceLoading(true)
    try {
      const res = await attendanceApi.getAll({ limit: 30 })
      setAttendance(res.data?.attendance || [])
    } catch {
      toast({ title: 'Error', description: 'Failed to load attendance', variant: 'destructive' })
    } finally { setAttendanceLoading(false) }
  }, [toast])

  const loadLedger = useCallback(async () => {
    setLedgerLoading(true)
    try {
      const res = await ledgerApi.getAll({ limit: 30 })
      setLedger(res.data?.entries || [])
    } catch {
      toast({ title: 'Error', description: 'Failed to load ledger', variant: 'destructive' })
    } finally { setLedgerLoading(false) }
  }, [toast])

  const loadBills = useCallback(async () => {
    setBillsLoading(true)
    try {
      const res = await billsApi.getAll({ limit: 30 })
      setBills(res.data?.bills || [])
    } catch {
      toast({ title: 'Error', description: 'Failed to load bills', variant: 'destructive' })
    } finally { setBillsLoading(false) }
  }, [toast])

  const loadFunds = useCallback(async () => {
    setFundsLoading(true)
    try {
      const res = await fundsApi.getAll({ limit: 30 })
      setFunds(res.data?.allocations || res.data || [])
    } catch {
      toast({ title: 'Error', description: 'Failed to load funds', variant: 'destructive' })
    } finally { setFundsLoading(false) }
  }, [toast])

  useEffect(() => {
    if (activeTab === 'expenses')   loadExpenses()
    if (activeTab === 'bills')      loadBills()
    if (activeTab === 'attendance') loadAttendance()
    if (activeTab === 'ledger')     loadLedger()
    if (activeTab === 'funds')      loadFunds()
  }, [activeTab, loadExpenses, loadBills, loadAttendance, loadLedger, loadFunds])

  // ── Sheet helpers ──

  const closeSheet = () => {
    setSheetOpen(false)
    setAttendanceForm({ workerId: '', date: TODAY, status: 'present', hoursWorked: '8', notes: '' })
    setLedgerForm({ amount: '', workerId: '', paymentMode: 'cash', description: '', transactionDate: TODAY })
    setFundsForm({ amount: '', toUserId: '', description: '', referenceNumber: '' })
  }

  const handleExpenseSuccess = () => {
    closeSheet()
    toast({ title: 'Expense submitted!' })
    loadExpenses()
  }

  // ── Form submissions ──

  const handleAttendanceSubmit = async (e) => {
    e.preventDefault()
    try {
      const hours = attendanceForm.status === 'present' ? parseFloat(attendanceForm.hoursWorked)
        : attendanceForm.status === 'half_day' ? 4 : 0
      await attendanceApi.create({
        workerId: attendanceForm.workerId,
        date: attendanceForm.date,
        status: attendanceForm.status,
        hoursWorked: hours,
        notes: attendanceForm.notes,
      })
      toast({ title: 'Attendance recorded' })
      closeSheet()
      loadAttendance()
    } catch (err) {
      toast({ title: 'Error', description: err.response?.data?.message || 'Failed', variant: 'destructive' })
    }
  }

  const handleLedgerSubmit = async (e) => {
    e.preventDefault()
    try {
      await ledgerApi.create({
        workerId: ledgerForm.workerId,
        amount: parseFloat(ledgerForm.amount),
        type: 'credit',
        paymentMode: ledgerForm.paymentMode,
        description: ledgerForm.description,
        transactionDate: ledgerForm.transactionDate,
      })
      toast({ title: 'Payment recorded' })
      closeSheet()
      loadLedger()
    } catch (err) {
      toast({ title: 'Error', description: err.response?.data?.message || 'Failed', variant: 'destructive' })
    }
  }

  const handleFundsSubmit = async (e) => {
    e.preventDefault()
    try {
      await fundsApi.create({
        toUserId: fundsForm.toUserId,
        amount: parseFloat(fundsForm.amount),
        description: fundsForm.description,
        referenceNumber: fundsForm.referenceNumber,
      })
      toast({ title: 'Fund allocated' })
      closeSheet()
      loadFunds()
    } catch (err) {
      toast({ title: 'Error', description: err.response?.data?.message || 'Failed', variant: 'destructive' })
    }
  }

  const fabLabels = {
    expenses:   'Add Expense',
    bills:      'Add Bill',
    attendance: 'Mark Attendance',
    ledger:     'Pay Worker',
    funds:      'Allocate Fund',
  }

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <>
      <MobileLayout
        title="Construction"
        userName={user?.name}
        wallet={wallet}
        onLogout={() => { logout(); navigate('/login') }}
        tabs={TABS}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        fabLabel={fabLabels[activeTab]}
        onFabClick={() => setSheetOpen(true)}
      >

        {/* ── Expenses ── */}
        {activeTab === 'expenses' && (
          expensesLoading ? <TabLoader /> :
          expenses.length === 0 ? (
            <EmptyFeed
              icon={Receipt}
              message="No expenses yet"
              action={{ label: '+ Add expense', onClick: () => setSheetOpen(true) }}
            />
          ) : (
            <div className="divide-y divide-gray-100 bg-white">
              {expenses.map((exp) => (
                <div key={exp._id}>
                  <FeedItem
                    seed={exp.description || 'E'}
                    title={exp.description || '—'}
                    subtitle={[
                      exp.user?.name,
                      formatDate(exp.expenseDate),
                    ].filter(Boolean).join(' · ')}
                    meta={<StatusMeta status={exp.status} />}
                    amount={formatCurrency(exp.requestedAmount || exp.amount)}
                  />
                  {/* Approve/reject actions for pending */}
                  {exp.status === 'pending' && (
                    <div className="px-4 pb-3 flex gap-2">
                      <button
                        onClick={() => { setApproveExpense(exp); setApproveAction('approve') }}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-blue-50 text-blue-600 text-xs font-semibold"
                      >
                        <CheckCircle className="h-3.5 w-3.5" /> Approve
                      </button>
                      <button
                        onClick={() => { setApproveExpense(exp); setApproveAction('reject') }}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-red-50 text-red-500 text-xs font-semibold"
                      >
                        <XCircle className="h-3.5 w-3.5" /> Reject
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )
        )}

        {/* ── Bills ── */}
        {activeTab === 'bills' && (
          billsLoading ? <TabLoader /> :
          bills.length === 0 ? (
            <EmptyFeed
              icon={FileText}
              message="No bills yet"
              action={{ label: '+ Add bill', onClick: () => setSheetOpen(true) }}
            />
          ) : (
            <div className="divide-y divide-gray-100 bg-white">
              {bills.map((bill) => (
                <FeedItem
                  key={bill._id}
                  seed={bill.vendorName || 'B'}
                  title={bill.vendorName || '—'}
                  subtitle={[bill.invoiceNumber, formatDate(bill.billDate)].filter(Boolean).join(' · ')}
                  amount={formatCurrency(bill.totalAmount)}
                  badge={{
                    label: bill.status,
                    className: BILL_STATUS[bill.status] || 'bg-gray-100 text-gray-600',
                  }}
                />
              ))}
            </div>
          )
        )}

        {/* ── Attendance ── */}
        {activeTab === 'attendance' && (
          attendanceLoading ? <TabLoader /> :
          attendance.length === 0 ? (
            <EmptyFeed
              icon={CalendarDays}
              message="No attendance records yet"
              action={{ label: '+ Mark attendance', onClick: () => setSheetOpen(true) }}
            />
          ) : (
            <div className="divide-y divide-gray-100 bg-white">
              {attendance.map((rec) => {
                const name = rec.worker?.name || '—'
                return (
                  <FeedItem
                    key={rec._id}
                    seed={name}
                    title={name}
                    subtitle={[formatDate(rec.date), rec.hoursWorked > 0 && `${rec.hoursWorked}h`].filter(Boolean).join(' · ')}
                    badge={{
                      label: rec.status?.replace('_', ' '),
                      className: ATTENDANCE_BADGE[rec.status] || 'bg-gray-100 text-gray-600',
                    }}
                  />
                )
              })}
            </div>
          )
        )}

        {/* ── Ledger ── */}
        {activeTab === 'ledger' && (
          ledgerLoading ? <TabLoader /> :
          ledger.length === 0 ? (
            <EmptyFeed
              icon={BookOpen}
              message="No payments recorded yet"
              action={{ label: '+ Record payment', onClick: () => setSheetOpen(true) }}
            />
          ) : (
            <div className="divide-y divide-gray-100 bg-white">
              {ledger.map((entry) => {
                const name = entry.worker?.name || '—'
                return (
                  <FeedItem
                    key={entry._id}
                    seed={name}
                    title={name}
                    subtitle={[
                      formatDate(entry.transactionDate),
                      entry.paymentMode?.replace('_', ' '),
                    ].filter(Boolean).join(' · ')}
                    amount={`${entry.type === 'credit' ? '+' : '−'}${formatCurrency(entry.amount)}`}
                    amountClass={entry.type === 'credit' ? 'text-green-600' : 'text-red-500'}
                  />
                )
              })}
            </div>
          )
        )}

        {/* ── Funds ── */}
        {activeTab === 'funds' && (
          fundsLoading ? <TabLoader /> :
          funds.length === 0 ? (
            <EmptyFeed
              icon={Wallet}
              message="No fund allocations yet"
              action={{ label: '+ Allocate fund', onClick: () => setSheetOpen(true) }}
            />
          ) : (
            <div className="divide-y divide-gray-100 bg-white">
              {funds.map((fund) => {
                const name = fund.toUser?.name || '—'
                return (
                  <FeedItem
                    key={fund._id}
                    seed={name}
                    title={name}
                    subtitle={formatDate(fund.allocationDate || fund.createdAt)}
                    amount={formatCurrency(fund.amount)}
                    badge={{
                      label: fund.status,
                      className: fund.status === 'disbursed' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700',
                    }}
                  />
                )
              })}
            </div>
          )
        )}

        {/* ── Bottom Sheet ── */}
        <Sheet open={sheetOpen} onOpenChange={(open) => { if (!open) closeSheet() }}>
          <SheetContent side="bottom" className="rounded-t-2xl max-h-[90vh] overflow-y-auto px-0 pb-safe">
            <div className="px-5 pt-2 pb-6">
              <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-5" />
              <h2 className="text-lg font-bold text-gray-900 mb-4">{fabLabels[activeTab]}</h2>

              {activeTab === 'expenses' && (
                <ExpenseForm onSuccess={handleExpenseSuccess} onCancel={closeSheet} />
              )}

              {activeTab === 'bills' && (
                <BillForm
                  onSuccess={() => { closeSheet(); toast({ title: 'Bill added!' }); loadBills() }}
                  onCancel={closeSheet}
                />
              )}

              {activeTab === 'attendance' && (
                <form onSubmit={handleAttendanceSubmit} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label>Worker *</Label>
                    <Select value={attendanceForm.workerId} onValueChange={(v) => setAttendanceForm(p => ({ ...p, workerId: v }))} required>
                      <SelectTrigger><SelectValue placeholder="Select worker" /></SelectTrigger>
                      <SelectContent>
                        {workers.map(w => <SelectItem key={w._id} value={w._id}>{w.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Status *</Label>
                      <Select value={attendanceForm.status} onValueChange={(v) => setAttendanceForm(p => ({ ...p, status: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="present">Present</SelectItem>
                          <SelectItem value="absent">Absent</SelectItem>
                          <SelectItem value="half_day">Half Day</SelectItem>
                          <SelectItem value="leave">Leave</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Date *</Label>
                      <Input type="date" value={attendanceForm.date} onChange={(e) => setAttendanceForm(p => ({ ...p, date: e.target.value }))} required />
                    </div>
                  </div>
                  {attendanceForm.status === 'present' && (
                    <div className="space-y-1.5">
                      <Label>Hours Worked</Label>
                      <Input type="number" value={attendanceForm.hoursWorked} onChange={(e) => setAttendanceForm(p => ({ ...p, hoursWorked: e.target.value }))} min="0" max="24" step="0.5" />
                    </div>
                  )}
                  <div className="space-y-1.5">
                    <Label>Notes</Label>
                    <Input placeholder="Optional" value={attendanceForm.notes} onChange={(e) => setAttendanceForm(p => ({ ...p, notes: e.target.value }))} />
                  </div>
                  <div className="flex gap-2 pt-2">
                    <Button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700" disabled={!attendanceForm.workerId}>Save</Button>
                    <Button type="button" variant="outline" onClick={closeSheet}>Cancel</Button>
                  </div>
                </form>
              )}

              {activeTab === 'ledger' && (
                <form onSubmit={handleLedgerSubmit} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label>Amount (₹) *</Label>
                    <Input type="number" placeholder="e.g. 2500" autoFocus value={ledgerForm.amount} onChange={(e) => setLedgerForm(p => ({ ...p, amount: e.target.value }))} min="0" required />
                  </div>
                  {ledgerAmountEntered && (
                    <>
                      <div className="space-y-1.5">
                        <Label>Worker *</Label>
                        <Select value={ledgerForm.workerId} onValueChange={(v) => setLedgerForm(p => ({ ...p, workerId: v }))} required>
                          <SelectTrigger><SelectValue placeholder="Select worker" /></SelectTrigger>
                          <SelectContent>
                            {workers.map(w => <SelectItem key={w._id} value={w._id}>{w.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label>Payment Mode</Label>
                          <Select value={ledgerForm.paymentMode} onValueChange={(v) => setLedgerForm(p => ({ ...p, paymentMode: v }))}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {PAYMENT_MODES.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1.5">
                          <Label>Date</Label>
                          <Input type="date" value={ledgerForm.transactionDate} onChange={(e) => setLedgerForm(p => ({ ...p, transactionDate: e.target.value }))} />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label>Note</Label>
                        <Input placeholder="e.g. Weekly wages" value={ledgerForm.description} onChange={(e) => setLedgerForm(p => ({ ...p, description: e.target.value }))} />
                      </div>
                    </>
                  )}
                  <div className="flex gap-2 pt-2">
                    <Button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700" disabled={!ledgerAmountEntered || !ledgerForm.workerId}>Save</Button>
                    <Button type="button" variant="outline" onClick={closeSheet}>Cancel</Button>
                  </div>
                </form>
              )}

              {activeTab === 'funds' && (
                <form onSubmit={handleFundsSubmit} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label>Amount (₹) *</Label>
                    <Input type="number" placeholder="e.g. 10000" autoFocus value={fundsForm.amount} onChange={(e) => setFundsForm(p => ({ ...p, amount: e.target.value }))} min="0" required />
                  </div>
                  {fundsAmountEntered && (
                    <>
                      <div className="space-y-1.5">
                        <Label>Allocate To *</Label>
                        <Select value={fundsForm.toUserId} onValueChange={(v) => setFundsForm(p => ({ ...p, toUserId: v }))} required>
                          <SelectTrigger><SelectValue placeholder="Select supervisor/worker" /></SelectTrigger>
                          <SelectContent>
                            {workers.map(w => <SelectItem key={w._id} value={w._id}>{w.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label>Reference #</Label>
                        <Input placeholder="e.g. TRF-001" value={fundsForm.referenceNumber} onChange={(e) => setFundsForm(p => ({ ...p, referenceNumber: e.target.value }))} />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Description</Label>
                        <Input placeholder="Optional note" value={fundsForm.description} onChange={(e) => setFundsForm(p => ({ ...p, description: e.target.value }))} />
                      </div>
                    </>
                  )}
                  <div className="flex gap-2 pt-2">
                    <Button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700" disabled={!fundsAmountEntered || !fundsForm.toUserId}>Allocate</Button>
                    <Button type="button" variant="outline" onClick={closeSheet}>Cancel</Button>
                  </div>
                </form>
              )}
            </div>
          </SheetContent>
        </Sheet>
      </MobileLayout>

      {/* Expense approve/reject dialog */}
      {approveExpense && (
        <ExpenseActions
          expense={approveExpense}
          isOpen={!!approveExpense}
          onClose={() => setApproveExpense(null)}
          onSuccess={() => { setApproveExpense(null); loadExpenses() }}
          action={approveAction}
        />
      )}
    </>
  )
}
