import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { ExpenseForm } from '@/components/expenses/ExpenseForm'
import { MobileLayout, FeedItem, EmptyFeed } from '@/components/mobile'
import { Receipt, FileText, CalendarDays, BookOpen, Loader, Users, Trash2 } from 'lucide-react'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { BillForm } from '@/components/bills/BillForm'
import { expensesApi, billsApi, attendanceApi, ledgerApi, usersApi, fundsApi, sitesApi } from '@/lib/api'
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
  { id: 'members',    label: 'Members',    icon: Users },
]

const BILL_STATUS = {
  pending:  'bg-amber-100 text-amber-700',
  credited: 'bg-blue-100 text-blue-700',
  paid:     'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
}

const EXPENSE_STATUS = {
  pending:  { label: 'Pending Approval', dot: 'bg-amber-400',  text: 'text-amber-600' },
  approved: { label: 'Approved',         dot: 'bg-blue-400',   text: 'text-blue-600'  },
  paid:     { label: 'Paid',             dot: 'bg-green-400',  text: 'text-green-600' },
  rejected: { label: 'Rejected',         dot: 'bg-red-400',    text: 'text-red-500'   },
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

// ─── Status meta (dot + label) ────────────────────────────────────────────────

function StatusMeta({ status }) {
  const s = EXPENSE_STATUS[status] || { dot: 'bg-gray-400', text: 'text-gray-500', label: status }
  return (
    <div className="flex items-center gap-1">
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      <span className={`text-[10px] font-medium ${s.text}`}>{s.label}</span>
    </div>
  )
}

// ─── Loading spinner ──────────────────────────────────────────────────────────

function TabLoader() {
  return (
    <div className="flex justify-center py-16">
      <Loader className="h-6 w-6 animate-spin text-gray-300" />
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function SupervisorExpense() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const { toast } = useToast()

  const [activeTab, setActiveTab] = useState('expenses')
  const [workers, setWorkers] = useState([])
  const [sheetOpen, setSheetOpen] = useState(false)
  const [wallet, setWallet] = useState(null)
  const [siteName, setSiteName] = useState('')
  const [members, setMembers] = useState([])
  const [membersLoading, setMembersLoading] = useState(false)

  // Expenses
  const [expenses, setExpenses] = useState([])
  const [expensesLoading, setExpensesLoading] = useState(false)

  // Attendance
  const [attendance, setAttendance] = useState([])
  const [attendanceLoading, setAttendanceLoading] = useState(false)
  const [attendanceForm, setAttendanceForm] = useState({
    workerId: '', date: TODAY, status: 'present', hoursWorked: '8', notes: '',
  })

  // Bills
  const [bills, setBills] = useState([])
  const [billsLoading, setBillsLoading] = useState(false)

  // Ledger
  const [ledger, setLedger] = useState([])
  const [ledgerLoading, setLedgerLoading] = useState(false)
  const [ledgerForm, setLedgerForm] = useState({
    amount: '', workerId: '', paymentMode: 'cash', description: '', transactionDate: TODAY,
  })
  const ledgerAmountEntered = parseFloat(ledgerForm.amount) > 0

  // ── Bootstrap ──

  useEffect(() => {
    usersApi.getChildren().then(r => setWorkers(r.data || [])).catch(() => {})
    fundsApi.getWalletSummary().then(r => setWallet(r.data)).catch(() => {})
    sitesApi.getAll().then(r => { const s = r.data || []; if (s.length) setSiteName(s[0].name) }).catch(() => {})
  }, [])

  const loadMembers = useCallback(async () => {
    setMembersLoading(true)
    try {
      const res = await usersApi.getChildren()
      setMembers(res.data || [])
    } catch {
      toast({ title: 'Error', description: 'Failed to load members', variant: 'destructive' })
    } finally { setMembersLoading(false) }
  }, [toast])

  // ── Data loaders ──

  const loadBills = useCallback(async () => {
    setBillsLoading(true)
    try {
      const res = await billsApi.getAll({ limit: 30 })
      setBills(res.data?.bills || [])
    } catch {
      toast({ title: 'Error', description: 'Failed to load bills', variant: 'destructive' })
    } finally { setBillsLoading(false) }
  }, [toast])

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

  useEffect(() => {
    if (activeTab === 'expenses')   loadExpenses()
    if (activeTab === 'bills')      loadBills()
    if (activeTab === 'attendance') loadAttendance()
    if (activeTab === 'ledger')     loadLedger()
    if (activeTab === 'members')    loadMembers()
  }, [activeTab, loadExpenses, loadBills, loadAttendance, loadLedger, loadMembers])

  // ── Sheet helpers ──

  const closeSheet = () => {
    setSheetOpen(false)
    setAttendanceForm({ workerId: '', date: TODAY, status: 'present', hoursWorked: '8', notes: '' })
    setLedgerForm({ amount: '', workerId: '', paymentMode: 'cash', description: '', transactionDate: TODAY })
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
      const hours =
        attendanceForm.status === 'present' ? parseFloat(attendanceForm.hoursWorked)
        : attendanceForm.status === 'half_day' ? 4
        : 0
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

  // ── Delete handlers ──

  const handleDeleteExpense = async (id) => {
    if (!window.confirm('Delete this expense?')) return
    try {
      await expensesApi.delete(id)
      toast({ title: 'Expense deleted' })
      loadExpenses()
    } catch (err) {
      toast({ title: 'Error', description: err.response?.data?.message || 'Failed to delete', variant: 'destructive' })
    }
  }

  const handleDeleteAttendance = async (id) => {
    if (!window.confirm('Delete this attendance record?')) return
    try {
      await attendanceApi.delete(id)
      toast({ title: 'Attendance deleted' })
      loadAttendance()
    } catch (err) {
      toast({ title: 'Error', description: err.response?.data?.message || 'Failed to delete', variant: 'destructive' })
    }
  }

  const handleDeleteBill = async (id) => {
    if (!window.confirm('Delete this bill?')) return
    try {
      await billsApi.delete(id)
      toast({ title: 'Bill deleted' })
      loadBills()
    } catch (err) {
      toast({ title: 'Error', description: err.response?.data?.message || 'Failed to delete', variant: 'destructive' })
    }
  }

  const handleDeleteLedger = async (id) => {
    if (!window.confirm('Delete this payment record?')) return
    try {
      await ledgerApi.delete(id)
      toast({ title: 'Record deleted' })
      loadLedger()
    } catch (err) {
      toast({ title: 'Error', description: err.response?.data?.message || 'Failed to delete', variant: 'destructive' })
    }
  }

  // ── Labels ──

  const fabLabels = { expenses: 'Add Expense', bills: 'Add Bill', attendance: 'Mark Attendance', ledger: 'Pay Worker', members: null }

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <MobileLayout
      title="Construction"
      subtitle={siteName || undefined}
      userName={user?.name}
      wallet={wallet}
      onLogout={() => { logout(); navigate('/login') }}
      tabs={TABS}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      fabLabel={fabLabels[activeTab]}
      onFabClick={fabLabels[activeTab] ? () => setSheetOpen(true) : undefined}
    >

      {/* ── Expenses tab ── */}
      {activeTab === 'expenses' && (
        expensesLoading ? <TabLoader /> :
        expenses.length === 0 ? (
          <EmptyFeed
            icon={Receipt}
            message="No expenses yet"
            action={{ label: '+ Add your first expense', onClick: () => setSheetOpen(true) }}
          />
        ) : (
          <div className="divide-y divide-gray-100 bg-white">
            {expenses.map((exp) => (
              <FeedItem
                key={exp._id}
                seed={exp.description || 'E'}
                title={exp.description || '—'}
                subtitle={[formatDate(exp.expenseDate), exp.vendorName].filter(Boolean).join(' · ')}
                meta={<StatusMeta status={exp.status} />}
                amount={formatCurrency(exp.requestedAmount || exp.amount)}
                actions={exp.status === 'pending' && (
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDeleteExpense(exp._id) }}
                    className="p-1.5 text-gray-300 hover:text-red-400 transition-colors"
                    aria-label="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              />
            ))}
          </div>
        )
      )}

      {/* ── Bills tab ── */}
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
                actions={bill.status === 'pending' && (
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDeleteBill(bill._id) }}
                    className="p-1.5 text-gray-300 hover:text-red-400 transition-colors"
                    aria-label="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              />
            ))}
          </div>
        )
      )}

      {/* ── Attendance tab ── */}
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
                  actions={
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteAttendance(rec._id) }}
                      className="p-1.5 text-gray-300 hover:text-red-400 transition-colors"
                      aria-label="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  }
                />
              )
            })}
          </div>
        )
      )}

      {/* ── Ledger tab ── */}
      {activeTab === 'ledger' && (
        ledgerLoading ? <TabLoader /> :
        ledger.length === 0 ? (
          <EmptyFeed
            icon={BookOpen}
            message="No payments recorded yet"
            action={{ label: '+ Record a payment', onClick: () => setSheetOpen(true) }}
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
                  actions={
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteLedger(entry._id) }}
                      className="p-1.5 text-gray-300 hover:text-red-400 transition-colors"
                      aria-label="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  }
                />
              )
            })}
          </div>
        )
      )}

      {/* ── Members tab ── */}
      {activeTab === 'members' && (
        membersLoading ? <TabLoader /> :
        members.length === 0 ? (
          <EmptyFeed icon={Users} message="No workers in your team yet" />
        ) : (
          <div className="divide-y divide-gray-100 bg-white">
            {members.map((m) => {
              const roleLabel = m.isParent ? 'Manager' : m.role === 3 ? 'Supervisor' : m.role === 4 ? 'Worker' : `Role ${m.role}`
              return (
                <FeedItem
                  key={m._id}
                  seed={m.name}
                  title={m.name}
                  subtitle={m.email}
                  meta={
                    <span className={`text-[10px] font-medium capitalize ${m.isParent ? 'text-blue-500' : 'text-gray-400'}`}>
                      {m.isParent && '↑ '}{roleLabel}
                    </span>
                  }
                  amount={!m.isParent ? formatCurrency(m.walletBalance ?? 0) : undefined}
                  amountClass={!m.isParent ? ((m.walletBalance ?? 0) >= 0 ? 'text-green-600' : 'text-red-500') : ''}
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
            {/* Drag handle */}
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
                  <Select
                    value={attendanceForm.workerId}
                    onValueChange={(v) => setAttendanceForm(p => ({ ...p, workerId: v }))}
                    required
                  >
                    <SelectTrigger><SelectValue placeholder="Select worker" /></SelectTrigger>
                    <SelectContent>
                      {workers.map(w => <SelectItem key={w._id} value={w._id}>{w.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Status *</Label>
                    <Select
                      value={attendanceForm.status}
                      onValueChange={(v) => setAttendanceForm(p => ({ ...p, status: v }))}
                    >
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
                    <Input
                      type="date"
                      value={attendanceForm.date}
                      onChange={(e) => setAttendanceForm(p => ({ ...p, date: e.target.value }))}
                      required
                    />
                  </div>
                </div>

                {attendanceForm.status === 'present' && (
                  <div className="space-y-1.5">
                    <Label>Hours Worked</Label>
                    <Input
                      type="number"
                      value={attendanceForm.hoursWorked}
                      onChange={(e) => setAttendanceForm(p => ({ ...p, hoursWorked: e.target.value }))}
                      min="0" max="24" step="0.5"
                    />
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label>Notes</Label>
                  <Input
                    placeholder="Optional note"
                    value={attendanceForm.notes}
                    onChange={(e) => setAttendanceForm(p => ({ ...p, notes: e.target.value }))}
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <Button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700" disabled={!attendanceForm.workerId}>
                    Save
                  </Button>
                  <Button type="button" variant="outline" onClick={closeSheet}>Cancel</Button>
                </div>
              </form>
            )}

            {activeTab === 'ledger' && (
              <form onSubmit={handleLedgerSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Amount (₹) *</Label>
                  <Input
                    type="number"
                    placeholder="e.g. 2500"
                    autoFocus
                    value={ledgerForm.amount}
                    onChange={(e) => setLedgerForm(p => ({ ...p, amount: e.target.value }))}
                    min="0"
                    required
                  />
                </div>

                {ledgerAmountEntered && (
                  <>
                    <div className="space-y-1.5">
                      <Label>Worker *</Label>
                      <Select
                        value={ledgerForm.workerId}
                        onValueChange={(v) => setLedgerForm(p => ({ ...p, workerId: v }))}
                        required
                      >
                        <SelectTrigger><SelectValue placeholder="Select worker" /></SelectTrigger>
                        <SelectContent>
                          {workers.map(w => <SelectItem key={w._id} value={w._id}>{w.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label>Payment Mode</Label>
                        <Select
                          value={ledgerForm.paymentMode}
                          onValueChange={(v) => setLedgerForm(p => ({ ...p, paymentMode: v }))}
                        >
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {PAYMENT_MODES.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label>Date</Label>
                        <Input
                          type="date"
                          value={ledgerForm.transactionDate}
                          onChange={(e) => setLedgerForm(p => ({ ...p, transactionDate: e.target.value }))}
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label>Note</Label>
                      <Input
                        placeholder="e.g. Weekly wages"
                        value={ledgerForm.description}
                        onChange={(e) => setLedgerForm(p => ({ ...p, description: e.target.value }))}
                      />
                    </div>
                  </>
                )}

                <div className="flex gap-2 pt-2">
                  <Button
                    type="submit"
                    className="flex-1 bg-blue-600 hover:bg-blue-700"
                    disabled={!ledgerAmountEntered || !ledgerForm.workerId}
                  >
                    Save
                  </Button>
                  <Button type="button" variant="outline" onClick={closeSheet}>Cancel</Button>
                </div>
              </form>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </MobileLayout>
  )
}
